#!/bin/bash

# expected env vars: 
# minorVersion 'The version of the alpha release'
# releaseDate 'The release date'

minorVersion=$(echo $nextVersion | cut -c1-4)
branchVar="    - branch: \"$minorVersion\""
header="    - branch: \"$minorVersion\"
      releases:
"

if [[ "$input_content" == *"$branchVar"* ]]; then
  echo "this is a problem!"
  lineNumber=$(grep -n -m1 "releases:" $filePath | cut -d: -f1)
  header=""
else
  lineNumber=$(grep -n -m1 'branches:' $filePath | cut -d: -f1)
fi

filePath="$GITHUB_WORKSPACE/camunda-docs-static/enterprise/content/download.md"
input_content=$(<"$filePath")
extracted_section=$(echo "$input_content" | awk '/releases:/{flag=1; next} flag && /^$/ {exit} flag')

# White spaces are important for indentation
number="       - number: \"$nextVersion\""
note="          note: \"https://github.com/camunda/camunda-bpm-platform/issues?q=is%3Aissue+is%3Aclosed+label%3Aversion%3A$nextVersion\""
date="          date: \"$releaseDate\""

updated_text=$(echo "$extracted_section" | sed "s@.*note: .*@$note@g" | sed "s@.*number: .*@$number@g" | sed "s@.*date: .*@$date@g")

temp_file=$(mktemp)
printf "$header $updated_text \n\n" > "$temp_file"

# to run on mac: sed -i "" "${lineNumber}r $temp_file" "$filePath"
sed -i "${lineNumber}r $temp_file" "$filePath"
rm "$temp_file"
