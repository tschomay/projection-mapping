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
3. **Map.** Tap *Add* in the top bar for a square, circle or triangle (or
   long-press empty space to add one right there). It's projected too, so drag
   it onto a real flat surface, then drag its four corners onto the surface's
   corners; arrow keys nudge by a pixel (Shift: 10). The selected surface gets a
   small bar at the bottom, on the side away from it: *Corners*, *Points* (add,
   move and remove outline points) and *Bend* (a grid to drag over a curved or
   bowed object), and *⋯* for the rest: join, *Soft edge* (a slider over the
   frame), *Bend grid* size, add a shape to it or cut one out, duplicate,
   delete. Long-press a surface (or right-click it) for the same menu. **Tap the
   selected surface** to hide or show that bar; editing carries on either way.
   **Tap empty space** to deselect, and again to hide or show the buttons at
   the top. The full screen button hides the browser's own bars while editing.
   **Undo** (top bar, or Ctrl+Z) takes back any change to the surfaces' shapes,
   one step at a time: drags, nudges, points, bends, deletes, joins, picks.
   What a surface shows isn't touched. Deleting a surface, joining two, or
   tapping a picked shape for a bigger one also offers *Undo* in the message
   that pops up.
   **Join:** snap two surfaces together (two squares corner to corner, say),
   select one and pick *Join* in its *⋯* menu. They become one surface with the first one's
   content running across both. Where they share an edge it disappears, and a
   joined rectangle gets the outer four corners as its corner pins, so content
   fills it exactly. Surfaces that only touch at a corner, or overlap, become
   one surface of two shapes. A bend grid is reset by joining.
   **Or let the camera find them:** *Add → Find with the camera*. Prop the phone 30 cm to 1 m to the side of the projector,
   back camera facing the set, dim the lights and tap *Start*. The projector
   shows about 40 stripe frames while the camera photographs each one (half a
   minute or so; tap to cancel), then every flat face becomes a surface.
   Check the corners afterwards; *Undo* brings back what you had.
   **Or pick them on a photo:** for flat things on a wall that the stripes
   can't tell apart (picture frames, wainscoting panels, doors), take a photo
   from the projector (*Project → Design on a photo → Take it from the
   projector*), then *Add → Tap things on the photo* and tap one.
   Its corners become the surface's corners; tap inside it again for the
   one around it (the artwork, then its mat, then the frame). Switch the bar
   to *Any shape* for round and odd-shaped things (a mirror, a wreath, an
   arched window): the surface takes the outline itself, which *Points* can
   then tweak. Two sliders reshape the last one as they move: *Sensitivity*
   (higher stops at fainter edges, so the shape stays smaller) and, for
   outlines, *Simplify* (higher straightens jagged edges and keeps only the
   main corners; curves stay round); they slide freely and the shape updates
   when you pause or let go. Pinch (or the mouse wheel) zooms in on the design
   photo and two fingers pan; while picking, one finger pans once zoomed in.
   *Fit* zooms back out. Picking uses a small Segment Anything
   model (about 14 MB, downloaded once, when you start) to tell what you
   tapped, and the photo's straight edges to place rectangles exactly; where
   the model can't load, edges and a colour fill do it alone, less reliably.
