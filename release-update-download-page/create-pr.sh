#!/bin/bash
# expected env vars: 
# GITHUB_WORKSPACE 'The github workplace'
# GH_TOKEN 'Personal access token used by github cli'
# DRI 'DRI of the release'

BRANCH_NAME="update-docs-for-alpha-release"
REPO_DIR=$GITHUB_WORKSPACE"camunda-docs-static"

cd $REPO_DIR
if [ "$(pwd)" != "$REPO_DIR" ]; then
    echo "Error: Failed to change to correct directory. Exiting."
    exit 1
fi

# Create a new feature branch, commit and push
git checkout -b $BRANCH_NAME
git add .
git commit -m "chore(relese): update download page for alpha release"

# Check if the current branch is correct
current_branch=$(git branch --show-current)

if [[ "$current_branch" == "$BRANCH_NAME" ]]; then
    echo "Branch check passed, pushing to $BRANCH_NAME..."
    if git push --set-upstream origin $BRANCH_NAME
    then
        echo "git push succeeded"
    else
        echo "git push failed. Exiting."
        exit 1
    fi    
else
    echo "Error: Was not able to check out new branch $BRANCH_NAME. Exiting."
    exit 1
fi

# create a pull request
gh pr create \
  --body "Please review the changes for the alpha release documentation." \
  --title "chore(relese): update download page for alpha release" \
  --head "$BRANCH_NAME" \
  --base "master" \
  --assignee "$DRI" \
  --reviewer "$DRI"

# Capture the exit status of the GitHub CLI command
exit_status=$?
if [ $exit_status -eq 0 ]; then
    echo "Pull request created successfully."
else
    echo "Failed to create pull request. Exit status: $exit_status"
fi
