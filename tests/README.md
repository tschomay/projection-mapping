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
| `photo.test.mjs` | A photo from beside the projector's lens, on a synthetic wall with wainscoting and picture frames (`buildWall` in `scene.mjs`): the projector frame found from a black and a white photo, and a tap on each panel and picture giving its rectangle, then the ones around it (artwork, mat, frame). Node only. |
| `outline.test.mjs` | Any-shape outlines in Node: a mask traced and simplified; Simplify straightening a slanted square's staircase, keeping an L's and a hexagon's corners, a disc round and an arch's corners under its curve; a round outline kept as the surface's points and a four-sided one turned into corner pins; the colour fill outlining the synthetic wall's round mirror (glass, then glass and ring) and a panel. |
| `transfer.test.mjs` | Second-screen file transfer in Node with a slow fake connection: 5 MB arrives intact, never more than 32 chunks in flight, progress reported. |
| `link.e2e.mjs` | The connect guide, the Show-mode hint, and a second screen through the Presentation API running in a separate browser context, as if on another device: project, live edits, aspect ratio and media files reach it. |
| `check.e2e.mjs` | The device check screen lists capabilities and tests the camera (Chromium's fake camera). |
| `show.e2e.mjs` | Cues and timeline: three cues in sync with a generated 120 bpm song, jumping back, a tap in Show mode, and a cue that follows four beats. |
| `ai.e2e.mjs` | AI-written effects without any real API. With an Anthropic key, a fake SDK in place of the CDN module: the request (model, effort, refusal fallback, the surfaces described), one compile-repair round, applying the effect, a refusal, and key handling. With a Gemini key, a routed Interactions API: the request, the repair round, a refused key. As a Claude artifact, a stubbed `window.claude` sample(): no key box, the instructions in the first turn, the repair, declined consent. |
| `mesh.e2e.mjs` | Bending a surface with its grid and softening its edge, read back from the rendered frame: the outline and content follow the bend, no seams between cells, the feather, and point editing through the bend. |
| `limits.e2e.mjs` | Renderer limits: more than 2,048 outline points still draw; a 17th surface is refused; too many surfaces or shapes are reported in the Surfaces pane. |
| `photo.e2e.mjs` | Designing on a photo of the set (blended as light, saved, hidden from the media list; a 4000 × 3000 photo scaled to 2048 × 1536 when chosen, and one saved full-size by an earlier version scaled down on opening), and media used only in a cue being kept with the project. Then, with a fake camera filming the synthetic wall: *Take it from the projector* lines the photo up with the frame, its corners can be dragged, and tapping pictures and panels on it makes surfaces on them. |
| `outline.e2e.mjs` | *Any shape* in the app on the synthetic wall: with a fake transformers.js in place of the CDN module, a tap on the mirror gives a surface with its round outline and a tap inside it takes in the ring, the photo encoded once; the sliders appear after a pick, *Simplify* reshapes the same surface and is saved, and a tap elsewhere starts a new one; hidden, the model is let go, and shown again while picking it loads and encodes the photo again; with the model unreachable, the app says so and the colour fill outlines the mirror. |
| `share.e2e.mjs` | Project links: *Share a link* copies a link, a fresh browser opens it with surfaces, effects and cues, saves it and clears the fragment; a damaged link; in an artifact, *Open in Surface Mapper* is a plain link that follows edits. |
| `merge.test.mjs` | Joining surfaces in Node: outlines that share an edge (fully or partly, wound either way) become one outline; touching only at a corner, overlapping or apart, they don't. Two snapped squares become one surface whose corner pins are the outer rectangle; in perspective, the outline runs exactly round both; cut-outs come along, a bend is dropped, more than eight shapes is refused. |
| `effects.test.mjs` | The built-in looks in Node: ids, names and groups, `fx_<id>` defined once, no helper defined twice across looks and the kit, no GLSL ES 3.00-only code or reserved words, every kit function documented for the AI prompt, and the tray's badges. |
| `isf.test.mjs` | ISF in Node: an exported effect's header, inputs and main(); an imported generator's renamed names, inputs fixed at their defaults, `#ifndef GL_ES` code left out; files that are refused (image or audio inputs, several passes). Uses `fixtures/rings.fs`. |
| `isf.e2e.mjs` | ISF and the composition canvas in the app: every built-in effect exported as ISF compiles and draws in a minimal ISF host (WebGL1); all of them compile together in the app's renderer, and an empty project compiles only the basics; *Export this effect as ISF* downloads the file; importing a generator, and the exported file again, draws on a surface; an image filter is refused. *Arrange content*: dragging a surface's rectangle moves and resizes what it shows, for effects and for "one image across all" media. |
| `edit.e2e.mjs` | Quick editing: *Add* menu, a drag and four nudges each one Undo step (content left alone), Ctrl+Z, the selected surface's bar (handle modes, Copy, hidden with the drawer open), the long-press menu (Delete with Undo in the toast, a tap outside closes it, not on a corner handle, add a shape on empty space), *Join* for two snapped squares (one lit surface, Undo splits them), and Undo after tapping a picked shape for a bigger one. |
| `hidden.e2e.mjs` | A hidden tab gives back what it holds: closing the tray gives back the previews' context and tiles (and reopening draws them again); hidden, the frame's WebGL context is given up, idle audio suspended and an open camera closed; shown again, the frame draws as before, the camera reopens and a look picked meanwhile is compiled; a context the browser takes away by itself comes back too. |
| `scan.e2e.mjs` | *Find surfaces with the camera* end to end, with a fake camera that films the synthetic room lit by the app's patterns, with a lag like a mirrored projector. |

`scene.mjs` is the synthetic room and wall; `serve.mjs` serves `app/` on a free port and
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

## Looking at looks

`node tools/looks.mjs` (from the repo root, after `npm install` here) draws
every built-in look at a few moments into `looks.png`, to check a new one by eye.
Name looks (`pumpkin,window`) or a `--group`; `--times`, `--music` and `--circle`
change what's drawn. See [`docs/looks.md`](../docs/looks.md).

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

`bench/pick.bench.mjs` measures picking on a photo (*Tap things on the photo*)
against the hand-labelled real photos in `photos/` (see its README): for each
tap, whether the first shape is right and whether one of the first three is
(IoU 0.85 or more), with the shape model in both modes, and without it from
edges and colour fill. It needs the network for the model (`--no-model` skips
it); behind an HTTPS proxy it passes `HTTPS_PROXY` to the browser. `PHOTOS=dir`
adds your own labelled photos, kept out of the repository; `--split holdout`
scores only the photos not used while tuning.

```sh
node bench/pick.bench.mjs --verbose          # every tap's scores, and totals
node bench/pick.bench.mjs --sense 0.7        # at another Sensitivity
```
