const LicenseType = {
  Go: 'Go',
  Caution: 'Caution',
  Stop: 'Stop',
  Unknown: 'Unknown'
}

class LicenseEvaluator {
  
  static fromLicenseListObj(obj) {
    const result = new LicenseEvaluator();

    result.goList = obj.go;
    result.cautionList = obj.caution;
    result.stopList = obj.stop;

    return result;
  }

  isOnList(licenseObj, list) {
    // currently we only evaluate license SPDX IDs
    // in the future we can extend this for better matching of licenses
    return list && licenseObj.id ? list.includes(licenseObj.id) : false;
  }

  getLicenseType(licenseObj) {
    if (this.isOnList(licenseObj, this.goList)) {
      return LicenseType.Go;
    } else if (this.isOnList(licenseObj, this.cautionList)) {
      return LicenseType.Caution;
    } else if (this.isOnList(licenseObj, this.cautionList)) {
      return LicenseType.Stop;      
    } else {
      return LicenseType.Unknown;
    }
  }

}

module.exports = {
  LicenseType: LicenseType,
  LicenseEvaluator: LicenseEvaluator
}

  