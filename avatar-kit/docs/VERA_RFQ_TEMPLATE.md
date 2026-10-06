# Request for Quotation: an original executive character for real-time web

**From:** [COMPANY] · **Contact:** [NAME, EMAIL] · **Date:** [DATE] · **Reply by:** [DATE]
**Confidentiality:** [NDA attached / available on request]

Please fill in the bracketed items before sending. Nothing else in this document needs to change.

## 1. The project

[COMPANY] is building a conversational product in which one recurring character, an executive advisor, speaks to the user on screen, in a web browser, in real time. She appears almost only in close-up. Her face is the product, and it has to hold up while she listens, thinks, disagrees and speaks.

We need an **original** character: not a template, not a scan and not a likeness. We will buy the work in gated phases, so that **we can stop after the face if it is not right**. This request asks for evidence and a quote. It is not an offer to buy.

## 2. The character

A woman of apparent age 41 to 45: calm, observant, controlled, warm under restraint, with the authority of someone who is rarely the loudest person in the room. A long, asymmetric face; deep-set almond brown eyes with olive-amber variation; a mouth that is serious at rest and never smiles by default; olive skin (Fitzpatrick III); dark hair just below the shoulders; a restrained matte black dress with a high neckline. She must look like a specific individual, not a beautiful generic woman.

She must not resemble any real person, actor or existing character. The attached Asset Brief has the full design requirements. A full body is not required: head, neck and upper torso to the waist.

## 3. Phase 0 is a paid face exploration, not the full character

**We are not commissioning the complete character at this stage.** We are commissioning a paid exploration of the face, so we can choose the face before any production.

**Phase 0 deliverables:**
- two or three distinct face directions;
- for each, a **3D grey sculpt** (a clean, lit sculpt without final textures);
- views: **front, three-quarter and profile**;
- expression sculpts: **neutral, listening, skeptical, firm, warm**;
- a **design rationale** for each direction (what you decided and why).

The aim is to select the face. Directions must be genuinely different from each other.

## 4. Phases and how to quote them

Please quote each item **separately**, so we can stop at any gate:

| Phase | Scope |
|---|---|
| **Phase 0** | face exploration, as in section 3 |
| **Phase 1** | the approved head: final sculpt and topology, UVs, skin maps, eyes, eyelids, teeth, tongue, mouth interior, stills in our lighting, and a throw-away rigged test of the head speaking (to check the face before we continue) |
| **Phase 2** | hair (just below the shoulders, dark, card-based), the dress, and the upper body |
| **Phase 3** | the facial rig and expressions: the 52 ARKit shapes, the 15 Oculus visemes, corrective shapes, eye and jaw control (this phase may be done by a specialist you name) |
| **Phase 4** | optimisation and delivery: one GLB with meshopt compression and KTX2 textures, 45,000 triangles or fewer, plus all source files |
| **Optional** | a full-production package covering Phases 1 to 4 |

We continue to the next phase only when the previous one is approved. We pay per phase, on its gate.

## 5. Technical requirements

glTF 2.0 binary, `EXT_meshopt_compression`, KTX2 textures, 6 MB target and 8 MB hard limit for the head, three.js r147 `GLTFLoader` and `MeshoptDecoder` with no custom loader, no proprietary runtime or plugin. Y up, metres, ASCII names stable across versions. ARKit names for the 52 shapes, Oculus names for the visemes. Teeth and tongue are separate meshes that follow the jaw and visemes. We check each delivery with our own validator and send you the report.

## 6. How we judge the work

**The primary acceptance test is the character speaking.** A beautiful still that fails during speech is a failure. Faces are reviewed at three camera distances, with the audio off, and with no interface around them: silent, listening, speaking, controlled disagreement and a warm response. For Phase 0 we judge the identity: individuality, apparent age, executive presence, and that no real person is recognisable. If the face is not right we stop, we do not repair a wrong face later.

## 7. Originality, tools and disclosure

Please confirm and describe:
- the character is original, with **no celebrity likeness, no scan of a real person, no recognisable existing character, and no unauthorised AI-generated likeness**;
- whether you use **generative AI** at any step (and if so, where and which tools);
- whether you use **external asset libraries, scans, third-party models, or bases** such as MetaHuman or Character Creator;
- whether any training data, reference faces or likenesses are used.

**Any third-party dependency must be disclosed.** We do not reject MetaHuman, Character Creator or marketplace assets automatically. For each, declare: origin, licence, whether it can be redistributed, the commercial rights we would hold, any web-deployment restriction, and whether the final GLB works independently of that framework.

## 8. Rights and ownership

We require, and ask you to confirm each item:
- **exclusive** worldwide commercial rights, perpetual, all platforms and media, including real-time, interactive and AI-driven use; no reuse of the face, hair or textures for anyone else;
- delivery of **all source files**: sculpt files, texture files (full resolution), hair source where applicable, rig source where applicable, the exported GLB and the project files;
- rights are transferable; we may modify, rig and animate the work, or have others do so;
- permission to deploy on the web;
- no hidden licence dependency: nothing may require a licence, subscription or service we do not hold;
- no use of the work or its derivatives to train generative AI models without our written consent.

## 9. Questions we need answered

1. Who specifically will sculpt Vera?
2. Can we see close-up examples of faces created by that artist?
3. Can we see mature female characters?
4. Can we see facial animation?
5. Can we see a speaking character?
6. Do you create original faces from written references?
7. Do you use scans?
8. Do you use MetaHuman, Character Creator or other bases?
9. Can you deliver ARKit-compatible blendshapes?
10. Can you deliver GLB/glTF?
11. Can you provide all source files?
12. What commercial rights transfer to us?
13. Is the character exclusive?
14. What third-party assets are used?
15. What is the Phase 0 price?
16. What is your estimated full-project range?
17. Who works on the project?
18. What is the expected timeline?
19. How many revision rounds are included?
20. What happens if the face does not pass our acceptance gate?

## 10. Evidence to send with your reply

Before any award we need to see:
- close-up renders of faces **by the artist who would sculpt Vera**, with wireframe or topology, adult women included, at least one mature (about 40 to 50), no post-processing;
- evidence that you can build an original face: a **before and after of a sculpt**, a design sheet or turntable of a character you created from scratch;
- facial animation and **one video of a character speaking**, mouth and eyes in close-up, one take, no cuts;
- a rigged file (GLB, FBX or .blend) from a previous project with ARKit shapes and visemes, even in another style, which we will run through our validator;
- your GLB/glTF experience (exporter, compression, version), or how you would hand off to us;
- the named team and what each person does;
- two client references if you can share them.

## 11. Price and time

Please give: a **fixed price for Phase 0** (what it includes, how many revision rounds, who owns the Phase 0 work, and how much of the fee converts into Phase 1 if we continue); a price or range for each later phase and for the full project; the duration of each phase; and your earliest start. [PHASE 0 BUDGET CEILING: state one here if you want to.] We reply to your questions within two working days.

## 12. What happens after your reply

We compare replies without vendor names, starting with the speaking and face evidence. Price is not shown during that review. We may ask you for a call. We will tell you our decision whether or not you are selected.

Thank you for your time.

[NAME], [COMPANY]
