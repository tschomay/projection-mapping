# Getting the picture from the phone to the projector

How Surface Mapper reaches the projector, which path to use by default, and what
has been checked so far (roadmap #2). The in-app version of this is the
*How to connect* sheet (*Tools → Project*, and opened by itself on first run).

## The default: mirror the phone, wired

The phone screen *is* the projector frame. Mapping on it needs no calibration,
and the projected handles land on the real object as you drag them. A cable is
the default because it has no lag, no compression, and carries sound to the
projector over HDMI.

| Phone | Adapter |
|---|---|
| iPhone 15 and later (USB-C) | USB-C to HDMI adapter, or Apple's USB-C Digital AV Multiport adapter |
| iPhone 14 and earlier (Lightning) | Apple Lightning Digital AV adapter |
| Android with DisplayPort Alt Mode over USB-C | USB-C to HDMI adapter (with USB-C PD passthrough for charging) |
| Android without video out | No wired path: use wireless mirroring or the second screen below |

## All the paths

| Path | How | Lag | Controls projected? | Sound | Status in the app |
|---|---|---|---|---|---|
| Wired mirroring | USB-C or Lightning to HDMI | none noticeable | yes, until *Show* | over HDMI | Default. Show mode hides every overlay |
| Wireless mirroring | Android *Cast* / *Screen cast*; iPhone *Screen Mirroring* (AirPlay) | 100–300 ms | yes, until *Show* | over the cast | Works with no app changes |
| Second screen, web | *Present to a screen* (Presentation API, Chrome) to a Chromecast, a cast-capable projector, or a display Chrome can present to | depends on the receiver | no | from the receiver | Built, see below |
| Laptop second display | *Open output window* | none | no | from the output window | Built; Chrome places the window on the projector when allowed |
| Second screen, native | Android `Presentation` / iOS external display scenes | none | no | either | Needs a native wrapper (Capacitor); not started |
| Projector's own browser | The app runs on an Android TV / Google TV projector | none | no | from the projector | Roadmap #15 |

## Show mode when mirroring

Everything on the phone screen is projected while mirroring, so Show mode is
what the audience sees:

- Every control, outline and handle is hidden; the cursor is hidden on laptops.
- The "double-tap to go back" hint is shown only until you've left Show mode
  once, so it isn't projected at every show.
- Black outside the frame. A phone is wider than a projector (about 19.5:9
  against 16:9), so there are thin black bars at the sides.
- The screen is kept awake (Wake Lock API), and the app goes full screen where
  the browser allows. On phones it also locks to landscape where the browser
  allows it (Chrome on Android when full screen; iOS ignores the lock, so turn
  on the rotation lock there).
- Turn on Do Not Disturb so notifications don't appear on the projection.

## Second screen through the Presentation API

*Tools → Project → Present to a screen* uses the
[Presentation API](https://www.w3.org/TR/presentation-api/). Chrome lists the
screens it can reach (Cast devices on the same Wi-Fi, and displays it can
present to) and loads the app's `#output` page there. That page is the same
renderer as the laptop output window; the phone keeps editing and nothing on it
is projected.

How it's wired (`app/src/link.js`):

- The receiver sends `hello` with its aspect ratio every second. The editor
  reshapes its frame to match, so what you map is what the screen shows.
- The editor sends the project and the transport (play, pause, time) as JSON.
- The receiver may be another device, where the editor's object URLs mean
  nothing. When a video or image fails to open there, the receiver asks for it
  and the editor sends the file in 64 KB binary chunks. A large video takes a
  while over Wi-Fi; the app says when it's sending.
- Sound plays from the receiver; the phone goes silent, as with the output
  window.
- Reloading the editor reconnects to a running presentation.

The button is hidden where the API is missing (Safari, Firefox) and disabled
while Chrome sees no screen.

## Tested so far

Checked headless in Chromium only; nothing below has been tried on real
hardware yet. Fill in this table as combinations are tried.

| Phone / computer | Browser | Path | Projector or receiver | Result |
|---|---|---|---|---|
| (headless Chromium, phone-sized viewport) | Chromium | Second screen, simulated receiver in a separate browser context | n/a | Project, live edits, aspect and an image file all reach the receiver |
| (headless Chromium) | Chromium | Laptop output window | n/a | Covered by the MVP checks in roadmap #1 |
| | | Wired mirroring | | not yet tried |
| | | Wireless mirroring | | not yet tried |
| | Chrome on Android | Second screen to a Chromecast | | not yet tried |

## Open questions

- Whether Chrome on Android still offers Presentation API sessions to Cast
  devices for arbitrary pages, or only tab casting; the API's support has
  narrowed over the years. If it doesn't, the native wrapper is the second-screen
  path on phones.
- Receivers with little memory (older Chromecasts) and large videos. Streaming
  the file instead of copying it whole may be needed.
