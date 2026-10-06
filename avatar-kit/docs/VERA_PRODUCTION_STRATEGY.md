# Vera Production Strategy

Internal. Written after Vera v0.1 scored 36/100. The runtime, rig pipeline, KTX2, review harness, expressions and speech are proven. The character is not. This document decides how to get the first professional Vera face.

Prices and durations are **estimates** from public guides and judgment, not quotes. Vendor facts come from search snippets and the vendors' own pages; no portfolio, speaking video or rig file was seen, so no vendor is VERIFIED.

## 1. What v0.1 taught us

| Failure | Cause | Consequence for production |
|---|---|---|
| Too young (reads early twenties) | a default base and a texture named "young female" | age must be built into the sculpt and the skin maps, not tinted afterwards |
| Generic | a parametric default face | the face must be sculpted from a design, with asymmetry |
| Game-like | flat shading, noisy brow cards, hard hairline | hair, brows and skin edges are first-class deliverables |
| No presence | A-pose, casual top, plain face | posture, wardrobe and facial structure carry authority |
| Overexposed skin | albedo without a lighting target | skin is authored against our key light, not generic |

Retire the MPFB base as a visual candidate. Keep it as a technical fixture.

## 2. Vera Production Character Specification

Base: the Character Bible (locked decisions DEC-01 to DEC-09). This section sharpens it.

**One sentence.** An original, early-to-mid forties executive woman with a long, calm, asymmetric face, deep-set warm brown eyes and a controlled mouth, who looks like she has already understood you.

| Part | Specification |
|---|---|
| Age | apparent 43 (41 to 45). Built in: soft nasolabial folds, fine horizontal forehead lines visible only with brow raise, faint crow's feet at rest, slight softening under the eye, minimal neck lines. No retouched skin |
| Proportions | long oval, length to width about 1.38:1 (Bible). Forehead medium-high and smooth. Face thirds roughly equal, the lower third slightly stronger |
| Asymmetry | 2% to 3% in the neutral mesh, in structure not just texture: left brow sits a hair higher, mouth line tilts a few degrees, one eye slightly more open |
| Brows | natural, straight to low-arched, with weight; individual hair direction, no stamped card pattern. Dark brown, slightly lighter at the tail |
| Eyes | almond, slightly deep-set, human-sized. Upper lid with a defined crease, covering about 12% of the iris at rest. Deep warm brown iris with olive-amber flecks and a dark limbal ring. Wet lower rim and tear line, a separate cornea with two soft catchlights |
| Eyelids | thick enough to read in profile, closing without intersecting the globe, lashes dark and sparse, not a lash strip |
| Nose | refined and straight, a defined but not sharp bridge, soft tip, visible alar creases |
| Cheeks | moderate cheekbones, mild volume loss under them. No exaggerated cheekbones |
| Mouth | full but real, upper lip slightly thinner, resting closed and relaxed, no resting smile. Visible lip texture, a soft wet edge |
| Jaw | defined soft jaw, proportional to the face, never square or sharp |
| Chin | proportional, neutral, no dimple |
| Skin | olive-neutral, Fitzpatrick III, warm undertone. Pores, fine vellus, redness at nose and cheeks, one or two small marks. No wax, no airbrush |
| Makeup | restrained: even tone, a trace of definition at the brow and lash line, a neutral lip |
| Hair | dark brown to near black, just below the shoulders (collarbone to mid-scapula), smooth with a soft wave, low side part. Individual flyaways, a believable hairline with baby hairs. Three to five silver strands at one temple are optional |
| Identity DNA | derived from attributes only: intelligent eyes, mature structure, controlled expression, understated beauty, authority, warmth under restraint, asymmetry, individuality |
| Forbidden | a real person's likeness, a scan, a celebrity, a known character, any recognisable existing identity (including the person who inspired the behaviour), a default MetaHuman or parametric base |

Shoulder-length versus the Bible's "below the shoulders": use **just below the shoulders**.

## 3. Three visual directions

