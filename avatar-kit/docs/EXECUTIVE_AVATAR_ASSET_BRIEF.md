# Asset Brief: Vera Halden, a proprietary executive character (real-time, web)

**Resumo em português (para quem envia):** este é o pacote que você entrega ao artista ou estúdio. Está em inglês por ser a língua franca do mercado. Tem 11 partes: a personagem, a direção de arte, rosto, cabelo, pele, roupa, expressões, linguagem cinematográfica, a especificação técnica, o teste de aceitação e a entrega. As Partes 1 a 8 vêm do `EXECUTIVE_AVATAR_CHARACTER_BIBLE.md` por geração automática (`node tools/gen-docs.js`), **sem** a referência interna de comportamento; não edite os trechos gerados à mão, edite a Bible. Preencha os campos `[entre colchetes]`. Não anexe fotos de pessoas reais.

> The sections marked *generated* are copied from the character bible so there is one source of truth. Everything in this brief is requirement, not suggestion, unless it says "optional" or "suggested".

---

## PART 1: CHARACTER

We are not asking for "a beautiful 3D woman". We are asking for **a specific character**: who she is determines how she looks, moves and speaks. Read this part first.

She is the visual layer of an AI executive assistant. She listens, thinks, challenges, empathises and speaks, in a browser, in real time, mostly in **close-up**. **The face is everything.** If there is a trade-off between body detail and facial quality, facial quality wins. She must never resemble any real person, actor or existing character: do not use photos or scans of real people as the face source.

### Decisions and identity *(generated)*

<!-- BEGIN:bible0 -->
| ID | Decision | Value | Why |
|---|---|---|---|
| DEC-01 | Working name | **Vera Halden** (alternates: Nora Calder, Ada Sorel). Trademark and name search pending. | "Vera" means *true*: she will not lie to you. "Halden" is short, neutral and serious. Not a real public figure to our knowledge: **to be checked** |
| DEC-02 | Apparent age | **43** (range 41 to 45) | Authority and experience without rigidity; readable at close range |
| DEC-03 | Skin | **Olive-neutral, Fitzpatrick type III**, warm undertone, ethnicity deliberately not tied to one origin | A tone that carries cinematic light well, chosen on its own merits |
| DEC-04 | Eye colour | **Deep warm brown with olive-amber flecks** | Reads as dark and attentive on camera; high iris/sclera contrast |
| DEC-05 | Hair | **Dark brown (almost black), below the shoulders, smooth with a soft wave, low side part** | Frames the face without capping it; see Part 4 |
| DEC-06 | Dress | **Black matte crepe sheath, high jewel neckline, three-quarter sleeves, below the knee** | Executive, restrained, nothing to look at except her |
| DEC-07 | Accessories | **Small brushed-gold studs (5 mm). Nothing else.** | A single human detail |
| DEC-08 | Silver strands | **Optional:** three to five fine silver hairs at one temple | Age and honesty; owner may delete |
| DEC-09 | Smile policy | **No resting smile.** Smiles are conditional and partial | A permanent smile is the signature of a generic avatar |
<!-- END:bible0 -->

<!-- BEGIN:bible1 -->
**Who is she?** An executive advisor and chief of staff to chief executives. Trained in clinical psychology before moving into the boardroom, she reads people for a living. She is the person in the room whom the CEO trusts to tell him what he does not want to hear. She does not perform authority; she has it, and uses it quietly.

| Attribute | Definition |
|---|---|
| Provisional name | **Vera Halden** (DEC-01) |
| Apparent age | **43** (DEC-02) |
| Profession / archetype | Executive advisor, chief of staff; psychologist by training. The confidant who confronts |
| Perceived socio-economic level | Top tier, **quiet money**: no logos, no ornament, expensive because it is simple and fits perfectly |
| Presence | Calm, attentive, unhurried. She is the most prepared person in the room and does not need to say so |
| Visual personality | Controlled, observant, warm underneath. Humour dry, rarely visible |
| Style | Minimal, monochrome, structured-soft. Black, matte, cut precisely |
| Posture | Upright and unforced. Shoulders down and wide, neck long, chin level. Weight slightly on one leg when standing; seated, spine tall, hands quiet |
| Energy | **Low frequency, high attention.** Stillness is her default; movement is a decision |

**The feeling, in one sentence:** *She walked in and, within a second, you knew she was the smartest person in the room.*

**What she is not:** an avatar, a mascot, a receptionist, a "corporate AI assistant", a game character, a doll, a superhero, a seductress, a robot. The question we answer is "who is this woman?", never "how do we make a beautiful 3D woman?"

**Inner contradiction (the thing that makes her a person):** severe in structure, warm in attention. Her face is serious at rest, and her empathy shows in small, precise changes, never in broad smiles.

**Behavioural spine (what the face must be able to express):** exceptional intelligence · authority · self-control · sophistication · psychological reading · presence · confidence · calm under pressure · the capacity to confront · empathy without submission.

**Identity rules**
1. Proprietary and original. No resemblance to any real person, actor or existing character. Never use photos, scans or likenesses of real people as the face source.
2. Differentiation by design: every major face decision below is made on its own merits; where a choice could coincide with a famous face, the artist reports it and we change it.
3. **Likeness test** (before approval): show the render to 10 people with no context and ask "who does she look like?". If two or more name the same real person, the face goes back.
<!-- END:bible1 -->

### Phases (we do NOT order the body first)

| Phase | You deliver | Gate |
|---|---|---|
| **0. Design sheet** | front, three-quarter and profile face design; skin and eye close-ups; hair and neckline studies; two lighting renders; the 1.5 s presence still (see Part 7) | our written approval, scored on the visual scorecard (stills) before detailed sculpting |
| **1. Head** | head, neck to the collarbones, eyes, mouth interior, lashes, brows, basic hair; **52 ARKit + 15 viseme morph targets**; eye rig; skeleton for head, neck, jaw, eyes | automated validation **and** visual scorecard in our engine |
| **2. Our integration test** | nothing (we load it in our engine and run a guided review) | pass/fail report returned to you |
| **3. Visual approval** | revisions from our report | **only our written approval releases phase 4** |
| **4. Final character** | body, dress, final hair, final materials, LODs, animations | acceptance score and visual sign-off |

A head is approved only when it passes **all four** at once: **visual quality + executive presence + character identity + technical validation.**

---

## PART 2: ART DIRECTION

**Reference: premium cinematic animated character** with stylised realism: human, sophisticated, cinematic. **Not** a SaaS avatar, a game character, a cartoon, a VR/metaverse avatar, a doll or a mannequin.

Where we sit on the dial: proportions and materials are **realistic** (human-sized eyes, real skin behaviour); idealisation is **low** (no beautifying filter, no symmetry); stylisation lives in the *finish*: controlled micro-detail, simplified fabric and hair construction that never shows its seams, painted subsurface, a light that flatters like a film portrait. We do **not** chase photorealism at any cost: we chase a face that holds a close-up and looks alive.

Priorities, in order: **1 visual quality, 2 facial quality, 3 expression quality, 4 rig quality, 5 web compatibility, 6 ownership/licensing, 7 delivery speed, 8 price.**

Rejected looks: cartoon, anime, casual-game, robot, cyberpunk, metaverse avatar, generic corporate avatar, doll, mannequin, oversized eyes, caricature proportions, plastic skin, helmet hair, a permanent smile.

### Visual DNA *(generated)*

<!-- BEGIN:bible12 -->
If a render has all ten, it is her. If it lacks two, it is not.

1. **Attentive eyes**: deep, human-sized, a slightly heavy upper lid, a gaze that holds and then moves with purpose.
2. **Disciplined stillness**: little movement, every movement a decision; breath is the only constant.
3. **A defined, soft-edged jaw**: authority without hardness.
4. **Honest asymmetry**: a left brow a hair higher, a mouth that is not a mirror.
5. **Lived-in skin**: pores, fine lines, a trace of redness; healthy, never retouched.
6. **A neutral mouth that never defaults to a smile**: warmth is conditional and partial.
7. **Quiet black**: one matte crepe silhouette, one tiny gold detail.
8. **Dark hair that frames, not caps**: natural weight, a few flyaways, a low side part.
9. **Portrait light**: warm key, cool edge, dark background, a catchlight in the eye: a person, not a render.
10. **Direct presence that relaxes into pauses**: the hold, the breath, the micro-change before she speaks.
<!-- END:bible12 -->

### Moodboard (textual) *(generated)*

<!-- BEGIN:bible14 -->
The artist receives words, not faces. Read these before looking at any image.

