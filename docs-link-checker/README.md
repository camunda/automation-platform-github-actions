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
- Jenkins installs `python34` + `python34-pip`, then installs `soupsieve==2.2.1`, `beautifulsoup4==4.12.3`, and `pyLinkValidator` (imported as `pylinkvalidator`) via `pip3.4`.
- Jenkins then runs `python3.4 infra-core/cmd/link-checker/link-checker.py -u http://localhost:1313 -i <ignoreRegex>` after starting `hugo server`.
- `infra-core/cmd/link-checker/link-checker.py` applies `-i/--ignore` as a Python regex using `re.match` against each broken URL path.
- This action keeps parity at behavior level for link validation (HTTP crawl + failing on errors) while using a reusable deterministic setup: pinned `pyLinkValidator` in an isolated virtual environment.

## Runtime and runner requirements

The action requests Python **3.11** through `actions/setup-python` using semantic version matching. `actions/setup-python` selects the exact installed Python patch version; this action does not pin that patch release. The setup action itself is pinned to a full immutable commit SHA.

The action does not depend on the runner's ambient Python, `venv`, `ensurepip`, or pip. `pyLinkValidator==0.3`, `beautifulsoup4==4.12.3`, and `soupsieve==2.2.1` remain pinned and are installed in a newly created isolated virtual environment for every action run. The provisioned interpreter is used for regex validation, virtual-environment creation, package installation and verification, local HTTP serving, and crawling.

The runner still needs the standard GitHub Actions facilities used by this composite action: Bash and temporary-directory support. Network access is required to obtain Python when it is not already available in the tool cache and to download the pinned Python packages. In local serving mode, `source` must be a built documentation directory; in `base-url` mode, the runner must be able to reach that URL.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `source` | Yes (unless `base-url` is set) | - | Path to built docs/output directory to check |
| `base-url` | No | - | Optional `http(s)` URL to check instead of serving `source` |
| `ignore-regex` | No | - | Python regex matched via `re.match` against each broken URL path |
| `pylinkvalidator-version` | No | `0.3` | Version of `pyLinkValidator` installed via pip |

## Behavior

- fails fast if neither `source` nor `base-url` is provided
- validates that `source` exists when local serving mode is used
- validates `base-url` format when provided
- provisions Python 3.11 and creates an isolated virtual environment with it
- installs pinned `pyLinkValidator==0.3`, `beautifulsoup4==4.12.3`, and `soupsieve==2.2.1` in that environment
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
