## Agent skills

### Issue tracker

Issues live as GitHub Issues on this repo, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root, created lazily as terms and decisions resolve. See `docs/agents/domain.md`.

### After a merge that changes the writer: update the writer artifact

The **writer** is the small Claude artifact the app hands AI requests to: https://claude.ai/artifact/SNkGsUMc1BAPdug3UZzL2K (`WRITER_URL` in `app/src/share.js`). Republish it when a merge changes `app/writer.html` or a module it imports (`tools/writer.mjs` lists them in `files.json`). Update that URL in place; never publish it as a new artifact.

1. Check out the merged `main` and run `node tools/writer.mjs <scratch-dir>`.
2. Publish `<scratch-dir>/index.html` to the URL above, with every entry in `files.json` as `files`. Leave out `capabilities` so it keeps `sample`.
3. If the publish is refused because live files are unread: read them, and check they match the previous `main` (`git show <old-main>:app/<file>`). Only then publish. If one differs, someone edited the writer directly: ask before overwriting it.

See `app/README.md` → *Deploying* → *The writer*.