| | A: Cinematic realism | B: Stylized cinematic | C: Premium digital human (proprietary) |
|---|---|---|---|
| What | photoreal digital human, film-grade | slightly stylized, sophisticated, human proportions, painterly skin | realistic enough to feel human, deliberately designed as our own character: clean shading, controlled imperfection |
| Strengths | maximum "a person is here" | forgives rig limits and mobile budgets, strong identity, little uncanny risk | strong identity, believable in motion, achievable in GLB |
| Weaknesses | needs scan-level detail and a deep rig; real-time web cannot deliver the skin physics | can read as animation, less authority, may look like an "avatar" | needs a very good artist; sits between two styles |
| Uncanny-valley risk | high, especially in speech | low | medium |
| Production complexity | very high | medium | high |
| Cost (estimate) | premium band | low to realistic | realistic to premium |
| Impact | highest if it works, worst if it fails | medium | high |
| Fit with Vera | authority yes, risk of dead face | authority weaker, warmth stronger | best match: restraint and presence |

**Recommend C.** Our delivery format (a GLB in a browser, no subsurface scattering, 45k triangles) cannot honestly carry A, and B undercuts the authority we need. C asks the artist for a designed, believable face and uses the browser's strengths: clean shading, good eyes, controlled asymmetry. Phase 0 asks vendors for two directions inside C (one slightly more realistic, one slightly more designed), so the face is chosen by looking, not by argument.

## 4. Production routes

Ranked on Vera's requirements: original face, face quality in CLOSE and in speech, rig quality, GLB output with no runtime dependency, rights clarity, execution risk.

| Route | Original face | Speech and rig quality | GLB and web | Rights | Verdict |
|---|---|---|---|---|---|
| 1. Custom artist or studio from concept | yes | depends on the artist; rig may be weak | needs a conversion step | clear if contracted | strong for the face |
| 2. MetaHuman-derived, customized | weak: recognisable base look, the thing we rejected | strong rig (but not ARKit shapes; conversion needed) | heavy: decimate, retarget, bake | **uncertain**: older forum answers say Unreal only; trade press reports a mid-2025 licence update allowing other engines. I could not open the EULA, so this is **PARTIALLY VERIFIED** and must be read by a person | not the base; acceptable only as a declared tool |
| 3. Reallusion Character Creator | weak: parametric base look | 140+ expression morphs, ARKit supported (declared) | FBX, OBJ, USD; GLB not confirmed | permissive export licence (declared) | same default-look problem as v0.1 |
| 4. Blender custom sculpt and rig, in house | possible | we have no sculptor on the team | good, we control it | ours | not available: no character artist here |
| 5. Digital-human specialist studio | scan-heavy; originality must be proven | strong rigs (FACS) | rarely web | clear | right for the rig, risky for the face |
| 6. Hybrid: concept, sculpt, textures, hair and clothing by one lead artist; rig by a specialist after the face is approved; GLB by us | yes | best of both | we control the end | one chain of title | **recommended** |
| 7. Other | AI image concepts for the design sheet (fine, then a human sculpts); image-to-3D and generated heads (not production quality, identity uncontrollable); Gaussian-splat or neural avatars (need a captured real person, so they break the identity rule) | n/a | n/a | n/a | use AI only for concept exploration, never as the face source |

## 5. What the creator must deliver

**Head:** custom sculpt from the design, clean deformation topology (quads, loops around eyes, brows, nostrils, mouth, folds), non-overlapping UVs, 2K skin maps (4K source), eyes as globes with separate corneas, eyelids that close without intersection, teeth, gums, tongue, a dark graded mouth interior, ears, neck.

**Hair:** just below the shoulders, dark, card-based and optimised for GLB, 3k to 12k triangles, with a believable hairline and flyaways. Source groom delivered.

**Face rig:** the **52 ARKit shapes plus the 15 Oculus visemes plus corrective shapes** (about 70 to 90 targets), eye bones or look-shapes, jaw bone or shape, brow and lid control.
Is 52 enough? **Yes for V1**, provided the 52 are individually sculpted left and right and the correctives are built for the combinations that fail (smile with jaw open, brows down with squint, funnel with jaw open). A full FACS rig (a hundred or more shapes) adds subtlety, but the browser pays for it in morph data, and Vera's acting is restrained. Decision: ARKit 52 plus 15 visemes plus correctives; ask rig candidates to price an optional FACS-extended set for later.
Budget note: three.js limits active morph targets per mesh, so the rig must be built for sparse use and tested in our runtime; the current kit already handles this on the v0.1 asset (66 targets, full grade).

## 6. Body

