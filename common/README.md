# How to build

When you make changes here, you must compile the changes to update `dist/index.js`. Otherwise your change will not be picked up.

Follow this procedure to change the github actions:

```
npm i
npm run build

git commit ...
git push ...
``` 

Make sure to commit and push the changes to the `dist` directory to the repository.

# How to test

Run `npm run test` to run the unit tests

# How to try SBOM diffing

1. Generate two SBOMs that you want to compare
   1. For example, use `mvn org.cyclonedx:cyclonedx-maven-plugin:2.7.9:makeAggregateBom` to generate an SBOM for a maven (multi-module) project
1. Run `npm run diff-sboms <path to base SBOM> <path to comparing SBOM> <output file path>` to generate an SBOM diff
   1. Hint: The `sbom-workspace` subdirectory is in `.gitignore`, so you can put files there
   1. In Visual Studio Code, you can run the script from the Javascript Debugger Console to attach a debugger and put breakpoints in the business logic