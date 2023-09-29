const LicenseType = require('./license-tools.js').LicenseType;

class Component {
  static fromSBOMObj(obj, primaryPartyGroupMatcher, licenseEvaluator) {
    const result = new Component();
      
    result.group = obj.group;
    result.name = obj.name;
    result.version = obj.version;
    // unique identifier for the component
    result.purl = obj.purl;
    result.bomRef = obj['bom-ref'];
    // an id that is the same for components that have the
    // same coordinates except for the versions
    result.moduleId = result.group + ':' + result.name;

    // moduleId => component
    result.dependencies = {};
    result.dependents = [];
    result.transitiveHull = [];

    result.thirdParty = !obj.group.match(primaryPartyGroupMatcher);

    // licenses in the SBOM schema may be identified by either of the following:
    //  * an SPDX ID (id field)
    //  * a name (if the license does not have an ID, e.g. if it is a non-standard license
    //    or due to tooling deficiencies)
    //  * an SPDX expression that contains multiple applying licenses, e.g. (LGPL-2.1 OR BSD-3-Clause AND MIT)
    if (obj.licenses) {
      result.licenses = obj.licenses.map(licenseObj => Component.convertLicenseObject(licenseObj, licenseEvaluator));
    
      result.carefulLicenseTypes = [
        {type: LicenseType.Caution, used: false},
        {type: LicenseType.Stop, used: false},
        {type: LicenseType.Unknown, used: false}];

      result.licenses.forEach(license => {
        const licenseType = result.carefulLicenseTypes.find(usedLicense => usedLicense.type === license.type);
        if (licenseType) {
          licenseType.used = true;
        }
      });
    } else {
      // it can happen that a library has no licenses declared
      // or that the scanner doesn't detect it
      result.licenses = [];
      result.carefulLicenseTypes = [{type: LicenseType.Unknown, used: true}]
    }

    result.allLicensesGo = result.licenses.length > 0 && result.licenses.every(license => license.type === LicenseType.Go);

    result.hasMultipleLicenses = result.licenses.length > 1;

    if (obj.externalReferences) {
      result.links = obj.externalReferences.map(externalReference => {
        return {
          label: externalReference.type,
          link: externalReference.url
        };
      });
    } else {
      result.links = [];
    }
    
    return result;
  }

  static convertLicenseObject(licenseObj, licenseEvaluator) {
    if (licenseObj.license) {
      const licenseString = licenseObj.license.id ? 
        licenseObj.license.id : 
        `${licenseObj.license.name} / ${licenseObj.license.url}`;

      return {
        id: licenseObj.license.id,
        name: licenseObj.license.name,
        url: licenseObj.license.url,
        type: licenseEvaluator.getLicenseType(licenseObj.license),
        string: licenseString
      };
    } else {
     return {
        spdxExpression: licenseObj.expression,
        type: LicenseType.Unknown,
        string: licenseObj.expression
      };
    }
  }

  isEqualTo(other) {
    return this.purl === other.purl;
  }

  toString() {
    return `{purl: ${this.purl}}`;
  }
}

class SBOM {
  
  static fromSBOMObj(obj, primaryPartyGroupMatcher, licenseEvaluator){
    const result = new SBOM();
    
    result.components = new Map();
    result.rootComponent = Component.fromSBOMObj(obj.metadata.component, primaryPartyGroupMatcher, licenseEvaluator);
    result.addComponent(result.rootComponent);
    
    return result;
  }
  
  describesSameProjectAs(other) {
    return this.rootComponent.isEqualTo(other.rootComponent);
  }
  
  addComponent(component) {
    this.components.set(component.bomRef, component);
  }
  
  getComponent(bomRef) {
    return this.components.get(bomRef);
  }
}

class SBOMDiff {

  constructor() {

    // purl => component diff
    this.changedDependencies = {};

    // purl => component
    this.addedDependencies = {};
    this.removedDependencies = {};

    // purl => component
    this.involvedComponents = {}; // either added, removed or changed
  }

  encodeComponentPair(baseComponent, comparingComponent) {
    return `${baseComponent.purl}:${comparingComponent.purl}`;
  }

  getComponentDiff(baseComponent, comparingComponent) {
    const componentPairId = this.encodeComponentPair(baseComponent, comparingComponent);
    return this.changedDependencies[componentPairId];
  }

  addComponentDiff(componentDiff) {
    const baseComponent = componentDiff.baseComponent;
    const comparingComponent = componentDiff.comparingComponent;

    const componentPairId = this.encodeComponentPair(baseComponent, comparingComponent);

    this.changedDependencies[componentPairId] = componentDiff;
    this.involvedComponents[baseComponent.purl] = baseComponent;
    this.involvedComponents[comparingComponent.purl] = comparingComponent;
  }

  addAddedDependency(component) {
    this.addedDependencies[component.purl] = component;
    this.involvedComponents[component.purl] = component;
  }

  addRemovedDependency(component) {
    this.removedDependencies[component.purl] = component;
    this.involvedComponents[component.purl] = component;
  }

}

class SBOMComponentDiff {
  constructor(baseComponent, comparingComponent) {
    this.baseComponent = baseComponent;
    this.comparingComponent = comparingComponent;

    // module id => component diff
    this.changedDependencies = {}; // dependencies that exist in both components but with differences (e.g. different versions)

    // module id => component
    this.addedDependencies = {};
    this.removedDependencies = {};
  }

  getChange(moduleId) {
    return this.changedDependencies[moduleId];
  }

  toString() {
    return `{base: ${this.baseComponent.purl}, comparing: ${this.comparingComponent.purl}}`;
  }

  hasChanges() {
    return Object.keys(this.changedDependencies).length !== 0 ||
      Object.keys(this.addedDependencies).length !== 0 ||
      Object.keys(this.removedDependencies).length !== 0;
  }

  addChangedDependency(component, componentDiff) {
    this.changedDependencies[component.moduleId] = componentDiff;
  }

  addAddedDependency(component) {
    this.addedDependencies[component.moduleId] = component;
  }

  addRemovedDependency(component) {
    this.removedDependencies[component.moduleId] = component;
  }
}

module.exports = {
  Component: Component,
  SBOM: SBOM,
  SBOMDiff: SBOMDiff,
  SBOMComponentDiff: SBOMComponentDiff
};