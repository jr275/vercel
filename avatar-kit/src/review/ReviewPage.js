/*
 * ReviewPage: a self-contained HTML page for a human to review one candidate: the standard stills, the speech stills, the presence frames,
 * the measured evidence, and a rating form that produces the ratings JSON the Head Gate reads (`head-gate rate`).
 * Pure string building: no DOM needed to produce it, no kit needed to open it. Images are referenced by path or data URL (imageFor).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, HG = WA.HeadGate, SC = WA.ScorecardData;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var DERIVED = { X2: 1, X3: 1, X4: 1, X6: 1, X5: 1, F5: 1, P1: 1, P2: 1, P3: 1, I1: 1, I3: 1, I4: 1 };      // measured or derived from the structured inputs below

  /* items a person must score in Phase 1 */
  function humanItems() {
    var out = []; SC.categories.forEach(function (c) { c.items.forEach(function (it) { if (it[2].split(',').indexOf('1') >= 0 && !DERIVED[it[0]]) out.push({ id: it[0], cat: c.id, text: it[1] }); }); }); return out;
  }

  function page(cand, review, imageFor) {
    var CFG = HG.CONFIG, H = humanItems(), sp = review.speech, pr = review.presence;
    function fig(kind, id, label, extra) { var src = imageFor(kind, id); return src ? '<figure><img src="' + esc(src) + '" alt="' + esc(label) + '"><figcaption>' + esc(label) + (extra ? ' <small>' + esc(extra) + '</small>' : '') + '</figcaption></figure>' : ''; }
    var shots = review.shots.map(function (s) { return fig('shot', s.id, s.id); }).join(''), speech = sp.stills.map(function (s) { return fig('speech', s.id, s.id, 't=' + s.t + 's'); }).join(''),
      frames = pr.frames.map(function (f) { return fig('presence', 't' + f.t, 't=' + f.t + 's', f.cue); }).join(''), exprs = review.expression.rows.map(function (r) { return fig('expression', r.id, r.id, 'max ' + r.max); }).join('');
    var rows = H.map(function (i) { return '<label class="it"><span><b>' + i.id + '</b> <em>' + i.cat + '</em> ' + esc(i.text) + '</span><input type="range" min="0" max="5" step="0.5" value="0" data-item="' + i.id + '" data-rated="0"><output>–</output></label>'; }).join('');
    var spr = HG.SPEECH_ITEMS.map(function (k) { return '<label class="it"><span>' + esc(HG.SPEECH_LABELS[k]) + '</span><input type="range" min="0" max="5" step="0.5" value="0" data-speech="' + k + '" data-rated="0"><output>–</output></label>'; }).join('');
    var q = CFG.presence.questions.map(function (x) { return '<div class="it"><span><b>' + x.id + '.</b> ' + esc(x.text) + '</span><span>yes <input type="number" min="0" value="0" data-vote="' + x.id + '" data-k="yes"> no <input type="number" min="0" value="0" data-vote="' + x.id + '" data-k="no"></span></div>'; }).join('');
    var hb = HG.HR.map(function (h) { return '<label class="it"><span><b>' + h[0] + '</b> ' + esc(h[1]) + ' <em>(' + h[2] + ')</em></span><select data-hb="' + h[0] + '"><option value="">not assessed</option><option value="false">no</option><option value="true">YES: reject</option></select></label>'; }).join('');
    return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Head review ' + esc(cand.id) + ' v' + cand.version + '</title><style>' +
      ':root{color-scheme:dark;--bg:#0d0e12;--ink:#efecf1;--mut:#9a95a3;--line:#2a2b33;--acc:#cfc8be;--bad:#ef7d7d}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif;padding:16px 18px 60px}main{max-width:1280px;margin:auto;display:grid;gap:22px}' +
      'h1{font-size:22px;margin:0}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin:0 0 8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%;display:block;border:1px solid var(--line);border-radius:6px;background:#000}figcaption{font:11px ui-monospace,monospace;color:var(--mut);padding-top:3px}' +
      '.it{display:grid;grid-template-columns:minmax(0,1fr) 210px 34px;gap:10px;align-items:center;border-bottom:1px solid #1d1e25;padding:5px 0;font-size:13px}.it em{color:var(--mut);font-style:normal;font-size:11px}input,select,textarea{background:#17181e;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit}input[type=number]{width:60px}' +
      'textarea{width:100%;min-height:150px;font:11.5px ui-monospace,monospace}button{background:#1f2027;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:7px 16px;font:inherit;cursor:pointer}.note{color:var(--mut)}.flag{color:var(--bad)}@media(max-width:640px){.it{grid-template-columns:1fr}}</style>' +
      '<main><h1>Head review: ' + esc(cand.id) + ' (' + esc(cand.name) + ') v' + cand.version + '</h1><p class="note">Vendor: ' + esc(cand.vendor || '-') + ' · asset ' + esc(cand.asset.sha256.slice(0, 12)) + ' · review configuration ' + esc(review.configHash) + ' · all stills use the same camera, lens, lighting, background, resolution (' + CFG.canvas.width + 'x' + CFG.canvas.height + ') and exposure.</p>' +
      (review.software ? '<p class="flag">Rendered by a software renderer (' + esc(review.renderer.renderer) + '): FPS is not valid; the stills are valid.</p>' : '') +
      '<section><h2>1. Standard shots</h2><div class="grid">' + shots + '</div></section><section><h2>2. 1.5 second presence test</h2><p class="note">Cues: ' + pr.cues.map(function (c) { return c.t + 's ' + esc(c.what); }).join(' · ') + '. Watch the six frames, then answer A, B and C in the form (yes/no per reviewer).</p><div class="grid">' + frames + '</div></section>' +
      '<section><h2>3. Speech: "' + esc(sp.script.text) + '"</h2><p class="note">' + sp.script.seconds + ' s, ' + sp.script.syllables + ' syllables. ' + (sp.flags.length ? '<span class="flag">Automatic flags: ' + sp.flags.map(esc).join(' | ') + '</span>' : 'No automatic flag.') + ' A good still is not enough: a head that is good still and bad speaking is rejected.</p><div class="grid">' + speech + '</div></section>' +
      '<section><h2>4. The ten review expressions</h2><div class="grid">' + exprs + '</div></section>' +
      '<section><h2>5. Ratings (0 to 5; 3 is generic, not good)</h2><div id="who"><label>Reviewer name <input id="rev" placeholder="your name"></label></div><h2 style="margin-top:14px">Scorecard items</h2>' + rows + '<h2 style="margin-top:14px">Speech checklist (12)</h2>' + spr + '<h2 style="margin-top:14px">Presence votes (1.5 s test)</h2>' + q +
      '<h2 style="margin-top:14px">Identity tests</h2><div class="it"><span>Likeness test: viewers who named the same real person</span><span><input type="number" id="ln" min="0" value="0"> of <input type="number" id="lo" min="1" value="10"></span></div><div class="it"><span>Blind comparison: viewers who picked her as the premium character</span><span><input type="number" id="bp" min="0" value="0"> of <input type="number" id="bo" min="1" value="10"></span></div><div class="it"><span>Visual DNA: traits present (of 10)</span><span><input type="number" id="dna" min="0" max="10" value="0"></span></div>' +
      '<h2 style="margin-top:14px">Hard rejection rules</h2>' + hb + '<label class="it"><span><b>I checked every hard rule above</b>: none applies except those marked YES</span><input type="checkbox" id="brv"></label><p><button id="mk">Generate ratings JSON</button> <button id="cp">Copy</button></p><textarea id="out" readonly placeholder="Press Generate. Then: node tools/head-gate.js rate ' + esc(cand.id) + ' --file ratings.json"></textarea></section></main>' +
      '<script>(function(){var $=function(s){return document.querySelector(s)};document.querySelectorAll("input[type=range]").forEach(function(r){r.addEventListener("input",function(){r.dataset.rated="1";r.nextElementSibling.textContent=r.value})});' +
      '$("#mk").onclick=function(){var o={reviewers:[$("#rev").value||"reviewer"],items:{},speech:{},presenceVotes:{},humanBarriers:{},likeness:{names:+$("#ln").value,of:+$("#lo").value},blind:{picked:+$("#bp").value,of:+$("#bo").value},dnaTraits:+$("#dna").value,barriersReviewed:$("#brv").checked};' +
      'document.querySelectorAll("[data-item]").forEach(function(r){if(r.dataset.rated==="1")o.items[r.dataset.item]=+r.value});document.querySelectorAll("[data-speech]").forEach(function(r){if(r.dataset.rated==="1")o.speech[r.dataset.speech]=+r.value});' +
      'document.querySelectorAll("[data-vote]").forEach(function(i){var q=i.dataset.vote;o.presenceVotes[q]=o.presenceVotes[q]||{yes:0,no:0};o.presenceVotes[q][i.dataset.k]=+i.value});document.querySelectorAll("[data-hb]").forEach(function(s){if(s.value!=="")o.humanBarriers[s.dataset.hb]=s.value==="true"});' +
      'if(!+$("#bo").value||!+$("#bp").value&&!+$("#bo").value)delete o.blind;$("#out").value=JSON.stringify(o,null,1)};$("#cp").onclick=function(){var t=$("#out");t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand("copy")}}})();</script>';
  }

  WA.ReviewPage = { page: page, humanItems: humanItems, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
