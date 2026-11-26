# Feature: self-publishing to GitHub

The cat publishes its own code to GitHub from inside its Sprite, through the
Sprites OAuth connector. The GitHub token never enters the machine.

## What is it and why is it here?

The hackathon requirements include a public repo. A Sprite carries no git
credentials and should stay that way: the solution was to use the gateway's
GitHub connector, which signs the calls with the human's OAuth token
according to the Sprite's identity. The cat commits its own history.

## How it works (technical flow)

```
node dist/github-publish.js  (runs INSIDE the Sprite)
        │
        ├── collectFiles(REPO_ROOT)   walks the working tree
        │     SKIP_DIRS: node_modules, dist, dist-test, .git, .gatanas
        │     SKIP_FILES: package-lock.json; binaries (content includes \0)
        ▼
gateway/github/<conn>/repos/<repo>/...
        ├── GET  git/ref/heads/main          → head sha
        ├── GET  git/commits/<sha>           → base tree
        ├── POST git/trees (base_tree)       → new tree with the files
        ├── POST git/commits                 → commit signed by the cat
        └── PATCH git/refs/heads/main        → moves the branch (fast-forward)
```

The commit carries the cat's signature (added by the code):

```
<message>

— Gatanás The Michi, from his Sprite
```

Example commit message: `Gatanas: the lair now speaks English; churus
implemented`. Without `--message`, the code falls back to its own
commit text (`Gatanás: new hunt published. prrrr.`).

## Files involved

| File | Role |
|---------|-----|
| `src/github-publish.ts` | File collection, gateway calls, commit and push. |
| `src/habitat.ts` | The gateway convention (`SPRITES_GATEWAY`) used by the script. |
| `scripts/deploy.sh` | Uploads the working tree to the Sprite before publishing. |

## API / Public interface

```bash
# Real usage (required variables):
GITHUB_CONNECTION=<id> REPO=Ariel-GonzAguer/gatanas-the-michi \
  node dist/github-publish.js [--message "commit message"]
```

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_CONNECTION` | (required) | ID of the GitHub connector in the gateway. |
| `REPO` | (required) | `owner/name` of the target repo. |
| `REPO_ROOT` | `/home/sprite/gatanas-the-michi` | Working tree to publish. |
| `BRANCH` | `main` | Target branch. |

The connector must have an `access_policy` with `sprite_labels` that
includes the Sprite (same schema as the OpenRouter connector).

## External dependencies

- Sprites connector gateway → GitHub (REST API v3, Git Data API and
  Contents API). No npm dependencies.

## Limitations and considerations

- **Empty repo**: the Git Data API fails with 409 `"Git Repository is empty"`
  on a repo with no commits. The way out is to create the first file with
  `PUT /contents/<path>` (which creates the `main` branch) and only
  afterwards use the tree flow. See
  [troubleshooting](../deployment/troubleshooting.md).
- **Publishes the working tree, not the repo state**: if files you don't
  want to publish remain on the Sprite, delete them from the tree BEFORE
  publishing; `base_tree` merges, it does not replace, so a file deleted
  only from the repo reappears in the next publication.
- It does not delete files that exist in the repo but not in the working
  tree: it is an additive publication (useful for not destroying history,
  dangerous if an exact mirror is expected).

## References

- [Deployment on Sprites](../deployment/platform.md)
- [Security](../security/implementation.md) (the token never enters the Sprite)
- [Troubleshooting](../deployment/troubleshooting.md) (empty repo, reappearing files)
- Source file: `src/github-publish.ts`
