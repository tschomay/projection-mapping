# Feasibility: the studio as a writing service for the app

Status: built. The writer is `app/writer.html` and `src/writer.js`, published by
`tools/writer.mjs` (see `app/README.md` → *Deploying*). The way in is the
clipboard, as the probe results below found. This note records how it was
decided.

## The idea

Today the studio artifact is a full copy of the app, there only so *Describe a
look* can run on the viewer's Claude plan (`sample`). The project has to be
built in the studio, then carried to the app with *Open in Surface Mapper*.

Instead: the app keeps the project. Its *Write it with Claude* button (when there
is no API key) opens the studio with the request in the URL. The studio writes
the effect at once, then hands only the effect back to the app.

```
app (Vercel)                          studio (claude.ai artifact)
 Write it with Claude ──open tab──▶   #gen=<gzipped {request, context}>
                                      sample() on load, compile, one repair
 #fx=<gzipped {name, prompt, code}> ◀──one tap── "Add to Surface Mapper"
 adds the effect to the open project
```

## Verdict

Feasible. It needs one tap on the way back, and one fact still has to be
checked: whether claude.ai passes the URL fragment through to the page.

| Step | Feasible? | Why |
|---|---|---|
| App → studio with the request | Probably | The app can open any URL from a click. Unverified: whether `claude.ai/artifact/<id>#gen=…` (or `?gen=`) reaches the framed page's `location`. **Test this first** (see below). |
| Studio writes it without a tap | Yes | The `sample` contract allows a call "once at load with a prompt that is stable across loads". The prompt comes from the URL, so it's stable. The first call in a view still shows Claude's consent dialog. That's one tap the platform owns and we can't remove. |
| Compile check and repair round in the studio | Yes | The studio already has the renderer, and `generateEffect` already takes a `compile` callback. |
| Studio → app without a tap | No (most viewers) | Scripts in the artifact can't open windows or navigate the top page (see the comment on `sendLink` in `src/ui/project.js`). The return is a real link the viewer taps, like *Open in Surface Mapper* today. Possible extra, untested: `window.top.opener.postMessage(...)` back to the app's tab, which is reachable across origins unless claude.ai sends a strict `Cross-Origin-Opener-Policy`. Treat it as a bonus that works when it can. |
| App receives the effect | Yes | Same idea as `#import=` in `share.js`: a new `#fx=` fragment, much smaller than a project. The tab that opens can be a second app tab. It writes to the shared project storage and tells the original tab over a `BroadcastChannel` (same origin), then says "Added. Go back to your other tab." |

So the loop becomes: type the look → **Write it with Claude** → (Allow, first
time per view) → wait → **Add to Surface Mapper**. That's two taps where today
you rebuild the project in the studio or carry it there and back.

## Probe results (2026-10-21, Claude Android app)

A probe artifact printed what it received when opened with `#gen=hello` and
`?gen=hello`:

- **The URL doesn't reach the page.** The page loads from
  `<uuid>.frame.claudeusercontent.com/_f/<version>/`. Neither the fragment nor
  the query gets through, and the referrer is empty. On Android, claude.ai
  links open in the Claude app, so this is how most phone viewers would see it.
  The way in falls back to the clipboard (below).
- **`top.opener` is null**, so a return with no tap is out, at least here.
- **`sample` started as `prompt`**, so the first call shows Allow. Still to
  check: whether Allow is remembered on the next visit.

Second run, Chrome on Android (the web viewer):

- **The URL doesn't reach the page there either**, so this isn't specific to
  the Claude app.
- **Allow is remembered.** `sample` read `granted` at load on a later visit, so
  the Allow tap happens once, not on every round trip.
- **`navigator.clipboard.readText` is blocked** by the frame's permissions
  policy (`clipboard-read` not allowed). A *Paste* button can't work, but
  long-press → Paste into a text box does.
- **`localStorage` persists** in the frame across visits (the load counter
  reached 7). The studio can remember the last surfaces it was given.

