// Head Gate: registry on disk and the Golden Review Package writer. Node only. The domain logic is src/review/HeadGate.js.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');

function loadKit() {
  global.window = global;
  const files = ['core/util.js', 'model/channels.js', 'control/VisemeEngine.js', 'control/ExpressionController.js', 'review/ScorecardData.js', 'review/SpeechScript.js', 'review/HeadGate.js', 'review/ReviewPage.js'];
  files.forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), { filename: f }));
  return global.AvatarKit;
}
const WA = loadKit(), HG = WA.HeadGate;
const pad = n => String(n).padStart(3, '0');

class Registry {
  constructor(root) { this.root = root; }
  dir(id) { return path.join(this.root, 'candidates', id); }
  file(id) { return path.join(this.dir(id), 'candidate.json'); }
  vdir(id, v) { return path.join(this.dir(id), 'v' + pad(v)); }
  has(id) { return fs.existsSync(this.file(id)); }
  get(id) { if (!this.has(id)) throw WA.AvatarError('NO_CANDIDATE', 'No candidate ' + id + ' in ' + this.root); return JSON.parse(fs.readFileSync(this.file(id), 'utf8')); }
  save(c) { fs.mkdirSync(this.dir(c.id), { recursive: true }); fs.writeFileSync(this.file(c.id), JSON.stringify(c, null, 1)); return c; }
  list() { const d = path.join(this.root, 'candidates'); return fs.existsSync(d) ? fs.readdirSync(d).filter(x => HG.ID_RE.test(x) && this.has(x)).sort().map(x => this.get(x)) : []; }
}
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/* ---------------- markdown pieces ---------------- */
const T = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'].concat(rows.map(r => '| ' + r.map(c => String(c == null ? '-' : c).replace(/\|/g, '/')).join(' | ') + ' |')).join('\n');
const yn = b => b ? 'yes' : 'no';
const val = v => v == null ? '**HUMAN REVIEW REQUIRED**' : v + '%';