Do not carry the A-pose placeholder. **V1 does not need a full body.** Our shots are CLOSE, MEDIUM_CLOSE and MEDIUM; FULL is not part of the experience. Deliver **head, neck and upper torso to the waist**, arms down with the forearms out of frame.
Why: half the cost, a lighter file (mobile), fewer places to look wrong, and the face gets the budget.
Posture: seated-neutral and upright, spine tall, shoulders down and wide, neck long, chin level, torso turned 2 to 3 degrees. Bones for chest, shoulders, spine and neck to carry breathing and sway. Hands are modelled at rest quality only; they never appear in V1 shots. If FULL is ever needed it is a later, separately priced add-on.

## 7. Clothing

The Bible's dress, specified for the upper torso: **black matte crepe sheath, high jewel neckline at the base of the neck, three-quarter sleeves, tailored fit**.
- Silhouette: structured but soft; no shoulder pads, no ruffles.
- Neckline: jewel, flat, no clavicle or cleavage; a clean seam, no trim.
- Sleeve: three-quarter, fitted, a faint crease at the elbow.
- Fabric: crepe, matte (roughness 0.85 to 0.95), a fine weave in the normal map, no sheen, no logo.
- Texture and fit: shoulder seam, bust darts and a back seam visible only as shading; slight tension lines across the chest at rest.
- Movement: skinned to the spine and shoulders for breathing, with corrective shapes at the shoulders; no cloth simulation.
- Accessory: brushed-gold studs 5 mm (DEC-07). Nothing else.
It must say *status without showing status*: expensive because it is simple and fits perfectly.

## 8. Look and lighting

The cinematic look, controlled, not a movie scene. These are targets for the artist's look-development stills; our runtime lighting (executive style) is already close and is tuned against the real asset when it arrives.
| Element | Target |
|---|---|
| Key | large soft source, about 45 degrees camera-left and 20 degrees above, about 4800 K |
| Fill | low, about 2.5 stops under the key, cooler (6500 K), camera-right |
| Rim | restrained, from behind-right, about 5600 K, only enough to separate hair and shoulder |
| Skin response | no gloss: roughness 0.55 to 0.7 with slight variation; subsurface warmth painted into the albedo at ears, nose and lips; matte T-zone |
| Eye highlights | two soft catchlights, one dominant; wet lower rim |
| Background | dark warm-grey gradient, small vignette |
| Camera | about 85 mm equivalent, eye height, shallow depth of field focused on the eyes (applied in post or in the runtime, not baked into the asset) |
Skin is authored against this light; v0.1 failed partly because it was not.

## 9. The Face Quality Gate

Stricter than the 100-point score. Every test is run on the real asset, in our runtime, by a panel of at least five people who have not seen the design brief (the owner is one).
| Test | What happens | Pass |
|---|---|---|
| 10 s silent | Vera looks at the user | every viewer reads "a real adult woman"; at least 80% say they would trust her; no glitch, no stare |
| 10 s listening | the user speaks | at least 80% identify "listening" without sound; micro-nod and gaze are subtle |
| 10 s speaking | one sentence | mouth closes on p, b, m; teeth and tongue correct; the face stays the same person; mean 4.0 of 5 or more |
| 10 s disagreement | controlled disagreement | at least 80% read "disagrees, controlled", not angry or smug |
| 10 s warm | a positive response | at least 80% read "warm, restrained", not a smile mask |
The face must be believable in all five. Any viewer note of "uncanny" in two or more panelists is a fail for that test. No test mean below 3.5.

**Zoom test.** The same five scenes at CLOSE (eyes and mouth), MEDIUM_CLOSE (face and shoulders) and MEDIUM (upper body). **A face that works only at medium distance fails.**

**No-voice test.** Audio off, ten clips: listening, thinking, skeptical, concerned, confident, finished speaking (two clips each). Viewers label them. At least 5 of 6 states are identified by at least 80% of viewers. If not, the facial acting is insufficient.

**No-UI test.** Vera, camera and light only: no panel, no text, no label. Shown to ten people. At least 8 say she looks like a real person with presence. If she only impresses surrounded by UI, fail.

Technical gates (automatic) remain: the Asset Validator, the Head Gate and the review harness, as built. The scripted capture of the five 10-second scenes still has to be added when the asset exists (not now: the application is not changed in this task).

## 10. Procurement

**Role:** a **Senior Digital Human Character Artist** who owns the face (concept, sculpt, textures, eyes, hair, clothing), plus a **Facial Rig Specialist** engaged after the face is approved. A studio that employs both is acceptable if one named artist is accountable for the face.
- One person can do the face, textures and hair. Few do the rig at the quality we need, so assume two specialists.
- Separable: rig (after the sculpt is frozen), hair, wardrobe, optimisation. **Not separable:** concept and sculpt, which must stay with one artist or the identity drifts.
- A studio is better only if it can show original faces (not scans) and accepts a gated, small first purchase.

