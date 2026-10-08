# Prior art: what the commercial and open-source tools teach us

A survey of the main projection-mapping tools, aimed at what this project should
copy, skip, or do differently. Sources are listed at the end. Vendor claims
(accuracy, feature lists) come from vendor pages and weren't independently
verified.

## The landscape

| Tool | Mapping model | Camera / auto calibration | Notes |
|---|---|---|---|
| MadMapper | 2D surfaces (quad, circle, triangle, mask, lines) plus 3D object surfaces | "Space Scanner": structured light with a DSLR; "3D Calibration" to match a 3D model | Bezier masks with feathering, unlimited-point mesh warping, snapping, GLSL/ISF materials, cues, timelines, audio beat detection, DMX/LED, export to a small standalone player (MiniMad) |
| Resolume Arena | 2D "slices" with separate input selection and output transformation | None built in | Four corner points for perspective warp, plus point editing; mapping in Arena only |
| HeavyM | 2D shapes drawn to match the set | None found | Aimed at beginners; built-in effects and sound reactivity |
| Lightform (LF2) | Projector with a built-in camera; structured-light scan | Yes, automatic | Company appears to have shut down; products discontinued |
| disguise (QuickCal, OmniCal) | 3D model of the stage | QuickCal: place points on the mesh by hand. OmniCal: multi-camera structured light giving a point cloud and auto-alignment | High-end live events; plan camera placement in a virtual stage first |
| mapamok (YCAM, open source) | 3D model | Click 8–12 model points, auto-calibrate; Gray-code scanning in the toolkit | Research toolkit |
| Splash (SAT, open source) | 3D model (UV-unwrapped) | Calibrates projectors (lens, color, blending) against your model | Multi-projector domes |
| ofxPiMapper (open source) | 2D surfaces | None | Runs standalone on a Raspberry Pi |

## Lessons

1. **2D surfaces are the industry default; 3D is the pro tier.** Every
   beginner and mid-range tool (MadMapper, Resolume, HeavyM, ofxPiMapper) maps
   2D shapes. 3D models with calibration show up in disguise, Splash and
   mapamok, aimed at large or multi-projector shows. That supports the
   2D-first recommendation, with 3D as an upgrade.

2. **Hand-placed points are the calibration that actually ships.** disguise's
   QuickCal and mapamok both calibrate by having the user drag a handful of
   model points onto their real positions. Our 2D-to-3D solve is the same idea
   run backwards: the corners the user already aligned are the calibration
   points.

3. **Camera scanning is valuable but hard to sell as hardware.** Lightform put
   the camera in the projector and appears to be gone. MadMapper supports a
   DSLR, and disguise sells camera kits for big rigs. The gap is a *phone*
   doing the scanning with any projector, which is what this project targets.
   disguise also plans camera placement in a virtual stage before arriving on
   site, which is what our sandbox does.

4. **Separate "what content" from "where it lands".** Resolume splits Input
   Selection (which part of the composition) from Output Transformation (where
   that slice goes physically). That lets one piece of content span several
   surfaces, or one surface show part of a larger composition. Our 2D effects
   get part of this via `s.screen`; an explicit composition canvas would be
   clearer for artists.

5. **Four corners aren't enough for real surfaces.** MadMapper offers Bezier
   masks with feathering and mesh warping with unlimited points, for surfaces
   that aren't perfectly flat or have soft edges. We should add:
   - a grid warp per surface, so a slightly curved surface can be pinned at
     more points than four;
   - feathered mask edges.

6. **Shaders are a standard content format.** MadMapper has a live GLSL
   material editor and supports ISF (Interactive Shader Format). Our
   AI-written shaders could export as ISF, which makes them portable to
   MadMapper, Resolume (via plugins), VDMX and others.

7. **Show control is table stakes.** Cues (parameter snapshots) with
   animatable transitions, timelines, calendar scheduling, audio beat
   detection, and DMX/Art-Net for syncing with lights. A first real-world
   version needs at least cues and audio reactivity.

8. **Standalone playback matters for installations.** MadMapper exports to a
   small player (MiniMad), and ofxPiMapper runs on a Raspberry Pi. A
   browser-based player on a stick computer or Pi would let a mapped piece run
   unattended without a laptop.

9. **Multi-projector blending is a separate, large problem.** Every pro tool
   has soft-edge blending and color matching. It's worth deferring until a
   single projector is solid.

## Sources

- [MadMapper features](https://madmapper.com/madmapper/features)
- [Resolume: Output Transformation](https://resolume.com/article/52)
- [HeavyM software](https://www.heavym.net/heavym2/)
- [Lightform profile (Preqin)](https://www.preqin.com/data/profile/asset/lightform--inc-/228821)
- [Lightform (University of Illinois Research Park)](https://researchpark.illinois.edu/?p=14742)
- [disguise OmniCal](https://azure-prod.disguise.one/en/products/omnical)
- [disguise OmniCal networking docs](https://help.disguise.one/designer/networking/omnical-networking)
- [mapamok / ProCamToolkit (CDM)](https://cdm.link/projector-and-camera-a-little-closer-new-magical-mapping-tools-3d-scanning-and-more/)
- [Splash on projection-mapping.org](https://projection-mapping.org/splash/)
- [ofxPiMapper (FITC)](https://fitc.ca/presentation/ofxpimapper-secret-projection-mapping-tool/)
