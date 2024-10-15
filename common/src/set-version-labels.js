const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https');

module.exports = async function () {

    // Returns Map with [potentialLabel - versionLabel entries]
    const getVersionLabels = async function (potentialLabels) {
        const results = potentialLabels.map(potentialLabel => {
            // For maintenance versions, find the latest patch from repo
            const latestPatchVersion = getLatestPatchVersion(potentialLabel);
            console.log(`${potentialLabel} => has Latest Patch Version: ${latestPatchVersion}`);

            if (latestPatchVersion == null) {
                console.log(`No patch version was found in downloads page for potentialLabel: ${potentialLabel}. Returning entry with null version.`);
                return [ potentialLabel, null ];
            }

            return [ potentialLabel, getNextPatchVersion(latestPatchVersion) ];
        });

        return Object.fromEntries(results);
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
        console.debug(`Get labels for issue: #${issueNumber} that match expression: ${expression}`);
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

            console.debug(`Labels matching "${expression}":`, matchingLabels);
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

    const getLatestPatchVersion = function (potentialLabel) {
        console.debug(`Get latest patch version for issue: #${issueNumber} for potential label:`, potentialLabel);
        try {
            const minorVersion = getMinorFromPotentialLabel(potentialLabel);

            if (!minorVersion) {
                console.log(`No Minor version found in the potential label. Returning null.`);
                return null;
            } else {
                console.log(`Minor version found: ${minorVersion}`);
            }

            const patchVersionRegex = new RegExp(`(camDownloads\\.branches\\['${minorVersion}'\\]\\s*=\\s*)(\\[[\\s\\S]*?\\])(\\s*;)`);
            const matchJson = downloadPage.match(patchVersionRegex);
        
            // Return the version if found, otherwise return null
            let versionsJsonString = matchJson ? matchJson[2] : null;

            if (versionsJsonString == null) {
                console.warn(`No patch version could be extracted for potential label: ${potentialLabel}. Returning null.`);
                return null;
            }

            console.debug(`Patch Versions to fetch first element:`, versionsJsonString);

            const extractFirstPatchVersionFromJson = new RegExp(`(number\\: ')(.*)('\\,)`);
            const matchFirstPatch = versionsJsonString.match(extractFirstPatchVersionFromJson);
            let firstPatchVersion = matchFirstPatch ? matchFirstPatch[2] : null;

            console.debug(`The latest Patch version is: ${firstPatchVersion}`);
            return `version:` + firstPatchVersion;
        } catch (error) {
            console.error("Error while calculating Patch version:", error);
            return null;
        }
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

    console.log(`Repository Name: ${repoName}, Owner: ${owner}`);

    const potentialLabelsWithNonZeroPatchVersionRegex = `potential:\\d+\\.\\d+\\.(?!0)\\d+`;
    const potentialLabels = await getLabelsMatchingRegexp(owner, repoName, issueNumber, potentialLabelsWithNonZeroPatchVersionRegex);

    if (!potentialLabels.length) {
        console.log("No `potential:` label found. Exiting.");
        return;
    }

    const downloadPage = await fetchDownloadPage();

    const potentialToVersionLabelsMap = await getVersionLabels(potentialLabels);

    // only potential labels that have a version label will be removed
    const potentialLabelsToRemove = Object.entries(potentialToVersionLabelsMap)
        .filter(([_, versionLabel]) => versionLabel !== null)
        .map(([potentialLabel, _]) => potentialLabel);

    const versionLabelsToAssign = Object.entries(potentialToVersionLabelsMap)
        .filter(([_, versionLabel]) => versionLabel !== null)
        .map(([_, versionLabel]) => versionLabel);

    if (potentialLabelsToRemove.length === 0) {
        console.log("No potential labels to set / remove, exiting.");
        return;
    }

    const uniqueVersionLabelsToAssign = [...new Set(versionLabelsToAssign)];

    console.log(`Potential Version to Remove: `, potentialLabelsToRemove);
    console.log(`Unique Version Labels to Assign: `, uniqueVersionLabelsToAssign);

    await setLabels(owner, repoName, issueNumber, uniqueVersionLabelsToAssign);
    await removeLabels(owner, repoName, issueNumber, potentialLabelsToRemove);
}