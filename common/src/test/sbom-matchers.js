const Models = require('./../sbom-diff/models');

function toDescribeComponent(actual, group, name, version) {

    if (! (actual instanceof Models.SBOMComponentDiff)) {
      throw new Error(`Must be used with an instance of SBOMDiff. Got ${actual}`);
    }
  
    var baseComponent = actual.baseComponent;
    var comparingComponent = actual.comparingComponent;
  
    const isMatch = component => component.group === group 
      && component.name === name 
      && component.version === version;
  
    return {
      message: () => `Expected ${this.utils.printReceived(
        actual,
      )} to diff components with coordinates ${group}:${name}:${version}`,
      pass: isMatch(baseComponent) && isMatch(comparingComponent),
    };
  }
  
  function toHaveAdditions(actual, purls) {
  
    const actualPurls = Object.values(actual.addedDependencies).map(dependency => dependency.purl);
    const isMatch = this.equals(actualPurls, purls); 
  
    return {
      message: () => `Expected ${this.utils.printReceived(
        actual,
      )} to have added dependencies ${purls} but was ${actualPurls}`,
      pass: isMatch,
    };
  }
  
  function toHaveRemovals(actual, purls) {
  
    const actualPurls = Object.values(actual.removedDependencies).map(dependency => dependency.purl);
    const isMatch = this.equals(actualPurls, purls); 
  
    return {
      message: () => `Expected ${this.utils.printReceived(
        actual,
      )} to have removed dependencies ${purls} but was ${actualPurls}`,
      pass: isMatch,
    };
  }
  
  function toHaveChanges(actual, changes) {
    // { moduleId: "" , baseVersion: "", comparingVersion: "" }
  
    const actualChanges = Object.assign({}, actual.changedDependencies);
    const unmatchedChanges = [];
    var allChangesMatch = true;
  
    changes.forEach(change => {
      const actualChange = actualChanges[change.moduleId];
  
      if (actualChange) {
        delete actualChanges[change.moduleId];
        allChangesMatch &= actualChange.baseComponent.version === change.baseVersion
          && actualChange.baseComponent.moduleId === change.moduleId
          && actualChange.comparingComponent.version === change.comparingVersion
          && actualChange.comparingComponent.moduleId === change.moduleId;
      } else {
        unmatchedChanges.push(change);
      }
    });
  
    const isMatch = allChangesMatch && Object.keys(actualChanges).length === 0 && unmatchedChanges.length === 0; 
  
    return {
      message: () => `Expected ${this.utils.printReceived(
        actual,
      )} to have changed dependencies ${JSON.stringify(changes)} but was ${Array.from(actual.changedDependencies.values())}`,
      pass: isMatch,
    };
  }

  module.exports = {
    toDescribeComponent,
    toHaveAdditions,
    toHaveRemovals,
    toHaveChanges
  };