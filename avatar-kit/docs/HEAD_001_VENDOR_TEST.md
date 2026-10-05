# HEAD-001 Vendor Test

Every vendor receives exactly this test, with exactly these conditions. The point is to compare like with like. Vendor names are removed before anyone reviews the results.

> **THE PRIMARY ACCEPTANCE TEST IS THE CHARACTER SPEAKING.**
> A beautiful still render that fails during speech is a failure.

## Common conditions

| | |
|---|---|
| Character | Vera Halden, from the Asset Brief. The vendor's own interpretation, not a copy of an existing character |
| Output | PNG stills at 2560 x 1440, video at 1920 x 1080, 30 fps, H.264, no compression artefacts |
| Camera | 85 mm equivalent lens, camera at eye height, head fills about 60% of the frame height |
| Lighting | one set for every output: soft key at 45 degrees camera left, low fill at camera right, a rim from behind, neutral grey backdrop. State your light values |
| Skin | no post-processing, no retouching, no beauty filter. Render straight from the real-time or offline renderer |
| Expressions | small, as written in the Brief. A big expression is a failure |
| Naming | `TEST_A_front_neutral.png`, `TEST_B_listening.png`, and so on, as listed below |

## TEST A: Face

`TEST_A_front_neutral.png`: a neutral, front-facing portrait, eyes on the camera, mouth closed and relaxed.

We look for: an adult executive, 43, who is not a stock face and not a real person. Eyes that are alive. Skin that varies. Authority without hardness.

## TEST B: Expression

Four stills, front view, same light:

- `TEST_B_listening.png`
- `TEST_B_thinking.png`
- `TEST_B_skeptical.png`
- `TEST_B_firm.png`

We look for: four expressions that can be told apart and are all small. The same person in each. No cartoon.

## TEST C: Speech

`TEST_C_speech.mp4`: the head speaking this sentence:

> "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it."

Use the timeline below for the mouth, so every vendor speaks the same thing at the same speed (13.6 seconds in total, speech from 0.50 s to 12.98 s). There is no voice and no audio: this tests the face, not a voice. The video is one continuous take, front view, then a second continuous take in three-quarter view (`TEST_C_speech_3q.mp4`).

We look for: lips that close on p, b and m. Teeth and tongue that are visible and correct. Cheeks, chin and nostrils that move a little. Eyes that stay the same. A face that does not die when it talks. This is the part that decides.

In Phase 0 (design proof) the head may not be rigged yet. If it is not, write "NOT AVAILABLE" for Test C and deliver instead one existing portfolio character, rigged, speaking the same sentence on this timeline, clearly labelled as portfolio work. A real speaking test of the new head is then mandatory before Phase 1 is accepted.

## TEST D: Presence

`TEST_D_presence.mp4`: 1.5 seconds of silent presence, front view, one continuous take. In this order:

| Time | What happens |
|---|---|
| 0.0 s | neutral face |
| 0.3 s | a micro eye movement |
| 0.6 s | a small breath |
| 0.9 s | a micro facial change |
| 1.2 s | the gaze settles |
| 1.5 s | the end: a viewer decides whether this is a real, trustworthy adult |

We look for: whether she is alive without moving much. Nothing should fidget or glitch.

## TEST E: Three-quarter

`TEST_E_three_quarter.png`: the same neutral face turned 35 degrees to the right, same lens, same light, same backdrop as Test A. Also `TEST_E_profile.png` at 90 degrees if you can.

We look for: the same person as Test A. A believable jaw, nose and ear. The light is identical, so only the face changes.

## How we compare

1. Names are removed. Each submission gets a random label.
2. Each reviewer looks at all of one set before the next, in this order: Test C, Test D, Test A, Test B, Test E. Speech first.
3. Reviewers use the Head Review Protocol and score on the Visual Scorecard, then answer the three presence questions: does she look like a real adult, does she look like someone with executive authority, would I trust her to tell me something I do not want to hear.
4. A real person recognised as the source, or a generic face, ends the review.
5. Price is not shown until the review is complete.

