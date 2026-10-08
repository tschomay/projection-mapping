# projection-mapping

Exploring geometry-aware, procedurally generated projection mapping: graphics
written onto a 3D model of the scenery and rendered from the projector's
viewpoint, so they come out pre-warped and continuous across edges.

- [`docs/feasibility.md`](docs/feasibility.md): how feasible the whole pipeline
  is, stage by stage, and a suggested build order.
- [`sim/index.html`](sim/index.html): the **Projection Mapping Sandbox**, a
  browser simulation of a room, a projector and a few boxes. Open it directly
  in a browser (it loads three.js from jsDelivr).

## What the sandbox shows

- **Room view**: the "real" room lit only by the virtual projector, including
  projector shadows and the gray glow a projector emits for black. Orbit it to
  see that surface-bound content stays locked to the boxes from any seat.
- **Projector output**: the exact image the projector emits. Click and drag
  boxes here to align them by hand.
- **Surface map**: build the 3D model of the scene either with manual boxes or
  a simulated depth scan (RANSAC wall/floor removal, clustering, oriented box
  fitting) from a noisy sensor beside the projector.
- **Content**: eight procedural shader effects written in world/face space,
  an editable GLSL panel, and (when opened as a published Claude artifact)
  "Generate with Claude", which writes a new shader from a text prompt using
  the scene's actual box dimensions, with one automatic compile-error repair.
- **Projector pose error**: simulates imperfect calibration to show how
  sensitive alignment is.