function technicalMd(c, rec) {
  const a = c.review.automated, m = HG.metrics(a), v = a.validator, S = rec.scores.sections.TECHNICAL;
  return ['# 1. Technical report: ' + c.id + ' v' + c.version, '', 'Produced by the existing AssetValidator (phase "head"). Technical score: **' + S.value + '%** (' + S.points + ' of ' + S.max + ' automatic points). Validator verdict: **' + v.result.verdict + '**.', '',
    T(['fact', 'value'], [['file', c.asset.file + ' (' + (c.asset.bytes ? (c.asset.bytes / 1048576).toFixed(2) + ' MB' : '?') + ')'], ['sha256', c.asset.sha256.slice(0, 16) + '...'], ['triangles', m.triangles], ['meshes', m.meshes], ['materials', m.materials], ['textures', m.textures + ' (' + m.textureMB + ' MB on the GPU, largest ' + m.maxTexture + ' px)'],
      ['morph targets', m.morphTargets], ['ARKit channels', m.arkit.found + ' of 52 (' + Math.round(m.arkit.coverage * 100) + '%); missing: ' + (m.arkit.missing.join(', ') || 'none')], ['visemes', m.visemes.found + ' of 15, native: ' + yn(m.visemes.native) + '; missing: ' + (m.visemes.missing.join(', ') || 'none')],
      ['eye bones (left / right)', yn(m.eyeBones.left) + ' / ' + yn(m.eyeBones.right) + '; mode ' + m.eyeMode + '; eyeLook morphs ' + m.eyeLookMorphs + ' of 8'], ['jaw', m.jaw.morph ? 'jawOpen morph' : m.jaw.mode], ['skeleton', m.bones + ' mapped bones; head-phase bones missing: ' + (m.missingBones.join(', ') || 'none')], ['animation clips', m.clips.join(', ') || 'none'],
      ['compression', 'meshopt ' + yn(m.compression.meshopt) + ', draco ' + yn(m.compression.draco) + ', quantised ' + yn(m.compression.quantized)], ['KTX2', yn(m.ktx2)], ['extensions', m.extensions.join(', ') || 'none'], ['load time', m.loadMs == null ? '-' : m.loadMs + ' ms'], ['rig grade', m.grade]]), '',
    '## Gates', '', v.result.gates.map(g => '* [' + (g.ok ? 'ok' : 'FAILED') + '] ' + g.label).join('\n'), '', '## Automatic categories', '',
    T(['category', 'auto points', 'max', 'unmeasured'], v.result.categories.filter(x => x.autoMax).map(x => [x.label, x.auto == null ? 'n/m' : x.auto.toFixed(1), x.autoMax.toFixed(1), x.unmeasured])), '',
    '## Items below 70%', '', (v.result.fixes.length ? v.result.fixes.map(f => '* ' + f).join('\n') : 'none'), '', a.software ? 'Renderer: ' + a.renderer.renderer + ' (software): FPS is **not measured**; measure on a real GPU in the Avatar Lab.' : 'Renderer: ' + a.renderer.renderer, ''].join('\n');
}
function expressionMd(c) {
  const a = c.review.automated, mp = a.mapping, ex = a.expression, tr = a.transitions;
  return ['# 3. Expression report: ' + c.id, '', '## Mapping: Bible expressions to this rig', '', 'Channels the expression needs, and whether the rig has them. **UNMAPPED** means no clear equivalent was found; nothing was guessed. **MAPPED_FUZZY** matched by name tokens and must be confirmed by a person (add it to the candidate\'s RigMap to confirm).', '',
    T(['expression', 'mix', 'channels', 'unmapped', 'fuzzy (confirm)', 'reproducible'], mp.expressions.map(e => [e.id, e.mix.map(m => m[0] + ' ' + m[1]).join(' + '), e.required.length, e.unmapped.join(', ') || '-', e.fuzzy.join(', ') || '-', yn(e.reproducible)])), '',
    'Not reproducible: ' + (mp.notReproducible.join(', ') || 'none') + '. Visemes the standard sentence needs: ' + mp.visemes.required.length + '; missing: ' + (mp.visemes.missing.join(', ') || 'none') + '.', '', '## Deformation of the head mesh (head heights; 1.0 = the whole head)', '',
    T(['expression', 'rms', 'peak', 'upper', 'mid', 'lower', 'asym', 'from neutral', 'closest to', 'status'], ex.rows.map(r => [r.id, r.rms, r.max, r.upper, r.mid, r.lower, r.asym, r.fromNeutral, r.nearest + ' (' + r.nearestDist + ')', r.dead ? 'DEAD' : r.exploding ? 'EXPLODES' : r.overBudget ? 'over budget' : 'ok'])), '',
    'Peak of any expression: ' + ex.maxPeak + ' (Bible budget limit ' + HG.CONFIG.limits.expressionPeak + '). Skeptical asymmetry: ' + ex.skepticalAsym + ' (target 0.12 or more). Indistinct pairs: ' + (ex.indistinct.join(', ') || 'none') + '.', '',
    '## Transitions', '', T(['sequence', 'steps', 'popping (vertex/frame)', 'popping speaking', 'combination excess', 'peak', 'neutral drift (info)', 'eye alignment', 'jaw jerk', 'flags'], ['A', 'B'].map(k => [k, tr[k].steps.join(' > '), tr[k].metrics.maxVertexStep, tr[k].metrics.maxVertexStepSpeech, tr[k].metrics.combinationExcess, tr[k].metrics.peak, tr[k].metrics.neutralDrift, tr[k].metrics.eyeAlignMax, tr[k].metrics.jawJerk, tr[k].flags.length])), '',
    tr.flags.length ? tr.flags.map(f => '* **' + f + '**').join('\n') : 'No automatic transition flag.', '', '**HUMAN REVIEW REQUIRED:** is she the same person in every state? any popping, snapping, loss of identity, misaligned eyes or artificial jaw that the numbers do not show? Look at the stills in `expressions/` and `review.html`.', ''].join('\n');
}
function speechMd(c) {
  const sp = c.review.automated.speech, m = sp.metrics;
  return ['# 4. Speech report: ' + c.id, '', '> "' + sp.script.text + '"', '', sp.script.seconds + ' s, ' + sp.script.syllables + ' syllables, ' + sp.script.requiredVisemes.length + ' visemes. A fixed phoneme timeline (no TTS, no audio): it tests the rig, not a voice.', '',
    'The speech test weighs more than the static stills: **a head that is good still and bad speaking is not accepted.** PASS needs a speech mean of 4.0/5 or more; below 3.0 is rejected.', '', '## Measured (automatic)', '',
    T(['measure', 'value', 'limit'], [['mouth cycles per syllable', m.cyclesPerSyllable, HG.CONFIG.limits.cyclesPerSyllable.join(' to ')], ['jaw / lower-face smoothness (p95 jerk)', m.jerkJaw, '<= ' + HG.CONFIG.limits.jerkP95], ['cheek smoothness', m.jerkCheeks, '<= ' + HG.CONFIG.limits.jerkP95], ['chin smoothness', m.jerkChin, '<= ' + HG.CONFIG.limits.jerkP95],
      ['jaw at p/b/m vs open vowels', m.closureContrast, '<= ' + HG.CONFIG.limits.closureContrast], ['eye alignment (rad)', m.eyeAlignMax, '<= ' + HG.CONFIG.limits.eyeAlign], ['peak deformation', m.peakDisplacement, '<= ' + HG.CONFIG.limits.speechPeak], ['visemes never reached', m.visemesNotReached.join(', ') || 'none', 'none']]), '',
    sp.flags.length ? '## Flags\n\n' + sp.flags.map(f => '* **' + f + '**').join('\n') : 'No automatic flag.', '', '## Human checklist (12 items, 0 to 5)', '', 'Look at `speech/` (stills at the peaks of aa, p/b/m, f/v, o, th, e, u) and play the speech in the Avatar Lab (Voice > Speak) or in `review.html`.', '',
    T(['item', 'what to look for'], [['Mouth naturalness', 'a mouth that speaks, not one that opens and closes'], ['Teeth', 'real, uneven, never a white bar; no clipping through the lips'], ['Tongue', 'visible in th, d, n, l, r, k; moves, is not a pink block'], ['Jaw', 'moves with the sounds, no sliding, no unnatural drop'], ['Synchronisation', 'closures on p/b/m, f/v tucks the lip, vowels open'],
      ['Lip deformation', 'lips round, spread and seal without folds, tearing or collapsing corners'], ['Eye stability', 'no jitter, both eyes agree, no drift while speaking'], ['Cheek stability', 'no wobble or flicker'], ['Chin stability', 'no vibration or sliding'], ['Micro-expressions while speaking', 'brows and lids stay alive, subtly'], ['Human appearance', 'a person speaking'], ['Absence of the "avatar" effect', 'not a talking mask']]), '',
    '**Status of the speech score: ' + val(HG.score(c.review.automated, c.review.ratings).sections.SPEECH.value) + '**', ''].join('\n');
}
function presenceMd(c) {
  const p = c.review.automated.presence, m = p.metrics;
  return ['# 5. Presence report (1.5 second test): ' + c.id, '', 'Cues: ' + p.cues.map(x => x.t + ' s ' + x.what).join(' · ') + '. Frames in `presence/`.', '', T(['event', 'detected', 'measure'], [['micro eye movement (0.3 s)', yn(m.eyeMoveDetected), m.eyeMove + ' rad'], ['small breath (0.6 s)', yn(m.breathDetected), m.breathRise], ['micro facial change (0.9 s), subtle but visible', yn(m.faceChangeInRange), m.faceChange], ['gaze stabilises (1.2 s)', yn(m.eyeStableAtEnd), '-'], ['no fidgeting', yn(!m.fidget), m.headMotion + ' rad of head motion']]), '',
    '## The three formal questions (the observer answers at 1.5 s)', '', p.questions.map(q => '* **' + q.id + '.** ' + q.text + '  (feeds scorecard ' + q.scorecard + ')').join('\n'), '', 'Pass: at least 80% "yes" on **each** question. The goal is not "beautiful"; it is **presence**.', '', '**HUMAN REVIEW REQUIRED.** Votes recorded: ' + Object.keys((c.review.ratings || {}).presenceVotes || {}).map(k => k + ' ' + JSON.stringify(c.review.ratings.presenceVotes[k])).join('; ') || 'none', ''].join('\n');
}
function scorecardMd(c, rec) {
  const S = rec.scores.sections, sc = rec.scores.scorecard;
  return ['# 6. Scorecard: ' + c.id, '', T(['section', 'score', 'status', 'rated / total', 'pending items'], Object.keys(S).map(k => [k, val(S[k].value) + (S[k].value == null && S[k].partial != null ? ' (partial ' + S[k].partial + '%)' : ''), S[k].status, S[k].rated != null ? S[k].rated + ' / ' + S[k].of : '-', (S[k].pending || []).join(', ') || '-'])), '',
    'Scorecard total (Phase 1 items, weights from `EXECUTIVE_AVATAR_VISUAL_SCORECARD.md`): **' + (sc.value == null ? 'HUMAN REVIEW REQUIRED' : sc.value + '/100') + '**' + (sc.value == null && sc.partial != null ? ' (partial ' + sc.partial + '% over ' + sc.rated + ' of ' + sc.of + ' items)' : '') + '.', '',
    'Sections: TECHNICAL = validator; VISUAL = FACE, EYES, SKIN, HAIR, CINEMATIC; PRESENCE; SPEECH = the 12-item speech checklist; EXPRESSION = the expression items except X5; IDENTITY. Clothing does not apply to a head. No weight was invented; a section with a missing item stays null, never zero.', '',
    T(['item', 'category', 'score', 'source', 'what'], rec.scores.items.map(i => [i.id, i.cat, i.score == null ? 'HUMAN REVIEW REQUIRED' : i.score, i.source, i.text])), ''].join('\n');
}
function barriersMd(c, rec) {
  return ['# 7. Hard rejection rules: ' + c.id, '', 'Any triggered rule rejects the candidate, whatever the scores. "unknown" means a person has not decided yet.', '', T(['rule', 'barrier', 'mode', 'status', 'evidence'], rec.barriers.map(b => [b.id, b.label, b.mode, b.triggered === true ? '**TRIGGERED**' : b.triggered === false ? 'clear' : 'unknown (human)', b.evidence.join('; ') || '-'])), ''].join('\n');
}
function recommendationMd(c, rec) {
  return ['# 8. Final recommendation: ' + c.id + ' v' + c.version, '', '**' + rec.recommendation + '**' + (rec.auto ? ' (decided by automatic rules)' : ''), '', rec.why.map(w => '* ' + w).join('\n'), '', rec.todo.length ? '## Still needed\n\n' + rec.todo.map(t => '* ' + t).join('\n') : '', '',
    'Current state: ' + c.state + (c.decision ? ' (signed by ' + c.decision.by + ' on ' + c.decision.date + ')' : ''), '', 'To sign: `node tools/head-gate.js decide ' + c.id + ' --decision ' + (rec.recommendation === 'UNDER_REVIEW' ? 'PASS|CONDITIONAL|REJECTED' : rec.recommendation) + ' --by "Name"`', ''].join('\n');
}
function checklistMd(c, rec) {
  const items = WA.ReviewPage.humanItems(), A = c.review.automated;
  return ['# 2. Visual review checklist: ' + c.id + ' v' + c.version, '', 'Open `review.html` for the stills and the rating form. Same camera, lens, lighting, background, resolution and exposure for every candidate. Do not compare candidates by anything else.', '', '## Shots', '', A.shots.map(s => '* ' + s.id + '  (`shots/' + s.id + '.png`)').join('\n'), '',
    '## Order of review', '', '1. The ten shots. 2. The 1.5 s presence frames and the three questions. 3. **The speech** (stills and playback): the most important gate. 4. The ten expressions and the transitions: one face? 5. Identity: likeness test (10 viewers), blind comparison, Visual DNA (10 traits).', '', '## Items a person must score (0 to 5)', '', T(['item', 'category', 'what'], items.map(i => [i.id, i.cat, i.text])), '',
    '## Presence questions (yes / no, each reviewer)', '', A.presence.questions.map(q => '* ' + q.id + '. ' + q.text).join('\n'), '', '## Hard rules a person must confirm (yes / no)', '', rec.barriers.filter(b => b.mode.includes('human')).map(b => '* ' + b.id + ' ' + b.label).join('\n'), '', 'Then: `node tools/head-gate.js rate ' + c.id + ' --file ratings.json`', ''].join('\n');
}

