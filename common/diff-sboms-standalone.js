const diffSBOMs = require('./src/sbom-diff/differ.js');
const formatTemplate = require('./src/sbom-diff/format-handlebars-template.js');
const fs = require('fs');

const readFile = function(path) {
    return fs.readFileSync(path, 'utf8')
}

const writeFile = function(path, content) {
    fs.writeFileSync(path, content); // default encoding is utf8
}

var args = process.argv.slice(2); // first two arguments are the executable and the JS file

if (args.length !== 3) {
    throw new Error('Requires three arguments: <path to base SBOM> <path to comparing SBOM> <path to output file>');
}

const baseSbomPath = args[0];
const headSbomPath = args[1];
const outPath = args[2];

const baseSbom = readFile(baseSbomPath);
const headSbom = readFile(headSbomPath);

const licenseList = readFile('../java-dependency-check/licenses.json');

const commentTemplate = readFile('../java-dependency-check/diff.hbs');

const partialPaths = [
    'componentDetails:../java-dependency-check/component-details.hbs',
    'componentDiff:../java-dependency-check/component-diff.hbs',
    'componentTree:../java-dependency-check/component-tree.hbs',
    'componentVersion:../java-dependency-check/component-version.hbs'
];

const partials = partialPaths.reduce(
    (result, input) => {
        [ partialId, partialPath ] = input.split(':');
        result[partialId.trim()] = readFile(partialPath.trim());
        return result;
    }, 
    {}
);

diffSBOMs(baseSbom, headSbom, '^org\\.camunda', licenseList)
    .then(rootComponentDiff => formatTemplate(rootComponentDiff, commentTemplate, partials)
        .then(diff => writeFile(outPath, diff.fullDiff)));


