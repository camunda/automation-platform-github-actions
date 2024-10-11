const core = require('@actions/core');
const github = require('@actions/github');

module.exports = async function () {

    // Get Version Labels

    const getVersionLabels = async function (potentialLabels, latestVersion) {
        const promises = potentialLabels.map(async potentialLabel => {
            const minorVersion = getMinorFromPotentialLabel(potentialLabel);

            if (minorVersion === latestVersion) {
                // For latest version, calculate the version label right away
                const calculatedVersion = getVersionLabelFromPotential(potentialLabel);
                console.log(`Returning calculated version for latest potential version: ${calculatedVersion}`);
                return calculatedVersion;
            }

            // For maintenance versions, find the latest patch from repo
            const latestPatchVersion = await getLatestPatchVersion(potentialLabel);
            console.log(`${potentialLabel} => has Latest Patch Version: ${latestPatchVersion}`);

            if (!latestPatchVersion) {
                const calculatedVersionLabel = getVersionLabelFromPotential(potentialLabel); // fallback if GitHub is down, pom version is wrong, error at parsing
                console.log(`No latest patch version found for potential label: ${potentialLabel}, returning calculated version ${calculatedVersionLabel}`);
                return calculatedVersionLabel;
            }

            return latestPatchVersion;
        });

        // Wait for all promises to settle and filter out null values
        const results = await Promise.all(promises);
        return results.filter(label => label !== null);
    };

    const getVersionLabelFromPotential = function (potentialLabel) {
        return `version:` + potentialLabel.slice(`potential:`.length);
    }

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

            const url = `https://github.com/camunda/camunda-bpm-platform-maintenance/raw/refs/heads/${minorVersion}/pom.xml`;

            const response = await fetch(url);
            const xml = await response.text();

            console.log(xml)

            // Define regex to match <version>...</version>
            const patchVersionRegex = /<artifactId>camunda-root<\/artifactId>\s*<version>(\d+\.\d+\.\d+)(?:-\w+)?<\/version>/;
            const match = xml.match(patchVersionRegex);  //FIXME something is not working here

            // Return the version if found, otherwise return null
            return match ? match[1] : null;
        } catch (error) {
            console.error("Error fetching the XML document:", error);
            return null;
        }
    }

    const getLatestVersion = async function() {
        const url = `https://github.com/camunda/camunda-bpm-platform/raw/refs/heads/master/pom.xml`;
        const response = await fetch(url);
        const pomXml = await response.text();

        const versionTagRegex = /<artifactId>camunda-root<\/artifactId>\s*<version>(\d+\.\d+)(?:\.\d+.*)?<\/version>/
        const match = pomXml.match(versionTagRegex);

        // Return the version if found, otherwise return null
        return match ? match[1] : null;
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

    console.log(`read repo information repoName: ${repoName} - : owner: ${owner}`)

    const expression = `potential:\\d+\\.\\d+\\.\\d+`
    const potentialLabels = await getLabelsMatchingRegexp(owner, repoName, issueNumber, expression);

    if (!potentialLabels.length) {
        console.log("no `potential:` label found, exiting.")
        return;
    }

    const latestVersion = await getLatestVersion();
    console.log(`Latest version: ${latestVersion}`);

    const versionLabels = await getVersionLabels(potentialLabels, latestVersion);
    console.log(versionLabels);

    await setLabels(owner, repoName, issueNumber, versionLabels);
    await removeLabels(owner, repoName, issueNumber, potentialLabels);
}