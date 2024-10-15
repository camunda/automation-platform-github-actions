const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https');

module.exports = async function () {

    // Get Version Labels

    const getVersionLabels = async function (potentialLabels) {
        const promises = potentialLabels.map(async potentialLabel => {

            if (potentialLabel.split('.')[2] === '0') { // For potential versions that are not patch
                console.log(`label ${potentialLabel} is not a patch version, filtering it out.`);
                return null;
            }

            // For maintenance versions, find the latest patch from repo
            const latestPatchVersion = await getLatestPatchVersion(potentialLabel);
            console.log(`${potentialLabel} => has Latest Patch Version: ${latestPatchVersion}`);

            return getNextPatchVersion(latestPatchVersion);
        });

        // Wait for all promises to settle and filter out null values
        const results = await Promise.all(promises);
        return results.filter(label => label !== null);
    };

    const removeLabels = async function (owner, repo, issueNumber, labels) {
        console.log(`Remove labels for issue #${issueNumber}:`, labels);
        try {
            for (const label of labels) {
                await octokit.rest.issues.removeLabel({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    name: label // Use the current label in the iteration
                });
                console.log(`Label "${label}" removed from issue #${issueNumber}`);
            }
        } catch (error) {
            console.error('Error removing labels:', error);
        }
    }

    const getLabelsMatchingRegexp = async function (owner, repo, issueNumber, expression) {
        console.log(`Get labels for issue: #${issueNumber} that match expression: ${expression}`);
        try {
            // Get issue details, which includes labels
            const { data: issue } = await octokit.rest.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });

            const regexp = new RegExp(expression);

            // Filter labels that start with the specified prefix
            const matchingLabels = issue.labels
                .map(label => label.name)
                .filter(label => regexp.test(label));

            console.log(`Labels matching "${expression}":`, matchingLabels);
            return matchingLabels;
        } catch (error) {
            console.error('Error fetching issue labels:', error);
        }
    }

    const getMinorFromPotentialLabel = function (potentialLabel) {
        const regex = /potential:(\d+\.\d+)\.\d+/;
        const match = potentialLabel.match(regex);

        return match ? match[1] : null;
    }

    const getNextPatchVersion = function (currentVersion) {
        const versionParts = currentVersion.split('.');
        versionParts[2] = parseInt(versionParts[2]) + 1;
        return versionParts.join('.');
    }

    const getLatestPatchVersion = async function (potentialLabel) {
        console.log(`Get latest patch version for issue: #${issueNumber} for potential label:`, potentialLabel);
        try {
            const minorVersion = getMinorFromPotentialLabel(potentialLabel);

            if (!minorVersion) {
                console.log(`No minor version found in the potential label`);
                return null;
            } else {
                console.log(`Minor version found: ${minorVersion}`);
            }

            const patchVersionRegex = new RegExp(`(camDownloads\\.branches\\['${minorVersion}'\\]\\s*=\\s*)(\\[[\\s\\S]*?\\])(\\s*;)`);
            const matchJson = downloadPage.match(patchVersionRegex);
        
            // Return the version if found, otherwise return null
            let versionsJsonString = matchJson ? matchJson[2] : null;

            if (versionsJsonString == null) {
                console.log(`No patch version could be extracted for potential label: ${potentialLabel}. Returning null.`);
                return null;
            }

            console.log(`Patch Versions to fetch first element:`, versionsJsonString);

            const extractFirstPatchVersionFromJson = new RegExp(`(number\\: ')(.*)('\\,)`);
            const matchFirstPatch = versionsJsonString.match(extractFirstPatchVersionFromJson);
            let firstPatchVersion = matchFirstPatch ? matchFirstPatch[2] : null;

            console.log(`The latest version is: ${firstPatchVersion}`);
            return `version:` + firstPatchVersion;
        } catch (error) {
            console.error("Error fetching the XML document:", error);
            return null;
        }
    }

    const getLatestMinorVersion = async function() {
        const url = `https://github.com/camunda/camunda-bpm-platform/raw/refs/heads/master/pom.xml`;
        const response = await fetch(url);
        const pomXml = await response.text();

        const versionTagRegex = /<artifactId>camunda-root<\/artifactId>\s*<version>(\d+\.\d+)(?:\.\d+.*)?<\/version>/
        const match = pomXml.match(versionTagRegex);

        // Return the version if found, otherwise return null
        return match ? match[1] : null;
    }

    async function fetchDownloadPage() {
        const url = `https://docs.camunda.org/enterprise/download/`;
    
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
    
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to fetch data. Status code: ${response.statusCode}`));
                    response.resume(); // Consume response data to free up memory
                    return;
                }
    
                response.on('data', (chunk) => {
                    data += chunk;
                });
    
                response.on('end', () => {
                    resolve(data);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    const setLabels = async function (owner, repo, issueNumber, labels) {
        console.log(`Set labels for issue: #${issueNumber}:`, labels);
        try {
            await octokit.rest.issues.addLabels({
                owner,
                repo,
                issue_number: issueNumber,
                labels: labels
            });
            console.log(`Labels set to issue #${issueNumber}:`, labels);
        } catch (error) {
            console.error('Error setting labels:', error);
        }
    }

    const repoToken = core.getInput('repo-token');
    const octokit = github.getOctokit(repoToken);
    const repo = github.context.payload.repository;
    const repoName = repo.name;
    const owner = repo.owner.login;

    const issueNumber = core.getInput('issue-number');

    console.log(`read repo information repoName: ${repoName} - : owner: ${owner}`);

    const expression = `potential:\\d+\\.\\d+\\.(?!0)\\d+`
    const potentialLabels = await getLabelsMatchingRegexp(owner, repoName, issueNumber, expression);

    if (!potentialLabels.length) {
        console.log("no `potential:` label found, exiting.");
        return;
    }

    const downloadPage = await fetchDownloadPage();

    const latestVersion = await getLatestMinorVersion();
    console.log(`Latest minor version: ${latestVersion}`);

    const versionLabels = await getVersionLabels(potentialLabels);
    const uniqueVersionLabels = [...new Set(versionLabels)];

    await setLabels(owner, repoName, issueNumber, uniqueVersionLabels);
    await removeLabels(owner, repoName, issueNumber, potentialLabels);
}