**Revised way in:** *Write it with Claude* copies a compact packet (a
`SM1:` prefix and the gzipped request and context) to the clipboard, then opens
the studio. The studio opens on a focused paste box. When text starting with
`SM1:` lands in it, writing starts at once, with no Go button. That's a
long-press and Paste more than the plan above. The studio keeps the last
packet's surfaces in `localStorage`. Once it has seen them, you can type a new
look straight into the studio and skip the paste, until the surfaces change.

## What to test before building

1. **Does the fragment or query reach the page?** Publish a probe artifact that
   prints `location.href`. Open `https://claude.ai/artifact/<id>#gen=hello` and
   `…?gen=hello`, on desktop and on the phone (browser and installed app). If
   neither gets through, the request has no path in apart from the clipboard
   (the app copies it, the studio has a *Paste* button). That costs a tap but
   still works.
2. **Is consent remembered?** If every new view asks again, the Allow tap is
   part of every round trip. Check whether the studio asks again after a reload.
3. **Does `top.opener` survive?** Only worth checking if a zero-tap return
   matters. On the phone the installed app opens links in another browser
   context, so expect it to fail there.

## Shape of the build

- **Studio:** on load, `#gen=` switches the page to a small "writing" view:
  the request, progress, then a preview of the effect on a test surface, plus
  the *Add to Surface Mapper* link. No need to load the full editor. This could
  be its own small artifact (just `ai.js`, `renderer.js` and the effects kit). It
  would no longer have to be republished after every merge, only when the effect
  contract changes.
- **Refine before sending:** under the preview, a box for "warmer colours",
  "slower", "only pulse on the beat" and so on. Each note is another `sample`
  turn on the same conversation (the earlier reply plus the note), compiled and
  previewed again. A small history of versions lets you step back to one you
  liked. The studio could also show the GLSL for hand edits, recompiling as you
  type. Only the version on screen goes back to the app. The original request
  and the notes travel with it, so the app can show how the effect was made.
  `sample` is memoryless, so the studio resends the turns itself, just as the
  repair round in `generateEffect` already does.
- **App:** `generateEffect` gets a fourth backend, "hand off to the studio".
  The context the app sends is `describeSurfaces(...)`, which it already builds.
  It needs `share.js`-style encoding for `#gen=` and `#fx=` and a
  `BroadcastChannel('pm-fx')` listener.
- **Versioning:** put a version number in the `#gen=` payload. An app newer
  than the studio then gets a clear "update the studio" message instead of code
  that won't compile.
- **Limits:** the request and context are a few hundred bytes. An effect is
  usually 1–4 KB of GLSL, under 2 KB gzipped. That's far below URL limits.

## Future variant: a writer that doesn't know the scene

Not built; the writer as it stands (previewing on the real surfaces) is
what's wanted for now. Recorded in case the paste step becomes the thing to
remove.

The writer would build a look with no knowledge of the user's surfaces. It
would preview on a generic stand-in (a few boxes, a frame-wide canvas) and send
back only the effect and the description. The app would then decide where it
goes: the selected surface, every surface, or a composition rectangle spread
across several (`s.input`, see `inputRect` in `geometry.js`).

What it would save: nothing to copy or paste. The writer remembers where to
send the effect back, and the request is typed in the writer itself. *Write it
with Claude* would only open the writer.

What it would cost:
- **The preview stops matching the result.** Looks that use `s.edge`, `s.uv`
  on an odd shape, `s.id` or `s.count`, or flow across surfaces with
  `s.screen`, depend on the real layout. The model also tailors a look to the
  surfaces it's told about (`describeSurfaces`), so without them it would write
  something more generic.
- **Needs its own prompt.** The current one (`SYSTEM` in `ai.js`) assumes
  real surfaces; this variant would ask for a look that works on any shape.
- **Placement moves to the app.** After the effect arrives, the app needs an
  obvious way to say where it goes, since the writer can't.

A middle path, if the paste is the only annoyance: let the writer keep the last
surfaces it was given (it already does) and start from "describe a look" when
it has them, with the paste link secondary. The preview stays scene-aware, and
a paste is only needed after the surfaces change. Neither the writer nor the
app can tell the other that they have changed, because the two pages can't
talk to each other (see *Probe results*).
