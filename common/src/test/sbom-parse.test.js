const SBOMParser = require('./../sbom-diff/parser');
const fs = require('fs');
const path = require('path');

function readJsonAsObject(filePath) {
  const json = fs.readFileSync(filePath, 'utf8');
  return JSON.parse
  (json);
}

describe("SBOM diff", () => {
  test("it should flag third-party dependencies", async () => {
    
    // given
    const projectA1SBOM = readJsonAsObject(path.join(__dirname, 'sbom-diff-test-resources', 'project-a1.json'));
    
    const primaryPartyGroupRegex = '^org\\.camunda'

    const parser = new SBOMParser();
    
    // when
    const sbom = parser.parse(projectA1SBOM, primaryPartyGroupRegex, {});

    // then
    const components = sbom.components;
    
    expect(components.size).toEqual(19);

    let numThirdPartyComponents = 0;

    components.forEach(component => {
      if (component.thirdParty) {
        numThirdPartyComponents++;
      }
    });

    expect(numThirdPartyComponents).toEqual(18);
  });


    
});