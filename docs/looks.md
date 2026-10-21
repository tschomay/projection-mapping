# The looks library

The built-in looks in Surface Mapper's *Looks* tray, what's planned next, and
how to add one. The code is in `app/src/effects.js` (Basics, Music, Ambient)
and `app/src/effects/<group>.js` (the Music, Ambient and Celebrations sets and the seasonal sets). Issue #42 added the settings
and the bigger library.

## What's there

41 looks in six groups. ♪ means it moves to music. ⇆ means it flows from one
surface to the next (on a single surface, *Whole scene here* fits the whole
scene on it).

Most looks have **settings**: a colour, a speed, how many, or parts to switch
off (the haunted window's walker, hand and blackout). They're in the *Looks*
tray, above the search, for the selected surface, or with *All* for every
surface showing that look. Each surface keeps its own, and cues capture them.

### Music (27)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Beat sequence ♪ | `sequence` | several surfaces | Surfaces flash one after another, on the beat when music plays. |
| Pulse to music ♪ | `pulse` | anything | Bass fills the surface from its centre; treble sparkles along the edge. |
| Tiles ♪ | `tiles` | a wall, a door | Tiles sized to each surface switch on and off, flipping on the beat. |
| Tunnel ♪ | `tunnel` | a wall, a doorway | Rings rush towards you down an endless tunnel, flashing on the beat. |
| Kaleidoscope ♪ | `kaleido` | a wall, **a circle** | Flowing colours folded through mirrors into a turning kaleidoscope, brighter on the beat. |
| Neon ♪ | `neon` | **any shape**: a door, a window, a sign | Two neon tubes follow the outline, humming, flickering now and then, glowing brighter on the beat. |
| Colour wash ⇆ ♪ | `gradient` | several surfaces, a wall | Slow, smooth bands of colour drift across the whole frame, from one surface to the next. |
| Strobe ♪ | `strobe` | anything; best as a cue | A short flash on every beat, or a few times a second without music. Kept to three flashes a second or fewer. |
| Equaliser ♪ | `bars` | a wide wall, a box | LED bars jump with the music: bass on the left, treble on the right. |
| Ripples ♪ | `rings` | a wall, **a circle** | A ring of light leaves the middle on every beat and spreads out, fading. |
| Lasers ⇆ ♪ | `lasers` | a wall, a whole house front | Laser beams fan out from the bottom corners and sweep across the frame through a haze. |
| Glitch ♪ | `glitch` | a box, a TV-sized thing | A test card breaks up: slices slide, the colours split apart and blocks flash, more on the beat. |
| Hyperspace ♪ | `hyperspace` | a wall, a doorway | Stars stream out from the middle as streaks, as if jumping to light speed. Brighter on the beat. |
| Moiré ♪ | `moire` | a wall | Two sets of fine rings drift over each other, and big slow shapes swim where they cross. |
| Cells ⇆ ♪ | `cells` | a wall, several surfaces | Wobbling cells with glowing walls across the whole frame; a few light up on every beat. |
| Oscilloscope ♪ | `scope` | a box, a screen-shaped thing | A glowing green trace over a grid, its waves made from the bass, mids and treble. |
| Mirror ball ⇆ ♪ | `disco` | a wall, a ceiling, a whole room | A mirror ball's spots of light wheel slowly across the whole frame, twinkling, flashing on the beat. |
| Triangles ⇆ ♪ | `tris` | a wall, several surfaces | A grid of triangles across the frame, flipping on and off with the beat. |
| Synthwave ⇆ ♪ | `synthwave` | a wide wall, a garage door | A striped sunset sun over a neon grid racing towards you, across the whole frame. The grid pulses on the beat. |
| Fractal ♪ | `julia` | a wall | A Julia set fractal slowly changes shape, its colours flowing. |
| Spiral ♪ | `spiral` | a wall, **a circle** | A hypnotic spiral turning in or out, pulsing on the beat. |
| Hexagons ⇆ ♪ | `hexes` | a wall, several surfaces | A honeycomb across the frame; a wave of light runs out through it from the middle on every beat. |
| Halftone ⇆ ♪ | `halftone` | a wall, several surfaces | A grid of dots across the frame that swell and shrink in slow waves, bigger on the beat. |
| Sunburst ♪ | `sunburst` | a wall, **a circle** | Rays of two colours turning round the middle, pulsing on the beat. |
| Beat wave ⇆ ♪ | `beatwave` | several surfaces side by side | Each beat sends a band of light across the frame from left to right, through one surface after another. |
| Digital rain ♪ | `matrix` | a wall, a door | Columns of glowing green characters stream down, each with a bright head. |
| Op art | `opart` | a wall, a pillar | Black and white stripes bent by a slowly wandering bulge, so the surface seems to swell. |

### Ambient (16)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Screen sweep ⇆ ♪ | `sweep` | several surfaces side by side | A bright line sweeps across the whole frame, from one surface to the next. |
| Outline trace ♪ | `trace` | **any shape** | A light runs around the outline of each surface. |
| Plasma ⇆ ♪ | `plasma` | a wall, several surfaces | Slow, flowing colour across the whole frame. |
| Starry night ⇆ | `starry` | a wall, a ceiling | A deep sky of twinkling stars and the Milky Way across the frame, with now and then a shooting star. |
| Pool light ⇆ | `caustics` | a wall, a ceiling, under a deck | The shifting web of light that sun through rippling water throws on the bottom of a pool. |
| Fish tank | `aquarium` | a box, a window, a wall | Bright tropical fish swim back and forth past swaying weed, with bubbles rising and light from above. |
| Lava lamp | `lavalamp` | a tall narrow surface, a pillar | Blobs of warm wax rise, fall and melt into each other in glowing liquid. |
| Drifting clouds ⇆ | `clouds` | a wall, a ceiling | Clouds drift slowly across a day, sunset or night sky, from one surface to the next. |
| Fireflies ⇆ | `fireflies` | a garden wall, a hedge | Fireflies wander and blink over dark grass on a summer night. |
| Rain on a puddle | `puddle` | the ground, a path, a table top | Raindrops land on dark water, each sending out a ring of ripples. |
| Sunset ⇆ | `sunset` | a wide wall | The sun sinks into the sea over a few minutes, the sky turning gold, then red, then dusk, and starts again. |
| Nebula ⇆ | `nebula` | a wall, a ceiling | Clouds of coloured gas churn slowly among the stars, across the whole frame. |
| Slow breath | `breathe` | a bedroom wall, anything | A soft glow that swells and fades like slow breathing, its colour drifting. Calming. |
| Bubbles ⇆ | `bubbles` | a wall, several surfaces | Soap bubbles float up and drift across the frame, shimmering with rainbow colours. |
| Cherry blossom ⇆ | `petals` | a wall, several surfaces | Pink blossom petals flutter down and drift across the frame on a breeze. |
| Ocean waves ⇆ | `waves` | the ground, a floor, a wall | Seen from above: waves roll in to a sandy beach, wash up it in foam and slide back. |

### Halloween (40)

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
| Claws round the edge | `claws` | **a door**, a cupboard | Now and then a bony clawed hand creeps round the edge of a door and drums its fingers. |
| Spinning web | `web` | a window, a corner, a door | A spider spins its web from nothing, spokes first and then the spiral, beaded with dew. It fades and starts again. |
| Graveyard ⇆ | `graveyard` | a wide wall, a garage door | Crooked tombstones and a dead tree on a hill under the moon, with fog creeping between them. |
| Dancing skeleton ♪ | `skeleton` | a door, a wall | A skeleton dances, swinging its arms and kicking its legs, in time with the music. |
| Face in the wall | `ghostface` | **a sheet hung up**, a pale wall | Now and then a face pushes out of the wall as if through stretched cloth, mouth open, then sinks back. |
| Zombie hands | `zombie` | the bottom of a wall, a flower bed | Rotting hands claw their way up out of the earth along the bottom, and sink back down. |
| Cauldron ♪ | `cauldron` | a box, a wall | A witch's cauldron on a fire, its green brew bubbling and steaming, bubbling harder on the beat. |
| Creepy crawlies | `crawlers` | a wall, a ceiling | Spiders scuttle over a dimly lit wall, stopping and starting. |
| Shadow walker ⇆ | `shadow` | a wall, several surfaces | A tall, thin shadow walks slowly across a firelit wall, from one surface to the next. |
| Bloody handprints | `handprints` | **a window**, a glass door | Bloody handprints slap onto the glass one after another, smear and run, then slowly fade. |
| Werewolf moon ⇆ | `werewolf` | a wall, a garage door | A wolf on a rocky hill throws back its head and howls at the full moon, as clouds drift past. |
| Haunted portrait | `portrait` | **a picture frame**, a rectangle | A dark old portrait in a gold frame. Its eyes follow you, and now and then the face turns to a skull. |
| Black cat | `blackcat` | **a window** | A black cat sits on the sill against a warm-lit window, tail swishing, eyes glowing and blinking. |
| Crows ⇆ | `crows` | a wall, several surfaces | A flock of crows flaps across a grey dusk sky, from one surface to the next. |
| Mummy door | `mummy` | **a door** | Wraps a door in old bandages, and through a gap two eyes peer out, looking about and blinking. |
| Will-o'-the-wisps ⇆ | `wisps` | a garden, the bottom of a wall | Little blue flames float and bob through the dark, low over the ground, fading in and out. |
| The Reaper ⇆ | `reaper` | a wall, a garage door | A hooded figure with a scythe glides through green-lit fog across the frame, red eyes glinting under the hood. |
| Pumpkin patch ⇆ | `pumpkins` | the bottom of a wide wall | A row of jack-o'-lanterns along the bottom of the frame, big and small, each with its own face and flicker. |
| Something wants out ♪ | `knock` | **a door** | Something pounds on the other side of a door: with each blow, red light flares out round its edges. On the beat with music. |
| Giant eyeball | `eyeball` | **a circle** | A bloodshot eyeball for something round: it looks about, its pupil widening and narrowing, and blinks. |

### Fall (13)

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
| Bonfire | `bonfire` | a wall, a fire pit surround | A big bonfire roaring up from the bottom edge, throwing off sparks. |
| Turkey | `turkey` | **a circle**, a door | A cheerful Thanksgiving turkey for something round: a fan of tail feathers, a wobbly wattle, a blink now and then. |
| Owl | `owl` | **a circle**, a birdhouse | An owl face for something round: big amber eyes that blink, one at a time, as it tilts its head. |
| Morning mist ⇆ | `mist` | a wide wall | A golden dawn behind two rows of dark trees, with mist drifting between them, across the frame. |
| Squirrel ⇆ | `squirrel` | the bottom of a wall, a fence | Now and then a squirrel bounds along the bottom of the frame with an acorn, from one surface to the next. |

### Christmas (29)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Snow ⇆ | `snow` | a wall, a window, several surfaces | Soft flakes in three layers, blown by a wind you set. |
| Big snowflakes ⇆ | `snowflakes` | a wall, a garage door | Big six-armed flakes drifting down, turning. |
| Snowdrift | `snowdrift` | a window, the bottom of a door | Snow piles up along the bottom edge, then melts and starts again. |
| Icicles | `icicles` | **the top of a window, a porch or a gutter** | Glinting icicles; now and then one drips. |
| Frost | `frost` | a window | Feathery frost creeps in from the edges and breathes back. |
| Twinkle lights ♪ | `twinkle` | **any shape**: a door, a wreath, a window | Bulbs round the outline in four colour sets; more light on the beat. |
| Chasing lights ♪ | `chase` | **any shape** | Bulbs round the outline chase, alternate, or fill and empty; on the beat with music. |
| Light curtain | `curtain` | a window, a wall | Strands of little lights hanging down, twinkling or falling like icicle lights. |
| Tree of lights | `xtree` | a wall, **a triangle** | A tree drawn in rows of bulbs, with a star on top. |
| Holly garland | `holly` | **a door or window frame** | Holly leaves and berries round the outline, little lights between. |
| Wreath | `wreath` | **a circle on the door** | Green, with twinkling lights and a red bow. |
| Ornaments | `ornaments` | a window, the top of a wall | Baubles hanging on strings, swaying, glinting. |
| Jingle bells ♪ | `bells` | a door | Two golden bells under a bow, swinging and ringing; harder on the beat. |
| Candy stripes | `candy` | a pillar, a door frame | Turning red and white stripes; colour, width and speed. |
| Peppermint | `peppermint` | **a circle** | A turning red and white peppermint swirl. |
| Plaid | `plaid` | a pillar, a box, a door | Red or green tartan, or buffalo check. |
| Glitter ♪ | `glitter` | anything | Gold or silver glitter; more sparkle on the treble. |
| Wrapped present | `present` | **a box**, a door | Patterned paper, a ribbon each way and a bow. |
| Gingerbread house | `gingerbread` | a wall, a door | Gingerbread with icing scallops, gumdrops and a lattice. |
| Stockings by the fire | `stockings` | a fireplace, a wall | Stockings hang from the top, lit by a fire along the bottom. |
| Advent candles | `advent` | a shelf, a window sill | Four candles in greenery; set how many are lit. |
| Santa ♪ | `santa` | **a circle** | Hat, beard and rosy cheeks. He winks, and laughs along with music. |
| Snowman | `snowman` | **a circle** | Coal eyes that blink, a carrot nose, a smile of stones. |
| Snow globe | `snowglobe` | **a circle** | A little house and tree under glass; shaken now and then. |
| Northern lights ⇆ | `aurora` | a wall, a garage door | Green and violet curtains over a starry sky. |
| Star of Bethlehem ⇆ | `star` | a wall | One bright star over hills and a little town. |
| Sleigh across the moon ⇆ | `sleigh` | a garage door, a wall | Santa and four reindeer cross the moon, the leader's nose glowing. |
| Winter village ⇆ | `village` | a wide wall | Snowy rooftops, lit windows, chimney smoke, falling snow. |
| Christmas train ⇆ | `train` | the bottom of a wide wall | A little steam train with lit carriages chugs across. |

### Celebrations (18)

| Look | Id | Best on | Notes |
|---|---|---|---|
| Fireworks ⇆ ♪ | `fireworks` | a wall, a garage door, several surfaces | Rockets climb and burst into showers of coloured sparks across the whole frame, flashing on the beat. |
| Waving flag | `flag` | **a rectangle**: a door, a banner | A flag fills the surface, rippling in the wind: the Stars and Stripes or a rainbow. |
| Sparklers | `sparklers` | a wall, a window | Sparklers fizz and spit bright sparks in every direction, slowly burning down their sticks. |
| Confetti ⇆ | `confetti` | a wall, several surfaces | Bright confetti flutters down across the whole frame, twisting and flashing as it turns. |
| Balloons ⇆ | `balloons` | a wall, several surfaces | Shiny balloons on strings float up and away across the whole frame. |
| Hearts ♪ | `hearts` | a door, a window | A big heart beats, lub-dub, or on the beat with music, as little hearts float up around it. |
| Red lanterns | `lanterns` | a porch, the top of a wall | Round red paper lanterns with gold tassels hang and sway, glowing, for Lunar New Year. |
| Diyas | `diyas` | a step, a window sill, a shelf | A row of little painted clay oil lamps, each with a flickering flame, for Diwali. |
| Rangoli | `rangoli` | **a circle on the ground**, a doormat | A rangoli pattern of petals and dots in bright powder colours for something round, its rings slowly turning. |
| Easter egg | `eggs` | **an oval**, a door | A big painted Easter egg in pastel bands of zigzags, dots and stripes, slowly turning. |
| Shamrocks ⇆ | `shamrocks` | a wall, several surfaces | Green shamrocks tumble down across the frame with flecks of gold, for St Patrick's Day. |
| Countdown | `countdown` | a wall, a door | Big glowing digits count down a second at a time, then burst into colour, and start again. For New Year. |
| Menorah | `menorah` | a window, a wall | A golden menorah for Hanukkah: set the night, and the shamash and that many candles are lit, right to left. |
| Kinara | `kinara` | a window, a wall | A kinara for Kwanzaa: three red candles, a black one in the middle, three green. Set the day, and that many are lit. |
| Searchlights ⇆ | `searchlights` | a wide wall, a whole house front | Beams of light sweep the night sky from below, crossing and lighting up the clouds, like a premiere. |
| Crescent and lanterns | `crescent` | a window, a wall | A golden crescent moon and star in a night sky, with glowing lanterns of coloured glass hanging and swaying, for Ramadan and Eid. |
| Papel picado | `papel` | the top of a wall, a porch | Strings of bright cut-paper flags across the top, fluttering, for a fiesta or Day of the Dead. |
| Sugar skull | `sugarskull` | **a circle** | A decorated sugar skull for something round, with flowers round its eyes, for Día de los Muertos. Its colours slowly shift. |

## Next

- **More Halloween**: a drop that falls off the end of a drip.

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
