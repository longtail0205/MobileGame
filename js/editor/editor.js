/* =====================================================================
   js/editor/editor.js — ガチャモン データエディタ（editor.html 専用）
   ---------------------------------------------------------------------
   ・window.GameData を直接編集する。起動時に data/*.js の内容を複製して保持し
     （S.snap）、変更の有無の判定・「元に戻す」に使う。
   ・「ゲームに一時反映」: 変更したキーだけを localStorage[config.overrideKey] に
     JSON で保存（SPEC 7.3）。ゲーム側 App.data.applyOverrides() が読み込む。
   ・「JSファイルを書き出し」: data/*.js の完全なソースを生成してダウンロード/コピー。
   依存: App.util / App.data / App.sprites（App.tiles は任意）
   ===================================================================== */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  // ------------------------------------------------------------------ 定数
  // エディタが扱う GameData のキー（config / tiles は固定ファイルなので対象外）
  const DATA_KEYS = ['monsters', 'moves', 'types', 'typeChart', 'rarities', 'rarityOrder', 'gacha', 'trainers', 'maps', 'worldStart'];
  const SECTIONS = [
    { id: 'monsters', label: 'モンスター', keys: ['monsters'] },
    { id: 'moves', label: 'わざ', keys: ['moves'] },
    { id: 'gacha', label: 'ガチャ', keys: ['rarities', 'rarityOrder', 'gacha'] },
    { id: 'trainers', label: 'トレーナー', keys: ['trainers'] },
    { id: 'types', label: 'タイプ', keys: ['types', 'typeChart'] },
    { id: 'maps', label: 'マップ', keys: ['maps', 'worldStart'] },
  ];
  // 書き出すファイルと、そのファイルが定義するキー
  const FILES = {
    'monsters.js': ['monsters'],
    'moves.js': ['moves'],
    'types.js': ['types', 'typeChart'],
    'gacha.js': ['rarities', 'rarityOrder', 'gacha'],
    'trainers.js': ['trainers'],
    'maps.js': ['worldStart', 'maps'],
  };

  const STATS = [
    { k: 'hp', label: 'HP' }, { k: 'atk', label: 'こうげき' }, { k: 'def', label: 'ぼうぎょ' },
    { k: 'spa', label: 'とくこう' }, { k: 'spd', label: 'とくぼう' }, { k: 'spe', label: 'すばやさ' },
  ];
  // 種族値合計の目安（SPEC 5.4）
  const STAT_GUIDE = { N: [250, 330], R: [330, 400], SR: [400, 470], SSR: [470, 540], UR: [540, 610] };
  const EXP_GROUPS = [
    { v: 'fast', label: 'fast（はやい）' }, { v: 'medium_fast', label: 'medium_fast（ふつう）' },
    { v: 'medium_slow', label: 'medium_slow（ややおそい）' }, { v: 'slow', label: 'slow（おそい）' },
  ];
  const SHAPES = [
    { v: 'blob', label: 'blob（まるい）' }, { v: 'biped', label: 'biped（2足）' }, { v: 'quadruped', label: 'quadruped（4足）' },
    { v: 'bird', label: 'bird（とり）' }, { v: 'fish', label: 'fish（さかな）' }, { v: 'serpent', label: 'serpent（へび）' },
    { v: 'insect', label: 'insect（むし）' }, { v: 'plant', label: 'plant（しょくぶつ）' }, { v: 'ghost', label: 'ghost（おばけ）' },
    { v: 'dragon', label: 'dragon（りゅう）' },
  ];
  const CATEGORIES = [
    { v: 'physical', label: 'ぶつり' }, { v: 'special', label: 'とくしゅ' }, { v: 'status', label: 'へんか' },
  ];
  const EFFECT_KINDS = [
    { v: 'stat', label: '能力ランク変化' }, { v: 'status', label: '状態異常' }, { v: 'heal', label: 'HP回復' },
    { v: 'drain', label: '吸収' }, { v: 'recoil', label: '反動' }, { v: 'flinch', label: 'ひるみ' }, { v: 'multihit', label: '連続攻撃' },
  ];
  const EFFECT_STATS = [
    { v: 'atk', label: 'こうげき' }, { v: 'def', label: 'ぼうぎょ' }, { v: 'spa', label: 'とくこう' }, { v: 'spd', label: 'とくぼう' },
    { v: 'spe', label: 'すばやさ' }, { v: 'acc', label: 'めいちゅう' }, { v: 'eva', label: 'かいひ' },
  ];
  const STATUSES = [
    { v: 'poison', label: 'どく' }, { v: 'burn', label: 'やけど' }, { v: 'paralyze', label: 'まひ' },
    { v: 'sleep', label: 'ねむり' }, { v: 'freeze', label: 'こおり' },
  ];
  const HAIR_STYLES = [
    { v: 'short', label: 'short（ショート）' }, { v: 'long', label: 'long（ロング）' }, { v: 'spiky', label: 'spiky（ツンツン）' },
    { v: 'bald', label: 'bald（ぼうず）' }, { v: 'bun', label: 'bun（おだんご）' },
  ];
  const DIRS = [{ v: 'down', label: 'down（下）' }, { v: 'up', label: 'up（上）' }, { v: 'left', label: 'left（左）' }, { v: 'right', label: 'right（右）' }];
  const AIS = [{ v: 'smart', label: 'smart（かしこい）' }, { v: 'random', label: 'random（ランダム）' }];
  const REMATCH = [{ v: 'never', label: 'never（1回だけ）' }, { v: 'daily', label: 'daily（毎日 再戦可）' }];
  // SPEC 7.9 の BGM 名
  const BGMS = ['title', 'town', 'route', 'forest', 'cave', 'gym', 'battleWild', 'battleTrainer', 'battleBoss', 'victory', 'gacha'];

  const MON_KEYS = ['id', 'no', 'name', 'rarity', 'types', 'baseStats', 'learnset', 'expGroup', 'baseExp', 'image', 'backImage', 'sprite', 'gacha', 'category', 'height', 'weight', 'desc'];
  const MOVE_GROUPS = [['name', 'type', 'category'], ['power', 'accuracy', 'pp', 'priority', 'critStage'], ['effects'], ['desc']];
  const EFFECT_KEYS = ['kind', 'target', 'stat', 'stages', 'status', 'ratio', 'min', 'max', 'chance'];
  const TRAINER_KEYS = ['name', 'className', 'look', 'image', 'party', 'reward', 'ai', 'boss', 'rematch', 'intro', 'lose', 'win', 'after'];
  const LOOK_KEYS = ['skin', 'hair', 'hairStyle', 'shirt', 'pants', 'hat', 'accent', 'image'];
  const MAP_KEYS = ['name', 'bgm', 'border', 'indoor', 'tiles', 'encounters', 'warps', 'npcs', 'signs', 'pickups'];
  const BANNER_KEYS = ['id', 'name', 'desc', 'rates', 'pool', 'pickup', 'pickupRate', 'colors'];
  const GACHA_KEYS = ['singleCost', 'multiCost', 'multiCount', 'multiGuarantee', 'pityCount', 'pityRarity', 'maxLimitBreak', 'limitBreakBonus', 'startLevel', 'banners'];
  const RARITY_KEYS = ['name', 'color', 'glow', 'stars', 'pointMult', 'refund', 'rainbow'];

  // ------------------------------------------------------------------ 状態
  const S = {
    snap: {},          // 起動時の data/*.js の内容（複製）
    snapSig: {},       // snap の JSON 文字列
    savedSig: {},      // 最後に保存（一時反映 / 書き出し）した時点の JSON 文字列
    loadedFrom: 'file',
    section: 'monsters',
    sel: { monster: null, move: null, trainer: null, banner: 0, map: null },
    filter: {
      monster: { q: '', rarity: '', type: '' },
      move: { q: '', type: '', category: '' },
      trainer: { q: '' },
    },
    localPreview: {},  // 画像パス → 選択したファイルの objectURL（コピー前のプレビュー用）
    map: { tool: 'pen', tile: '.', zoom: 2, grid: true, anchor: 'br' },
    lastReport: { errors: [], warnings: [] },
  };
  let refs = {};       // 画面要素の参照

  // ------------------------------------------------------------------ 汎用
  const U = () => App.util;
  const el = (...a) => App.util.el(...a);
  // el() と同じ規則（null を無視・配列を展開）で子要素を追加
  function put(parent, ...children) {
    children.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false || c === true) return;
      parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return parent;
  }
  const G = () => window.GameData || {};
  const cfg = () => G().config || {};
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const sig = (key) => { const v = G()[key]; return v === undefined ? 'undefined' : JSON.stringify(v); };
  const hasOwn = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const pad3 = (n) => { const s = String(n === undefined || n === null ? '' : n); return s.length >= 3 ? s : ('000' + s).slice(-3); };
  const ID_RE = /^[a-z0-9_]+$/;

  function isChanged(key) { return sig(key) !== S.snapSig[key]; }
  function isUnsaved(key) { return sig(key) !== S.savedSig[key]; }
  function sectionChanged(sec) { return sec.keys.some(isChanged); }
  function markSaved(keys) { (keys || DATA_KEYS).forEach((k) => { S.savedSig[k] = sig(k); }); scheduleStatus(); }

  // 空文字 → undefined、数値化できなければ undefined
  function toNum(v) {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return isFinite(n) ? n : undefined;
  }
  // 値が undefined / '' ならキーを削除、そうでなければ設定
  function setOpt(obj, key, value) {
    if (value === undefined || value === '' || (typeof value === 'number' && !isFinite(value))) delete obj[key];
    else obj[key] = value;
  }
  // オブジェクトのキー名を順番を保ったまま変更（新しいオブジェクトを返す）
  function renameKey(obj, oldKey, newKey) {
    const out = {};
    for (const k of Object.keys(obj)) out[k === oldKey ? newKey : k] = obj[k];
    return out;
  }
  function uniqueId(base, exists) {
    let id = base;
    let n = 2;
    while (exists(id)) { id = base + '_' + n; n++; }
    return id;
  }
  function monsterList() { const m = G().monsters; return Array.isArray(m) ? m : []; }
  function monById(id) { return monsterList().find((m) => m && m.id === id) || null; }
  function monsSorted() { return monsterList().filter(Boolean).slice().sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0)); }
  function movesObj() { return isObj(G().moves) ? G().moves : (G().moves = {}); }
  function typesObj() { return isObj(G().types) ? G().types : (G().types = {}); }
  function chartObj() { return isObj(G().typeChart) ? G().typeChart : (G().typeChart = {}); }
  function trainersObj() { return isObj(G().trainers) ? G().trainers : (G().trainers = {}); }
  function mapsObj() { return isObj(G().maps) ? G().maps : (G().maps = {}); }
  function gachaObj() { return isObj(G().gacha) ? G().gacha : (G().gacha = { banners: [] }); }
  function raritiesObj() { return isObj(G().rarities) ? G().rarities : (G().rarities = {}); }
  function rarityIds() {
    const o = G().rarityOrder;
    const ids = Array.isArray(o) && o.length ? o.slice() : [];
    Object.keys(raritiesObj()).forEach((r) => { if (!ids.includes(r)) ids.push(r); });
    return ids;
  }
  function typeName(id) { const t = typesObj()[id]; return (t && t.name) || id || '-'; }
  function moveName(id) { const m = movesObj()[id]; return (m && m.name) || id; }
  function monName(id) { const m = monById(id); return (m && m.name) || id; }
  function catLabel(v) { const c = CATEGORIES.find((x) => x.v === v); return c ? c.label : (v || '-'); }
  function randomColor() {
    const h = Math.floor(Math.random() * 360), s = 45 + Math.floor(Math.random() * 40), l = 35 + Math.floor(Math.random() * 30);
    return hslToHex(h, s, l);
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return '#' + f(0) + f(8) + f(4);
  }
  // <input type=color> は #rrggbb のみ受け付ける
  function colorValue(c, fallback) {
    const s = String(c || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    return fallback || '#888888';
  }
  // 高頻度の再描画をまとめる
  function throttleFrame(fn) {
    let queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    };
  }

  // ------------------------------------------------------------------ UI 部品
  function toast(msg, type, ms) {
    if (!refs.toasts) { refs.toasts = el('div', { class: 'ed-toasts' }); document.body.appendChild(refs.toasts); }
    const t = el('div', { class: 'ed-toast ' + (type || ''), text: msg });
    refs.toasts.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }

  // モーダル。buttons: [{ label, value, cls, id }] → Promise<value | null>
  function modal(opts) {
    return new Promise((resolve) => {
      const back = el('div', { class: 'ed-modal-back' });
      const box = el('div', { class: 'ed-modal' + (opts.wide ? ' wide' : ''), role: 'dialog' });
      const done = (v) => { document.removeEventListener('keydown', onKey, true); back.remove(); resolve(v); };
      const onKey = (e) => {
        if (e.key === 'Escape' && opts.closable !== false) { e.preventDefault(); done(null); }
      };
      box.append(el('div', { class: 'ed-modal-head', text: opts.title || '' }));
      const body = el('div', { class: 'ed-modal-body' });
      if (typeof opts.body === 'string') opts.body.split('\n').forEach((line) => body.appendChild(el('p', { text: line })));
      else if (opts.body) body.appendChild(opts.body);
      box.append(body);
      const foot = el('div', { class: 'ed-modal-foot' });
      (opts.buttons || [{ label: 'OK', value: true, cls: 'btn-primary' }]).forEach((b) => {
        foot.appendChild(el('button', {
          class: 'btn ' + (b.cls || ''), type: 'button', id: b.id || null, text: b.label,
          onclick: async () => {
            if (b.check) { const ok = await b.check(); if (!ok) return; }
            done(b.value);
          },
        }));
      });
      box.append(foot);
      back.appendChild(box);
      back.addEventListener('mousedown', (e) => { if (e.target === back && opts.closable !== false) done(null); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      const first = box.querySelector('input, select, textarea');
      if (first) setTimeout(() => first.focus(), 30);
    });
  }
  function confirmBox(msg, opts) {
    opts = opts || {};
    return modal({
      title: opts.title || '確認', body: msg,
      buttons: [{ label: 'キャンセル', value: false }, { label: opts.ok || 'OK', value: true, cls: opts.danger ? 'btn-danger' : 'btn-primary', id: 'ed-confirm-ok' }],
    }).then((v) => v === true);
  }

  function btn(label, onClick, cls, attrs) {
    return el('button', Object.assign({ class: 'btn ' + (cls || ''), type: 'button', text: label, onclick: onClick }, attrs || {}));
  }
  function iconBtn(label, title, onClick, disabled) {
    return el('button', { class: 'btn btn-icon btn-ghost', type: 'button', text: label, title, disabled: !!disabled, onclick: onClick });
  }
  function field(label, input, opts) {
    opts = opts || {};
    const f = el('div', { class: 'ed-field' + (opts.cls ? ' ' + opts.cls : '') },
      el('label', {}, label, opts.req ? el('span', { class: 'req', text: '*' }) : null),
      input);
    if (opts.hint !== undefined) {
      const h = el('div', { class: 'ed-hint', text: opts.hint });
      f.appendChild(h);
      f._hint = h;
    }
    return f;
  }
  function inputText(value, onInput, attrs) {
    const i = el('input', Object.assign({ class: 'input', type: 'text', value: value === undefined || value === null ? '' : String(value), spellcheck: 'false' }, attrs || {}));
    if (onInput) i.addEventListener('input', () => onInput(i.value, i));
    return i;
  }
  function inputNum(value, onInput, attrs) {
    const i = el('input', Object.assign({ class: 'input', type: 'number', value: value === undefined || value === null ? '' : String(value) }, attrs || {}));
    if (onInput) i.addEventListener('input', () => onInput(toNum(i.value), i));
    return i;
  }
  function selectBox(options, value, onChange, attrs) {
    const s = el('select', Object.assign({ class: 'select' }, attrs || {}));
    let found = false;
    const add = (parent, o) => {
      const opt = el('option', { value: o.v, text: o.label === undefined ? o.v : o.label });
      if (String(o.v) === String(value === undefined || value === null ? '' : value)) { opt.selected = true; found = true; }
      parent.appendChild(opt);
    };
    options.forEach((o) => {
      if (o.group) {
        const g = el('optgroup', { label: o.group });
        o.items.forEach((it) => add(g, it));
        s.appendChild(g);
      } else add(s, o);
    });
    if (!found && value !== undefined && value !== null && value !== '') {
      const opt = el('option', { value: value, text: '⚠ 未定義: ' + value });
      opt.selected = true;
      s.insertBefore(opt, s.firstChild);
    }
    if (onChange) s.addEventListener('change', () => onChange(s.value, s));
    return s;
  }
  function checkBox(label, checked, onChange, attrs) {
    const c = el('input', Object.assign({ type: 'checkbox', checked: !!checked }, attrs || {}));
    c.addEventListener('change', () => onChange(c.checked, c));
    return el('label', { class: 'ed-inline-check' }, c, label);
  }
  function colorInput(value, onInput, fallback) {
    const c = el('input', { type: 'color', value: colorValue(value, fallback) });
    c.addEventListener('input', () => onInput(c.value, c));
    return c;
  }
  function textArea(value, onInput, attrs) {
    const t = el('textarea', Object.assign({ class: 'textarea', spellcheck: 'false' }, attrs || {}));
    t.value = value === undefined || value === null ? '' : String(value);
    if (onInput) t.addEventListener('input', () => onInput(t.value, t));
    return t;
  }
  function card(title, ...children) {
    return el('div', { class: 'card' }, title ? el('h4', { class: 'card-title' }, title) : null, ...children);
  }
  function rarBadge(id) {
    const r = raritiesObj()[id];
    return el('span', {
      class: 'badge badge-rar' + (r && r.rainbow ? ' is-rainbow' : ''),
      style: { '--c': (r && r.color) || '#666' }, text: id || '?', title: (r && r.name) || '',
    });
  }
  function typeBadge(id) {
    const t = typesObj()[id];
    return el('span', { class: 'badge', style: { '--c': (t && t.color) || '#555' }, text: (t && t.name) || ('⚠' + id) });
  }
  function sectionHead(title, ...right) {
    return el('div', { class: 'ed-section-head' }, el('h2', { text: title }), el('span', { class: 'ed-spacer' }), ...right);
  }
  function typeOptions(withNone) {
    const o = Object.keys(typesObj()).map((id) => ({ v: id, label: typeName(id) + '（' + id + '）' }));
    return withNone ? [{ v: '', label: '（なし）' }].concat(o) : o;
  }
  function rarityOptions(withNone, noneLabel) {
    const o = rarityIds().map((id) => ({ v: id, label: id + '（' + ((raritiesObj()[id] || {}).name || '') + '）' }));
    return withNone ? [{ v: '', label: noneLabel || '（なし）' }].concat(o) : o;
  }
  function monsterOptions(withNone) {
    const o = monsSorted().map((m) => ({ v: m.id, label: 'No.' + pad3(m.no) + ' ' + (m.name || m.id) + '（' + m.id + '）' }));
    return withNone ? [{ v: '', label: '（なし）' }].concat(o) : o;
  }
  // わざの選択肢（タイプごとにグループ化）
  function moveOptions(withNone) {
    const groups = {};
    const order = [];
    Object.keys(movesObj()).forEach((id) => {
      const mv = movesObj()[id];
      const t = (mv && mv.type) || '?';
      if (!groups[t]) { groups[t] = []; order.push(t); }
      groups[t].push({ v: id, label: ((mv && mv.name) || id) + '（' + id + '）' });
    });
    const out = order.map((t) => ({ group: typeName(t), items: groups[t] }));
    return withNone ? [{ v: '', label: '（なし）' }].concat(out) : out;
  }

  // モンスター画像（ファイル選択直後はローカルプレビューを使う）
  function spriteSrc(def, view) {
    const sp = App.sprites.monsterSprite(def, view);
    const local = S.localPreview[sp.src];
    return { src: local || sp.src, flip: sp.flip };
  }
  // 画像指定を無視した自動生成スプライト
  function autoSpriteSrc(def, view) {
    const copy = Object.assign({}, def, { image: '', backImage: '' });
    return App.sprites.monsterSprite(copy, view).src;
  }
  function spriteImg(def, view, cls) {
    const sp = spriteSrc(def, view);
    const img = el('img', { class: (cls || '') + (sp.flip ? ' flip' : ''), src: sp.src, alt: '', draggable: 'false' });
    let retried = false;
    img.addEventListener('error', () => {
      if (retried) return;
      retried = true;
      img.classList.remove('flip');
      img.src = autoSpriteSrc(def, view);
    });
    return img;
  }

  // ==================================================================
  // JS ソース生成（data/*.js の書き出し）
  // ==================================================================
  const WIDTH = 110;
  const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  function jsStr(s) {
    return "'" + String(s)
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      .replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
      .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
      .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029') + "'";
  }
  function jsKey(k) { return IDENT_RE.test(k) ? k : jsStr(k); }
  function jsNum(n) { return isFinite(n) ? (Object.is(n, -0) ? '0' : String(n)) : 'null'; }
  function presentKeys(obj) { return Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function'); }
  function orderKeys(obj, order) {
    const ks = presentKeys(obj);
    if (!order) return ks;
    return order.filter((k) => ks.includes(k)).concat(ks.filter((k) => !order.includes(k)));
  }
  // 1行表記
  function inl(v, order) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return jsStr(v);
    if (typeof v === 'number') return jsNum(v);
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.length ? '[' + v.map((x) => inl(x)).join(', ') + ']' : '[]';
    if (typeof v === 'object') {
      const ks = orderKeys(v, order);
      return ks.length ? '{ ' + ks.map((k) => jsKey(k) + ': ' + inl(v[k])).join(', ') + ' }' : '{}';
    }
    return 'null';
  }
  function cmt(text) { return text ? ' // ' + String(text).replace(/[\r\n]+/g, ' ').split(String.fromCharCode(0x2028)).join(' ').split(String.fromCharCode(0x2029)).join(' ') : ''; }
  // 整形表記。spec: { order, multi（常に複数行）, lines（配列を1要素1行）, groups, each, children, keyComment, itemComment }
  function ser(v, ind, spec) {
    spec = spec || {};
    if (v === null || typeof v !== 'object') return inl(v);
    const ind2 = ind + '  ';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      const eo = spec.each && spec.each.order;
      const one = v.length ? '[' + v.map((x) => inl(x, eo)).join(', ') + ']' : '[]';
      if (!spec.lines && !(spec.each && spec.each.multi) && one.length + ind.length <= WIDTH) return one;
      return '[\n' + v.map((x, i) => ind2 + ser(x, ind2, spec.each) + ',' + cmt(spec.itemComment ? spec.itemComment(x, i) : '') + '\n').join('') + ind + ']';
    }
    const ks = orderKeys(v, spec.order);
    if (!ks.length) return '{}';
    if (!spec.multi && !spec.groups) {
      const one = inl(v, spec.order);
      if (one.length + ind.length <= WIDTH) return one;
    }
    let out = '{\n';
    const used = new Set();
    if (spec.groups) {
      spec.groups.forEach((grp) => {
        const gk = grp.filter((k) => ks.includes(k));
        if (!gk.length) return;
        const simple = gk.every((k) => v[k] === null || typeof v[k] !== 'object');
        if (simple) {
          out += ind2 + gk.map((k) => jsKey(k) + ': ' + inl(v[k])).join(', ') + ',\n';
        } else {
          gk.forEach((k) => { out += ind2 + jsKey(k) + ': ' + ser(v[k], ind2, (spec.children || {})[k]) + ',\n'; });
        }
        gk.forEach((k) => used.add(k));
      });
    }
    ks.forEach((k) => {
      if (used.has(k)) return;
      const c = spec.keyComment ? spec.keyComment(k, v[k], v) : '';
      out += ind2 + jsKey(k) + ': ' + ser(v[k], ind2, (spec.children || {})[k]) + ',' + cmt(c) + '\n';
    });
    return out + ind + '}';
  }
  function padKey(k, w) { const s = jsKey(k) + ':'; return s + ' '.repeat(Math.max(1, w - s.length + 1)); }

  function fileHeader(title, lines) {
    const now = new Date();
    const stamp = U().today(now) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const out = [
      '// =====================================================================',
      '// ' + title,
      '// ---------------------------------------------------------------------',
      '// このファイルは データエディタ（editor.html）で書き出しました（' + stamp + '）。',
      '// テキストエディタで 直接 書き換えても かまいません。',
      '//',
    ];
    lines.forEach((l) => out.push(l ? '// ' + l : '//'));
    out.push('// =====================================================================');
    out.push('window.GameData = window.GameData || {};');
    out.push('');
    return out.join('\n') + '\n';
  }

  const MON_SPEC = {
    multi: true, order: MON_KEYS,
    keyComment: (k, v) => {
      if (k === 'baseStats' && isObj(v)) return '合計 ' + STATS.reduce((s, st) => s + (Number(v[st.k]) || 0), 0);
      return '';
    },
    children: {
      learnset: { lines: true, each: { order: ['lv', 'move'] }, itemComment: (l) => (l && movesObj()[l.move] ? moveName(l.move) : '') },
      baseStats: { order: STATS.map((s) => s.k) },
      sprite: { order: ['shape', 'colors', 'seed'] },
    },
  };
  function genMonsters() {
    let s = fileHeader('モンスターの定義', [
      'GameData.monsters = [ { 1体目 }, { 2体目 }, ... ]   1体 = 1ブロック。',
      'いちばん簡単な追加方法は「似ているブロックを まるごとコピーして 最後に貼り付け、値を書き換える」ことです。',
      '',
      'id        : 内部ID。英小文字・数字・_ のみ。ほかと重ならないこと（セーブデータ等が参照するので公開後は変えない）',
      'no        : 図鑑番号（ほかと重ならない整数）。図鑑はこの順に並びます',
      'name      : 表示名',
      "rarity    : レア度 'N' | 'R' | 'SR' | 'SSR' | 'UR'（gacha.js の rarities のキー）",
      "types     : タイプ 1〜2個（types.js のキー）例 ['fire'] / ['water', 'dragon']",
      'baseStats : 種族値 hp / atk(こうげき) / def(ぼうぎょ) / spa(とくこう) / spd(とくぼう) / spe(すばやさ)',
      '            合計の目安: N 250〜330 / R 330〜400 / SR 400〜470 / SSR 470〜540 / UR 540〜610',
      "learnset  : 覚えるわざ { lv: レベル, move: 'わざID' }。lv: 1 のわざを 必ず1つ以上 入れる",
      "expGroup  : レベルアップの速さ 'fast' | 'medium_fast' | 'medium_slow' | 'slow'",
      'baseExp   : 倒されたときに相手がもらう経験値の基準',
      "image     : 正面画像のパス（'' なら自動生成ドット絵）例 'assets/monsters/hinokon.png'",
      "backImage : 背面画像のパス（'' なら image を左右反転。image も '' なら自動生成）",
      'sprite    : 自動生成ドット絵の調整 { shape: 体型, colors: [メイン, サブ, アクセント], seed: 数字 }',
      '            shape: blob / biped / quadruped / bird / fish / serpent / insect / plant / ghost / dragon',
      'gacha     : false にすると ガチャに出なくなる',
      'category  : 図鑑の分類   height: 高さ(m)   weight: 重さ(kg)   desc: 図鑑の説明文',
    ]);
    s += 'GameData.monsters = [\n';
    monsterList().forEach((m) => {
      if (!isObj(m)) return;
      const types = Array.isArray(m.types) ? m.types.map(typeName).join('・') : '';
      s += '  // ─── No.' + pad3(m.no) + ' ' + String(m.name || m.id || '').replace(/[\r\n]+/g, ' ') + ' ─── ' + (m.rarity || '') + ' / ' + types + '\n';
      s += '  ' + ser(m, '  ', MON_SPEC) + ',\n';
    });
    s += '];\n';
    return s;
  }

  const MOVE_SPEC = { groups: MOVE_GROUPS, children: { effects: { lines: false, each: { order: EFFECT_KEYS } } } };
  function genMoves() {
    let s = fileHeader('わざ（技）の定義', [
      'GameData.moves = { わざID: { 設定 }, ... }   わざID は英小文字・数字・_（monsters.js の learnset から参照）',
      '',
      'name     : 表示名          type: タイプID（types.js のキー）',
      "category : 'physical'（ぶつり）| 'special'（とくしゅ）| 'status'（へんか。power は 0）",
      'power    : いりょく   accuracy: めいちゅう(%)。0 = かならず あたる   pp: つかえる回数',
      'priority : （省略可）ゆうせんど。1 以上で先に動ける / -1 以下で後攻',
      'critStage: （省略可）1 で きゅうしょに あたりやすい',
      'effects  : （省略可）追加効果の配列',
      "  { kind: 'stat', target: 'foe' | 'self', stat: 'atk'|'def'|'spa'|'spd'|'spe'|'acc'|'eva', stages: -3〜3, chance: 1〜100 }",
      "  { kind: 'status', status: 'poison'|'burn'|'paralyze'|'sleep'|'freeze', chance: 1〜100 }（chance 省略で 100%）",
      "  { kind: 'heal', ratio: 0.5 }   { kind: 'drain', ratio: 0.5 }   { kind: 'recoil', ratio: 0.25 }",
      "  { kind: 'flinch', chance: 30 }   { kind: 'multihit', min: 2, max: 5 }",
      'desc     : 説明文',
    ]);
    s += 'GameData.moves = {\n';
    let lastType = null;
    Object.keys(movesObj()).forEach((id) => {
      const mv = movesObj()[id];
      if (!isObj(mv)) return;
      if (mv.type !== lastType) {
        s += '  // ---- ' + typeName(mv.type) + ' ----\n';
        lastType = mv.type;
      }
      s += '  ' + jsKey(id) + ': ' + ser(mv, '  ', MOVE_SPEC) + ',\n';
    });
    s += '};\n';
    return s;
  }

  function genTypes() {
    let s = fileHeader('タイプ定義と相性表', [
      'GameData.types     … タイプの一覧。キー（英小文字）がタイプID。 name: 表示名 / color: 色（#RRGGBB）',
      'GameData.typeChart … 攻撃するわざのタイプ: { 受けるモンスターのタイプ: 倍率 }',
      '  2 = こうかは ばつぐん / 0.5 = いまひとつ / 0 = こうかが ない。書いていない組み合わせは 1。',
      '  防御側が2タイプのときは 倍率を掛け算します（2 × 2 = 4倍）。',
    ]);
    const types = typesObj();
    const ids = Object.keys(types);
    const w = Math.max(8, ...ids.map((k) => jsKey(k).length + 1));
    s += 'GameData.types = {\n';
    ids.forEach((id) => { s += '  ' + padKey(id, w) + inl(types[id], ['name', 'color']) + ',\n'; });
    s += '};\n\n';
    const chart = chartObj();
    const rows = ids.filter((id) => hasOwn(chart, id)).concat(Object.keys(chart).filter((id) => !ids.includes(id)));
    s += 'GameData.typeChart = {\n';
    s += '  // 攻撃側: { 防御側: 倍率, ... }\n';
    rows.forEach((atk) => {
      const row = chart[atk];
      if (!isObj(row)) { s += '  ' + padKey(atk, w) + inl(row) + ',\n'; return; }
      const order = ids.filter((d) => hasOwn(row, d)).concat(Object.keys(row).filter((d) => !ids.includes(d)));
      s += '  ' + padKey(atk, w) + inl(row, order) + ',\n';
    });
    s += '};\n';
    return s;
  }

  const BANNER_SPEC = { multi: true, order: BANNER_KEYS };
  function genGacha() {
    let s = fileHeader('レア度・ガチャの設定', [
      'GameData.rarities … レア度（キーがID）。name / color / glow（光の色）/ stars（★の数）',
      '                    pointMult（野生を倒したときのポイント倍率）/ refund（凸が最大のとき重複で返るポイント）/ rainbow（虹演出）',
      'GameData.rarityOrder … レア度を「低い → 高い」順に並べた配列',
      'GameData.gacha … singleCost（単発）/ multiCost（10連）/ multiCount（連数）/ multiGuarantee（最後の1回の確定レア度。null で無し）',
      '                 pityCount（天井の回数。0 で無し）/ pityRarity（天井で確定するレア度）/ maxLimitBreak（凸の上限）',
      '                 limitBreakBonus（凸1つあたりの能力アップ率）/ startLevel（入手時のレベル）',
      '  banners … ガチャの種類（画面に上から順に並ぶ）',
      '    id / name / desc / rates（レア度ごとの%。合計100）',
      "    pool（null = gacha: true の全モンスター / ['id', ...] = 書いたモンスターだけ）",
      '    pickup（出やすくなるモンスターID）/ pickupRate（そのレア度が出たとき ピックアップが選ばれる確率 0〜1）',
      '    colors（バナー背景のグラデーション [色1, 色2]）',
    ]);
    const rar = raritiesObj();
    const ids = Object.keys(rar);
    const w = Math.max(4, ...ids.map((k) => jsKey(k).length + 1));
    s += 'GameData.rarities = {\n';
    ids.forEach((id) => { s += '  ' + padKey(id, w) + inl(rar[id], RARITY_KEYS) + ',\n'; });
    s += '};\n\n';
    s += 'GameData.rarityOrder = ' + inl(Array.isArray(G().rarityOrder) ? G().rarityOrder : ids) + ';\n\n';
    const g = gachaObj();
    s += 'GameData.gacha = {\n';
    orderKeys(g, GACHA_KEYS).forEach((k) => {
      if (k === 'banners' && Array.isArray(g.banners)) {
        s += '  banners: [\n';
        g.banners.forEach((b) => { s += '    ' + ser(b, '    ', BANNER_SPEC) + ',\n'; });
        s += '  ],\n';
      } else {
        s += '  ' + jsKey(k) + ': ' + ser(g[k], '  ') + ',\n';
      }
    });
    s += '};\n';
    return s;
  }

  const TRAINER_SPEC = {
    multi: true, order: TRAINER_KEYS,
    children: {
      look: { order: LOOK_KEYS },
      party: { lines: true, each: { order: ['species', 'level', 'moves'] }, itemComment: (p) => (p && monById(p.species) ? monName(p.species) : '') },
    },
  };
  function genTrainers() {
    let s = fileHeader('トレーナー', [
      'GameData.trainers = { トレーナーID: { 設定 }, ... }（maps.js の NPC から trainer: \'ID\' で参照）',
      '',
      "name / className（表示: 「className の name」）/ image（バトル立ち絵のパス。'' = 自動生成）",
      "look  : 見た目 { skin, hair, hairStyle: 'short'|'long'|'spiky'|'bald'|'bun', shirt, pants, hat: 色 or null, accent, image }",
      "party : 手持ち [ { species: 'モンスターID', level: 5, moves: ['わざID', ...]（省略可・4つまで） } ]",
      "reward: 勝利ポイント（省略時 config.rewards.trainerDefault） / ai: 'smart' | 'random' / boss: true でボスBGM",
      "rematch: 'never' | 'daily'（日付が変わると再戦可）",
      'intro（話しかけ・発見時）/ lose（プレイヤー勝利時）/ win（プレイヤー敗北時）/ after（撃破後）… 台詞。1要素 = 1ページ',
    ]);
    s += 'GameData.trainers = {\n';
    Object.keys(trainersObj()).forEach((id) => {
      s += '  ' + jsKey(id) + ': ' + ser(trainersObj()[id], '  ', TRAINER_SPEC) + ',\n';
    });
    s += '};\n';
    return s;
  }

  const OBJ_LINE = { lines: true, each: {} };
  const MAP_SPEC = {
    groups: [['name', 'bgm', 'border', 'indoor']], order: MAP_KEYS,
    children: {
      tiles: { lines: true },
      encounters: { multi: true, order: ['rate', 'table'], children: { table: { lines: true, each: { order: ['species', 'min', 'max', 'weight'] } } } },
      warps: { lines: true, each: { order: ['x', 'y', 'to', 'tx', 'ty', 'dir', 'requireParty'] } },
      npcs: { lines: true, each: { order: ['id', 'x', 'y', 'dir', 'look', 'move', 'dialog', 'heal', 'action', 'trainer', 'sight'], children: { look: { order: LOOK_KEYS } } } },
      signs: OBJ_LINE,
      pickups: { lines: true, each: { order: ['id', 'x', 'y', 'points'] } },
    },
  };
  function genMaps() {
    let s = fileHeader('マップ・開始位置', [
      "GameData.worldStart … ニューゲームの開始位置 { map, x, y, dir: 'up'|'down'|'left'|'right' }",
      'GameData.maps = { マップID: { 設定 }, ... }',
      '  name（表示名）/ bgm（BGM名）/ border（マップの外に描くタイル記号）/ indoor（室内なら true）',
      '  tiles … 1文字 = 1マス。全行 同じ長さにする。記号の意味は data/tiles.js',
      '  encounters … { rate: 1歩あたりの確率, table: [ { species, min, max, weight } ] }（草むら等で出る野生）',
      '  warps   … [ { x, y, to: 行き先マップID, tx, ty, dir, requireParty: true（手持ちがいないと通れない） } ]',
      "  npcs    … [ { id, x, y, dir, look, move: 'still'|'turn'|'wander', dialog: [...] } ]",
      "            heal: true = 回復 / action: 'gacha' = ガチャ誘導 / trainer: 'トレーナーID', sight: 視線のマス数",
      '  signs   … [ { x, y, text: [...] } ]   pickups … [ { id（全マップで一意）, x, y, points } ]',
    ]);
    s += 'GameData.worldStart = ' + inl(G().worldStart, ['map', 'x', 'y', 'dir']) + ';\n\n';
    s += 'GameData.maps = {\n';
    Object.keys(mapsObj()).forEach((id) => {
      s += '  ' + jsKey(id) + ': ' + ser(mapsObj()[id], '  ', MAP_SPEC) + ',\n';
    });
    s += '};\n';
    return s;
  }

  const GENERATORS = {
    'monsters.js': genMonsters, 'moves.js': genMoves, 'types.js': genTypes,
    'gacha.js': genGacha, 'trainers.js': genTrainers, 'maps.js': genMaps,
  };
  function generate(name) {
    const fn = GENERATORS[name];
    if (!fn) throw new Error('未知のファイル: ' + name);
    return fn();
  }

  // 生成したソースを別の名前空間で実行し、現在のデータと一致するか確認（開発・テスト用）
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function selfTest() {
    const result = {};
    Object.keys(FILES).forEach((name) => {
      try {
        const code = generate(name);
        const fakeWin = { GameData: {} };
        // eslint-disable-next-line no-new-func
        new Function('window', 'GameData', code)(fakeWin, fakeWin.GameData);
        const bad = FILES[name].filter((k) => canon(fakeWin.GameData[k]) !== canon(G()[k]));
        result[name] = bad.length ? 'NG（不一致: ' + bad.join(', ') + '）' : 'OK';
      } catch (e) {
        result[name] = 'NG（' + e.message + '）';
      }
    });
    return result;
  }

  // ==================================================================
  // 検証・保存
  // ==================================================================
  function runValidate() {
    let r;
    try { r = App.data.validate(); } catch (e) { r = { errors: ['検証中に例外が発生しました: ' + e.message], warnings: [] }; }
    S.lastReport = r;
    return r;
  }
  function reportList(r, max) {
    const ul = el('ul', { class: 'ed-msglist' });
    const items = r.errors.map((t) => ({ t, c: 'e' })).concat(r.warnings.map((t) => ({ t, c: 'w' })));
    items.slice(0, max || 400).forEach((it) => ul.appendChild(el('li', { class: it.c, text: it.t })));
    if (items.length > (max || 400)) ul.appendChild(el('li', { class: 'w', text: '…ほか ' + (items.length - (max || 400)) + ' 件' }));
    return ul;
  }
  function showReport() {
    const r = runValidate();
    const body = el('div', {},
      el('p', {}, el('span', { class: 'chip ' + (r.errors.length ? 'chip-danger' : 'chip-ok'), text: 'エラー ' + r.errors.length + ' 件' }), ' ',
        el('span', { class: 'chip ' + (r.warnings.length ? 'chip-warn' : 'chip-ok'), text: '警告 ' + r.warnings.length + ' 件' })),
      r.errors.length || r.warnings.length ? reportList(r) : el('p', { class: 'ok', text: '問題は見つかりませんでした。' }),
      el('p', { class: 'muted small', text: 'エラーはゲームの動作に支障が出る問題、警告は確認をおすすめする項目です。' }));
    updateStatus();
    return modal({ title: 'データの検証', body, wide: true, buttons: [{ label: '閉じる', value: true, cls: 'btn-primary', id: 'ed-report-close' }] });
  }
  // 保存前の検証。問題があれば一覧を出して続行するか確認する
  async function validateBeforeSave(actionLabel) {
    const r = runValidate();
    updateStatus();
    if (!r.errors.length && !r.warnings.length) return true;
    const body = el('div', {},
      el('p', { text: r.errors.length ? 'エラーがあります。このまま' + actionLabel + 'すると、ゲームが正しく動かない可能性があります。' : '警告があります。内容を確認してください。' }),
      el('p', {}, el('span', { class: 'chip ' + (r.errors.length ? 'chip-danger' : 'chip-ok'), text: 'エラー ' + r.errors.length + ' 件' }), ' ',
        el('span', { class: 'chip chip-warn', text: '警告 ' + r.warnings.length + ' 件' })),
      reportList(r));
    const v = await modal({
      title: actionLabel + '前の検証', body, wide: true,
      buttons: [{ label: 'キャンセル', value: false }, { label: 'このまま' + actionLabel, value: true, cls: r.errors.length ? 'btn-danger' : 'btn-primary', id: 'ed-save-anyway' }],
    });
    return v === true;
  }

  function overrideKey() { return cfg().overrideKey || 'gachamon_data_override_v1'; }
  function readOverride() {
    let raw = null;
    try { raw = localStorage.getItem(overrideKey()); } catch (e) { raw = null; }
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      return isObj(o) ? { obj: o, size: raw.length } : { broken: true, size: raw.length };
    } catch (e) { return { broken: true, size: raw.length }; }
  }

  async function applyToGame(opts) {
    opts = opts || {};
    if (!opts.skipValidate && !(await validateBeforeSave('一時反映'))) return false;
    const keys = DATA_KEYS.filter(isChanged);
    if (!keys.length) {
      const cur = readOverride();
      if (cur) {
        const ok = opts.skipValidate || await confirmBox('ファイル（data/*.js）と同じ内容のため、反映するデータがありません。\n現在の一時反映を解除して、ゲームを標準データに戻しますか？', { ok: '解除する' });
        if (ok) { App.data.clearOverrides(); markSaved(); toast('一時反映を解除しました', 'success'); }
      } else {
        toast('ファイル（data/*.js）から変更がないため、反映するデータはありません', 'warn', 3500);
      }
      return false;
    }
    const obj = { _savedAt: Date.now(), _by: 'editor' };
    keys.forEach((k) => { obj[k] = G()[k]; });
    const json = JSON.stringify(obj);
    try {
      localStorage.setItem(overrideKey(), json);
    } catch (e) {
      await modal({
        title: '保存できませんでした',
        body: 'ブラウザの保存容量（localStorage）が足りない可能性があります（' + Math.round(json.length / 1024) + ' KB）。\n画像を「データURLとして埋め込む」にしている場合は、assets/monsters/ に画像を置いてパスで指定してください。\n詳細: ' + e.message,
        buttons: [{ label: '閉じる', value: true, cls: 'btn-primary' }],
      });
      return false;
    }
    markSaved();
    if (!opts.quiet) {
      const labels = keys.join(', ');
      modal({
        title: 'ゲームに一時反映しました',
        body: el('div', {},
          el('p', { text: '対象: ' + labels }),
          el('p', { text: 'ゲーム（index.html）を開いている場合は、再読み込み（F5）すると反映されます。' }),
          el('p', { class: 'muted small', text: 'この反映はこのブラウザだけに保存されます。ほかのPCや配布用に恒久反映するには「JSファイルを書き出し」で data/ のファイルを置き換えてください。' })),
        buttons: [{ label: '閉じる', value: false, id: 'ed-applied-close' }, { label: 'ゲームを開く ↗', value: true, cls: 'btn-gold' }],
      }).then((v) => { if (v) window.open('index.html', '_blank'); });
    }
    return true;
  }

  async function clearGameOverride() {
    if (!readOverride()) { toast('一時反映中のデータはありません', 'info'); return; }
    const ok = await confirmBox('ゲームへの一時反映を解除して、ゲームを data/*.js の標準データに戻しますか？\n（エディタで編集中の内容は消えません）', { ok: '解除する', danger: true });
    if (!ok) return;
    App.data.clearOverrides();
    S.savedSig = Object.assign({}, S.snapSig);
    toast('一時反映を解除しました。ゲームを再読み込みすると標準データに戻ります', 'success', 3500);
    updateStatus();
  }

  function fileChanged(name) { return FILES[name].some(isChanged); }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* 下の方法を試す */ }
    try {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0;opacity:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function downloadFile(name) {
    U().downloadText(name, generate(name), 'text/javascript;charset=utf-8');
    markSaved(FILES[name]);
  }

  async function openExport() {
    if (!(await validateBeforeSave('書き出し'))) return;
    const preview = textArea('', null, { class: 'textarea mono ed-export-preview', readonly: true, id: 'ed-export-preview' });
    const list = el('div', { class: 'ed-export-files' });
    Object.keys(FILES).forEach((name) => {
      let size = 0;
      try { size = generate(name).length; } catch (e) { size = -1; }
      list.appendChild(el('div', { class: 'ed-export-file' + (fileChanged(name) ? ' is-changed' : '') },
        el('span', { class: 'fname', text: name }),
        el('span', { class: 'fsize', text: size < 0 ? '生成エラー' : (Math.max(1, Math.round(size / 1024)) + ' KB' + (fileChanged(name) ? '・変更あり' : '')) }),
        btn('表示', () => { preview.value = generate(name); preview.scrollTop = 0; }, 'btn-sm'),
        btn('コピー', async () => {
          const ok = await copyText(generate(name));
          if (ok) { markSaved(FILES[name]); toast(name + ' をクリップボードにコピーしました', 'success'); } else toast('コピーできませんでした。「表示」から手動でコピーしてください', 'error', 4000);
        }, 'btn-sm'),
        btn('ダウンロード', () => downloadFile(name), 'btn-sm btn-primary', { dataset: { file: name } })));
    });
    const body = el('div', {},
      el('p', { text: 'data/ フォルダの同じ名前のファイルと置き換えると、変更が恒久的に反映されます（元のファイルはバックアップしておくと安心です）。' }),
      el('p', { class: 'muted small', text: '● は data/*.js から変更があるファイル。ダウンロードしたファイルは「ダウンロード」フォルダに保存されます。置き換えたあとは「一時反映を解除」しておくと確実です。' }),
      list,
      el('div', { class: 'ed-row', style: 'margin-top:10px' },
        btn('変更したファイルをすべてダウンロード', () => {
          const names = Object.keys(FILES).filter(fileChanged);
          if (!names.length) { toast('変更のあるファイルはありません', 'warn'); return; }
          names.forEach((n, i) => setTimeout(() => downloadFile(n), i * 400));
        }, 'btn-gold'),
        btn('全ファイルをダウンロード', () => Object.keys(FILES).forEach((n, i) => setTimeout(() => downloadFile(n), i * 400)))),
      preview);
    return modal({ title: 'JSファイルを書き出し', body, wide: true, buttons: [{ label: '閉じる', value: true, cls: 'btn-primary', id: 'ed-export-close' }] });
  }

  // ==================================================================
  // ヘッダー・ナビ・状態表示
  // ==================================================================
  let statusTimer = null;
  function scheduleStatus() {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(updateStatus, 250);
  }
  // データを変更したら呼ぶ
  function touched() { scheduleStatus(); }

  function updateStatus() {
    if (!refs.status) return;
    const r = runValidate();
    const changed = SECTIONS.filter(sectionChanged);
    const unsaved = DATA_KEYS.some(isUnsaved);
    const ov = readOverride();
    refs.status.innerHTML = '';
    put(refs.status, 
      el('span', { class: 'chip chip-info', text: S.loadedFrom === 'override' ? '起動: 一時反映データ' : '起動: data/*.js' }),
      el('span', { class: 'chip ' + (changed.length ? 'chip-warn' : ''), title: 'data/*.js（ファイル）からの変更', text: changed.length ? '変更: ' + changed.map((s) => s.label).join('・') : 'ファイルから変更なし' }),
      unsaved ? el('span', { class: 'chip chip-warn', text: '未保存の変更あり' }) : null,
      el('span', { class: 'chip ' + (ov ? (ov.broken ? 'chip-danger' : 'chip-ok') : ''), text: ov ? (ov.broken ? '一時反映データ: 壊れています' : 'ゲームに一時反映中') : '一時反映なし' }),
      el('button', {
        class: 'chip ' + (r.errors.length ? 'chip-danger' : (r.warnings.length ? 'chip-warn' : 'chip-ok')), type: 'button', style: 'cursor:pointer',
        title: 'クリックで検証結果を表示', text: 'エラー ' + r.errors.length + ' / 警告 ' + r.warnings.length, onclick: showReport,
      }));
    if (refs.navBtns) {
      SECTIONS.forEach((sec) => {
        const b = refs.navBtns[sec.id];
        if (!b) return;
        const dot = b.querySelector('.ed-dot');
        if (sectionChanged(sec) && !dot) b.appendChild(el('span', { class: 'ed-dot', title: '変更あり' }));
        if (!sectionChanged(sec) && dot) dot.remove();
      });
    }
    if (refs.revertBtn) refs.revertBtn.disabled = !sectionChanged(SECTIONS.find((s) => s.id === S.section));
  }

  function buildShell(root) {
    root.innerHTML = '';
    refs.status = el('div', { class: 'ed-status' });
    const header = el('header', { id: 'ed-header' },
      el('div', { class: 'ed-logo' }, el('b', { text: (cfg().title || 'ガチャモン') }), el('span', { text: 'データエディタ' })),
      refs.status,
      el('div', { class: 'ed-actions' },
        btn('検証', showReport, 'btn-sm', { id: 'ed-btn-validate', title: 'データの参照切れ・重複などをチェック' }),
        btn('ゲームに一時反映', () => applyToGame(), 'btn-sm btn-gold', { id: 'ed-btn-apply', title: 'このブラウザのゲームに反映（Ctrl+S）' }),
        btn('一時反映を解除', clearGameOverride, 'btn-sm', { id: 'ed-btn-clear' }),
        btn('JSファイルを書き出し', openExport, 'btn-sm btn-primary', { id: 'ed-btn-export' }),
        el('a', { class: 'btn btn-sm btn-ghost', href: 'index.html', target: '_blank', rel: 'noopener', text: 'ゲームを開く ↗' })));
    refs.navBtns = {};
    const nav = el('nav', { id: 'ed-nav' });
    SECTIONS.forEach((sec) => {
      const b = el('button', { class: 'ed-navbtn', type: 'button', text: sec.label, dataset: { sec: sec.id }, onclick: () => showSection(sec.id) });
      refs.navBtns[sec.id] = b;
      nav.appendChild(b);
    });
    refs.main = el('main', { id: 'ed-main' });
    root.append(header, nav, refs.main);
  }

  function showSection(id) {
    if (!RENDER[id]) id = 'monsters';
    S.section = id;
    try { localStorage.setItem('gachamon_editor_section', id); } catch (e) { /* 無視 */ }
    Object.keys(refs.navBtns).forEach((k) => refs.navBtns[k].classList.toggle('is-active', k === id));
    refs.main.innerHTML = '';
    refs.revertBtn = null;
    try {
      RENDER[id](refs.main);
    } catch (e) {
      console.error('[editor] セクションの表示に失敗', e);
      refs.main.appendChild(el('div', { class: 'ed-fatal', text: 'この画面の表示中にエラーが発生しました: ' + e.message }));
    }
    updateStatus();
  }
  function rerender() { showSection(S.section); }

  // セクション見出しの「ファイルの状態に戻す」ボタン
  function revertButton(secId) {
    const sec = SECTIONS.find((s) => s.id === secId);
    const b = btn('ファイルの状態に戻す', async () => {
      const ok = await confirmBox('「' + sec.label + '」の編集内容をすべて取り消して、data/*.js の状態に戻しますか？', { ok: '元に戻す', danger: true });
      if (!ok) return;
      sec.keys.forEach((k) => { G()[k] = clone(S.snap[k]); });
      toast(sec.label + ' をファイルの状態に戻しました', 'success');
      rerender();
    }, 'btn-sm btn-ghost', { title: 'このセクションの変更を取り消す' });
    refs.revertBtn = b;
    return b;
  }

  // ==================================================================
  // 参照の検索・置換（ID変更・削除用）
  // ==================================================================
  function monsterRefs(id) {
    const out = [];
    const tr = trainersObj();
    Object.keys(tr).forEach((tid) => {
      const t = tr[tid];
      (t && Array.isArray(t.party) ? t.party : []).forEach((p, i) => { if (p && p.species === id) out.push('トレーナー ' + tid + '（' + (t.name || '') + '）の手持ち ' + (i + 1) + '番目'); });
    });
    const maps = mapsObj();
    Object.keys(maps).forEach((mid) => {
      const m = maps[mid];
      const table = m && m.encounters && Array.isArray(m.encounters.table) ? m.encounters.table : [];
      table.forEach((e) => { if (e && e.species === id) out.push('マップ ' + mid + '（' + (m.name || '') + '）の野生モンスター'); });
    });
    (Array.isArray(gachaObj().banners) ? gachaObj().banners : []).forEach((b) => {
      if (!b) return;
      if (Array.isArray(b.pool) && b.pool.includes(id)) out.push('バナー ' + b.id + ' の pool（対象モンスター）');
      if (Array.isArray(b.pickup) && b.pickup.includes(id)) out.push('バナー ' + b.id + ' の pickup');
    });
    return out;
  }
  // newId = null なら参照を取り除く
  function replaceMonsterRefs(oldId, newId) {
    const tr = trainersObj();
    Object.keys(tr).forEach((tid) => {
      const t = tr[tid];
      if (!t || !Array.isArray(t.party)) return;
      if (newId) t.party.forEach((p) => { if (p && p.species === oldId) p.species = newId; });
      else t.party = t.party.filter((p) => !(p && p.species === oldId));
    });
    const maps = mapsObj();
    Object.keys(maps).forEach((mid) => {
      const enc = maps[mid] && maps[mid].encounters;
      if (!enc || !Array.isArray(enc.table)) return;
      if (newId) enc.table.forEach((e) => { if (e && e.species === oldId) e.species = newId; });
      else enc.table = enc.table.filter((e) => !(e && e.species === oldId));
    });
    (Array.isArray(gachaObj().banners) ? gachaObj().banners : []).forEach((b) => {
      if (!b) return;
      ['pool', 'pickup'].forEach((k) => {
        if (!Array.isArray(b[k])) return;
        b[k] = newId ? b[k].map((x) => (x === oldId ? newId : x)) : b[k].filter((x) => x !== oldId);
      });
    });
  }
  // 参照がある場合の確認ダイアログ → 'with' | 'only' | null
  function askRefs(title, lead, refsList, withLabel, onlyLabel) {
    const body = el('div', {},
      el('p', { text: lead }),
      el('ul', { class: 'ed-msglist' }, refsList.slice(0, 60).map((t) => el('li', { class: 'w', text: t }))),
      refsList.length > 60 ? el('p', { class: 'muted small', text: '…ほか ' + (refsList.length - 60) + ' 件' }) : null);
    return modal({
      title, body,
      buttons: [
        { label: 'キャンセル', value: null },
        { label: onlyLabel, value: 'only' },
        { label: withLabel, value: 'with', cls: 'btn-primary', id: 'ed-refs-with' },
      ],
    });
  }

  // ==================================================================
  // モンスター
  // ==================================================================
  const Mon = {};

  Mon.render = function (main) {
    const mons = monsterList();
    if (!S.sel.monster || !monById(S.sel.monster)) S.sel.monster = mons.length ? monsSorted()[0].id : null;
    main.appendChild(sectionHead('モンスター',
      revertButton('monsters'),
      btn('＋ 新規追加', Mon.create, 'btn-gold btn-sm', { id: 'ed-mon-new' })));
    const f = S.filter.monster;
    const search = inputText(f.q, (v) => { f.q = v; Mon.renderList(); }, { placeholder: '名前・ID・No・分類で検索' });
    const rsel = selectBox(rarityOptions(true, 'すべてのレア度'), f.rarity, (v) => { f.rarity = v; Mon.renderList(); });
    const tsel = selectBox(typeOptions(true).map((o) => (o.v === '' ? { v: '', label: 'すべてのタイプ' } : o)), f.type, (v) => { f.type = v; Mon.renderList(); });
    refs.monList = el('div', { class: 'ed-list', id: 'ed-mon-list' });
    refs.monCount = el('div', { class: 'ed-listcount' });
    refs.monForm = el('div', { class: 'ed-formpane', id: 'ed-mon-form' });
    main.appendChild(el('div', { class: 'ed-split' },
      el('div', { class: 'ed-listpane' },
        el('div', { class: 'ed-listtools' }, search, el('div', { class: 'ed-row nowrap' }, el('div', { class: 'grow' }, rsel), el('div', { class: 'grow' }, tsel))),
        refs.monList, refs.monCount),
      refs.monForm));
    Mon.renderList();
    Mon.renderForm();
  };

  Mon.filtered = function () {
    const f = S.filter.monster;
    const q = f.q.trim().toLowerCase();
    return monsSorted().filter((m) => {
      if (f.rarity && m.rarity !== f.rarity) return false;
      if (f.type && !(Array.isArray(m.types) && m.types.includes(f.type))) return false;
      if (q) {
        const hay = [m.id, m.name, String(m.no), pad3(m.no), m.category].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  Mon.item = function (m) {
    return el('div', {
      class: 'ed-item' + (m.id === S.sel.monster ? ' is-selected' : ''), dataset: { id: m.id },
      onclick: () => { S.sel.monster = m.id; Mon.markSelected(); Mon.renderForm(); },
    },
    spriteImg(m, 'front', 'thumb'),
    el('div', { class: 'meta' },
      el('div', { class: 't1' }, el('span', { class: 'num', text: 'No.' + pad3(m.no) }), el('b', { text: m.name || '（名前なし）' })),
      el('div', { class: 't2' }, rarBadge(m.rarity), (Array.isArray(m.types) ? m.types : []).map(typeBadge), el('span', { text: m.id }))));
  };

  Mon.renderList = function () {
    if (!refs.monList) return;
    const list = Mon.filtered();
    refs.monList.innerHTML = '';
    if (!list.length) refs.monList.appendChild(el('div', { class: 'ed-empty', text: '該当するモンスターがいません' }));
    list.forEach((m) => refs.monList.appendChild(Mon.item(m)));
    refs.monCount.textContent = list.length + ' / ' + monsterList().length + ' 体';
  };
  Mon.markSelected = function () {
    refs.monList.querySelectorAll('.ed-item').forEach((n) => n.classList.toggle('is-selected', n.dataset.id === S.sel.monster));
  };
  // 選択中モンスターの一覧項目だけ差し替え
  Mon.refreshItem = function (m, oldId) {
    if (!refs.monList) return;
    const node = refs.monList.querySelector('.ed-item[data-id="' + CSS.escape(oldId || m.id) + '"]');
    if (node) node.replaceWith(Mon.item(m));
  };

  Mon.renderForm = function () {
    const box = refs.monForm;
    if (!box) return;
    box.innerHTML = '';
    const m = monById(S.sel.monster);
    if (!m) { box.appendChild(el('div', { class: 'card ed-empty', text: 'モンスターを選ぶか「＋ 新規追加」してください' })); return; }
    if (!isObj(m.baseStats)) m.baseStats = {};
    if (!Array.isArray(m.learnset)) m.learnset = [];
    if (!Array.isArray(m.types)) m.types = [];

    const changed = (opts) => {
      opts = opts || {};
      touched();
      Mon.refreshItem(m);
      Mon.refreshHead(m);
      if (opts.preview) Mon.refreshPreview(m);
    };

    // ---- 見出し
    refs.monHead = el('div', { class: 'ed-formhead' });
    box.appendChild(refs.monHead);
    Mon.refreshHead(m);

    // ---- 基本情報
    const idInput = inputText(m.id, null, { class: 'input mono', id: 'ed-mon-id' });
    const idField = field('ID（英小文字・数字・_）', idInput, { req: true, hint: 'セーブデータ・トレーナー・マップが参照します' });
    idInput.addEventListener('change', () => Mon.rename(m, idInput, idField));
    const noInput = inputNum(m.no, (v, i) => {
      m.no = v === undefined ? undefined : Math.floor(v);
      if (m.no === undefined) delete m.no;
      const dup = monsterList().some((o) => o !== m && o && o.no === m.no);
      i.classList.toggle('is-bad', dup || m.no === undefined);
      noField._hint.textContent = dup ? 'この図鑑番号は ほかのモンスターが使っています' : '図鑑はこの順に並びます';
      noField._hint.classList.toggle('ng', dup);
      changed();
    }, { min: 1, step: 1, id: 'ed-mon-no' });
    const noField = field('図鑑番号 No', noInput, { req: true, hint: '図鑑はこの順に並びます' });
    const typeSel1 = selectBox(typeOptions(false), m.types[0], (v) => { m.types[0] = v; m.types = m.types.filter(Boolean); changed({ preview: true }); });
    const typeSel2 = selectBox(typeOptions(true), m.types[1] || '', (v) => {
      if (v) m.types[1] = v; else m.types.splice(1, 1);
      m.types = m.types.filter(Boolean);
      changed({ preview: true });
    });
    box.appendChild(card('基本情報',
      el('div', { class: 'ed-grid' },
        idField, noField,
        field('名前', inputText(m.name, (v) => { m.name = v; changed(); }, { id: 'ed-mon-name' }), { req: true }),
        field('レア度', selectBox(rarityOptions(false), m.rarity, (v) => { m.rarity = v; changed({ preview: true }); Mon.refreshStatGuide(m); }, { id: 'ed-mon-rarity' }), { req: true }),
        field('タイプ1', typeSel1, { req: true }),
        field('タイプ2', typeSel2),
        field('経験値タイプ', selectBox(EXP_GROUPS.map((g) => ({ v: g.v, label: g.label })), m.expGroup || 'medium_fast', (v) => { m.expGroup = v; changed(); })),
        field('基礎経験値 baseExp', inputNum(m.baseExp, (v) => { setOpt(m, 'baseExp', v); changed(); }, { min: 1 })),
        field('分類 category', inputText(m.category, (v) => { setOpt(m, 'category', v); changed(); }, { placeholder: '〇〇モンスター' })),
        field('高さ height（m）', inputNum(m.height, (v) => { setOpt(m, 'height', v); changed(); }, { min: 0, step: 0.1 })),
        field('重さ weight（kg）', inputNum(m.weight, (v) => { setOpt(m, 'weight', v); changed(); }, { min: 0, step: 0.1 })),
        field('ガチャ', checkBox('ガチャに登場する', m.gacha !== false, (c) => { m.gacha = c; changed(); })),
        field('図鑑の説明 desc', textArea(m.desc, (v) => { m.desc = v; changed(); }, { rows: 2 }), { cls: 'span-all' }))));

    // ---- 種族値
    box.appendChild(Mon.statsCard(m, changed));
    // ---- 覚えるわざ
    refs.learnWrap = el('div');
    box.appendChild(card(el('span', { text: '覚えるわざ learnset' }), el('p', { class: 'ed-hint', text: 'lv: 1 のわざを最低1つ入れてください（ガチャで入手した直後に使うため）。わざの詳細は「わざ」タブで編集できます。' }), refs.learnWrap));
    Mon.renderLearnset(m, changed);
    // ---- 見た目
    box.appendChild(Mon.lookCard(m, changed));
  };

  Mon.refreshHead = function (m) {
    const h = refs.monHead;
    if (!h) return;
    h.innerHTML = '';
    put(h, 
      spriteImg(m, 'front', 'thumb'),
      el('h3', { text: 'No.' + pad3(m.no) + ' ' + (m.name || '（名前なし）') }),
      rarBadge(m.rarity), (m.types || []).map(typeBadge),
      el('span', { class: 'ed-spacer' }),
      btn('複製', () => Mon.duplicate(m), 'btn-sm', { id: 'ed-mon-dup' }),
      btn('削除', () => Mon.remove(m), 'btn-sm btn-danger', { id: 'ed-mon-del' }));
    const img = h.querySelector('img');
    img.style.cssText = 'width:56px;height:56px;image-rendering:pixelated;background:rgba(0,0,0,.25);border-radius:10px';
  };

  Mon.rename = async function (m, input, fieldEl) {
    const newId = input.value.trim();
    const oldId = m.id;
    const setHint = (t, bad) => { fieldEl._hint.textContent = t; fieldEl._hint.classList.toggle('ng', !!bad); input.classList.toggle('is-bad', !!bad); };
    if (newId === oldId) { setHint('セーブデータ・トレーナー・マップが参照します'); return; }
    if (!ID_RE.test(newId)) { setHint('英小文字・数字・_ だけにしてください（変更は反映されていません）', true); return; }
    if (monById(newId)) { setHint('この ID は ほかのモンスターが使っています（変更は反映されていません）', true); return; }
    const rl = monsterRefs(oldId);
    let mode = 'only';
    if (rl.length) {
      mode = await askRefs('IDの変更', '「' + oldId + '」を参照しているデータがあります。新しい ID「' + newId + '」に書き換えますか？', rl, '参照も書き換える', 'IDだけ変える');
      if (!mode) { input.value = oldId; return; }
    }
    m.id = newId;
    if (mode === 'with') replaceMonsterRefs(oldId, newId);
    S.sel.monster = newId;
    setHint('ID を変更しました' + (mode === 'with' ? '（参照 ' + rl.length + ' 件も変更）' : ''));
    Mon.refreshItem(m, oldId);
    touched();
    toast('ID を ' + oldId + ' → ' + newId + ' に変更しました', 'success');
  };

  Mon.statsCard = function (m, changed) {
    const maxStat = 180;
    const rows = STATS.map((st) => {
      const bar = el('i');
      const upd = () => {
        const v = Number(m.baseStats[st.k]) || 0;
        bar.style.width = Math.min(100, v / maxStat * 100) + '%';
        bar.style.background = v >= 120 ? '#3ee08f' : v >= 90 ? '#52dcff' : v >= 60 ? '#ffd84d' : '#ff9a3c';
      };
      upd();
      const input = inputNum(m.baseStats[st.k], (v, i) => {
        if (v === undefined) delete m.baseStats[st.k]; else m.baseStats[st.k] = Math.floor(v);
        i.classList.toggle('is-bad', !(v > 0));
        upd();
        Mon.refreshStatGuide(m);
        changed({ preview: false });
      }, { min: 1, max: 255, step: 1, dataset: { stat: st.k } });
      return el('tr', {}, el('th', { text: st.label + '（' + st.k + '）' }), el('td', { class: 'w-num' }, input), el('td', { class: 'bar' }, el('div', { class: 'ed-statbar' }, bar)));
    });
    refs.statGuide = el('div', { class: 'ed-total' });
    const c = card('種族値 baseStats', el('table', { class: 'ed-table ed-stats' }, el('tbody', {}, rows)), refs.statGuide);
    Mon.refreshStatGuide(m);
    return c;
  };
  Mon.refreshStatGuide = function (m) {
    const g = refs.statGuide;
    if (!g) return;
    const total = STATS.reduce((s, st) => s + (Number(m.baseStats[st.k]) || 0), 0);
    const guide = STAT_GUIDE[m.rarity];
    g.innerHTML = '';
    g.append(el('span', { text: '合計' }), el('b', { id: 'ed-mon-total', text: String(total) }));
    if (guide) {
      const low = total < guide[0], high = total > guide[1];
      g.append(el('span', { class: 'muted', text: m.rarity + ' の目安 ' + guide[0] + '〜' + guide[1] }),
        el('span', { class: 'chip ' + (low || high ? 'chip-warn' : 'chip-ok'), text: low ? '目安より低め' : high ? '目安より高め' : '目安の範囲内' }));
    }
  };

  Mon.renderLearnset = function (m, changed) {
    const wrap = refs.learnWrap;
    wrap.innerHTML = '';
    const ls = m.learnset;
    const maxLv = cfg().maxLevel || 100;
    const redraw = () => { Mon.renderLearnset(m, changed); changed(); };
    const tbody = el('tbody');
    ls.forEach((l, i) => {
      if (!isObj(l)) return;
      const mv = movesObj()[l.move];
      const info = el('span', { class: 'ed-row' });
      const fillInfo = () => {
        const d = movesObj()[l.move];
        info.innerHTML = '';
        if (!d) { info.append(el('span', { class: 'ng small', text: 'わざが見つかりません' })); return; }
        info.append(typeBadge(d.type), el('span', { class: 'small dim', text: catLabel(d.category) + (d.category !== 'status' ? ' 威力' + (d.power || 0) : '') + ' 命中' + (d.accuracy === 0 ? '必中' : (d.accuracy === undefined ? '-' : d.accuracy)) }));
      };
      fillInfo();
      const lvInput = inputNum(l.lv, (v, inp) => {
        l.lv = v === undefined ? undefined : Math.floor(v);
        if (l.lv === undefined) delete l.lv;
        inp.classList.toggle('is-bad', !(l.lv >= 1 && l.lv <= maxLv));
        changed();
      }, { min: 1, max: maxLv, step: 1, style: 'width:80px' });
      const mvSel = selectBox(moveOptions(false), l.move, (v) => { l.move = v; fillInfo(); changed(); });
      tbody.appendChild(el('tr', { class: mv ? '' : 'is-bad' },
        el('td', { class: 'w-num' }, lvInput),
        el('td', {}, mvSel),
        el('td', {}, info),
        el('td', { class: 'w-ops' },
          iconBtn('↑', '上へ', () => { [ls[i - 1], ls[i]] = [ls[i], ls[i - 1]]; redraw(); }, i === 0),
          iconBtn('↓', '下へ', () => { [ls[i + 1], ls[i]] = [ls[i], ls[i + 1]]; redraw(); }, i === ls.length - 1),
          iconBtn('✕', '削除', () => { ls.splice(i, 1); redraw(); }))));
    });
    put(wrap, 
      el('table', { class: 'ed-table' }, el('thead', {}, el('tr', {}, el('th', { text: 'Lv' }), el('th', { text: 'わざ' }), el('th', { text: '内容' }), el('th', {}))), tbody),
      el('div', { class: 'ed-row', style: 'margin-top:8px' },
        btn('＋ わざを追加', () => {
          const last = ls.length ? (Number(ls[ls.length - 1].lv) || 1) : 1;
          const first = Object.keys(movesObj())[0];
          ls.push({ lv: ls.length ? Math.min(maxLv, last + 5) : 1, move: (ls.length ? ls[ls.length - 1].move : first) || first });
          redraw();
        }, 'btn-sm', { id: 'ed-learn-add' }),
        btn('レベル順に並べ替え', () => { ls.sort((a, b) => (Number(a.lv) || 0) - (Number(b.lv) || 0)); redraw(); }, 'btn-sm btn-ghost'),
        el('span', { class: 'small ' + (ls.some((l) => l && l.lv === 1 && movesObj()[l.move]) ? 'ok' : 'ng'), text: ls.some((l) => l && l.lv === 1 && movesObj()[l.move]) ? '✓ lv1 のわざあり' : '✖ lv1 のわざがありません' })));
  };

  // ---- 見た目（画像・自動生成）
  Mon.lookCard = function (m, changed) {
    refs.monPreview = el('div', { class: 'ed-preview-row' });
    const sp = () => { if (!isObj(m.sprite)) m.sprite = {}; return m.sprite; };
    const cleanSprite = () => { if (isObj(m.sprite) && !Object.keys(m.sprite).length) delete m.sprite; };
    const spriteChanged = () => { cleanSprite(); changed({ preview: true }); };
    const s0 = isObj(m.sprite) ? m.sprite : {};

    const shapeSel = selectBox([{ v: '', label: '（自動: シードから決定）' }].concat(SHAPES), s0.shape || '', (v) => { setOpt(sp(), 'shape', v); spriteChanged(); }, { id: 'ed-mon-shape' });
    const colorsWrap = el('div', { class: 'ed-colors' });
    const renderColors = () => {
      colorsWrap.innerHTML = '';
      const cur = isObj(m.sprite) && Array.isArray(m.sprite.colors) ? m.sprite.colors : null;
      colorsWrap.appendChild(checkBox('色を指定する', !!cur, (c) => {
        if (c) {
          const tc = (m.types || []).map((t) => (typesObj()[t] || {}).color).filter(Boolean);
          sp().colors = [colorValue(tc[0], '#f08030'), colorValue(tc[1] || '#f8f0c8'), '#503020'];
        } else if (isObj(m.sprite)) delete m.sprite.colors;
        renderColors();
        spriteChanged();
      }));
      if (cur) {
        ['メイン', 'サブ', 'アクセント'].forEach((lbl, i) => {
          colorsWrap.appendChild(el('span', { class: 'ed-row nowrap small dim' }, lbl, colorInput(cur[i], (v) => { cur[i] = v; spriteChanged(); })));
        });
      } else colorsWrap.appendChild(el('span', { class: 'ed-hint', text: '指定しない場合はタイプの色から自動で決まります' }));
    };
    renderColors();
    const seedInput = inputNum(s0.seed, (v) => { setOpt(sp(), 'seed', v === undefined ? undefined : Math.floor(v)); spriteChanged(); }, { min: 0, step: 1, id: 'ed-mon-seed', style: 'width:120px' });
    const seedRow = el('div', { class: 'ed-row nowrap' }, seedInput,
      btn('ランダム', () => { const v = 1 + Math.floor(Math.random() * 99999); seedInput.value = v; sp().seed = v; spriteChanged(); }, 'btn-sm', { id: 'ed-mon-seed-rand' }),
      btn('0 に戻す', () => { seedInput.value = ''; if (isObj(m.sprite)) delete m.sprite.seed; spriteChanged(); }, 'btn-sm btn-ghost'));

    const c = card('見た目（画像・自動生成ドット絵）',
      refs.monPreview,
      el('div', { class: 'ed-grid cols-2', style: 'margin-top:12px' },
        Mon.imageField(m, 'image', '正面画像 image', changed),
        Mon.imageField(m, 'backImage', '背面画像 backImage', changed)),
      el('p', { class: 'ed-hint', text: '画像を指定しない場合（空欄）は、下の設定から自動生成したドット絵を使います。背面画像が空欄なら正面画像を左右反転して使います。' }),
      el('div', { class: 'ed-grid', style: 'margin-top:8px' },
        field('体型 sprite.shape', shapeSel),
        field('シード sprite.seed', seedRow, { hint: '数字を変えると同じ体型・色のまま模様などが変わります' }),
        field('色 sprite.colors', colorsWrap, { cls: 'span-all' })));
    Mon.refreshPreview(m);
    return c;
  };

  Mon.refreshPreview = function (m) {
    const p = refs.monPreview;
    if (!p) return;
    p.innerHTML = '';
    const hasImg = !!(m.image && String(m.image).trim());
    const hasBack = !!(m.backImage && String(m.backImage).trim());
    const box = (img, cap) => el('div', { class: 'ed-sprite-box' }, img, el('span', { class: 'cap', text: cap }));
    put(p, 
      box(spriteImg(m, 'front'), hasImg ? '正面（画像）' : '正面（自動生成）'),
      box(spriteImg(m, 'back'), hasBack ? '背面（画像）' : (hasImg ? '背面（正面を反転）' : '背面（自動生成）')));
    if (hasImg || hasBack) {
      put(p, 
        box(el('img', { src: autoSpriteSrc(m, 'front'), alt: '' }), '自動生成 正面（参考）'),
        box(el('img', { src: autoSpriteSrc(m, 'back'), alt: '' }), '自動生成 背面（参考）'));
    }
  };

  Mon.imageField = function (m, key, label, changed) {
    const wrap = el('div', { class: 'ed-field ed-imgfield' });
    const fileInput = el('input', { type: 'file', accept: 'image/png,image/gif,image/webp,image/jpeg', hidden: true });
    const render = () => {
      wrap.innerHTML = '';
      const v = typeof m[key] === 'string' ? m[key] : '';
      const isData = v.startsWith('data:');
      const row = el('div', { class: 'ed-row' });
      if (isData) {
        row.append(el('span', { class: 'chip chip-info grow', text: '埋め込み画像（' + Math.max(1, Math.round(v.length / 1024)) + ' KB）' }));
      } else {
        row.append(el('div', { class: 'grow' }, inputText(v, (val) => { m[key] = val.trim(); changed({ preview: true }); }, { class: 'input mono', placeholder: 'assets/monsters/xxx.png（空欄 = 自動生成）', dataset: { img: key } })));
      }
      put(row, 
        btn('ファイル選択…', () => fileInput.click(), 'btn-sm'),
        btn('クリア', () => { m[key] = ''; render(); changed({ preview: true }); }, 'btn-sm btn-ghost', { disabled: !v }));
      wrap.append(el('label', { text: label }), row, fileInput);
      if (!isData && v && S.localPreview[v]) wrap.append(el('div', { class: 'ed-hint warn', text: 'プレビューは選択したファイルです。ゲームで表示するには ' + v + ' にファイルを置いてください。' }));
    };
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const path = 'assets/monsters/' + file.name;
      const choice = await modal({
        title: '画像の設定方法',
        body: el('div', {},
          el('p', { text: '選択したファイル: ' + file.name + '（' + Math.max(1, Math.round(file.size / 1024)) + ' KB）' }),
          el('p', {}, el('b', { text: 'パスを設定: ' }), path + ' と書き込みます。ゲームで表示するには、このファイルを assets/monsters/ フォルダにコピーしてください（おすすめ）。'),
          el('p', {}, el('b', { text: 'データURLとして埋め込む: ' }), '画像そのものをデータに書き込みます。ファイルのコピーは不要ですが、データが大きくなります（一時反映の保存容量は数MBまで）。')),
        buttons: [
          { label: 'キャンセル', value: null },
          { label: 'データURLとして埋め込む', value: 'data' },
          { label: path + ' のパスを設定', value: 'path', cls: 'btn-primary' },
        ],
      });
      if (!choice) return;
      if (choice === 'path') {
        if (S.localPreview[path]) URL.revokeObjectURL(S.localPreview[path]);
        S.localPreview[path] = URL.createObjectURL(file);
        m[key] = path;
        render();
        changed({ preview: true });
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          m[key] = String(reader.result || '');
          if (file.size > 300 * 1024) toast('画像が大きいため、一時反映の保存容量を超える可能性があります', 'warn', 4000);
          render();
          changed({ preview: true });
        };
        reader.onerror = () => toast('ファイルを読み込めませんでした', 'error');
        reader.readAsDataURL(file);
      }
    });
    render();
    return wrap;
  };

  // ---- 新規・複製・削除
  function freeNo() {
    const used = new Set(monsterList().map((m) => m && m.no));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  }
  function defaultStats(rarity) {
    const g = STAT_GUIDE[rarity] || [300, 300];
    const v = Math.round((g[0] + g[1]) / 2 / 6);
    const o = {};
    STATS.forEach((s) => { o[s.k] = v; });
    return o;
  }

  Mon.create = async function () {
    const no = freeNo();
    const vals = { id: uniqueId('mon' + pad3(no), (id) => !!monById(id)), no, name: '', rarity: rarityIds()[0] || 'N', type: Object.keys(typesObj())[0] || 'normal' };
    const idIn = inputText(vals.id, (v) => { vals.id = v.trim(); }, { class: 'input mono', id: 'ed-new-id' });
    const hint = el('div', { class: 'ed-hint' });
    const body = el('div', { class: 'ed-grid cols-2' },
      field('ID（英小文字・数字・_）', idIn, { req: true }),
      field('図鑑番号 No（空き番号を提案）', inputNum(no, (v) => { vals.no = v; }, { min: 1, step: 1, id: 'ed-new-no' }), { req: true }),
      field('名前', inputText('', (v) => { vals.name = v; }, { id: 'ed-new-name', placeholder: '例: モフリン' }), { req: true }),
      field('レア度', selectBox(rarityOptions(false), vals.rarity, (v) => { vals.rarity = v; })),
      field('タイプ', selectBox(typeOptions(false), vals.type, (v) => { vals.type = v; })),
      el('div', { class: 'ed-field span-all' }, hint));
    const ok = await modal({
      title: 'モンスターを新規追加', body,
      buttons: [{ label: 'キャンセル', value: false }, {
        label: '追加する', value: true, cls: 'btn-primary', id: 'ed-new-ok',
        check: () => {
          let msg = '';
          if (!ID_RE.test(vals.id)) msg = 'ID は英小文字・数字・_ だけにしてください';
          else if (monById(vals.id)) msg = 'この ID は既に使われています';
          else if (!(Number.isInteger(vals.no) && vals.no > 0)) msg = '図鑑番号は 1 以上の整数にしてください';
          else if (monsterList().some((x) => x && x.no === vals.no)) msg = 'この図鑑番号は既に使われています';
          hint.textContent = msg;
          hint.classList.toggle('ng', !!msg);
          return !msg;
        },
      }],
    });
    if (!ok) return;
    const firstMove = hasOwn(movesObj(), 'tackle') ? 'tackle' : Object.keys(movesObj())[0];
    const m = {
      id: vals.id, no: vals.no, name: vals.name || ('モンスター' + vals.no), rarity: vals.rarity, types: [vals.type],
      baseStats: defaultStats(vals.rarity),
      learnset: firstMove ? [{ lv: 1, move: firstMove }] : [],
      expGroup: 'medium_fast', baseExp: 60, image: '', backImage: '',
      sprite: { shape: SHAPES[Math.floor(Math.random() * SHAPES.length)].v, seed: 1 + Math.floor(Math.random() * 99999) },
      gacha: true, category: '', height: 1.0, weight: 10.0, desc: '',
    };
    if (!Array.isArray(G().monsters)) G().monsters = [];
    G().monsters.push(m);
    S.sel.monster = m.id;
    S.filter.monster = { q: '', rarity: '', type: '' };
    touched();
    rerender();
    toast('「' + m.name + '」を追加しました', 'success');
  };

  Mon.duplicate = function (src) {
    const m = clone(src);
    m.id = uniqueId(src.id + '_copy', (id) => !!monById(id));
    m.no = freeNo();
    m.name = (src.name || '') + 'コピー';
    G().monsters.push(m);
    S.sel.monster = m.id;
    touched();
    rerender();
    toast('「' + src.name + '」を複製しました（ID: ' + m.id + '）', 'success');
  };

  Mon.remove = async function (m) {
    const rl = monsterRefs(m.id);
    let mode;
    if (rl.length) {
      mode = await askRefs('モンスターの削除', '「' + (m.name || m.id) + '」を参照しているデータがあります。削除すると参照切れ（検証エラー）になります。', rl, '参照も取り除いて削除', '削除する（参照は残す）');
      if (!mode) return;
    } else {
      const ok = await confirmBox('「' + (m.name || m.id) + '」（' + m.id + '）を削除しますか？\n※ すでにプレイ中のセーブデータに このモンスターがいる場合、ゲーム側で表示されなくなります。', { ok: '削除する', danger: true });
      if (!ok) return;
    }
    if (mode === 'with') replaceMonsterRefs(m.id, null);
    G().monsters = monsterList().filter((x) => x !== m);
    S.sel.monster = null;
    touched();
    rerender();
    toast('「' + (m.name || m.id) + '」を削除しました', 'success');
  };

  // ==================================================================
  // わざ
  // ==================================================================
  const Mv = {};

  function moveUsers(id) {
    const out = [];
    monsterList().forEach((m) => {
      if (!m || !Array.isArray(m.learnset)) return;
      const hit = m.learnset.filter((l) => l && l.move === id);
      if (hit.length) out.push({ m, lv: hit.map((l) => l.lv) });
    });
    return out;
  }
  function moveRefs(id) {
    const out = moveUsers(id).map((u) => 'モンスター ' + u.m.id + '（' + (u.m.name || '') + '）の learnset Lv' + u.lv.join(','));
    const tr = trainersObj();
    Object.keys(tr).forEach((tid) => {
      const t = tr[tid];
      (t && Array.isArray(t.party) ? t.party : []).forEach((p, i) => {
        if (p && Array.isArray(p.moves) && p.moves.includes(id)) out.push('トレーナー ' + tid + ' の手持ち ' + (i + 1) + '番目のわざ');
      });
    });
    return out;
  }
  function replaceMoveRefs(oldId, newId) {
    monsterList().forEach((m) => {
      if (!m || !Array.isArray(m.learnset)) return;
      if (newId) m.learnset.forEach((l) => { if (l && l.move === oldId) l.move = newId; });
      else m.learnset = m.learnset.filter((l) => !(l && l.move === oldId));
    });
    const tr = trainersObj();
    Object.keys(tr).forEach((tid) => {
      (tr[tid] && Array.isArray(tr[tid].party) ? tr[tid].party : []).forEach((p) => {
        if (!p || !Array.isArray(p.moves)) return;
        p.moves = newId ? p.moves.map((x) => (x === oldId ? newId : x)) : p.moves.filter((x) => x !== oldId);
        if (!p.moves.length) delete p.moves;
      });
    });
  }
  function effectText(ef) {
    if (!isObj(ef)) return '?';
    const ch = ef.chance !== undefined && ef.chance < 100 ? ef.chance + '% で ' : '';
    const lab = (list, v) => { const x = list.find((o) => o.v === v); return x ? x.label : v; };
    switch (ef.kind) {
      case 'stat': return ch + (ef.target === 'self' ? '自分' : '相手') + 'の ' + lab(EFFECT_STATS, ef.stat) + ' を ' + Math.abs(ef.stages || 0) + '段階 ' + ((ef.stages || 0) > 0 ? 'あげる' : 'さげる');
      case 'status': return ch + '相手を ' + lab(STATUSES, ef.status) + ' にする';
      case 'heal': return '自分の最大HPの ' + Math.round((ef.ratio || 0) * 100) + '% を回復';
      case 'drain': return '与えたダメージの ' + Math.round((ef.ratio || 0) * 100) + '% を回復';
      case 'recoil': return '与えたダメージの ' + Math.round((ef.ratio || 0) * 100) + '% の反動をうける';
      case 'flinch': return (ef.chance !== undefined ? ef.chance + '% で ' : '') + '相手を ひるませる';
      case 'multihit': return (ef.min || '?') + '〜' + (ef.max || '?') + '回 連続で攻撃';
      default: return '未知の効果 ' + ef.kind;
    }
  }
  const EFFECT_DEFAULTS = {
    stat: () => ({ kind: 'stat', target: 'foe', stat: 'atk', stages: -1 }),
    status: () => ({ kind: 'status', status: 'burn', chance: 10 }),
    heal: () => ({ kind: 'heal', ratio: 0.5 }),
    drain: () => ({ kind: 'drain', ratio: 0.5 }),
    recoil: () => ({ kind: 'recoil', ratio: 0.25 }),
    flinch: () => ({ kind: 'flinch', chance: 30 }),
    multihit: () => ({ kind: 'multihit', min: 2, max: 5 }),
  };

  Mv.render = function (main) {
    const ids = Object.keys(movesObj());
    if (!S.sel.move || !hasOwn(movesObj(), S.sel.move)) S.sel.move = ids[0] || null;
    main.appendChild(sectionHead('わざ', revertButton('moves'), btn('＋ 新規追加', Mv.create, 'btn-gold btn-sm', { id: 'ed-move-new' })));
    const f = S.filter.move;
    const search = inputText(f.q, (v) => { f.q = v; Mv.renderList(); }, { placeholder: '名前・IDで検索' });
    const tsel = selectBox(typeOptions(true).map((o) => (o.v === '' ? { v: '', label: 'すべてのタイプ' } : o)), f.type, (v) => { f.type = v; Mv.renderList(); });
    const csel = selectBox([{ v: '', label: 'すべての分類' }].concat(CATEGORIES), f.category, (v) => { f.category = v; Mv.renderList(); });
    refs.mvList = el('div', { class: 'ed-list', id: 'ed-move-list' });
    refs.mvCount = el('div', { class: 'ed-listcount' });
    refs.mvForm = el('div', { class: 'ed-formpane' });
    main.appendChild(el('div', { class: 'ed-split' },
      el('div', { class: 'ed-listpane' },
        el('div', { class: 'ed-listtools' }, search, el('div', { class: 'ed-row nowrap' }, el('div', { class: 'grow' }, tsel), el('div', { class: 'grow' }, csel))),
        refs.mvList, refs.mvCount),
      refs.mvForm));
    Mv.renderList();
    Mv.renderForm();
  };

  Mv.usage = function () {
    const cnt = {};
    monsterList().forEach((m) => {
      if (!m || !Array.isArray(m.learnset)) return;
      new Set(m.learnset.map((l) => l && l.move)).forEach((id) => { cnt[id] = (cnt[id] || 0) + 1; });
    });
    return cnt;
  };
  Mv.item = function (id, usage) {
    const mv = movesObj()[id] || {};
    const n = usage[id] || 0;
    return el('div', {
      class: 'ed-item' + (id === S.sel.move ? ' is-selected' : ''), dataset: { id },
      onclick: () => { S.sel.move = id; refs.mvList.querySelectorAll('.ed-item').forEach((x) => x.classList.toggle('is-selected', x.dataset.id === id)); Mv.renderForm(); },
    },
    el('div', { class: 'meta' },
      el('div', { class: 't1' }, typeBadge(mv.type), el('b', { text: mv.name || '（名前なし）' }), el('span', { class: 'num', text: id })),
      el('div', { class: 't2' },
        el('span', { text: catLabel(mv.category) }),
        mv.category !== 'status' ? el('span', { text: '威力 ' + (mv.power || 0) }) : null,
        el('span', { text: '命中 ' + (mv.accuracy === 0 ? '必中' : (mv.accuracy === undefined ? '-' : mv.accuracy)) }),
        el('span', { text: 'PP ' + (mv.pp || '-') }),
        el('span', { class: n ? '' : 'warn', text: '使用 ' + n + '体' }))));
  };
  Mv.renderList = function () {
    if (!refs.mvList) return;
    const f = S.filter.move;
    const q = f.q.trim().toLowerCase();
    const usage = Mv.usage();
    const ids = Object.keys(movesObj()).filter((id) => {
      const mv = movesObj()[id] || {};
      if (f.type && mv.type !== f.type) return false;
      if (f.category && mv.category !== f.category) return false;
      if (q && !(id + ' ' + (mv.name || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    refs.mvList.innerHTML = '';
    if (!ids.length) refs.mvList.appendChild(el('div', { class: 'ed-empty', text: '該当するわざがありません' }));
    ids.forEach((id) => refs.mvList.appendChild(Mv.item(id, usage)));
    refs.mvCount.textContent = ids.length + ' / ' + Object.keys(movesObj()).length + ' 個';
  };
  Mv.refreshItem = function (id, oldId) {
    const node = refs.mvList && refs.mvList.querySelector('.ed-item[data-id="' + CSS.escape(oldId || id) + '"]');
    if (node) node.replaceWith(Mv.item(id, Mv.usage()));
  };

  Mv.renderForm = function () {
    const box = refs.mvForm;
    box.innerHTML = '';
    const id = S.sel.move;
    const mv = id ? movesObj()[id] : null;
    if (!mv) { box.appendChild(el('div', { class: 'card ed-empty', text: 'わざを選ぶか「＋ 新規追加」してください' })); return; }
    const changed = () => { touched(); Mv.refreshItem(S.sel.move); };

    const idInput = inputText(id, null, { class: 'input mono', id: 'ed-move-id' });
    const idField = field('ID（英小文字・数字・_）', idInput, { req: true, hint: 'モンスターの learnset が参照します' });
    idInput.addEventListener('change', () => Mv.rename(idInput, idField));
    const powerIn = inputNum(mv.power, (v) => { mv.power = v === undefined ? 0 : v; changed(); }, { min: 0, step: 5 });
    const users = moveUsers(id);

    put(box, 
      el('div', { class: 'ed-formhead' },
        typeBadge(mv.type), el('h3', { text: mv.name || '（名前なし）' }), el('span', { class: 'chip', text: catLabel(mv.category) }),
        el('span', { class: 'ed-spacer' }),
        btn('複製', () => Mv.duplicate(id), 'btn-sm'),
        btn('削除', () => Mv.remove(id), 'btn-sm btn-danger', { id: 'ed-move-del' })),
      card('基本情報',
        el('div', { class: 'ed-grid' },
          idField,
          field('名前', inputText(mv.name, (v) => { mv.name = v; changed(); }), { req: true }),
          field('タイプ', selectBox(typeOptions(false), mv.type, (v) => { mv.type = v; changed(); })),
          field('分類', selectBox(CATEGORIES, mv.category, (v) => {
            mv.category = v;
            if (v === 'status') { mv.power = 0; powerIn.value = 0; }
            changed();
          }), { hint: 'へんか は威力 0' }),
          field('威力 power', powerIn),
          field('命中 accuracy（%）', inputNum(mv.accuracy, (v) => { setOpt(mv, 'accuracy', v); changed(); }, { min: 0, max: 100 }), { hint: '0 = かならず あたる' }),
          field('PP', inputNum(mv.pp, (v) => { setOpt(mv, 'pp', v === undefined ? undefined : Math.floor(v)); changed(); }, { min: 1, step: 1 })),
          field('優先度 priority', inputNum(mv.priority, (v) => { setOpt(mv, 'priority', v ? Math.floor(v) : undefined); changed(); }, { min: -7, max: 5, step: 1, placeholder: '0' }), { hint: '1以上で先制 / 空欄=0' }),
          field('急所ランク critStage', inputNum(mv.critStage, (v) => { setOpt(mv, 'critStage', v ? Math.floor(v) : undefined); changed(); }, { min: 0, max: 3, step: 1, placeholder: '0' }), { hint: '1で急所に当たりやすい' }),
          field('説明 desc', textArea(mv.desc, (v) => { mv.desc = v; changed(); }, { rows: 2 }), { cls: 'span-all' }))));

    refs.effWrap = el('div');
    box.appendChild(card('追加効果 effects', refs.effWrap));
    Mv.renderEffects(mv, changed);

    box.appendChild(card('このわざを覚えるモンスター（' + users.length + '体）',
      users.length
        ? el('div', { class: 'ed-row' }, users.map((u) => el('button', {
          class: 'chip', type: 'button', style: 'cursor:pointer', title: 'モンスター画面で開く',
          text: 'No.' + pad3(u.m.no) + ' ' + (u.m.name || u.m.id) + ' Lv' + u.lv.join(','),
          onclick: () => { S.sel.monster = u.m.id; showSection('monsters'); },
        })))
        : el('p', { class: 'muted', text: 'まだ どのモンスターも覚えません（モンスター画面の learnset で追加できます）' })));
  };

  Mv.renderEffects = function (mv, changed) {
    const wrap = refs.effWrap;
    wrap.innerHTML = '';
    if (!Array.isArray(mv.effects)) mv.effects = [];
    const effs = mv.effects;
    const done = () => { if (effs.length) mv.effects = effs; else delete mv.effects; Mv.renderEffects(mv, changed); changed(); };
    const rows = el('div', { class: 'ed-rows' });
    effs.forEach((ef, i) => {
      if (!isObj(ef)) return;
      const summary = el('span', { class: 'small dim', text: '→ ' + effectText(ef) });
      const upd = () => { summary.textContent = '→ ' + effectText(ef); changed(); };
      const num = (key, attrs, integer) => inputNum(ef[key], (v) => { setOpt(ef, key, v === undefined ? undefined : (integer ? Math.floor(v) : v)); upd(); }, Object.assign({ class: 'input num' }, attrs));
      const parts = [el('span', { class: 'lbl', text: '#' + (i + 1) }),
        selectBox(EFFECT_KINDS, ef.kind, (v) => { effs[i] = EFFECT_DEFAULTS[v] ? EFFECT_DEFAULTS[v]() : { kind: v }; done(); })];
      if (ef.kind === 'stat') {
        parts.push(el('span', { class: 'lbl', text: '対象' }), selectBox([{ v: 'foe', label: '相手' }, { v: 'self', label: '自分' }], ef.target, (v) => { ef.target = v; upd(); }),
          el('span', { class: 'lbl', text: '能力' }), selectBox(EFFECT_STATS, ef.stat, (v) => { ef.stat = v; upd(); }),
          el('span', { class: 'lbl', text: '段階' }), num('stages', { min: -6, max: 6, step: 1 }, true),
          el('span', { class: 'lbl', text: '確率%' }), num('chance', { min: 1, max: 100, placeholder: '100' }, true));
      } else if (ef.kind === 'status') {
        parts.push(el('span', { class: 'lbl', text: '状態' }), selectBox(STATUSES, ef.status, (v) => { ef.status = v; upd(); }),
          el('span', { class: 'lbl', text: '確率%' }), num('chance', { min: 1, max: 100, placeholder: '100' }, true));
      } else if (ef.kind === 'heal' || ef.kind === 'drain' || ef.kind === 'recoil') {
        parts.push(el('span', { class: 'lbl', text: '割合（0〜1）' }), num('ratio', { min: 0, max: 1, step: 0.05 }));
      } else if (ef.kind === 'flinch') {
        parts.push(el('span', { class: 'lbl', text: '確率%' }), num('chance', { min: 1, max: 100 }, true));
      } else if (ef.kind === 'multihit') {
        parts.push(el('span', { class: 'lbl', text: '最小' }), num('min', { min: 1, max: 10, step: 1 }, true), el('span', { class: 'lbl', text: '最大' }), num('max', { min: 1, max: 10, step: 1 }, true));
      }
      parts.push(summary, el('span', { class: 'ops' },
        iconBtn('↑', '上へ', () => { [effs[i - 1], effs[i]] = [effs[i], effs[i - 1]]; done(); }, i === 0),
        iconBtn('↓', '下へ', () => { [effs[i + 1], effs[i]] = [effs[i], effs[i + 1]]; done(); }, i === effs.length - 1),
        iconBtn('✕', '削除', () => { effs.splice(i, 1); done(); })));
      rows.appendChild(el('div', { class: 'ed-rowcard' }, parts));
    });
    if (!effs.length) rows.appendChild(el('p', { class: 'muted', text: '追加効果はありません' }));
    wrap.append(rows, el('div', { class: 'ed-row', style: 'margin-top:8px' },
      btn('＋ 効果を追加', () => { effs.push(EFFECT_DEFAULTS.stat()); done(); }, 'btn-sm', { id: 'ed-eff-add' }),
      el('span', { class: 'ed-hint', text: '確率を空欄にすると 100%（必ず発動）になります' })));
    if (!effs.length) delete mv.effects;
  };

  Mv.rename = async function (input, fieldEl) {
    const oldId = S.sel.move;
    const newId = input.value.trim();
    const setHint = (t, bad) => { fieldEl._hint.textContent = t; fieldEl._hint.classList.toggle('ng', !!bad); input.classList.toggle('is-bad', !!bad); };
    if (newId === oldId) return;
    if (!ID_RE.test(newId)) { setHint('英小文字・数字・_ だけにしてください（変更は反映されていません）', true); return; }
    if (hasOwn(movesObj(), newId)) { setHint('この ID は ほかのわざが使っています（変更は反映されていません）', true); return; }
    const rl = moveRefs(oldId);
    let mode = 'only';
    if (rl.length) {
      mode = await askRefs('IDの変更', '「' + oldId + '」を参照しているデータがあります。新しい ID「' + newId + '」に書き換えますか？', rl, '参照も書き換える', 'IDだけ変える');
      if (!mode) { input.value = oldId; return; }
    }
    G().moves = renameKey(movesObj(), oldId, newId);
    if (mode === 'with') replaceMoveRefs(oldId, newId);
    S.sel.move = newId;
    setHint('ID を変更しました');
    Mv.refreshItem(newId, oldId);
    touched();
  };

  Mv.create = async function () {
    const vals = { id: uniqueId('new_move', (id) => hasOwn(movesObj(), id)), name: '', type: Object.keys(typesObj())[0] || 'normal', category: 'physical' };
    const hint = el('div', { class: 'ed-hint' });
    const body = el('div', { class: 'ed-grid cols-2' },
      field('ID（英小文字・数字・_）', inputText(vals.id, (v) => { vals.id = v.trim(); }, { class: 'input mono', id: 'ed-newmove-id' }), { req: true }),
      field('名前', inputText('', (v) => { vals.name = v; }, { placeholder: '例: かぜのやいば' }), { req: true }),
      field('タイプ', selectBox(typeOptions(false), vals.type, (v) => { vals.type = v; })),
      field('分類', selectBox(CATEGORIES, vals.category, (v) => { vals.category = v; })),
      el('div', { class: 'ed-field span-all' }, hint));
    const ok = await modal({
      title: 'わざを新規追加', body,
      buttons: [{ label: 'キャンセル', value: false }, {
        label: '追加する', value: true, cls: 'btn-primary', id: 'ed-newmove-ok',
        check: () => {
          const msg = !ID_RE.test(vals.id) ? 'ID は英小文字・数字・_ だけにしてください' : (hasOwn(movesObj(), vals.id) ? 'この ID は既に使われています' : '');
          hint.textContent = msg; hint.classList.toggle('ng', !!msg);
          return !msg;
        },
      }],
    });
    if (!ok) return;
    movesObj()[vals.id] = {
      name: vals.name || vals.id, type: vals.type, category: vals.category,
      power: vals.category === 'status' ? 0 : 40, accuracy: 100, pp: 20, desc: '',
    };
    S.sel.move = vals.id;
    S.filter.move = { q: '', type: '', category: '' };
    touched();
    rerender();
    toast('わざ「' + (vals.name || vals.id) + '」を追加しました', 'success');
  };
  Mv.duplicate = function (id) {
    const newId = uniqueId(id + '_copy', (x) => hasOwn(movesObj(), x));
    const copy = clone(movesObj()[id]);
    copy.name = (copy.name || '') + 'コピー';
    movesObj()[newId] = copy;
    S.sel.move = newId;
    touched();
    rerender();
    toast('わざを複製しました（ID: ' + newId + '）', 'success');
  };
  Mv.remove = async function (id) {
    const mv = movesObj()[id] || {};
    const rl = moveRefs(id);
    let mode;
    if (rl.length) {
      mode = await askRefs('わざの削除', '「' + (mv.name || id) + '」を使っているデータがあります。削除すると参照切れ（検証エラー）になります。', rl, '参照も取り除いて削除', '削除する（参照は残す）');
      if (!mode) return;
    } else if (!(await confirmBox('わざ「' + (mv.name || id) + '」（' + id + '）を削除しますか？', { ok: '削除する', danger: true }))) return;
    if (mode === 'with') replaceMoveRefs(id, null);
    delete movesObj()[id];
    S.sel.move = null;
    touched();
    rerender();
    toast('わざ「' + (mv.name || id) + '」を削除しました', 'success');
  };

  // ==================================================================
  // タイプ
  // ==================================================================
  const Ty = {};
  const CHART_CYCLE = [1, 2, 0.5, 0];

  Ty.render = function (main) {
    main.appendChild(sectionHead('タイプ', revertButton('types'), btn('＋ タイプを追加', Ty.create, 'btn-gold btn-sm')));
    const types = typesObj();
    const moveCnt = {}, monCnt = {};
    Object.keys(movesObj()).forEach((id) => { const t = (movesObj()[id] || {}).type; moveCnt[t] = (moveCnt[t] || 0) + 1; });
    monsterList().forEach((m) => (m && Array.isArray(m.types) ? m.types : []).forEach((t) => { monCnt[t] = (monCnt[t] || 0) + 1; }));
    const tbody = el('tbody');
    Object.keys(types).forEach((id) => {
      const t = types[id];
      const badge = el('span');
      const upd = () => { badge.innerHTML = ''; badge.appendChild(typeBadge(id)); };
      upd();
      tbody.appendChild(el('tr', {},
        el('td', { class: 'mono', text: id }),
        el('td', {}, inputText(t.name, (v) => { t.name = v; upd(); touched(); Ty.renderChart(); }, { style: 'max-width:160px' })),
        el('td', {}, el('div', { class: 'ed-row nowrap' },
          colorInput(t.color, (v) => { t.color = v; upd(); touched(); Ty.renderChart(); }),
          inputText(t.color, null, { class: 'input mono', style: 'width:100px', readonly: true }))),
        el('td', {}, badge),
        el('td', { class: 'small dim', text: 'わざ ' + (moveCnt[id] || 0) + ' / モンスター ' + (monCnt[id] || 0) }),
        el('td', { class: 'w-ops' }, iconBtn('✕', '削除', () => Ty.remove(id)))));
    });
    // 色入力と表示テキストを連動
    tbody.querySelectorAll('input[type=color]').forEach((c) => c.addEventListener('input', () => { const txt = c.parentNode.querySelector('input[type=text]'); if (txt) txt.value = c.value; }));
    refs.chartWrap = el('div', { class: 'ed-chart-wrap' });
    const listCard = card('タイプ一覧', el('table', { class: 'ed-table' },
      el('thead', {}, el('tr', {}, el('th', { text: 'ID' }), el('th', { text: '名前' }), el('th', { text: '色' }), el('th', { text: '表示' }), el('th', { text: '使用数' }), el('th', {}))),
      tbody));
    put(main,
      card(el('span', { text: '相性表 typeChart' }),
        el('p', { class: 'ed-hint', text: 'マスをクリックすると 1 → 2（ばつぐん）→ 0.5（いまひとつ）→ 0（こうかなし）→ 1 の順に切り替わります（右クリックで逆順）。行 = 攻撃するわざのタイプ、列 = 受けるモンスターのタイプ。' }),
        refs.chartWrap,
        el('div', { class: 'ed-chart-legend' },
          el('span', {}, el('i', { style: 'background:#3fa34d' }), '×2 ばつぐん'),
          el('span', {}, el('i', { style: 'background:#b0413e' }), '×½ いまひとつ'),
          el('span', {}, el('i', { style: 'background:#222' }), '×0 こうかなし'),
          el('span', {}, el('i', { style: 'background:rgba(255,255,255,.1)' }), '×1 ふつう（空欄）'))),
      listCard);
    Ty.renderChart();
  };

  Ty.renderChart = function () {
    const wrap = refs.chartWrap;
    if (!wrap) return;
    const ids = Object.keys(typesObj());
    const chart = chartObj();
    const table = el('table', { class: 'ed-chart', id: 'ed-type-chart' });
    const head = el('tr', {}, el('th', { class: 'small muted', text: '攻撃↓ 防御→' }));
    ids.forEach((d) => head.appendChild(el('th', { class: 'col' }, el('span', { style: { '--c': (typesObj()[d] || {}).color || '#555' }, text: typeName(d) }))));
    table.appendChild(head);
    const label = (v) => (v === 2 ? '2' : v === 0.5 ? '½' : v === 0 ? '0' : v === 1 || v === undefined ? '' : String(v));
    const cls = (v) => (v === 2 ? 'v2' : v === 0.5 ? 'v05' : v === 0 ? 'v0' : v === 1 || v === undefined ? '' : 'vx');
    ids.forEach((a) => {
      const tr = el('tr', {}, el('th', { class: 'row' }, el('span', { style: { '--c': (typesObj()[a] || {}).color || '#555' }, text: typeName(a) })));
      ids.forEach((d, ci) => {
        const row = isObj(chart[a]) ? chart[a] : null;
        const v = row && hasOwn(row, d) ? row[d] : undefined;
        const td = el('td', { class: cls(v), text: label(v), title: typeName(a) + ' → ' + typeName(d) + ': ×' + (v === undefined ? 1 : v), dataset: { atk: a, def: d, col: ci } });
        const step = (dir) => {
          if (!isObj(chart[a])) chart[a] = {};
          const cur = hasOwn(chart[a], d) ? chart[a][d] : 1;
          const idx = CHART_CYCLE.indexOf(cur);
          const next = idx < 0 ? 1 : CHART_CYCLE[(idx + dir + CHART_CYCLE.length) % CHART_CYCLE.length];
          if (next === 1) delete chart[a][d]; else chart[a][d] = next;
          td.className = cls(next === 1 ? undefined : next);
          td.textContent = label(next === 1 ? undefined : next);
          td.title = typeName(a) + ' → ' + typeName(d) + ': ×' + next;
          touched();
        };
        td.addEventListener('click', () => step(1));
        td.addEventListener('contextmenu', (e) => { e.preventDefault(); step(-1); });
        td.addEventListener('mouseenter', () => table.querySelectorAll('td[data-col="' + ci + '"]').forEach((x) => x.classList.add('hl')));
        td.addEventListener('mouseleave', () => table.querySelectorAll('td.hl').forEach((x) => x.classList.remove('hl')));
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.innerHTML = '';
    wrap.appendChild(table);
  };

  Ty.create = async function () {
    const vals = { id: '', name: '', color: randomColor() };
    const hint = el('div', { class: 'ed-hint' });
    const body = el('div', { class: 'ed-grid cols-3' },
      field('ID（英小文字）', inputText('', (v) => { vals.id = v.trim(); }, { class: 'input mono', placeholder: '例: light' }), { req: true }),
      field('名前', inputText('', (v) => { vals.name = v; }, { placeholder: '例: ひかり' }), { req: true }),
      field('色', colorInput(vals.color, (v) => { vals.color = v; })),
      el('div', { class: 'ed-field span-all' }, hint, el('p', { class: 'ed-hint', text: '追加後、相性表で ほかのタイプとの相性を設定してください。' })));
    const ok = await modal({
      title: 'タイプを追加', body,
      buttons: [{ label: 'キャンセル', value: false }, {
        label: '追加する', value: true, cls: 'btn-primary',
        check: () => {
          const msg = !ID_RE.test(vals.id) ? 'ID は英小文字・数字・_ だけにしてください' : (hasOwn(typesObj(), vals.id) ? 'この ID は既に使われています' : '');
          hint.textContent = msg; hint.classList.toggle('ng', !!msg);
          return !msg;
        },
      }],
    });
    if (!ok) return;
    typesObj()[vals.id] = { name: vals.name || vals.id, color: vals.color };
    chartObj()[vals.id] = {};
    touched();
    rerender();
  };
  Ty.remove = async function (id) {
    const usesM = Object.keys(movesObj()).filter((k) => (movesObj()[k] || {}).type === id);
    const usesMon = monsterList().filter((m) => m && Array.isArray(m.types) && m.types.includes(id));
    const lines = usesM.map((k) => 'わざ ' + k + '（' + moveName(k) + '）').concat(usesMon.map((m) => 'モンスター ' + m.id + '（' + (m.name || '') + '）'));
    const msg = el('div', {},
      el('p', { text: 'タイプ「' + typeName(id) + '」（' + id + '）を削除し、相性表からも取り除きます。' }),
      lines.length ? el('p', { class: 'warn', text: 'このタイプを使っているデータがあります（削除後は検証エラーになるので、別のタイプに変更してください）:' }) : null,
      lines.length ? el('ul', { class: 'ed-msglist' }, lines.slice(0, 80).map((t) => el('li', { class: 'w', text: t }))) : null);
    const ok = await modal({ title: 'タイプの削除', body: msg, buttons: [{ label: 'キャンセル', value: false }, { label: '削除する', value: true, cls: 'btn-danger' }] });
    if (!ok) return;
    delete typesObj()[id];
    const chart = chartObj();
    delete chart[id];
    Object.keys(chart).forEach((a) => { if (isObj(chart[a])) delete chart[a][id]; });
    touched();
    rerender();
  };

  // ==================================================================
  // ガチャ
  // ==================================================================
  const Ga = {};

  Ga.render = function (main) {
    const g = gachaObj();
    if (!Array.isArray(g.banners)) g.banners = [];
    main.appendChild(sectionHead('ガチャ', revertButton('gacha')));
    main.append(Ga.rarityCard(), Ga.settingsCard());
    refs.banList = el('div', { class: 'ed-banner-list', id: 'ed-banner-list' });
    refs.banForm = el('div', { class: 'ed-formpane' });
    main.appendChild(el('div', { class: 'ed-split' },
      el('div', { class: 'ed-listpane' },
        el('div', { class: 'ed-listtools' }, el('div', { class: 'ed-row' }, el('b', { class: 'grow', text: 'バナー（上から順に表示）' }), btn('＋ 新規', Ga.createBanner, 'btn-gold btn-sm', { id: 'ed-banner-new' }))),
        el('div', { class: 'ed-list' }, refs.banList)),
      refs.banForm));
    Ga.renderBanners();
  };

  Ga.rarityCard = function () {
    const rar = raritiesObj();
    const monCnt = {};
    monsterList().forEach((m) => { if (m) monCnt[m.rarity] = (monCnt[m.rarity] || 0) + 1; });
    const tbody = el('tbody');
    rarityIds().forEach((id) => {
      const r = rar[id];
      if (!isObj(r)) return;
      const badge = el('span');
      const upd = () => { badge.innerHTML = ''; badge.appendChild(rarBadge(id)); touched(); };
      badge.appendChild(rarBadge(id));
      tbody.appendChild(el('tr', {},
        el('td', {}, badge),
        el('td', {}, inputText(r.name, (v) => { r.name = v; upd(); }, { style: 'min-width:130px;max-width:240px' })),
        el('td', {}, colorInput(r.color, (v) => { r.color = v; upd(); })),
        el('td', {}, colorInput(r.glow, (v) => { r.glow = v; upd(); }, '#ffffff')),
        el('td', { class: 'w-num' }, inputNum(r.stars, (v) => { setOpt(r, 'stars', v === undefined ? undefined : Math.floor(v)); upd(); }, { min: 0, max: 10, step: 1 })),
        el('td', { class: 'w-num' }, inputNum(r.pointMult, (v) => { setOpt(r, 'pointMult', v); upd(); }, { min: 0, step: 0.1 })),
        el('td', { class: 'w-num' }, inputNum(r.refund, (v) => { setOpt(r, 'refund', v); upd(); }, { min: 0, step: 10 })),
        el('td', {}, checkBox('', !!r.rainbow, (c) => { if (c) r.rainbow = true; else delete r.rainbow; upd(); })),
        el('td', { class: 'small dim', text: (monCnt[id] || 0) + '体' })));
    });
    return card('レア度 rarities',
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'ed-table' },
        el('thead', {}, el('tr', {}, ['ID', '名前', '色', '光の色', '★', 'ポイント倍率', '返還pt', '虹演出', 'モンスター数'].map((t) => el('th', { text: t })))),
        tbody)),
      el('p', { class: 'ed-hint', text: 'ポイント倍率 = 野生で倒したときのポイント倍率 / 返還pt = 凸が最大のモンスターを重ねて引いたときに もらえるポイント。レア度の追加・並び順の変更は data/gacha.js を直接編集してください。' }));
  };

  Ga.settingsCard = function () {
    const g = gachaObj();
    const num = (key, label, attrs, hint, integer) => field(label, inputNum(g[key], (v) => { setOpt(g, key, v === undefined ? undefined : (integer ? Math.floor(v) : v)); touched(); }, attrs), { hint });
    return card('ガチャ設定 gacha',
      el('div', { class: 'ed-grid' },
        num('singleCost', '単発の消費pt singleCost', { min: 0, step: 10 }),
        num('multiCost', '10連の消費pt multiCost', { min: 0, step: 10 }),
        num('multiCount', '連数 multiCount', { min: 1, step: 1 }, null, true),
        field('確定レア度 multiGuarantee', selectBox(rarityOptions(true, '（確定なし）'), g.multiGuarantee || '', (v) => { g.multiGuarantee = v || null; touched(); }), { hint: '10連の最後の1回はこのレア度以上' }),
        num('pityCount', '天井の回数 pityCount', { min: 0, step: 1 }, '0 で天井なし', true),
        field('天井のレア度 pityRarity', selectBox(rarityOptions(false), g.pityRarity, (v) => { g.pityRarity = v; touched(); })),
        num('maxLimitBreak', '凸の上限 maxLimitBreak', { min: 0, step: 1 }, null, true),
        num('limitBreakBonus', '凸1つの能力アップ limitBreakBonus', { min: 0, step: 0.01 }, '0.04 = +4%'),
        num('startLevel', '入手時のレベル startLevel', { min: 1, step: 1 }, null, true)));
  };

  // バナーの pool に入るモンスター
  function bannerPool(b) {
    if (Array.isArray(b.pool)) return b.pool.filter((id) => monById(id));
    return monsterList().filter((m) => m && m.gacha !== false).map((m) => m.id);
  }
  // 対象0体のレア度を按分した実効確率（目安）
  function effectiveRates(b) {
    const pool = bannerPool(b);
    const rates = isObj(b.rates) ? b.rates : {};
    const out = {};
    let sum = 0;
    Object.keys(rates).forEach((r) => {
      const has = pool.some((id) => (monById(id) || {}).rarity === r);
      if (has && rates[r] > 0) { out[r] = Number(rates[r]) || 0; sum += out[r]; }
    });
    Object.keys(out).forEach((r) => { out[r] = sum > 0 ? out[r] / sum * 100 : 0; });
    return out;
  }

  Ga.renderBanners = function () {
    const g = gachaObj();
    const list = refs.banList;
    list.innerHTML = '';
    if (S.sel.banner >= g.banners.length) S.sel.banner = g.banners.length - 1;
    if (S.sel.banner < 0) S.sel.banner = 0;
    g.banners.forEach((b, i) => {
      if (!isObj(b)) return;
      const cols = Array.isArray(b.colors) ? b.colors : [];
      list.appendChild(el('div', {
        class: 'ed-banner-card' + (i === S.sel.banner ? ' is-selected' : ''),
        style: { background: 'linear-gradient(135deg, ' + colorValue(cols[0], '#1e3a8a') + ', ' + colorValue(cols[1], '#3b82f6') + ')' },
        onclick: () => { S.sel.banner = i; Ga.renderBanners(); },
      },
      el('div', { class: 'bname' }, el('div', { text: b.name || '（名前なし）' }), el('div', { class: 'bid', text: b.id || '' })),
      iconBtn('↑', '上へ', (e) => { e.stopPropagation(); [g.banners[i - 1], g.banners[i]] = [g.banners[i], g.banners[i - 1]]; S.sel.banner = i - 1; touched(); Ga.renderBanners(); }, i === 0),
      iconBtn('↓', '下へ', (e) => { e.stopPropagation(); [g.banners[i + 1], g.banners[i]] = [g.banners[i], g.banners[i + 1]]; S.sel.banner = i + 1; touched(); Ga.renderBanners(); }, i === g.banners.length - 1)));
    });
    if (!g.banners.length) list.appendChild(el('div', { class: 'ed-empty', text: 'バナーがありません' }));
    Ga.renderBannerForm();
  };

  Ga.renderBannerForm = function () {
    const box = refs.banForm;
    box.innerHTML = '';
    const g = gachaObj();
    const b = g.banners[S.sel.banner];
    if (!isObj(b)) { box.appendChild(el('div', { class: 'card ed-empty', text: 'バナーを選ぶか「＋ 新規」で追加してください' })); return; }
    if (!isObj(b.rates)) b.rates = {};
    if (!Array.isArray(b.colors)) b.colors = ['#1e3a8a', '#3b82f6'];
    if (!Array.isArray(b.pickup)) b.pickup = [];
    const idx = S.sel.banner;
    const preview = el('div', { class: 'ed-banner-preview' });
    const rateInfo = el('div', { class: 'ed-row', style: 'margin-top:6px' });
    const refreshPreview = () => {
      preview.style.background = 'linear-gradient(135deg, ' + colorValue(b.colors[0], '#1e3a8a') + ', ' + colorValue(b.colors[1], '#3b82f6') + ')';
      preview.innerHTML = '';
      preview.append(el('div', { class: 'bn', text: b.name || '（名前なし）' }), el('div', { class: 'bd', text: b.desc || '' }),
        el('div', { class: 'pk' }, (b.pickup || []).map((id) => monById(id)).filter(Boolean).slice(0, 8).map((m) => spriteImg(m, 'front'))));
    };
    const refreshRates = () => {
      const sum = rarityIds().reduce((s, r) => s + (Number(b.rates[r]) || 0), 0) + Object.keys(b.rates).filter((r) => !rarityIds().includes(r)).reduce((s, r) => s + (Number(b.rates[r]) || 0), 0);
      const ok = Math.abs(sum - 100) < 0.001;
      const pool = bannerPool(b);
      const eff = effectiveRates(b);
      rateInfo.innerHTML = '';
      rateInfo.append(el('span', { class: 'chip ' + (ok ? 'chip-ok' : 'chip-danger'), id: 'ed-rate-sum', text: '合計 ' + (Math.round(sum * 1000) / 1000) + '%' + (ok ? ' ✓' : '（100にしてください）') }));
      rarityIds().forEach((r) => {
        const n = pool.filter((id) => (monById(id) || {}).rarity === r).length;
        rateInfo.append(el('span', { class: 'chip ' + (n ? '' : 'chip-warn'), title: '実効確率 = 対象0体のレア度の確率を ほかに按分した値（目安）', text: r + ': ' + n + '体 / 実効 ' + (eff[r] ? (Math.round(eff[r] * 100) / 100) + '%' : '0%') }));
      });
      touched();
    };
    const changed = () => { touched(); refreshPreview(); Ga.refreshCard(idx); };

    const idInput = inputText(b.id, (v, i) => {
      const dup = g.banners.some((o, j) => j !== idx && o && o.id === v.trim());
      const bad = !ID_RE.test(v.trim()) || dup;
      i.classList.toggle('is-bad', bad);
      b.id = v.trim();
      changed();
    }, { class: 'input mono' });

    const rates = el('div', { class: 'ed-rates' });
    rarityIds().forEach((r) => {
      rates.appendChild(field(r + '（%）', inputNum(b.rates[r], (v) => { if (v === undefined) delete b.rates[r]; else b.rates[r] = v; refreshRates(); }, { min: 0, max: 100, step: 0.1, dataset: { rate: r } })));
    });

    // pool
    const poolWrap = el('div');
    const renderPool = () => {
      poolWrap.innerHTML = '';
      const isList = Array.isArray(b.pool);
      const radio = (val, label) => {
        const r = el('input', { type: 'radio', name: 'ed-pool-mode', checked: (val === 'list') === isList });
        r.addEventListener('change', () => {
          if (val === 'list') b.pool = b.pickup.slice();
          else b.pool = null;
          renderPool();
          refreshRates();
        });
        return el('label', { class: 'ed-inline-check' }, r, label);
      };
      poolWrap.append(el('div', { class: 'ed-row' }, radio('all', 'ガチャ対象（gacha: true）の全モンスター（pool: null）'), radio('list', '指定したモンスターだけ')));
      if (isList) {
        poolWrap.append(monPicker(b.pool, () => { refreshRates(); touched(); }, 'ed-pool-picker'));
      }
    };
    renderPool();

    put(box, 
      el('div', { class: 'ed-formhead' },
        el('h3', { text: b.name || '（名前なし）' }),
        el('span', { class: 'ed-spacer' }),
        btn('複製', () => { const c = clone(b); c.id = uniqueId(b.id + '_copy', (x) => g.banners.some((o) => o && o.id === x)); c.name = (b.name || '') + 'コピー'; g.banners.splice(idx + 1, 0, c); S.sel.banner = idx + 1; touched(); Ga.renderBanners(); }, 'btn-sm'),
        btn('削除', async () => {
          if (!(await confirmBox('バナー「' + (b.name || b.id) + '」を削除しますか？', { ok: '削除する', danger: true }))) return;
          g.banners.splice(idx, 1); touched(); Ga.renderBanners();
        }, 'btn-sm btn-danger')),
      preview,
      card('基本',
        el('div', { class: 'ed-grid' },
          field('ID', idInput, { req: true, hint: '英小文字・数字・_。ほかのバナーと重ならないこと' }),
          field('名前', inputText(b.name, (v) => { b.name = v; changed(); }), { req: true, cls: 'span-2' }),
          field('背景色1', colorInput(b.colors[0], (v) => { b.colors[0] = v; changed(); }, '#1e3a8a')),
          field('背景色2', colorInput(b.colors[1], (v) => { b.colors[1] = v; changed(); }, '#3b82f6')),
          field('説明 desc', textArea(b.desc, (v) => { b.desc = v; changed(); }, { rows: 2 }), { cls: 'span-all' }))),
      card('提供割合 rates（合計100%）', rates, rateInfo,
        el('p', { class: 'ed-hint', text: '対象モンスターが0体のレア度の確率は、ゲームでは ほかのレア度に自動で振り分けられます（実効 = その目安）。' })),
      card('対象モンスター pool', poolWrap),
      card('ピックアップ pickup',
        field('ピックアップ率 pickupRate（0〜1）', inputNum(b.pickupRate, (v) => { setOpt(b, 'pickupRate', v); touched(); }, { min: 0, max: 1, step: 0.05, style: 'max-width:140px' }), { hint: 'そのレア度が出たとき ピックアップ対象が選ばれる確率（0.5 = 50%）' }),
        el('div', { style: 'margin-top:8px' }, monPicker(b.pickup, () => { refreshPreview(); refreshRates(); Ga.refreshCard(idx); }, 'ed-pickup-picker', () => bannerPool(b)))));
    refreshPreview();
    refreshRates();
  };
  Ga.refreshCard = function (i) {
    const b = gachaObj().banners[i];
    const node = refs.banList && refs.banList.children[i];
    if (!node || !b) return;
    const cols = b.colors || [];
    node.style.background = 'linear-gradient(135deg, ' + colorValue(cols[0], '#1e3a8a') + ', ' + colorValue(cols[1], '#3b82f6') + ')';
    const bn = node.querySelector('.bname');
    if (bn) { bn.children[0].textContent = b.name || '（名前なし）'; bn.children[1].textContent = b.id || ''; }
  };
  Ga.createBanner = function () {
    const g = gachaObj();
    const rates = {};
    const std = g.banners.find((b) => b && isObj(b.rates));
    rarityIds().forEach((r) => { rates[r] = std && std.rates[r] !== undefined ? std.rates[r] : 0; });
    const b = {
      id: uniqueId('banner', (x) => g.banners.some((o) => o && o.id === x)),
      name: 'あたらしいガチャ', desc: '', rates, pool: null, pickup: [], pickupRate: 0.5, colors: [randomColor(), randomColor()],
    };
    g.banners.push(b);
    S.sel.banner = g.banners.length - 1;
    touched();
    Ga.renderBanners();
  };

  // モンスターの複数選択（配列 arr を直接書き換える）。limitTo: 強調する候補（pickup 用）
  function monPicker(arr, onChange, id, limitTo) {
    const wrap = el('div', { id });
    const q = inputText('', () => draw(), { placeholder: '絞り込み（名前・ID）', style: 'max-width:240px' });
    const grid = el('div', { class: 'ed-pick-grid' });
    const count = el('span', { class: 'small dim' });
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      const allowed = limitTo ? new Set(limitTo()) : null;
      grid.innerHTML = '';
      monsSorted().forEach((m) => {
        if (s && !(m.id + ' ' + (m.name || '')).toLowerCase().includes(s) && !arr.includes(m.id)) return;
        const on = arr.includes(m.id);
        const c = el('input', { type: 'checkbox', checked: on });
        const item = el('label', { class: 'ed-pick' + (on ? ' is-on' : ''), title: m.id + (allowed && !allowed.has(m.id) ? '（pool に含まれていません）' : '') },
          c, spriteImg(m, 'front'), rarBadge(m.rarity), el('span', { class: allowed && !allowed.has(m.id) ? 'muted' : '', text: m.name || m.id }));
        c.addEventListener('change', () => {
          const i = arr.indexOf(m.id);
          if (c.checked && i < 0) arr.push(m.id);
          if (!c.checked && i >= 0) arr.splice(i, 1);
          item.classList.toggle('is-on', c.checked);
          count.textContent = '選択中 ' + arr.length + ' 体';
          onChange();
        });
        grid.appendChild(item);
      });
      count.textContent = '選択中 ' + arr.length + ' 体';
    };
    wrap.append(el('div', { class: 'ed-row', style: 'margin-bottom:6px' }, q, count,
      btn('すべて解除', () => { arr.splice(0, arr.length); draw(); onChange(); }, 'btn-sm btn-ghost')), grid);
    draw();
    return wrap;
  }

  // ==================================================================
  // トレーナー
  // ==================================================================
  const Tr = {};

  function trainerRefs(id) {
    const out = [];
    const maps = mapsObj();
    Object.keys(maps).forEach((mid) => {
      (maps[mid] && Array.isArray(maps[mid].npcs) ? maps[mid].npcs : []).forEach((n) => {
        if (n && n.trainer === id) out.push('マップ ' + mid + '（' + (maps[mid].name || '') + '）の NPC ' + (n.id || '') + ' (' + n.x + ',' + n.y + ')');
      });
    });
    return out;
  }
  function replaceTrainerRefs(oldId, newId) {
    const maps = mapsObj();
    Object.keys(maps).forEach((mid) => {
      const m = maps[mid];
      if (!m || !Array.isArray(m.npcs)) return;
      if (newId) m.npcs.forEach((n) => { if (n && n.trainer === oldId) n.trainer = newId; });
      else m.npcs = m.npcs.filter((n) => !(n && n.trainer === oldId));
    });
  }
  function charCanvas(look, dir, frame, scale) {
    let cv;
    try { cv = App.sprites.characterCanvas(look, dir, frame || 0); } catch (e) { cv = null; }
    const out = el('canvas', { width: 16 * (scale || 3), height: 24 * (scale || 3) });
    if (cv) {
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, 0, 0, out.width, out.height);
    }
    return out;
  }

  Tr.render = function (main) {
    const ids = Object.keys(trainersObj());
    if (!S.sel.trainer || !hasOwn(trainersObj(), S.sel.trainer)) S.sel.trainer = ids[0] || null;
    main.appendChild(sectionHead('トレーナー', revertButton('trainers'), btn('＋ 新規追加', Tr.create, 'btn-gold btn-sm', { id: 'ed-trainer-new' })));
    const f = S.filter.trainer;
    refs.trList = el('div', { class: 'ed-list' });
    refs.trCount = el('div', { class: 'ed-listcount' });
    refs.trForm = el('div', { class: 'ed-formpane' });
    main.appendChild(el('div', { class: 'ed-split' },
      el('div', { class: 'ed-listpane' },
        el('div', { class: 'ed-listtools' }, inputText(f.q, (v) => { f.q = v; Tr.renderList(); }, { placeholder: '名前・ID・肩書きで検索' })),
        refs.trList, refs.trCount),
      refs.trForm));
    Tr.renderList();
    Tr.renderForm();
  };
  Tr.item = function (id) {
    const t = trainersObj()[id] || {};
    const thumb = charCanvas(t.look, 'down', 0, 2);
    thumb.className = 'thumb';
    thumb.style.cssText = 'width:32px;height:48px;image-rendering:pixelated';
    return el('div', {
      class: 'ed-item' + (id === S.sel.trainer ? ' is-selected' : ''), dataset: { id },
      onclick: () => { S.sel.trainer = id; refs.trList.querySelectorAll('.ed-item').forEach((x) => x.classList.toggle('is-selected', x.dataset.id === id)); Tr.renderForm(); },
    }, thumb,
    el('div', { class: 'meta' },
      el('div', { class: 't1' }, el('span', { class: 'small dim', text: t.className || '' }), el('b', { text: t.name || '（名前なし）' }), t.boss ? el('span', { class: 'chip chip-warn', text: 'BOSS' }) : null),
      el('div', { class: 't2' }, el('span', { class: 'num', text: id }),
        el('span', { text: (Array.isArray(t.party) ? t.party : []).map((p) => (p ? monName(p.species) + ' Lv' + p.level : '')).join(' / ') }))));
  };
  Tr.renderList = function () {
    const q = S.filter.trainer.q.trim().toLowerCase();
    const ids = Object.keys(trainersObj()).filter((id) => {
      const t = trainersObj()[id] || {};
      return !q || (id + ' ' + (t.name || '') + ' ' + (t.className || '')).toLowerCase().includes(q);
    });
    refs.trList.innerHTML = '';
    if (!ids.length) refs.trList.appendChild(el('div', { class: 'ed-empty', text: 'トレーナーがいません' }));
    ids.forEach((id) => refs.trList.appendChild(Tr.item(id)));
    refs.trCount.textContent = ids.length + ' / ' + Object.keys(trainersObj()).length + ' 人';
  };
  Tr.refreshItem = function (id, oldId) {
    const node = refs.trList && refs.trList.querySelector('.ed-item[data-id="' + CSS.escape(oldId || id) + '"]');
    if (node) node.replaceWith(Tr.item(id));
  };

  // 台詞配列 ⇔ テキスト（1行 = 1ページ。ページ内の改行は \n と書く）
  const linesToText = (v) => (Array.isArray(v) ? v : (typeof v === 'string' && v ? [v] : [])).map((s) => String(s).replace(/\n/g, '\\n')).join('\n');
  const textToLines = (s) => s.split('\n').map((x) => x.replace(/\\n/g, '\n')).filter((x) => x.trim() !== '');

  Tr.renderForm = function () {
    const box = refs.trForm;
    box.innerHTML = '';
    const id = S.sel.trainer;
    const t = id ? trainersObj()[id] : null;
    if (!t) { box.appendChild(el('div', { class: 'card ed-empty', text: 'トレーナーを選ぶか「＋ 新規追加」してください' })); return; }
    if (!isObj(t.look)) t.look = {};
    if (!Array.isArray(t.party)) t.party = [];
    const look = t.look;
    const preview = el('div', { class: 'ed-charrow' });
    const refreshPreview = () => {
      preview.innerHTML = '';
      ['down', 'left', 'right', 'up'].forEach((d) => preview.appendChild(el('div', { style: 'text-align:center' }, charCanvas(look, d, 0, 3), el('div', { class: 'small muted', text: d }))));
      preview.appendChild(el('div', { style: 'text-align:center' }, charCanvas(look, 'down', 1, 3), el('div', { class: 'small muted', text: '歩き' })));
      let src = '';
      if (t.image) src = S.localPreview[t.image] || t.image;
      else { try { src = App.sprites.trainerPortrait(look); } catch (e) { src = ''; } }
      if (src) {
        const img = el('img', { class: 'portrait', src, alt: '' });
        img.addEventListener('error', () => { try { img.src = App.sprites.trainerPortrait(look); } catch (e) { /* 無視 */ } }, { once: true });
        preview.appendChild(el('div', { style: 'text-align:center' }, img, el('div', { class: 'small muted', text: t.image ? 'バトル立ち絵（画像）' : 'バトル立ち絵（自動生成）' })));
      }
    };
    const changed = (pv) => { touched(); Tr.refreshItem(S.sel.trainer); if (pv) refreshPreview(); };
    const lookColor = (key, label, fallback) => field(label, colorInput(look[key], (v) => { look[key] = v; changed(true); }, fallback));

    const idInput = inputText(id, null, { class: 'input mono' });
    const idField = field('ID（英小文字・数字・_）', idInput, { req: true, hint: 'マップの NPC が trainer: で参照します' });
    idInput.addEventListener('change', () => Tr.rename(idInput, idField));

    const hatWrap = el('div', { class: 'ed-row nowrap' });
    const renderHat = () => {
      hatWrap.innerHTML = '';
      const has = !!look.hat;
      hatWrap.append(checkBox('かぶる', has, (c) => { look.hat = c ? '#e03030' : null; renderHat(); changed(true); }));
      if (has) hatWrap.append(colorInput(look.hat, (v) => { look.hat = v; changed(true); }));
    };
    renderHat();

    const usedIn = trainerRefs(id);
    put(box, 
      el('div', { class: 'ed-formhead' },
        el('h3', { text: (t.className ? t.className + 'の ' : '') + (t.name || '（名前なし）') }),
        el('span', { class: 'ed-spacer' }),
        btn('複製', () => Tr.duplicate(id), 'btn-sm'),
        btn('削除', () => Tr.remove(id), 'btn-sm btn-danger')),
      card('基本情報',
        el('div', { class: 'ed-grid' },
          idField,
          field('名前 name', inputText(t.name, (v) => { t.name = v; changed(); }), { req: true }),
          field('肩書き className', inputText(t.className, (v) => { setOpt(t, 'className', v); changed(); }), { hint: '表示: 「肩書きの 名前」' }),
          field('勝利ポイント reward', inputNum(t.reward, (v) => { setOpt(t, 'reward', v); changed(); }, { min: 0, step: 10, placeholder: String((cfg().rewards || {}).trainerDefault || 150) }), { hint: '空欄 = config の標準値' }),
          field('AI', selectBox(AIS, t.ai || 'smart', (v) => { t.ai = v; changed(); })),
          field('再戦 rematch', selectBox(REMATCH, t.rematch || 'never', (v) => { t.rematch = v; changed(); })),
          field('ボス', checkBox('ボスBGMにする', !!t.boss, (c) => { t.boss = c; changed(); })),
          field('バトル立ち絵 image（空欄=自動生成）', inputText(t.image, (v) => { t.image = v.trim(); changed(true); }, { class: 'input mono', placeholder: 'assets/characters/xxx.png' }), { cls: 'span-2' })),
        usedIn.length ? el('p', { class: 'ed-hint', text: '登場: ' + usedIn.join(' / ') }) : el('p', { class: 'ed-hint warn', text: 'まだ どのマップにも配置されていません（マップの npcs に { "trainer": "' + id + '" } を追加すると登場します）' })),
      card('見た目 look',
        preview,
        el('div', { class: 'ed-grid', style: 'margin-top:10px' },
          lookColor('skin', '肌 skin', '#f8d0a8'),
          lookColor('hair', '髪 hair', '#503020'),
          field('髪型 hairStyle', selectBox(HAIR_STYLES, look.hairStyle || 'short', (v) => { look.hairStyle = v; changed(true); })),
          lookColor('shirt', '服 shirt', '#3070d0'),
          lookColor('pants', 'ズボン pants', '#304060'),
          field('帽子 hat', hatWrap),
          lookColor('accent', 'アクセント accent', '#ffffff'),
          field('スプライト画像 look.image', inputText(look.image, (v) => { setOpt(look, 'image', v.trim()); changed(true); }, { class: 'input mono', placeholder: '空欄 = 自動生成' }), { cls: 'span-2', hint: '16x24 を 横3コマ × 縦4方向（下・左・右・上）並べた画像' }))));

    refs.partyWrap = el('div');
    box.appendChild(card('手持ち party', refs.partyWrap));
    Tr.renderParty(t, changed);

    const dlg = (key, label, hint) => field(label, textArea(linesToText(t[key]), (v) => { const arr = textToLines(v); if (arr.length) t[key] = arr; else delete t[key]; changed(); }, { class: 'textarea ed-dialog-ta', rows: 2 }), { hint });
    box.appendChild(card('台詞（1行 = 1ページ。ページ内で改行するときは \\n と書く）',
      el('div', { class: 'ed-grid cols-2' },
        dlg('intro', '話しかけ・発見時 intro'),
        dlg('after', '撃破後に話しかけたとき after'),
        dlg('lose', 'プレイヤーが勝ったとき lose'),
        dlg('win', 'プレイヤーが負けたとき win'))));
    refreshPreview();
  };

  Tr.renderParty = function (t, changed) {
    const wrap = refs.partyWrap;
    wrap.innerHTML = '';
    const party = t.party;
    const maxLv = cfg().maxLevel || 100;
    const redraw = () => { Tr.renderParty(t, changed); changed(); };
    const rows = el('div', { class: 'ed-rows' });
    party.forEach((p, i) => {
      if (!isObj(p)) return;
      const mon = monById(p.species);
      const img = mon ? spriteImg(mon, 'front') : el('span', { class: 'ng', text: '?' });
      if (img.tagName === 'IMG') img.style.cssText = 'width:40px;height:40px;image-rendering:pixelated';
      const movesWrap = el('span', { class: 'ed-row' });
      const renderMoves = () => {
        movesWrap.innerHTML = '';
        const has = Array.isArray(p.moves);
        movesWrap.append(checkBox('わざを指定', has, (c) => {
          if (c) {
            const m2 = monById(p.species);
            const learn = m2 && Array.isArray(m2.learnset) ? m2.learnset.filter((l) => l && l.lv <= (p.level || 1)).map((l) => l.move) : [];
            p.moves = Array.from(new Set(learn)).slice(-4);
            if (!p.moves.length) p.moves = [Object.keys(movesObj())[0]];
          } else delete p.moves;
          renderMoves();
          changed();
        }));
        if (!has) { movesWrap.append(el('span', { class: 'ed-hint', text: '（覚えている最新の4つ）' })); return; }
        const m2 = monById(p.species);
        const learnIds = m2 && Array.isArray(m2.learnset) ? Array.from(new Set(m2.learnset.map((l) => l && l.move))) : [];
        for (let k = 0; k < 4; k++) {
          const cur = p.moves[k] || '';
          const opts = [{ v: '', label: '（なし）' }, { group: 'このモンスターが覚えるわざ', items: learnIds.map((mid) => ({ v: mid, label: moveName(mid) })) }, { group: 'すべてのわざ', items: Object.keys(movesObj()).filter((mid) => !learnIds.includes(mid)).map((mid) => ({ v: mid, label: moveName(mid) })) }];
          movesWrap.append(selectBox(opts, cur, (v) => {
            const arr = p.moves.slice(0, 4);
            while (arr.length < 4) arr.push('');
            arr[k] = v;
            p.moves = arr.filter(Boolean);
            if (!p.moves.length) p.moves = [cur || Object.keys(movesObj())[0]];
            changed();
          }, { style: 'width:auto;max-width:150px' }));
        }
      };
      renderMoves();
      rows.appendChild(el('div', { class: 'ed-rowcard' },
        img,
        selectBox(monsterOptions(false), p.species, (v) => { p.species = v; redraw(); }, { style: 'width:auto;max-width:260px' }),
        el('span', { class: 'lbl', text: 'Lv' }),
        inputNum(p.level, (v) => { p.level = v === undefined ? undefined : Math.floor(v); if (p.level === undefined) delete p.level; changed(); }, { class: 'input num', min: 1, max: maxLv, step: 1 }),
        movesWrap,
        el('span', { class: 'ops' },
          iconBtn('↑', '上へ', () => { [party[i - 1], party[i]] = [party[i], party[i - 1]]; redraw(); }, i === 0),
          iconBtn('↓', '下へ', () => { [party[i + 1], party[i]] = [party[i], party[i + 1]]; redraw(); }, i === party.length - 1),
          iconBtn('✕', '削除', () => { party.splice(i, 1); redraw(); }))));
    });
    if (!party.length) rows.appendChild(el('p', { class: 'ng', text: '手持ちが空です（最低1体必要）' }));
    wrap.append(rows, el('div', { class: 'ed-row', style: 'margin-top:8px' },
      btn('＋ モンスターを追加', () => {
        const last = party[party.length - 1];
        party.push({ species: last ? last.species : ((monsSorted()[0] || {}).id || ''), level: last ? last.level : 5 });
        redraw();
      }, 'btn-sm', { disabled: party.length >= (cfg().partyMax || 6) }),
      el('span', { class: 'ed-hint', text: '最大 ' + (cfg().partyMax || 6) + ' 体' })));
  };

  Tr.rename = async function (input, fieldEl) {
    const oldId = S.sel.trainer;
    const newId = input.value.trim();
    const setHint = (tx, bad) => { fieldEl._hint.textContent = tx; fieldEl._hint.classList.toggle('ng', !!bad); input.classList.toggle('is-bad', !!bad); };
    if (newId === oldId) return;
    if (!ID_RE.test(newId)) { setHint('英小文字・数字・_ だけにしてください（変更は反映されていません）', true); return; }
    if (hasOwn(trainersObj(), newId)) { setHint('この ID は ほかのトレーナーが使っています（変更は反映されていません）', true); return; }
    const rl = trainerRefs(oldId);
    let mode = 'only';
    if (rl.length) {
      mode = await askRefs('IDの変更', '「' + oldId + '」を参照している NPC があります。新しい ID「' + newId + '」に書き換えますか？', rl, '参照も書き換える', 'IDだけ変える');
      if (!mode) { input.value = oldId; return; }
    }
    G().trainers = renameKey(trainersObj(), oldId, newId);
    if (mode === 'with') replaceTrainerRefs(oldId, newId);
    S.sel.trainer = newId;
    setHint('ID を変更しました');
    Tr.refreshItem(newId, oldId);
    touched();
  };
  Tr.create = async function () {
    const vals = { id: uniqueId('trainer', (x) => hasOwn(trainersObj(), x)), name: '', className: '' };
    const hint = el('div', { class: 'ed-hint' });
    const body = el('div', { class: 'ed-grid cols-3' },
      field('ID（英小文字・数字・_）', inputText(vals.id, (v) => { vals.id = v.trim(); }, { class: 'input mono' }), { req: true }),
      field('名前', inputText('', (v) => { vals.name = v; }, { placeholder: '例: ハルカ' }), { req: true }),
      field('肩書き', inputText('', (v) => { vals.className = v; }, { placeholder: '例: むしとりしょうねん' })),
      el('div', { class: 'ed-field span-all' }, hint));
    const ok = await modal({
      title: 'トレーナーを新規追加', body,
      buttons: [{ label: 'キャンセル', value: false }, {
        label: '追加する', value: true, cls: 'btn-primary',
        check: () => {
          const msg = !ID_RE.test(vals.id) ? 'ID は英小文字・数字・_ だけにしてください' : (hasOwn(trainersObj(), vals.id) ? 'この ID は既に使われています' : '');
          hint.textContent = msg; hint.classList.toggle('ng', !!msg);
          return !msg;
        },
      }],
    });
    if (!ok) return;
    const first = monsSorted()[0];
    trainersObj()[vals.id] = {
      name: vals.name || vals.id, className: vals.className,
      look: { skin: '#f8d0a8', hair: randomColor(), hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].v, shirt: randomColor(), pants: randomColor(), hat: null, accent: '#ffffff' },
      image: '', party: first ? [{ species: first.id, level: 5 }] : [], reward: (cfg().rewards || {}).trainerDefault || 150,
      ai: 'smart', boss: false, rematch: 'never',
      intro: ['めが あったら しょうぶだ！'], lose: ['まけちゃった…'], win: ['ぼくの かちだね！'], after: ['つぎは まけないよ！'],
    };
    S.sel.trainer = vals.id;
    touched();
    rerender();
  };
  Tr.duplicate = function (id) {
    const newId = uniqueId(id + '_copy', (x) => hasOwn(trainersObj(), x));
    trainersObj()[newId] = clone(trainersObj()[id]);
    S.sel.trainer = newId;
    touched();
    rerender();
    toast('トレーナーを複製しました（ID: ' + newId + '）', 'success');
  };
  Tr.remove = async function (id) {
    const t = trainersObj()[id] || {};
    const rl = trainerRefs(id);
    let mode;
    if (rl.length) {
      mode = await askRefs('トレーナーの削除', '「' + (t.name || id) + '」を配置している NPC があります。', rl, 'NPC も取り除いて削除', '削除する（NPC は残す）');
      if (!mode) return;
    } else if (!(await confirmBox('トレーナー「' + (t.name || id) + '」（' + id + '）を削除しますか？', { ok: '削除する', danger: true }))) return;
    if (mode === 'with') replaceTrainerRefs(id, null);
    delete trainersObj()[id];
    S.sel.trainer = null;
    touched();
    rerender();
  };

  // ==================================================================
  // マップ
  // ==================================================================
  const Mp = { undo: [], tileErr: false };
  // js/gfx/tiles.js が無いときの簡易表示色（draw 名ごと）
  const TILE_FALLBACK = {
    grass: '#68c060', tallgrass: '#2f8f3a', path: '#d8b878', sand: '#f0e0a0', flower: '#80c870', tree: '#1f6a2a',
    water: '#3878e0', bridge: '#b08040', fence: '#a07040', rock: '#8a8a8a', sign: '#b08850', cliff: '#8a6a40',
    roofHouse: '#c04040', roofCenter: '#e06080', roofShop: '#e0a020', roofGym: '#6060c0', wall: '#e8e0d0', window: '#90c0f0',
    door: '#704020', floor: '#e8d8b0', rug: '#c04050', wallIn: '#b0a890', counter: '#a07850', table: '#b08858',
    bookshelf: '#805030', plant: '#40a050', bed: '#e0e0f8', mat: '#d05050', gachaMachine: '#f0c030', healMachine: '#f070a0',
    caveFloor: '#8a7058', caveFloorSafe: '#a08870', caveWall: '#4a3a2a', void: '#000000',
  };
  const MAP_JSON = [
    { k: 'warps', label: 'ワープ warps', type: 'array', hint: '{ "x", "y", "to": 行き先マップID, "tx", "ty", "dir", "requireParty": true }  乗った瞬間に移動' },
    { k: 'npcs', label: 'NPC npcs', type: 'array', hint: '{ "id", "x", "y", "dir", "look": {...}, "move": "still|turn|wander", "dialog": [...] } / "heal": true / "action": "gacha" / "trainer": "ID", "sight": 4' },
    { k: 'signs', label: '看板 signs', type: 'array', hint: '{ "x", "y", "text": ["1ページ目", "2ページ目"] }' },
    { k: 'pickups', label: '落ちているポイント pickups', type: 'array', hint: '{ "id": 全マップで一意, "x", "y", "points": 50 }' },
    { k: 'encounters', label: '野生モンスター encounters', type: 'object', hint: '{ "rate": 0.12, "table": [ { "species": "ID", "min": 2, "max": 4, "weight": 50 } ] }  空欄 = 出現なし' },
  ];
  const hasTiles = () => !!(App.tiles && typeof App.tiles.draw === 'function');
  function curMap() { return S.sel.map ? mapsObj()[S.sel.map] : null; }
  function mapSize(m) {
    const rows = m && Array.isArray(m.tiles) ? m.tiles : [];
    return { w: rows.length ? Math.max(...rows.map((r) => String(r).length)) : 0, h: rows.length };
  }
  function tileAt(m, x, y) {
    const rows = m.tiles;
    if (y < 0 || y >= rows.length) return m.border || 'V';
    const r = String(rows[y]);
    return x >= 0 && x < r.length ? r[x] : (m.border || 'V');
  }
  function tileDef(ch) { return App.data.tile(ch); }
  function drawTile(ctx, ch, px, py, at) {
    if (hasTiles()) {
      try { App.tiles.draw(ctx, ch, px, py, 0, at); return; } catch (e) {
        if (!Mp.tileErr) { Mp.tileErr = true; console.warn('[editor] App.tiles.draw で例外（簡易表示にします）', e); }
      }
    }
    const def = tileDef(ch);
    const img = def.image && App.sprites.getImage ? App.sprites.getImage(def.image) : null;
    if (img) { ctx.drawImage(img, px, py, 16, 16); return; }
    ctx.fillStyle = TILE_FALLBACK[def.draw] || '#555';
    ctx.fillRect(px, py, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, px + 8, py + 8.5);
  }
  function tileIcon(ch) {
    const cv = el('canvas', { width: 16, height: 16 });
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, ch, 0, 0, () => ch);
    return cv;
  }
  function npcLook(n) {
    if (n && n.trainer && trainersObj()[n.trainer]) return trainersObj()[n.trainer].look;
    return n && n.look;
  }

  Mp.render = function (main) {
    const ids = Object.keys(mapsObj());
    if (!S.sel.map || !hasOwn(mapsObj(), S.sel.map)) S.sel.map = ids[0] || null;
    if (!hasOwn(G().tiles || {}, S.map.tile)) S.map.tile = Object.keys(G().tiles || {})[0] || '.';
    const mapSel = selectBox(ids.map((id) => ({ v: id, label: id + ' — ' + ((mapsObj()[id] || {}).name || '') })), S.sel.map, (v) => { S.sel.map = v; rerender(); }, { id: 'ed-map-select', style: 'width:auto;min-width:220px' });
    main.appendChild(sectionHead('マップ', mapSel,
      btn('＋ 新規', Mp.create, 'btn-gold btn-sm'),
      S.sel.map ? btn('複製', Mp.duplicate, 'btn-sm') : null,
      S.sel.map ? btn('削除', Mp.remove, 'btn-sm btn-danger') : null,
      revertButton('maps')));
    const m = curMap();
    if (!m) { main.appendChild(el('div', { class: 'card ed-empty', text: 'マップがありません。「＋ 新規」で追加してください' })); return; }
    if (!Array.isArray(m.tiles) || !m.tiles.length) m.tiles = ['.'];
    if (!hasTiles()) main.appendChild(el('p', { class: 'chip chip-warn', style: 'margin:0 0 10px', text: 'js/gfx/tiles.js が読み込まれていないため、タイルを簡易表示しています' }));

    // ---- 左: キャンバス
    refs.mapCanvas = el('canvas', { id: 'ed-map-canvas' });
    refs.mapInfo = el('div', { class: 'ed-map-info', text: 'マップ上にマウスを置くと座標と内容を表示します' });
    const tools = [['pen', '✎ ペン'], ['fill', '▧ 塗りつぶし'], ['pick', '⊙ スポイト'], ['start', '★ 開始位置']];
    const toolBtns = el('span', { class: 'ed-row nowrap' });
    tools.forEach(([id, label]) => toolBtns.appendChild(btn(label, () => { S.map.tool = id; toolBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('btn-primary', b.dataset.tool === id)); }, 'btn-sm' + (S.map.tool === id ? ' btn-primary' : ''), { dataset: { tool: id } })));
    const toolbar = el('div', { class: 'ed-map-toolbar' },
      toolBtns,
      btn('↶ 元に戻す', Mp.doUndo, 'btn-sm btn-ghost', { title: 'タイル編集を1つ戻す（Ctrl+Z）', id: 'ed-map-undo' }),
      el('span', { class: 'small dim', text: '拡大' }),
      selectBox([1, 2, 3, 4].map((z) => ({ v: z, label: z + 'x' })), S.map.zoom, (v) => { S.map.zoom = Number(v); Mp.draw(); }, { style: 'width:auto' }),
      checkBox('グリッド', S.map.grid, (c) => { S.map.grid = c; Mp.draw(); }),
      el('span', { class: 'small muted', text: '左ドラッグ: 塗る / 右クリック: スポイト' }));
    const legend = el('div', { class: 'ed-legend' },
      el('span', {}, el('i', { style: 'border-color:#c070ff' }), 'ワープ'),
      el('span', {}, el('i', { style: 'border-color:#52dcff' }), 'NPC'),
      el('span', {}, el('i', { style: 'border-color:#ff4f6d' }), 'トレーナー（薄赤 = 視線）'),
      el('span', {}, el('i', { style: 'border-color:#ffd84d' }), '看板'),
      el('span', {}, el('i', { style: 'border-color:#ffa51f' }), 'ポイント'),
      el('span', {}, el('i', { style: 'border-color:#3ee08f' }), '開始位置 ★'));
    const left = el('div', {}, toolbar, el('div', { class: 'ed-map-wrap' }, refs.mapCanvas), refs.mapInfo, legend);

    // ---- 右: パレット・設定
    refs.palette = el('div', { class: 'ed-palette', id: 'ed-palette' });
    refs.tileName = el('div', { class: 'ed-tilename' });
    Object.keys(G().tiles || {}).forEach((ch) => {
      const def = G().tiles[ch] || {};
      refs.palette.appendChild(el('button', {
        class: 'ed-tilebtn' + (ch === S.map.tile ? ' is-active' : ''), type: 'button', title: ch + ' ' + (def.name || ''), dataset: { ch },
        onclick: () => Mp.selectTile(ch),
      }, tileIcon(ch), el('span', { class: 'sym', text: ch })));
    });
    Mp.selectTile(S.map.tile);

    const right = el('div', {},
      card('タイル（data/tiles.js）', refs.palette, refs.tileName),
      Mp.propsCard(m),
      Mp.sizeCard(m),
      Mp.startCard());
    main.appendChild(el('div', { class: 'ed-map-layout' }, left, right));

    // ---- 下: JSON
    refs.jsonAreas = {};
    const jsonCard = card('マップ上のオブジェクト（JSONで編集。入力すると自動で反映）',
      el('p', { class: 'ed-hint', text: '座標 x, y は左上が (0, 0)。マップ上にマウスを置くと座標が分かります。構文エラーがある間は反映されません。' }),
      el('div', { class: 'ed-grid cols-2' }, MAP_JSON.map((spec) => Mp.jsonBlock(m, spec))));
    main.appendChild(jsonCard);

    Mp.bindCanvas();
    Mp.draw();
  };

  Mp.selectTile = function (ch) {
    S.map.tile = ch;
    if (refs.palette) refs.palette.querySelectorAll('.ed-tilebtn').forEach((b) => b.classList.toggle('is-active', b.dataset.ch === ch));
    const def = (G().tiles || {})[ch] || {};
    if (refs.tileName) {
      refs.tileName.textContent = '選択中: 「' + ch + '」 ' + (def.name || '') + ' — ' + [def.walk ? '歩ける' : '歩けない', def.encounter ? '野生が出る' : '', def.counter ? 'カウンター' : '', def.overlay ? '草むら表示' : ''].filter(Boolean).join('・');
    }
  };

  Mp.propsCard = function (m) {
    const idInput = inputText(S.sel.map, null, { class: 'input mono' });
    const idField = field('マップID', idInput, { hint: 'ワープの to と開始位置が参照します' });
    idInput.addEventListener('change', () => Mp.rename(idInput, idField));
    const bgmOpts = BGMS.map((b) => ({ v: b, label: b }));
    if (m.bgm && !BGMS.includes(m.bgm)) bgmOpts.push({ v: m.bgm, label: m.bgm });
    const tileOpts = Object.keys(G().tiles || {}).map((ch) => ({ v: ch, label: ch + ' ' + ((G().tiles[ch] || {}).name || '') }));
    return card('マップの設定',
      el('div', { class: 'ed-grid cols-2' },
        idField,
        field('名前 name', inputText(m.name, (v) => { m.name = v; touched(); })),
        field('BGM', selectBox([{ v: '', label: '（なし）' }].concat(bgmOpts), m.bgm || '', (v) => { setOpt(m, 'bgm', v); touched(); })),
        field('外側のタイル border', selectBox(tileOpts, m.border || '', (v) => { m.border = v; touched(); Mp.draw(); })),
        field('室内', checkBox('室内マップ indoor', !!m.indoor, (c) => { m.indoor = c; touched(); }))));
  };

  Mp.sizeCard = function (m) {
    const sz = mapSize(m);
    const vals = { w: sz.w, h: sz.h };
    const anchorSel = selectBox([{ v: 'br', label: '右・下で増減' }, { v: 'tl', label: '左・上で増減（オブジェクトもずらす）' }], S.map.anchor, (v) => { S.map.anchor = v; });
    return card('サイズ',
      el('div', { class: 'ed-grid cols-2' },
        field('幅（マス）', inputNum(vals.w, (v) => { vals.w = v; }, { min: 1, max: 200, step: 1, id: 'ed-map-w' })),
        field('高さ（マス）', inputNum(vals.h, (v) => { vals.h = v; }, { min: 1, max: 200, step: 1, id: 'ed-map-h' })),
        field('増減する側', anchorSel, { cls: 'span-all' })),
      el('div', { class: 'ed-row', style: 'margin-top:8px' },
        btn('サイズを変更', () => Mp.resize(Math.floor(vals.w), Math.floor(vals.h)), 'btn-sm btn-primary', { id: 'ed-map-resize' }),
        el('span', { class: 'ed-hint', text: '増えたマスは選択中のタイルで埋めます' })));
  };

  Mp.startCard = function () {
    const ws = isObj(G().worldStart) ? G().worldStart : (G().worldStart = { map: S.sel.map, x: 0, y: 0, dir: 'down' });
    refs.wsInputs = {};
    const mapOpts = Object.keys(mapsObj()).map((id) => ({ v: id, label: id }));
    refs.wsInputs.x = inputNum(ws.x, (v) => { ws.x = v === undefined ? 0 : Math.floor(v); touched(); Mp.draw(); }, { min: 0, step: 1 });
    refs.wsInputs.y = inputNum(ws.y, (v) => { ws.y = v === undefined ? 0 : Math.floor(v); touched(); Mp.draw(); }, { min: 0, step: 1 });
    refs.wsInputs.map = selectBox(mapOpts, ws.map, (v) => { ws.map = v; touched(); Mp.draw(); });
    return card('ニューゲームの開始位置 worldStart',
      el('div', { class: 'ed-grid cols-2' },
        field('マップ', refs.wsInputs.map),
        field('向き', selectBox(DIRS, ws.dir || 'down', (v) => { ws.dir = v; touched(); })),
        field('x', refs.wsInputs.x),
        field('y', refs.wsInputs.y)),
      el('p', { class: 'ed-hint', text: '「★ 開始位置」ツールでマップをクリックしても設定できます。' }));
  };

  Mp.jsonText = function (v, type) {
    if (type === 'array') {
      if (!Array.isArray(v) || !v.length) return '[]';
      return '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]';
    }
    if (!isObj(v)) return '';
    const ks = Object.keys(v);
    return '{\n' + ks.map((k) => {
      const val = v[k];
      if (Array.isArray(val) && val.length) return '  ' + JSON.stringify(k) + ': [\n' + val.map((x) => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]';
      return '  ' + JSON.stringify(k) + ': ' + JSON.stringify(val);
    }).join(',\n') + '\n}';
  };
  Mp.jsonBlock = function (m, spec) {
    const status = el('div', { class: 'ed-json-status muted', text: ' ' });
    const ta = textArea(Mp.jsonText(m[spec.k], spec.type), null, { class: 'textarea mono', rows: 6, dataset: { json: spec.k } });
    let timer = null;
    const apply = () => {
      const txt = ta.value.trim();
      let val;
      if (!txt) {
        val = spec.type === 'array' ? [] : undefined;
      } else {
        try {
          val = JSON.parse(txt);
        } catch (e) {
          const pos = /position (\d+)/.exec(e.message);
          const line = pos ? txt.slice(0, Number(pos[1])).split('\n').length : null;
          status.className = 'ed-json-status ng';
          status.textContent = '✖ 構文エラー' + (line ? '（' + line + '行目付近）' : '') + ': ' + e.message;
          ta.classList.add('is-bad');
          return;
        }
        if (spec.type === 'array' && !Array.isArray(val)) { status.className = 'ed-json-status ng'; status.textContent = '✖ [ ... ] の配列にしてください'; ta.classList.add('is-bad'); return; }
        if (spec.type === 'object' && !isObj(val)) { status.className = 'ed-json-status ng'; status.textContent = '✖ { ... } のオブジェクトにしてください'; ta.classList.add('is-bad'); return; }
      }
      const mm = curMap();
      if (!mm) return;
      if (val === undefined) delete mm[spec.k]; else mm[spec.k] = val;
      ta.classList.remove('is-bad');
      status.className = 'ed-json-status ok';
      status.textContent = '✓ 反映しました（' + (Array.isArray(val) ? val.length + ' 件' : (val ? 'あり' : 'なし')) + '）';
      touched();
      Mp.draw();
    };
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 350); });
    ta.addEventListener('blur', () => { clearTimeout(timer); apply(); });
    refs.jsonAreas[spec.k] = { ta, spec, status };
    return el('div', { class: 'ed-field ed-json-block span-all' }, el('label', { text: spec.label }), ta, status, el('div', { class: 'ed-hint', text: spec.hint }));
  };
  Mp.refreshJson = function () {
    const m = curMap();
    if (!m || !refs.jsonAreas) return;
    Object.keys(refs.jsonAreas).forEach((k) => {
      const a = refs.jsonAreas[k];
      if (document.activeElement === a.ta) return;
      a.ta.value = Mp.jsonText(m[k], a.spec.type);
      a.ta.classList.remove('is-bad');
    });
  };

  Mp.draw = function () {
    const cv = refs.mapCanvas;
    const m = curMap();
    if (!cv || !m) return;
    const z = S.map.zoom || 2;
    const T = 16;
    const { w, h } = mapSize(m);
    cv.width = Math.max(1, w * T * z);
    cv.height = Math.max(1, h * T * z);
    const ctx = cv.getContext('2d');
    ctx.setTransform(z, 0, 0, z, 0, 0);
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = tileAt(m, x, y);
        drawTile(ctx, ch, x * T, y * T, (dx, dy) => tileAt(m, x + dx, y + dy));
      }
    }
    const box = (x, y, color, fill) => {
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x * T, y * T, T, T); }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.strokeRect(x * T + 1, y * T + 1, T - 2, T - 2);
    };
    const label = (x, y, text, color) => {
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#000'; ctx.fillText(text, x * T + 2.5, y * T + 2.5);
      ctx.fillStyle = color; ctx.fillText(text, x * T + 2, y * T + 2);
    };
    const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    (Array.isArray(m.npcs) ? m.npcs : []).forEach((n) => {
      if (!n || !n.trainer || !n.sight) return;
      const d = DV[n.dir] || DV.down;
      for (let i = 1; i <= n.sight; i++) { ctx.fillStyle = 'rgba(255,79,109,0.22)'; ctx.fillRect((n.x + d[0] * i) * T, (n.y + d[1] * i) * T, T, T); }
    });
    (Array.isArray(m.warps) ? m.warps : []).forEach((wp) => { if (wp) { box(wp.x, wp.y, '#c070ff', 'rgba(192,112,255,0.25)'); label(wp.x, wp.y, 'W', '#f0d0ff'); } });
    (Array.isArray(m.signs) ? m.signs : []).forEach((s) => { if (s) box(s.x, s.y, '#ffd84d'); });
    (Array.isArray(m.pickups) ? m.pickups : []).forEach((p) => {
      if (!p) return;
      ctx.fillStyle = '#ffa51f';
      ctx.beginPath(); ctx.moveTo(p.x * T + 8, p.y * T + 3); ctx.lineTo(p.x * T + 13, p.y * T + 8); ctx.lineTo(p.x * T + 8, p.y * T + 13); ctx.lineTo(p.x * T + 3, p.y * T + 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 1; ctx.stroke();
    });
    (Array.isArray(m.npcs) ? m.npcs : []).forEach((n) => {
      if (!n) return;
      try { App.sprites.drawCharacter(ctx, n.x * T, n.y * T, n.dir || 'down', 0, npcLook(n)); } catch (e) { /* 無視 */ }
      box(n.x, n.y, n.trainer ? '#ff4f6d' : '#52dcff');
      if (n.heal) label(n.x, n.y, '+', '#ff9fc8');
      if (n.action === 'gacha') label(n.x, n.y, 'G', '#ffd84d');
    });
    const ws = G().worldStart;
    if (isObj(ws) && ws.map === S.sel.map) { box(ws.x, ws.y, '#3ee08f', 'rgba(62,224,143,0.25)'); label(ws.x, ws.y, '★', '#c8ffe0'); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (S.map.grid && z >= 2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < w; x++) { ctx.moveTo(x * T * z + 0.5, 0); ctx.lineTo(x * T * z + 0.5, cv.height); }
      for (let y = 1; y < h; y++) { ctx.moveTo(0, y * T * z + 0.5); ctx.lineTo(cv.width, y * T * z + 0.5); }
      ctx.stroke();
    }
  };
  const drawSoon = throttleFrame(() => Mp.draw());

  Mp.cellFromEvent = function (e) {
    const cv = refs.mapCanvas;
    const r = cv.getBoundingClientRect();
    const size = 16 * (S.map.zoom || 2) * (r.width / cv.width || 1);
    return { x: Math.floor((e.clientX - r.left) / size), y: Math.floor((e.clientY - r.top) / size) };
  };
  Mp.describe = function (x, y) {
    const m = curMap();
    const { w, h } = mapSize(m);
    if (x < 0 || y < 0 || x >= w || y >= h) return '';
    const ch = tileAt(m, x, y);
    const parts = ['(' + x + ', ' + y + ')', '「' + ch + '」' + ((tileDef(ch) || {}).name || '')];
    (m.warps || []).forEach((wp) => { if (wp && wp.x === x && wp.y === y) parts.push('ワープ → ' + wp.to + ' (' + wp.tx + ',' + wp.ty + ')'); });
    (m.npcs || []).forEach((n) => { if (n && n.x === x && n.y === y) parts.push('NPC ' + (n.id || '') + (n.trainer ? ' [トレーナー ' + n.trainer + ']' : '') + (n.heal ? ' [回復]' : '') + (n.action ? ' [' + n.action + ']' : '')); });
    (m.signs || []).forEach((s) => { if (s && s.x === x && s.y === y) parts.push('看板 「' + (Array.isArray(s.text) ? s.text[0] : s.text) + '」'); });
    (m.pickups || []).forEach((p) => { if (p && p.x === x && p.y === y) parts.push('ポイント ' + p.points + 'pt (' + p.id + ')'); });
    const ws = G().worldStart;
    if (isObj(ws) && ws.map === S.sel.map && ws.x === x && ws.y === y) parts.push('★ 開始位置');
    return parts.join('  |  ');
  };
  Mp.pushUndo = function () {
    const m = curMap();
    Mp.undo.push({ map: S.sel.map, tiles: m.tiles.slice() });
    if (Mp.undo.length > 60) Mp.undo.shift();
  };
  Mp.doUndo = function () {
    const u = Mp.undo.pop();
    if (!u) { toast('元に戻せる操作はありません', 'info'); return; }
    const m = mapsObj()[u.map];
    if (!m) return;
    m.tiles = u.tiles;
    if (u.map !== S.sel.map) { S.sel.map = u.map; rerender(); return; }
    touched();
    Mp.draw();
  };
  Mp.paint = function (x, y) {
    const m = curMap();
    const { w, h } = mapSize(m);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const row = String(m.tiles[y]);
    if (row[x] === S.map.tile) return false;
    m.tiles[y] = (row.length < w ? row.padEnd(w, S.map.tile) : row).slice(0, x) + S.map.tile + row.slice(x + 1);
    return true;
  };
  Mp.fill = function (x, y) {
    const m = curMap();
    const { w, h } = mapSize(m);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const grid = m.tiles.map((r) => String(r).padEnd(w, ' ').split(''));
    const target = grid[y][x];
    const to = S.map.tile;
    if (target === to) return false;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h || grid[cy][cx] !== target) continue;
      grid[cy][cx] = to;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    m.tiles = grid.map((r) => r.join('').replace(/ +$/, ''));
    return true;
  };
  Mp.bindCanvas = function () {
    const cv = refs.mapCanvas;
    let dragging = false;
    let strokeChanged = false;
    const act = (e, first) => {
      const { x, y } = Mp.cellFromEvent(e);
      const m = curMap();
      const { w, h } = mapSize(m);
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      if (e.button === 2 || S.map.tool === 'pick') {
        if (first) Mp.selectTile(tileAt(m, x, y));
        return;
      }
      if (S.map.tool === 'pen') {
        if (Mp.paint(x, y)) { strokeChanged = true; drawSoon(); }
      } else if (S.map.tool === 'fill' && first) {
        if (Mp.fill(x, y)) { strokeChanged = true; Mp.draw(); }
      } else if (S.map.tool === 'start' && first) {
        const ws = G().worldStart = isObj(G().worldStart) ? G().worldStart : { dir: 'down' };
        ws.map = S.sel.map; ws.x = x; ws.y = y;
        if (refs.wsInputs) { refs.wsInputs.x.value = x; refs.wsInputs.y.value = y; refs.wsInputs.map.value = S.sel.map; }
        touched();
        Mp.draw();
        toast('開始位置を ' + S.sel.map + ' (' + x + ', ' + y + ') にしました', 'success');
      }
    };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.button === 0 && (S.map.tool === 'pen' || S.map.tool === 'fill')) Mp.pushUndo();
      strokeChanged = false;
      dragging = e.button === 0 && S.map.tool === 'pen';
      if (dragging) { try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ } }
      act(e, true);
      if (!dragging) finish();
    });
    cv.addEventListener('pointermove', (e) => {
      const { x, y } = Mp.cellFromEvent(e);
      refs.mapInfo.textContent = Mp.describe(x, y) || ' ';
      if (dragging) act(e, false);
    });
    const finish = () => {
      if (strokeChanged) touched();
      else if (Mp.undo.length && (S.map.tool === 'pen' || S.map.tool === 'fill')) {
        const last = Mp.undo[Mp.undo.length - 1];
        const m = curMap();
        if (m && last.map === S.sel.map && last.tiles.join('\n') === m.tiles.join('\n')) Mp.undo.pop();
      }
      strokeChanged = false;
    };
    cv.addEventListener('pointerup', () => { if (dragging) { dragging = false; finish(); } });
    cv.addEventListener('pointercancel', () => { dragging = false; finish(); });
  };

  Mp.resize = function (nw, nh) {
    const m = curMap();
    if (!(nw >= 1 && nh >= 1 && nw <= 200 && nh <= 200)) { toast('幅・高さは 1〜200 にしてください', 'error'); return; }
    const { w, h } = mapSize(m);
    if (nw === w && nh === h) { toast('サイズは変わっていません', 'info'); return; }
    Mp.pushUndo();
    const tl = S.map.anchor === 'tl';
    const dx = tl ? nw - w : 0, dy = tl ? nh - h : 0;
    const rows = [];
    for (let y = 0; y < nh; y++) {
      let r = '';
      for (let x = 0; x < nw; x++) {
        const sx = x - dx, sy = y - dy;
        r += sx >= 0 && sy >= 0 && sx < w && sy < h ? tileAt(m, sx, sy) : S.map.tile;
      }
      rows.push(r);
    }
    m.tiles = rows;
    if (dx || dy) {
      ['warps', 'npcs', 'signs', 'pickups'].forEach((k) => (Array.isArray(m[k]) ? m[k] : []).forEach((o) => { if (isObj(o)) { o.x += dx; o.y += dy; } }));
      Object.keys(mapsObj()).forEach((mid) => (Array.isArray((mapsObj()[mid] || {}).warps) ? mapsObj()[mid].warps : []).forEach((wp) => {
        if (wp && wp.to === S.sel.map) { wp.tx += dx; wp.ty += dy; }
      }));
      const ws = G().worldStart;
      if (isObj(ws) && ws.map === S.sel.map) { ws.x += dx; ws.y += dy; }
    }
    let out = 0;
    ['warps', 'npcs', 'signs', 'pickups'].forEach((k) => (Array.isArray(m[k]) ? m[k] : []).forEach((o) => { if (o && (o.x < 0 || o.y < 0 || o.x >= nw || o.y >= nh)) out++; }));
    touched();
    rerender();
    toast('サイズを ' + nw + ' x ' + nh + ' に変更しました' + (out ? '（マップ外になったオブジェクトが ' + out + ' 個あります）' : ''), out ? 'warn' : 'success', 4000);
  };

  function mapRefs(id) {
    const out = [];
    Object.keys(mapsObj()).forEach((mid) => {
      if (mid === id) return;
      (Array.isArray((mapsObj()[mid] || {}).warps) ? mapsObj()[mid].warps : []).forEach((wp) => { if (wp && wp.to === id) out.push('マップ ' + mid + ' のワープ (' + wp.x + ',' + wp.y + ')'); });
    });
    if (isObj(G().worldStart) && G().worldStart.map === id) out.push('ニューゲームの開始位置 worldStart');
    return out;
  }
  Mp.rename = async function (input, fieldEl) {
    const oldId = S.sel.map;
    const newId = input.value.trim();
    const setHint = (t, bad) => { fieldEl._hint.textContent = t; fieldEl._hint.classList.toggle('ng', !!bad); input.classList.toggle('is-bad', !!bad); };
    if (newId === oldId) return;
    if (!/^[A-Za-z0-9_]+$/.test(newId)) { setHint('英数字・_ だけにしてください（変更は反映されていません）', true); return; }
    if (hasOwn(mapsObj(), newId)) { setHint('この ID は ほかのマップが使っています（変更は反映されていません）', true); return; }
    G().maps = renameKey(mapsObj(), oldId, newId);
    Object.keys(mapsObj()).forEach((mid) => (Array.isArray((mapsObj()[mid] || {}).warps) ? mapsObj()[mid].warps : []).forEach((wp) => { if (wp && wp.to === oldId) wp.to = newId; }));
    if (isObj(G().worldStart) && G().worldStart.map === oldId) G().worldStart.map = newId;
    Mp.undo.forEach((u) => { if (u.map === oldId) u.map = newId; });
    S.sel.map = newId;
    touched();
    rerender();
    toast('マップID を ' + oldId + ' → ' + newId + ' に変更しました（ワープ・開始位置も更新）', 'success', 3500);
  };
  Mp.create = async function () {
    const tiles = Object.keys(G().tiles || {});
    const vals = { id: uniqueId('map', (x) => hasOwn(mapsObj(), x)), name: '', w: 20, h: 15, base: tiles.includes('.') ? '.' : tiles[0], border: tiles.includes('T') ? 'T' : tiles[0] };
    const hint = el('div', { class: 'ed-hint' });
    const tileOpts = tiles.map((ch) => ({ v: ch, label: ch + ' ' + ((G().tiles[ch] || {}).name || '') }));
    const body = el('div', { class: 'ed-grid cols-2' },
      field('マップID', inputText(vals.id, (v) => { vals.id = v.trim(); }, { class: 'input mono' }), { req: true }),
      field('名前', inputText('', (v) => { vals.name = v; }, { placeholder: '例: 2ばんどうろ' }), { req: true }),
      field('幅', inputNum(vals.w, (v) => { vals.w = v; }, { min: 1, max: 200 })),
      field('高さ', inputNum(vals.h, (v) => { vals.h = v; }, { min: 1, max: 200 })),
      field('敷きつめるタイル', selectBox(tileOpts, vals.base, (v) => { vals.base = v; })),
      field('外側のタイル border', selectBox(tileOpts, vals.border, (v) => { vals.border = v; })),
      el('div', { class: 'ed-field span-all' }, hint));
    const ok = await modal({
      title: 'マップを新規追加', body,
      buttons: [{ label: 'キャンセル', value: false }, {
        label: '追加する', value: true, cls: 'btn-primary',
        check: () => {
          let msg = '';
          if (!/^[A-Za-z0-9_]+$/.test(vals.id)) msg = 'ID は英数字・_ だけにしてください';
          else if (hasOwn(mapsObj(), vals.id)) msg = 'この ID は既に使われています';
          else if (!(vals.w >= 1 && vals.h >= 1 && vals.w <= 200 && vals.h <= 200)) msg = '幅・高さは 1〜200 にしてください';
          hint.textContent = msg; hint.classList.toggle('ng', !!msg);
          return !msg;
        },
      }],
    });
    if (!ok) return;
    const w = Math.floor(vals.w), h = Math.floor(vals.h);
    mapsObj()[vals.id] = {
      name: vals.name || vals.id, bgm: 'route', border: vals.border, indoor: false,
      tiles: Array.from({ length: h }, () => vals.base.repeat(w)),
      warps: [], npcs: [], signs: [], pickups: [],
    };
    S.sel.map = vals.id;
    touched();
    rerender();
  };
  Mp.duplicate = function () {
    const id = S.sel.map;
    const newId = uniqueId(id + '_copy', (x) => hasOwn(mapsObj(), x));
    const copy = clone(mapsObj()[id]);
    copy.name = (copy.name || '') + 'コピー';
    const used = new Set();
    Object.keys(mapsObj()).forEach((mid) => (Array.isArray((mapsObj()[mid] || {}).pickups) ? mapsObj()[mid].pickups : []).forEach((p) => p && used.add(p.id)));
    (Array.isArray(copy.pickups) ? copy.pickups : []).forEach((p) => { if (p && p.id) { p.id = uniqueId(p.id + '_copy', (x) => used.has(x)); used.add(p.id); } });
    mapsObj()[newId] = copy;
    S.sel.map = newId;
    touched();
    rerender();
    toast('マップを複製しました（ID: ' + newId + '）', 'success');
  };
  Mp.remove = async function () {
    const id = S.sel.map;
    const rl = mapRefs(id);
    let mode;
    if (rl.length) {
      mode = await askRefs('マップの削除', 'マップ「' + id + '」を参照しているデータがあります。', rl, 'ワープも取り除いて削除', '削除する（参照は残す）');
      if (!mode) return;
    } else if (!(await confirmBox('マップ「' + id + '」を削除しますか？', { ok: '削除する', danger: true }))) return;
    if (mode === 'with') {
      Object.keys(mapsObj()).forEach((mid) => { const mm = mapsObj()[mid]; if (mm && Array.isArray(mm.warps)) mm.warps = mm.warps.filter((wp) => !(wp && wp.to === id)); });
    }
    delete mapsObj()[id];
    S.sel.map = null;
    touched();
    rerender();
  };

  // ==================================================================
  // 起動
  // ==================================================================
  const RENDER = { monsters: Mon.render, moves: Mv.render, gacha: Ga.render, trainers: Tr.render, types: Ty.render, maps: Mp.render };

  function startDialog(ov) {
    const keys = Object.keys(ov.obj).filter((k) => !k.startsWith('_'));
    const labels = keys.map((k) => { const sec = SECTIONS.find((s) => s.keys.includes(k)); return sec ? sec.label + '（' + k + '）' : k; });
    const body = el('div', {},
      el('p', { text: '以前「ゲームに一時反映」したデータが、このブラウザに保存されています。' }),
      el('p', { text: '保存日時: ' + (ov.obj._savedAt ? U().formatDateTime(ov.obj._savedAt) : '不明') }),
      el('p', { text: '対象: ' + (labels.join('、') || 'なし') }),
      el('p', { class: 'muted small', text: '「ファイルのデータから始める」を選んでも、一時反映データは「ゲームに一時反映」または「一時反映を解除」するまでゲーム側に残ります。' }));
    return modal({
      title: 'どちらのデータを編集しますか？', body, closable: false,
      buttons: [
        { label: 'ファイル（data/*.js）のデータから始める', value: 'file', id: 'ed-start-file' },
        { label: '一時反映データを読み込む', value: 'override', cls: 'btn-primary', id: 'ed-start-override' },
      ],
    });
  }

  async function boot() {
    const root = document.getElementById('ed-app');
    const missing = [];
    if (!window.GameData || !G().config) missing.push('data/config.js');
    if (!App.util) missing.push('js/core/util.js');
    if (!App.data) missing.push('js/core/data.js');
    if (!App.sprites) missing.push('js/gfx/sprites.js');
    if (missing.length) {
      root.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'ed-fatal';
      box.textContent = 'エディタを起動できません。次のファイルが読み込めませんでした: ' + missing.join(', ');
      root.appendChild(box);
      return;
    }
    try { App.sprites.init(); } catch (e) { console.warn('[editor] sprites.init で例外', e); }
    DATA_KEYS.forEach((k) => { S.snap[k] = clone(G()[k]); S.snapSig[k] = sig(k); });

    const params = new URLSearchParams(location.search);
    const ov = readOverride();
    let choice = params.get('start');
    if (ov && ov.broken) {
      choice = 'file';
      setTimeout(() => toast('一時反映データが壊れているため、ファイルのデータで起動しました', 'warn', 5000), 300);
    } else if (ov && choice !== 'file' && choice !== 'override') {
      choice = await startDialog(ov);
    }
    if (ov && !ov.broken && choice === 'override') {
      App.data.applyOverrides();
      S.loadedFrom = 'override';
    }
    DATA_KEYS.forEach((k) => {
      S.savedSig[k] = ov && ov.obj && hasOwn(ov.obj, k) ? JSON.stringify(ov.obj[k]) : S.snapSig[k];
    });

    buildShell(root);
    let sec = params.get('section');
    if (!sec) { try { sec = localStorage.getItem('gachamon_editor_section'); } catch (e) { sec = null; } }
    showSection(sec && RENDER[sec] ? sec : 'monsters');

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); applyToGame(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && S.section === 'maps' && !U().isTypingTarget(e.target)) { e.preventDefault(); Mp.doUndo(); }
    });
    window.addEventListener('beforeunload', (e) => {
      if (DATA_KEYS.some(isUnsaved)) { e.preventDefault(); e.returnValue = ''; }
    });
    App.editor.ready = true;
  }

  App.editor = {
    ready: false,
    init: boot,
    // テスト・開発用
    state: S,
    files: () => Object.keys(FILES),
    generate,
    selfTest,
    validate: runValidate,
    applyToGame,
    clearGameOverride,
    openExport,
    showSection,
    isChanged,
    changedKeys: () => DATA_KEYS.filter(isChanged),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