/* writes the whole Golden Review Package of the current version of a candidate */
function writePackage(reg, c, images) {
  const rec = HG.recommend(c.review.automated, c.review.ratings), dir = path.join(reg.vdir(c.id, c.version), 'package'); fs.mkdirSync(dir, { recursive: true });
  const w = (name, body) => fs.writeFileSync(path.join(dir, name), body);
  const png = (sub, name, data) => { if (!data) return; fs.mkdirSync(path.join(dir, sub), { recursive: true }); fs.writeFileSync(path.join(dir, sub, name + '.png'), Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64')); };
  if (images) {
    images.shots.forEach(s => png('shots', s.id, s.dataUrl)); images.speech.forEach(s => png('speech', s.id, s.dataUrl)); images.presence.forEach(s => png('presence', 't' + s.t, s.dataUrl)); images.expression.forEach(s => png('expressions', s.id, s.dataUrl));
  }
  w('1_technical_report.md', technicalMd(c, rec)); w('2_visual_review_checklist.md', checklistMd(c, rec)); w('3_expression_report.md', expressionMd(c)); w('4_speech_report.md', speechMd(c)); w('5_presence_report.md', presenceMd(c));
  w('6_scorecard.md', scorecardMd(c, rec)); w('7_rejection_barriers.md', barriersMd(c, rec)); w('8_final_recommendation.md', recommendationMd(c, rec));
  w('review.html', WA.ReviewPage.page(c, c.review.automated, (kind, id) => ({ shot: 'shots/' + id + '.png', speech: 'speech/' + id + '.png', presence: 'presence/' + id + '.png', expression: 'expressions/' + id + '.png' })[kind]));
  w('result.json', JSON.stringify({ candidate: { id: c.id, version: c.version, state: c.state, asset: c.asset }, configHash: c.review.automated.configHash, recommendation: rec.recommendation, why: rec.why, todo: rec.todo, sections: Object.fromEntries(Object.keys(rec.scores.sections).map(k => [k, rec.scores.sections[k]])), scorecard: rec.scores.scorecard, barriers: rec.barriers }, null, 1));
  return { dir, rec };
}
function compareMd(cmp) {
  return ['# Head candidates: comparison', '', 'Every candidate was reviewed under the same configuration (`' + HG.configHash() + '`) with the same tests. Order of importance: **' + cmp.order.join(' > ') + '** (speech first; a head that is good still and bad speaking does not win).', '',
    T(['candidate', 'state', 'recommendation'].concat(cmp.order).concat(['scorecard', 'barriers']), cmp.rows.map(r => [r.id + ' v' + r.version, r.state, r.recommendation].concat(cmp.order.map(k => r.sections[k] == null ? 'HUMAN REVIEW' : r.sections[k] + '%')).concat([r.total == null ? 'HUMAN REVIEW' : r.total, r.barriers.join(', ') || '-']))), '',
    '## Winner', '', cmp.winner ? '**' + cmp.winner + '**' : '**none**: no candidate is complete and free of barriers.', '', '## WHY', '', cmp.why.map(x => '* ' + x).join('\n'), '', cmp.notRanked.length ? '## Not ranked\n\n' + cmp.notRanked.map(n => '* ' + n.id + ': ' + n.reason).join('\n') : '', ''].join('\n');
}

module.exports = { WA, HG, Registry, sha256, writePackage, compareMd, loadKit, pad };
