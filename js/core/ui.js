// =====================================================================
// App.ui — トースト・モーダル・共通コンポーネント（タブ画面などの DOM 用）
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const U = () => App.util;

  const modalStack = [];
  let inited = false;

  const cssId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');
  const cssVal = (s) => String(s === undefined || s === null ? '' : s).replace(/[;{}<>]/g, '');

  function ensureRoot(id) {
    let root = document.getElementById(id);
    if (!root) {
      root = U().el('div', { id });
      document.body.appendChild(root);
    }
    return root;
  }

  // GameData.rarities / types から色 CSS を生成して注入
  function refreshStyles() {
    let st = document.getElementById('gm-dynamic-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'gm-dynamic-style';
      document.head.appendChild(st);
    }
    const GD = window.GameData || {};
    let css = '';
    const rar = GD.rarities || {};
    for (const id of Object.keys(rar)) {
      const r = rar[id] || {};
      css += `.rarity-${cssId(id)}{--rarity-color:${cssVal(r.color || '#888')};--rarity-glow:${cssVal(r.glow || r.color || '#ccc')};}\n`;
    }
    const types = GD.types || {};
    for (const id of Object.keys(types)) {
      const t = types[id] || {};
      css += `.type-${cssId(id)}{--type-color:${cssVal(t.color || '#888')};}\n`;
    }
    st.textContent = css;
  }

  // モーダル表示中のキー処理（window の capture で最初に受ける）
  //   Esc = 閉じる（closable 時） / Enter = 主ボタン。
  //   モーダル外が対象のキーはゲーム側（input.js 等）へ渡さない。モーダル内の要素へは通常どおり届く
  function onGlobalKey(e) {
    if (!modalStack.length) return;
    const topModal = modalStack[modalStack.length - 1];
    const inside = !!(topModal.root && e.target && topModal.root.contains(e.target));
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (topModal.closable) topModal.close(null);
    } else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (inside && (tag === 'textarea' || tag === 'button' || tag === 'a' || tag === 'select')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (topModal.primary) topModal.primary.click();
    } else if (!inside) {
      e.stopImmediatePropagation();
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    ensureRoot('modal-root');
    ensureRoot('toast-root');
    refreshStyles();
    window.addEventListener('keydown', onGlobalKey, true);
  }

  // ---------------------------------------------------------------- トースト
  const TOAST_ICON = { info: 'i', success: '✓', warn: '!', error: '×' };
  function toast(msg, opts) {
    opts = opts || {};
    const type = TOAST_ICON[opts.type] ? opts.type : 'info';
    const root = ensureRoot('toast-root');
    const t = U().el('div', { class: 'toast toast-' + type, role: 'status' },
      U().el('span', { class: 'toast-icon', text: TOAST_ICON[type] }),
      U().el('span', { class: 'toast-msg', text: msg }));
    root.appendChild(t);
    while (root.children.length > 4) root.firstElementChild.remove();
    const dur = opts.duration || 2400;
    const hide = () => {
      if (!t.isConnected) return;
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 260);
    };
    setTimeout(hide, dur);
    t.addEventListener('click', hide);
    return t;
  }

  // ---------------------------------------------------------------- モーダル
  // buttons: [{ label, value, primary?, danger?, gold?, onClick?() → false で閉じない }]
  //   value が関数ならクリック時に評価した値で閉じる
  function modal(opts) {
    opts = opts || {};
    const el = U().el;
    return new Promise((resolve) => {
      const root = ensureRoot('modal-root');
      const closable = opts.closable !== false;
      const buttons = Array.isArray(opts.buttons) && opts.buttons.length
        ? opts.buttons : [{ label: 'OK', value: true, primary: true }];
      let done = false;
      const entry = { closable, primary: null, close: null };

      const finish = (value) => {
        if (done) return;
        done = true;
        const i = modalStack.indexOf(entry);
        if (i >= 0) modalStack.splice(i, 1);
        backdrop.classList.add('is-closing');
        setTimeout(() => backdrop.remove(), 180);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) {
          try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* 無視 */ }
        }
        resolve(value === undefined ? null : value);
      };
      entry.close = finish;

      const btnEls = buttons.map((b) => {
        const cls = ['btn', b.primary ? 'btn-primary' : '', b.danger ? 'btn-danger' : '', b.gold ? 'btn-gold' : ''];
        const btn = el('button', { class: cls, type: 'button', text: b.label });
        btn.addEventListener('click', () => {
          if (typeof b.onClick === 'function' && b.onClick() === false) return;
          finish(typeof b.value === 'function' ? b.value() : b.value);
        });
        if (b.primary && !entry.primary) entry.primary = btn;
        return btn;
      });
      if (!entry.primary) entry.primary = btnEls[btnEls.length - 1];

      let bodyNode = null;
      if (opts.body instanceof Node) bodyNode = opts.body;
      else if (opts.body !== undefined && opts.body !== null && opts.body !== '') bodyNode = el('p', { class: 'modal-text', text: opts.body });

      const box = el('div', { class: ['modal', opts.className, opts.size ? 'modal-' + opts.size : ''], role: 'dialog', 'aria-modal': 'true' },
        opts.title ? el('div', { class: 'modal-header' },
          el('h2', { class: 'modal-title', text: opts.title }),
          closable ? el('button', { class: 'modal-close', type: 'button', 'aria-label': '閉じる', text: '×', onclick: () => finish(null) }) : null)
          : (closable ? el('button', { class: 'modal-close modal-close-float', type: 'button', 'aria-label': '閉じる', text: '×', onclick: () => finish(null) }) : null),
        bodyNode ? el('div', { class: 'modal-body' }, bodyNode) : null,
        el('div', { class: 'modal-footer' }, btnEls));
      const backdrop = el('div', { class: 'modal-backdrop' }, box);
      entry.root = backdrop;
      backdrop.addEventListener('pointerdown', (e) => { backdrop._downOnSelf = e.target === backdrop; });
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && backdrop._downOnSelf !== false && closable) finish(null);
      });

      const prevFocus = document.activeElement;
      modalStack.push(entry);
      root.appendChild(backdrop);
      const firstInput = box.querySelector('input:not([type=hidden]), textarea, select');
      setTimeout(() => {
        try {
          if (firstInput) { firstInput.focus(); if (firstInput.select) firstInput.select(); }
          else entry.primary.focus({ preventScroll: true });
        } catch (e) { /* 無視 */ }
      }, 30);
      if (typeof opts.onOpen === 'function') {
        try { opts.onOpen({ box, close: finish }); } catch (e) { console.error(e); }
      }
    });
  }

  function confirm(msg, opts) {
    opts = opts || {};
    return modal({
      title: opts.title || 'かくにん',
      body: msg,
      closable: true,
      buttons: [
        { label: opts.cancelLabel || 'キャンセル', value: false },
        { label: opts.okLabel || 'OK', value: true, primary: !opts.danger, danger: !!opts.danger },
      ],
    }).then((v) => v === true);
  }

  function prompt(msg, opts) {
    opts = opts || {};
    const el = U().el;
    const input = el('input', {
      class: 'input', type: 'text', value: opts.value !== undefined ? String(opts.value) : '',
      maxlength: opts.maxLength || null, placeholder: opts.placeholder || null, autocomplete: 'off', spellcheck: 'false',
    });
    const body = el('div', { class: 'prompt-body' },
      msg ? el('p', { class: 'modal-text', text: msg }) : null,
      input,
      opts.hint ? el('p', { class: 'prompt-hint', text: opts.hint }) : null);
    const closable = opts.closable !== false;
    const buttons = [];
    if (closable) buttons.push({ label: opts.cancelLabel || 'キャンセル', value: null });
    buttons.push({ label: opts.okLabel || 'OK', primary: true, value: () => input.value.trim() });
    return modal({ title: opts.title || '', body, buttons, closable });
  }

  function isModalOpen() { return modalStack.length > 0; }
  function closeModal(value) {
    const top = modalStack[modalStack.length - 1];
    if (top) top.close(value === undefined ? null : value);
  }

  // ---------------------------------------------------------------- バッジ類
  function rarityBadge(rarityId) {
    const r = App.data.rarity(rarityId);
    return U().el('span', {
      class: ['rarity-badge', 'rarity-' + cssId(rarityId), r && r.rainbow ? 'is-rainbow' : ''],
      title: r ? r.name : '', text: rarityId,
    });
  }

  function typeBadge(typeId) {
    const t = App.data.type(typeId);
    return U().el('span', { class: ['type-badge', 'type-' + cssId(typeId)], text: t ? t.name : typeId });
  }

  function stars(n, max) {
    const m = max === undefined ? Math.max(0, Number(((window.GameData || {}).gacha || {}).maxLimitBreak) || 5) : max;
    const v = Math.max(0, Math.min(m, Math.floor(Number(n) || 0)));
    const wrap = U().el('span', { class: 'stars', title: '限界突破 ' + v + ' / ' + m, 'aria-label': '限界突破 ' + v });
    for (let i = 0; i < m; i++) wrap.appendChild(U().el('span', { class: i < v ? 'star on' : 'star', text: i < v ? '★' : '☆' }));
    return wrap;
  }

  function hpBar(cur, max) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const cls = ratio > 0.5 ? 'hp-high' : (ratio > 0.2 ? 'hp-mid' : 'hp-low');
    return U().el('div', { class: ['hp-bar', cls], title: 'HP ' + cur + ' / ' + max },
      U().el('span', { class: 'hp-label', text: 'HP' }),
      U().el('span', { class: 'hp-track' }, U().el('span', { class: 'hp-fill', style: { width: (ratio * 100).toFixed(1) + '%' } })));
  }

  // ---------------------------------------------------------------- モンスターカード
  function spriteNode(def, silhouette) {
    const el = U().el;
    if (App.sprites && typeof App.sprites.monsterSprite === 'function') {
      try {
        const sp = App.sprites.monsterSprite(def, 'front');
        if (sp && sp.src) {
          const img = el('img', {
            class: ['mcard-img', sp.flip ? 'is-flip' : '', silhouette ? 'is-silhouette' : ''],
            src: sp.src, alt: '', draggable: 'false', loading: 'lazy',
          });
          img.addEventListener('error', () => { img.replaceWith(placeholderNode(def, silhouette)); }, { once: true });
          return img;
        }
      } catch (e) {
        console.warn('[ui] monsterSprite で例外', e);
      }
    }
    return placeholderNode(def, silhouette);
  }

  // 画像がないときの仮表示（タイプ色の丸 + 名前の頭文字）
  function placeholderNode(def, silhouette) {
    const t = def && def.types && App.data.type(def.types[0]);
    const t2 = def && def.types && App.data.type(def.types[1] || def.types[0]);
    return U().el('div', {
      class: ['mcard-ph', silhouette ? 'is-silhouette' : ''],
      style: { '--ph-a': (t && t.color) || '#8890b0', '--ph-b': (t2 && t2.color) || '#555a80' },
    }, U().el('span', { text: def && def.name ? Array.from(def.name)[0] : '?' }));
  }

  function monsterCard(instOrSpeciesId, opts) {
    opts = opts || {};
    const el = U().el;
    let inst = null;
    let def = null;
    if (typeof instOrSpeciesId === 'string') def = App.data.monster(instOrSpeciesId);
    else if (instOrSpeciesId && instOrSpeciesId.speciesId) { inst = instOrSpeciesId; def = App.data.monster(inst.speciesId); }
    else if (instOrSpeciesId && instOrSpeciesId.baseStats) def = instOrSpeciesId;
    const size = ['s', 'm', 'l'].includes(opts.size) ? opts.size : 'm';
    const unknown = !!opts.unknown || !def;
    const rid = def ? def.rarity : '';
    const r = def ? App.data.rarity(rid) : null;
    const card = el('div', {
      class: [
        'mcard', 'mcard-' + size, unknown ? 'is-unknown' : 'rarity-' + cssId(rid),
        !unknown && r && r.rainbow ? 'is-rainbow' : '',
        opts.selected ? 'is-selected' : '', opts.silhouette ? 'is-silhouette' : '',
        inst && App.monster && App.monster.isFainted(inst) && opts.showHp ? 'is-fainted' : '',
        opts.onClick ? 'is-clickable' : '',
      ],
      dataset: { species: def ? def.id : '' },
    });

    const art = el('div', { class: 'mcard-art' });
    if (unknown) art.appendChild(el('div', { class: 'mcard-ph is-unknown' }, el('span', { text: '?' })));
    else art.appendChild(spriteNode(def, !!opts.silhouette));
    if (!unknown && !opts.silhouette) art.appendChild(rarityBadge(rid));
    if (opts.badge) art.appendChild(el('span', { class: 'mcard-badge', text: opts.badge }));
    const showLv = opts.showLevel !== undefined ? !!opts.showLevel : size !== 's';
    if (inst && showLv) art.appendChild(el('span', { class: 'mcard-lv', text: 'Lv.' + inst.level }));

    const info = el('div', { class: 'mcard-info' });
    const name = unknown ? '？？？' : (inst ? App.monster.displayName(inst) : def.name);
    info.appendChild(el('div', { class: 'mcard-name', text: name, title: name }));
    if (!unknown && !opts.silhouette && size !== 's' && Array.isArray(def.types)) {
      info.appendChild(el('div', { class: 'mcard-types' }, def.types.map((t) => typeBadge(t))));
    }
    if (inst && !unknown && opts.showStars !== false) info.appendChild(stars(inst.limitBreak || 0));
    if (inst && opts.showHp) {
      const max = App.monster.stats(inst).hp;
      info.appendChild(hpBar(inst.hp, max));
    }
    card.appendChild(el('div', { class: 'mcard-frame' }, art));
    card.appendChild(info);

    if (typeof opts.onClick === 'function') {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.addEventListener('click', (e) => opts.onClick(e, inst || def));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(e, inst || def); }
      });
    }
    return card;
  }

  // ---------------------------------------------------------------- 開発パネル
  // messages: string[] | { errors, warnings } | [{ level: 'error'|'warn'|'info', text }]
  function devPanel(messages) {
    const el = U().el;
    let list = [];
    if (Array.isArray(messages)) {
      list = messages.map((m) => (typeof m === 'string' ? { level: 'warn', text: m } : { level: m.level || 'warn', text: String(m.text) }));
    } else if (messages && typeof messages === 'object') {
      (messages.errors || []).forEach((t) => list.push({ level: 'error', text: t }));
      (messages.warnings || []).forEach((t) => list.push({ level: 'warn', text: t }));
      (messages.infos || []).forEach((t) => list.push({ level: 'info', text: t }));
    } else if (messages) {
      list = [{ level: 'warn', text: String(messages) }];
    }
    if (!list.length) return null;
    let panel = document.getElementById('dev-panel');
    if (!panel) {
      panel = el('div', { id: 'dev-panel', class: 'dev-panel' },
        el('div', { class: 'dev-head' },
          el('span', { class: 'dev-title' }, '開発メッセージ ', el('b', { class: 'dev-count', text: '0' })),
          el('button', { class: 'dev-btn', type: 'button', text: '−', title: 'たたむ', onclick: () => panel.classList.toggle('is-collapsed') }),
          el('button', { class: 'dev-btn', type: 'button', text: '×', title: '閉じる', onclick: () => panel.remove() })),
        el('ul', { class: 'dev-list' }));
      document.body.appendChild(panel);
    }
    const ul = panel.querySelector('.dev-list');
    const existing = new Set(Array.from(ul.children).map((li) => li.dataset.key));
    for (const m of list) {
      const key = m.level + '|' + m.text;
      if (existing.has(key)) continue;
      existing.add(key);
      ul.appendChild(el('li', { class: 'dev-' + m.level, dataset: { key } },
        el('span', { class: 'dev-lv', text: m.level === 'error' ? 'ERR' : (m.level === 'info' ? 'INFO' : 'WARN') }),
        el('span', { class: 'dev-text', text: m.text })));
    }
    const errCount = ul.querySelectorAll('.dev-error').length;
    panel.querySelector('.dev-count').textContent = String(ul.children.length);
    panel.classList.toggle('has-error', errCount > 0);
    return panel;
  }

  // ---------------------------------------------------------------- 小物
  // ボタン生成ヘルパー: variant = 'primary'|'gold'|'danger'|''
  function button(label, opts) {
    opts = opts || {};
    return U().el('button', {
      class: ['btn', opts.variant ? 'btn-' + opts.variant : '', opts.size ? 'btn-' + opts.size : '', opts.className],
      type: 'button', disabled: !!opts.disabled, title: opts.title || null, onclick: opts.onClick || null,
    }, opts.icon ? U().el('span', { class: 'btn-icon', text: opts.icon }) : null, label);
  }

  App.ui = {
    init, toast, modal, confirm, prompt,
    rarityBadge, typeBadge, stars, hpBar, monsterCard, devPanel,
    // 追加
    refreshStyles, isModalOpen, closeModal, button,
  };
})();
