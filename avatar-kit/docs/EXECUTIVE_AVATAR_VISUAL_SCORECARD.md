# Visual Scorecard: Vera Halden

**Resumo em português:** é o formulário de avaliação **visual** (100 pontos), complementar à nota técnica do validador. Pontua o que o código não vê: rosto, olhos, expressão, presença, identidade, pele, cabelo, roupa e qualidade cinematográfica. **Barreiras** reprovam o asset qualquer que seja a nota (rosto genérico, olhos mortos, aparência infantil, avatar genérico, sem presença executiva, parecido com uma pessoa real...). Aprovar exige **quatro frentes juntas**: qualidade visual + presença executiva + identidade + validação técnica. Está em inglês porque o fornecedor deve saber como será avaliado; as tabelas são geradas de `tools/visual-scorecard-data.js`.

---

## 1. How approval works

| Front | Pass condition | Where measured |
|---|---|---|
| **Visual quality** | Score **85 or more**, **no barrier**, no item below 3 | this scorecard |
| **Executive presence** | The three 1.5 s questions each have **80% "yes" or more** | section 5 below |
| **Character identity** | I1 to I4 each **4 or more**; no barrier B1, B6, B7, B12 | items I1 to I4 |
| **Technical validation** | Validator: **no gate failed** and **85% or more** of the 54 automatic points | `ASSET_ACCEPTANCE_TEST.md` |

All four, at the same time. A high score in one front never compensates for a failure in another.

Outcomes: **ACCEPT** (all four pass) · **REVISE** (visual 70 to 84, no barrier, no item below 2, other fronts at least close: return with a numbered fix list, max two rounds) · **REJECT** (any barrier, or visual below 70, or an item at 1 or less).

## 2. Weights and why

The suggested structure (face 25, eyes 15, hair 10, skin 10, expression 15, presence 15, clothing 5, cinematic 5) was adjusted for one reason: **character identity is one of the four approval fronts and had no points**. Face, hair and skin each gave a little, and expression and presence one point each, to create an IDENTITY category of 8. Face + eyes + skin + hair together stay at 54, so the face remains the priority.

<!-- BEGIN:vcategories -->
| Category | Points | Items |
|---|---|---|
| FACE | 22 | 6 |
| EYES | 15 | 5 |
| EXPRESSION | 14 | 6 |
| PRESENCE | 14 | 5 |
| IDENTITY | 8 | 4 |
| SKIN | 9 | 6 |
| HAIR | 8 | 5 |
| CLOTHING | 5 | 4 |
| CINEMATIC | 5 | 4 |
| **Total** | **100** | 45 |
<!-- END:vcategories -->

## 3. Items

Scored 0 to 5 per reviewer (anchors in section 4). `Phases`: 0 = concept stills, 1 = real-time head, 4 = final character. In a phase, only the applicable items count: category points = weight × (sum of applicable scores) / (5 × number of applicable items).

<!-- BEGIN:vitems -->
### FACE (22 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| F1 | Proportions and structure follow the Bible (ratios, jaw, chin, cheekbones, nose, brows) | 0, 1, 4 |
| F2 | The face is a specific person with character, not a type | 0, 1, 4 |
| F3 | Perceived age 43: lived-in, not retouched, not older or younger | 0, 1, 4 |
| F4 | Natural asymmetry (2 to 3%) present in the neutral mesh | 0, 1, 4 |
| F5 | Lips with volume; real teeth, tongue and mouth interior | 1, 4 |
| F6 | Close-up quality: silhouette, topology, no defects at CLOSE | 1, 4 |

### EYES (15 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| E1 | Shape, size, lids and rest aperture (12% of iris) follow the Bible | 0, 1, 4 |
| E2 | Iris depth, sclera, cornea, catchlight: the eye is alive, not painted | 0, 1, 4 |
| E3 | Lids with thickness, lashes, wet line, soft lid shadow | 0, 1, 4 |
| E4 | Gaze in motion: micro-saccades, independent eyes, lids follow gaze, no stare | 1, 4 |
| E5 | The six messages are readable without speech (listening, thinking, caught-it, disagree, rationalizing, continue) | 1, 4 |

### EXPRESSION (14 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| X1 | One face, ten expressions (overlay test): never ten different faces | 1, 4 |
| X2 | Subtlety: every state within the amplitude table, none exaggerated | 1, 4 |
| X3 | Asymmetric states (skeptical, thinking, confident) work | 1, 4 |
| X4 | Combinations and transitions are clean: no collapsing corners, no popping | 1, 4 |
| X5 | Speaking reads as speech: closures p/b/m, f/v, teeth, tongue; not a mouth flap | 1, 4 |
| X6 | Rest-state life: breath, blinks, micro-movement without fidgeting | 1, 4 |

### PRESENCE (14 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| P1 | 1.5 s test, Q1: "a person you would take seriously" | 0, 1, 4 |
| P2 | 1.5 s test, Q2: "capable of advising a CEO" | 0, 1, 4 |
| P3 | 1.5 s test, Q3: "would have the courage to disagree with him" | 0, 1, 4 |
| P4 | First impression: "the smartest person in the room" | 0, 1, 4 |
| P5 | Posture and stillness: composed, comfortable being looked at | 1, 4 |

