// =====================================================================
// App.events — シンプルな pub/sub
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const map = new Map();   // name -> Set<fn>

  function on(name, fn) {
    if (typeof fn !== 'function') return () => {};
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const set = map.get(name);
    if (set) set.delete(fn);
  }

  function once(name, fn) {
    const wrap = (payload) => { off(name, wrap); fn(payload); };
    return on(name, wrap);
  }

  function emit(name, payload) {
    const set = map.get(name);
    if (!set || !set.size) return;
    // 途中で off されても安全なようにコピーして回す
    for (const fn of Array.from(set)) {
      try {
        fn(payload === undefined ? {} : payload);
      } catch (e) {
        console.error('[events] "' + name + '" のハンドラで例外:', e);
      }
    }
  }

  App.events = { on, off, once, emit };
})();
