# Request for Quotation: Original Executive Character, Real-Time Head

**From:** [COMPANY]
**Contact:** [NAME, EMAIL]
**Date:** [DATE]
**Reply by:** [DATE]
**Confidentiality:** [NDA available on request / attached]

## 1. Project overview

[COMPANY] is building a conversational product in which an AI executive adviser appears as a single recurring character, on screen, speaking, in a web browser, in real time. The character is shown almost entirely in close-up. Her face is the product: if it fails when she speaks, the product fails.

We are looking for an artist or studio to create her head. We start with a paid design proof (Phase 0). Only a direction we approve moves on to production of the real-time head (Phase 1). We are not asking for free work, and we will not ask for the full head before we have seen whether your design is the right one.

The body, clothing, voice and the product itself are out of scope. This request is only about the face.

## 2. Character overview

Vera Halden (working name) is an original character: a woman of 43, an executive of the highest level. She has spent twenty years listening to people explain things politely, and she notices what is not being said. She is calm, exact and unhurried. She is not warm in the way a salesperson is warm, and not cold. She is believable as a real adult who has authority.

She must not be a generic 3D face, a "stock avatar", a young or rounded face, or a smiling default. The Asset Brief (11 parts, attached) is a requirement, not inspiration. Please read Part 1 first.

## 3. Visual direction

The Asset Brief, Parts 1 to 8, is the authority: proportions, skin, eyes, brows, mouth, hair, ten visual DNA traits and the expression targets. We do not want a new interpretation of the character; we want your best interpretation of this one. Expressions are small. A viewer should notice her face before they notice her expression.

## 4. Deliverables

### Phase 0: design proof (paid)

- two to three face design directions
- for each: front view, three-quarter view, and expression samples (neutral, listening, thinking, skeptical, firm)
- for each: your visual interpretation of the Brief in a short note, with what you chose and why
- a short speaking test of the new head if you can; if you cannot yet, a speaking clip of an existing, rigged character of yours (clearly labelled), driven by our timeline
- the render conditions in the attached Vendor Test (Tests A, B, E; C and D if available)

The aim is to learn whether you can create Vera. It is not a production head.

### Phase 1: head production (only after approval of one direction)

- production head and neck, with eyes, eyelids, mouth, teeth, tongue and basic hair
- facial rig: the 52 ARKit blendshapes and the 15 Oculus visemes, eye and jaw control
- one `.glb` with meshopt compression and KTX2 textures
- source files, rig sheet, reference renders
- a video of the head speaking (front, three-quarter, neutral, speaking, expression transition)

The exact technical requirements are in the attached HEAD-001 Delivery Spec. Summary: 45,000 triangles or fewer, 6 MB target and 8 MB hard limit, three.js r147 `GLTFLoader` and `MeshoptDecoder` with no custom loader, no proprietary runtime.

## 5. Technical requirements

| | |
|---|---|
| Format | self-contained glTF 2.0 binary |
| Compression | `EXT_meshopt_compression`; textures KTX2 |
| Budget | 45,000 triangles, 6 MB target, 8 MB hard |
| Loading | deterministic, no scripts, no runtime generation |
| Dependencies | none proprietary; the GLB must work on its own |
| Check | we run the file through our validator and send you the report |

## 6. Animation requirements

Our engine composes expressions from the ARKit channels at low weights. It does not use pre-made emotion poses. For that to work, every ARKit shape must be sculpted separately for left and right, subtle shapes (brow raise, nose sneer, jaw clench, mouth press) must be good, combinations must hold up, and the visemes must be sculpted with teeth and tongue. Eyes must be controllable, lids must follow the gaze, and the jaw must move without tearing the lips.

## 7. Speech test

> THE PRIMARY ACCEPTANCE TEST IS THE CHARACTER SPEAKING.
> A beautiful still render that fails during speech is a failure.

We test with one sentence:

"Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it."

We give you a fixed phoneme timeline (13.6 seconds, no voice). You send us a continuous video of the head speaking it, front and three-quarter. We check that lips close on p, b and m, that teeth and tongue read correctly, that cheeks, chin and nostrils move, that the eyes do not change, and that she does not become a different person while talking. A head that is good still and poor speaking is rejected. The video is required before final approval of Phase 1.

## 8. Ownership and IP

We require all of the following. If you cannot agree to any one of them, please say so in your reply instead of leaving it out.

