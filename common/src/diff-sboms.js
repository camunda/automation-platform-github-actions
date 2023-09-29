const core = require('@actions/core');
const github = require('@actions/github');
const diffSBOMs = require('./sbom-diff/differ.js');
const formatTemplate = require('./sbom-diff/format-handlebars-template.js');
const fs = require('fs');

const readFile = function(path) {
    return fs.readFileSync(path, 'utf8')
}

const writeFile = function(path, content) {
    fs.writeFileSync(path, content); // default encoding is utf8
}

module.exports = async function () {
    const baseSbomPath = core.getInput('base-sbom');
    const headSbomPath = core.getInput('head-sbom');
    const primaryPartyGroupMatcher = core.getInput('primary-party-group-matcher');
    const licenseListPath = core.getInput('license-list');
    const commentTemplatePath = core.getInput('github-comment-template');
    const partialPathsString = core.getInput('partials');
    const repoToken = core.getInput('repo-token');
    const outputPath = core.getInput('output-path');

    const octokit = github.getOctokit(repoToken);
    const repo = github.context.payload.repository;
    const prNumber = github.context.payload.number;

    const baseSbom = readFile(baseSbomPath);
    const headSbom = readFile(headSbomPath);

    const licenseList = readFile(licenseListPath);

    const commentTemplate = readFile(commentTemplatePath);

    const partials = partialPathsString.split(/[\r\n]+/).reduce(
        (result, input) => {
            [ partialId, partialPath ] = input.split(':');
            result[partialId.trim()] = readFile(partialPath.trim());
            return result;
        }, 
        {}
    );

    const rootComponentDiff = await diffSBOMs(baseSbom, headSbom, primaryPartyGroupMatcher, licenseList);

    const diff = await formatTemplate(rootComponentDiff, commentTemplate, partials);

    core.info(`Dependency diff:`);
    core.info(diff.fullDiff);

    await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: prNumber,
        body: diff.githubComment
    });

    writeFile(outputPath, diff.fullDiff);


}