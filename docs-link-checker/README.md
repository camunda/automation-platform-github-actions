# docs-link-checker

Reusable composite action to run docs link checking in a deterministic way with `pyLinkValidator`.

This action is part of the docs release migration Phase 1 shared foundation for `camunda/camunda-bpm-platform-maintenance#3005` and focuses only on link checking.

## Jenkins parity notes

Read-only parity search paths:

- `jenkins-job-dsl-seed-jobs`
- `cambpm-jenkins-shared-library`
- `infra-core`

Findings:

- `jenkins-job-dsl-seed-jobs/src/main/groovy/util/ScriptResources.groovy` defines `DOWNLOAD_PYLINKVALIDATOR` and `linkCheckerScript`.
- Jenkins installs `python34` + `python34-pip`, then installs `soupsieve==2.2.1`, `beautifulsoup4==4.12.3`, and `pylinkvalidator` via `pip3.4`.
- Jenkins then runs `python3.4 infra-core/cmd/link-checker/link-checker.py -u http://localhost:1313 -i <ignoreRegex>` after starting `hugo server`.
- `infra-core/cmd/link-checker/link-checker.py` applies `-i/--ignore` as a Python regex using `re.match` against each broken URL path.
- This action keeps parity at behavior level for link validation (HTTP crawl + failing on errors) while using a reusable deterministic setup: pinned `pyLinkValidator` in an isolated virtual environment.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `source` | Yes | - | Path to built docs/output directory to check |
| `base-url` | No | - | Optional `http(s)` URL to check instead of serving `source` |
| `ignore-regex` | No | - | Python regex matched via `re.match` against each broken URL path |
| `pylinkvalidator-version` | No | `0.3` | Version of `pyLinkValidator` installed via pip |

## Behavior

- fails fast if `source` does not exist
- validates `base-url` format when provided
- creates an isolated virtual environment and installs pinned `pyLinkValidator`
- runs a Python wrapper based on `pylinkvalidator.api.crawl(<target-url>)`
- applies `ignore-regex` using `re.match(ignore_regex, broken_path)` (Jenkins wrapper semantics)
- exits non-zero when broken links are detected

`ignore-regex` matches broken URL paths (for example: `^/(cawemo|test)`).

## Example usage

```yaml
jobs:
  check-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check built docs links
        uses: camunda/automation-platform-github-actions/docs-link-checker@<commit-sha-or-version-tag>
        with:
          source: ./public
          ignore-regex: ^/missing\.html$
```

## Validation behavior

The action returns a non-zero exit code if:

- required inputs are invalid;
- tool installation fails;
- the link checker finds errors.

## Non-goals

- no Hugo build
- no rsync
- no SSH
- no Vault
- no deployment
- no Jenkins cleanup