4. **Fill.** Tap *Looks* in the top bar. A tray of live previews opens: along
   the bottom with the phone upright, down one side when it's on its side (⇆
   moves it to the other side). Tap a look and it's on the selected surface, and
   on the projector, straight away; *All* puts it on every surface. Search and
   the groups (*Basics*, *Music*, *Ambient*, *Halloween*, *Fall*, your own, videos and
   images) sit above the tiles (on its side, they scroll away with *This one*/*All*). ♪ marks looks that move
   to music, ⇆ ones that flow from one surface to the next; for those, the tray
   offers *Flow across* or *Whole scene here*, which fits the whole scene on that
   surface instead. *Halloween* has
   20 looks, among them a singing jack-o'-lantern for a real pumpkin, a haunted
   window, ghosts, a witch across the moon, dripping blood and a jump scare;
   *Fall* has falling leaves, a harvest moon, a fireplace and more; *Christmas* has snow,
   twinkle lights round the outline, candy stripes and northern lights. **Settings**: most looks have a colour,
   speed, how many or parts to switch off, shown in the tray above the search for the selected surface (or every
   surface showing that look, with *All*). Each surface keeps its own, cues capture them, and *Back to the look's
   own settings* resets them. See
   [`docs/looks.md`](../docs/looks.md) for the list, what each is best on, and how to add one. *＋ Video or image* adds one
   from the phone. Or *✦ Describe a look* and an AI model writes a new effect for your surfaces:
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

**Design on a photo.** *Project → Design on a photo → Take it from the
projector*: hold the phone right beside the projector's lens and the projector
flashes black, then white. The white flash shows where the projector's frame is
in the photo, so the photo lines up with the frame exactly. **No projector
yet?** Choose a photo of the set taken from where the projector will stand,
and drag the frame's corners onto it (*Line it up with the projector*). Trace
surfaces on it and try effects, media and cues; the content shows as light on
the photo. *Show* hides the photo, so only the content reaches the projector; it
comes back when you go back to editing. On the day, nudge the corners onto the real objects. *Project → Check this device* shows
what your phone supports, and [`docs/connecting.md`](../docs/connecting.md)
explains rehearsing with a TV.

Projects save automatically on the device, with media kept in IndexedDB.

A design photo is scaled down to 2048 px on its longer side when it's chosen (projects saved with a bigger one have
it scaled down, in place, when they open): a phone's 12 MP photo would otherwise hold about 100 MB more while the
project is open, and the frame never shows that much detail.

**In a background tab** the editor gives back what it holds, so it can't run the browser out of graphics memory
for other tabs: the frame's WebGL context, the tray's previews (also whenever the tray is closed), the shape model
for picking on a photo (also two minutes after picking is put away), the camera, and idle audio. Everything comes
back when the tab is shown again. A playing soundtrack keeps playing, and the output window and second screens
keep everything.
*Project → Export file* moves a mapping to another device; re-add the media
files there.

**Second screen (Chrome):** *Project → Present to a screen* sends only the
output to a screen Chrome can present to, and the phone keeps its controls: it
becomes the remote, and can be held upright. Chromecasts and cast projectors
only take Cast apps, which Surface Mapper isn't yet (#47); there, a cable or
screen mirroring is the way. Videos and images are copied to
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
video. *Back to where it sits* returns a surface to the default. *Whole scene here* in the Looks tray is the one-tap
version of the most common arrangement: the whole composition on one surface. Per-surface media (*Own copy*) and
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
| the effect's settings | inputs, with the surface's current values as defaults: a range is a `float`, a toggle a `bool`, a choice a `long` with its labels, a colour a `color` |

What doesn't carry over: the surface's real shape (outline, cut-outs, soft edge and bend stay in the app), and
the continuity of `s.screen` across several surfaces (a host gives each layer its own canvas). The sandbox's
3D-only fields (world position, normals) have no ISF counterpart.

**Import** (*Content → Import ISF file*) adds an ISF generator to the project's effects (marked ✦), and onto
the selected surface. The surface is the ISF canvas: `isf_FragNormCoord` runs between its corner pins and
`RENDERSIZE` is its size. Its `float`, `bool`, `long` and `color` inputs become the effect's settings (up to eight);
`point2D` and `event` inputs are fixed at their defaults. A file this app exported has its music and surface
inputs wired back to the app's own sound analysis, so it still moves to music. The file's names are renamed so they can't
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

**The writer (a Claude artifact):** *Describe a look* without an API key hands
the request to the writer, a small Claude artifact (`WRITER_URL` in
`src/share.js`) where Claude writes the effect on the viewer's own plan. A
claude.ai link can't carry anything into the page, so *Write it with Claude*
copies the request (the look, the surfaces, which one is selected and the way
back) and opens the writer, where the viewer pastes it. The writer shows the
effect on their real surfaces (with pretend music for looks that react to it),
takes changes ("slower", "warmer") and hand edits to the code as numbered
versions, and *Add to Surface Mapper* opens the app with `#fx=`, which adds the
shown version to the open project. Another tab of the app picks up the saved
copy when it's shown again. To publish it, `node tools/writer.mjs <dir>` writes
`index.html`, the modules it imports and a `files.json` map. Publish
`<dir>/index.html` with those files and the capability `sample`.

**As a Claude artifact (the studio):** `node tools/artifact.mjs <dir>` writes
a copy of the page without the install bits, plus the modules, and a
`files.json` map. Publish `<dir>/index.html` with those files and the
capabilities `sample` and `downloads`. There, *Describe a look* runs on the
viewer's Claude plan, and *Project → Open in Surface Mapper* hands the project
to the deployed app (`APP_URL` in `src/share.js`). Camera capture, the
microphone, full screen and second screens don't work inside an artifact, and
picking on a photo works from edges and colours alone there (the model's host is out of reach).

## Layout

| File | What it does |
|---|---|
| `src/app.js` | The app: state, layout, frame loop, playback, Show mode, autosave, output window and second screen |
| `src/ui/*.js` | One module per drawer pane (surfaces, content, sound, cues, project), the content tray, quick editing on the frame, camera capture and the design photo; mixed into the app |
| `src/thumbs.js` | Live previews for the content tray: one canvas behind the tiles, each effect drawn into its tile |
| `src/env.js` | Small shared helpers (`$`, whether this page is an output display) |
| `src/renderer.js` | WebGL2 renderer: one fragment shader for all surfaces, effects and media |
| `src/effects.js` | Built-in effects (GLSL), the tray's groups and badges; audio uniforms are documented at the top |
| `src/effects/*.js` | Seasonal sets (`halloween.js`, `fall.js`), shared families and parts (`families.js`), and the kit of GLSL helpers every look can use (`kit.js`) |
| `src/geometry.js` | Homographies, shapes, hit-testing |
| `src/editor.js` | Touch editing: corners, points, combine and cut, snapping, nudging, taps that hide and show the bars, arranging content rectangles |
| `src/audio.js` | Web Audio analysis: bass, mid, treble, level, beat |
| `src/media.js` | The user's videos, images and audio (object URLs, IndexedDB) |
| `src/store.js` | Projects in localStorage, media blobs in IndexedDB, import and export |
| `src/capture.js` | Finding surfaces from photos: Gray-code patterns, decoding, plane fitting, surfaces (from the sandbox) |
| `src/camera.js` | The camera side: open it, lock exposure, photograph each pattern once it has settled, and the photo from the projector |
| `src/photo.js` | Lining a photo up with the projector frame: the frame found in a black and a white photo, the homography, its CSS |
| `src/regions.js` | Rectangles in a photo from a tap: edges, Hough lines, the quads around the tap, innermost first |
| `src/pick.js` | One tap on the photo to candidate shapes: the model's masks, matched to edge rectangles; edges and colour fill without it |
| `src/segment.js` | Any shape from a tap: SlimSAM (Segment Anything) through transformers.js, loaded from a CDN on first use |
| `src/outline.js` | A mask as a surface: traced, simplified, given pins; and the colour fill used without the model |
| `src/isf.js` | ISF: an effect as an ISF generator file, and an ISF generator as an effect |
| `src/ai.js` | AI-written effects: the prompt (with the real surfaces), the model call (Claude plan in an artifact, Gemini Interactions API, or Claude API), one compile-repair round |
| `src/share.js` | Project links: the project gzipped into `#import=`, for *Share a link* and the studio's *Open in Surface Mapper*; the request copied for the writer, and the effect it sends back in `#fx=` |
| `writer.html`, `src/writer.js` | The writer, published as a Claude artifact: a pasted request written on the viewer's Claude plan, previewed on their surfaces, changed by asking or by hand, and sent back |
| `src/show.js` | Cues and timeline: going to a cue, transitions, cues that start by themselves |
| `src/diagnostics.js` | *Check this device*: what the phone supports, and a camera test |
| `src/link.js` | Links to a second screen (Presentation API), including sending media files |
| `sw.js`, `manifest.webmanifest` | Installable, and works offline once loaded |
