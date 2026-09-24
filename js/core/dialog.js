// =====================================================================
// App.dialog — #screen 内のメッセージウィンドウ（GBA風）
//   say / ask は呼び出し順に1つずつ実行される（キュー）。
//   表示中は App.input にハンドラを積み、A/B/上下キーを受け取る。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const LINES_PER_PAGE = 2;
  const FALLBACK_TEXT_W = 624;          // 非表示で測れないときの本文幅（720座標系）
  const CLOSE_DELAY = 24;               // 連続した say の間でウィンドウがちらつかないよう少し待って閉じる
  const NO_HEAD = '、。，．！？!?,.」』）)ーぁぃぅぇぉっゃゅょァィゥェォッャュョ…';

  let inited = false;
  let layer = null;
  let box = null;
  let textEl = null;
  let arrowEl = null;
  let choicesEl = null;
  let measureCtx = null;

  let queue = Promise.resolve();
  let generation = 0;
  let active = 0;
  let listener = null;        // (action) => void 現在の待機に対する入力
  let cancelCurrent = null;   // 現在の待機を打ち切る
  let popInput = null;
  let closeTimer = null;

  const sfx = (name) => { try { if (App.audio && App.audio.play) App.audio.play(name); } catch (e) { /* 無視 */ } };

  const inputHandler = {
    onPress(action, info) {
      if (!listener) return;
      if ((action === 'a' || action === 'b') && info && info.repeat) return;
      listener(action, info || {});
    },
  };

  function init() {
    if (inited) return;
    inited = true;
    const el = App.util.el;
    layer = document.getElementById('dialog-layer');
    if (!layer) {
      layer = el('div', { id: 'dialog-layer' });
      (document.getElementById('screen') || document.body).appendChild(layer);
    }
    textEl = el('div', { class: 'dlg-text' });
    arrowEl = el('div', { class: 'dlg-arrow', hidden: true });
    box = el('div', { class: 'dlg-box dlg-field', hidden: true }, textEl, arrowEl);
    choicesEl = el('div', { class: 'dlg-choices dlg-field', hidden: true, role: 'listbox' });
    layer.appendChild(box);
    layer.appendChild(choicesEl);
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (listener) listener('a', { click: true });
    });
  }

  function acquireInput() {
    if (!popInput && App.input && App.input.push) popInput = App.input.push(inputHandler);
  }
  function releaseInput() {
    if (popInput) { popInput(); popInput = null; }
  }

  function openBox(style, opts) {
    clearTimeout(closeTimer);
    closeTimer = null;
    const s = style === 'battle' ? 'battle' : 'field';
    box.className = 'dlg-box dlg-' + s;
    choicesEl.className = 'dlg-choices dlg-' + s;
    box.style.width = opts && opts.width ? opts.width + 'px' : '';
    box.hidden = false;
  }

  function hideAll() {
    clearTimeout(closeTimer);
    closeTimer = null;
    if (!box) return;
    box.hidden = true;
    choicesEl.hidden = true;
    arrowEl.hidden = true;
    textEl.textContent = '';
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hideAll, CLOSE_DELAY);
  }

  function speedOf(opts) {
    if (opts && typeof opts.speed === 'number') return opts.speed;
    const table = (App.data && App.data.config && App.data.config.textSpeed) || { normal: 30 };
    const key = App.state && App.state.data ? App.state.setting('textSpeed') : 'normal';
    const v = table[key];
    return typeof v === 'number' ? v : (table.normal || 30);
  }

  // ---------------------------------------------------------------- 折り返し
  function textWidthLimit() {
    const cs = getComputedStyle(textEl);
    const w = textEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return w > 40 ? w : FALLBACK_TEXT_W;
  }

  function measurer() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(textEl);
    const font = cs.font || (cs.fontSize + ' ' + cs.fontFamily);
    measureCtx.font = font && font.trim() ? font : "32px 'DotGothic16', monospace";
    return (s) => measureCtx.measureText(s).width;
  }

  function wrapLine(src, maxW, measure) {
    const out = [];
    let line = '';
    for (const ch of Array.from(src)) {
      const test = line + ch;
      if (!line || measure(test) <= maxW) { line = test; continue; }
      const sp = Math.max(line.lastIndexOf(' '), line.lastIndexOf('　'));
      if (sp > 0 && measure(line.slice(sp + 1) + ch) <= maxW) {
        out.push(line.slice(0, sp));
        line = line.slice(sp + 1) + ch;
      } else if (NO_HEAD.includes(ch) && Array.from(line).length > 1) {
        const arr = Array.from(line);
        const last = arr.pop();
        out.push(arr.join(''));
        line = last + ch;
      } else if (ch === ' ' || ch === '　') {
        out.push(line);
        line = '';
      } else {
        out.push(line);
        line = ch;
      }
    }
    out.push(line);
    return out;
  }

  function paginate(textOrLines) {
    const arr = Array.isArray(textOrLines) ? textOrLines : [textOrLines];
    const maxW = textWidthLimit();
    const measure = measurer();
    const pages = [];
    for (const p of arr) {
      if (p === null || p === undefined) continue;
      const text = App.util.format(String(p));
      const lines = [];
      text.split('\n').forEach((src) => lines.push(...wrapLine(src, maxW, measure)));
      for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'));
    }
    if (!pages.length) pages.push('');
    return pages;
  }

  // ---------------------------------------------------------------- 待機プリミティブ
  function typeText(text, speed) {
    return new Promise((resolve) => {
      const chars = Array.from(text);
      arrowEl.hidden = true;
      let done = false;
      let tmo = null;
      let shown = -1;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(tmo);
        textEl.textContent = text;
        listener = null;
        cancelCurrent = null;
        resolve();
      };
      cancelCurrent = finish;
      if (!(speed > 0) || !chars.length) { finish(); return; }
      listener = (action) => { if (action === 'a' || action === 'b') finish(); };
      const start = performance.now();
      const step = () => {
        if (done) return;
        const n = Math.min(chars.length, Math.floor((performance.now() - start) / speed) + 1);
        if (n !== shown) { shown = n; textEl.textContent = chars.slice(0, n).join(''); }
        if (n >= chars.length) finish();
        else tmo = setTimeout(step, Math.max(8, Math.min(speed, 33)));
      };
      step();
    });
  }

  function waitAdvance(auto) {
    return new Promise((resolve) => {
      let done = false;
      let tmo = null;
      const finish = (byUser) => {
        if (done) return;
        done = true;
        clearTimeout(tmo);
        arrowEl.hidden = true;
        listener = null;
        cancelCurrent = null;
        if (byUser) sfx('select');
        resolve();
      };
      cancelCurrent = () => finish(false);
      if (auto > 0) tmo = setTimeout(() => finish(false), auto);
      else arrowEl.hidden = false;
      listener = (action) => { if (action === 'a' || action === 'b') finish(true); };
    });
  }

  function chooseFrom(choices, initial, cancelIdx) {
    const el = App.util.el;
    return new Promise((resolve) => {
      choicesEl.innerHTML = '';
      const items = choices.map((c, i) => el('div', { class: 'dlg-choice', role: 'option', dataset: { index: i } },
        el('span', { class: 'dlg-cursor', text: '▶' }),
        el('span', { class: 'dlg-choice-label', text: App.util.format(String(c)) })));
      items.forEach((it) => choicesEl.appendChild(it));
      choicesEl.hidden = false;
      const n = items.length;
      let idx = Math.max(0, Math.min(n - 1, Math.floor(Number(initial) || 0)));
      const render = () => items.forEach((it, i) => {
        it.classList.toggle('is-active', i === idx);
        it.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      });
      render();
      let done = false;
      const finish = (i, sound) => {
        if (done) return;
        done = true;
        listener = null;
        cancelCurrent = null;
        choicesEl.hidden = true;
        if (sound) sfx(sound);
        resolve(i);
      };
      cancelCurrent = () => finish(cancelIdx);
      listener = (action) => {
        if (action === 'up') { idx = (idx - 1 + n) % n; render(); sfx('select'); }
        else if (action === 'down') { idx = (idx + 1) % n; render(); sfx('select'); }
        else if (action === 'a') finish(idx, 'confirm');
        else if (action === 'b') finish(cancelIdx, 'cancel');
      };
      items.forEach((it, i) => {
        it.addEventListener('pointerenter', () => { if (!done && idx !== i) { idx = i; render(); } });
        it.addEventListener('click', (e) => { e.stopPropagation(); finish(i, 'confirm'); });
      });
    });
  }

  // ---------------------------------------------------------------- キュー
  function enqueue(fn, cancelValue) {
    const gen = generation;
    const run = () => (gen !== generation ? cancelValue : fn(gen));
    const p = queue.then(run, run);
    queue = p.then(() => {}, () => {});
    return p;
  }

  function beginSession() {
    if (!inited) init();
    active++;
    acquireInput();
  }
  function endSession(keepOpen, gen) {
    active--;
    listener = null;
    cancelCurrent = null;
    if (active <= 0) { active = 0; releaseInput(); }
    if (!keepOpen && gen === generation) scheduleClose();
  }

  // ---------------------------------------------------------------- 公開 API
  // opts: { style: 'field'|'battle', speed: ms/文字, auto: ms, keepOpen: bool, width: px }
  //   keepOpen: 最終ページを表示し終えた時点で（入力を待たずに）resolve し、ウィンドウは開いたまま。
  //             auto と併用した場合は auto ms 待ってから resolve。次の say/ask か close() で閉じる。
  function say(textOrLines, opts) {
    opts = opts || {};
    return enqueue(async (gen) => {
      beginSession();
      try {
        openBox(opts.style, opts);
        const pages = paginate(textOrLines);
        for (let i = 0; i < pages.length; i++) {
          if (gen !== generation) return;
          const last = i === pages.length - 1;
          await typeText(pages[i], speedOf(opts));
          if (gen !== generation) return;
          if (last && opts.keepOpen && !(opts.auto > 0)) break;
          await waitAdvance(opts.auto);
        }
      } finally {
        endSession(!!opts.keepOpen, gen);
      }
    }, undefined);
  }

  // opts: { style, speed, keepOpen, default: 初期カーソル, cancel: B のときの index（既定は最後）, width }
  function ask(text, choices, opts) {
    opts = opts || {};
    const list = Array.isArray(choices) && choices.length ? choices : ['はい', 'いいえ'];
    const cancelIdx = Number.isInteger(opts.cancel) && opts.cancel >= 0 && opts.cancel < list.length ? opts.cancel : list.length - 1;
    return enqueue(async (gen) => {
      beginSession();
      let result = cancelIdx;
      try {
        openBox(opts.style, opts);
        if (text !== undefined && text !== null && text !== '') {
          const pages = paginate(text);
          for (let i = 0; i < pages.length; i++) {
            if (gen !== generation) return cancelIdx;
            await typeText(pages[i], speedOf(opts));
            if (gen !== generation) return cancelIdx;
            if (i < pages.length - 1) await waitAdvance(0);
          }
        } else {
          box.hidden = true;
        }
        if (gen !== generation) return cancelIdx;
        result = await chooseFrom(list, opts.default, cancelIdx);
      } finally {
        endSession(!!opts.keepOpen, gen);
      }
      return result;
    }, cancelIdx);
  }

  function isOpen() {
    return active > 0 || !!(box && !box.hidden && !closeTimer);
  }

  // 表示中・待機中の say/ask をすべて打ち切って閉じる（ask は B と同じ index で resolve）
  function close() {
    generation++;
    const c = cancelCurrent;
    cancelCurrent = null;
    listener = null;
    if (c) c();
    hideAll();
  }

  App.dialog = { init, say, ask, isOpen, close };
})();
