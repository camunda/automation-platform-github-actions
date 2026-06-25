# docs-rsync

Generic public-safe composite action for docs publishing and promotion over SSH/rsync.

This action is intentionally infrastructure-agnostic. It does not hardcode hostnames, filesystem roots, or product-specific paths. Consumers must provide SSH and target-path inputs.

## Public-safe design

- No built-in hostnames or internal paths
- Required host key verification through `known-hosts`
- `StrictHostKeyChecking=yes` is enforced (`StrictHostKeyChecking=no` is intentionally not used)
- `dry-run` must be `true` or `false` and defaults to `true`
- Remote changes happen only when `dry-run` is explicitly set to `false`

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `mode` | No | `stage` | Operation mode: `stage` or `live` |
| `source` | No | - | Local build output directory (required in `stage` mode) |
| `folder` | Yes | - | Relative target folder under docs root |
| `dry-run` | No | `true` | Must be `true` or `false`; when `true`, rsync runs with `--dry-run` |
| `ssh-user` | Yes | - | SSH user |
| `ssh-host` | Yes | - | SSH host |
| `ssh-private-key` | Yes | - | SSH private key content |
| `known-hosts` | Yes | - | known_hosts content used for host verification |
| `stage-root` | Yes | - | Remote stage docs root |
| `live-root` | Yes | - | Remote live docs root |

## Behavior

- `stage` mode:
  - validates `source` exists and is a directory
  - syncs local `source` contents to `<stage-root>/<folder>/`
  - uses `rsync -azv --delete-after`
- `live` mode:
  - promotes `<stage-root>/<folder>/` to `<live-root>/<folder>/` on remote host
  - runs remote `mkdir -p` only when `dry-run` is `false`
  - does not run remote `mkdir -p` when `dry-run` is `true`
  - uses remote `rsync -av --delete-after`
- For both modes, `--dry-run` is added when `dry-run` is `true`.

This preserves behavior parity at the rsync level:
- stage: `rsync -azv --delete-after`
- live: `mkdir -p` + `rsync -av --delete-after`

## Folder validation

`folder` must be a safe relative path:
- non-empty
- not absolute
- characters limited to `A-Z`, `a-z`, `0-9`, `.`, `_`, `-`, `/`
- rejects `.`
- rejects paths starting with `./`
- rejects paths ending with `/.`
- rejects paths containing `/./`
- rejects any `..`
- rejects `//`

## Example usage

```yaml
jobs:
  publish-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Stage docs
        uses: camunda/automation-platform-github-actions/docs-rsync@<commit-sha-or-version-tag>
        with:
          mode: stage
          source: ./dist/docs
          folder: manual/1.2
          dry-run: true
          ssh-user: ${{ secrets.DOCS_SSH_USER }}
          ssh-host: ${{ secrets.DOCS_SSH_HOST }}
          ssh-private-key: ${{ secrets.DOCS_SSH_PRIVATE_KEY }}
          known-hosts: ${{ secrets.DOCS_SSH_KNOWN_HOSTS }}
          stage-root: ${{ vars.DOCS_STAGE_ROOT }}
          live-root: ${{ vars.DOCS_LIVE_ROOT }}

      - name: Promote docs to live
        uses: camunda/automation-platform-github-actions/docs-rsync@<commit-sha-or-version-tag>
        with:
          mode: live
          folder: manual/1.2
          dry-run: true
          ssh-user: ${{ secrets.DOCS_SSH_USER }}
          ssh-host: ${{ secrets.DOCS_SSH_HOST }}
          ssh-private-key: ${{ secrets.DOCS_SSH_PRIVATE_KEY }}
          known-hosts: ${{ secrets.DOCS_SSH_KNOWN_HOSTS }}
          stage-root: ${{ vars.DOCS_STAGE_ROOT }}
          live-root: ${{ vars.DOCS_LIVE_ROOT }}
```

Set `dry-run: false` explicitly only when you are ready to apply remote changes.

