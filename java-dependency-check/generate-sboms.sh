#!/bin/bash
# Parameters
# $1: path to Maven settings file to be used

set -e
# let script stop when one of the commands fails (e.g. one of the Maven builds)

echo "::group::git fetch"
git fetch
echo "::endgroup::"

if [[ $(git diff origin/$GITHUB_BASE_REF HEAD --name-only | grep pom.xml$ | wc -c) -ne 0 ]]; then

    echo "POM changes detected. Diffing SBOMs"
    
    mkdir -p target/diff
    
    echo "::group::Generate base SBOM"
    mvn -s "$1" --no-transfer-progress org.cyclonedx:cyclonedx-maven-plugin:2.7.9:makeAggregateBom
    echo "::endgroup::"

    echo "SBOM generated for github ref HEAD"

    cp target/bom.json target/diff/head.json

    git checkout -f origin/$GITHUB_BASE_REF
    
    echo "::group::Generate head SBOM"
    mvn -s "$1" --no-transfer-progress org.cyclonedx:cyclonedx-maven-plugin:2.7.9:makeAggregateBom
    echo "::endgroup::"
    
    echo "SBOM generated for github ref $GITHUB_BASE_REF"

    cp target/bom.json target/diff/base.json

else
    echo "No POM changes. Not diffing SBOMs"
fi
