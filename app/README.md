# Surface Mapper

The phone-first projection mapping app (roadmap #1; MVP for #11, #12, #13, #14; connecting for #2).
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
   *Edit points* adds, moves and removes outline points. *Combine* adds shapes
   to a surface or cuts holes in it.
4. **Fill.** In *Tools → Content*, pick an effect or add a video or image from
   the phone. Media follows the surface's perspective. *One image across all*
   runs one video continuously across several surfaces.
5. **Sound.** In *Tools → Sound*, pick a soundtrack: a video's own sound or an
   audio file. "Beat sequence", "Pulse to music" and "Tiles" follow the beat.
   You can react to the microphone instead.
6. **Show.** Tap *Show* to hide everything but the content. Double-tap or
   long-press to go back to editing.

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

## Layout

| File | What it does |
|---|---|
| `src/app.js` | Wiring: layout, UI, playback, Show mode, autosave, output window |
| `src/renderer.js` | WebGL2 renderer: one fragment shader for all surfaces, effects and media |
| `src/effects.js` | Built-in effects (GLSL); audio uniforms are documented at the top |
| `src/geometry.js` | Homographies, shapes, hit-testing |
| `src/editor.js` | Touch editing: corners, points, combine and cut, snapping, nudging |
| `src/audio.js` | Web Audio analysis: bass, mid, treble, level, beat |
| `src/media.js` | The user's videos, images and audio (object URLs, IndexedDB) |
| `src/store.js` | Projects in localStorage, media blobs in IndexedDB, import and export |
| `src/link.js` | Links to a second screen (Presentation API), including sending media files |
| `sw.js`, `manifest.webmanifest` | Installable, and works offline once loaded |
