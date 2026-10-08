# projection-mapping

Exploring geometry-aware, procedurally generated projection mapping: graphics
written onto a 3D model of the scenery and rendered from the projector's
viewpoint, so they come out pre-warped and continuous across edges.

- [`docs/feasibility.md`](docs/feasibility.md): how feasible the whole pipeline
  is, stage by stage, measured results from the sandbox, and a suggested build
  order.
- [`docs/hardware.md`](docs/hardware.md): what to expect from a cheap
  projector indoors and outdoors, which projector and phone features matter,
  and outdoor practicalities.
- [`docs/prior-art.md`](docs/prior-art.md): what MadMapper, Resolume, HeavyM,
  Lightform, disguise and the open-source tools teach us.
- [`app/`](app/README.md): **Surface Mapper**, the phone-first app. Trace
  surfaces on the projector frame, fill them with effects, video and images,
  and drive them with sound. Static files; deploys to Vercel as-is (see
  `vercel.json`). Live at https://surface-mapper-alpha.vercel.app.
- [`sim/index.html`](sim/index.html): the **Projection Mapping Sandbox**, a
  browser simulation of a room, a projector and a few boxes. Open it directly
  in a browser (it loads three.js from jsDelivr).

## What the sandbox shows

- **Room view**: the "real" room lit only by the virtual projector, including
  projector shadows and the gray glow a projector emits for black. Orbit it to
  see that surface-bound content stays locked to the boxes from any seat.
- **Projector output**: the exact image the projector emits. Click and drag
  boxes here to align them by hand.
- **Surface map, two methods**:
  - *3D model*: manual boxes or a simulated depth scan (RANSAC wall/floor
    removal, clustering, oriented box fitting) from a noisy sensor beside the
    projector.
  - *2D surfaces*: shapes traced directly in the projector's frame (squares,
    circles, triangles), warped by four corner pins (a homography, so content
    is perspective-correct on flat surfaces), combined or cut out, with
    editable points. No calibration needed. A coverage score shows how much of
    the real boxes the surfaces cover. *Enlarge* makes the projector canvas
    the big view for editing.
  - *Find surfaces with a camera*: a virtual camera near the projector
    photographs Gray-code stripe patterns; decoding plus RANSAC homography
    fitting turns each flat surface into a 2D surface automatically.
  - *Upgrade to a 3D model*: solves the projector's aim and lens and a box per
    group of welded surfaces, from two tape measurements and the lens offset.
- **Content**: procedural shader effects for each method (eight in 3D, six in 2D),
  an editable GLSL panel, and (when opened as a published Claude artifact)
  "Generate with Claude", which writes a new shader from a text prompt using
  the scene's actual box dimensions or traced surfaces, with one automatic compile-error repair.
- **Projector pose error**: simulates imperfect calibration to show how
  sensitive alignment is.
