# Head Review Protocol

How a person reviews one head candidate. Read the standard once, then follow it the same way every time. Nothing here depends on who the vendor is or what the price was.

## Before you start

1. The automated review has run (`validate-head`). Open `review/candidates/<ID>/vNNN/package/review.html` in a browser.
2. Use a calibrated screen, normal brightness, in a room without strong light on the glass. View the pictures at full size.
3. Do not read the vendor name or the price first. Look at the face first.
4. Work alone for the first pass. If several people review, each fills the form separately before anyone talks.
5. Scores run from 0 to 5. **3 is generic, not good.** Give 4 or 5 only when you would show it to a client.

## Step 1: stills (about 5 minutes)

Look at the ten standard shots in order. They share camera, light and background, so any difference is the face.

For each one ask: is this a real adult with authority, or a character? Is the face the same person in every shot? Do the eyes look at something? Does the skin look like skin?

Mark a hard rule immediately if it applies: childlike (HR-01), generic (HR-02), looks like an avatar (HR-03), dead eyes (HR-04), artificial teeth (HR-07), recognisable as a real person (HR-13).

## Step 2: the 1.5 second presence test

Watch the six frames (0.0, 0.3, 0.6, 0.9, 1.2, 1.5 s) as one glance. The cues are: neutral face, micro eye movement, small breath, micro facial change, gaze stabilises, then you answer.

Each reviewer answers yes or no to:

- **A.** Does she look like a real adult person?
- **B.** Does she look like someone with executive authority?
- **C.** Would I trust her to tell me something I do not want to hear?

Answer on first impression. Enter the number of yes and no votes. A question passes at 80% yes or more. Do not change an answer after discussion.

## Step 3: speech (the most important step)

Look at the speech stills (the seven visemes) and the automatic flags, then play the sentence in the Lab ("Head Review Scene") and watch it at least three times: once for the mouth, once for the eyes and brows, once for the face as a whole.

The sentence: "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it."

Score the 12 checklist items from 0 to 5. Fix your eyes where they would be in a real conversation, on the eyes, not on the mouth.

Rules of thumb:

- p, b and m must close the lips. If they never do, the mouth is artificial (HR-05).
- The mouth must not flap on every syllable at the same size. People under-articulate.
- Cheeks, chin and nostrils should move a little. A jaw that moves alone looks like a puppet.
- The eyes must not change when the mouth does. If she becomes a different person while talking, mark HR-09.
- If the speech mean is below 3.0 the candidate is rejected, however good the stills are.

## Step 4: expressions

Check the ten expressions: listening, thinking, perceived unsaid, disagreement, rationalization detection, continue, welcoming, firm, skeptical, confident. The report says which channels are mapped. For `FUZZY` channels, confirm by eye that the right part of the face moves. For `UNMAPPED`, nothing can be judged: write it down as a gap for the vendor.

Good executive expressions are small. If you notice the expression before you notice the face, it is too big. If you cannot tell two expressions apart, they are too small.

## Step 5: identity

- **Likeness test.** Show the neutral still to ten people who have not seen the brief. Ask: does this remind you of a real person? Enter how many name the same person. Any clear majority is a rejection (HR-13).
- **Blind comparison.** Mix the still with other premium characters. Enter how many pick it as the premium one.
- **Visual DNA.** Count how many of the ten traits of the Character Bible are visible.

## Step 6: hard rules and the form

Go through all 14 rules in the form. Mark each `no` or `YES: reject`. When every one has been checked, tick "I checked every hard rule". Without it, unassessed rules block approval.

Press "Generate ratings JSON", save it, and run:

```
node tools/head-gate.js rate HEAD-001 --file ratings.json
```

The command prints the recommendation and what is still missing.

## Step 7: decision

A decision is a person's, signed with `--by`. The tool recommends; it does not decide.

```
node tools/head-gate.js decide HEAD-001 --decision PASS --by "Name" --reason "..."
```

- **PASS**: all criteria in `HEAD_PROTOTYPE_GATE.md` are met.
- **CONDITIONAL**: list exactly what to fix. The fixed file is a new version and a new review.
- **REJECTED**: write the reason that will go back to the vendor. Be specific about the face, not the person.

## Common mistakes

- Judging the face in one pose. Judge it moving.
- Giving 4 because nothing is wrong. Nothing wrong is 3.
- Forgiving speech because the stills are beautiful.
- Letting the vendor's portfolio stand in for this file.
- Changing a score after seeing the others.
- Trusting FPS from a software renderer. Check performance on a real GPU.
