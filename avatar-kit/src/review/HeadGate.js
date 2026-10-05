/*
 * HeadGate: the domain of the Head Prototype Gate. Pure logic (no DOM, no WebGL, no files), so it runs in Node and in the browser.
 *
 *   candidate registry   HEAD-001, HEAD-002...: identity, versions, file hash, state machine
 *   review configuration the single, hashed set of conditions every candidate is rendered and tested under
 *   mapping report       which morph targets drive which Bible expressions; what is UNMAPPED
 *   scoring              TECHNICAL / VISUAL / PRESENCE / SPEECH / EXPRESSION / IDENTITY, reusing the visual scorecard weights
 *   hard barriers        the 14 rejection rules, automatic where the code can know, human where it cannot
 *   decision             PASS / CONDITIONAL / REJECTED, with the reasons, and the comparison between candidates with WHY
 *
 * Honesty rule: a score that needs a person is never invented. It stays null with status "HUMAN REVIEW REQUIRED"
 * until the ratings exist; a null never counts as zero and never as a pass.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, SC = WA.ScorecardData, clamp = WA.clamp;

  /* ================= review configuration (deterministic) ================= */
  var CONFIG = {
    version: 1,
    canvas: { width: 1280, height: 720, pixelRatio: 1 },
    quality: 'high',
    camera: { shot: 'CLOSE', style: 'executive', look: 'camera' },
    lighting: 'executive',                  // the SAME lighting for every shot of every candidate
    step: 1 / 30,                           // simulation step; no wall-clock time is ever used
    settle: 4,                              // seconds a shot is held before it is captured
    orbit: { front: 0, threeQuarter: 0.61, profile: 1.5708 },
    shots: [
      { id: '01_FRONT_NEUTRAL', kind: 'pose', pose: { expression: 'neutral' }, orbit: 'front', gaze: 'camera' },
      { id: '02_FRONT_LISTENING', kind: 'pose', pose: { state: 'LISTENING' }, orbit: 'front', gaze: 'camera' },
      { id: '03_FRONT_THINKING', kind: 'pose', pose: { state: 'THINKING' }, orbit: 'front', gaze: 'camera', waitFor: 'gazeAway' },
      { id: '04_FRONT_FIRM', kind: 'pose', pose: { expression: 'firm' }, orbit: 'front', gaze: 'camera' },
      { id: '05_FRONT_SKEPTICAL', kind: 'pose', pose: { expression: 'skeptical' }, orbit: 'front', gaze: 'camera' },
      { id: '06_THREE_QUARTER', kind: 'pose', pose: { state: 'LISTENING' }, orbit: 'threeQuarter', gaze: 'camera' },
      { id: '07_PROFILE', kind: 'pose', pose: { expression: 'neutral' }, orbit: 'profile', gaze: 'center' },
      { id: '08_SPEAKING', kind: 'speech', still: 'viseme_aa', orbit: 'front', gaze: 'camera' },
      { id: '09_SPEAKING_CLOSE', kind: 'speech', still: 'viseme_O', orbit: 'front', gaze: 'camera', framing: 'intimate' },   // tighter framing, SAME lighting
      { id: '10_IDLE_1_5_SECONDS', kind: 'presence' }
    ],
    presence: {
      seconds: 1.5, breathPeriod: 4.6,
      cues: [{ t: 0.0, what: 'neutral face' }, { t: 0.3, what: 'micro eye movement' }, { t: 0.6, what: 'small breath' }, { t: 0.9, what: 'micro facial change' }, { t: 1.2, what: 'gaze stabilises' }, { t: 1.5, what: 'observer answers A, B, C' }],
      microEye: { x: 0.035, y: -0.02 }, microFace: { expression: 'listening', intensity: 0.35 },
      questions: [
        { id: 'A', text: 'Does she look like a real adult person?', scorecard: 'P1' },
        { id: 'B', text: 'Does she look like someone with executive authority?', scorecard: 'P2' },
        { id: 'C', text: 'Would I trust her to tell me something I do not want to hear?', scorecard: 'P3' }]
    },
    // thresholds are first defensible values, to be recalibrated with the first professional asset (see HEAD_PROTOTYPE_GATE.md)
    limits: {
      expressionPeak: 0.06, speechPeak: 0.1, exploding: 0.14, vertexStep: 0.012, speechStep: 0.04, combinationExcess: 1.2,
      eyeAlign: 0.12, jerkP95: 0.35, cyclesPerSyllable: [0.4, 1.4], closureContrast: 0.55, microEyeMin: 0.008, breathMin: 0.1,
      faceChange: [0.00004, 0.004], fidgetMax: 0.03, eyeStableStd: 0.012, xSubtlety: [0.035, 0.1], skepticalAsym: [0.03, 0.12]
    },
    pass: { total: 85, conditional: 70, itemMin: 3, itemMinConditional: 2, speech: 4.0, speechReject: 3.0, presenceYes: 0.8 }
  };
  function stable(x) { return JSON.stringify(x, function (k, v) { if (v && typeof v === 'object' && !Array.isArray(v)) { var o = {}; Object.keys(v).sort().forEach(function (key) { o[key] = v[key]; }); return o; } return v; }); }
  function hash(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function configHash() { return hash(stable(CONFIG)); }

  /* ================= candidates and the state machine ================= */
  var STATES = ['PENDING_ASSET', 'DRAFT', 'UNDER_REVIEW', 'PASS', 'CONDITIONAL', 'REJECTED'];
  var TRANSITIONS = {
    PENDING_ASSET: ['DRAFT'], DRAFT: ['UNDER_REVIEW', 'REJECTED'], UNDER_REVIEW: ['PASS', 'CONDITIONAL', 'REJECTED', 'DRAFT'],
    PASS: ['UNDER_REVIEW'], CONDITIONAL: ['UNDER_REVIEW', 'REJECTED'], REJECTED: ['DRAFT']
  };
  var ID_RE = /^HEAD-\d{3}$/;
  function canTransition(a, b) { return (TRANSITIONS[a] || []).indexOf(b) >= 0; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function err(code, msg) { return WA.AvatarError(code, msg); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function createCandidate(o) {
    o = o || {}; if (!ID_RE.test(o.id || '')) throw err('BAD_CANDIDATE_ID', 'Candidate id must look like HEAD-001, got "' + o.id + '"');
    var c = { id: o.id, name: o.name || o.id, vendor: o.vendor || '', sample: !!o.sample, version: 0, state: 'PENDING_ASSET', created: o.date || today(), asset: null, rigMap: o.rigMap || null, notes: o.notes || '', review: null, decision: null, history: [], log: [] };
    c.log.push({ date: c.created, event: 'created', state: c.state });
    if (o.file) return registerAsset(c, o);
    return c;
  }
  /* The GLB of a candidate. A new asset after a decision archives the previous version: the candidate's identity stays, the review starts over. */
  function registerAsset(c, a) {
    c = clone(c); if (!a || !a.file || !a.sha256) throw err('BAD_ASSET', 'registerAsset needs { file, sha256 }');
    if (c.state === 'PENDING_ASSET') { /* first asset */ }
    else if (c.state === 'DRAFT') { /* replacing a draft: fine */ }
    else if (c.state === 'PASS' || c.state === 'CONDITIONAL' || c.state === 'REJECTED') { c.history.push({ version: c.version, state: c.state, asset: c.asset, decision: c.decision }); }
    else throw err('ILLEGAL_TRANSITION', c.id + ' is ' + c.state + ': decide it (or withdraw it to DRAFT) before a new asset is registered');
    c.version = a.version || (c.version + 1); if (c.history.length && c.version <= c.history[c.history.length - 1].version) throw err('VERSION_NOT_NEWER', 'A new asset needs a version above ' + c.history[c.history.length - 1].version);
    c.asset = { file: a.file, sha256: a.sha256, bytes: a.bytes || null, vendor: a.vendor || c.vendor, date: a.date || today(), note: a.note || '' }; if (a.vendor) c.vendor = a.vendor;
    c.review = null; c.decision = null; c.state = 'DRAFT'; c.log.push({ date: c.asset.date, event: 'asset registered v' + c.version, state: 'DRAFT' }); return c;
  }
  function transition(c, to, meta) {
    c = clone(c); if (STATES.indexOf(to) < 0) throw err('BAD_STATE', 'Unknown state ' + to);
    if (!canTransition(c.state, to)) throw err('ILLEGAL_TRANSITION', c.id + ': ' + c.state + ' -> ' + to + ' is not allowed');
    c.state = to; c.log.push({ date: (meta && meta.date) || today(), event: (meta && meta.event) || 'transition', state: to, by: meta && meta.by }); return c;
  }
  function attachReview(c, review) {
    if (c.state !== 'DRAFT' && c.state !== 'UNDER_REVIEW') throw err('ILLEGAL_TRANSITION', c.id + ' is ' + c.state + ': start a new version to review again');
    if (review.candidate && (review.candidate.id !== c.id || review.candidate.sha256 !== c.asset.sha256)) throw err('REVIEW_MISMATCH', 'The review belongs to ' + review.candidate.id + ' / ' + review.candidate.sha256 + ', not to ' + c.id + ' / ' + c.asset.sha256);
    if (review.configHash !== configHash()) throw err('CONFIG_MISMATCH', 'The review was produced under another review configuration (' + review.configHash + ' != ' + configHash() + ')');
    var n = clone(c); n.review = { automated: review, ratings: (c.review && c.review.ratings) || null }; if (n.state === 'DRAFT') n = transition(n, 'UNDER_REVIEW', { event: 'automated review attached' }); return n;
  }
  function attachRatings(c, ratings) {
    if (!c.review) throw err('NO_REVIEW', c.id + ' has no automated review yet'); var n = clone(c); n.review.ratings = mergeRatings(n.review.ratings, ratings); return n;
  }
  function mergeRatings(a, b) {
    var r = clone(a || { reviewers: [], items: {}, speech: {}, presenceVotes: {}, humanBarriers: {}, likeness: null, blind: null, dnaTraits: null }); b = b || {};
    (b.reviewers || []).forEach(function (n) { if (r.reviewers.indexOf(n) < 0) r.reviewers.push(n); });
    ['items', 'speech'].forEach(function (k) { Object.keys(b[k] || {}).forEach(function (id) { r[k][id] = [].concat(b[k][id]); }); });
    Object.keys(b.presenceVotes || {}).forEach(function (q) { r.presenceVotes[q] = b.presenceVotes[q]; });
    Object.keys(b.humanBarriers || {}).forEach(function (q) { r.humanBarriers[q] = b.humanBarriers[q]; });
    ['likeness', 'blind', 'dnaTraits', 'barriersReviewed'].forEach(function (k) { if (b[k] != null) r[k] = b[k]; }); return r;
  }
  function median(a) { a = [].concat(a).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

  /* ================= mapping layer: Bible expressions -> available morph targets ================= */
  var REVIEW_EXPRESSIONS = [
    { id: 'listening', mix: [['listening', 1]], drive: { state: 'LISTENING' } },
    { id: 'thinking', mix: [['thinking', 1]], drive: { state: 'THINKING' } },
    { id: 'perceived_unsaid', mix: [['analyzing', 0.6], ['thinking', 0.3]], drive: { state: 'PROCESSING' } },
    { id: 'disagreement', mix: [['skeptical', 0.8], ['firm', 0.3]], drive: { state: 'CHALLENGE' } },
    { id: 'rationalization', mix: [['skeptical', 0.5]], drive: { expression: 'skeptical', intensity: 0.5 }, note: 'review approximation: skeptical at 0.5 (the slow blink and head tilt are the engine\'s)' },
    { id: 'continue', mix: [['listening', 1]], drive: { state: 'LISTENING' }, note: 'the micro-nod is the engine\'s' },
    { id: 'welcoming', mix: [['empathetic', 0.6], ['confident', 0.25]], drive: { expression: 'empathetic', intensity: 0.6 }, note: 'review approximation: empathetic at 0.6' },
    { id: 'firm', mix: [['firm', 1]], drive: { expression: 'firm' } },
    { id: 'skeptical', mix: [['skeptical', 1]], drive: { expression: 'skeptical' } },
    { id: 'confident', mix: [['confident', 1]], drive: { state: 'CONFIDENCE' } }
  ];
  /* The channels an expression needs: the departure from the relaxed baseline that is at least 0.1 in any emotion of its mix. */
  function requiredChannels(exp) {
    var E = WA.ExpressionController.EMOTIONS, B = WA.ExpressionController.BASE, need = {};
    exp.mix.forEach(function (m) { var f = E[m[0]].face; Object.keys(f).forEach(function (ch) { if (Math.abs(f[ch] - (B[ch] || 0)) >= 0.1 || (ch === 'jawClench' && f[ch] >= 0.1)) need[ch] = Math.max(need[ch] || 0, f[ch]); }); });
    return Object.keys(need).sort();
  }
  /*
   * res = the model's RigMap resolution (model.res). Nothing is guessed: a channel is MAPPED_EXACT, MAPPED_ALIAS, MAPPED_FUZZY (a name-token match
   * that a person must confirm) or UNMAPPED. A mirrored model is only trusted when the candidate's RigMap says so.
   */
  function mappingReport(res) {
    var how = (res.report && res.report.matchedBy) || {}, rows = REVIEW_EXPRESSIONS.map(function (e) {
      var req = requiredChannels(e).map(function (ch) {
        var names = res.morphs[ch]; if (!names || !names.length) return { ch: ch, status: 'UNMAPPED', names: [] };
        return { ch: ch, status: how[ch] === 'exact' ? 'MAPPED_EXACT' : how[ch] === 'alias' ? 'MAPPED_ALIAS' : 'MAPPED_FUZZY', names: names };
      });
      var unm = req.filter(function (r) { return r.status === 'UNMAPPED'; }), fuzzy = req.filter(function (r) { return r.status === 'MAPPED_FUZZY'; });
      var share = req.length ? (req.length - unm.length) / req.length : 1;
      return { id: e.id, mix: e.mix, note: e.note || null, required: req, unmapped: unm.map(function (r) { return r.ch; }), fuzzy: fuzzy.map(function (r) { return r.ch; }), share: +share.toFixed(2),
        reproducible: unm.length <= 1 && share >= 0.8 };
    });
    var script = WA.SpeechScript ? WA.SpeechScript.info().requiredVisemes : [], missingV = script.filter(function (v) { return !(res.visemes && res.visemes[v]); });
    return { expressions: rows, notReproducible: rows.filter(function (r) { return !r.reproducible; }).map(function (r) { return r.id; }), fuzzyChannels: Array.from(new Set(rows.reduce(function (a, r) { return a.concat(r.fuzzy); }, []))),
      visemes: { required: script, missing: missingV, native: !!(res.report && res.report.visemesNative) } };
  }

  /* ================= scoring ================= */
  function lin(x, lo, hi) { return clamp((x - lo) / (hi - lo), 0, 1); }
  function yesToScore(rate) { var t = SC.presenceYesToScore; for (var i = 0; i < t.length; i++) if (rate >= t[i][0] - 1e-9) return t[i][1]; return 0; }
  var SPEECH_ITEMS = ['naturalness', 'teeth', 'tongue', 'jaw', 'sync', 'lips', 'eyes', 'cheeks', 'chin', 'micro', 'human', 'noavatar'];
  var SPEECH_LABELS = { naturalness: 'Mouth naturalness', teeth: 'Teeth', tongue: 'Tongue', jaw: 'Jaw', sync: 'Synchronisation', lips: 'Lip deformation', eyes: 'Eye stability', cheeks: 'Cheek stability', chin: 'Chin stability', micro: 'Micro-expressions while speaking', human: 'Human appearance', noavatar: 'Absence of the "avatar" effect' };
  var SPEECH_TO_F5 = ['naturalness', 'teeth', 'tongue', 'lips'];

  /* automatic scores for the items the code can honestly measure (0 to 5), or null when the measurement does not exist */
  function autoItems(auto) {
    var L = CONFIG.limits, out = {}, ex = auto && auto.expression, tr = auto && auto.transitions, pr = auto && auto.presence;
    if (ex && ex.maxPeak != null) out.X2 = +(5 * (1 - lin(ex.maxPeak, L.xSubtlety[0], L.xSubtlety[1]))).toFixed(2);
    if (ex && ex.skepticalAsym != null) out.X3 = +(5 * lin(ex.skepticalAsym, L.skepticalAsym[0], L.skepticalAsym[1])).toFixed(2);
    if (tr && tr.flags) out.X4 = Math.max(0, 5 - tr.flags.length);
    if (pr && pr.metrics) { var m = pr.metrics, bad = [!m.eyeMoveDetected, !m.breathDetected, !m.faceChangeInRange, !m.eyeStableAtEnd, m.fidget].filter(Boolean).length; out.X6 = Math.max(0, 5 - bad); }
    return out;
  }
  function itemScore(it, auto, rt, autoMap) {
    var id = it[0], r = rt || {}, v = null, src = 'human';
    if (autoMap[id] != null) return { id: id, score: autoMap[id], source: 'automated' };
    if (id === 'X5' || id === 'F5') {
      var keys = id === 'X5' ? SPEECH_ITEMS : SPEECH_TO_F5, vals = keys.map(function (k) { return median((r.speech || {})[k]); });
      if (vals.every(function (x) { return x != null; })) return { id: id, score: +(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(2), source: 'speech checklist' };
      return { id: id, score: null, source: 'human' };
    }
    if (id === 'P1' || id === 'P2' || id === 'P3') { var q = CONFIG.presence.questions.filter(function (x) { return x.scorecard === id; })[0], pv = (r.presenceVotes || {})[q.id]; if (pv && pv.yes + pv.no >= 1) return { id: id, score: yesToScore(pv.yes / (pv.yes + pv.no)), source: 'presence votes', rate: pv.yes / (pv.yes + pv.no), n: pv.yes + pv.no }; return { id: id, score: null, source: 'human' }; }
    if (id === 'I1' && r.likeness) return { id: id, score: r.likeness.names === 0 ? 5 : r.likeness.names === 1 ? 4 : 0, source: 'likeness test' };
    if (id === 'I3' && r.dnaTraits != null) return { id: id, score: +(r.dnaTraits / 10 * 5).toFixed(2), source: 'DNA traits' };
    if (id === 'I4' && r.blind) return { id: id, score: yesToScore(r.blind.picked / r.blind.of), source: 'blind comparison' };
    var m = median((r.items || {})[id]); return { id: id, score: m, source: 'human' };
  }
  var VISUAL_CATS = ['FACE', 'EYES', 'SKIN', 'HAIR', 'CLOTHING', 'CINEMATIC'];

  function sectionOf(items, weightOf) {
    var applicable = items, rated = applicable.filter(function (i) { return i.score != null; }), pending = applicable.filter(function (i) { return i.score == null; });
    var tot = applicable.reduce(function (a, i) { return a + weightOf(i); }, 0), got = rated.reduce(function (a, i) { return a + weightOf(i) * i.score / 5; }, 0), ratedW = rated.reduce(function (a, i) { return a + weightOf(i); }, 0);
    var complete = pending.length === 0 && applicable.length > 0;
    return { value: complete ? Math.round(got / tot * 100) : null, partial: !complete && ratedW > 0 ? Math.round(got / ratedW * 100) : null, status: !applicable.length ? 'NOT APPLICABLE' : complete ? (rated.every(function (i) { return i.source === 'automated'; }) ? 'AUTOMATED' : 'COMPLETE') : 'HUMAN REVIEW REQUIRED',
      rated: rated.length, of: applicable.length, pending: pending.map(function (i) { return i.id; }), automated: rated.filter(function (i) { return i.source === 'automated'; }).map(function (i) { return i.id; }) };
  }

  function score(automated, ratings) {
    var auto = autoItems(automated), all = [];
    SC.categories.forEach(function (c) { c.items.forEach(function (it) { if (it[2].split(',').indexOf('1') >= 0) { var s = itemScore(it, automated, ratings, auto); s.cat = c.id; s.text = it[1]; s.weight = c.weight / c.items.filter(function (x) { return x[2].split(',').indexOf('1') >= 0; }).length; all.push(s); } }); });
    var by = function (cats, filter) { return all.filter(function (i) { return cats.indexOf(i.cat) >= 0 && (!filter || filter(i)); }); }, w = function (i) { return i.weight; };
    var val = by(VISUAL_CATS);
    var sections = {
      TECHNICAL: technicalSection(automated),
      VISUAL: sectionOf(val, w),
      PRESENCE: sectionOf(by(['PRESENCE']), w),
      SPEECH: speechSection(ratings),
      EXPRESSION: sectionOf(by(['EXPRESSION'], function (i) { return i.id !== 'X5'; }), w),
      IDENTITY: sectionOf(by(['IDENTITY']), w)
    };
    var scorecard = sectionOf(all, w);
    return { sections: sections, scorecard: { value: scorecard.value, partial: scorecard.partial, status: scorecard.status, rated: scorecard.rated, of: scorecard.of, pending: scorecard.pending },
      items: all, lowest: all.filter(function (i) { return i.score != null; }).sort(function (a, b) { return a.score - b.score; })[0] || null, autoItems: auto };
  }
  function technicalSection(auto) {
    var v = auto && auto.validator && auto.validator.result; if (!v) return { value: null, status: 'NOT RUN', gatesFailed: [] };
    return { value: v.technical.percent, status: 'AUTOMATED', gatesFailed: v.gates.filter(function (g) { return !g.ok; }).map(function (g) { return g.label; }), points: v.technical.points, max: v.technical.max };
  }
  function speechSection(ratings) {
    var r = (ratings && ratings.speech) || {}, vals = SPEECH_ITEMS.map(function (k) { return median(r[k]); }), rated = vals.filter(function (x) { return x != null; });
    var complete = rated.length === SPEECH_ITEMS.length, mean = rated.length ? rated.reduce(function (a, b) { return a + b; }, 0) / rated.length : null;
    return { value: complete ? Math.round(mean / 5 * 100) : null, partial: !complete && rated.length ? Math.round(mean / 5 * 100) : null, mean: complete ? +mean.toFixed(2) : null, status: complete ? 'COMPLETE' : 'HUMAN REVIEW REQUIRED', rated: rated.length, of: SPEECH_ITEMS.length,
      pending: SPEECH_ITEMS.filter(function (k, i) { return vals[i] == null; }) };
  }

  /* ================= hard rejection rules (HR-01 .. HR-14) ================= */
  var HR = [
    ['HR-01', 'Childlike appearance', 'human', 'B3'], ['HR-02', 'Generic face', 'human', 'B1'], ['HR-03', 'Looks like an avatar', 'human', 'B4'], ['HR-04', 'Dead eyes', 'human', 'B2'],
    ['HR-05', 'Artificial mouth', 'human', 'B11'], ['HR-06', 'Broken speech', 'auto+human', 'B11'], ['HR-07', 'Obviously artificial teeth', 'human', 'B11'],
    ['HR-08', 'Facial rig cannot reproduce the required expressions', 'auto', null], ['HR-09', 'Strong loss of identity when speaking', 'auto+human', 'B12'],
    ['HR-10', 'Eyes cannot be controlled', 'auto', null], ['HR-11', 'Jaw cannot be controlled', 'auto', null], ['HR-12', 'Required visemes cannot be executed', 'auto', null],
    ['HR-13', 'A real person is recognisable as the origin', 'human', 'B6'], ['HR-14', 'Technical failure incompatible with the Asset Brief', 'auto', null]
  ];
  function barriers(automated, ratings) {
    var a = automated || {}, v = a.validator && a.validator.result, rep = a.validator && a.validator.report, hb = (ratings && ratings.humanBarriers) || {}, L = CONFIG.limits;
    var sp = a.speech, mp = a.mapping, items = {}; (score(a, ratings).items || []).forEach(function (i) { items[i.id] = i.score; });
    var gate = function (id) { var g = v && v.gates.filter(function (x) { return x.id === id; })[0]; return g ? !g.ok : null; };
    var out = HR.map(function (h) { return { id: h[0], label: h[1], mode: h[2], scorecard: h[3], triggered: null, evidence: [], by: null }; });
    var B = function (id) { return out.filter(function (o) { return o.id === id; })[0]; };
    function set(id, trig, ev, by) { var b = B(id); if (trig) { b.triggered = true; b.by = by; b.evidence.push(ev); } else if (b.triggered == null && trig === false) { b.triggered = false; b.by = by; } }
    // human flags
    HR.forEach(function (h) { if (hb[h[0]] === true) set(h[0], true, 'reviewer marked this barrier', 'human'); else if (hb[h[0]] === false) set(h[0], false, '', 'human'); });
    // a reviewer who states that every hard rule was checked clears the ones nobody marked
    if (ratings && ratings.barriersReviewed === true) HR.forEach(function (h) { if (h[2].indexOf('human') >= 0 && hb[h[0]] == null) set(h[0], false, '', 'human'); });
    // automatic detection
    if (mp) { var bad = mp.notReproducible || []; set('HR-08', bad.length >= 3, bad.length + ' of 10 expressions are not reproducible with this rig: ' + bad.join(', '), 'auto'); if (bad.length < 3) set('HR-08', false, '', 'auto'); }
    if (v) {
      var gEyes = gate('eyes'); if (gEyes != null) set('HR-10', gEyes, 'no usable eye control (eye bones or eyeLook morphs)', 'auto');
      var gJaw = gate('jaw'); if (gJaw != null) set('HR-11', gJaw, 'no jawOpen morph and no Jaw bone', 'auto');
      var gVis = gate('visemes'), miss = mp ? mp.visemes.missing : []; set('HR-12', !!gVis || miss.length > 0, (gVis ? 'fewer than 13 native visemes. ' : '') + (miss.length ? 'missing for the standard sentence: ' + miss.join(', ') : ''), 'auto'); if (!gVis && !miss.length) set('HR-12', false, '', 'auto');
      var failed = v.gates.filter(function (g) { return !g.ok && ['eyes', 'jaw', 'visemes', 'rig_grade'].indexOf(g.id) < 0; }).map(function (g) { return g.label; });
      var parts = rep ? [[rep.mouth.teeth, 'teeth mesh'], [rep.mouth.tongue, 'tongue mesh'], [rep.eyes.eyeMeshes >= 2, 'two eye meshes'], [rep.hair.meshes, 'hair mesh (basic hair is required in Phase 1)']].filter(function (p) { return !p[0]; }).map(function (p) { return 'missing ' + p[1]; }) : [];
      var rig = v.gates.filter(function (g) { return g.id === 'rig_grade' && !g.ok; }).length ? ['rig grade below good'] : [];
      var ev = failed.concat(parts, rig); set('HR-14', ev.length > 0, ev.join('; '), 'auto'); if (!ev.length) set('HR-14', false, '', 'auto');
    }
    if (sp && sp.metrics) {
      var f = sp.flags || []; var broken = f.filter(function (x) { return /^(popping|no mouth|jerk|frozen)/.test(x); });
      set('HR-06', broken.length > 0, broken.join('; '), 'auto'); if (!broken.length && B('HR-06').triggered == null) set('HR-06', false, '', 'auto');
      var drift = sp.metrics.peakDisplacement > L.exploding; set('HR-09', drift, 'face deforms beyond ' + L.exploding + ' of head height while speaking (' + sp.metrics.peakDisplacement.toFixed(3) + ')', 'auto'); if (!drift && B('HR-09').triggered == null) set('HR-09', false, '', 'auto');
    }
    // evidence from human scores (a barrier a reviewer has not marked, but whose underlying item is at 1 or less)
    var ev1 = function (id, ids) { var low = ids.filter(function (i) { return items[i] != null && items[i] <= 1; }); if (low.length) set(id, true, 'scored 1 or less: ' + low.join(', '), 'human'); };
    ev1('HR-04', ['E2', 'E4']); ev1('HR-05', ['X5', 'F5']); ev1('HR-09', ['I2']); ev1('HR-02', ['I4']);
    var sc = (ratings && ratings.speech) || {}; if (median(sc.teeth) != null && median(sc.teeth) <= 1) set('HR-07', true, 'speech checklist: teeth scored ' + median(sc.teeth), 'human');
    if (median(sc.sync) != null && median(sc.sync) <= 1) set('HR-06', true, 'speech checklist: synchronisation scored ' + median(sc.sync), 'human');
    if (median(sc.naturalness) != null && median(sc.naturalness) <= 1) set('HR-05', true, 'speech checklist: mouth naturalness scored ' + median(sc.naturalness), 'human');
    ['human', 'noavatar'].forEach(function (k) { if (median(sc[k]) != null && median(sc[k]) <= 1) set('HR-03', true, 'speech checklist: ' + k + ' scored ' + median(sc[k]), 'human'); });
    if (ratings && ratings.likeness && ratings.likeness.names >= 2) set('HR-13', true, ratings.likeness.names + ' of ' + ratings.likeness.of + ' viewers named the same real person', 'human');
    if (ratings && ratings.blind && ratings.blind.picked / ratings.blind.of < 0.8) set('HR-02', true, 'only ' + Math.round(ratings.blind.picked / ratings.blind.of * 100) + '% picked her over generic avatars (needs 80%)', 'human');
    if (items.F4 != null && items.F4 <= 1) set('HR-03', true, 'F4 (asymmetry) scored 1 or less: doll-like', 'human');
    var pv = (ratings && ratings.presenceVotes) || {}; CONFIG.presence.questions.forEach(function (q) { var x = pv[q.id]; if (x && x.yes + x.no && x.yes / (x.yes + x.no) < CONFIG.pass.presenceYes) { var b = B('HR-03'); b.evidence.push('presence question ' + q.id + ' below ' + CONFIG.pass.presenceYes * 100 + '% yes (' + Math.round(x.yes / (x.yes + x.no) * 100) + '%)'); } });
    return out;
  }

  /* The technical facts of a candidate, collected from the existing validator report (nothing is measured twice). */
  function metrics(review) {
    var v = review && review.validator && review.validator.report; if (!v) return null; var f = review.file || {};
    return { triangles: v.geometry.tris, fileBytes: f.bytes, fileMB: v.delivery.fileMB, meshes: v.geometry.meshes.length, materials: v.materials.count, textures: v.materials.textures, textureMB: v.materials.textureMB, maxTexture: v.materials.maxTexture,
      morphTargets: (f.morphNames || []).length, morphNames: f.morphNames || [], arkit: { found: v.blendshapes.arkitFound, of: 52, coverage: v.blendshapes.coverage, missing: v.blendshapes.missing }, visemes: { found: v.visemes.found, of: 15, native: v.visemes.native, missing: v.visemes.missing },
      eyeBones: v.eyes.bones, eyeMode: v.eyes.mode, eyeLookMorphs: v.eyes.lookMorphs, jaw: { mode: v.mouth.jawMode, morph: v.mouth.jawMorph }, bones: v.animation.bones, missingBones: v.animation.headBonesMissing, clips: v.animation.clips.map(function (c) { return c.name + ' ' + c.duration + 's'; }),
      compression: { meshopt: v.delivery.meshopt, draco: v.delivery.draco, quantized: v.delivery.quantized }, ktx2: v.delivery.ktx2, extensions: v.delivery.extensions, loadMs: v.delivery.loadMs, grade: v.rig.grade };
  }

  /* ================= decision ================= */
  function recommend(automated, ratings) {
    var sc = score(automated, ratings), bs = barriers(automated, ratings), S = sc.sections, P = CONFIG.pass, why = [], todo = [];
    var hit = bs.filter(function (b) { return b.triggered === true; });
    if (!automated || !automated.validator) { return { recommendation: 'UNDER_REVIEW', why: ['The automated review has not run.'], todo: ['Run validate-head'], scores: sc, barriers: bs, auto: false }; }
    var techFail = S.TECHNICAL.gatesFailed || [];
    if (hit.length) { hit.forEach(function (b) { why.push(b.id + ' ' + b.label + (b.evidence.length ? ': ' + b.evidence.join('; ') : '')); }); return { recommendation: 'REJECTED', why: why, todo: [], scores: sc, barriers: bs, auto: hit.every(function (b) { return b.by === 'auto'; }) }; }
    if (techFail.length) { return { recommendation: 'REJECTED', why: techFail.map(function (g) { return 'Technical gate failed: ' + g; }), todo: [], scores: sc, barriers: bs, auto: true }; }
    var humanSections = ['VISUAL', 'PRESENCE', 'SPEECH', 'EXPRESSION', 'IDENTITY'].filter(function (k) { return S[k].value == null; });
    var unknownBarriers = bs.filter(function (b) { return b.triggered == null && b.mode.indexOf('human') >= 0; });
    if (humanSections.length || unknownBarriers.length) {
      humanSections.forEach(function (k) { todo.push('HUMAN REVIEW REQUIRED: ' + k + ' (' + (S[k].pending || []).join(', ') + ')'); });
      if (unknownBarriers.length) todo.push('HUMAN REVIEW REQUIRED: confirm barriers ' + unknownBarriers.map(function (b) { return b.id; }).join(', ') + ' (yes or no)');
      return { recommendation: 'UNDER_REVIEW', why: ['No automatic barrier and no technical gate failed; the human review is not finished.'], todo: todo, scores: sc, barriers: bs, auto: false };
    }
    var total = sc.scorecard.value, low = sc.lowest ? sc.lowest.score : 5, sp = S.SPEECH.mean, pres = CONFIG.presence.questions.every(function (q) { var x = ratings.presenceVotes[q.id]; return x && x.yes / (x.yes + x.no) >= P.presenceYes; });
    var idOk = sc.items.filter(function (i) { return i.cat === 'IDENTITY'; }).every(function (i) { return i.score >= 4; }), techOk = S.TECHNICAL.value >= 85;
    if (sp < P.speechReject) { return { recommendation: 'REJECTED', why: ['SPEECH ' + S.SPEECH.value + '% (mean ' + sp + '/5) is below the rejection line of ' + P.speechReject + '/5. A head that is good still and bad speaking is not accepted.'], todo: [], scores: sc, barriers: bs, auto: false }; }
    var fronts = [['visual quality (scorecard >= ' + P.total + ', no item < ' + P.itemMin + ')', total >= P.total && low >= P.itemMin], ['speech (mean >= ' + P.speech + ')', sp >= P.speech], ['executive presence (3 questions >= ' + P.presenceYes * 100 + '% yes)', pres],
      ['character identity (I1 to I4 >= 4)', idOk], ['technical (>= 85% of automatic points)', techOk]];
    var fail = fronts.filter(function (f) { return !f[1]; }).map(function (f) { return f[0]; });
    if (!fail.length) return { recommendation: 'PASS', why: ['All fronts pass: scorecard ' + total + '/100, speech ' + S.SPEECH.value + '%, presence, identity and technical (' + S.TECHNICAL.value + '%).'], todo: [], scores: sc, barriers: bs, auto: false };
    var cond = total >= P.conditional && low >= P.itemMinConditional && sp >= 3.5;
    fail.forEach(function (k) { why.push('Does not pass: ' + k); });
    return { recommendation: cond ? 'CONDITIONAL' : 'REJECTED', why: why.concat(cond ? ['Within reach: return to the vendor with the fix list (max two rounds).'] : ['Below the conditional line (scorecard >= ' + P.conditional + ', no item < ' + P.itemMinConditional + ', speech >= 3.5).']), todo: [], scores: sc, barriers: bs, auto: false };
  }
  /* The human signs the decision. PASS and CONDITIONAL only when the recommendation says so; REJECTED may be a human override. */
  function decide(c, decision, by, reason) {
    if (['PASS', 'CONDITIONAL', 'REJECTED'].indexOf(decision) < 0) throw err('BAD_DECISION', 'decision must be PASS, CONDITIONAL or REJECTED');
    if (!by) throw err('NO_SIGNATURE', 'A decision needs the name of the person who signs it (--by)');
    if (!c.review) throw err('NO_REVIEW', c.id + ' has no review');
    var rec = recommend(c.review.automated, c.review.ratings);
    if (decision !== 'REJECTED' && rec.recommendation !== decision) throw err('DECISION_NOT_SUPPORTED', 'The review recommends ' + rec.recommendation + ', so ' + decision + ' cannot be signed. ' + (rec.todo.concat(rec.why)).join(' '));
    var n = transition(c, decision, { by: by, event: 'decision' }); n.decision = { decision: decision, by: by, date: today(), reason: reason || '', recommendation: rec.recommendation, why: rec.why, configHash: configHash(), scores: { sections: Object.keys(rec.scores.sections).reduce(function (o, k) { o[k] = rec.scores.sections[k].value; return o; }, {}), total: rec.scores.scorecard.value } }; return n;
  }

  /* ================= comparison, with WHY ================= */
  var RANK_ORDER = ['SPEECH', 'PRESENCE', 'IDENTITY', 'EXPRESSION', 'VISUAL', 'TECHNICAL'];
  function compare(cands) {
    var rows = cands.map(function (c) {
      var r = c.review ? recommend(c.review.automated, c.review.ratings) : null, S = r ? r.scores.sections : null;
      return { id: c.id, name: c.name, version: c.version, state: c.state, recommendation: r ? r.recommendation : c.state, sections: S ? RANK_ORDER.concat([]).reduce(function (o, k) { o[k] = S[k].value; return o; }, {}) : {}, total: r ? r.scores.scorecard.value : null,
        barriers: r ? r.barriers.filter(function (b) { return b.triggered === true; }).map(function (b) { return b.id; }) : [], pending: r ? r.todo : ['no review'], why: r ? r.why : [] };
    });
    var eligible = rows.filter(function (r) { return !r.barriers.length && r.recommendation !== 'REJECTED' && RANK_ORDER.every(function (k) { return r.sections[k] != null; }); });
    eligible.sort(function (a, b) { for (var i = 0; i < RANK_ORDER.length; i++) { var k = RANK_ORDER[i], d = b.sections[k] - a.sections[k]; if (Math.abs(d) >= 3) return d; } return (b.total || 0) - (a.total || 0); });
    var notRanked = rows.filter(function (r) { return eligible.indexOf(r) < 0; }).map(function (r) { return { id: r.id, reason: r.barriers.length ? 'barriers ' + r.barriers.join(', ') : r.recommendation === 'REJECTED' ? 'rejected' : 'human review incomplete: ' + r.pending.join(' | ') }; });
    var why = [];
    for (var i = 0; i + 1 < eligible.length; i++) {
      var a = eligible[i], b = eligible[i + 1], k = RANK_ORDER.filter(function (x) { return Math.abs(a.sections[x] - b.sections[x]) >= 3; })[0];
      why.push(k ? a.id + ' ranks above ' + b.id + ' because of ' + k + ' (' + a.sections[k] + '% vs ' + b.sections[k] + '%); the order of importance is ' + RANK_ORDER.join(' > ') + '.' : a.id + ' and ' + b.id + ' are within 3 points on every section; ' + a.id + ' has the higher scorecard total (' + a.total + ' vs ' + b.total + ').');
    }
    if (eligible.length === 1 && notRanked.length) why.push(eligible[0].id + ' is the only candidate that is complete and free of barriers.');
    if (!eligible.length) why.push('No candidate can be ranked: ' + (notRanked.map(function (n) { return n.id + ': ' + n.reason; }).join('; ') || 'no candidates') + '.');
    return { rows: rows, ranking: eligible.map(function (r) { return r.id; }), winner: eligible.length ? eligible[0].id : null, notRanked: notRanked, why: why, order: RANK_ORDER };
  }

  WA.HeadGate = { CONFIG: CONFIG, configHash: configHash, stable: stable, hash: hash, STATES: STATES, TRANSITIONS: TRANSITIONS, ID_RE: ID_RE, canTransition: canTransition, createCandidate: createCandidate, registerAsset: registerAsset, transition: transition,
    attachReview: attachReview, metrics: metrics, attachRatings: attachRatings, mergeRatings: mergeRatings, REVIEW_EXPRESSIONS: REVIEW_EXPRESSIONS, requiredChannels: requiredChannels, mappingReport: mappingReport,
    score: score, barriers: barriers, HR: HR, recommend: recommend, decide: decide, compare: compare, SPEECH_ITEMS: SPEECH_ITEMS, SPEECH_LABELS: SPEECH_LABELS, median: median, yesToScore: yesToScore, autoItems: autoItems };
})(typeof window !== 'undefined' ? window : globalThis);
