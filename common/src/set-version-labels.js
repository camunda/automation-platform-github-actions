const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https');

module.exports = async function () {

    const optimize = {
        getMinorFromPotentialLabelRegex: () => /potential:optimize (\d+\.\d+)\.\d+/,
        getNextMinorVersionLabel: nextMinorVersion => `version:optimize ${nextMinorVersion}.0`,
        getPotentialLabelRegex: () => `potential:optimize \\d+\\.\\d+\\.\\d+`,
        getVersionLabelRegex: () => `version:optimize \\d+\\.\\d+\\.\\d+`,
        isScopeCamundaPlatform7: () => false,
        isScopeOptimize: () => true,
        ticketScope: () => "Optimize 7"

    }
    const platform = {
        getMinorFromPotentialLabelRegex: () => /potential:(\d+\.\d+)\.\d+/,
        getNextMinorVersionLabel: nextMinorVersion => `version:${nextMinorVersion}.0`,
        getPotentialLabelRegex: () => `potential:\\d+\\.\\d+\\.\\d+`,
        getVersionLabelRegex: () => `version:\\d+\\.\\d+\\.\\d+`,
        isScopeCamundaPlatform7: () => true,
        isScopeOptimize: () => false,
        ticketScope: () => "Camunda Platform 7"
    }

    const getPotentialLabels = async (ticketMetadata, appConfig) => {
        const validPotentialLabelRegex = appConfig.getPotentialLabelRegex();
        return getLabelsMatchingRegexp(ticketMetadata, validPotentialLabelRegex);
    }

    // Returns Map with [potentialLabel - versionLabel entries]
    const getVersionLabelsMap = async (potentialLabels, downloadPage, appConfig) => {
        let results
        if (appConfig.isScopeCamundaPlatform7()) {
            results = potentialLabels.map(potentialLabel => {

                // For maintenance versions, find the latest patch from repo
                const latestPatchVersion = getLatestPatchVersion(potentialLabel, downloadPage, appConfig);
                console.log(`${potentialLabel} => has Latest Patch Version: ${latestPatchVersion}`);

                if (latestPatchVersion == null) {
                    console.log(`No patch version was found in downloads page for potentialLabel: ${potentialLabel}. Returning entry with null version.`);
                    return [potentialLabel, null];
                }

                return [potentialLabel, getNextPatchVersion(latestPatchVersion)];
            });
        } else if (appConfig.isScopeOptimize()) {
            results = potentialLabels.map(potentialLabel => {
                // For maintenance versions, find the latest patch from repo
                const latestPatchVersion = getLatestPatchVersion(potentialLabel, downloadPage, appConfig);

                if (latestPatchVersion == null) {
                    console.log(`No patch version was found in downloads page for potentialLabel: ${potentialLabel}. Returning entry with null version.`);
                    return [potentialLabel, null];
                }

                console.log(`${potentialLabel} => has Latest Patch Version: ${latestPatchVersion}`);
                return [potentialLabel, getNextPatchVersion(latestPatchVersion)];
            });
        }

        return Object.fromEntries(results);


    };

    const removeLabels = async function (ticketMetadata, labels) {
        console.log(`Remove labels for issue #${issueNumber}:`, labels);
        try {
            for (const label of labels) {
                await octokit.rest.issues.removeLabel({
                    ...ticketMetadata,
                    name: label // Use the current label in the iteration
                });
                console.log(`Label "${label}" removed from issue #${issueNumber}`);
            }
        } catch (error) {
            console.error('Error removing labels:', error);
        }
    }

    const getLabelsMatchingRegexp = async function (ticketMetadata, expression) {
        console.debug(`Get labels for issue: #${issueNumber} that match expression: ${expression}`);
        try {
            // Get issue details, which includes labels
            const { data: issue } = await octokit.rest.issues.get(ticketMetadata);

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

    const getMinorFromPotentialLabel = function (potentialLabel, appConfig) {
        const regex = appConfig.getMinorFromPotentialLabelRegex();
        const match = potentialLabel.match(regex);

        return match ? match[1] : null;
    }

    const getNextPatchVersion = function (currentVersion) {
        const versionParts = currentVersion.split('.');
        versionParts[2] = parseInt(versionParts[2]) + 1;
        return versionParts.join('.');
    }

    const getLatestPatchVersion = function (potentialLabel, downloadPage, appConfig) {
        console.debug(`Get latest patch version for issue: #${issueNumber} for potential label:`, potentialLabel);
        try {
            const minorVersion = getMinorFromPotentialLabel(potentialLabel, appConfig);

            if (!minorVersion) {
                console.log(`No Minor version found in the potential label. Returning null.`);
                return null;
            } else {
                console.log(`Minor version found: ${minorVersion}`);
            }
            let patchVersionRegex = appConfig.isScopeCamundaPlatform7() ?
                new RegExp(`(camDownloads\\.branches\\['${minorVersion}'\\]\\s*=\\s*)(\\[[\\s\\S]*?\\])(\\s*;)`)
                : new RegExp(`href=["']https:\\/\\/downloads\\.camunda\\.cloud\\/enterprise-release\\/optimize\\/(${minorVersion}\\.\\d+)\\/[^"']+["']`, "g");


            if (appConfig.isScopeOptimize()) {
                const versions = new Set();
                let match;
                while ((match = patchVersionRegex.exec(downloadPage)) !== null) {
                    versions.add(match[1]);
                }

                const firstPatchVersion = versions.values().next().value;
                if (!firstPatchVersion) {
                    return null;
                }
                return `version:optimize ` + firstPatchVersion;
            } else {
                const matchJson = downloadPage.match(patchVersionRegex);
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
            }
        } catch (error) {
            console.error("Error while calculating Patch version:", error);
            return null;
        }
    }

    async function fetchDownloadPage() {
        const url = 'https://docs.camunda.org/enterprise/download/';

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

    const syncLabelsColor = async (ticketMetadata, labelsToCheck) => {
        console.log('Sync color for labels');
        const versionLabelColor = '83b6ff';
        try {
            const { data: labelsOnIssue } = await octokit.rest.issues.listLabelsOnIssue(ticketMetadata);
            console.log(`Retrieved labels from issue:`, JSON.stringify(labelsOnIssue, null, 2));
            const filteredLabels = labelsOnIssue.filter(l => labelsToCheck.includes(l.name) && l.color !== versionLabelColor);
            for (const label of filteredLabels) {
                await octokit.rest.issues.updateLabel({
                    owner: ticketMetadata.owner,
                    repo: ticketMetadata.repo,
                    name: label.name,
                    color: versionLabelColor,
                    description: label.description || '',
                });
                console.log(`Updated label: ${label.name} to color: ${versionLabelColor}`);
            }
            console.log('Completed syncing labels color');
        } catch (error) {
            console.error('Error when syncing labels color:', error);
        }
    }

    const setLabels = async function (ticketMetadata, labels) {
        console.log(`Set labels for issue: #${issueNumber}:`, labels);
        try {
            await octokit.rest.issues.addLabels({
                ...ticketMetadata,
                labels: labels
            });

            console.log(`Labels set to issue #${issueNumber}:`, labels);
        } catch (error) {
            console.error('Error setting labels:', error);
        }
    }

    const postGithubComment = async (ticketMetadata, comment) => {
        await octokit.rest.issues.createComment({
            ...ticketMetadata,
            body: comment,
        });
    }

    const getAssigneeMentions = async (ticketMetadata) => {
        try {
            const { data: issue } = await octokit.rest.issues.get(ticketMetadata);
            if (issue.assignees && issue.assignees.length > 0) {
                return issue.assignees.map(assignee => `@${assignee.login}`).join(' ');
            }
            return '';
        } catch (error) {
            console.error('Error fetching assignees:', error);
            return '';
        }
    }

    const getWarningCommentText = async (potentialToVersionLabelsMap, ticketMetadata) => {
        const assigneeMentions = await getAssigneeMentions(ticketMetadata);
        let commentText = `### Set Version Labels Action \n${assigneeMentions ? assigneeMentions + '\n\n' : ''}`;
        const potentialLabelsNotMatched = Object.entries(potentialToVersionLabelsMap)
            .filter(([_, versionLabel]) => versionLabel === null)
            .map(([potentialLabel, _]) => potentialLabel);

        const patchVersionMissMatch = Object.entries(potentialToVersionLabelsMap)
            .filter(([potentialLabel, versionLabel]) => {
                return versionLabel !== null && potentialLabel.replace('potential:') !== versionLabel.replace('version:')
            }
            );

        if (potentialLabelsNotMatched.length === 0 && patchVersionMissMatch.length === 0) {
            return null
        }

        if (potentialLabelsNotMatched.length) {
            commentText += (
                "#### Potential Labels with Non-Existing Minor: \n - " +
                potentialLabelsNotMatched.join("\n - ") +
                "\n"
            );
        }

        if (patchVersionMissMatch.length) {
            commentText += (
                "#### Patch Version Mismatch: \n" +
                "|Potential Label| Version Label | \n" +
                "|---|---| \n" +
                patchVersionMissMatch
                    .map(([potentialLabel, versionLabel]) => `|${potentialLabel}|${versionLabel}|`)
                    .join("\n")
            );
        }

        return commentText;
    }

    const getNoLabelCommentText = async (ticketMetadata) => {
        const assigneeMentions = await getAssigneeMentions(ticketMetadata);
        return `### Set Version Labels Action \n${assigneeMentions ? assigneeMentions + '\n\n' : ''}` +
            "Neither valid potential nor valid version label found. Please check if this is intentional.";
    }

    const hasVersionLabels = async (ticketMetadata, appConfig) => {
        const versionLabelsRegex = appConfig.getVersionLabelRegex();
        const validVersionLabels = await getLabelsMatchingRegexp(ticketMetadata, versionLabelsRegex);

        return (validVersionLabels.length !== 0);
    }

    const haScopeOptimizeLabel = async (ticketMetadata) => {
        const scopeOptimizeLabel = await getLabelsMatchingRegexp(ticketMetadata, `scope:optimize`);

        return (scopeOptimizeLabel.length !== 0);
    }

    const hasCommunityWorkLabel = async (ticketMetadata) => {
        const communityWorkLabel = await getLabelsMatchingRegexp(ticketMetadata, `group:community-work`);

        return (communityWorkLabel.length !== 0);
    }

    const hasMigratorLabel = async (ticketMetadata) => {
        const migratorLabel = await getLabelsMatchingRegexp(ticketMetadata, `scope:data-migrator`);

        return (migratorLabel.length !== 0);
    }

    const removePotentialAndSetVersionLabels = async (nonNullVersionLabelsEntries) => {
        const potentialLabelsToRemove = nonNullVersionLabelsEntries.map(([potentialLabel, _]) => potentialLabel);
        const versionLabelsToAssign = nonNullVersionLabelsEntries.map(([_, versionLabel]) => versionLabel);

        if (potentialLabelsToRemove.length === 0) {
            console.log("No potential labels to set / remove.");
            return;
        }

        const uniqueVersionLabelsToAssign = [...new Set(versionLabelsToAssign)];

        console.log(`Potential Version to Remove: `, potentialLabelsToRemove);
        console.log(`Unique Version Labels to Assign: `, uniqueVersionLabelsToAssign);

        await setLabels(ticketMetadata, uniqueVersionLabelsToAssign);
        await removeLabels(ticketMetadata, potentialLabelsToRemove);
        await syncLabelsColor(ticketMetadata, uniqueVersionLabelsToAssign);
    }

    const hasPotentialLabels = (potentialLabels) => {
        return potentialLabels.length > 0
    }

    const isUnsupportedIssue = async (ticketMetadata) => {
        // Insert here cases that should be excluded by the action

        if (await isIssueRelatedCommunityWork(ticketMetadata)) {
            console.log(`Issue is related to Community Work.`);
            return true;
        }

        if (await isIssueRelatedToMigrator(ticketMetadata)) {
            console.log(`Issue is related to Data migrator.`);
            return true;
        }

        return false;
    }

    const isIssueRelatedToOptimize = async (ticketMetadata) => {
        return await haScopeOptimizeLabel(ticketMetadata);
    }

    const isIssueRelatedCommunityWork = async (ticketMetadata) => {
        return await hasCommunityWorkLabel(ticketMetadata);
    }

    const isIssueRelatedToMigrator = async (ticketMetadata) => {
        return await hasMigratorLabel(ticketMetadata);
    }

    // setup

    const issueNumber = core.getInput('issue-number');
    const repoToken = core.getInput('repo-token');
    const octokit = github.getOctokit(repoToken);

    const repo = github.context.payload.repository;
    const ticketMetadata = {
        repo: repo.name,
        owner: repo.owner.login,
        issue_number: issueNumber
    };

    const appConfig = await isIssueRelatedToOptimize(ticketMetadata) ? optimize : platform;
    console.log(`Ticket scope: ${appConfig.ticketScope()}`);

    if (await isUnsupportedIssue(ticketMetadata)) {
        console.log(`Issue ${issueNumber} is not supported. Exiting.`);
        return;
    }

    const potentialLabels = await getPotentialLabels(ticketMetadata, appConfig);

    // validate

    if (!hasPotentialLabels(potentialLabels) && !await hasVersionLabels(ticketMetadata, appConfig)) {
        await postGithubComment(ticketMetadata, await getNoLabelCommentText(ticketMetadata));
        console.log("Neither `potential:` nor `version:` label found. Exiting.");
        return;
    }

    if (!hasPotentialLabels(potentialLabels)) {
        console.log("No potential labels found. Exiting.");
        return;
    }

    // fetch

    const downloadPage = await fetchDownloadPage();

    const versionLabelsMap = await getVersionLabelsMap(potentialLabels, downloadPage, appConfig);
    console.log({ versionLabelsMap });

    // only potential labels that have a version label will be removed
    const nonNullVersionLabelsEntries = Object.entries(versionLabelsMap)
        .filter(([_, versionLabel]) => versionLabel !== null)

    // update

    await removePotentialAndSetVersionLabels(nonNullVersionLabelsEntries);

    const commentText = await getWarningCommentText(versionLabelsMap, ticketMetadata);

    if (commentText) {
        console.log("Adding comment");
        await postGithubComment(ticketMetadata, commentText);
    }
}
