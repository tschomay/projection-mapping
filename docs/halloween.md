# One-night setup: bats on a kitchen cabinet

For a party, not a show: one or two flat things to light (a cabinet door, a
fridge, a window blind), a phone, a projector, and about 15 minutes. You don't
need an API key or any AI for this; the Halloween effects are built in.

## What you need

- A phone (or laptop) with Chrome or Safari.
- A projector, and a cable from the phone to it (USB-C to HDMI, or a Lightning
  AV adapter for iPhone). Casting works too, with a little lag.
- Something to stand the projector on, pointed at the cabinet. Turn off its
  keystone and auto-keystone; the app does the straightening.
- A dark-ish room. Projected light only adds, so black stays "off": the
  cabinet stays as it is wherever there's no effect.

## Steps

1. **Open the app** at https://surface-mapper-alpha.vercel.app on the phone.
   *Add to Home Screen* so it opens full screen with no browser bars.
2. **Connect the projector** (cable first; the *Connect* guide in the app
   shows the options). Hold the phone in landscape. The phone screen is now
   the projector picture.
3. **Trace the cabinet door.** *Tools → Surfaces → Square*. Drag the square
   onto the door as it appears on the wall, then drag each corner onto a
   corner of the door. The checkerboard shows when it's lined up; use the
   nudge pad for the last few millimetres. Add a second square for a second
   door, or a circle for a round thing like a pumpkin.
4. **Pick the look.** *Tools → Content → Halloween*:
   - **Bats**: silhouettes flapping across an orange moonlit haze. They fly
     from one surface to the next, so two doors side by side read as one sky.
   - **Glowing eyes**: pairs of eyes open in the dark, look around, blink.
     Good inside a dark cupboard or under a table.
   - **Ghostly fog**: pale green fog rolling across.
   - **Lightning**: a dark storm with a flash and a bolt every few seconds.
   - **Candle glow**: warm flicker from below.
   Pick a surface first to give it its own look, or no surface to set all.
5. **Sound (optional).** *Tools → Sound*: add a spooky track, tap *Play*,
   and Lightning flashes on the beat instead of at random.
6. **Show.** Tap *Show*. Everything but the effect disappears and the screen
   stays awake. Double-tap to get the editor back.

To switch looks during the party without touching the editor, set up two or
three looks as cues (*Tools → Show → Add cue from the current look*), then a
tap in Show mode steps to the next one.

## Want a look that isn't there?

*Content → Describe a look* has an AI model write a new effect for your
surfaces ("green slime dripping down from the top edge", "a jack-o'-lantern
face that flickers"). Two ways to pay for it:

- **Your Claude plan, no key:** open the [Surface Mapper studio](https://claude.ai/artifact/QDTC5ZPeQj6U5AHwMxJieL)
  in Claude, describe the look there, and tap *Project → Open in Surface
  Mapper* when you're happy. The project (surfaces, effects, cues) opens in
  the app on the same phone. The studio can't use the camera or go full
  screen, so the show itself runs in the app.
- **A Gemini API key:** paste a key from
  [Google AI Studio](https://aistudio.google.com/apikey) under *Describe a
  look*. An effect uses roughly 1,500 tokens in and 2,000 to 8,000 out
  (mostly the model thinking), about 1 to 3 cents on Gemini 3.8 Flash, and
  the free tier usually covers a few. An Anthropic key works the same way.

## If something's off

- **Picture is a trapezoid:** keystone is still on in the projector, or the
  phone is in portrait.
- **Edges spill past the door:** select the surface and use the nudge pad on
  each corner; *Soft edge* in *Surfaces* hides small errors.
- **Phone dims or locks:** stay in Show mode; it keeps the screen awake. Turn
  on Do Not Disturb so notifications don't appear on the cabinet.
