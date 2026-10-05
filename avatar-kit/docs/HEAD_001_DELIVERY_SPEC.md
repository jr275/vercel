# HEAD-001 Delivery Spec

What the artist must deliver for the first candidate head. Nothing else is in this document. The visual authority is the Asset Brief (Parts 1 to 8, attached to every request); where this page and the Brief differ on a number, this page wins for HEAD-001.

> **THE PRIMARY ACCEPTANCE TEST IS THE CHARACTER SPEAKING.**
> A beautiful still render that fails during speech is a failure. A head that is excellent still and poor while talking is rejected, whatever the stills look like.

## Identity

| | |
|---|---|
| Name | Vera Halden (working name) |
| Age | 43, an adult executive woman |
| Origin | An original, proprietary character created from scratch |
| Likeness | Not based on any real person, actor or existing character. No scan, photo or likeness of a real person at any stage |

## Visual

Use the Character Bible as it is written in the Asset Brief, Parts 1 to 8: proportions, skin, eyes, brows, mouth, hair, the ten Visual DNA traits and the expression targets. Do not invent a new look. If something in the Brief cannot be done, say so in writing before you start; do not change it silently.

## Geometry (head only)

| Part | Required |
|---|---|
| Head and skin | one mesh, clean deformation topology |
| Neck | to the base of the neck, ends cleanly (no body, no clothing) |
| Eyes | two globes with separate corneas, controllable |
| Eyelids | modelled to close over the globe without intersection |
| Mouth | lips, gums, cavity |
| Teeth | separate mesh, follows the jaw and the visemes |
| Tongue | separate mesh, follows the jaw and the visemes |
| Hair | basic hair, enough to judge the silhouette and hairline; styled to the Brief |

No final body, no clothing. A plain neck cut is fine.

## Facial rig

All of it is required.

- ARKit-compatible facial set: the **52** blendshapes, with Apple's exact names
- **15** Oculus visemes (`viseme_sil`, `PP`, `FF`, `TH`, `DD`, `kk`, `CH`, `SS`, `nn`, `RR`, `aa`, `E`, `I`, `O`, `U`), sculpted, with teeth and tongue
- eye controls: both eyes can look in all directions, lids follow the gaze, pivots at the eye centres
- jaw control: opens, closes, moves sideways and forward, without the lips tearing
- natural facial deformation: cheeks, chin, nostrils and neck move a little with the mouth; combinations (smile with the jaw open, brows down with the eyes squinting) hold up without collapsing

Left and right shapes are authored separately. The neutral mesh carries 2% to 3% asymmetry as in the Brief.

## Technical

| | |
|---|---|
| Format | one self-contained `.glb` (glTF 2.0), no external files |
| Geometry compression | `EXT_meshopt_compression` |
| Textures | KTX2 (Basis), power of two, with mipmaps |
| Triangles | 45,000 or fewer in total, all meshes |
| File size | target 6 MB or less, **hard limit 8 MB** |
| Web-ready | opens with three.js r147 `GLTFLoader` and `MeshoptDecoder`, no custom loader |
| Deterministic loading | same file, same result: no scripts, no random or time-dependent data, no runtime generation |
| Dependencies | no proprietary runtime and no plugin needed to display it |
| Naming | ASCII, no spaces, stable across versions (`exec_head_v001.glb`) |

Our viewer loads KTX2 (UASTC and ETC1S) through the three.js `KTX2Loader` with the standard Basis transcoder. A second copy of the GLB with PNG or JPEG textures is welcome for your own preview but not required.

## Required demonstrations

The artist demonstrates, from the glTF as shipped (not from the DCC scene):

1. neutral
2. listening
3. thinking
4. skeptical
5. firm
6. speaking
7. viseme sequence
8. eye movement
9. jaw movement
10. 1.5-second idle and presence

## The speaking video

Before any final approval the artist delivers at least one short video of the head speaking the standard sentence, driven by the timeline in the Vendor Test. It shows:

- front
- three-quarter
- neutral
- speaking
- expression transition (neutral to skeptical, and back)

Lighting and framing are the same in every part. No cuts, no post-processing, no retouching of the face. Close-up on the mouth and eyes, not a turntable.

## Delivery package

1. `exec_head_v001.glb` and the review variant
2. source files (Blender, Maya, ZBrush or Substance) and full-resolution textures
3. rig sheet: morph target names per mesh, bone names, mirroring decisions
4. reference renders and the speaking video
5. a short note of anything done differently from this spec

## Rights

Original character, full commercial rights, transferable, source files included. The full terms are in the RFQ.
