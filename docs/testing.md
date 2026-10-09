# What to test on real hardware

Everything below has only been checked in headless Chromium, with simulated
cameras, projectors and second screens. This list is what needs a real phone,
TV, projector or API key. It's grouped by what you need on hand, so you can
start now and finish when the projector arrives.

Open the app at https://surface-mapper-alpha.vercel.app (or the Vercel preview
for a branch). When something fails, note the phone, browser and what you saw
in the issue listed, or paste the *Check this device* report there.

## Phone only (now)

### Device check (*Tools → Project → Check this device*)
- [ ] Run it and tap *Test the camera*. *Copy report* and paste it into #2.
- [ ] Does **Exposure lock** say yes? (Chrome on Android usually does; iPhone
      Safari usually doesn't. Capture still works without it, with more
      chance of failing in a bright room.)
- [ ] Does **Video formats** show H.264? Your own videos need it.
- [ ] **Storage kept**: tap *Keep my files* and check it switches to yes.
- [ ] **Frame rate** with a few surfaces showing Plasma: 50+ fps is good,
      under 30 means effects need to get lighter on this phone.

### Install and basics (#11)
- [ ] Add to Home Screen, open it: full screen, landscape, no browser bars.
- [ ] Add a square, circle and triangle; drag corners, use the nudge pad.
- [ ] *Points*: add, move and delete outline points. *Combine*: cut a hole.
- [ ] *Show*: everything but the content disappears; the screen doesn't dim
      or lock after a few minutes; double-tap brings the editor back.
- [ ] Reload: the mapping is exactly as it was.
- [ ] *Export file*, then *Import file* on another device (#14).

### Media and sound (#12, #13)
- [ ] Add a video from the gallery to a surface. Play: it's in perspective on
      the surface. On iPhone, does it play inline (not full screen)?
- [ ] *One image across all* over two surfaces: continuous across them.
- [ ] Sound: pick the video's own sound, or add an audio file; Play.
- [ ] Music with a clear beat: *Beat sequence* and *Pulse to music* follow it;
      the meter's beat dot flashes on the beat. Try *React to the microphone*
      with music playing from another device.
- [ ] A long video (several hundred MB): does it still save and come back
      after a reload? (IndexedDB limits on phones, #14.)

### Cues (#8)
- [ ] Set up three looks, *Add cue from the current look* after each.
- [ ] In Show mode, single taps step through them, with crossfade, cut and
      wipe.
- [ ] Put the cues at times in a song (*At a time in the song*, *Now*),
      press Play: they change on time, and again after the song loops.
- [ ] A cue set to *After the previous, beats* with real music: does it come
      in on the beat count you set? (#13, #21)
- [ ] Reload: cues and any media used only in a cue are still there.

### AI effects (#9; needs an Anthropic API key)
- [ ] *Content → Describe a look*, paste your key, *Save key*.
- [ ] Describe a look; within about a minute an effect appears marked ✦ and
      shows on the surfaces. Try one that should follow the beat.
- [ ] Try something heavy ("lots of swirling particles"): if the phone
      can't keep up, the previous look should come back on its own.
- [ ] *Export file*: the file has no key in it. *Forget my key* removes it.
- [ ] Note in #9 roughly how long each took and whether any failed to compile.

### Bend and soften (#6)
- [ ] *Bend* on a surface, drag grid points: smooth, no visible seams, and it
      doesn't stutter while dragging on the phone.
- [ ] *Soft edge*: the outline fades.

### Design on a photo
- [ ] *Project → Design on a photo* with a photo of your set taken from
      where the projector will stand. Trace surfaces on it, try content and
      cues; it should look like light on the photo.
- [ ] Turn the photo off before connecting to a projector (it's projected
      too when mirroring).

## With a TV or monitor (before the projector)

See `docs/connecting.md` → *Rehearsing without a projector*.

### Connecting (#2)
- [ ] **Cable**: USB-C (or Lightning) to HDMI into the TV. If nothing shows,
      the phone has no video out: note the model in #2 before buying a
      projector adapter.
- [ ] **Wireless mirroring**: Cast / Screen Mirroring to a Chromecast, Google
      TV or Apple TV. Drag a corner: how far behind is the TV? Does sound
      play from the TV?
- [ ] **Second screen** (Chrome on Android + Chromecast): *Project → Present
      to a screen*. Does the button appear and find the Chromecast? Does
      only the output show on the TV while the phone keeps its controls?
      Add a short video: it's copied to the TV (a progress message shows),
      then plays with sound.
- [ ] **Laptop**: TV as a second display, *Open output window*. In Chrome,
      after allowing window placement, it should open on the TV by itself.
- [ ] Show mode while mirroring: nothing but content reaches the TV, black
      bars at the sides, and the screen stays awake. Turn on Do Not Disturb.
- [ ] Fill in the tested-combinations table in `docs/connecting.md`.

### Camera capture against the TV (#3)
- [ ] Mirror the phone to the TV, prop the phone so its back camera sees the
      TV from the side, *Find surfaces with the camera*, tick *Keep wall and
      floor*, Start.
- [ ] Expected: one surface with its corners on the TV picture's corners (it
      will also warn that almost everything is one plane, which is right
      here). Note the "Projection lag" it reports.
- [ ] Repeat once with the room lights on, to see when it refuses.

## With the projector

### First mapping (#11, #2)
- [ ] Turn off keystone, auto-keystone and overscan on the projector.
- [ ] Mirror the phone (cable first). Map three real surfaces by hand, switch
      to Show, leave it running for 30 minutes: no drift, no sleep.
- [ ] Compare a photo of the result with the *Design on a photo* version.

### Camera capture on a real set (#3)
- [ ] A few boxes against a wall, room dark. Phone on a stand 30 cm–1 m to
      the side of the projector. *Find surfaces with the camera*.
- [ ] Goal from #3: surfaces cover at least 85% of the box faces. Note how
      many faces were found, how many corners needed fixing, and the
      reported lag and coverage.
- [ ] Try the camera picker if the phone has several back cameras: the main
      (not ultra-wide) camera should do better.

### Everything together
- [ ] A three-cue show with a song, on real objects, from Show mode.
- [ ] Bend a surface onto something curved (a bowl, fabric, a column) and
      soften its edge.
- [ ] An AI-written effect on the real set.

## Not for you to test

- The 2D-to-3D solve (#5) is only in the sandbox (`sim/index.html`) so far.
  `tests/bench/solve.bench.mjs` measures it.
- The automated checks in `tests/` run on every push; you don't need to run
  them, but `cd tests && npm install && npm test` works on a laptop.
