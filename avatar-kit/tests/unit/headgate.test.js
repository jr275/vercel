const test = require('node:test'), assert = require('node:assert');
global.THREE = { DoubleSide: 2 };
const WA = require('./load')(['core/util.js', 'model/channels.js', 'model/RigMap.js', 'control/VisemeEngine.js', 'control/ExpressionController.js', 'control/CognitiveState.js', 'validate/AssetValidator.js', 'review/ScorecardData.js', 'review/SpeechScript.js', 'review/HeadGate.js', 'review/ReviewPage.js']);
const HG = WA.HeadGate, AV = WA.AssetValidator, C = WA.Channels, good = require('./good-report')(C);

const SHA = (n) => 'sha' + n;
const cand = (id, n = 1) => HG.createCandidate({ id, name: id, vendor: 'V', file: id + '.glb', sha256: SHA(id + n), bytes: 1000 });
function review(c, over = {}) {      // a synthetic automated review of an excellent head; tests then break one thing at a time
  const rep = good(); rep.hair = { meshes: 1, tris: 6000 }; rep.mouth = { jawMode: 'morph', jawMorph: true, teeth: 1, tongue: 1, inner: 1, tongueOut: true, mouthChannels: 7 };
  const mapping = { expressions: HG.REVIEW_EXPRESSIONS.map(e => ({ id: e.id, reproducible: true, unmapped: [], fuzzy: [] })), notReproducible: [], fuzzyChannels: [], visemes: { required: [], missing: [], native: true } };
  return Object.assign({ schema: 1, configHash: HG.configHash(), candidate: { id: c.id, version: c.version, sha256: c.asset.sha256 }, validator: { report: rep, result: AV.evaluate(rep, { phase: 'head' }) }, mapping,
    speech: { metrics: { peakDisplacement: 0.03 }, flags: [] }, expression: { maxPeak: 0.02, skepticalAsym: 0.2, rows: [] }, presence: { metrics: { eyeMoveDetected: true, breathDetected: true, faceChangeInRange: true, eyeStableAtEnd: true, fidget: false } }, transitions: { flags: [] }, file: { morphNames: [] } }, over);
}
const R = (v, extra = {}) => { const items = {}; WA.ScorecardData.categories.forEach(c => c.items.forEach(i => items[i[0]] = v)); const sp = {}; HG.SPEECH_ITEMS.forEach(k => sp[k] = v);
  return Object.assign({ reviewers: ['a', 'b'], items, speech: sp, presenceVotes: { A: { yes: 5, no: 0 }, B: { yes: 5, no: 0 }, C: { yes: 5, no: 0 } }, humanBarriers: {}, barriersReviewed: true, likeness: { names: 0, of: 10 }, blind: { picked: 10, of: 10 }, dnaTraits: 10 }, extra); };
const withReview = (c, rev, ratings) => { let n = HG.attachReview(c, rev); if (ratings) n = HG.attachRatings(n, ratings); return n; };