**FACE.** The face of a person who has spent twenty years listening to people lie, politely. Long, calm, symmetrical in structure and not in spirit: the left brow a hair higher, as if one eyebrow is always about to ask a question. A jaw you notice only when she decides something. Cheekbones that catch the light as planes, not as sculpture. A mouth that is closed without being pressed, full enough to be humane, never smiling by default; when it does smile, it is a decision. Skin that has been in the sun, in meetings, in life: a little colour on the cheeks, a trace of blue under the eyes, fine lines that appear only when she moves.

**HAIR.** Dark and heavy, falling past the shoulders, parted low on one side. It has been brushed and has since lived: the ends move a little when she turns, a few fine strands lift at the crown. It frames her face like a dark curtain held open; it never closes over it. At the edges, in the rim, a warm brown glows where the light touches. It is hair, not a shape.

**CLOTHING.** Black, matte, precise. A dress cut so well it looks inevitable: a clean high neckline, a quiet shoulder, sleeves that stop just above the wrist, a hem below the knee. The fabric absorbs light and gives back only a soft edge. No logo, no ornament, one tiny gold stud at each ear. You could not describe what she is wearing a minute after she leaves the room, only how she made you feel.

**LIGHTING.** A large window just out of frame, left, slightly above her eyes. The room is dark and far away. Her skin takes the light the way skin does: warm in the lights, a little cool in the shadows, edges catching a thin cool glow from behind. There is one tiny rectangle of light in each eye. Nothing is shiny that should not be.

**CAMERA.** Eye level, close enough to feel the conversation, far enough not to intrude: a lens that never distorts the face. It does not move; it breathes. When it shifts from close to wide it does so slowly, like someone leaning back in a chair. It never tilts, never swoops.

**EMOTION.** Nothing is shown that is not meant. The face changes the way a sentence changes tone: a brow, a lid, a corner of the mouth. Warmth is a softening around the eyes, not a smile. Doubt is one eyebrow. Firmness is a jaw and a look that does not leave you. Empathy is a head that tilts three degrees and a gaze that stays.

**PRESENCE.** Take a long pause after you stop speaking. She does not fill it. She looks at you, and you realise she has been following everything, including what you did not say. She breathes. Her brow shifts, barely. Then she answers, and you know you are going to be told the truth.
<!-- END:bible14 -->

### Must have / must not have / reference / acceptable / reject *(generated)*

<!-- BEGIN:bible13 -->
For each component. **Reference** = the target, described (never an image of a real person). **Acceptable** = a defensible variation. **Reject** = the file goes back.

### Face
| | |
|---|---|
| **Must have** | Long-oval face, defined soft jaw, proportional chin, moderate cheekbones, refined straight nose, natural brows, full-but-real lips, 2 to 3% asymmetry in the neutral mesh, visible age cues at 43 |
| **Must not have** | Childlike proportions, doll or porcelain look, thin jaw, pointed chin, artificial lips, perfect symmetry, model contouring |
| **Reference** | A face you would recognise in a boardroom, not on a magazine cover: serious at rest, intelligent, attractive by character not by gloss |
| **Acceptable** | Jaw ±3° of the target angle; features ±5% of the ratios; a slightly stronger or softer brow, provided the Visual DNA holds |
| **Reject** | A generic or "stock avatar" face; resemblance to a real person; a rounded youthful face; symmetric; a smiling default |

### Eyes
| | |
|---|---|
| **Must have** | Almond human-sized eyes, 12% iris covered at rest, layered iris with depth, a near-black limbal ring, a believable sclera with veins, a separate cornea with a catchlight, wet line, lids with thickness, independent movement, lids that follow gaze |
| **Must not have** | Oversized eyes, flat decal iris, pure-white sclera, a "wet glass" ball without lids, wide-open default, a stare with no micro-movement |
| **Reference** | Eyes that look as if they are processing: the moment before a diagnosis |
| **Acceptable** | Colour within the deep warm brown / amber family; ±1 mm in aperture |
| **Reject** | Dead or glassy eyes; eyes that don't catch light; irises that look painted; permanent surprise |

### Hair
| | |
|---|---|
| **Must have** | Dark brown, below the shoulders, a soft wave, a low side part, believable volume, fine hairline, a handful of flyaways, satin anisotropic sheen, damped motion |
| **Must not have** | Helmet shape, plastic ribbons, mirror gloss, a centred perfect part, hair across the eyes, visible card seams |
| **Reference** | Well-kept hair at the end of a long day: still tidy, slightly alive |
| **Acceptable** | A groom or good cards; length ±5 cm; a wave from straight to 2a |
| **Reject** | Capped, glued or "game" hair; plastic highlights; a hard alpha fringe |

### Skin
| | |
|---|---|
| **Must have** | Olive-neutral warm tone, zone-varying roughness, pores, fine lines, subtle redness and cool under-eye, painted subsurface warmth, one or two tiny marks |
| **Must not have** | Uniform gloss, waxy sheen, perfectly smooth skin, a noise-on-flat-colour texture, orange or grey cast |
| **Reference** | Skin seen in soft window light across a table: real, calm |
| **Acceptable** | Tone within ± 6% of the guide; pore density tuned for the platform |
| **Reject** | Plastic skin; a repeated pore tile; skin that changes colour under another light |

### Clothing
| | |
|---|---|
| **Must have** | Black matte crepe sheath, high clean neckline, three-quarter sleeves, below the knee, real drape and micro-wrinkles, 5 mm gold studs |
| **Must not have** | Blazer, pencil-skirt-and-blouse, plunge, cut-out, shine, print, logo, futuristic line, extra accessories |
| **Reference** | A dress that disappears so you notice the person |
| **Acceptable** | Neckline ±2 cm; sleeve between elbow and wrist; ponte instead of crepe |
| **Reject** | A "corporate avatar" suit; a costume; sexualised cut; plastic folds |

### Proportion
| | |
|---|---|
| **Must have** | About 7.3 heads, 1.70 m, long neck, level wide shoulders, real adult build |
| **Must not have** | Large head, tiny body, extreme legs, a stylised waist |
| **Reference** | A tall, composed adult |
| **Acceptable** | 7 to 7.6 heads; ±5 cm height |
| **Reject** | Chibi or caricature proportions; a doll body |

### Expression
| | |
|---|---|
| **Must have** | One human face with small changes; the ten states of Part 7; asymmetry on skeptical, thinking, confident; smooth transitions |
| **Must not have** | Ten different faces; broad cartoon emotion; a resting smile; popping or snapping; mouth that only opens and closes |
| **Reference** | The micro-change in the brow that tells you she has understood |
| **Acceptable** | Amplitudes within 20% of the table, if the states stay distinct |
| **Reject** | Indistinguishable states; exaggeration; a dead face when speaking; corners of the mouth that collapse in combinations |

### Posture
| | |
|---|---|
| **Must have** | Upright, shoulders down, neck long, chin level, weight on one leg (standing); rare, slow, small shifts |
| **Must not have** | Slouch, fidget, constant sway, arms swinging, a perfect "mannequin" lock |
| **Reference** | Someone comfortable being looked at |
| **Acceptable** | A slight head tilt as part of LISTENING and EMPATHETIC |
| **Reject** | A rigid statue; a restless idle loop |

### Lighting
| | |
|---|---|
| **Must have** | Warm soft key camera-left, low cool fill, cool/warm rim, dark graded background, a catchlight, detail in shadows, key : fill 3:1 to 6:1 |
| **Must not have** | Flat frontal light, ring light, coloured gels, a bright or patterned background, a HDRI that flattens the face, blown highlights |
| **Reference** | A film portrait of someone about to speak |
| **Acceptable** | The three engine styles (conversation, executive, intimate) |
| **Reject** | Light that makes her look like a render; skin that only works in one setup |
<!-- END:bible13 -->

### Identity consistency *(generated)*

<!-- BEGIN:bible15 -->
Before approval, the character must pass **identity consistency**: the same woman, recognisably, in (a) three lighting styles, (b) three shot sizes, (c) the ten expressions, (d) speaking. A reviewer shown any two frames must say "same person" every time. If not, the face is unstable (usually the asymmetry or the brow/eye shapes drift with the morph targets): return.
<!-- END:bible15 -->

---

## PART 3: FACE *(generated)*

<!-- BEGIN:bible2 -->
Close-up is the primary use. The face is judged first in CLOSE (about 2.3 head-heights tall in frame), under three lighting styles, in motion and speaking.

### Structure and proportions

Measured on a real-scale adult female head (artists may scale; ratios are what matter). Tolerance is ± the stated value.

