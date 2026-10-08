# Hardware: projectors, phones and what to expect

## The physics that decides everything

A projector's light is spread over the image. Make the image bigger and every
part of it gets dimmer, in proportion to the area. Brightness on the surface:

- **Illuminance** (lux) = lumens / image area (m²)
- **Brightness you see** (nits) ≈ lux × surface reflectance / π

For reference, a cinema screen is about 48 nits, and a TV is 200–500 nits.

## What a ~$30 "mini" projector really is

- **Brightness:** the box usually says something like "9,000 lumens". That is
  not ANSI lumens, the standard measurement (ISO 21118). Real output for this
  class is typically somewhere around 50–200 ANSI lumens.
- **Resolution:** often 480p or 720p native, even when the box says "1080p
  supported". That means it accepts 1080p and scales it down.
- **Lens:** a single-panel LCD with a fixed lens and manual focus. No zoom, no
  lens shift, often a digital keystone, and modest contrast.
- **"Up to 120 inches":** the largest size the lens can focus. It says nothing
  about how bright that image will be.

### Indoors (dark room)

Plenty for learning and for small pieces: boxes on a table, a shelf, a
sculpture, a 40–80" area of wall. At 60" (about 1 m²) and 100 ANSI lumens you
get about 100 lux, roughly 30 nits on a white surface: clearly visible in a
dark room. This is the right setup for trying the app.

### In the yard, aimed at the house

**A whole 120" image:** 120" at 16:9 is 2.66 × 1.49 m, about 4 m². With 100 real
lumens that's about 25 lux. Light siding reflects roughly half, so about
**4 nits**, around a tenth of a cinema screen. You'll see it in full darkness
with porch lights and streetlights off, but it will look faint and washed out.
Colours will be weak, and it vanishes in twilight.

**The whole façade:** for, say, 10 × 5 m, the same light spreads over 50 m²,
which is **under half a nit**. Barely visible.

**Distance:** cheap projectors have a throw ratio around 1.2–1.5 (distance ÷
image width). A 2.7 m-wide image needs it about 3.5–4 m away, and a 10 m façade
would need about 14 m. That's also beyond what many of these lenses will focus.

**What works with a $30 projector outside:** pick *one* feature and keep the
image small. A front door, a garage door, a window, a tree trunk. A classic
trick for windows: hang a white sheet or rear-projection film inside the glass.
Glass itself shows nothing, because light passes straight through.

### For the whole front of a house

Use a **used business projector**: office or classroom models from Epson, BenQ,
Optoma and others. They're rated at 3,000–4,000 real ANSI lumens, have HDMI,
and often sell second-hand for roughly $80–200; check the lamp hours. That's
20–40× the light of a $30 mini projector. Over 50 m² that's still only 5–10
nits, fine at night but not dazzling. Professional building projections use
10,000–30,000 lumens, often from several projectors.

## Projector features, by importance

**Must have**
- **HDMI input.** Wireless mirroring alone works, but it lags 100–300 ms and
  compresses the image.
- **Real brightness for the job:** ANSI or ISO 21118 lumens. Ignore
  "LED lumens" and "lux" marketing numbers.
- **Manual focus**, with a sharp image at the distance you need.
- **Keystone correction that can be turned off, including auto-keystone.** The
  app does the geometric correction itself. The projector's keystone resamples
  the image (softer, lower resolution) and auto-keystone can move it after
  you've mapped, which ruins the alignment. Also turn off overscan or "zoom"
  (use "native" or "just scan") so the phone's frame maps 1:1.

**Worth having**
- **Native 720p or better** (1080p ideal). Fine detail and clean edges on
  surfaces.
- **Optical zoom:** size the image without moving the projector.
- **Lens shift:** move the image without tilting the projector, keeping the full
  resolution.
- **Good contrast and black level.** Projectors can't show black; the dark area
  around your surfaces glows grey. DLP usually beats cheap LCD here. Effects
  with black backgrounds help either way.
- **Short throw** (indoors): it can sit close, so people walking by cast fewer
  shadows.
- **Audio out** (3.5 mm): send the phone's HDMI sound to a proper speaker.
- **Quiet fan.**

**Nice for later**
- An Android TV / Google TV projector can run the app in its own browser
  (roadmap #15).
- A laser light source: instant on, stable brightness, and no lamp to replace.

## Phone requirements

- **Video out over USB-C (DisplayPort Alt Mode),** or a Lightning AV adapter on
  older iPhones. iPhone 15 and later support it over USB-C. Many flagship
  Android phones do, but plenty of budget and older models don't. Check before
  buying an adapter.
- **An adapter with charging passthrough (USB-C PD),** so the phone can run a
  long show.
- WebGL2 support: any recent iPhone or Android phone has it.
- Your phone screen is wider than the projector (about 19.5:9 vs 16:9), so the
  mirrored image will have bars and use a little less than the full projector
  frame. That's fine for mapping.

## Outdoor practicalities

- **Don't let anything move.** A bump moves every surface. Use a tripod or a
  solid mount, and weigh it down. *Project → Export file* keeps a backup, and
  the nudge controls help re-align.
- **Dew and rain:** keep the projector under cover and off the wet grass.
  Electronics plus overnight dew is a common failure.
- **Power:** an outdoor-rated extension cord. Keep the phone plugged in through
  the adapter.
- **Ambient light:** turn off porch lights and anything aimed at the house.
  Every bit of ambient light lifts the grey "black" glow and washes out colour.
- **Surfaces:** light, matte siding works best. Dark brick or wood absorbs most
  of the light.
- **Be a good neighbour:** keep the beam off the street and off neighbours'
  windows, and keep people from looking into the lens. Placing the projector
  high helps.
