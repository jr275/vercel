# Head Prototype Gate

The Head Prototype Gate decides whether a real 3D head may move on. It does not judge ideas or documents. It judges one GLB file, with the same camera, light, background and procedure for every candidate, and it records the decision with a name on it.

Nothing in the gate contacts, hires, pays or sends anything to a vendor. It is local: a registry on disk, a headless browser, a report folder.

## Objective

Receive a head from any source, run it through one standard review, and answer one question: is this face good enough, moving and speaking, to build the rest of the character on?

A face that is excellent still and poor while speaking is rejected. Speech weighs more than stills.

## The flow

```
register  ->  validate-head  ->  human review  ->  rate  ->  decide
 (DRAFT)      (UNDER_REVIEW)     (review.html)               (PASS | CONDITIONAL | REJECTED)
```

| Step | Command | What happens |
|---|---|---|
| 0 | `node tools/head-gate.js init` | creates the registry and `HEAD-001` as `PENDING_ASSET` (no GLB exists yet; no face is invented) |
| 1 | `register HEAD-001 --file head.glb --vendor "Studio"` | stores the GLB, its SHA-256, size and version; state `DRAFT` |
| 2 | `validate-head HEAD-001` | runs the whole automated review and writes the Golden Review Package; state `UNDER_REVIEW` |
| 3 | open `package/review.html` | a person looks at the stills, the speech and the presence frames and fills the form |
| 4 | `rate HEAD-001 --file ratings.json` | merges the human ratings, recomputes the scorecard and the barriers |
| 5 | `decide HEAD-001 --decision PASS --by "Name"` | records the decision; requires a signature |

Other commands: `ratings-template`, `status [ID]`, `report ID` (rebuild the package without the browser), `compare [IDs] [--out file]`.
Exit codes: 0 ok, 1 error or REJECTED, 2 the review still needs a person.

## States

| State | Meaning |
|---|---|
| `PENDING_ASSET` | the slot exists, there is no file |
| `DRAFT` | a file is registered, not yet reviewed |
| `UNDER_REVIEW` | the automated review ran; a person is still needed |
| `PASS` | approved to move on |
| `CONDITIONAL` | approved only after the listed fixes, then a new version is reviewed |
| `REJECTED` | does not move on |

A new file for the same candidate is a new version. Registering it archives the previous decision in the history. A decision never changes silently: it needs `--by`.

## What is measured, and what is not

Six sections, each computed from the Visual Scorecard items that apply in Phase 1: TECHNICAL, VISUAL, PRESENCE, SPEECH, EXPRESSION, IDENTITY.

An item that can be measured is measured (the existing Asset Validator is reused: file size, triangles, morphs, visemes, bones, eyes, jaw, FPS gate). An item that needs a human shows `HUMAN REVIEW REQUIRED`. A missing value is never counted as zero.

### Automated

- registration and hash, size, load time, triangles, textures, morph names, bones
- mapping of the 10 review expressions (listening, thinking, perceived unsaid, disagreement, rationalization detection, continue, welcoming, firm, skeptical, confident): each required channel is `MAPPED`, `FUZZY` (matched by name tokens, a person must confirm) or `UNMAPPED`
- the two transition tests
- the 1.5 second presence test (micro eye movement, breath, micro facial change, gaze settling, no fidgeting)
- the standard speech test (mouth movement per syllable, jerk of jaw, cheeks and chin, lip closure on p/b/m, visemes reached, eye alignment, peak displacement)
- expression subtlety and exploding-vertex checks
- the automatic hard rules

### Human review required

Beauty and authority, whether the eyes are alive, likeness to a real person, identity and visual DNA, the blind comparison, the 1.5 second answers A, B and C, and the 12-item speech checklist. See `HEAD_REVIEW_PROTOCOL.md`.

## Standard review conditions

One configuration, hashed (`configHash`), applies to every candidate: 1280x720, pixel ratio 1, executive lighting for every shot, fixed lens and framing, backdrop that follows the camera, fixed 1/30 s time step, seeded randomness, a fresh avatar for every test part. The same file gives the same pixels. Shot 09 changes the framing only.

Ten shots: `01_FRONT_NEUTRAL`, `02_FRONT_LISTENING`, `03_FRONT_THINKING`, `04_FRONT_FIRM`, `05_FRONT_SKEPTICAL`, `06_THREE_QUARTER`, `07_PROFILE`, `08_SPEAKING`, `09_SPEAKING_CLOSE`, `10_IDLE_1_5_SECONDS`.

Speech sentence: "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it." It is driven by a hand-transcribed phoneme timeline. There is no text-to-speech and no audio: this tests the rig, not a voice.

## Criteria

| Result | Needs |
|---|---|
| `PASS` | scorecard 85 or more; no item below 3; speech mean 4.0 or more; each presence answer at least 80% yes; identity items 4 or more; technical at least 85% of its automatic points; no hard rule triggered, and the human ones confirmed as checked |
| `CONDITIONAL` | scorecard 70 to 84; no item below 2; no hard rule; the fixes are listed |
| `REJECTED` | any hard rule; speech mean below 3.0; scorecard below 70 |

Thresholds are the first defensible values. They were set against engine behaviour and a synthetic fixture, and must be recalibrated with the first professional asset. Changing them changes `configHash`, which is printed in every report.

## Hard rejection rules

| Rule | Detected by |
|---|---|
| HR-01 Childlike appearance | human |
| HR-02 Generic face | human |
| HR-03 Looks like an avatar | human |
| HR-04 Dead eyes | human |
| HR-05 Artificial mouth | human, with the speech checklist as evidence |
| HR-06 Broken speech | automatic and human |
| HR-07 Obviously artificial teeth | human |
| HR-08 Rig cannot reproduce the required expressions | automatic |
| HR-09 Strong loss of identity when speaking | automatic and human |
| HR-10 Eyes cannot be controlled | automatic |
| HR-11 Jaw cannot be controlled | automatic |
| HR-12 Required visemes cannot be executed | automatic |
| HR-13 A real person is recognisable as the origin | human |
| HR-14 Technical failure incompatible with the Asset Brief | automatic |

Automatic rules reject without waiting for a person. Human rules not yet assessed block `PASS` until the reviewer ticks "I checked every hard rule".

## Candidate comparison

`compare` ranks only candidates that are complete (every section has a value) and have no triggered hard rule. The order of importance is printed with the result, and each step of the ranking says which section separated two candidates (a difference of 3 points or more) and by how much. Candidates left out are listed with the reason (barriers, rejected, or human review incomplete).

## The Golden Review Package

`validate-head` writes, under `review/candidates/<ID>/vNNN/package/`: technical report, visual checklist, expression report, speech report, presence report, scorecard, barriers, final recommendation, `review.html` (the form), `result.json` and the PNG folders.

## What this gate does not do

It does not judge a voice, a body, clothing or the conversation. It does not replace looking at the face. FPS measured on a software renderer is not valid and is reported as such; the stills are valid.

## Current status

`HEAD-001` is `PENDING_ASSET`. No professional GLB exists in this repository. `HEAD-900` is a synthetic fixture used to calibrate the pipeline; it is not a candidate and is rejected by the automatic rules, as it should be.
