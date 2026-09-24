// =====================================================================
// App.util — 汎用関数（DOM生成・乱数・日付・書式など）
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  // GBA画面の基本寸法（1ドット = SCALE px）
  App.SCREEN = { W: 240, H: 160, SCALE: 3, TILE: 16 };

  // setAttribute ではなくプロパティとして設定する属性
  const PROP_KEYS = new Set(['value', 'checked', 'selected', 'disabled', 'hidden', 'readOnly', 'multiple', 'indeterminate', 'tabIndex']);

  function appendChildren(parent, children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false || c === true) continue;
      if (Array.isArray(c)) appendChildren(parent, c);
      else if (c instanceof Node) parent.appendChild(c);
      else parent.appendChild(document.createTextNode(String(c)));
    }
  }

  // el('div', { class: 'a b', text: 'hi', onclick: fn }, child1, 'text', [child2])
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs !== null && attrs !== undefined &&
        (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class' || k === 'className') {
          node.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
        } else if (k === 'id') {
          node.id = v;
        } else if (k === 'text') {
          node.textContent = String(v);
        } else if (k === 'html') {
          node.innerHTML = v;
        } else if (k === 'style') {
          if (typeof v === 'string') node.style.cssText = v;
          else {
            for (const sk of Object.keys(v)) {
              const sv = v[sk];
              if (sv === null || sv === undefined) continue;
              if (sk.startsWith('--')) node.style.setProperty(sk, sv);
              else node.style[sk] = sv;
            }
          }
        } else if (k === 'dataset') {
          for (const dk of Object.keys(v)) {
            if (v[dk] !== null && v[dk] !== undefined) node.dataset[dk] = v[dk];
          }
        } else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (PROP_KEYS.has(k)) {
          node[k] = v;
        } else {
          node.setAttribute(k, v === true ? '' : v);
        }
      }
    }
    appendChildren(node, children);
    return node;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }
  function rand() { return Math.random(); }
  function randInt(min, max) {
    min = Math.ceil(min); max = Math.floor(max);
    if (max < min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function chance(p) { return Math.random() < p; }
  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined; }
  function shuffle(arr) {
    const a = Array.from(arr || []);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 重み付き抽選。重みの合計が0以下なら均等に選ぶ
  function weightedPick(items, weightFn) {
    if (!items || !items.length) return undefined;
    const fn = typeof weightFn === 'function' ? weightFn : (it) => (it && it.weight) || 0;
    const ws = items.map((it) => Math.max(0, Number(fn(it)) || 0));
    const total = ws.reduce((s, w) => s + w, 0);
    if (total <= 0) return pick(items);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  function sleep(ms) { return new Promise((res) => setTimeout(res, Math.max(0, ms || 0))); }
  function nextFrame() { return new Promise((res) => requestAnimationFrame(() => res())); }

  // FNV-1a 32bit
  function hashString(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deepClone(obj) {
    if (obj === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(obj); } catch (e) { /* 関数を含む等 → JSON で複製 */ }
    }
    return JSON.parse(JSON.stringify(obj));
  }

  function formatNumber(n) {
    const v = Math.trunc(Number(n) || 0);
    return v.toLocaleString('ja-JP');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // ローカル日付 'YYYY-MM-DD'
  function today(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function formatDateTime(ms) {
    if (!ms) return '-';
    const d = new Date(ms);
    return today(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // '{player}' などを置換。vars 省略時も {player} はプレイヤー名になる
  function format(text, vars) {
    const base = {};
    try {
      const st = App.state && App.state.data;
      const cfg = window.GameData && window.GameData.config;
      base.player = (st && st.player && st.player.name) || (cfg && cfg.player && cfg.player.defaultName) || '';
    } catch (e) { /* 無視 */ }
    const v = Object.assign(base, vars || {});
    return String(text === null || text === undefined ? '' : text).replace(/\{(\w+)\}/g, (m, k) =>
      (v[k] !== undefined && v[k] !== null ? String(v[k]) : m));
  }

  function debounce(fn, ms) {
    let t = null;
    const d = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(this, args); }, ms);
    };
    d.cancel = () => { clearTimeout(t); t = null; };
    return d;
  }

  // テキスト入力中の要素か（キー操作を無視する判定）
  function isTypingTarget(t) {
    if (!t || t === document.body) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag === 'input') {
      const type = (t.type || 'text').toLowerCase();
      return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(type);
    }
    return !!t.isContentEditable;
  }

  // テキストをファイルとしてダウンロードさせる
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  App.util = {
    el, $, $$,
    clamp, rand, randInt, chance, pick, shuffle, weightedPick,
    sleep, nextFrame,
    hashString, mulberry32,
    deepClone, formatNumber, today, formatDateTime, escapeHtml, format,
    debounce, isTypingTarget, downloadText,
  };
})();
