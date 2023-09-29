const Models = require('./models.js');
const LicenseTools = require('./license-tools.js')

class SBOMParser {
    
  parse(obj, primaryPartyGroupMatcher, licenseListObj) {
    const licenseEvaluator = LicenseTools.LicenseEvaluator.fromLicenseListObj(licenseListObj);

    this.sbomObj = obj;
    
    this.parseMetadata(primaryPartyGroupMatcher, licenseEvaluator);
    this.parseComponents(primaryPartyGroupMatcher, licenseEvaluator);
    this.populateDependenciesFromSBOMObj();
    
    const sbom = this.sbom;
    
    this.resetParser();
    
    return sbom;
  }
  
  resetParser() {
    this.sbomObj = null;
    this.sbom = null;
  }

  parseMetadata(primaryPartyGroupMatcher, licenseEvaluator) {
    this.sbom = Models.SBOM.fromSBOMObj(this.sbomObj, primaryPartyGroupMatcher, licenseEvaluator);
  }
  
  parseComponents(primaryPartyGroupMatcher, licenseEvaluator) {

    if (this.sbomObj.components) {
      // components can be undefined if a project does not have dependencies

      this.sbomObj.components.forEach(componentObj => {
        const component = Models.Component.fromSBOMObj(componentObj, primaryPartyGroupMatcher, licenseEvaluator);
        this.sbom.addComponent(component);
      });
    }
  }
  
  populateDependenciesFromSBOMObj() {
    // populate plain dependencies
    this.sbomObj.dependencies.forEach(dependencyObj => {
      
      const dependent = this.sbom.getComponent(dependencyObj.ref);
      const dependencies = dependencyObj.dependsOn.reduce((obj, bomRef) => {
        const dependency = this.sbom.getComponent(bomRef);
        obj[dependency.moduleId] = dependency;
        return obj;
      }, {});
      
      dependent.dependencies = dependencies;
      Object.values(dependencies).forEach(dependency => {
        dependency.dependents.push(dependent);
      });
    });
    
    // compute transitive hull
    this.sbom.components.forEach(component => {
      /*
      * The following code creates the transitive hull of dependencies
      * by putting each dependency into the transitive hull of its parent
      * and higher ancestor dependents. This bottom-up approach is more efficient
      * than collecting all transitive dependencies "naively" for each component.
      */
            
      // make a copy because we are modifying this array as we iterate
      let dependents = component.dependents.slice();
      
      while (dependents.length > 0) {
        const currentDependent = dependents.pop();
        currentDependent.transitiveHull = currentDependent.transitiveHull || [];
        
        // this statement prevents:
        //   * Adding a dependency multiple times if it occurs at 
        //     multiple points in the dependency tree of the dependent
        //   * An infinite loop if an SBOM file (errouneously) contains circular dependencies
        if (!currentDependent.transitiveHull.includes(component)) {
          currentDependent.transitiveHull.push(component);
          
          dependents = dependents.concat(currentDependent.dependents);
        }
      }
    });
    
  }
  
  getSBOM() {
    return this.sbom;
  }
}

module.exports = SBOMParser;