const core = require('@actions/core');
const github = require('@actions/github');

module.exports = async function () {
    const getListWithNewPrefix = function (strings, oldPrefix, newPrefix) {
        return strings.map(str => {
            if (str.startsWith(oldPrefix)) {
                return newPrefix + str.slice(oldPrefix.length);
            }
            return str;
        });
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

    const versionLabels = getListWithNewPrefix(potentialLabels, "potential:", "version:");

    await removeLabels(owner, repoName, issueNumber, potentialLabels);
    await setLabels(owner, repoName, issueNumber, versionLabels);
}