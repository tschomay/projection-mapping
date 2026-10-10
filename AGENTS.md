## Agent skills

### Issue tracker

Issues live as GitHub Issues on this repo, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root, created lazily as terms and decisions resolve. See `docs/agents/domain.md`.

### After every merge to `main`: update the studio artifact

The app also runs as a Claude artifact, the **studio**: https://claude.ai/artifact/QDTC5ZPeQj6U5AHwMxJieL. It doesn't update by itself, so republish it after each merge. Update that URL in place; never publish it as a new artifact.

1. Check out the merged `main` and run `node tools/artifact.mjs <scratch-dir>`. This writes `index.html`, the modules under `src/`, and `files.json`.
2. Publish `<scratch-dir>/index.html` to the URL above, with every entry in `files.json` as `files`. Leave out `capabilities` so it keeps `sample` and `downloads`.
3. If the publish is refused because live files are unread: read them, and check they match the previous `main` (`git show <old-main>:app/src/<file>`). Only then publish. If one differs, someone edited the studio directly: ask before overwriting it.

See `app/README.md` → *Deploying* → *As a Claude artifact*.