### IDENTITY (8 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| I1 | Originality: likeness test (fewer than 2 of 10 name the same real person) | 0, 1, 4 |
| I2 | Consistency: the same woman across 3 lights, 3 shots, 10 expressions, speaking | 1, 4 |
| I3 | Visual DNA coverage (traits present out of 10, scaled to 0-5) | 0, 1, 4 |
| I4 | Blind comparison: reviewers pick her as a premium character over generic avatars | 0, 1, 4 |

### SKIN (9 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| S1 | Tone and colour variation follow the Bible (redness, cool under-eye) | 0, 1, 4 |
| S2 | Roughness varies by zone; speculars broad and rolled off | 1, 4 |
| S3 | Pores, fine lines, micro-wrinkles, one or two marks | 0, 1, 4 |
| S4 | Subsurface warmth painted at ears, nostrils, eye corners | 1, 4 |
| S5 | The same skin under all three lighting styles | 1, 4 |
| S6 | No plastic, no wax, no noise-on-flat-colour | 0, 1, 4 |

### HAIR (8 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| H1 | Reads as hair: volume, depth, layering; no helmet, no ribbons | 0, 1, 4 |
| H2 | Hairline, low side part, baby hairs, a handful of flyaways | 0, 1, 4 |
| H3 | Satin anisotropic sheen, no mirror gloss | 1, 4 |
| H4 | Motion: small damped lag with the head | 4 |
| H5 | Survives close-up: no visible card seams, clean alpha | 1, 4 |

### CLOTHING (5 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| C1 | Cut and silhouette follow the Bible (sheath, jewel neckline, three-quarter sleeves, below the knee) | 0, 4 |
| C2 | Matte crepe, real drape, micro-wrinkles, black not pure black | 4 |
| C3 | Reads as top-level executive: not a blazer avatar, not sexualised, not futuristic | 0, 4 |
| C4 | Accessories: only the 5 mm gold studs | 0, 4 |

### CINEMATIC (5 points)

| # | Item (score 0 to 5) | Phases |
|---|---|---|
| Q1 | Lighting reads as portrait light in all three styles | 0, 1, 4 |
| Q2 | Camera and composition: CLOSE, MEDIUM, FULL as specified | 1, 4 |
| Q3 | Materials respond to light believably (skin, hair, eyes, fabric) | 1, 4 |
| Q4 | Overall polish at 1080p and in motion: it looks like film, not like a render | 1, 4 |
<!-- END:vitems -->

## 4. Scoring anchors

| Score | Meaning |
|---|---|
| **0** | Absent or wrong; breaks the illusion at once |
| **1** | A visible defect that a viewer notices without looking |
| **2** | Noticeable and bothersome; fixable |
| **3** | Acceptable but generic: "fine for an avatar" (this is **not** a pass for a premium character) |
| **4** | Good, professional production quality |
| **5** | Exceptional: holds a cinema close-up |

Rule: a 3 across the board is *generic*, not *good*. The review is calibrated to find the difference.

## 5. The 1.5 second presence test (P1 to P3)

Clip: body still, breathing, looking into the camera, not speaking, not smiling, 1.5 s, CLOSE, executive style. At least 5 reviewers, 2 of them senior executives who are not on the project. Ask in this order, answer yes or no, no discussion until all have answered:

1. **"Does she look like a person you would take seriously?"**
2. **"Does she look capable of advising a CEO?"**
3. **"Does she look like someone who would have the courage to disagree with him?"**

Convert the share of "yes" to the item score:

<!-- BEGIN:vyes -->
| Share of reviewers answering "yes" | Item score |
|---|---|
| 100% | 5 |
| 90% or more | 4.5 |
| 80% or more | 4 |
| 60% or more | 3 |
| 40% or more | 2 |
| below 40% | 0 |
<!-- END:vyes -->

If any question falls below 80%, barrier **B5** is triggered. **If the answer is no, the design is wrong.**

## 6. Barriers (REJECT, whatever the score)

