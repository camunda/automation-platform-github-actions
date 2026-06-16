# docs-hugo-build

Reusable composite action to build Hugo docs with a pinned Hugo version.

This action is part of the docs release migration foundation slice for `camunda/camunda-bpm-platform-maintenance#3005`, focused only on deterministic docs build behavior.

## Public-safe scope

The action is intentionally generic and repository-agnostic:

- no SSH
- no rsync
- no Vault
- no deployment
- no Jenkins cleanup behavior

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `source` | Yes | - | Path to the Hugo site/project directory |
| `destination` | No | - | Optional Hugo output directory (`--destination`) |
| `hugo-version` | No | `0.54.0` | Hugo version to install (default keeps Jenkins parity) |
| `extra-args` | No | - | Extra arguments appended to the Hugo command (split on whitespace; quoted groups are not preserved) |
| `extended` | No | `false` | Install extended Hugo binary; must be `true` or `false` |

## Behavior

- validates inputs and fails fast on invalid values
- verifies `source` exists and is a directory
- installs Hugo from GitHub releases (`https://github.com/gohugoio/hugo/releases/download`)
- adds downloaded Hugo binary to `PATH`
- runs `hugo --source <source>`
- adds `--destination <destination>` when `destination` is set
- appends `extra-args` when provided (split on whitespace with glob expansion disabled)

## Example usage

```yaml
jobs:
  build-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build docs with pinned Hugo
        uses: camunda/automation-platform-github-actions/docs-hugo-build@<commit-sha-or-version-tag>
        with:
          source: ./docs
          destination: ./public
          hugo-version: 0.54.0
          extra-args: --minify --verbose
          extended: false
```

## Notes

- The default `hugo-version` is `0.54.0` for Jenkins behavior parity.
- Override `hugo-version` only when migration requirements allow it.
- This action does not publish artifacts and does not perform remote operations.
- Release workflows should pin this action to a commit SHA or version tag (avoid `@main`).
- The runner is expected to provide standard tools used by the action: `bash`, `curl`, `tar`, `ruby`, and `python3`.