## 11. Phased production

The smallest engagement. We can reject the face before paying for anything beyond the first two phases. Changes from the classic structure: Phase 0 is judged in 3D under our light (a 2D concept can lie about identity), and a throw-away rig test of the sculpt is in Phase 1, so "good still, dead face when talking" is found before hair and clothing are paid for.

| Phase | Buy | Gate | Stop-loss if we stop here |
|---|---|---|---|
| 0 Face design proof | two directions in 3D (grey sculpt level), lit, front, three-quarter, profile, neutral plus four expression sculpts | G0: identity, age, likeness, presence | about 10% to 15% |
| 1 Head production | final sculpt, skin maps, eyes, teeth, tongue, mouth interior, look-dev stills in our light, plus a throw-away auto-rigged speaking test | G1: stills, zoom test, likeness, and the speaking test does not kill the face | about 30% |
| 2 Rig and acting | the 52 + 15 + correctives rig, eye and jaw control, delivered into our runtime | G2: the full Face Quality Gate | about 60% |
| 3 Hair and wardrobe | hair, dress, upper torso | G3: zoom test, no-UI test | about 80% |
| 4 Optimisation and GLB | meshopt, KTX2, 45k triangles, naming, source files, integration support | G4: validator, Head Gate, final panel | 100% |

Note (2026-10-05): the RFQ orders the phases as 0 face exploration, 1 head, 2 hair and upper body and dress, 3 facial rig, 4 optimisation and GLB. The throw-away speaking test stays inside Phase 1, so the speaking check still comes before hair and clothing are paid for.

## 12. Deliverables per phase

| Phase | Exact deliverable | Acceptance | Revisions |
|---|---|---|---|
| 0 | two design directions, each: 3 lit views, neutral plus skeptical, listening, firm, warm sculpts, a short design note, the likeness declaration | G0 (section 13) | 1 round on the chosen direction |
| 1 | head sculpt with final topology, UVs, skin maps (albedo, normal, roughness, a cavity or AO map), eyes, teeth, tongue, mouth interior, stills in our light, throw-away rig speaking test | G1 | 2 rounds |
| 2 | blendshapes (52, 15, correctives), eye and jaw rig, a rig sheet, the head as a GLB review build | G2 | 2 rounds |
| 3 | hair (cards plus the source groom), dress, upper torso, bones | G3 | 2 rounds |
| 4 | final GLB (meshopt, KTX2), source files, rig sheet, reference renders, validator report | G4 | 1 round |

**Terms for every phase:** full assignment of rights on payment of that phase; source and project files delivered (.blend or .ma, ZBrush, Substance, full-resolution textures, the groom); formats: GLB plus FBX plus source; **exclusivity**: no reuse of the face, hair or textures for anyone else, no derivative sold; rig, textures and any animation are ours; no hidden licence dependency; third-party tools and assets declared with origin, licence, redistributability and web-deployment limits; no AI-model training on the work.

## 13. Phase 0 acceptance (the face decision)

A direction passes G0 only if **all** hold, judged on lit stills and expression sculpts by a panel of at least five, ten strangers for the likeness and age steps:
1. Face individuality at least 4 of 5 from every panelist; "generic" from none.
2. Age: at least 8 of 10 strangers estimate 38 to 48.
3. Likeness: fewer than 2 of 10 name the same real person (two or more rejects).
4. Presence (1.5-second look, three questions): each at least 80% yes.
5. The four expression sculpts are distinguishable and subtle.
6. Visual DNA at least 8 of 10 traits (Bible) present.
7. No hard rejection rule from the scorecard (childlike, generic, avatar-like, dead eyes, artificial mouth, resemblance to a real person).
8. The artist accepts the technical requirements and the IP terms.
If the face is not Vera: **reject**. One revision round on the best direction, then stop. Do not repair a wrong identity later.

## 14. Cost model (estimates, USD; not quotes)

