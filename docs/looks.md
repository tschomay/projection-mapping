# The looks library

The built-in looks in Surface Mapper's *Looks* tray, what's planned next, and
how to add one. The code is in `app/src/effects.js` (Basics, Music, Ambient)
and `app/src/effects/<group>.js` (seasonal sets). Issue #42 added the settings
and the bigger library.

## What's there

41 looks in six groups. ♪ means it moves to music. ⇆ means it flows from one
surface to the next (on a single surface, *Whole scene here* fits the whole
scene on it).

Most looks have **settings**: a colour, a speed, how many, or parts to switch
off (the haunted window's walker, hand and blackout). They're in the *Looks*
tray, above the search, for the selected surface, or with *All* for every
surface showing that look. Each surface keeps its own, and cues capture them.

### Halloween (20)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Bats ⇆ ♪ | `bats` | a few doors side by side | Silhouettes in front of an orange moonlit haze. |
| Glowing eyes ♪ | `eyes` | inside a cupboard, under a table | Pairs of eyes open, look around and blink. |
| Ghostly fog ⇆ ♪ | `fog` | anything low | Pale green fog, thicker at the bottom. |
| Lightning ⇆ ♪ | `lightning` | a wall or a window blind | Double flashes, on the beat with music. |
| Candle glow | `candle` | anything | Warm flicker from below. |
| Jack-o'-lantern ♪ | `pumpkin` | **a circle traced on a real pumpkin** | A carved, candlelit face; each surface gets a different one. With music the mouth sings. |
| Haunted window | `window` | **a rectangle on a window or blind** | Warm room light. Someone walks past, a hand presses on the glass, the light goes out. |
| Drifting ghosts ⇆ | `ghosts` | a wall, several surfaces | Sheet ghosts float through, fading in and out. |
| Witch across the moon ⇆ | `witch` | a garage door, a wall | A big moon. Every 11 s or so a witch flies past it. |
| Spider drop | `spider` | a door, a cabinet | A web in a top corner. A spider drops on its thread, bobs, climbs back. |
| Peeking skull | `peek` | a door or doorway | A skull leans in from the side, eyes glowing, and ducks out. |
| Dripping blood | `blood` | the top of a door or mirror | Drips grow and run down from the top edge. |
| Oozing slime | `slime` | likewise | The same in glowing green, slower. |
| Electric arcs ♪ | `arcs` | **any shape**, a "lab" | Sparks crackle along the outline. More on the beat. |
| Breaking through ♪ | `cracks` | a door | Cracks spread with firelight behind. Each hit (or beat) jolts it. |
| Flashlight search ⇆ | `flashlight` | a wall, a whole house front | A torch beam wanders. Handprints and claw marks show only in it. |
| Haunted TV | `static` | a box, a frame, a TV-sized thing | Snow and a rolling bar. Now and then a face shows through. |
| Pulsing veins ♪ | `veins` | a door, a pillar | Veins throb with a heartbeat that runs outwards, or with the beat. |
| Hellfire ♪ | `hellfire` | a doorway, a fireplace | Tall red flames from the bottom edge, surging on the beat. |
| Jump scare | `scare` | anything; best as a cue | Nearly dark, then a skull flashes up. |

### Fall (8)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Falling leaves ⇆ | `leaves` | a wall, several surfaces | Maple and birch leaves tumble down in red, orange and gold. |
| Harvest moon ⇆ | `moonrise` | a wall | A big orange moon rises over hills in 90 s, clouds drifting across. |
| Sunlight through leaves ⇆ | `dapple` | an indoor wall | Warm dappled light swaying in a breeze. |
| Rain on the window | `rain` | a window blind | Still drops, and bigger ones sliding down with a trail. |
| Embers rising ⇆ | `embers` | a wall, above a fire pit | Sparks rise, wander and go out. |
| Geese flying south ⇆ | `geese` | a wall | A dusk sky with a V of geese crossing every 16 s. |
| Wheat field ⇆ | `wheat` | a wide wall | A golden field with gusts of wind running through it. |
| Fireplace | `fireplace` | a fireplace, a box | Low flames on glowing coals, sparks drifting up. |

### Christmas (4)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Snow ⇆ | `snow` | a wall, a window, several surfaces | Soft flakes in three layers, blown by a wind you set. |
| Twinkle lights ♪ | `twinkle` | **any shape**: a door, a wreath, a window | Bulbs round the outline in four colour sets; more light on the beat. |
| Candy stripes | `candy` | a pillar, a door frame | Turning red and white stripes; colour, width and speed. |
| Northern lights ⇆ | `aurora` | a wall, a garage door | Green and violet curtains over a starry sky. |

## Next

- **More Christmas**: ornaments, a fireplace with stockings, a sleigh across
  the moon (the witch's path).
- **VJ**: tunnels, kaleidoscopic fields, neon outlines, gradients.
- **More Halloween**: claws peeking round an edge, a web that spins itself,
  tombstones in the fog, a skeleton that dances to the beat, a drop that falls
  off the end of a drip.

Lazy Lighting, the phone app to match, lists "45+ Halloween visuals". AtmosFX's
filmed characters (ghost brides, haunted portraits) are better as videos than
as code, so they come in through *＋ Video or image*.

## What works on a real object

- **Projected light only adds.** Black is "off": the real object shows through
  wherever a look is dark. Bold, bright shapes on black read from across a yard.
  Fine detail and dark-on-dark don't, especially on a cheap projector.
- **Silhouettes need light behind them.** A bat or a witch is a dark shape, so
  it needs a lit sky or haze around it (*Bats*, *Witch*, *Spider*).
- **Fit the object.** `s.uv` runs between the surface's corner pins, so a face
  drawn in it lands on the pumpkin and a figure lands in the window. `s.screen`
  (or `k_frame`) runs across the whole frame, for things that fly from one
  surface to the next.
- **Move without music.** Check `uHasAudio`, or use `k_pulse` and `k_level`,
  which make up a beat when nothing is playing.
- **Look different on each surface.** Seed with `s.id`, so two pumpkins don't
  pull the same face at the same moment.
- **Phones draw these.** Keep loops short (about 16 at most, with something
  cheap inside), use `fbm` sparingly, and don't raymarch.

## Adding a look

1. **Pick the file.** For a seasonal set, use `app/src/effects/<group>.js`,
   exporting an array that `effects.js` spreads into `EFFECTS`. For a new
   group, add it to `LOOK_GROUPS` in `effects.js` too; that's also the tray's
   order. Otherwise, use `effects.js` itself.
2. **Write it** from this template:

   ```js
   { id: 'mylook', name: 'My look', group: 'Halloween', about: 'One sentence for the tray: what you see.', code: `
   float mylook_shape(vec2 p) {
     // helpers are named <id>_something, so they can't clash with another look's
     return k_circle(p, 0.3);
   }
   vec3 fx_mylook(Surf2 s, float t) {
     vec2 p = k_centred(s);                       // or k_square(s), or k_frame(s) to flow across surfaces
     float d = mylook_shape(p);
     return vec3(1.0, 0.5, 0.1) * (k_fill(d, 0.005) + 0.4 * k_glow(d, 0.05));
   }` },
   ```

   **Settings** are globals with a default and a `// param:` comment, named
   `<id>_something`. The code reads them and never assigns them:

   ```glsl
   vec3 mylook_colour = vec3(1.0, 0.5, 0.1); // param: Colour
   float mylook_speed = 1.0;                 // param: Speed, 0.2..3
   float mylook_count = 6.0;                 // param: How many, 1..12, whole
   bool mylook_glow = true;                  // param: Glow, toggle
   int mylook_shape = 0;                     // param: Shape, choice: Round=0|Square=1
   ```

   The tray shows a control for each (up to 8). A look runs as it is with the
   defaults: in the previews, and in ISF hosts, which get the settings as
   inputs. For a "how many", loop to the most and break:
   `if (float(i) >= mylook_count) break;`. Format: `app/src/params.js`.

   A look's code has to stand alone, because the renderer compiles only the
   looks in use. To share code between looks, write it in
   `app/src/effects/families.js`:
   - A whole family of looks from a few settings: `fireLook`, `dripLook`.
   - A part that returns a helper named for the look using it: `skull('peek')`
     defines `peek_skull`, and `hand('window')` defines `window_hand`.
3. **Look at it.** `node tools/looks.mjs mylook` writes `looks.png`, the look
   at 2, 5 and 9 seconds. It takes these options:
   - `--times 1,3,6` to choose the moments.
   - `--music` for a pretend 120 bpm song.
   - `--circle` for a round surface.
   - `--group Fall` for a whole group.

   It needs the tests' Playwright (`npm install` in `tests/`). In the app, the
   tray's preview tile shows it live.
4. **Check it.** `node tools/sw.mjs` if you added a file. Then
   `cd tests && node run.mjs --quick`, which runs `effects.test.mjs`: ids,
   groups, unique helper and setting names, settings that parse, no ES
   3.00-only code. Then
   `node run.mjs --only isf.e2e`, which compiles each look as ISF (GLSL ES
   1.00) and all of them together in the app.

### The kit

Every look can use these (`app/src/effects/kit.js`), as can AI-written effects,
whose prompt lists them, and exported ISF files. Distances are signed:
negative inside.

| Function | What it gives |
|---|---|
| `k_centred(s)`, `k_square(s)`, `k_frame(s)` | Square-unit coordinates: centred on the surface; from its bottom-left; across the whole frame |
| `k_rot(a)` | A rotation matrix: `p * k_rot(a)` |
| `k_circle`, `k_box`, `k_oval`, `k_seg`, `k_tri` | Distances to a circle, box, ellipse, segment (minus a radius for a capsule) and triangle |
| `k_smin(a, b, k)` | A smooth union, for shapes that melt together |
| `k_fill(d, w)`, `k_glow(d, w)` | Inside a shape (soft edge), and a glow around it |
| `k_rim(s, w)` | A bright rim along the surface's real outline |
| `k_flicker(t, seed)` | Candle flicker, about 0.7 to 1.05 |
| `k_pulse(t, bpm)`, `k_level(t)` | The beat and the loudness, made up when nothing is playing |
| `k_now_and_then(t, period, odds, seed)` | Events: seconds since one started, or -1 |
| `k_drift(q, vel, cell, t, seed)` | Many things drifting, one per cell: leaves, embers, stars, drops |
| `k_fire(x)` | Fire colours for heat 0 to 1 |

Kit functions start with `k_`, and the effects check keeps that prefix for
the kit. A new kit function needs a one-line comment above it, because that
comment is how the AI prompt describes it.