| Feature | Specification |
|---|---|
| Overall shape | **Long oval with a defined, soft-squared lower face.** Not round, not heart-shaped, not triangular |
| Face length (trichion to menton) : width (bizygomatic) | **1.38 : 1** (± 0.05) |
| Facial thirds (hairline-glabella : glabella-subnasale : subnasale-menton) | **0.95 : 1.00 : 1.00**: a firm lower third signals authority |
| Lower third split (subnasale-stomion : stomion-menton) | **1 : 2** |
| Biocular width (outer corners of the eyes) | **92 mm** (± 3) |
| Forehead | Medium-high, gently convex, no pronounced brow ridge. Temporal width **0.88** of bizygomatic width |
| Cheekbones | **Moderate, high-set, soft.** Visible as a gentle plane change under the key light; no hollow, no "sculpted" contouring |
| Jaw | **Defined, with a soft edge.** Gonial angle **118° to 125°**. Bigonial width **0.80 to 0.84** of bizygomatic. Never thin, never sharp, never masculine |
| Chin | **Rounded-square, proportional.** Pogonion on the line from subnasale to labrale inferior (± 2 mm): no projection, no recession, no point, no cleft |
| Nose | **Straight bridge, refined tip, slightly soft dorsum.** Alar width ≈ intercanthal distance (32 to 34 mm). Length (nasion-subnasale) about one third of face length. Nostrils slightly asymmetric |
| Brows | **Dark, natural, medium thickness** (8 to 9 mm at the inner third). Straight rise with a **soft arch at the outer third**; the tail ends on the line from the nostril wing through the outer canthus. Individual hairs, density varying, slightly thinner at the tail |
| Eyes | See Part 3 (eyes) |
| Lips | Mouth width **49 mm** (± 2). Vermilion height at centre **17 to 19 mm**, upper : lower **1 : 1.4**. **Full but real**: a defined vermilion border, an understated cupid's bow, soft satin moisture. Corners **horizontal at rest** (never upturned) |
| Philtrum | Moderate depth, soft columns |
| Neck | Elegant, not elongated. Faint platysma bands visible only when she turns or speaks |
| Ears | Natural, partly covered by hair (left ear more visible: see asymmetry) |

### Perceived age (43)
Soft nasolabial folds at rest; faint horizontal forehead lines **visible only when the brows lift**; fine crow's feet **only on squint**; subtle cool shadow under the eyes; faint neck lines; skin that is healthy but not retouched. No grey hair beyond DEC-08. She must never read as 25, and never as 60.

### Asymmetry (built into the *neutral* mesh, 2 to 3% and no more)

