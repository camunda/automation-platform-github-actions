const semver = require('semver');

const Models = require('./models.js');
const SBOMParser = require('./parser');

const ChangeType = {
  Upgraded: 'Upgraded',
  Downgraded: 'Downgraded',
  DependenciesChanged: 'DependenciesChanged', // the version is the same, but the dependencies have changed
  Unknown: 'Unknown'
}

function diffSBOMs(baseSBOM, comparingSBOM) {

  if (!baseSBOM.describesSameProjectAs(comparingSBOM)) {
    throw new Error(`Cannot compare SBOMs because they describe different projects. Base: ${baseSBOM.getProjectComponentId()}, head: ${comparingSBOM.getProjectComponentId()}`);
  }

  const sbomDiff = new Models.SBOMDiff();

  sbomDiff.rootComponentDiff = diffComponents(sbomDiff, baseSBOM.rootComponent, comparingSBOM.rootComponent);

  return sbomDiff;
}

function diffComponents(sbomDiff, baseComponent, comparingComponent) {

  // assumptions:
  /*
    - we need to know which modules are updated between the SBOMs. This cannot be trivially determined
      by iterating through all modules and comparing versions, because they may sit at different
      locations in the dependency tree 
    - we compare modules top down, because for the root module we know that it is the same in both BOMs
    - then, for each module we compare the dependencies. Modified dependencies (same coordinates, different versions)
      can always be matched, because one module cannot have the same (direct) dependency in multiple versions
    - we then can traverse the dependency chain further down, while keeping the context to which changed
      dependency the traversal belongs
  */

  let componentDiff = sbomDiff.getComponentDiff(baseComponent, comparingComponent);
  if (componentDiff) {
    /*
    * In an SBOM, any unique component has only one set of dependencies. 
    * In a real-world project (e.g. Maven multi-module project), it can happen that the same dependency is used
    * in multiple places with difference transitive dependencies (e.g. due to Maven's dependency management).
    * This algorithm doesn't account for this case (e.g. the SBOM Maven plugin cannot generate an SBOM that 
    * would differentiate in such a case). 
    * 
    * On the upside, we can save a lot of comparison work by caching component diffs.
    */
    return componentDiff;
  }
  
  componentDiff = new Models.SBOMComponentDiff(baseComponent, comparingComponent);

  const unmatchedDependencies = Object.assign({}, comparingComponent.dependencies);

  Object.values(baseComponent.dependencies).forEach(baseDependency => {

    const matchingDependency = unmatchedDependencies[baseDependency.moduleId];
    if (matchingDependency !== undefined) {
      delete unmatchedDependencies[matchingDependency.moduleId];

      const nestedComponentDiff = diffComponents(sbomDiff, baseDependency, matchingDependency);

      // first case: component versions are just different; 
      // second case: snapshot versions where the version name is the same but the dependencies
      //   may differ nevertheless
      if (!baseDependency.isEqualTo(matchingDependency) || nestedComponentDiff.hasChanges()) {

        componentDiff.addChangedDependency(baseDependency, nestedComponentDiff);
        sbomDiff.addComponentDiff(nestedComponentDiff);
      }
      // else the dependency hasn't changed and we don't add it to the diff

    } else {
      componentDiff.addRemovedDependency(baseDependency);
      sbomDiff.addRemovedDependency(baseDependency);
    }
  });

  Object.values(unmatchedDependencies).forEach(unmatchedDependency => {
    componentDiff.addAddedDependency(unmatchedDependency);
    sbomDiff.addAddedDependency(unmatchedDependency);
    unmatchedDependency.transitiveHull.forEach(transitiveDependency => {
      sbomDiff.addAddedDependency(transitiveDependency);
    });
  });

  if (!(semver.valid(baseComponent.version) && semver.valid(comparingComponent.version))) {
    componentDiff.changeType = ChangeType.Unknown;
  } else if (semver.lt(baseComponent.version, comparingComponent.version)) {
    componentDiff.changeType = ChangeType.Upgraded;
  } else if (semver.gt(baseComponent.version, comparingComponent.version)) {
    componentDiff.changeType = ChangeType.Downgraded;
  } else {
    componentDiff.changeType = ChangeType.DependenciesChanged;
  }

  return componentDiff;
}

module.exports = async function(baseSBOMJson, headSBOMJson, primaryPartyGroupMatcher, licenseListJson = '{}') {
  
  const baseSBOMObj = JSON.parse(baseSBOMJson); 
  const headSBOMObj = JSON.parse(headSBOMJson); 
  
  const parser = new SBOMParser();

  const licenseListObj = JSON.parse(licenseListJson); 
  
  const baseSBOM = parser.parse(baseSBOMObj, primaryPartyGroupMatcher, licenseListObj);
  const headSBOM = parser.parse(headSBOMObj, primaryPartyGroupMatcher, licenseListObj);

  return diffSBOMs(baseSBOM, headSBOM);
}