- The character is created from scratch.
- No likeness of a real person, and no scan, photo or recognisable features of a real person, at any stage.
- No copyrighted character, and no resemblance to one.
- No third-party character asset, unless declared and permitted (see below).
- Full commercial rights, worldwide, perpetual, all platforms and media, including real-time, interactive, AI-driven and promotional use.
- Source and project files are included.
- The rights are transferable.
- Permission to deploy on the web.
- Permission to modify.
- Permission for future rigging and animation, by us or by anyone we choose.
- No hidden license dependency: nothing in the delivered work may require a licence, subscription or service that we do not hold.
- No use of the work, its source or its derivatives to train or improve generative AI models without our written consent.

### If you propose MetaHuman, Character Creator, a marketplace asset or another proprietary framework

We do not reject this automatically. We need you to declare, in writing, for every such component:

1. where the asset comes from
2. its licence
3. whether it may be redistributed
4. the commercial rights we would get
5. any restriction on web deployment
6. whether the final GLB can be used independently of that framework, with no runtime, plugin or subscription

Without these answers we cannot evaluate the proposal.

## 9. Originality requirements

Please state how you create the face: concept, sculpt, references used. We need the face to be new. We will run a likeness test: viewers who have not seen the Brief are shown the neutral face and asked whether it reminds them of a real person. If a clear majority name the same person, the design is rejected. A generic face is also rejected.

## 10. Milestones

Payments are tied to these gates. Amounts are yours to propose.

| Milestone | What | Gate |
|---|---|---|
| M0 | Phase 0 design proof | we choose one direction or none |
| M1 | blockout and proportions | our review |
| M2 | sculpt and textures | turntable under three lights, our review |
| M3 | rig and morph targets | validator report attached; the speaking video |
| M4 | Phase 1 delivery | our test and one consolidated feedback list |
| M5 | revision rounds, then approval | written approval |

State how many revision rounds your price includes.

## 11. Acceptance criteria

Phase 0 moves to Phase 1 only if all of these are true:

- the visual identity is approved
- the face is approved
- the executive presence is approved
- no real-person likeness
- the visual DNA is kept
- the speaking test is acceptable, when it is available
- you accept the technical requirements
- the IP terms are agreed

If the face is not Vera, the proposal ends there. We will not try to repair a wrong facial identity later.

Phase 1 is accepted on our review process: a technical validation of the GLB, a fixed set of still shots, a speech test, expression checks, a 1.5-second presence test, and a human review. Speech counts more than stills. The final score must reach 85 of 100 with no serious fault. Between 70 and 84 we return a numbered fix list.

## 12. Required portfolio evidence

Please send:

1. at least one **video of one of your characters speaking**: a line of about ten seconds, mouth and eyes in close-up, no editing. A turntable does not count.
2. two realistic close-up faces of adult women, with the facial rig, from your own work
3. a **rigged file** (GLB, FBX or .blend) from a previous project with ARKit shapes and visemes, even in another style. We will run it through our validator and send you the report
4. your pipeline and tools

## 13. Questions for you

1. Who sculpts, who rigs and who textures? Are they the people who made the portfolio you sent?
2. How do you create the face: from concept, from a base mesh, from a preset, from anything else? Name each.
3. Which tools and which licences? Do you use MetaHuman, Character Creator or another framework?
4. How will you export the GLB (exporter, compression, version)? Have you delivered to a browser before?
5. How do you author visemes, and how do you keep teeth and tongue correct?
6. How do you stop skin from looking like plastic?
7. Is anything in the Brief or the Delivery Spec unrealistic or unclear?
8. Do you accept the validator and the scorecard as the acceptance criteria?
9. Do you accept the terms in section 8?

## 14. Pricing request

For **Phase 0** (paid design proof), please quote:

- a fixed price
- the estimated duration
- the number of revisions included
- the exact deliverables
- who owns the Phase 0 work
- the price credit if we move to Phase 1 with you: how much of the Phase 0 fee converts

For **Phase 1**, an indicative fixed price with milestones and revision rounds. We will confirm after Phase 0.

We do not choose on price. We do need the price to be fixed and clear.

## 15. Timeline request

Please give us:

- your earliest start date
- how long Phase 0 takes
- how long Phase 1 takes after approval
- how fast you answer questions (we answer yours within two working days)

## 16. What we provide

The Asset Brief, the HEAD-001 Delivery Spec, the Vendor Test with the speech timeline, our validator and a test file that shows the naming and rig structure we expect, and a contact who replies within two working days. We do not provide photographs or reference faces of real people, and you must not use any.

## 17. How we will decide

We compare submissions anonymously. We look at the speech first. Nothing here is a commitment to buy; it is a request for information and a quote. Sending an answer does not oblige either of us.

Thank you for your time.

[NAME]
[COMPANY]