| Item | LOW | REALISTIC | PREMIUM |
|---|---|---|---|
| Concept and face exploration (Phase 0, two directions) | 1.5k to 3k | 4k to 9k | 10k to 20k |
| Head (sculpt, textures, eyes, mouth) | 3k to 6k | 8k to 18k | 20k to 40k |
| Facial rig (52 + 15 + correctives) | 1k to 3k | 4k to 9k | 10k to 25k |
| Hair | 1k to 2.5k | 3k to 8k | 8k to 15k |
| Clothing | 0.8k to 2k | 2.5k to 6k | 6k to 12k |
| Upper torso and bones | 1k to 2k | 2k to 4k | 5k to 10k |
| Animation (idle, acting clips) | 0.5k to 1.5k | 2k to 4k | 5k to 10k |
| Final optimisation and GLB | 1k to 2k | 2k to 4k | 4k to 8k |
| **Full production** | **about 10k to 22k** | **about 28k to 62k** | **about 70k to 140k** |
Basis: public guides put studio-quality realistic rigged characters at roughly 4k to 10k and show hobby-level heads and rigs at a few hundred to a couple of thousand; Vera's requirement (a talking close-up face) is above a typical game character, hence the higher bands. Add 10% to 15% contingency. Phase 0 for two vendors: about 8k to 18k realistic.

## 15. Timeline (estimates, weeks)

| Step | LOW | REALISTIC | PREMIUM |
|---|---|---|---|
| Concept (Phase 0) | 2 | 2 to 3 | 4 |
| Head (Phase 1) | 3 to 4 | 4 to 6 | 8 |
| Rig (Phase 2) | 2 to 3 | 3 to 5 | 6 to 8 |
| Hair (parallel, after G1) | 2 | 2 to 4 | 5 |
| Wardrobe (parallel, after G1) | 1 to 2 | 2 to 3 | 4 |
| Optimisation (Phase 4) | 1 to 2 | 2 to 3 | 4 |
| Integration (ours) | 1 | 1 to 2 | 2 |
**Total:** low 10 to 14, **realistic 14 to 22**, premium 24 to 34 weeks. **Critical path:** G0, then head, then rig, then the acting tests, then optimisation. Hair and wardrobe run in parallel after G1. The risk is revision loops at G0 and G1 and rig speech quality at G2.

## 16. Vendor shortlist

Evidence is from search results and the vendors' own pages. No portfolio, speaking video or rig file was seen. UNKNOWN is a real answer.

| | Roarty Digital | Mimic Productions | Eisko | Snappers Systems | Polywink |
|---|---|---|---|---|---|
| Country | Canada | Germany | France | Egypt | France |
| Capability | characters from concept to delivery, realistic and stylized, hair, rigging | digital humans, expression-scan blendshape rigs, character services | digital humans, FACS rigs, a rig-on-demand service | facial rigging, character art and look development, facial mocap | automatic blendshapes and rigs for any head |
| Portfolio evidence | UNKNOWN (not seen) | UNKNOWN (not seen) | a free scanned head ("Louise", reported 236 shapes) can be inspected | UNKNOWN (credits reported by press: AAA games and a feature film) | UNKNOWN |
| Digital-human experience | UNKNOWN | declared | declared | declared | n/a (rig only) |
| Facial rig | declared rigging team; ARKit and visemes UNKNOWN | declared; ARKit UNKNOWN | strongest declared | declared FACS rig; ARKit UNKNOWN | ARKit set plus visemes declared; counts differ between sources: UNKNOWN |
| Real-time | Unreal grooms declared | Unity and Unreal declared | Maya and Unreal declared | declared | Unity declared |
| Web and GLB | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | FBX declared; glTF UNKNOWN |
| Originality | concept-based (declared) | scan and likeness work is public: must prove an original face | scan-based: must prove | UNKNOWN | n/a |
| Project class | studio (200+ people reported): minimum size UNKNOWN | studio | studio | studio | service |
| Evidence level | PARTIALLY VERIFIED | PARTIALLY VERIFIED | PARTIALLY VERIFIED | PARTIALLY VERIFIED | PARTIALLY VERIFIED |
| Role | **lead character (Phases 0, 1, 3)** | **lead character, alternative** | **rig specialist (Phase 2)** | **rig specialist, alternative** | **throw-away rig test in Phase 1; fallback rig** |

Dropped: IMPERSONAS (no site found, MetaHuman-based: UNVERIFIED). Freelancers cannot be named without seeing portfolios; the RFQ also goes to two or three individually vetted senior freelancers if the owner wants more options.

## 17. Decision

See the final report. The RFQ is `VERA_RFQ_TEMPLATE.md` and replaces `HEAD_001_RFQ.md` for the new strategy (the old documents stay as history).