<!-- BEGIN:vbarriers -->
| # | Barrier (REJECT, whatever the score) | Trigger |
|---|---|---|
| B1 | **Generic face** | A majority of reviewers call the face generic or stock, or fewer than 80% pick her in the blind comparison (I4) |
| B2 | **Dead eyes** | E2 or E4 scores 1 or less, or 40% of reviewers call the eyes dead, glassy or painted |
| B3 | **Childlike appearance** | A majority say she looks young or childlike, or the median apparent age is under 30 |
| B4 | **Generic-avatar appearance** | 40% or more say "avatar", "game character", "cartoon" or "mannequin" |
| B5 | **No executive presence** | Any of the three 1.5 s questions has fewer than 80% "yes" |
| B6 | **Resembles a real person** | Two or more of 10 viewers name the same real person (I1) |
| B7 | **Doll, porcelain or perfect symmetry** | F4 scores 1 or less, or reviewers use "doll", "porcelain", "perfect" |
| B8 | **Plastic skin** | S6 or S2 scores 1 or less |
| B9 | **Helmet or ribbon hair** | H1 scores 1 or less |
| B10 | **Smiling by default** | The neutral mouth reads as smiling, pressed or sad to a majority of reviewers |
| B11 | **Dead or uncanny when speaking** | X5 scores 1 or less (mouth flap, no teeth or tongue, closures that do not close) |
| B12 | **Ten different faces** | X1 or I2 scores 1 or less (expressions or lights change who she is) |
| B13 | **Uncanny moment** | 40% of reviewers mark any frame of the guided review as unsettling |
| B14 | **Departure from the Bible** | Skin tone, hair, dress or accessories contradict locked decisions without written approval (any matching item at 1 or less) |
<!-- END:vbarriers -->

## 7. Procedure

**Reviewers.** At least 5: the owner, 2 other internal reviewers, and 2 external senior executives. Each scores alone, in writing, before any discussion. Use the **median** per item. If two reviewers differ by more than 2 points on an item, discuss and re-score that item only. The owner holds the final veto.

**Sessions** (in this order, with the Avatar Lab for phases 1 and 4; concept renders and clips for phase 0):
1. **Stills**: the design sheet or screenshots, three lighting styles, three shots.
2. **1.5 s presence test** (section 5).
3. **Guided review**: neutral, listening, thinking, analyzing, firm, skeptical, empathy, confidence, speaking with phoneme-driven lip sync, audio-only lip sync, eye tracking, blinking, the presence sequence.
4. **Blind comparison** (I4): the render next to three generic avatars from commercial products; reviewers pick the "premium character" without knowing which is ours. 80% must pick ours.
5. **Likeness test** (I1, B6): 10 people with no context, "who does she look like?". Two or more naming the same real person: barrier B6.
6. **Identity consistency** (I2): pairs of frames from different lights, shots, expressions and speech; "same person?" must be yes every time.
7. **Overlay test** (X1): the ten expressions superimposed at 50%: one face with small differences.
8. **Visual DNA check** (I3): count the ten traits present; score = traits ÷ 10 × 5.

**Evidence.** Each reviewer notes, for every item at 2 or below, the frame, the expression or the shot where it fails. The consolidated list becomes the numbered fix list sent to the vendor.

## 8. Relation to the Avatar Lab rubric

The Asset Validation section of the Avatar Lab has a 13-item quick rubric (46 of the validator's 100 points). It is the fast form of this scorecard, for use while you review in the Lab. They must agree on direction: if the Lab says "premium" but a barrier here is triggered, **the result is REJECT**.

| Lab item | Scorecard item |
|---|---|
| Proportions, jaw, chin, cheekbones, nose | F1, F2 |
| Skin: pores, variation, no plastic | S1, S3, S6 |
| Lips, teeth, tongue, mouth interior | F5 |
| Asymmetries and imperfections | F3, F4 |
| Legible micro-expressions | X1, X2, X3 |
| Authority, intelligence, serenity | P4 |
| Iris, sclera, cornea, catchlight | E2 |
| Alive gaze | E4 |
| The gaze communicates the states | E5 |
| Skin under the three lights | S5 |
| Eye reflection, fabric, no excess gloss | Q3, C2 |
| Looks like hair | H1 |
| Lip sync | X5 |

## 9. Record template

```
Asset: ____________   Version: ______   Phase: 0 / 1 / 4   Date: ________
Reviewers: ______ (owner), ______, ______, ______ (exec), ______ (exec)

FACE      F1 _  F2 _  F3 _  F4 _  F5 _  F6 _        category points: __ / 22
EYES      E1 _  E2 _  E3 _  E4 _  E5 _              category points: __ / 15
EXPRESSION X1 _ X2 _  X3 _  X4 _  X5 _  X6 _        category points: __ / 14
PRESENCE  P1 _ (yes __%)  P2 _ (yes __%)  P3 _ (yes __%)  P4 _  P5 _      __ / 14
IDENTITY  I1 _ (names __/10)  I2 _  I3 _ (traits __/10)  I4 _ (picked __%)  __ / 8
SKIN      S1 _  S2 _  S3 _  S4 _  S5 _  S6 _        category points: __ / 9
HAIR      H1 _  H2 _  H3 _  H4 _  H5 _              category points: __ / 8
CLOTHING  C1 _  C2 _  C3 _  C4 _                    category points: __ / 5
CINEMATIC Q1 _  Q2 _  Q3 _  Q4 _                    category points: __ / 5

TOTAL __ / 100        Lowest item: ___ (score __)
Barriers triggered: none / B__ ___________
Technical validation: gates failed __, automatic points __ / 54 (__%)
FRONTS: visual [ ]  presence [ ]  identity [ ]  technical [ ]
DECISION: ACCEPT / REVISE (fix list attached) / REJECT        Owner: ________
```
