/*
 * loadAvatar: picks and builds a model from a description.
 *
 *   loadAvatar({ source: 'glb', url: 'wendy.glb', rigMap: {...} })      a rigged GLB
 *   loadAvatar({ source: 'glb', data: arrayBuffer })                      a GLB already in memory
 *   loadAvatar({ source: 'procedural' })                                  the built-in fallback
 *   loadAvatar({ source: 'auto', url: 'wendy.glb' })                      GLB if it loads, procedural if not
 *   loadAvatar('wendy.glb')                                               same as auto with a url
 *
 * It resolves { model, source, fallback, error } and never rejects in 'auto' mode (or with fallback: true):
 * an unusable asset gives the procedural model and the reason in `error`, so the product keeps working.
 * With source 'glb' and fallback false it rejects with the typed AvatarError instead.
 * New model types register with registerModel(name, factory).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;
  var registry = {
    procedural: function () { return new WA.ProceduralAvatar(); },
    glb: function (spec) { return new WA.GLBAvatar(spec); }
  };

  function rigMapFrom(r) {
    if (!r) return WA.RigMap.create();
    if (r.morphs && r.options && r.bones) return r;                              // already a complete RigMap
    if (typeof r === 'string') return WA.RigMap.create({}, r);
    var preset = r.preset; var o = {}; for (var k in r) if (k !== 'preset') o[k] = r[k];
    return WA.RigMap.create(o, preset);
  }

  WA.registerModel = function (name, factory) { if (typeof factory !== 'function') throw WA.AvatarError('BAD_FACTORY', 'registerModel needs a factory function'); registry[name] = factory; };
  WA.modelTypes = function () { return Object.keys(registry); };

  WA.loadAvatar = function (spec) {
    if (typeof spec === 'string') spec = { source: 'auto', url: spec };
    spec = spec || { source: 'procedural' };
    var source = spec.source || (spec.url || spec.data || spec.file ? 'auto' : 'procedural');
    var fallback = spec.fallback != null ? !!spec.fallback : source === 'auto';

    function proc(reason) {
      var m = registry.procedural(spec);
      return { model: m, source: 'procedural', fallback: !!reason, error: reason || null };
    }
    if (source === 'procedural') return Promise.resolve(proc(null));
    var factory = registry[source === 'auto' ? 'glb' : source];
    if (!factory) { var e = WA.AvatarError('UNKNOWN_SOURCE', 'Unknown avatar source "' + source + '". Known: ' + Object.keys(registry).join(', ')); return fallback ? Promise.resolve(proc(e)) : Promise.reject(e); }
    if (source === 'auto' && !(spec.url || spec.data || spec.file)) return Promise.resolve(proc(null));

    var model;
    try { var s2 = {}; for (var k in spec) s2[k] = spec[k]; s2.rigMap = rigMapFrom(spec.rigMap); model = factory(s2); }
    catch (err) { var ae = err && err.code ? err : WA.AvatarError('MODEL_INIT_FAILED', 'Could not create the model: ' + err.message, err); return fallback ? Promise.resolve(proc(ae)) : Promise.reject(ae); }

    return model.load().then(function () {
      var rep = model.getRigReport && model.getRigReport();
      if (rep && rep.grade === 'insufficient' && spec.requireUsableRig !== false && fallback) {
        var why = WA.AvatarError('RIG_INSUFFICIENT', 'The model loaded but its rig lacks essential channels (' + rep.essentialMissing.join(', ') + '). Check the RigMap.');
        try { model.dispose(); } catch (x) {}
        return proc(why);
      }
      return { model: model, source: source === 'auto' ? 'glb' : source, fallback: false, error: null };
    }, function (err) {
      try { model.dispose(); } catch (x) {}
      var ae = err && err.code ? err : WA.AvatarError('LOAD_FAILED', 'Loading failed: ' + (err && err.message), err);
      if (fallback) return proc(ae);
      throw ae;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
