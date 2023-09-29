const handlebars = require('handlebars');
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Emoji lookup table: https://www.quackit.com/character_sets/emoji/emoji_v3.0/unicode_emoji_v3.0_characters_all.cfm
// We are using the unicode emoji codes instead of github emoji codes (e.g. ':warning:'), because 
// those can also be interpreted by tools outside of github (e.g. browsers)
const licenseEmojis = {
  Go: '&#10004;', // heavy check mark
  Caution: '&#9888;', // warning sign
  Stop: '&#10060;', // cross mark
  Unknown: '&#10067;' // question mark
};

const changeTypeEmojis = {
  Upgraded: '&#11014;', // up arrow
  Downgraded: '&#11015;', // down arrow
  DependenciesChanged: '&#128260;', // anticlockwise arrows button
  Unknown: '&#129335;', // person shrugging
  Added: '&#10133;', // plus sign
  Removed: '&#10134;' // minus sign
};

// true limit is 65536, but let's be a bit defensive, at least in Java some 
// unicode characters technically count as two
const GITHUB_COMMENT_CHARACTER_LIMIT = 65000; 

module.exports = async function (sbomDiff, template, partials = {}) {

  handlebars.registerPartial(partials);

  // A weakly unique identifier for this template rendering invocation.
  // Can be used for example to generate unique anchors in the template
  // across multiple uses of the template.
  const renderId = Date.now() % 10000;
  handlebars.registerHelper('renderId', function() {
    return renderId;
  });

  handlebars.registerHelper('urlEncode', function(value) {
    return encodeURIComponent(value);
  });

  handlebars.registerHelper('increment', function(value) {
    return value + 1;
  });

  // stores if the currently rendered item is the last one for each
  // of the nested lists
  const currentIndentationState = []; 
  
  handlebars.registerHelper('indent', function(times, lastItemInList) {

    while (times > currentIndentationState.length) {
      currentIndentationState.push(false);
    }
    while (times < currentIndentationState.length) {
      currentIndentationState.pop();
    }

    currentIndentationState[times - 1] = lastItemInList;

    const visualizationComponents = currentIndentationState.map((lastItemInListAtCurrentLevel, index) => {
      const isMostDeeplyNestedList = index === currentIndentationState.length - 1;
      
      if (lastItemInListAtCurrentLevel) {
        return isMostDeeplyNestedList ? ' └─ ' : '    ';
      } else {
        return isMostDeeplyNestedList ? ' ├─ ' : ' │  ';
      }
    });

    return visualizationComponents.join('');
  });

  handlebars.registerHelper('emojifyLicense', function(licenseType) {
    return new handlebars.SafeString(licenseEmojis[licenseType]);
  });

  handlebars.registerHelper('emojifyChangeType', function(changeType) {
    return new handlebars.SafeString(changeTypeEmojis[changeType]);
  });

  handlebars.registerHelper('isDowngrade', function(changeType) {
    return changeType === 'Downgraded';
  });

  handlebars.registerHelper('hasChanges', function(componentDiff) {
    return Object.keys(componentDiff.changedDependencies).length !== 0 ||
    Object.keys(componentDiff.addedDependencies).length !== 0 ||
    Object.keys(componentDiff.removedDependencies).length !== 0;
  });

  const renderedDiffs = new Set();
  handlebars.registerHelper('shouldRenderComponentDiff', function(componentDiff) {
    const componentDiffId = `${componentDiff.baseComponent.purl} => ${componentDiff.comparingComponent.purl}`;

    if (renderedDiffs.has(componentDiffId)) {
      return false;
    } else {
      renderedDiffs.add(componentDiffId);
      return true;
    }
  });

  handlebars.registerHelper('hasDependencies', function(component) {
    return Object.keys(component.dependencies).length !== 0;
  });

  const renderedTrees = new Set();
  handlebars.registerHelper('shouldRenderComponentTree', function(component) {
    if (renderedTrees.has(component.purl)) {
      return false;
    } else {
      renderedTrees.add(component.purl);
      return true;
    }
  });
  
  const compiledTemplate = handlebars.compile(template);

  const fullDiffMd = compiledTemplate({ diff: sbomDiff });
  var githubCommentMd = fullDiffMd;

  if (fullDiffMd.length > GITHUB_COMMENT_CHARACTER_LIMIT) {
    
    const withoutTreeDiff = compiledTemplate({ diff: sbomDiff, excludeTree: true });

    if (withoutTreeDiff.length <= GITHUB_COMMENT_CHARACTER_LIMIT) {
      githubCommentMd = withoutTreeDiff;
    } else {
      githubCommentMd = compiledTemplate({ diff: sbomDiff, excludeTree: true, excludeModuleDetails: true });
    }
  }

  // these are legacy options of marked that we are disabling to prevent log warnings
  marked.use({
    headerIds: false,
    mangle: false
  });
  const unsanitizedFullDiffHtml = marked.parse(fullDiffMd);
  
  const window = new JSDOM('').window;
  const domPurify = createDOMPurify(window);

  const fullDiffHtml = domPurify.sanitize(unsanitizedFullDiffHtml);
  
  return { githubComment: githubCommentMd, fullDiff: fullDiffHtml };
  
}