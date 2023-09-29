const diffSBOMs = require('./../sbom-diff/differ');
const sbomMatchers = require('./sbom-matchers');
const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

expect.extend(sbomMatchers);

describe("SBOM diff", () => {

  test("it should detect an added dependency", async () => {
    
    const projectA1SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a1.json'));
    const projectA3SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a3.json'));
    
    const diff = await diffSBOMs(projectA3SBOM, projectA1SBOM, '^org\\.camunda');
    const rootComponentDiff = diff.rootComponentDiff;
    
    expect(rootComponentDiff).toDescribeComponent('org.camunda.example', 'project-a', '1.0-SNAPSHOT');

    expect(rootComponentDiff).toHaveAdditions(['pkg:maven/org.springframework.boot/spring-boot-starter@3.0.0?type=jar']);
    expect(rootComponentDiff).toHaveRemovals([]);
    expect(rootComponentDiff).toHaveChanges([]);
  });

  test("it should detect a removed dependency", async () => {
    
    const projectA1SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a1.json'));
    const projectA3SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a3.json'));
    
    const diff = await diffSBOMs(projectA1SBOM, projectA3SBOM, '^org\\.camunda');
    const rootComponentDiff = diff.rootComponentDiff;

    expect(rootComponentDiff).toDescribeComponent('org.camunda.example', 'project-a', '1.0-SNAPSHOT');

    expect(rootComponentDiff).toHaveAdditions([]);
    expect(rootComponentDiff).toHaveRemovals(['pkg:maven/org.springframework.boot/spring-boot-starter@3.0.0?type=jar']);
    expect(rootComponentDiff).toHaveChanges([]);
  });

  test("it should diff a complex changed dependency", async () => {
    
    const projectA1SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a1.json'));
    const projectA2SBOM = readJson(path.join(__dirname, 'sbom-diff-test-resources', 'project-a2.json'));
    
    const diff = await diffSBOMs(projectA1SBOM, projectA2SBOM, '^org\\.camunda');
    const rootComponentDiff = diff.rootComponentDiff;

    expect(rootComponentDiff).toDescribeComponent('org.camunda.example', 'project-a', '1.0-SNAPSHOT');

    expect(rootComponentDiff).toHaveAdditions([]);
    expect(rootComponentDiff).toHaveRemovals([]);
    expect(rootComponentDiff).toHaveChanges([{
      moduleId: "org.springframework.boot:spring-boot-starter",
      baseVersion: "3.0.0",
      comparingVersion: "3.1.0"
    }]);

    const springBootStarterDiff = rootComponentDiff.getChange("org.springframework.boot:spring-boot-starter");
    
    expect(springBootStarterDiff).toHaveAdditions([]);
    expect(springBootStarterDiff).toHaveRemovals([]);
    expect(springBootStarterDiff).toHaveChanges([{
      moduleId: "org.springframework.boot:spring-boot",
      baseVersion: "3.0.0",
      comparingVersion: "3.1.0"
    },
    {
      moduleId: "org.springframework.boot:spring-boot-autoconfigure",
      baseVersion: "3.0.0",
      comparingVersion: "3.1.0"
    },
    {
      moduleId: "org.springframework.boot:spring-boot-starter-logging",
      baseVersion: "3.0.0",
      comparingVersion: "3.1.0"
    },
    {
      moduleId: "org.springframework:spring-core",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    }]);

    const springBootDiff = springBootStarterDiff.getChange("org.springframework.boot:spring-boot");

    expect(springBootDiff).toHaveAdditions([]);
    expect(springBootDiff).toHaveRemovals([]);
    expect(springBootDiff).toHaveChanges([{
      moduleId: "org.springframework:spring-core",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    },
    {
      moduleId: "org.springframework:spring-context",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    }]);

    const springContextDiff = springBootDiff.getChange("org.springframework:spring-context");

    expect(springContextDiff).toHaveAdditions([]);
    expect(springContextDiff).toHaveRemovals([]);
    expect(springContextDiff).toHaveChanges([{
      moduleId: "org.springframework:spring-aop",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    },
    {
      moduleId: "org.springframework:spring-beans",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    },
    {
      moduleId: "org.springframework:spring-expression",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    },
    {
      moduleId: "org.springframework:spring-core",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    }]);

    const springBootAutoconfigureDiff = springBootStarterDiff.getChange("org.springframework.boot:spring-boot-autoconfigure");

    expect(springBootAutoconfigureDiff).toHaveAdditions([]);
    expect(springBootAutoconfigureDiff).toHaveRemovals([]);
    expect(springBootAutoconfigureDiff).toHaveChanges([{
      moduleId: "org.springframework.boot:spring-boot",
      baseVersion: "3.0.0",
      comparingVersion: "3.1.0"
    }]);


    const springBootStarterLoggingDiff = springBootStarterDiff.getChange("org.springframework.boot:spring-boot-starter-logging");

    expect(springBootStarterLoggingDiff).toHaveAdditions([]);
    expect(springBootStarterLoggingDiff).toHaveRemovals([]);
    expect(springBootStarterLoggingDiff).toHaveChanges([{
      moduleId: "ch.qos.logback:logback-classic",
      baseVersion: "1.4.5",
      comparingVersion: "1.4.7"
    },
    {
      moduleId: "org.apache.logging.log4j:log4j-to-slf4j",
      baseVersion: "2.19.0",
      comparingVersion: "2.20.0"
    },
    {
      moduleId: "org.slf4j:jul-to-slf4j",
      baseVersion: "2.0.4",
      comparingVersion: "2.0.7"
    }]);

    const logbackClassicDiff = springBootStarterLoggingDiff.getChange("ch.qos.logback:logback-classic");

    expect(logbackClassicDiff).toHaveAdditions([]);
    expect(logbackClassicDiff).toHaveRemovals([]);
    expect(logbackClassicDiff).toHaveChanges([{
      moduleId: "ch.qos.logback:logback-core",
      baseVersion: "1.4.5",
      comparingVersion: "1.4.7"
    }]);

    const logbackCoreDiff = logbackClassicDiff.getChange("ch.qos.logback:logback-core");

    expect(logbackCoreDiff).toHaveAdditions([]);
    expect(logbackCoreDiff).toHaveRemovals([]);
    expect(logbackCoreDiff).toHaveChanges([]);

    const log4jToSlf4jDiff = springBootStarterLoggingDiff.getChange("org.apache.logging.log4j:log4j-to-slf4j");

    expect(log4jToSlf4jDiff).toHaveAdditions([]);
    expect(log4jToSlf4jDiff).toHaveRemovals([]);
    expect(log4jToSlf4jDiff).toHaveChanges([{
      moduleId: "org.apache.logging.log4j:log4j-api",
      baseVersion: "2.19.0",
      comparingVersion: "2.20.0"
    }]);

    const log4jApiDiff = log4jToSlf4jDiff.getChange("org.apache.logging.log4j:log4j-api");

    expect(log4jApiDiff).toHaveAdditions([]);
    expect(log4jApiDiff).toHaveRemovals([]);
    expect(log4jApiDiff).toHaveChanges([]);

    const julToSlf4jDiff = springBootStarterLoggingDiff.getChange("org.slf4j:jul-to-slf4j");

    expect(julToSlf4jDiff).toHaveAdditions([]);
    expect(julToSlf4jDiff).toHaveRemovals([]);
    expect(julToSlf4jDiff).toHaveChanges([]);
  
    const springCoreDiff = springBootStarterDiff.getChange("org.springframework:spring-core");

    expect(springCoreDiff).toHaveAdditions([]);
    expect(springCoreDiff).toHaveRemovals([]);
    expect(springCoreDiff).toHaveChanges([{
      moduleId: "org.springframework:spring-jcl",
      baseVersion: "6.0.2",
      comparingVersion: "6.0.9"
    }]);
    
    const springJclDiff = springCoreDiff.getChange("org.springframework:spring-jcl");

    expect(springJclDiff).toHaveAdditions([]);
    expect(springJclDiff).toHaveRemovals([]);
    expect(springJclDiff).toHaveChanges([]);
  });

});