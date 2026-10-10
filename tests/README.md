# Tests

Checks for Surface Mapper (`app/`). The app itself has no build step; these
need Node 20+ and, for the browser tests, Playwright's Chromium.

```sh
cd tests
npm install          # once: Playwright
npx playwright install chromium   # once, if you don't have its browser yet
npm test             # everything (the camera test takes a few minutes)
npm run test:quick   # the Node checks only, a few seconds
node run.mjs --only scan.e2e,link.e2e   # just the named suites
```

| File | What it checks |
|---|---|
| `sw.test.mjs` | The offline cache list and version in `app/sw.js` match the app's files. If it fails, run `node tools/sw.mjs`. |
| `sim.test.mjs` | The sandbox's copy of the capture pipeline matches `app/src/capture.js`. If it fails, run `node tools/build-sim.mjs`. |
| `capture.test.mjs` | The surface-capture pipeline (`app/src/capture.js`) on a synthetic room: a projector, a camera beside it, a wall, a floor and a box. The box faces must come back as three surfaces with the right corners. Node only. |
| `transfer.test.mjs` | Second-screen file transfer in Node with a slow fake connection: 5 MB arrives intact, never more than 32 chunks in flight, progress reported. |
| `link.e2e.mjs` | The connect guide, the Show-mode hint, and a second screen through the Presentation API running in a separate browser context, as if on another device: project, live edits, aspect ratio and media files reach it. |
| `check.e2e.mjs` | The device check screen lists capabilities and tests the camera (Chromium's fake camera). |
| `show.e2e.mjs` | Cues and timeline: three cues in sync with a generated 120 bpm song, jumping back, a tap in Show mode, and a cue that follows four beats. |
| `ai.e2e.mjs` | AI-written effects without any real API. With an Anthropic key, a fake SDK in place of the CDN module: the request (model, effort, refusal fallback, the surfaces described), one compile-repair round, applying the effect, a refusal, and key handling. With a Gemini key, a routed Interactions API: the request, the repair round, a refused key. As a Claude artifact, a stubbed `window.claude` sample(): no key box, the instructions in the first turn, the repair, declined consent. |
| `mesh.e2e.mjs` | Bending a surface with its grid and softening its edge, read back from the rendered frame: the outline and content follow the bend, no seams between cells, the feather, and point editing through the bend. |
| `limits.e2e.mjs` | Renderer limits: more than 2,048 outline points still draw; a 17th surface is refused; too many surfaces or shapes are reported in the Surfaces pane. |
| `photo.e2e.mjs` | Designing on a photo of the set (blended as light, saved, hidden from the media list), and media used only in a cue being kept with the project. |
| `share.e2e.mjs` | Project links: *Share a link* copies a link, a fresh browser opens it with surfaces, effects and cues, saves it and clears the fragment; a damaged link; in an artifact, *Open in Surface Mapper* is a plain link that follows edits. |
| `isf.test.mjs` | ISF in Node: an exported effect's header, inputs and main(); an imported generator's renamed names, inputs fixed at their defaults, `#ifndef GL_ES` code left out; files that are refused (image or audio inputs, several passes). Uses `fixtures/rings.fs`. |
| `isf.e2e.mjs` | ISF and the composition canvas in the app: every built-in effect exported as ISF compiles and draws in a minimal ISF host (WebGL1); *Export this effect as ISF* downloads the file; importing a generator, and the exported file again, draws on a surface; an image filter is refused. *Arrange content*: dragging a surface's rectangle moves and resizes what it shows, for effects and for "one image across all" media. |
| `scan.e2e.mjs` | *Find surfaces with the camera* end to end, with a fake camera that films the synthetic room lit by the app's patterns, with a lag like a mirrored projector. |

`scene.mjs` is the synthetic room; `serve.mjs` serves `app/` on a free port and
holds small helpers. If Playwright is installed somewhere else, point
`PLAYWRIGHT_PATH` at its `index.mjs`.

The browser tests run Chromium with software WebGL, so they open the app with
`?lowres`, which renders far fewer pixels. The camera test is still the slowest,
because the app waits for each projected frame to settle. CI runs the Node
checks and three groups of browser suites as parallel jobs.

## Generated files

Two files are partly written by scripts in `tools/`; the quick checks fail when
they're stale:

- `app/sw.js`: the offline file list and cache version. Run
  `node tools/sw.mjs` after adding or changing app files.
- `sim/index.html`: its copy of `app/src/capture.js`. Run
  `node tools/build-sim.mjs` after changing the capture pipeline.

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