## The timeline

Words and times, in seconds. The full phoneme list follows.

| Word | Phonemes (ARPAbet) | Start | End |
|---|---|---|---|
| Before | B IH F AO R | 0.50 | 1.14 |
| we | W IY | 1.19 | 1.45 |
| decide | D IH S AY D | 1.50 | 2.20 |
| what | W AH T | 2.25 | 2.63 |
| to | T UW | 2.68 | 2.91 |
| do, | D UW | 2.96 | 3.24 |
| let's | L EH T S | 3.71 | 4.19 |
| separate | S EH P ER EY T | 4.24 | 5.07 |
| what | W AH T | 5.12 | 5.51 |
| is | IH Z | 5.55 | 5.81 |
| actually | AE K CH UW AH L IY | 5.86 | 6.81 |
| happening | HH AE P AH N IH NG | 6.86 | 7.73 |
| from | F R AH M | 8.08 | 8.59 |
| the | DH AH | 8.63 | 8.89 |
| story | S T AO R IY | 8.94 | 9.59 |
| you're | Y UH R | 9.63 | 10.00 |
| telling | T EH L IH NG | 10.05 | 10.67 |
| yourself | Y AO R S EH L F | 10.72 | 11.61 |
| about | AH B AW T | 11.66 | 12.25 |
| it. | IH T | 12.30 | 12.58 |
Pauses: 0.42 s after "do,", 0.30 s after "happening", 0.35 s after "it.". Lead-in silence 0.50 s, tail 0.6 s.

Phoneme timeline (`SIL` is silence):

```
phoneme,start_s,duration_s
SIL,0,0.5
B,0.5,0.072
IH,0.572,0.154
F,0.726,0.105
AO,0.83,0.208
R,1.038,0.105
W,1.192,0.105
IY,1.296,0.154
D,1.5,0.072
IH,1.571,0.154
S,1.725,0.105
AY,1.83,0.297
D,2.127,0.072
W,2.248,0.105
AH,2.352,0.208
T,2.56,0.072
T,2.681,0.072
UW,2.753,0.154
D,2.956,0.072
UW,3.028,0.208
SIL,3.285,0.42
L,3.705,0.105
EH,3.81,0.208
T,4.018,0.072
S,4.089,0.105
S,4.243,0.105
EH,4.348,0.208
P,4.556,0.072
ER,4.627,0.154
EY,4.781,0.22
T,5.001,0.072
W,5.122,0.105
AH,5.227,0.208
T,5.434,0.072
IH,5.555,0.154
Z,5.709,0.105
AE,5.863,0.208
K,6.071,0.072
CH,6.143,0.105
UW,6.247,0.154
AH,6.401,0.154
L,6.555,0.105
IY,6.66,0.154
HH,6.863,0.105
AE,6.968,0.208
P,7.176,0.072
AH,7.247,0.154
N,7.401,0.088
IH,7.489,0.154
NG,7.643,0.088
SIL,7.781,0.3
F,8.081,0.105
R,8.185,0.105
AH,8.29,0.208
M,8.498,0.088
DH,8.635,0.105
AH,8.74,0.154
S,8.943,0.105
T,9.048,0.072
AO,9.119,0.208
R,9.327,0.105
IY,9.432,0.154
Y,9.635,0.105
UH,9.74,0.154
R,9.894,0.105
T,10.048,0.072
EH,10.119,0.208
L,10.327,0.105
IH,10.431,0.154
NG,10.585,0.088
Y,10.723,0.105
AO,10.827,0.154
R,10.981,0.105
S,11.086,0.105
EH,11.19,0.208
L,11.398,0.105
F,11.503,0.105
AH,11.657,0.154
B,11.811,0.072
AW,11.882,0.297
T,12.179,0.072
IH,12.3,0.208
T,12.508,0.072
SIL,12.629,0.35
SIL,12.979,0.6
```