test('registration: id format, PENDING_ASSET without a file, DRAFT with one', () => {
  assert.throws(() => HG.createCandidate({ id: 'head-1' }), e => e.code === 'BAD_CANDIDATE_ID');
  const p = HG.createCandidate({ id: 'HEAD-001' }); assert.equal(p.state, 'PENDING_ASSET'); assert.equal(p.asset, null);
  const d = cand('HEAD-002'); assert.equal(d.state, 'DRAFT'); assert.equal(d.version, 1); assert.equal(d.asset.sha256, 'shaHEAD-0021');
  assert.throws(() => HG.registerAsset(p, { file: 'x.glb' }), e => e.code === 'BAD_ASSET');
});
test('state machine: legal paths only, decisions need a signature', () => {
  let c = cand('HEAD-001'); assert.throws(() => HG.transition(c, 'PASS'), e => e.code === 'ILLEGAL_TRANSITION'); assert.throws(() => HG.transition(c, 'NOPE'), e => e.code === 'BAD_STATE');
  c = HG.attachReview(c, review(c)); assert.equal(c.state, 'UNDER_REVIEW');
  assert.throws(() => HG.decide(c, 'PASS', ''), e => e.code === 'NO_SIGNATURE'); assert.throws(() => HG.decide(c, 'MAYBE', 'x'), e => e.code === 'BAD_DECISION');
  assert.deepEqual(Object.keys(HG.TRANSITIONS).sort(), HG.STATES.slice().sort()); assert.ok(HG.canTransition('REJECTED', 'DRAFT')); assert.ok(!HG.canTransition('PASS', 'DRAFT'));
});
test('a new version after a decision archives the old one; the version must grow', () => {
  let c = cand('HEAD-001'); c = HG.attachReview(c, review(c)); c = HG.decide(c, 'REJECTED', 'me', 'generic');
  assert.throws(() => HG.registerAsset(c, { file: 'b.glb', sha256: 'zz', version: 1 }), e => e.code === 'VERSION_NOT_NEWER');
  const n = HG.registerAsset(c, { file: 'b.glb', sha256: 'zz', version: 2 }); assert.equal(n.state, 'DRAFT'); assert.equal(n.history.length, 1); assert.equal(n.history[0].state, 'REJECTED'); assert.equal(n.review, null);
  const u = HG.attachReview(cand('HEAD-003'), review(cand('HEAD-003'))); assert.throws(() => HG.registerAsset(u, { file: 'c.glb', sha256: 'q' }), e => e.code === 'ILLEGAL_TRANSITION');
});
test('candidate isolation: an operation on one candidate never touches another, and a review cannot be attached to the wrong one', () => {
  const a = cand('HEAD-001'), b = cand('HEAD-002'), snapA = JSON.stringify(a), snapB = JSON.stringify(b);
  const b2 = HG.attachReview(b, review(b)); assert.equal(JSON.stringify(a), snapA); assert.equal(JSON.stringify(b), snapB); assert.notEqual(JSON.stringify(b2), snapB);
  assert.throws(() => HG.attachReview(a, review(b)), e => e.code === 'REVIEW_MISMATCH');
  const stale = review(a); stale.candidate.sha256 = 'other'; assert.throws(() => HG.attachReview(a, stale), e => e.code === 'REVIEW_MISMATCH');
  const old = review(a); old.configHash = 'deadbeef'; assert.throws(() => HG.attachReview(a, old), e => e.code === 'CONFIG_MISMATCH');
  const ra = HG.attachRatings(HG.attachReview(a, review(a)), R(5)), rb = HG.attachReview(b, review(b)); assert.equal(rb.review.ratings, null);
});
test('deterministic review configuration: one hash, stable, sensitive to any change', () => {
  const h = HG.configHash(); assert.equal(h, HG.configHash()); assert.match(h, /^[0-9a-f]{8}$/);
  assert.equal(HG.CONFIG.shots.length, 10); assert.deepEqual(HG.CONFIG.shots.map(s => s.id.slice(0, 2)), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  assert.equal(HG.CONFIG.lighting, 'executive'); HG.CONFIG.shots.forEach(s => assert.ok(!('lighting' in s) && !('exposure' in s)), 'a shot cannot change the lighting or the exposure');
  assert.equal(HG.CONFIG.canvas.pixelRatio, 1); const saved = HG.CONFIG.canvas.width; HG.CONFIG.canvas.width = 640; assert.notEqual(HG.configHash(), h); HG.CONFIG.canvas.width = saved; assert.equal(HG.configHash(), h);
  assert.equal(HG.hash('x'), HG.hash('x')); assert.notEqual(HG.hash('x'), HG.hash('y'));
});
test('presence test: the cues and the three formal questions', () => {
  const P = HG.CONFIG.presence; assert.deepEqual(P.cues.map(c => c.t), [0, 0.3, 0.6, 0.9, 1.2, 1.5]); assert.equal(P.seconds, 1.5); assert.deepEqual(P.questions.map(q => q.id), ['A', 'B', 'C']);
  assert.match(P.questions[0].text, /real adult/); assert.match(P.questions[1].text, /authority/); assert.match(P.questions[2].text, /do not want to hear/);
});
test('standard speech script: 10 to 15 seconds, only visemes the engine knows', () => {
  const i = WA.SpeechScript.info(); assert.ok(i.seconds >= 10 && i.seconds <= 15, 'seconds ' + i.seconds); assert.equal(i.text, "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it.");
  i.requiredVisemes.forEach(v => assert.ok(C.isViseme(v), v)); assert.ok(i.requiredVisemes.includes('viseme_PP') && i.requiredVisemes.includes('viseme_FF') && i.requiredVisemes.includes('viseme_TH')); assert.ok(i.syllables >= 25);
  assert.deepEqual(i.events, WA.SpeechScript.events(), 'the script is deterministic'); const t = WA.SpeechScript.stillTimes(); ['viseme_aa', 'viseme_O', 'viseme_PP'].forEach(v => assert.ok(t[v] > 0 && t[v] < i.seconds));
});
test('mapping layer: UNMAPPED is reported, fuzzy matches need confirmation, nothing is invented', () => {
  const rig = WA.RigMap.create({ options: { ignoreTokens: ['fc'] } }), names = ['browInnerUp', 'FC_BROW_DOWN_L', 'FC_BROW_DOWN_R', 'eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen', 'mouthPressLeft', 'mouthPressRight'];
  const res = WA.RigMap.resolve(rig, { morphNames: names, boneNames: [], clipNames: [] }); const mp = HG.mappingReport(res);
  const firm = mp.expressions.find(e => e.id === 'firm'); assert.ok(firm.unmapped.includes('jawClench')); assert.ok(firm.fuzzy.includes('browDownLeft'), 'fuzzy: ' + firm.fuzzy);
  assert.equal(firm.required.find(r => r.ch === 'mouthPressLeft').status, 'MAPPED_EXACT'); assert.equal(firm.required.find(r => r.ch === 'jawClench').status, 'UNMAPPED');
  assert.ok(mp.notReproducible.includes('skeptical') || mp.notReproducible.includes('thinking'), 'a rig without the brow/eye channels cannot reproduce them'); assert.ok(mp.visemes.missing.length > 0);
  assert.equal(HG.requiredChannels(HG.REVIEW_EXPRESSIONS[0]).includes('browInnerUp'), true);
  const empty = HG.mappingReport(WA.RigMap.resolve(WA.RigMap.create(), { morphNames: [], boneNames: [], clipNames: [] })); assert.equal(empty.notReproducible.length, 10);
});
test('scoring: a person-only score stays null (HUMAN REVIEW REQUIRED), never zero; automated items are computed', () => {
  const c = HG.attachReview(cand('HEAD-001'), review(cand('HEAD-001'))), s = HG.score(c.review.automated, null), S = s.sections;
  assert.ok(S.TECHNICAL.value > 0 && S.TECHNICAL.status === 'AUTOMATED'); ['VISUAL', 'PRESENCE', 'SPEECH', 'IDENTITY'].forEach(k => { assert.equal(S[k].value, null, k); assert.equal(S[k].status, 'HUMAN REVIEW REQUIRED', k); });
  assert.equal(s.scorecard.value, null); assert.ok(s.autoItems.X2 >= 4 && s.autoItems.X3 >= 4 && s.autoItems.X4 === 5 && s.autoItems.X6 === 5); assert.deepEqual(S.EXPRESSION.automated.sort(), ['X2', 'X3', 'X4', 'X6']); assert.deepEqual(S.EXPRESSION.pending, ['X1'], 'X5 is a speech item; X1 (one face) needs a person');
  assert.equal(S.EXPRESSION.value, null); assert.ok(S.EXPRESSION.partial > 80); assert.equal(HG.recommend(c.review.automated, null).recommendation, 'UNDER_REVIEW');
});
test('scoring: partial ratings give a partial, labelled number and no total', () => {
  let c = HG.attachReview(cand('HEAD-001'), review(cand('HEAD-001'))); c = HG.attachRatings(c, { reviewers: ['a'], items: { F1: 4, F2: 4 }, speech: { teeth: 4 } });
  const s = HG.score(c.review.automated, c.review.ratings); assert.equal(s.sections.VISUAL.value, null); assert.ok(s.sections.VISUAL.partial > 70); assert.equal(s.scorecard.value, null); assert.equal(s.sections.SPEECH.rated, 1);
});
test('scoring reuses the scorecard weights: full marks give 100, uniform 3 gives 60, medians across reviewers', () => {
  const c = cand('HEAD-001'), a = review(c); const s5 = HG.score(a, R(5)), s3 = HG.score(a, R(3)); assert.equal(s5.scorecard.value, 100); assert.ok(Math.abs(s3.scorecard.value - 66) < 14, 'uniform 3 with auto items high: ' + s3.scorecard.value);
  const w = WA.ScorecardData.categories.reduce((x, k) => x + k.weight, 0); assert.equal(w, 100); const two = HG.score(a, HG.mergeRatings(R(5), { items: { F1: [2, 4, 5] } })); assert.equal(two.items.find(i => i.id === 'F1').score, 4);
  assert.equal(HG.yesToScore(1), 5); assert.equal(HG.yesToScore(0.8), 4); assert.equal(HG.yesToScore(0.5), 2); assert.equal(HG.yesToScore(0.2), 0);
});
test('hard barriers: automatic ones from the validator and mapping, with evidence', () => {
  const c = cand('HEAD-001'), bad = (mut) => { const r = review(c); mut(r); return HG.barriers(r, null).filter(b => b.triggered === true).map(b => b.id); };
  assert.deepEqual(bad(r => {}), []);
  assert.ok(bad(r => { r.validator.report.eyes.bones = { left: false, right: false }; r.validator.report.eyes.lookMorphs = 0; r.validator.result = AV.evaluate(r.validator.report, { phase: 'head' }); }).includes('HR-10'));
  assert.ok(bad(r => { r.validator.report.mouth.jawMorph = false; r.validator.report.mouth.jawMode = 'none'; r.validator.result = AV.evaluate(r.validator.report, { phase: 'head' }); }).includes('HR-11'));
  assert.ok(bad(r => { r.validator.report.visemes.found = 4; r.validator.result = AV.evaluate(r.validator.report, { phase: 'head' }); }).includes('HR-12'));
  assert.ok(bad(r => { r.mapping.visemes.missing = ['viseme_kk']; }).includes('HR-12'));
  assert.ok(bad(r => { r.mapping.notReproducible = ['a', 'b', 'c']; }).includes('HR-08'));
  assert.ok(bad(r => { r.validator.report.delivery.fileMB = 40; r.validator.result = AV.evaluate(r.validator.report, { phase: 'head' }); }).includes('HR-14'));
  assert.ok(bad(r => { r.validator.report.mouth.teeth = 0; }).includes('HR-14'), 'a head with no teeth does not satisfy the Brief');
  assert.ok(bad(r => { r.speech.flags = ['popping while speaking: x']; }).includes('HR-06')); assert.ok(bad(r => { r.speech.metrics.peakDisplacement = 0.2; }).includes('HR-09'));
  assert.equal(HG.HR.length, 14);
});
test('hard barriers: human flags and the evidence in the scores', () => {
  const c = cand('HEAD-001'), a = review(c); const t = (ratings, id) => assert.ok(HG.barriers(a, ratings).find(b => b.id === id).triggered === true, id);
  t({ humanBarriers: { 'HR-01': true } }, 'HR-01'); t({ likeness: { names: 3, of: 10 } }, 'HR-13'); t({ blind: { picked: 5, of: 10 } }, 'HR-02'); t({ items: { E2: 1 } }, 'HR-04'); t({ speech: { teeth: 1 } }, 'HR-07'); t({ speech: { sync: 0 } }, 'HR-06'); t({ speech: { noavatar: 1 } }, 'HR-03'); t({ speech: Object.fromEntries(HG.SPEECH_ITEMS.map(k => [k, 1])) }, 'HR-05');
  assert.equal(HG.barriers(a, { humanBarriers: { 'HR-01': false } }).find(b => b.id === 'HR-01').triggered, false); assert.equal(HG.barriers(a, null).find(b => b.id === 'HR-01').triggered, null, 'unknown until a person decides'); assert.equal(HG.barriers(a, { barriersReviewed: true }).find(b => b.id === 'HR-01').triggered, false, 'cleared by a reviewer who states every hard rule was checked'); assert.equal(HG.barriers(a, { barriersReviewed: true, humanBarriers: { 'HR-01': true } }).find(b => b.id === 'HR-01').triggered, true);
});
test('decision: PASS needs every front; speech has veto power over beautiful stills', () => {
  const c0 = cand('HEAD-001'), a = review(c0);
  assert.equal(HG.recommend(a, R(4.5)).recommendation, 'PASS');
  const weakSpeech = HG.recommend(a, R(4.5, { speech: Object.fromEntries(HG.SPEECH_ITEMS.map(k => [k, 2.5])) })); assert.equal(weakSpeech.recommendation, 'REJECTED'); assert.match(weakSpeech.why[0], /SPEECH/);
  const midSpeech = HG.recommend(a, R(4.5, { speech: Object.fromEntries(HG.SPEECH_ITEMS.map(k => [k, 3.6])) })); assert.equal(midSpeech.recommendation, 'CONDITIONAL'); assert.ok(midSpeech.why.some(w => /speech/.test(w)));
  assert.ok(['CONDITIONAL', 'REJECTED'].includes(HG.recommend(a, R(3.2)).recommendation)); assert.equal(HG.recommend(a, R(4.5, { barriersReviewed: false })).recommendation, 'UNDER_REVIEW', 'unconfirmed hard rules block a pass');
  assert.equal(HG.recommend(a, R(1.5)).recommendation, 'REJECTED'); const noPres = R(4.5, { presenceVotes: { A: { yes: 5, no: 0 }, B: { yes: 2, no: 3 }, C: { yes: 5, no: 0 } } }); assert.notEqual(HG.recommend(a, noPres).recommendation, 'PASS');
  const generic = R(5, { humanBarriers: { 'HR-02': true } }); const g = HG.recommend(a, generic); assert.equal(g.recommendation, 'REJECTED'); assert.ok(g.why[0].startsWith('HR-02'));
  const auto = review(c0); auto.validator.report.eyes.bones = { left: false, right: false }; auto.validator.report.eyes.lookMorphs = 0; auto.validator.result = AV.evaluate(auto.validator.report, { phase: 'head' }); const r = HG.recommend(auto, null); assert.equal(r.recommendation, 'REJECTED'); assert.equal(r.auto, true, 'rejected by automatic rules, without waiting for a person');
});
test('decide: the signature records the recommendation; PASS cannot be forced', () => {
  const c0 = cand('HEAD-001'); let c = withReview(c0, review(c0), R(4.5)); assert.equal(HG.decide(c, 'PASS', 'owner').state, 'PASS'); assert.throws(() => HG.decide(withReview(c0, review(c0), R(1.5)), 'PASS', 'owner'), e => e.code === 'DECISION_NOT_SUPPORTED');
  const d = HG.decide(withReview(c0, review(c0), R(1.5)), 'REJECTED', 'owner', 'weak'); assert.equal(d.decision.by, 'owner'); assert.equal(d.decision.configHash, HG.configHash()); assert.throws(() => HG.decide(withReview(c0, review(c0)), 'PASS', 'owner'), e => e.code === 'DECISION_NOT_SUPPORTED');
});
test('comparison: same tests, ranked by speech first, with the WHY', () => {
  const mk = (id, v) => { const c = cand(id); return withReview(c, review(c), R(v)); };
  const strong = withReview(cand('HEAD-001'), review(cand('HEAD-001')), R(4.8)), weakSpeech = withReview(cand('HEAD-002'), review(cand('HEAD-002')), R(4.8, { speech: Object.fromEntries(HG.SPEECH_ITEMS.map(k => [k, 4.0])) }));
  const barred = withReview(cand('HEAD-003'), review(cand('HEAD-003')), R(5, { humanBarriers: { 'HR-04': true } })), pending = HG.attachReview(cand('HEAD-004'), review(cand('HEAD-004')));
  const cmp = HG.compare([weakSpeech, strong, barred, pending]); assert.equal(cmp.winner, 'HEAD-001'); assert.deepEqual(cmp.ranking, ['HEAD-001', 'HEAD-002']); assert.match(cmp.why[0], /HEAD-001 ranks above HEAD-002 because of SPEECH/);
  assert.deepEqual(cmp.notRanked.map(n => n.id).sort(), ['HEAD-003', 'HEAD-004']); assert.match(cmp.notRanked.find(n => n.id === 'HEAD-003').reason, /HR-04/); assert.match(cmp.notRanked.find(n => n.id === 'HEAD-004').reason, /human review incomplete/);
  assert.deepEqual(cmp.order, ['SPEECH', 'PRESENCE', 'IDENTITY', 'EXPRESSION', 'VISUAL', 'TECHNICAL']); assert.equal(HG.compare([pending]).winner, null); assert.match(HG.compare([pending]).why[0], /No candidate can be ranked/);
  assert.equal(HG.compare([HG.createCandidate({ id: 'HEAD-009' })]).rows[0].recommendation, 'PENDING_ASSET');
});
test('the review page is a self-contained form: only human items, every barrier, no kit needed', () => {
  const c = cand('HEAD-001'), a = review(c); a.shots = [{ id: '01_FRONT_NEUTRAL' }]; a.speech = Object.assign({ script: { text: 't', seconds: 13, syllables: 33, requiredVisemes: [] }, stills: [] }, a.speech); a.presence = Object.assign({ cues: HG.CONFIG.presence.cues, frames: [], questions: HG.CONFIG.presence.questions }, a.presence); a.expression = { rows: [] };
  const html = WA.ReviewPage.page(c, a, (k, id) => k + '/' + id + '.png'); assert.match(html, /shot\/01_FRONT_NEUTRAL\.png/); assert.match(html, /data-item="F1"/); assert.ok(!/data-item="X2"/.test(html), 'automated items are not asked of a person'); assert.ok(!/data-item="P1"/.test(html), 'derived from the votes');
  HG.HR.forEach(h => assert.ok(html.includes('data-hb="' + h[0] + '"'), h[0])); assert.match(html, /data-speech="noavatar"/); assert.ok(!/<script src/.test(html));
});
