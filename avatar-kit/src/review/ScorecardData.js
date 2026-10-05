/*
 * ScorecardData: the visual scorecard (weights, items, barriers). Single source of truth for the documents
 * (tools/gen-docs.js), the Head Gate and the tests. phases: 0 = concept stills, 1 = real-time head, 4 = final character.
 */
(function (root) {
  'use strict';
  var data = {
  categories: [
    { id: 'FACE', weight: 22, items: [
      ['F1', 'Proportions and structure follow the Bible (ratios, jaw, chin, cheekbones, nose, brows)', '0,1,4'],
      ['F2', 'The face is a specific person with character, not a type', '0,1,4'],
      ['F3', 'Perceived age 43: lived-in, not retouched, not older or younger', '0,1,4'],
      ['F4', 'Natural asymmetry (2 to 3%) present in the neutral mesh', '0,1,4'],
      ['F5', 'Lips with volume; real teeth, tongue and mouth interior', '1,4'],
      ['F6', 'Close-up quality: silhouette, topology, no defects at CLOSE', '1,4']] },
    { id: 'EYES', weight: 15, items: [
      ['E1', 'Shape, size, lids and rest aperture (12% of iris) follow the Bible', '0,1,4'],
      ['E2', 'Iris depth, sclera, cornea, catchlight: the eye is alive, not painted', '0,1,4'],
      ['E3', 'Lids with thickness, lashes, wet line, soft lid shadow', '0,1,4'],
      ['E4', 'Gaze in motion: micro-saccades, independent eyes, lids follow gaze, no stare', '1,4'],
      ['E5', 'The six messages are readable without speech (listening, thinking, caught-it, disagree, rationalizing, continue)', '1,4']] },
    { id: 'EXPRESSION', weight: 14, items: [
      ['X1', 'One face, ten expressions (overlay test): never ten different faces', '1,4'],
      ['X2', 'Subtlety: every state within the amplitude table, none exaggerated', '1,4'],
      ['X3', 'Asymmetric states (skeptical, thinking, confident) work', '1,4'],
      ['X4', 'Combinations and transitions are clean: no collapsing corners, no popping', '1,4'],
      ['X5', 'Speaking reads as speech: closures p/b/m, f/v, teeth, tongue; not a mouth flap', '1,4'],
      ['X6', 'Rest-state life: breath, blinks, micro-movement without fidgeting', '1,4']] },
    { id: 'PRESENCE', weight: 14, items: [
      ['P1', '1.5 s test, Q1: "a person you would take seriously"', '0,1,4'],
      ['P2', '1.5 s test, Q2: "capable of advising a CEO"', '0,1,4'],
      ['P3', '1.5 s test, Q3: "would have the courage to disagree with him"', '0,1,4'],
      ['P4', 'First impression: "the smartest person in the room"', '0,1,4'],
      ['P5', 'Posture and stillness: composed, comfortable being looked at', '1,4']] },
    { id: 'IDENTITY', weight: 8, items: [
      ['I1', 'Originality: likeness test (fewer than 2 of 10 name the same real person)', '0,1,4'],
      ['I2', 'Consistency: the same woman across 3 lights, 3 shots, 10 expressions, speaking', '1,4'],
      ['I3', 'Visual DNA coverage (traits present out of 10, scaled to 0-5)', '0,1,4'],
      ['I4', 'Blind comparison: reviewers pick her as a premium character over generic avatars', '0,1,4']] },
    { id: 'SKIN', weight: 9, items: [
      ['S1', 'Tone and colour variation follow the Bible (redness, cool under-eye)', '0,1,4'],
      ['S2', 'Roughness varies by zone; speculars broad and rolled off', '1,4'],
      ['S3', 'Pores, fine lines, micro-wrinkles, one or two marks', '0,1,4'],
      ['S4', 'Subsurface warmth painted at ears, nostrils, eye corners', '1,4'],
      ['S5', 'The same skin under all three lighting styles', '1,4'],
      ['S6', 'No plastic, no wax, no noise-on-flat-colour', '0,1,4']] },
    { id: 'HAIR', weight: 8, items: [
      ['H1', 'Reads as hair: volume, depth, layering; no helmet, no ribbons', '0,1,4'],
      ['H2', 'Hairline, low side part, baby hairs, a handful of flyaways', '0,1,4'],
      ['H3', 'Satin anisotropic sheen, no mirror gloss', '1,4'],
      ['H4', 'Motion: small damped lag with the head', '4'],
      ['H5', 'Survives close-up: no visible card seams, clean alpha', '1,4']] },
    { id: 'CLOTHING', weight: 5, items: [
      ['C1', 'Cut and silhouette follow the Bible (sheath, jewel neckline, three-quarter sleeves, below the knee)', '0,4'],
      ['C2', 'Matte crepe, real drape, micro-wrinkles, black not pure black', '4'],
      ['C3', 'Reads as top-level executive: not a blazer avatar, not sexualised, not futuristic', '0,4'],
      ['C4', 'Accessories: only the 5 mm gold studs', '0,4']] },
    { id: 'CINEMATIC', weight: 5, items: [
      ['Q1', 'Lighting reads as portrait light in all three styles', '0,1,4'],
      ['Q2', 'Camera and composition: CLOSE, MEDIUM, FULL as specified', '1,4'],
      ['Q3', 'Materials respond to light believably (skin, hair, eyes, fabric)', '1,4'],
      ['Q4', 'Overall polish at 1080p and in motion: it looks like film, not like a render', '1,4']] }
  ],
  barriers: [
    ['B1', 'Generic face', 'A majority of reviewers call the face generic or stock, or fewer than 80% pick her in the blind comparison (I4)'],
    ['B2', 'Dead eyes', 'E2 or E4 scores 1 or less, or 40% of reviewers call the eyes dead, glassy or painted'],
    ['B3', 'Childlike appearance', 'A majority say she looks young or childlike, or the median apparent age is under 30'],
    ['B4', 'Generic-avatar appearance', '40% or more say "avatar", "game character", "cartoon" or "mannequin"'],
    ['B5', 'No executive presence', 'Any of the three 1.5 s questions has fewer than 80% "yes"'],
    ['B6', 'Resembles a real person', 'Two or more of 10 viewers name the same real person (I1)'],
    ['B7', 'Doll, porcelain or perfect symmetry', 'F4 scores 1 or less, or reviewers use "doll", "porcelain", "perfect"'],
    ['B8', 'Plastic skin', 'S6 or S2 scores 1 or less'],
    ['B9', 'Helmet or ribbon hair', 'H1 scores 1 or less'],
    ['B10', 'Smiling by default', 'The neutral mouth reads as smiling, pressed or sad to a majority of reviewers'],
    ['B11', 'Dead or uncanny when speaking', 'X5 scores 1 or less (mouth flap, no teeth or tongue, closures that do not close)'],
    ['B12', 'Ten different faces', 'X1 or I2 scores 1 or less (expressions or lights change who she is)'],
    ['B13', 'Uncanny moment', '40% of reviewers mark any frame of the guided review as unsettling'],
    ['B14', 'Departure from the Bible', 'Skin tone, hair, dress or accessories contradict locked decisions without written approval (any matching item at 1 or less)']
  ],
  presenceYesToScore: [[1.0, 5], [0.9, 4.5], [0.8, 4], [0.6, 3], [0.4, 2], [0, 0]]
};
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  if (root.AvatarKit) root.AvatarKit.ScorecardData = data;
})(typeof window !== 'undefined' ? window : globalThis);
