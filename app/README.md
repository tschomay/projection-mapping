# Surface Mapper

The phone-first projection mapping app (roadmap #1; MVP for #11, #12, #13, #14; connecting for #2; camera capture for #3; cues for #8; AI effects for #9; bending for #6; arranging content for #7; ISF for #10).
Plain static files: HTML, ES modules and WebGL2, with no build step.

## Using it

1. **Connect the phone to the projector.** A USB-C to HDMI adapter (Android with
   DisplayPort alt mode, iPhone 15 and later) or a Lightning AV adapter is best:
   no lag, and sound goes over HDMI. Chromecast or AirPlay screen mirroring also
   works, with some lag. The phone screen becomes the projector frame.
2. **Open the app full screen in landscape.** Install it to the home screen for
   true full screen: *Add to Home Screen* in Safari, *Install app* in Chrome.
3. **Map.** In *Tools → Surfaces*, add a square, circle or triangle. It's
   projected too, so drag it onto a real flat surface, then drag its four
   corners onto the surface's corners. Use the nudge pad for the last pixel.
   *Points* adds, moves and removes outline points. *Bend* puts a grid on the
   surface whose points you drag onto a curved or bowed object; *Soft edge*
   feathers the outline. *Combine* adds shapes
   to a surface or cuts holes in it.
   **Or let the camera find them:** *Tools → Surfaces → Find surfaces with
   the camera*. Prop the phone 30 cm to 1 m to the side of the projector,
   back camera facing the set, dim the lights and tap *Start*. The projector
   shows about 40 stripe frames while the camera photographs each one (half a
   minute or so; tap to cancel), then every flat face becomes a surface.
   Check the corners afterwards; *Undo* brings back what you had.
4. **Fill.** In *Tools → Content*, pick an effect or add a video or image from
   the phone (*Halloween* has bats, eyes, fog, lightning and candle glow). Or
   *Describe a look* and an AI model writes a new effect for your surfaces:
   on your Claude plan in the studio artifact, or with your own Gemini or
   Anthropic API key here (stored only on the device). Media follows the surface's perspective. *One image across all*
   runs one video continuously across several surfaces. *Arrange content* picks which rectangle of that
   frame-wide content each surface shows (see below). *Import ISF file* brings in a generator from another VJ
   app; *Export this effect as ISF* goes the other way.
5. **Sound.** In *Tools → Sound*, pick a soundtrack: a video's own sound or an
   audio file. "Beat sequence", "Pulse to music" and "Tiles" follow the beat.
   You can react to the microphone instead.
6. **Cues.** In *Tools → Show*, *Add cue from the current look* remembers
   what every surface shows. Change the surfaces and add the next cue. Each
   cue starts on a tap, some seconds or beats after the previous one, or at a
   time in the soundtrack (*Now* takes the current time), and arrives with a
   crossfade, a cut or a wipe across the frame. The timeline shows the timed
   cues against the song; tap it to jump.
7. **Show.** Tap *Show* to hide everything but the content. With cues, a single
   tap (or Space) runs the next one. Double-tap or long-press to go back to
   editing.

**No projector yet?** *Project → Design on a photo*: pick a photo of the set,
taken from where the projector will stand. Trace surfaces on it and try
effects, media and cues; the content shows as light on the photo. On the day,
nudge the corners onto the real objects. *Project → Check this device* shows
what your phone supports, and [`docs/connecting.md`](../docs/connecting.md)
explains rehearsing with a TV.

Projects save automatically on the device, with media kept in IndexedDB.
*Project → Export file* moves a mapping to another device; re-add the media
files there.

**Second screen (Chrome):** *Project → Present to a screen* sends only the
output to a Chromecast, a cast-capable projector or a display Chrome can
present to, and the phone keeps its controls. Videos and images are copied to
the screen when it needs them. See [`docs/connecting.md`](../docs/connecting.md)
for every path and what's been tested.

**Laptop with the projector as a second display:** *Project → Open output
window*. Chrome puts it on the projector if you allow window placement;
otherwise drag it there. Click it once. That window shows only the output and
plays the sound; keep editing in the main window.

## Arranging content across surfaces

Frame-wide content, meaning media set to *One image across all* and the effects that use `s.screen` (Screen
sweep, Plasma, Bats, Fog, Lightning), is laid out on one **composition** the size of the frame. By default each
surface shows the part of it that it covers, so content runs on continuously across neighbouring surfaces.

*Content → Arrange content* shows the composition (with the video or image under it) and one rectangle per
surface: the part of the composition that surface shows. Drag a rectangle to move it, its corners to resize
it; the nudge pad moves it a pixel at a time. The surfaces themselves don't move. So three boxes on a
shelf can show one video's left, middle and right in any order, or one small surface can show the whole
video. *Back to where it sits* returns a surface to the default. Per-surface media (*Own copy*) and
effects that use the surface's own `uv` aren't affected.

## ISF

[ISF](https://isf.video) is the shader format MadMapper, VDMX, Resolume (through Wire), Synesthesia and
others load.

**Export** (*Content → Export this effect as ISF*, with a surface selected) saves its effect as an ISF 2
generator (`.fs`): the effect code unchanged, plus an adapter that fills `Surf2` from ISF's built-ins. It is
plain GLSL ES 1.00, the strictest dialect hosts use; the tests compile every built-in effect that way.

| In the app | In the exported file |
|---|---|
| `t` | `TIME` |
| `s.uv`, `s.screen` | both `isf_FragNormCoord`: the host's canvas is the surface |
| `s.px`, `s.size`, `uRes` | from `gl_FragCoord` and `RENDERSIZE` |
| `s.edge` | distance to the canvas border, not to the surface's outline |
| `uAudio`, `uBeat`, `uBeats`, `uHasAudio` | inputs `audioBass`, `audioMid`, `audioTreble`, `audioLevel`, `audioBeat`, `audioBeatCount`, `hasAudio`; wire them to the host's audio analysis |
| `s.id`, `s.count` | inputs `surfaceId`, `surfaceCount` |

What doesn't carry over: the surface's real shape (outline, cut-outs, soft edge and bend stay in the app), and
the continuity of `s.screen` across several surfaces (a host gives each layer its own canvas). The sandbox's
3D-only fields (world position, normals) have no ISF counterpart.

**Import** (*Content → Import ISF file*) adds an ISF generator to the project's effects (marked ✦), and onto
the selected surface. The surface is the ISF canvas: `isf_FragNormCoord` runs between its corner pins and
`RENDERSIZE` is its size. Inputs are fixed at their defaults. The file's names are renamed so they can't
collide with the app's or another effect's, and code behind `#ifndef GL_ES` is left out. Not imported yet:
image and audio inputs (filters, audio-reactive ISF), several passes or persistent buffers, and imported
images. Desktop-only GLSL that GLSL ES 3.00 rejects is reported with the compiler's message.

## Deploying

Any static host works. HTTPS is required for the microphone, the wake lock,
full screen and the service worker; localhost counts as secure for testing.

**Vercel (recommended, since you have it):** import the GitHub repo in Vercel.
`vercel.json` at the repo root already says there's no build step and the site
is the `app/` folder. Every push deploys automatically, and each branch gets
its own preview URL to open on the phone.

**GitHub Pages** works equally well: publish the `app/` folder.

**Locally:** `cd app && python3 -m http.server 8000`, then open
`http://localhost:8000`. To use the phone on the same Wi-Fi you need HTTPS,
for example a tunnel or a Vercel preview, because the phone can't treat a LAN
IP as secure.

**As a Claude artifact (the studio):** `node tools/artifact.mjs <dir>` writes
a copy of the page without the install bits, plus the modules, and a
`files.json` map. Publish `<dir>/index.html` with those files and the
capabilities `sample` and `downloads`. There, *Describe a look* runs on the
viewer's Claude plan, and *Project → Open in Surface Mapper* hands the project
to the deployed app (`APP_URL` in `src/share.js`). Camera capture, the
microphone, full screen and second screens don't work inside an artifact.

## Layout

| File | What it does |
|---|---|
| `src/app.js` | The app: state, layout, frame loop, playback, Show mode, autosave, output window and second screen |
| `src/ui/*.js` | One module per drawer pane (surfaces, content, sound, cues, project) plus camera capture; mixed into the app |
| `src/env.js` | Small shared helpers (`$`, whether this page is an output display) |
| `src/renderer.js` | WebGL2 renderer: one fragment shader for all surfaces, effects and media |
| `src/effects.js` | Built-in effects (GLSL); audio uniforms are documented at the top |
| `src/geometry.js` | Homographies, shapes, hit-testing |
| `src/editor.js` | Touch editing: corners, points, combine and cut, snapping, nudging, arranging content rectangles |
| `src/audio.js` | Web Audio analysis: bass, mid, treble, level, beat |
| `src/media.js` | The user's videos, images and audio (object URLs, IndexedDB) |
| `src/store.js` | Projects in localStorage, media blobs in IndexedDB, import and export |
| `src/capture.js` | Finding surfaces from photos: Gray-code patterns, decoding, plane fitting, surfaces (from the sandbox) |
| `src/camera.js` | The camera side: open it, lock exposure, photograph each pattern once it has settled |
| `src/isf.js` | ISF: an effect as an ISF generator file, and an ISF generator as an effect |
| `src/ai.js` | AI-written effects: the prompt (with the real surfaces), the model call (Claude plan in an artifact, Gemini Interactions API, or Claude API), one compile-repair round |
| `src/share.js` | Project links: the project gzipped into `#import=`, for *Share a link* and the studio's *Open in Surface Mapper* |
| `src/show.js` | Cues and timeline: going to a cue, transitions, cues that start by themselves |
| `src/diagnostics.js` | *Check this device*: what the phone supports, and a camera test |
| `src/link.js` | Links to a second screen (Presentation API), including sending media files |
| `sw.js`, `manifest.webmanifest` | Installable, and works offline once loaded |
