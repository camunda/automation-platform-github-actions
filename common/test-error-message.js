const diffSBOMs = require('./src/sbom-diff/differ.js');
const fs = require('fs');
const path = require('path');

async function testErrorMessage() {
  try {
    // Read project A SBOM
    const projectA1SBOMString = fs.readFileSync(path.join(__dirname, 'src/test/sbom-diff-test-resources', 'project-a1.json'), 'utf8');
    
    // Parse and modify it to create a different project
    const projectA1SBOM = JSON.parse(projectA1SBOMString);
    const projectBSBOM = JSON.parse(projectA1SBOMString);
    
    // Change the metadata to make it a different project
    projectBSBOM.metadata.component.name = 'project-b';
    projectBSBOM.metadata.component.purl = 'pkg:maven/org.camunda.example/project-b@1.0-SNAPSHOT?type=jar';
    projectBSBOM.metadata.component['bom-ref'] = 'pkg:maven/org.camunda.example/project-b@1.0-SNAPSHOT?type=jar';
    
    console.log('Testing error message when comparing different projects...');
    
    // This should throw an error with project IDs
    const diff = await diffSBOMs(JSON.stringify(projectA1SBOM), JSON.stringify(projectBSBOM), '^org\\.camunda');
    
    console.log('✗ Test failed: Expected an error to be thrown');
    process.exit(1);
  } catch (error) {
    if (error.message.includes('Cannot compare SBOMs because they describe different projects')) {
      console.log('✓ Test passed: Error message contains expected text');
      console.log('Error message:', error.message);
      
      // Check if the error message includes project IDs (purls)
      if (error.message.includes('pkg:maven/org.camunda.example/project-a') && 
          error.message.includes('pkg:maven/org.camunda.example/project-b')) {
        console.log('✓ Test passed: Error message includes both project component IDs (purls)');
      } else {
        console.log('✗ Test failed: Error message does not include both project component IDs');
        console.log('Expected to see both project-a and project-b purls');
        process.exit(1);
      }
    } else {
      console.log('✗ Test failed: Unexpected error:', error.message);
      process.exit(1);
    }
  }
}

testErrorMessage();
