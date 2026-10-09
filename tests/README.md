# Tests

Checks for Surface Mapper (`app/`). The app itself has no build step; these
need Node 20+ and, for the browser tests, Playwright's Chromium.

```sh
cd tests
npm install          # once: Playwright
npx playwright install chromium   # once, if you don't have its browser yet
npm test             # everything (the camera test takes a few minutes)
npm run test:quick   # just the pipeline checks, about two seconds
```

| File | What it checks |
|---|---|
| `sw.test.mjs` | The offline cache list and version in `app/sw.js` match the app's files. If it fails, run `node tools/sw.mjs`. |
| `capture.test.mjs` | The surface-capture pipeline (`app/src/capture.js`) on a synthetic room: a projector, a camera beside it, a wall, a floor and a box. The box faces must come back as three surfaces with the right corners. Node only. |
| `link.e2e.mjs` | The connect guide, the Show-mode hint, and a second screen through the Presentation API running in a separate browser context, as if on another device: project, live edits, aspect ratio and media files reach it. |
| `check.e2e.mjs` | The device check screen lists capabilities and tests the camera (Chromium's fake camera). |
| `show.e2e.mjs` | Cues and timeline: three cues in sync with a generated 120 bpm song, jumping back, a tap in Show mode, and a cue that follows four beats. |
| `ai.e2e.mjs` | AI-written effects with a fake SDK in place of the CDN module: the request (model, effort, refusal fallback, the surfaces described), one compile-repair round, applying the effect, a refusal, and key handling. No API key or network needed. |
| `mesh.e2e.mjs` | Bending a surface with its grid and softening its edge, read back from the rendered frame: the outline and content follow the bend, no seams between cells, the feather, and point editing through the bend. |
| `limits.e2e.mjs` | Renderer limits: more than 2,048 outline points still draw; a 17th surface is refused; too many surfaces or shapes are reported in the Surfaces pane. |
| `photo.e2e.mjs` | Designing on a photo of the set (blended as light, saved, hidden from the media list), and media used only in a cue being kept with the project. |
| `scan.e2e.mjs` | *Find surfaces with the camera* end to end, with a fake camera that films the synthetic room lit by the app's patterns, with a lag like a mirrored projector. |

`scene.mjs` is the synthetic room; `serve.mjs` serves `app/` on a free port and
holds small helpers. If Playwright is installed somewhere else, point
`PLAYWRIGHT_PATH` at its `index.mjs`.

The browser tests run Chromium with software WebGL, so they're slow; the camera
test is slowest because the app waits for each projected frame to settle.

## Benchmarks

`bench/` holds measurements rather than pass/fail checks. They drive the
sandbox (`sim/index.html`) headless with a seeded `Math.random`, so each seed is
one fixed random layout and camera spot.

```sh
node bench/solve.bench.mjs 20 1        # 20 seeds from 1: projector aim error after camera scan + 3D solve
node bench/solve.diag.mjs 4            # one seed in detail: what each scanned surface really is, true vs solved projector
THROW= node bench/solve.bench.mjs 20 1 # without the throw ratio
SIM_PATH=/path/to/other/index.html ... # compare another version of the sandbox
```

Each seed takes about a minute under software WebGL.
