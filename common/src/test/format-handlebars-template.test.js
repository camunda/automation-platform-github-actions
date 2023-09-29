const diffSBOMs = require('../sbom-diff/differ');
const formatHandlebarsTemplate = require('../sbom-diff/format-handlebars-template');
const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe("SBOM diff formatting", () => {

  test("it should format some SBOM diff", async () => {
    
    // given
    const baseSBOM = readFile(path.join(__dirname, 'sbom-diff-test-resources', 'platform-base.json'));
    const comparingSBOM = readFile(path.join(__dirname, 'sbom-diff-test-resources', 'platform-head.json'));

    const licenseList = readFile(path.join(__dirname, './../../../java-dependency-check/licenses.json'));
    
    const diff = await diffSBOMs(baseSBOM, comparingSBOM, '^org\\.camunda', licenseList);
    
    const template = readFile(path.join(__dirname, './../../../java-dependency-check/diff.hbs'));

    const componentVersionPartial = readFile(path.join(__dirname, './../../../java-dependency-check/component-version.hbs'));
    const componentDetailsPartial = readFile(path.join(__dirname, './../../../java-dependency-check/component-details.hbs'));
    const componentDiffPartial = readFile(path.join(__dirname, './../../../java-dependency-check/component-diff.hbs'));
    const componentTreePartial = readFile(path.join(__dirname, './../../../java-dependency-check/component-tree.hbs'));
    const partials = {componentVersion: componentVersionPartial, 
      componentDetails: componentDetailsPartial,
      componentDiff: componentDiffPartial,
      componentTree: componentTreePartial};
    
    // when
    const formattedContent = await formatHandlebarsTemplate(diff, template, partials);
   
    // then
    expect(formattedContent).not.toBeUndefined()

    // no detailed assertions of the result, to complicated to write and maintain
  });
});