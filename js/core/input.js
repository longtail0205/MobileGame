// =====================================================================
// App.input — キーボード / 画面パッド入力
//   ハンドラはスタック式。最上位のハンドラだけが onPress を受け取る。
//   ぼうけんタブ表示中のみ有効（main.js が setActive で制御）。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  // KeyboardEvent.code → action
  const CODE_MAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', Enter: 'a', NumpadEnter: 'a', Space: 'a',
    KeyX: 'b', Escape: 'b', Backspace: 'b',
    KeyC: 'start',
  };
  // code が取れない環境向け（KeyboardEvent.key）
  const KEY_MAP = {
    arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
    z: 'a', enter: 'a', ' ': 'a', x: 'b', escape: 'b', backspace: 'b', c: 'start',
  };
  const DIRS = ['up', 'down', 'left', 'right'];
  const PAD_REPEAT_DELAY = 360;
  const PAD_REPEAT_INTERVAL = 110;

  let active = false;
  let inited = false;
  const stack = [];
  const down = {};          // action -> Set(source)
  const dirOrder = [];      // 押された順の方向
  const padTimers = {};     // source -> timer

  function actionOf(e) {
    return CODE_MAP[e.code] || KEY_MAP[String(e.key || '').toLowerCase()] || null;
  }

  function blocked() {
    return !!(App.ui && typeof App.ui.isModalOpen === 'function' && App.ui.isModalOpen());
  }

  function top() { return stack.length ? stack[stack.length - 1] : null; }

  function dispatchPress(action, info) {
    const h = top();
    if (h && typeof h.onPress === 'function') {
      try { h.onPress(action, info); } catch (e) { console.error('[input] onPress で例外', e); }
    }
  }
  function dispatchRelease(action) {
    const h = top();
    if (h && typeof h.onRelease === 'function') {
      try { h.onRelease(action); } catch (e) { console.error('[input] onRelease で例外', e); }
    }
  }

  function press(action, source, repeat) {
    const set = down[action] || (down[action] = new Set());
    set.add(source);
    if (DIRS.includes(action) && !repeat) {
      const i = dirOrder.indexOf(action);
      if (i >= 0) dirOrder.splice(i, 1);
      dirOrder.push(action);
    }
    dispatchPress(action, { repeat: !!repeat, source: source.charAt(0) === 'k' ? 'key' : 'pad' });
  }

  function release(action, source) {
    const set = down[action];
    if (!set || !set.has(source)) return;
    set.delete(source);
    if (set.size) return;
    const i = dirOrder.indexOf(action);
    if (i >= 0) dirOrder.splice(i, 1);
    dispatchRelease(action);
  }

  function releaseAll() {
    for (const src of Object.keys(padTimers)) stopRepeat(src);
    for (const action of Object.keys(down)) {
      for (const src of Array.from(down[action])) release(action, src);
    }
    document.querySelectorAll('#pad .is-pressed').forEach((b) => b.classList.remove('is-pressed'));
  }

  function onKeyDown(e) {
    if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
    if (App.util.isTypingTarget(e.target) || blocked()) return;
    const action = actionOf(e);
    if (!action) return;
    e.preventDefault();
    press(action, 'k:' + (e.code || e.key), e.repeat);
  }

  function onKeyUp(e) {
    const action = actionOf(e);
    if (action) release(action, 'k:' + (e.code || e.key));
  }

  function startRepeat(src, action) {
    stopRepeat(src);
    padTimers[src] = setTimeout(function tick() {
      if (!down[action] || !down[action].has(src)) return;
      if (active && !blocked()) dispatchPress(action, { repeat: true, source: 'pad' });
      padTimers[src] = setTimeout(tick, PAD_REPEAT_INTERVAL);
    }, PAD_REPEAT_DELAY);
  }
  function stopRepeat(src) {
    clearTimeout(padTimers[src]);
    delete padTimers[src];
  }

  function bindPad() {
    const pad = document.getElementById('pad');
    if (!pad) return;
    pad.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !pad.contains(btn)) return;
      e.preventDefault();
      if (!active || blocked()) return;
      const action = btn.dataset.action;
      const src = 'p:' + e.pointerId + ':' + action;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
      btn.classList.add('is-pressed');
      const end = () => {
        btn.classList.remove('is-pressed');
        btn.removeEventListener('pointerup', end);
        btn.removeEventListener('pointercancel', end);
        btn.removeEventListener('lostpointercapture', end);
        stopRepeat(src);
        release(action, src);
      };
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', end);
      btn.addEventListener('lostpointercapture', end);
      press(action, src, false);
      if (DIRS.includes(action)) startRepeat(src, action);
    });
    // element.click() 等の合成クリック（detail=0）はタップとして扱う
    pad.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || e.detail !== 0 || !active || blocked()) return;
      const action = btn.dataset.action;
      const src = 'c:' + action;
      press(action, src, false);
      release(action, src);
    });
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function init() {
    if (inited) return;
    inited = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    bindPad();
  }

  function setActive(v) {
    const next = !!v;
    if (active === next) return;
    active = next;
    if (!active) releaseAll();
  }

  function push(handler) {
    stack.push(handler);
    return () => pop(handler);
  }

  function pop(handler) {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  }

  function isDown(action) { return !!(down[action] && down[action].size); }
  function heldDir() { return dirOrder.length ? dirOrder[dirOrder.length - 1] : null; }

  App.input = {
    init, setActive, push, pop, isDown, heldDir,
    // 追加
    isActive() { return active; },
    releaseAll,
    depth() { return stack.length; },
  };
})();