| Where | Deviation (human scale) |
|---|---|
| Left brow arch (subject's left) | **1.5 mm higher** than the right |
| Left eye aperture | **0.5 mm larger** than the right; right upper lid heavier |
| Mouth | Left corner **1 mm higher** at rest; upper lip peak slightly off-centre toward the right by **0.5 mm** |
| Nose | Tip deviates **0.7 mm** to the subject's right; left nostril slightly wider |
| Jaw | Left side **1° wider** gonial angle |
| Hairline / part | Not centred (see hair) |

Asymmetry belongs in the neutral shapes, not only in expressions, and it must survive the left/right morph targets (authored separately, never mirrored).

### What the face must avoid (explicit)

Giant eyes · childlike features (high forehead with small chin, round cheeks, large cornea) · doll or porcelain face · a thin jaw or pointed chin · artificial or over-filled lips · perfect symmetry · a permanently smiling expression · "model" contouring · strong makeup (see 2.5).

### Makeup (so the skin can be read)
Minimal and matte: even skin, no contouring or highlighter; brows lightly filled; a trace of brown mascara; lips in a muted rosewood (`#A8655F`) with a satin finish. No eyeliner wing, no colour on the eyelids.
<!-- END:bible2 -->

### The eyes

<!-- BEGIN:bible3 -->
Eyes carry the character. They must be human-sized, deep, and able to *think*.

| Property | Specification |
|---|---|
| Shape | **Almond, horizontal axis neutral to +2° (outer corner very slightly higher).** Not round, not downturned, not hooded |
| Palpebral fissure | Width **30 mm** (± 2), height **10 to 11 mm** open at rest |
| Intercanthal distance | **32 mm** (about one eye width) |
| Iris | Diameter **11.7 mm**. **Rest upper lid covers 12%** of the iris (10 to 15%); lower lid just touches the lower limbus. Never a white band above or below the iris at rest |
| Upper lid | A **slightly heavy** lid with a clear crease: this is what makes the gaze read as measured. Right lid slightly heavier (see asymmetry) |
| Colour | **Deep warm brown** (outer iris `#4A3426`) with **olive-amber flecks** (`#7A5A2E`) around the pupil collarette and a **near-black limbal ring** (`#1D1612`, 0.4 mm). High contrast against the sclera |
| Depth | Layered iris with relief (radial fibres, collarette, crypts), pupil about 3.5 mm at key-light level. **No flat decal** |
| Sclera | **Not pure white**: `#E8E2DA` at the centre, warming to `#D9B9A8` toward the corners with fine, faint vessels. Soft shading from the lids |
| Cornea | Separate transparent dome (IOR 1.376, bulge about 2.5 mm). Provides the specular and refraction. **Catchlight** from the key: a soft rectangle at 10 to 11 o'clock; a faint fill catchlight at 4 to 5 o'clock. No ring-light or round catchlight |
| Wet line | A thin, bright tear line and a lacrimal caruncle, visible and subtle |
| Lashes | Natural, dark brown, upper lashes slightly longer; not clumped, not extended |
| Brows | See 2.1; brows are part of the gaze |
| Movement | Each eye independent; slight convergence at rest; pivot at the globe centre |

### Gaze vocabulary
She must be able to say these things **without speaking**. "Gaze" is eye direction and behaviour; "lids" is eyelid position.

| Message (inner voice) | Gaze | Lids | Brows | Notes |
|---|---|---|---|---|
| **Estou ouvindo.** *I am listening.* | Direct, steady (70 to 80% of the time), micro-saccades | Rest, relaxed, slightly open | Inner end up 2 to 3 mm | Tiny head tilt; the eyes follow the speaker's mouth then eyes |
| **Estou pensando.** *I am thinking.* | Leaves the speaker: **down or aside** for 1.2 to 2.8 s, returns to direct | Slightly lowered | Left outer brow lifts ~20% | Mouth stills; **never** looks up-and-left cartoon-style |
| **Eu percebi o que você não disse.** *I caught what you did not say.* | Holds direct longer than comfortable (2 to 3 s), then a short, small drop and return | **Narrowed 15 to 25%** (lower lid rises about 1 mm) | Lowered, inner slightly knit | Blink delayed; lips lightly pressed |
| **Eu discordo.** *I disagree.* | Direct, **unblinking**, no softening | Steady, slightly narrowed on one side | **One brow lifted** (the left), the other level or lower | Jaw tension; head 1 to 2° back, no nod |
| **Você está racionalizando.** *You are rationalizing.* | Direct, then a **slow blink** and a slow return | Right lid lowers a touch more than left | Left brow rises and holds, then settles | Head tilts 3° away; the right mouth corner tightens (half-smile **without** warmth) |
| **Continue.** | Direct, **open**, patient | Rest; small widening (≤ 5%) | Inner end up slightly | A **micro-nod** (1 to 2°) once; mouth relaxed, lips just parted |

**Never:** permanently wide eyes (`eyeWide` only for genuine surprise); a fixed doll stare (always micro-saccades and drift); a gaze that ignores the lids (looking down lowers the upper lid); eyes that do not catch light.
<!-- END:bible3 -->

### Mouth interior (technical addition)

Lips (upper and lower with volume and a soft wet edge), jaw, cheeks, tongue, teeth, gums and a dark graded cavity. Teeth and tongue are **separate meshes that carry the jaw and viseme morph targets** (Part 9). Lip corners must not pop or collapse in combinations; closures (p/b/m) must seal without teeth showing through; f/v must tuck the lower lip behind the upper teeth.

---

## PART 4: HAIR *(generated)*

<!-- BEGIN:bible6 -->
Hair that survives a close-up. Dark, elegant, natural: it frames the face and does not cap it.

| Property | Specification (DEC-05) |
|---|---|
| Length | **Just below the shoulders** (mid-clavicle to shoulder blade, about 40 cm), one length with soft internal layers; ends **softly blunt** (not razor, not feathered) |
| Texture | Straight to a **soft wave** (1b to 2a), smooth and healthy, medium density, no frizz |
| Colour | **Dark brown, almost black**: base `#241913`, with **warm brown undertones** (`#3B2A1F`) where the key and rim hit; minimal tonal variation, no colour treatment, no obvious highlights |
| Parting | **Low side part on the subject's right**, about 30 : 70. A fine, slightly irregular parting line with visible scalp at the part |
| Volume | Moderate crown volume; the hair falls **away from the face** on both sides, tucked behind the **left ear** (the left ear visible, the right covered). Never a helmet, never a sheet |
| Hairline | Fine, soft, with **baby hairs**; a slightly irregular, asymmetric hairline |
| Flyaways | **A handful (under 20)**, very fine, at the crown and the part. No strands in front of the eyes |
| Sheen | **Satin, anisotropic**: two soft highlight bands following the hair's form, roughness 0.45 to 0.6. **No mirror gloss**, no plastic shine |
| Strands / cards | A **light strand groom or well-built hair cards** with real depth: layered cards of varied width and curvature, tapered tips, transparency done with alpha-test or hashed. Visible individual strands only at the part, hairline and tips. The simplified geometry must not show its seams in close-up |
| Brows and lashes | Same colour family, individually placed |
| Optional (DEC-08) | 3 to 5 fine silver hairs near the left temple |

**Motion in animation:** hair follows the head with a **small, damped lag** (sway ≤ 3 cm at the ends), settles in about 0.4 s, never swings, never floats, no wind. At rest it is nearly still. In a head turn the near side compresses slightly and the far side lifts, no more.

**Reject:** helmet or cap shape; ribbon-like or plastic strands; mirror shine; symmetrical, perfectly centred hair; hair in front of the eyes; a visible card edge in close-up; a blue-black "anime" tone.
<!-- END:bible6 -->

Phase 1 needs only "basic hair": clean and correct enough to judge the face (the same colour, part, length and silhouette; the final groom comes after approval). Alpha handled with alpha-test/hashed/alpha-to-coverage (no sorted-blend artefacts).

---

## PART 5: SKIN *(generated)*

<!-- BEGIN:bible5 -->
**Stylised realism, not photorealism and not plastic: human, sophisticated, cinematic.**

| Property | Specification |
|---|---|
| Tone (DEC-03) | **Olive-neutral, Fitzpatrick III, warm undertone.** Base albedo (sRGB, guide with ± 6% tolerance): forehead `#D2A68B`, cheek `#C9977F`, nose bridge `#CDA086`, under-eye `#AE887A` (cooler), lip `#A8655F`, neck `#C69D84`, ear rim `#C48473` |
| Colour variation | **Subtle redness** at cheeks, nostril wings and ear rims; **cool, slightly bluish shadow** under the eyes and at the temples; a faint warmer chin and nose tip. Variation is low-frequency and soft (±4% value), never blotchy |
| Roughness (guide, ±0.05) | Forehead 0.42 · nose bridge 0.38 · nose tip 0.35 · cheeks 0.55 · lips 0.40 · chin 0.50 · neck 0.58 · eyelids 0.50 |
| Microdetail | **Pores** visible in close-up (denser on nose and cheeks, finer on forehead); fine lines per Part 3; micro-wrinkles around the eyes and mouth; a very fine vellus-hair impression on cheeks and jaw |
| Imperfections | **One or two** tiny moles or marks; very faint capillary redness on the nose; one barely visible fine scar or texture irregularity is welcome. **Not** perfectly smooth, not retouched |
| Subsurface look | Painted, since glTF has no stable SSS: warm saturated red-orange (`#C05A3E` family) at the thinnest areas (ear rims, nostril wings, inner eye corners, lip margins), a softened transition from lit to shadowed skin, a gentle translucency at the ear when back-lit |
| Specular | Soft, broad highlights that roll off; no hot specular points; no "oily" sheen; oiliness only on the nose tip in the key's reflection |
| Under three lights | Reads as the **same** skin in conversation, executive and intimate styles: the colour does not shift, only the modelling |

**Reject:** a uniform roughness; a waxy or glossy look; a flat colour with a noise overlay; a cartoon-smooth surface; pores that are a repeated tile; an orange or grey cast.
<!-- END:bible5 -->

Full PBR, with albedo free of baked shadows, a micro-detail normal map, and a roughness (or ORM) map that varies by zone. glTF has no stable subsurface extension, so the effect is **painted into the maps**; no fake emissive.

---

## PART 6: CLOTHING AND BODY *(generated)*

<!-- BEGIN:bible7 -->
Part of the identity: **an executive of the highest level**, in a single silhouette. She is remembered for her face and presence, not her outfit.

| Property | Specification (DEC-06) |
|---|---|
| Garment | **Sheath dress.** Black, fitted through the bodice and waist, straight through the hip to **just below the knee** |
| Neckline | **High, clean jewel neckline** sitting at the base of the neck. No plunge, no keyhole, no collar, no lapel |
| Sleeves | **Three-quarter**, slim, ending between elbow and wrist; clean cuff-less hem |
| Shoulder | **Structured but soft**: a clean, natural shoulder line, no padding, no puff |
| Fabric | **Matte wool crepe (or ponte)**: fine crepe weave, dense, with a faint satin sheen only at stress points. `KHR_materials_sheen` at low value; roughness 0.8 to 0.9 |
| Colour | **Black that is not pure black**: albedo about `#0D0D10` (never `#000000`), with slight blue-grey lift under the key |
| Finish | Single bust darts, a hidden back zip, a clean machine-stitched hem; seams almost invisible; no visible hardware |
| Drape and wrinkles | Real fabric behaviour: soft, vertical drape; **fine micro-wrinkles** at the elbow, waist and (seated) the hip; no stiff plastic folds |
| Accessories (DEC-07) | **Small brushed-gold stud earrings, 5 mm. Nothing else:** no necklace, no watch, no rings, no scarf |
| Shoes (full shot only) | Plain black closed pumps, low block heel; nearly invisible |

**Not this:** a blazer or "business suit" (the generic corporate avatar), a pencil skirt and blouse, a plunge, a cut-out, a metallic or latex fabric, a futuristic or superhero line, anything sexualised, any print, colour or logo, a visible bra line, a tight-as-paint fit.

**Silhouette test:** in a black-on-grey thumbnail she should read as *composed, tall, precise*, not as a "business avatar".
<!-- END:bible7 -->

<!-- BEGIN:bible8 -->
Adult, elegant, realistic: about **7.3 heads tall, about 1.70 m**, narrow-to-average build, long neck, shoulders level and wide, natural bust and hip, no stylised proportions.
In CLOSE only the head, neck, collarbone and the top of the dress are visible: **if budget conflicts, face wins.**
Posture: spine tall, chin level, shoulders down; standing, weight on one leg; seated, upright, hands loosely folded. She never slouches, never fidgets.
<!-- END:bible8 -->

---

## PART 7: EXPRESSIONS *(generated + engine values)*

<!-- BEGIN:bible4 -->
Ten expressions, **one human face**. If the ten renders look like ten different people, the design is wrong. Rule: any expression changes the neutral face by **no more than** these amounts at full intensity (human scale):

| Region | Maximum change |
|---|---|
| Brow height | ± 4 mm (outer lift on skeptical up to 7 mm, single side) |
| Upper lid | ± 2 mm; lower lid ≤ 1.5 mm |
| Mouth corner | ± 3 mm vertical, ± 2 mm lateral |
| Jaw opening (non-speech) | ≤ 1.5 mm |
| Head | ± 4° roll, ± 3° pitch, ± 3° yaw |

At typical working intensity (0.4 to 0.8) expressions are smaller still. **Overlay test:** the ten expressions superimposed at 50% opacity must read as one face with small differences.

Per state (amplitude = fraction of the full values above; the exact channel values the engine uses are in Part 7):

| State | Eyes | Brows | Mouth | Head | Posture | Intensity |
|---|---|---|---|---|---|---|
| **NEUTRAL** | Direct, relaxed lids (12% of iris covered), micro-saccades; blinks 12 to 18 per minute, irregular | Natural, left 1.5 mm higher | Closed, relaxed, corners horizontal, **no resting smile, no press** | Level | Upright, shoulders down, breathing visible | 0.0 (baseline) |
| **LISTENING** | Steady direct; lids a touch more open; follows the speaker | **Inner end up 2 to 3 mm** | Relaxed, a **trace** of warmth (≈ 12% smile), never a smile | **Tilt ≈ 4°**; micro-nod every 4 to 8 s | Slight forward lean (≈ 2°) | 0.5 |
| **THINKING** | Breaks away down or aside 1.2 to 2.8 s and returns; lids lower slightly | Left outer lifts ≈ 20%, right slightly lower | Lips lightly pressed, left corner shifts ≈ 12% | Pitch +2°, yaw 3°, roll 2° | Still | 0.4 |
| **ANALYZING** | **Narrowed** (squint ≈ 25%), long fixation, short drops | **Lowered**, inner slightly knit, outer ends hold | Pressed (≈ 40%), faint jaw tension | Pitch +1.7° (chin slightly down) | Very still; blinking slows | 0.7 |
| **SKEPTICAL** | Right eye narrows (≈ 30%); direct | **Left brow raised ≈ 75% (≈ 6 to 7 mm); right brow lowered** | **Right corner lifts ≈ 25% (a half-smile that is not a smirk)**, lips pressed ≈ 30% | Roll −3°, yaw 1.5° | Still, weight back | 0.8 |
| **FIRM** | Direct, **steady**, narrowed ≈ 12%, blink rate halved | **Lowered and level** (≈ 30%) | **Pressed (≈ 60%), masseter tension (≈ 65%)**, no smile | Pitch +2.6° (chin slightly down) | Square, completely still | 0.8 |
| **EMPATHETIC** | **Softer lids**, warm; direct but not hard | **Inner end up ≈ 55%** (soft, not pleading), outer relaxed | **Soft partial smile ≈ 30%** with cheek lift ≈ 15%, lips relaxed | Tilt ≈ 3.4° | Slight lean toward the speaker | 0.7 |
| **CONCERNED** | Lower lids slightly raised, attentive | Inner end up ≈ 60%, slight knit | Corners **down ≈ 22%**, lips pressed ≈ 15% | Tilt ≈ 2.3°, pitch +1° | Slight lean | 0.6 |
| **CONFIDENT** | Direct, calm, lids at rest | Neutral to very slightly raised | **Closed-lip smile ≈ 40%**, cheek lift ≈ 20%, asymmetry allowed (**composed, never smug**) | Pitch −1.1° (chin a little up) | Tall, still | 0.7 |
| **DECISIVE** | Direct, narrowed ≈ 8%, slow blink | Lowered ≈ 16% | Pressed ≈ 35%, jaw tension ≈ 30% | **One small nod (≈ 1.7°) on entry, then stillness** | Square, weight set | 0.7 |

Plus two **composed states** we use in conversation (built from the above, no new geometry): **RATIONALIZING** (SKEPTICAL at 0.5 + a slow blink + a 3° tilt away + the half-smile held without warmth) and **CONTINUE** (LISTENING + a micro-nod + inner brows up a little + lips just parted).

**Expression rules:** no expression exceeds the table; none is held longer than it needs to be; every change passes through an ease-in/ease-out of at least 150 ms (our engine already smooths; the rig must not pop); asymmetry is allowed and encouraged on SKEPTICAL, THINKING, CONFIDENT.
<!-- END:bible4 -->

### What the rig must make possible

Subtlety over quantity. At rest she looks alive and present without moving for no reason: slow breathing, irregular blinks, micro eye saccades, tiny head movements, rare posture shifts, occasional micro-expressions.

Our engine **composes** expressions from the ARKit channels at low weights (it does not use pre-made emotion poses). The numbers below are the engine's **full-intensity** values; in use they are scaled and combined, usually lower. Each channel involved must be sculpted well, because the sum is what makes the face convincing.

<!-- BEGIN:recipes -->
| Emotion | Channels at full intensity (0..1) | Head (rad) | Gaze behaviour |
|---|---|---|---|
| neutral | (baseline only) | - | attend |
| listening | browInnerUp 0.25, browOuterUpLeft 0.06, browOuterUpRight 0.06, eyeBlinkLeft 0.06, eyeBlinkRight 0.06, mouthSmileLeft 0.12, mouthSmileRight 0.12, mouthPressLeft 0.04, mouthPressRight 0.04, eyeWideLeft 0.06, eyeWideRight 0.06 | roll 0.075, pitch -0.01 | attend |
| thinking | browInnerUp 0.12, browOuterUpLeft 0.22, browDownRight 0.08, eyeBlinkLeft 0.1, eyeBlinkRight 0.14, eyeSquintRight 0.08, mouthSmileLeft 0, mouthSmileRight 0.02, mouthPressLeft 0.18, mouthPressRight 0.12, mouthShrugLower 0.12, mouthLeft 0.12 | pitch 0.035, roll 0.035, yaw 0.05 | think |
| analyzing | browDownLeft 0.38, browDownRight 0.38, browOuterUpLeft 0.1, browOuterUpRight 0.1, eyeBlinkLeft 0.08, eyeBlinkRight 0.08, eyeSquintLeft 0.24, eyeSquintRight 0.24, mouthSmileLeft 0, mouthSmileRight 0, mouthPressLeft 0.4, mouthPressRight 0.4, jawClench 0.15 | pitch 0.03, roll 0.01 | scan |
| confident | browOuterUpLeft 0.06, browOuterUpRight 0.06, eyeBlinkLeft 0.1, eyeBlinkRight 0.1, mouthSmileLeft 0.4, mouthSmileRight 0.4, cheekSquintLeft 0.2, cheekSquintRight 0.2, mouthPressLeft 0, mouthPressRight 0, mouthStretchLeft 0.06, mouthStretchRight 0.06 | pitch -0.02 | direct |
| firm | browDownLeft 0.3, browDownRight 0.3, browInnerUp 0, eyeBlinkLeft 0.1, eyeBlinkRight 0.1, eyeSquintLeft 0.12, eyeSquintRight 0.12, mouthSmileLeft 0, mouthSmileRight 0, mouthPressLeft 0.6, mouthPressRight 0.6, mouthRollLower 0.1, jawClench 0.65 | pitch 0.045 | hold |
| skeptical | browOuterUpLeft 0.78, browInnerUp 0.05, browDownRight 0.24, eyeBlinkLeft 0.06, eyeBlinkRight 0.18, eyeSquintRight 0.3, mouthSmileLeft 0, mouthSmileRight 0.24, mouthPressLeft 0.3, mouthPressRight 0.3, mouthLeft 0.1, cheekSquintRight 0.12 | roll -0.05, yaw 0.025 | glance |
| empathetic | browInnerUp 0.55, browDownLeft 0.04, browDownRight 0.04, browOuterUpLeft 0.1, browOuterUpRight 0.1, eyeBlinkLeft 0.08, eyeBlinkRight 0.08, mouthSmileLeft 0.3, mouthSmileRight 0.3, cheekSquintLeft 0.15, cheekSquintRight 0.15, mouthPressLeft 0, mouthPressRight 0 | roll 0.06, pitch -0.012 | attend |
| surprised | browInnerUp 0.55, browOuterUpLeft 0.5, browOuterUpRight 0.5, eyeWideLeft 0.8, eyeWideRight 0.8, eyeBlinkLeft 0, eyeBlinkRight 0, jawOpen 0.1, mouthPressLeft 0, mouthPressRight 0, mouthSmileLeft 0, mouthSmileRight 0 | pitch -0.025 | direct |
| concerned | browInnerUp 0.6, browDownLeft 0.12, browDownRight 0.12, eyeSquintLeft 0.1, eyeSquintRight 0.1, eyeBlinkLeft 0.1, eyeBlinkRight 0.1, mouthFrownLeft 0.22, mouthFrownRight 0.22, mouthPressLeft 0.15, mouthPressRight 0.15, mouthSmileLeft 0, mouthSmileRight 0 | roll 0.04, pitch 0.02 | attend |
| decisive | browDownLeft 0.16, browDownRight 0.16, eyeBlinkLeft 0.1, eyeBlinkRight 0.1, eyeSquintLeft 0.08, eyeSquintRight 0.08, mouthPressLeft 0.35, mouthPressRight 0.35, mouthSmileLeft 0, mouthSmileRight 0, jawClench 0.3, mouthShrugLower 0.08 | pitch 0.035 | hold |
<!-- END:recipes -->

Cognitive states combine them:

<!-- BEGIN:states -->
| Cognitive state | Emotion mix | Gaze | Blink rate | Notes |
|---|---|---|---|---|
| LISTENING | listening 1 | attend | x1 | nods 1 |
| PROCESSING | analyzing 0.6 + thinking 0.3 | scan | x1.1 |  |
| THINKING | thinking 1 | think | x0.9 |  |
| SPEAKING | neutral 0.6 + confident 0.35 | speak | x1 |  |
| DECIDING | decisive 1 | hold | x0.6 |  decision beat |
| WARNING | firm 0.85 + concerned 0.3 | hold | x0.5 |  |
| EMPATHY | empathetic 1 | attend | x1 | nods 0.7 |
| CHALLENGE | skeptical 0.8 + firm 0.3 | hold | x0.6 |  |
| CONFIDENCE | confident 1 | direct | x0.8 |  |
<!-- END:states -->

### The presence test *(generated)*

<!-- BEGIN:bible11 -->
**Test clip:** body still, breathing, looking into the camera, not speaking, **not smiling**, 1.5 seconds, CLOSE, executive style. Played to at least 5 reviewers (ideally including 2 senior executives who are not on the project).

Three questions, answered **yes / no** by each reviewer, in this order:
1. **"Does she look like a person you would take seriously?"**
2. **"Does she look capable of advising a CEO?"**
3. **"Does she look like someone who would have the courage to disagree with him?"**

**Pass:** at least 80% "yes" on **every** question. If any question has a majority "no", **the design is wrong** and goes back, whatever the technical score.

**The 1.5 s of silence, as a sequence:** the user finishes speaking; 0.0 s she is looking at them, nothing else moves · ~0.6 s a small inner-brow rise · ~1.0 s she breathes (chest, nostrils) · 1.0 to 1.4 s a 3° to 5° head tilt · ~1.5 s she answers. This must read as **intelligence, not animation**.

Phase 0 applies the three questions to **stills** (concept renders); Phase 1 applies them to the real-time head in the Avatar Lab.
<!-- END:bible11 -->

---

## PART 8: CINEMATIC LANGUAGE *(generated)*

<!-- BEGIN:bible9 -->
The character is the centre of the experience. The scene is monochrome and quiet; the only warmth is her skin and her eyes.

| Element | Colour | Notes |
|---|---|---|
| Hair | `#241913` base, `#3B2A1F` under light | warm-dark, not black |
| Skin | see Part 5 | olive-neutral, warm |
| Eyes | `#4A3426` / `#7A5A2E` / `#1D1612`; sclera `#E8E2DA` | |
| Lips | `#A8655F` | muted rosewood, satin |
| Dress | `#0D0D10` | black with a blue-grey lift |
| Accent (earrings) | brushed gold `#C9A24B` | the only metal |
| Key light | warm white, **4800 to 5200 K** (`#FFEEDD` to `#FFF3E6`) | soft, large source |
| Fill | cool, **6500 K** (`#DFE6FF`), low | sets the shadow ratio |
| Rim | cool `#8FB0FF` (behind-left) and warm `#FFCFB4` (behind-right) | separates hair and shoulders |
| Background | deep graphite `#0F1115` at the edges to `#1D2029`, with a soft warm-grey light pool `#3A3F4A` behind the head | luminance about 8 to 12%; **no colour, no gradient bands, no pattern** |
| Interface | graphite and bone only: `#101114`, `#1B1C21`, text `#F1EEF2`, muted `#9D98A6`; at most one desaturated accent `#CFC8BE` | the UI must never compete with her face |
<!-- END:bible9 -->

<!-- BEGIN:bible10 -->
Reference: **premium cinematic animated character**, never SaaS avatar, game character, cartoon or VR avatar. The face is lit like a portrait in a film, not rendered like a product.

| Element | Specification |
|---|---|
| **Lighting** | Studio portrait. **Key:** large soft source, camera-left, 30° to 45° off-axis, 20° to 25° above eye level, 4800 to 5200 K. **Fill:** low, cool, camera-right, 2 stops under the key (6500 K). **Rim:** two edge lights behind, one cool, one warm, to cut the hair and shoulders from the background. **Environment:** softbox reflections, not a generic HDRI. |
| **Contrast** | Key : fill **3:1** (executive), **4:1** (conversation), **6:1** (intimate). Shadows keep detail (no crushed blacks); highlights roll off (no clipping on skin). |
| **Temperature** | Warm key, cool fill and rim: skin warm, shadows slightly cool, edges cool/warm split. |
| **Depth** | The background is dark and far; a soft light pool sits behind the head. Shallow depth of field in hero renders (eyes sharp, ears and shoulders softening); in the engine, depth comes from light falloff and the rim. |
| **Composition** | Subject centred or very slightly off-centre for direct address. **Eyes on the upper third.** Headroom 6 to 10% in CLOSE. No Dutch angles, no extreme low or high angles. |
| **Camera** | Eye level (± 2°). **Vertical FOV 20° to 29°** (about 46 to 68 mm full-frame equivalent): long enough that the face is not distorted. CLOSE ≈ 2.3 head-heights tall; MEDIUM ≈ 4.7; FULL ≈ 7.6. **Executive** style: longer lens, more headroom and shoulders, almost static. **Intimate:** closer, a few degrees off-axis. |
| **Distance** | CLOSE reads as 0.9 to 1.2 m from the subject: close enough for presence, never invasive. |
| **Movement** | Camera drift **millimetres**, felt not seen. Moves between shots are ease-in/out of 1.8 to 2.2 s. No handheld shake, no whip, no zoom pulses. |
| **Skin treatment** | Soft key modelling; speculars broad and rolled-off; subsurface warmth at ears and nostrils; pores resolve only in CLOSE. |
| **Hair treatment** | Rim carves the silhouette; anisotropic highlights are two soft bands; no blown shine; fine flyaways catch the rim. |
| **Eye treatment** | Rectangular key catchlight (10 to 11 o'clock), faint secondary (4 to 5 o'clock); the iris is readable (depth, flecks); the cornea has a believable wet reflection; lids cast a soft shadow on the upper iris. |
| **Grade** | Neutral, slightly warm skin, cool-neutral blacks, no teal-orange, no heavy vignette, no film-grain gimmick. |
<!-- END:bible10 -->

---

## PART 9: TECHNICAL SPECIFICATION

### 9.1 Format and web requirements

* One self-contained **`.glb` (glTF 2.0)**, no external files or URIs. Y up, **+Z forward**, metres, transforms frozen, no non-uniform scale on bones or meshes. Rest pose: neutral face, eyes forward, mouth closed and relaxed.
* Geometry compression **`EXT_meshopt_compression`** (preferred: it compresses morph targets, Draco does not). Position/UV quantisation allowed.
* The file must open with `three.js` r147 `GLTFLoader` + `MeshoptDecoder` with no custom loader. We plan to load the head first and the rest afterwards, so the head must work as a standalone file.
* Naming: ASCII, no spaces, stable across revisions (we cache by name and version: `exec_head_v001.glb`).
* Performance target: 60 fps at 1080p on current integrated GPUs (Apple M1, Intel Iris Xe) in the head phase; 30 fps stable on a mid phone with LOD1.

<!-- BEGIN:phases -->
| | Phase 1 (head) | Final character |
|---|---|---|
| File size (target / hard limit) | 6 MB / 8 MB | 12 MB / 15 MB |
| Triangles (all meshes) | 45,000 | 75,000 |
| Draw calls | 8 | 12 |
| Texture memory (GPU) | 40 MB | 64 MB |
| Skinned meshes | 4 | 6 |
<!-- END:phases -->

Budgets for the head phase cover **everything delivered** (skin, eyes, teeth, tongue, lashes, hair). Suggested split of the final character at LOD0:

| Part | Triangles (LOD0) |
|---|---|
| Head + neck skin | 18,000 to 28,000 |
| Eyes (2 globes + corneas) | 3,000 |
| Teeth, gums, tongue | 3,000 |
| Lashes and brows | 2,500 |
| Hair | 12,000 to 20,000 (head phase: 3,000 to 12,000) |
| Body, arms, hands | 12,000 |
| Dress | 8,000 |
| Legs, shoes (full shot only) | 6,000 |

### 9.2 Topology, LODs, mesh separation and names

* **Topology:** quads, deformation-aware edge loops around eyes, brows, nostrils, mouth, nasolabial folds; clean loops for the lids; no n-gons in deforming areas; triangulated on export.
* **LODs:** LOD0 (close-up) and LOD1 (about 40% of LOD0, for medium shot and weak devices) as **separate files** (`*_lod0.glb`, `*_lod1.glb`). Morph targets identical in both.
* **Mesh names** (we classify by name; use these words): `Head` (skin), `EyeLeft`, `EyeRight` (globe + iris), `CorneaLeft`, `CorneaRight`, `Teeth` (or `TeethUpper`/`TeethLower`), `Tongue`, `Eyelashes`, `Eyebrows`, `Hair`, `Body`, `Dress`. One material per part; at most 8 materials.

### 9.3 Skeleton

**Mixamo-compatible humanoid names** (our rig map recognises them with no configuration): `Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, RightShoulder, LeftEye, RightEye, Jaw` and the usual arm/hand/leg names. A second neck bone (`Neck1`) is welcome. Phase 1 needs `Neck, Head, LeftEye, RightEye, Jaw` (+ `Spine2` if the collar is included).

* Max 75 bones, 4 influences per vertex, normalised weights.
* `Head` pivot at the base of the skull; eye bones at the **centre of each eyeball** (forward axis +Z, range about ±30° yaw, ±25° pitch); `Jaw` at the jaw articulation.
* Provide the `jawOpen` morph target **and** a `Jaw` bone with correct weights on the lower teeth and tongue. The engine uses the morph when it exists and the bone otherwise; teeth and tongue must follow the jaw either way.
* The eyelids and skin around the eyes **follow the gaze** through the `eyeLook*` morph targets (looking down lowers the upper lid).

### 9.4 Facial rig: 52 ARKit blendshapes (exact names, case-sensitive)

Morph targets on the `Head` mesh, with **the same names on every mesh that deforms with the face** (teeth, tongue, lashes, brows, eyes where relevant). "Left/Right" is the **subject's** left and right, as in ARKit. If you author mirrored, say so; we handle it in configuration.

<!-- BEGIN:arkit -->
| # | Channel | # | Channel | # | Channel |
|---|---|---|---|---|---|
| 1 | `eyeBlinkLeft` | 19 | `mouthClose` | 37 | `mouthPressRight` |
| 2 | `eyeLookDownLeft` | 20 | `mouthFunnel` | 38 | `mouthLowerDownLeft` |
| 3 | `eyeLookInLeft` | 21 | `mouthPucker` | 39 | `mouthLowerDownRight` |
| 4 | `eyeLookOutLeft` | 22 | `mouthLeft` | 40 | `mouthUpperUpLeft` |
| 5 | `eyeLookUpLeft` | 23 | `mouthRight` | 41 | `mouthUpperUpRight` |
| 6 | `eyeSquintLeft` | 24 | `mouthSmileLeft` | 42 | `browDownLeft` |
| 7 | `eyeWideLeft` | 25 | `mouthSmileRight` | 43 | `browDownRight` |
| 8 | `eyeBlinkRight` | 26 | `mouthFrownLeft` | 44 | `browInnerUp` |
| 9 | `eyeLookDownRight` | 27 | `mouthFrownRight` | 45 | `browOuterUpLeft` |
| 10 | `eyeLookInRight` | 28 | `mouthDimpleLeft` | 46 | `browOuterUpRight` |
| 11 | `eyeLookOutRight` | 29 | `mouthDimpleRight` | 47 | `cheekPuff` |
| 12 | `eyeLookUpRight` | 30 | `mouthStretchLeft` | 48 | `cheekSquintLeft` |
| 13 | `eyeSquintRight` | 31 | `mouthStretchRight` | 49 | `cheekSquintRight` |
| 14 | `eyeWideRight` | 32 | `mouthRollLower` | 50 | `noseSneerLeft` |
| 15 | `jawForward` | 33 | `mouthRollUpper` | 51 | `noseSneerRight` |
| 16 | `jawLeft` | 34 | `mouthShrugLower` | 52 | `tongueOut` |
| 17 | `jawRight` | 35 | `mouthShrugUpper` |
| 18 | `jawOpen` | 36 | `mouthPressLeft` |
<!-- END:arkit -->

Extension (strongly preferred): `jawClench` (masseter tension for the firm and decisive states).

Quality rules:
* Position deltas only. **No normal or tangent deltas.** Each target touches only the region that changes (glTF sparse accessors).
* Left/right pairs are sculpted **separately** (authored asymmetry, Part 3), not mechanically mirrored. A perfectly mirrored set is flagged.
* Combinations hold up: `jawOpen`+`mouthSmile`, `browDown`+`eyeSquint`, `mouthPress`+`jawClench`, `mouthFunnel`+`jawOpen`. Bake correctives into the targets if needed.
* No target is empty, and none moves vertices more than about 20% of the head height at weight 1.
* Subtle channels must be especially well sculpted: `browInnerUp`, `browOuterUp*`, `eyeSquint*`, `cheekSquint*`, `mouthPress*`, `mouthShrug*`, `noseSneer*`, `mouthLeft/Right`, `jawClench`.

### 9.5 Visemes: 15 Oculus visemes as native morph targets

<!-- BEGIN:visemes -->
| Morph target | Sound | Required on meshes |
|---|---|---|
| `viseme_sil` | silence | skin |
| `viseme_PP` | p, b, m | skin, teeth |
| `viseme_FF` | f, v | skin, teeth |
| `viseme_TH` | th | skin, teeth, **tongue** |
| `viseme_DD` | t, d | skin, teeth, **tongue** |
| `viseme_kk` | k, g | skin, teeth, **tongue** |
| `viseme_CH` | ch, j, sh | skin, teeth |
| `viseme_SS` | s, z | skin, teeth |
| `viseme_nn` | n, l | skin, teeth, **tongue** |
| `viseme_RR` | r | skin, teeth, **tongue** |
| `viseme_aa` | ah (father) | skin, teeth, tongue |
| `viseme_E` | eh (bed) | skin, teeth, tongue |
| `viseme_I` | ih/ee (see) | skin, teeth, tongue |
| `viseme_O` | oh (go) | skin, teeth, tongue |
| `viseme_U` | oo (blue) | skin, teeth, tongue |
<!-- END:visemes -->

Sculpted with lips, **teeth and tongue** (th, d/t, n/l, r, k/g need a visible tongue). Do **not** derive them by summing ARKit shapes: authored visemes are what make the mouth read as speech. They must be visibly distinct. We drive them from TTS phoneme timelines with coarticulation, so a viseme overlaps its neighbours; each must stay clean when mixed at 30 to 60%. An equivalent solution is acceptable only if it maps cleanly to these 15 names through a configuration file: describe it before building.

### 9.6 Animation clips (bones only, no morph tracks)

| Clip | Length | Notes |
|---|---|---|
| `Idle` | 4 to 6 s, seamless loop | breathing (chest, shoulders), slight weight shift; subtle: our engine adds micro-movement |
| `Talk` (optional) | 6 to 10 s | small hand/shoulder gestures |
| `ListenNod` (optional) | about 1 s | short nod |

30 fps, no root motion. **No morph tracks in any clip** (they would fight our expression engine). Phase 1 needs no clips.

### 9.7 Textures and materials

| Map | Size | Notes |
|---|---|---|
| Skin albedo / normal / ORM (AO-roughness-metal packed) | 2048 (face), 1024 (body) | optional tiled micro-normal 1024 |
| Eye (iris, sclera, cornea) | 1024 | iris depth painted; the catchlight comes from our lighting |
| Hair atlas with alpha (+ flow/ID) | 2048 | clean alpha edges |
| Teeth and tongue | 512 to 1024 | |
| Clothing (phase 4) | 1024 to 2048 | `KHR_materials_sheen` for the fabric |

Textures **KTX2** (Basis: UASTC for normal and ORM, ETC1S for albedo), power-of-two, with mipmaps. glTF-core metallic-roughness. Allowed extensions: `KHR_materials_clearcoat`, `sheen`, `specular`, `ior`, `emissive_strength`, `KHR_texture_transform`, `KHR_texture_basisu`, `KHR_mesh_quantization`, `EXT_meshopt_compression`. No unlit materials, no transmission/volume (cost), no embedded cameras or lights.

---

## PART 10: ACCEPTANCE TEST

A head is **approved** only when it passes four things at once: **visual quality** (scorecard 85 or more, no barrier), **executive presence** (the three 1.5 s questions), **character identity** (originality, consistency, DNA, blind comparison) and **technical validation** (automatic validator, no gate failed, 85% or more of the automatic points). "Opens in three.js", "has 52 blendshapes", "has a rig", "speaks" and "blinks" are not reasons to accept.

### 10.1 Visual scorecard (100 points, with barriers)

Scored by at least 5 reviewers (2 of them senior executives outside the project), median per item. Full item list, anchors and procedure: `EXECUTIVE_AVATAR_VISUAL_SCORECARD.md`.

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

**Barriers: no score can compensate for these.**

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

Result: 85 or more, no barrier, no item below 3: accepted. 70 to 84, no barrier, no item below 2: returned with a numbered fix list. Otherwise rejected. **If it looks like a generic 3D avatar, it is rejected.**

### 10.2 Technical validator

We give you the validator; run it before you send anything. It loads your `.glb` in a real browser pipeline, drives the real animation engine, measures the displacement of every morph target, and scores 0 to 100 (54 automatic points, 46 from the human review). Command: `node tools/validate-glb.js your_file.glb --phase=head` (or the **Avatar Lab** web page, "Asset Validation").

<!-- BEGIN:categories -->
| Category | Points | Automatic | Human rubric |
|---|---|---|---|
| Facial Quality | 25 | 0 | 25 |
| Eyes | 15 | 8 | 7 |
| Materials | 10 | 6 | 4 |
| Hair | 10 | 3 | 7 |
| Facial Rig | 15 | 15 | 0 |
| Lip Sync | 10 | 7 | 3 |
| Animation Readiness | 5 | 5 | 0 |
| Performance | 5 | 5 | 0 |
| Web Delivery | 5 | 5 | 0 |
| **Total** | **100** | **54** | **46** |
<!-- END:categories -->

Hard gates, any one of which rejects the file:

<!-- BEGIN:gates -->
* GLB válido e carregado
* Rig com cobertura full ou good
* Mandíbula presente
* Olhos com rig (ossos ou eyeLook)
* Visemas nativos (≥ 13 de 15)
* Arquivo ≤ 15 MB (limite duro)
* Sem URIs externas
* Expressões sem valores inválidos (NaN)
* Parece executiva digital premium (e não avatar 3D genérico)
* Qualidade facial ≥ 3.5/5 e nenhum item ≤ 1
<!-- END:gates -->

The automatic part checks, among other things:

<!-- BEGIN:checks -->
| Category | Check | Points (auto) |
|---|---|---|
| Eyes | Ossos dos dois olhos | 2 |
| Eyes | Pivô do olho no centro do globo (≤ 0,25 do raio) | 1.5 |
| Eyes | Globos oculares como malhas separadas (≥ 2) | 1 |
| Eyes | Córnea/reflexo (malha de córnea ou material com clearcoat/transmissão) | 1.5 |
| Eyes | Morphs eyeLook (8) para as pálpebras acompanharem o olhar | 1.5 |
| Eyes | Piscada independente esquerda/direita | 0.5 |
| Materials | Pele com mapa de cor (albedo) | 1 |
| Materials | Pele com mapa de normal (microdetalhe) | 1.5 |
| Materials | Pele com rugosidade variável (mapa de rugosidade ou ORM) | 1.5 |
| Materials | Resolução da pele ≥ 1024 (rosto), ≤ 4096 | 0.5 |
| Materials | No máximo 8 materiais | 0.5 |
| Materials | Sem materiais sem iluminação (unlit) | 0.5 |
| Materials | Tecido com sheen (vestido) | 0.5 |
| Hair | Malha de cabelo presente | 1.5 |
| Hair | Cabelo entre 3 mil e 25 mil triângulos | 0.75 |
| Hair | Transparência do cabelo tratada (alphaTest, blend ou alpha-to-coverage) | 0.75 |
| Facial Rig | Cobertura dos 52 canais ARKit (≥ 98%) | 4.5 |
| Facial Rig | Nenhum blendshape morto (sem deslocamento) | 2 |
| Facial Rig | Deslocamentos dentro de limites (≤ 20% da altura da cabeça) | 1.5 |
| Facial Rig | Pares esquerda/direita coerentes (razão ≥ 0,55) e assimetria autoral | 1.5 |
| Facial Rig | Dentes acompanham mandíbula/boca (morphs nos dentes) | 1.5 |
| Facial Rig | Língua com morphs (tongueOut e visemas de língua) | 1 |
| Facial Rig | Mandíbula (morph jawOpen ou osso Jaw) | 1 |
| Facial Rig | Extensão jawClench (tensão da mandíbula para FIRM/DECISIVE) | 0.5 |
| Facial Rig | Composição: as 11 emoções produzem rosto vivo e sem distorção | 1.5 |
| Facial Rig | CÉTICA é assimétrica (≥ 0,12 entre os lados) | 0.5 |
| Lip Sync | 15 visemas nativos | 3 |
| Lip Sync | Visemas distintos entre si (sem cópias) | 1.5 |
| Lip Sync | Língua e dentes participam dos visemas | 1 |
| Lip Sync | Fala completa: a boca abre e fecha, não fica aberta | 1.5 |
| Animation Readiness | Clipe idle (laço de 3 a 8 s, fechado) | 1.5 |
| Animation Readiness | Ossos necessários (cabeça, pescoço, olhos, mandíbula, coluna, ombros) | 2 |
| Animation Readiness | Clipes só de ossos (sem trilhas de morph) | 1 |
| Animation Readiness | Clipes extras (Talk, ListenNod): opcional | 0.5 |
| Performance | Triângulos dentro do orçamento (75.000) | 2 |
| Performance | Draw calls ≤ 12 | 1 |
| Performance | Malhas com skin ≤ 6 | 0.5 |
| Performance | FPS ≥ 55 em GPU real | 1.5 |
| Web Delivery | Arquivo ≤ 12 MB | 2 |
| Web Delivery | Geometria comprimida (meshopt ou Draco) | 1 |
| Web Delivery | Texturas KTX2 (Basis) | 1 |
| Web Delivery | Memória de textura ≤ 64 MB | 0.5 |
| Web Delivery | Sem recursos externos (tudo dentro do .glb) | 0.5 |
<!-- END:checks -->

### 10.3 Review conducted in our engine

We load the head and run a guided review under three lighting styles and three shot sizes: neutral, listening, thinking, analyzing, firm, skeptical, empathy, confidence, speaking with phoneme-driven lip sync, audio-only lip sync, eye tracking (left, right, up, down, camera), blinking, and the 1.5 s presence test. The quick rubric used inside the validator:

<!-- BEGIN:rubric -->
| Category | Item (score 0 to 5) |
|---|---|
| Facial Quality | Proporções humanas, mandíbula, queixo, maçãs e nariz elegantes |
| Facial Quality | Pele: poros, variação de cor, brilho que varia por zona, sem aparência de plástico |
| Facial Quality | Lábios com volume, dentes, língua e interior da boca convincentes |
| Facial Quality | Pequenas assimetrias e imperfeições que a tornam humana |
| Facial Quality | Microexpressões legíveis: listening, thinking, firm, skeptical, empathetic |
| Facial Quality | Autoridade, inteligência e serenidade: a pessoa mais atenta da sala |
| Eyes | Íris, esclera, córnea e brilho (catchlight) com profundidade |
| Eyes | Olhar vivo: micro-sacadas, pálpebras acompanham, sem olhar fixo de boneca |
| Eyes | O olhar comunica os estados (ouvindo, analisando, firme, empatia, confiança), sem olhos arregalados |
| Materials | Pele sob os três estilos de luz (conversation, executive, intimate) |
| Materials | Reflexo/refração do olho, tecido do vestido, sem brilho exagerado |
| Hair | Parece cabelo: volume, variação, sem fitas plásticas nem capacete |
| Lip Sync | Lip sync: fechamentos em p/b/m, f/v, dentes e língua visíveis; não é só abrir e fechar |
<!-- END:rubric -->

---

## PART 11: DELIVERY

### 11.1 Files per phase

1. `*.glb` (LOD0; LOD1 from phase 4).
2. Source files (Blender/Maya/ZBrush/Substance) and full-resolution textures.
3. A rig sheet (text/CSV): morph target names per mesh, bone names, clip names, mirroring decisions.
4. **Reference renders**, from the glTF as shipped (not from your DCC): a turntable; neutral; `browInnerUp` 1; `jawOpen` 1; `mouthSmileLeft/Right` 1; `mouthPress*` 1; `eyeSquint*` 1; `eyeLookDown*` 1; visemes `PP, FF, TH, aa, O, nn` at 1; the ten expressions at the intensities of Part 7; all under key/fill/rim light.
5. A **speaking clip**: the character saying a sentence we provide, driven by our viseme timeline, in your viewer. (A beautiful face that goes dead when it speaks is the most common failure; we check for it first.)
6. A short note of what you could not do or chose differently.

### 11.2 Milestones and payments (suggested)

Design sheet approval → blockout and proportions review → sculpt and textures review (turntable, three lights) → rig and morph targets (validator report attached) → **Phase 1 delivery** → our test and one consolidated feedback list → two revision rounds → approval. Tie payments to these gates, with the final part released at written approval. State how many revision rounds your price includes.

### 11.3 Rights and originality

Full assignment of rights to **[COMPANY]**, worldwide, perpetual, all platforms and media, including real-time, interactive, AI-driven and promotional use; source files included. Declaration of originality: no real person's likeness, no third-party assets without a licence that permits this use (state each one). No use of the work, its source or its derivatives to train or improve generative AI models without written consent. Confidentiality until launch.

### 11.4 What we provide

This brief; the Avatar Lab and the validator (including a **test file**, `rig-arkit.glb`, that shows the naming and rig structure we expect); the exact naming above; the gaze and expression tables (Parts 3 and 7); a style board **without real-person faces** **[to be attached]**; a point of contact with 2-day answers.

### 11.5 Please include in your quote

1. Portfolio: real-time **female hero faces with facial rigs**, close-up renders, and **at least one video of such a character speaking** (not a turntable). 2. Your pipeline and tools (ZBrush/Maya/Blender/Substance; Faceit or equivalent for ARKit shapes; how you author visemes). 3. Phase 0 + 1 price, time, revision rounds included; an indicative phase 4 range. 4. Who sculpts, who rigs, who textures. 5. How you will deliver the GLB (exporter, compression, version). 6. Confirmation of the rights and originality terms. 7. Anything in this brief you consider unrealistic, and your alternative.

---

## Appendix: reference lists

* ARKit blendshape reference: https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation
* Oculus / Meta viseme reference: https://developer.oculus.com/documentation/unity/audio-ovrlipsync-viseme-reference/
* glTF 2.0 and extensions: https://github.com/KhronosGroup/glTF/tree/main/extensions
* meshoptimizer / gltfpack: https://github.com/zeux/meshoptimizer
* glTF-Transform (optimise, sparse accessors, KTX2): https://gltf-transform.dev/
