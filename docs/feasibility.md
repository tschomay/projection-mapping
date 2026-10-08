# Feasibility: geometry-aware, procedurally generated projection mapping

## The short version

Making graphics "fit" the scenery is hard because people do it in 2D. An artist
draws a flat image, then warps and corner-pins it until it looks right on the
objects. Each face gets its own distortion, and keeping an animation continuous
where two faces meet means hand-matching the warps.

If the app knows two things, that step goes away:

1. **The surfaces**: where each wall, floor and object is in 3D.
2. **The projector**: its position, aim and lens (field of view, lens shift).

With both, you write the graphics *onto the 3D surfaces* (in world space, in
meters) and then render that scene from the projector's exact viewpoint. The
render is the projector image. Every stretch and skew comes out of the
perspective math, and continuity across edges is automatic because a wave that
moves through 3D space crosses an edge the same way it would in reality.

Procedural content suits this well. A shader that receives "this pixel is at
(x, y, z) meters, on the top face of box 3, 4 cm from its edge" can draw
windows at a real 9 cm pitch on every box regardless of size, fill boxes with
liquid to the same world height, or light them with a virtual sun that casts
shadows onto the wall. A language model writes these shaders well, so "AI in
the loop" is practical: describe a look, get a shader that already understands
the scene.

**Verdict:** feasible with a laptop and any projector. The geometry-aware
rendering and AI-generated content are well within reach. The parts that take
real engineering are calibration (finding the projector's pose and lens) and
automatic surface capture.

## The pipeline, stage by stage

| Stage | What it produces | Difficulty | Notes |
|---|---|---|---|
| 1. Projector calibration | Projector pose + lens (a camera matrix) | Medium | Solved problem; needs a good UX |
| 2. Surface capture | 3D model of the surfaces | Easy (manual boxes) to medium (auto) | Boxy scenes are easy; organic shapes need a mesh |
| 3. Content generation | Animated graphics in surface space | Easy to medium | Shaders; AI writes them from a prompt |
| 4. Output | Full-screen render on the projector | Easy | Browser app on a second display |

### 1. Projector calibration

A projector is a camera running backwards, so it has the same parameters: a
position, an orientation, a field of view and a lens shift. Most projectors
throw the image upward (vertical lens shift), so a naive centered camera model
is off. Ways to get these numbers:

- **Click known points (manual).** Show a crosshair, move it onto 6 or more
  physical corners whose 3D positions you know (from the box model), then solve
  for the projector matrix with the Direct Linear Transform or PnP. Takes a
  couple of minutes and works with no extra hardware. This pairs naturally with
  manual box entry.
- **Structured light (automatic).** Project a sequence of Gray-code stripe
  patterns and photograph each with a phone or webcam on a tripod. Decoding
  gives, for every camera pixel, the projector pixel that lit it. With that
  correspondence you can calibrate the projector and triangulate a dense 3D
  scan in one pass. This is the approach used by research and pro tools, and
  it needs only the projector you already have plus a camera.
- **Spec sheet + tape measure.** Throw ratio and lens offset from the manual,
  plus a measured position. Gets you within a few centimeters; good enough to
  start, then refine by eye.

Sensitivity is the main risk. A 1° aim error at 3 m moves the image about
5 cm, which is very visible on a box edge. Calibration needs a "nudge until it
lines up" step even after automatic solving. The sandbox's *Projector pose
error* slider shows how quickly misalignment becomes obvious.

### 2. Surface capture

Three options, cheapest first:

- **Manual boxes.** Add a box, then drag and size it while watching the real
  projection until the glowing outline sits on the real edges. This is the
  fastest path for boxy sets (crates, steps, plinths, building façades) and
  works today. In practice the outline you're aligning *is* the calibration
  pattern, so you get immediate visual feedback.
- **Depth photo from near the projector.** Options include a phone with LiDAR
  (iPhone Pro, iPad Pro; roughly 1 cm noise at 3 m), a depth camera (RealSense,
  Kinect/Azure Kinect), or monocular depth estimation from a single photo with
  an AI model such as Depth Anything. Monocular depth gives relative depth only,
  so it needs a scale reference and still has to be registered to the
  projector. From the point cloud, fit primitives: remove the wall and floor
  with RANSAC plane fitting, cluster what remains, and fit an oriented box to
  each cluster. The sandbox implements exactly this pipeline against a
  simulated noisy depth sensor, and it typically lands within 1 to 3 cm.
- **Structured-light scan.** Same capture as automatic calibration above. It
  gives dense geometry for any shape, curved ones included. It's the most
  accurate option and needs no extra hardware beyond a camera, but it takes a
  dark room and a few minutes of capture.

Only surfaces the projector can see matter. The back of a box is never lit, so
a scan from roughly the projector's position captures what's needed.

### 3. Content generation

Each pixel the projector draws knows its 3D position, surface normal, which
object and face it's on, coordinates on that face in meters, and distance to the
face's edges. From that, procedural effects that would be painful to hand-warp
become a few lines:

- Edge tracing and outline pulses that run continuously around corners.
- Liquid filling each box to a shared world height, with a meniscus line that
  wraps across faces.
- Virtual lighting: a moving sun shading each face by its real normal and
  casting shadows onto the wall. This is the classic "the building is moving"
  illusion.
- Texture re-skinning at true physical scale (windows, bricks, wood grain).
- Effects that travel through the space: ripples from a point on the wall, a
  scan plane sweeping toward the audience.

**AI in the loop.** Claude is given the surface API and a description of the
scene (box sizes and positions) and returns a shader function. The app compiles
it and, if it fails, sends the compiler error back once for a fix. Because the
model knows the scene, prompts like "make the tallest box a lighthouse" work.
Image models (diffusion) can contribute textures, and depth-conditioned
generation can re-skin a still of the scene, but they don't produce clean,
geometry-locked animation on their own. Shaders are the better core, with
generated images as textures on top.

**Two kinds of illusion.** Surface-bound content (textures, lighting, outlines)
looks right from *every* seat, because it's painted onto the surfaces. Fake 3D
"pop-out" effects (anamorphic) only work from one viewpoint and need the
audience position as an input. The sandbox demonstrates the first kind; orbit
the room camera and the content stays locked to the boxes.

### 4. Output

A browser app full-screen on the projector, as a second display, is enough.
WebGL runs these shaders at 60 fps on any recent laptop. Any projector works;
brightness and contrast matter more than resolution because the room is never
fully dark. A short-throw projector reduces the shadows people cast.

## Alternative: 2D surface mapping (no 3D model)

Most commercial mapping tools (MadMapper, Resolume Arena, HeavyM) work this way.
The phone or laptop screen *is* the projector's frame, shown as a blank canvas
with no camera image. You add a shape, the projector shows it, and you drag it
and its corners until it sits on a real surface. Repeat per surface. Shapes can
be combined (union) or cut out of each other, and individual points can be
added, moved and removed for custom outlines.

**Why it works.** The user's eyes close the loop. Whatever is drawn at a
projector pixel lands wherever that pixel's light lands, so no projector
calibration, no 3D model and no camera are needed. Moving the projector even a
little breaks it, but the same is true of the 3D approach.

**Why four corners are enough for flat surfaces.** A flat surface seen from the
projector is related to a flat rectangle by a *homography* (a perspective
transform with 8 degrees of freedom), which is fully determined by four point
pairs. Pinning a shape's four corners to the four corners of a real flat
surface makes anything drawn in that shape's own coordinates
perspective-correct on the surface. A circle pinned this way becomes the
correct ellipse for a round tabletop seen at an angle. One detail matters:
the mapping has to be a true homography per pixel. Splitting the quad into two
affine triangles, which is what naive texture mapping does, leaves a visible
crease along the diagonal.

**What you give up compared with a 3D model:**

| Capability | 3D model | 2D surfaces |
|---|---|---|
| Needs projector calibration | Yes | No |
| Curved or odd-shaped outlines | Needs a mesh | Yes (custom points) |
| Content continuous across a shared edge | Yes | Yes, if defined in projector-screen space |
| True physical scale (9 cm windows on every box) | Yes | No; only projector-pixel size |
| Virtual lighting and cast shadows (normals, depth) | Yes | No |
| Effects that travel through 3D space | Yes | No |
| Setup effort for a few boxes | Low with a scan | Low; a few minutes of dragging |

Continuity across neighboring surfaces is mostly preserved: two surfaces that
share an edge share the same projector pixels along it, so anything defined in
projector-screen coordinates flows across the seam with no break. What's lost
is physical consistency. A wave moves at a different physical speed on a
foreshortened face, and the app can't know which face is "up".

**Recommendation: 2D-first, with 3D as an upgrade.** 2D surfaces should be the
default authoring workflow because they need nothing but the projector and
work on any flat surface. Two bridges between the approaches are worth
building:

- **3D to 2D**: project a 3D model's visible faces into starting surfaces, then
  refine by dragging. The sandbox's *Start from 3D boxes* button does this.
- **2D to 3D**: if surfaces are welded at shared corners (the sandbox snaps
  corners together) and assumed to be rectangles meeting at right angles, the
  aligned corners are enough to solve for the projector's focal length and pose
  and the boxes' 3D shape. The user's alignment work becomes the calibration,
  and 3D-only effects (lighting, physical scale) unlock without a separate
  calibration step.

In the sandbox, the *2D surfaces* tab starts from the 3D scan's faces at about
98% coverage of the real box faces. *Clear all* gives the true blank-canvas
experience: build surfaces by hand, judging only by the room view.

## Limits and risks

- **Surface color and texture.** Dark or glossy surfaces reflect poorly. White
  or light matte surfaces work best. You can compensate per surface by boosting
  output, but only up to the projector's limit.
- **Ambient light and black level.** Projectors can't project black. Content
  with mostly dark backgrounds and bright accents reads best; the sandbox
  models the projector's gray "black" glow.
- **Occlusion shadows.** Objects in front cast shadows on what's behind them
  from the projector's viewpoint. Multiple projectors fix this but add edge
  blending, which is a project of its own.
- **Focus.** A projector has a limited depth of field. Deep scenes go slightly
  soft at the extremes.
- **Curved or organic shapes.** Boxes and planes cover a lot of real sets.
  Anything else needs a scanned mesh and UVs, which is supported by the same
  rendering approach but needs the structured-light capture path.
- **AI-generated shader quality.** Compile errors are easy to catch and repair.
  Ugly or overly busy results are the real failure mode, so keep presets as a
  baseline and treat the AI as a starting point you can tweak.

## Suggested build order

1. **Sandbox (done).** A virtual room, projector, boxes, mapping tools and
   effects, to prove the rendering approach and the AI loop. See
   [`sim/index.html`](../sim/index.html).
2. **Real-projector MVP, 2D-first.** Phone or laptop as the editing canvas,
   projector as the output, 2D surfaces as the mapping method. This works on
   any flat surfaces with no calibration and gets you real shows quickly.
3. **2D to 3D upgrade.** Solve the projector pose and box shapes from welded
   2D surfaces, unlocking the 3D-only effects without a separate calibration
   step.
4. **Camera-assisted capture.** A phone or webcam with Gray-code structured
   light for automatic calibration and scanning, with box fitting on top.
5. **Content library + AI authoring.** Saved effects, timelines and audio
   reactivity.
