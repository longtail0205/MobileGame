// =====================================================================
// App.partyTab — 「へんせい」タブ
//   パーティ枠（並べ替え・はずす）/ ボックス（フィルタ・ソート）/ 詳細パネル（能力・わざ・ニックネーム）
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const U = () => App.util;
  const S = () => App.state;
  const M = () => App.monster;
  const D = () => App.data;
  const el = (...args) => App.util.el(...args);
  const cfg = () => (App.data && App.data.config) || {};
  const gachaCfg = () => (window.GameData && window.GameData.gacha) || {};
  const sfx = (n) => { try { if (App.audio && App.audio.play) App.audio.play(n); } catch (e) { /* 無視 */ } };
  const partyMax = () => Math.max(1, Number(cfg().partyMax) || 6);
  const cssId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

  const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const STAT_LABELS = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ' };
  const STATUS_INFO = {
    poison: { label: 'どく', cls: 'psn' },
    burn: { label: 'やけど', cls: 'brn' },
    paralyze: { label: 'まひ', cls: 'par' },
    sleep: { label: 'ねむり', cls: 'slp' },
    freeze: { label: 'こおり', cls: 'frz' },
  };
  const CATEGORY_LABELS = { physical: 'ぶつり', special: 'とくしゅ', status: 'へんか' };
  const SORTS = [
    { id: 'no', label: 'ずかんNo', desc: false },
    { id: 'rarity', label: 'レア度', desc: true },
    { id: 'level', label: 'レベル', desc: true },
    { id: 'obtained', label: 'にゅうしゅ順', desc: false },
  ];
  const WHERE = [['all', 'すべて'], ['in', 'パーティ'], ['out', 'ボックス']];
  const SEEN_FLAG = 'party.seenMoves';   // { speciesId: [確認済みの習得可能わざID] }
  const NICK_MAX = 10;

  let panel = null;
  let visible = false;
  let dirty = true;
  let renderQueued = false;
  let selectedId = null;
  let dragFrom = null;                     // { kind: 'party', index } | { kind: 'box', id }
  const filters = { rarity: new Set(), type: '', where: 'all', sort: 'no', desc: false };
  const refs = {};

  // ---------------------------------------------------------------- 共通ヘルパー
  function spriteImg(def, cls, view) {
    let sp = null;
    try { if (App.sprites && App.sprites.monsterSprite) sp = App.sprites.monsterSprite(def, view || 'front'); } catch (e) { sp = null; }
    if (!sp || !sp.src) {
      return el('div', { class: [cls, 'pt-noimg'] }, el('span', { text: def && def.name ? Array.from(def.name)[0] : '?' }));
    }
    const img = el('img', { class: [cls, sp.flip ? 'is-flip' : ''], src: sp.src, alt: '', draggable: 'false' });
    img.addEventListener('error', () => {
      img.replaceWith(el('div', { class: [cls, 'pt-noimg'] }, el('span', { text: def && def.name ? Array.from(def.name)[0] : '?' })));
    }, { once: true });
    return img;
  }

  function rarityClasses(def) {
    if (!def) return [];
    const r = D().rarity(def.rarity);
    return ['rarity-' + cssId(def.rarity), r && r.rainbow ? 'is-rainbow' : ''];
  }

  function statusChip(inst) {
    if (M().isFainted(inst)) return el('span', { class: 'pt-status st-fnt', text: 'ひんし' });
    const st = STATUS_INFO[inst.status];
    return st ? el('span', { class: 'pt-status st-' + st.cls, text: st.label }) : null;
  }

  function noText(def) { return 'No.' + String(def ? def.no : 0).padStart(3, '0'); }

  function notifyUpdated(inst) {
    S().save();
    if (App.events) App.events.emit('monster:updated', { speciesId: inst.speciesId });
  }

  // 種族の わざID → 最初に覚えるレベル
  // （進化後の種は系統の進化前の learnset も含める）
  function learnLevels(def) {
    const out = {};
    const fam = def && D().familyOf ? D().familyOf(def.id) : [];
    const idx = fam.indexOf(def && def.id);
    const defs = idx > 0 ? fam.slice(0, idx + 1).map((id) => D().monster(id)) : [def];
    for (const d of defs) {
      for (const l of (d && Array.isArray(d.learnset) ? d.learnset : [])) {
        if (!l || !l.move) continue;
        const lv = Number(l.lv) || 1;
        if (out[l.move] === undefined || lv < out[l.move]) out[l.move] = lv;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- NEWわざ判定
  function seenMap() {
    const f = S().flag(SEEN_FLAG);
    return f && typeof f === 'object' && !Array.isArray(f) ? f : null;
  }

  // 覚えられるが セットしていない「あたらしい」わざ
  function newMoves(inst) {
    if (!inst) return [];
    const learnable = M().learnableMoves(inst);
    const set = new Set((inst.moves || []).map((m) => m.id));
    const unset = learnable.filter((id) => !set.has(id));
    if (!unset.length) return [];
    const map = seenMap();
    const seen = map && Array.isArray(map[inst.speciesId]) ? map[inst.speciesId] : null;
    if (seen) return unset.filter((id) => !seen.includes(id));
    // 記録がない個体: セット中わざの最大習得Lvより後に覚えるわざを NEW とみなす
    const lv = learnLevels(M().species(inst));
    const maxSet = Math.max(0, ...(inst.moves || []).map((m) => lv[m.id] || 0));
    return unset.filter((id) => (lv[id] || 0) > maxSet);
  }

  function markMovesSeen(inst) {
    if (!inst) return;
    const map = Object.assign({}, seenMap() || {});
    const list = M().learnableMoves(inst);
    const prev = Array.isArray(map[inst.speciesId]) ? map[inst.speciesId] : [];
    if (prev.length === list.length && list.every((id) => prev.includes(id))) return;
    map[inst.speciesId] = list;
    S().setFlag(SEEN_FLAG, map);
  }

  function updateTabBadge() {
    if (!App.main || !App.main.setTabBadge || !S() || !S().data) return;
    let n = 0;
    try { n = S().ownedList().filter((i) => newMoves(i).length > 0).length; } catch (e) { n = 0; }
    App.main.setTabBadge('party', n ? 'NEW' : null);
  }

  // ---------------------------------------------------------------- 構築
  function init(panelEl) {
    panel = panelEl;
    if (!panel) return;
    panel.classList.add('pt-tab');
    build();
    const mark = () => markDirty();
    if (App.events) {
      App.events.on('collection:changed', (p) => {
        // 入手時点で覚えられるわざは「確認済み」として記録（NEW表示はレベルアップ後の新わざのみ）
        if (p && p.isNew && p.speciesId) markMovesSeen(S().owned(p.speciesId));
        // 進化: 確認済みわざの記録と選択中の個体を進化後の ID に引き継ぐ
        if (p && p.evolvedFrom && p.speciesId) {
          const map = seenMap();
          if (map && Array.isArray(map[p.evolvedFrom])) {
            const next = Object.assign({}, map);
            next[p.speciesId] = next[p.evolvedFrom];
            delete next[p.evolvedFrom];
            S().setFlag(SEEN_FLAG, next);
          }
          if (selectedId === p.evolvedFrom) selectedId = p.speciesId;
        }
        mark();
      });
      ['party:changed', 'monster:updated', 'state:loaded', 'state:reset', 'badges:changed'].forEach((ev) => App.events.on(ev, mark));
    }
    markDirty();
  }

  function build() {
    const ui = App.ui;
    // 所持0体のとき
    refs.empty = el('div', { class: 'panel pt-empty', hidden: true },
      el('div', { class: 'welcome-art pt-empty-art' }, el('span', { class: 'capsule' }), el('span', { class: 'capsule c2' }), el('span', { class: 'capsule c3' })),
      el('b', { text: 'ガチャで なかまを てにいれよう！' }),
      el('p', { class: 'muted', text: 'モンスターは ガチャで てにはいるよ。さいしょは むりょうで 3かい ひける！' }),
      ui.button('ガチャへ いく', { variant: 'gold', size: 'lg', icon: '◆', className: 'pt-goto-gacha', onClick: () => { sfx('confirm'); if (App.main) App.main.switchTab('gacha'); } }));

    // パーティ
    refs.partyCount = el('span', { class: 'pt-count' });
    refs.capInfo = el('span', { class: 'pt-cap', title: 'ジムバッジを あつめると レベルの じょうげんが あがります' });
    refs.partyList = el('div', { class: 'pt-party-list' });
    refs.party = el('section', { class: 'panel pt-party' },
      el('h3', { class: 'section-title' }, el('span', { class: 'section-icon', text: '★' }), 'パーティ', refs.partyCount, refs.capInfo,
        el('span', { class: 'pt-hint', text: 'ドラッグで ならびかえ' })),
      refs.partyList);

    // ボックス
    refs.boxCount = el('span', { class: 'pt-count' });
    refs.rarityChips = el('div', { class: 'pt-chips' }, D().rarityOrder().map((r) => {
      const b = el('button', { class: ['pt-chip', 'rarity-' + cssId(r)], type: 'button', text: r, dataset: { rarity: r }, 'aria-pressed': 'false' });
      b.addEventListener('click', () => {
        if (filters.rarity.has(r)) filters.rarity.delete(r); else filters.rarity.add(r);
        sfx('select');
        syncFilterUi();
        renderBox();
      });
      return b;
    }));
    refs.typeSelect = el('select', { class: 'pt-select pt-type-select', 'aria-label': 'タイプ' },
      el('option', { value: '', text: 'すべての タイプ' }),
      D().types().map((t) => el('option', { value: t, text: (D().type(t) || {}).name || t })));
    refs.typeSelect.addEventListener('change', () => { filters.type = refs.typeSelect.value; sfx('select'); renderBox(); });
    refs.whereSeg = el('div', { class: 'segmented pt-where' }, WHERE.map(([id, label]) => {
      const b = el('button', { class: 'seg-btn', type: 'button', text: label, dataset: { where: id } });
      b.addEventListener('click', () => { filters.where = id; sfx('select'); syncFilterUi(); renderBox(); });
      return b;
    }));
    refs.sortSelect = el('select', { class: 'pt-select pt-sort-select', 'aria-label': 'ならびかえ' },
      SORTS.map((s) => el('option', { value: s.id, text: s.label })));
    refs.sortSelect.addEventListener('change', () => {
      const s = SORTS.find((x) => x.id === refs.sortSelect.value) || SORTS[0];
      filters.sort = s.id;
      filters.desc = s.desc;
      sfx('select');
      syncFilterUi();
      renderBox();
    });
    refs.sortDir = el('button', { class: 'pt-sortdir', type: 'button', title: 'しょうじゅん / こうじゅん' });
    refs.sortDir.addEventListener('click', () => { filters.desc = !filters.desc; sfx('select'); syncFilterUi(); renderBox(); });
    refs.resetFilter = el('button', { class: 'pt-reset', type: 'button', text: 'リセット' });
    refs.resetFilter.addEventListener('click', () => {
      filters.rarity.clear(); filters.type = ''; filters.where = 'all';
      sfx('cancel'); syncFilterUi(); renderBox();
    });
    refs.boxGrid = el('div', { class: 'pt-grid' });
    refs.boxNone = el('div', { class: 'pt-none', hidden: true, text: 'じょうけんに あう モンスターが いません' });
    refs.box = el('section', { class: 'panel pt-box' },
      el('h3', { class: 'section-title' }, el('span', { class: 'section-icon', text: '▦' }), 'ボックス', refs.boxCount),
      el('div', { class: 'pt-filters' },
        el('div', { class: 'pt-frow' }, el('span', { class: 'pt-flabel', text: 'レア度' }), refs.rarityChips),
        el('div', { class: 'pt-frow' },
          el('span', { class: 'pt-flabel', text: 'しぼりこみ' }), refs.typeSelect, refs.whereSeg),
        el('div', { class: 'pt-frow' },
          el('span', { class: 'pt-flabel', text: 'ならびかえ' }), refs.sortSelect, refs.sortDir, refs.resetFilter)),
      refs.boxGrid, refs.boxNone);

    // 詳細
    refs.detail = el('aside', { class: 'panel pt-detail' });

    refs.layout = el('div', { class: 'pt-layout' }, refs.party, refs.detail, refs.box);
    panel.appendChild(el('div', { class: 'pt-root' }, refs.empty, refs.layout));
    syncFilterUi();
  }

  function syncFilterUi() {
    refs.rarityChips.querySelectorAll('.pt-chip').forEach((b) => {
      const on = filters.rarity.has(b.dataset.rarity);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    refs.typeSelect.value = filters.type;
    refs.whereSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.where === filters.where));
    refs.sortSelect.value = filters.sort;
    refs.sortDir.textContent = filters.desc ? '▼ こうじゅん' : '▲ しょうじゅん';
    refs.sortDir.classList.toggle('is-desc', filters.desc);
    const active = filters.rarity.size > 0 || filters.type !== '' || filters.where !== 'all';
    refs.resetFilter.hidden = !active;
  }

  // ---------------------------------------------------------------- 描画
  function markDirty() {
    dirty = true;
    if (renderQueued) return;
    renderQueued = true;
    Promise.resolve().then(() => {
      renderQueued = false;
      updateTabBadge();
      if (visible && dirty) render();
    });
  }

  function render() {
    if (!panel || !S() || !S().data) return;
    dirty = false;
    const count = S().ownedCount();
    refs.empty.hidden = count > 0;
    refs.layout.hidden = count === 0;
    if (!count) { selectedId = null; return; }
    if (!selectedId || !S().owned(selectedId)) {
      const ids = S().partyIds();
      selectedId = ids.length ? ids[0] : S().ownedList()[0].speciesId;
    }
    renderParty();
    renderBox();
    renderDetail();
  }

  function select(id, opts) {
    if (!S().owned(id)) return;
    const changed = selectedId !== id;
    selectedId = id;
    if (changed) sfx('select');
    refs.partyList.querySelectorAll('.pt-slot').forEach((s) => s.classList.toggle('is-selected', s.dataset.species === id));
    refs.boxGrid.querySelectorAll('.mcard').forEach((c) => c.classList.toggle('is-selected', c.dataset.species === id));
    renderDetail();
    // 1カラム表示のときは詳細パネルを見える位置へ
    if (opts && opts.scroll && changed && window.matchMedia && window.matchMedia('(max-width: 959px)').matches) {
      const r = refs.detail.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) {
        try { refs.detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* 無視 */ }
      }
    }
  }

  // ---------------------------------------------------------------- パーティ枠
  function renderParty() {
    const ids = S().partyIds();
    const max = partyMax();
    refs.partyCount.textContent = ids.length + ' / ' + max;
    const badgeTotal = (window.GameData && Array.isArray(window.GameData.badges)) ? window.GameData.badges.length : 0;
    refs.capInfo.hidden = !S().levelCap;
    if (S().levelCap) refs.capInfo.textContent = 'Lv上限 ' + S().levelCap() + (badgeTotal ? '（バッジ ' + S().badgeCount() + '/' + badgeTotal + '）' : '');
    const nodes = [];
    for (let i = 0; i < max; i++) {
      const inst = ids[i] ? S().owned(ids[i]) : null;
      nodes.push(inst ? partySlot(inst, i, ids.length) : emptySlot(i));
    }
    refs.partyList.replaceChildren(...nodes);
  }

  function partySlot(inst, i, n) {
    const def = M().species(inst);
    const st = M().stats(inst);
    const fainted = M().isFainted(inst);
    const nm = M().displayName(inst);
    const actBtn = (cls, text, title, disabled, fn) => {
      const b = el('button', { class: ['pt-act', cls], type: 'button', text, title, 'aria-label': title, disabled });
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const hasNew = newMoves(inst).length > 0;
    const slot = el('div', {
      class: ['pt-slot', ...rarityClasses(def), fainted ? 'is-fainted' : '', inst.speciesId === selectedId ? 'is-selected' : ''],
      draggable: 'true', tabindex: '0', role: 'button',
      dataset: { index: String(i), species: inst.speciesId },
    },
    el('span', { class: 'pt-slot-no', text: String(i + 1) }),
    el('div', { class: 'pt-slot-art' }, spriteImg(def, 'pt-slot-img'), i === 0 ? el('span', { class: 'pt-lead', text: 'せんとう' }) : null),
    el('div', { class: 'pt-slot-main' },
      el('div', { class: 'pt-slot-top' },
        el('span', { class: 'pt-slot-name', text: nm, title: nm }),
        App.ui.rarityBadge(def.rarity),
        hasNew ? el('span', { class: 'pt-newmove', text: 'NEWわざ', title: 'あたらしい わざを おぼえられる' }) : null),
      el('div', { class: 'pt-slot-mid' },
        el('span', { class: 'pt-slot-lv' }, el('small', { text: 'Lv.' }), String(inst.level)),
        statusChip(inst),
        el('span', { class: 'pt-slot-hpnum', text: inst.hp + '/' + st.hp })),
      App.ui.hpBar(inst.hp, st.hp)),
    el('div', { class: 'pt-slot-acts' },
      actBtn('pt-act-top', '⤒', 'せんとうへ', i === 0, () => moveParty(i, 0)),
      actBtn('pt-act-up', '▲', 'ひとつ まえへ', i === 0, () => moveParty(i, i - 1)),
      actBtn('pt-act-down', '▼', 'ひとつ うしろへ', i >= n - 1, () => moveParty(i, i + 1)),
      actBtn('pt-act-remove', '✕', 'パーティから はずす', n <= 1, () => removeFromParty(inst.speciesId))));

    slot.addEventListener('click', () => select(inst.speciesId, { scroll: true }));
    slot.addEventListener('keydown', (e) => {
      if (e.target !== slot) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(inst.speciesId, { scroll: true }); }
    });
    bindDropTarget(slot, i);
    slot.addEventListener('dragstart', (e) => {
      dragFrom = { kind: 'party', index: i };
      slot.classList.add('is-dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'party:' + i); } catch (err) { /* 無視 */ }
    });
    slot.addEventListener('dragend', endDrag);
    return slot;
  }

  function emptySlot(i) {
    const slot = el('div', { class: 'pt-slot is-empty', dataset: { index: String(i) } },
      el('span', { class: 'pt-slot-no', text: String(i + 1) }),
      el('div', { class: 'pt-slot-art' }, el('span', { class: 'pt-slot-ball' })),
      el('div', { class: 'pt-slot-main' }, el('span', { class: 'pt-slot-emptytext', text: 'あき' }),
        el('span', { class: 'pt-slot-emptyhint', text: 'ボックスから いれよう' })));
    bindDropTarget(slot, i);
    return slot;
  }

  function bindDropTarget(slot, i) {
    slot.addEventListener('dragover', (e) => {
      if (!dragFrom) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* 無視 */ }
      slot.classList.add('is-drop');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('is-drop'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('is-drop');
      const from = dragFrom;
      endDrag();
      if (from) handleDrop(from, i);
    });
  }

  function endDrag() {
    dragFrom = null;
    if (!panel) return;
    panel.querySelectorAll('.is-dragging, .is-drop').forEach((n) => n.classList.remove('is-dragging', 'is-drop'));
  }

  function handleDrop(from, to) {
    const ids = S().partyIds();
    if (from.kind === 'party') {
      moveParty(from.index, Math.min(to, ids.length - 1));
      return;
    }
    const id = from.id;
    if (!S().owned(id)) return;
    const cur = ids.indexOf(id);
    if (cur >= 0) { moveParty(cur, Math.min(to, ids.length - 1)); return; }
    if (to < ids.length) swapIntoParty(id, to);
    else addToParty(id);
  }

  function moveParty(from, to) {
    if (S().moveInParty(from, to)) sfx('select');
  }

  // ---------------------------------------------------------------- パーティ操作
  function addToParty(id) {
    const inst = S().owned(id);
    if (!inst) return;
    if (S().partyIds().includes(id)) return;
    if (S().partyIds().length >= partyMax()) { chooseSwapTarget(id); return; }
    if (S().addToParty(id)) {
      sfx('confirm');
      App.ui.toast(M().displayName(inst) + 'が パーティに くわわった！', { type: 'success' });
    }
  }

  function swapIntoParty(id, index) {
    const ids = S().partyIds();
    const out = ids[index];
    if (!out || ids.includes(id)) return false;
    ids[index] = id;
    if (!S().setParty(ids)) return false;
    sfx('confirm');
    const inst = S().owned(id);
    const outInst = S().owned(out);
    App.ui.toast(M().displayName(outInst) + 'と ' + M().displayName(inst) + 'を いれかえた！', { type: 'success' });
    return true;
  }

  function removeFromParty(id) {
    const inst = S().owned(id);
    if (!inst) return;
    if (S().partyIds().length <= 1) {
      sfx('error');
      App.ui.toast('さいごの 1たいは はずせません', { type: 'warn' });
      return;
    }
    if (S().removeFromParty(id)) {
      sfx('cancel');
      App.ui.toast(M().displayName(inst) + 'を ボックスに もどした', { type: 'info' });
    }
  }

  // パーティ満員: 入れ替える相手を選ぶ
  function chooseSwapTarget(id) {
    const inst = S().owned(id);
    const list = el('div', { class: 'pt-swap-list' });
    const body = el('div', { class: 'pt-swap' },
      el('p', { class: 'modal-text', text: 'パーティが いっぱいです。\n' + M().displayName(inst) + 'と いれかえる モンスターを えらんでください。' }),
      list);
    sfx('select');
    App.ui.modal({
      title: 'いれかえ',
      className: 'pt-swap-modal',
      body,
      buttons: [{ label: 'やめる', value: null }],
      onOpen: ({ close }) => {
        S().partyIds().forEach((pid, i) => {
          const p = S().owned(pid);
          const card = App.ui.monsterCard(p, { size: 's', showLevel: true, showHp: true, onClick: () => close(i) });
          card.dataset.index = String(i);
          list.appendChild(card);
        });
      },
    }).then((index) => {
      if (index === null || index === undefined) return;
      swapIntoParty(id, index);
    });
  }

  // ---------------------------------------------------------------- ボックス
  function filteredOwned() {
    const partyIds = S().partyIds();
    const rank = (inst) => D().rarityRank((M().species(inst) || {}).rarity);
    const no = (inst) => Number((M().species(inst) || {}).no) || 0;
    let list = S().ownedList().filter((inst) => {
      const def = M().species(inst);
      if (!def) return false;
      if (filters.rarity.size && !filters.rarity.has(def.rarity)) return false;
      if (filters.type && !(def.types || []).includes(filters.type)) return false;
      const inParty = partyIds.includes(inst.speciesId);
      if (filters.where === 'in' && !inParty) return false;
      if (filters.where === 'out' && inParty) return false;
      return true;
    });
    const order = S().ownedList().map((i) => i.speciesId);
    const key = {
      no: (i) => no(i),
      rarity: (i) => rank(i),
      level: (i) => i.level,
      obtained: (i) => order.indexOf(i.speciesId),
    }[filters.sort] || ((i) => no(i));
    const dir = filters.desc ? -1 : 1;
    list = list.slice().sort((a, b) => ((key(a) - key(b)) * dir) || (no(a) - no(b)));
    return list;
  }

  function renderBox() {
    const list = filteredOwned();
    const total = S().ownedCount();
    refs.boxCount.textContent = list.length === total ? total + '体' : list.length + ' / ' + total + '体';
    const partyIds = S().partyIds();
    const cards = list.map((inst) => {
      const card = App.ui.monsterCard(inst, {
        size: 's', showLevel: true, selected: inst.speciesId === selectedId,
        onClick: () => select(inst.speciesId, { scroll: true }),
      });
      card.classList.add('pt-bcard');
      const art = card.querySelector('.mcard-art');
      const pi = partyIds.indexOf(inst.speciesId);
      if (art && pi >= 0) art.appendChild(el('span', { class: 'pt-inparty', title: 'パーティ ' + (pi + 1) + 'ばんめ', text: 'P' + (pi + 1) }));
      if (art && newMoves(inst).length) art.appendChild(el('span', { class: 'pt-bnew', title: 'あたらしい わざを おぼえられる', text: 'わざ' }));
      if (pi >= 0) card.classList.add('is-inparty');
      if (M().isFainted(inst)) card.classList.add('is-fainted-box');
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        dragFrom = { kind: 'box', id: inst.speciesId };
        card.classList.add('is-dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'box:' + inst.speciesId); } catch (err) { /* 無視 */ }
      });
      card.addEventListener('dragend', endDrag);
      return card;
    });
    refs.boxGrid.replaceChildren(...cards);
    refs.boxNone.hidden = cards.length > 0;
  }

  // ---------------------------------------------------------------- 詳細パネル
  function renderDetail() {
    const d = refs.detail;
    const inst = selectedId ? S().owned(selectedId) : null;
    const def = inst ? M().species(inst) : null;
    d.className = ['panel', 'pt-detail', ...rarityClasses(def)].filter(Boolean).join(' ');
    if (!inst || !def) { d.replaceChildren(el('p', { class: 'muted center', text: 'モンスターを えらんでください' })); return; }
    d.dataset.species = inst.speciesId;

    const st = M().stats(inst);
    const maxLv = Number(cfg().maxLevel) || 100;
    const maxLB = Math.max(0, Number(gachaCfg().maxLimitBreak) || 5);
    const lbBonus = Math.round((Number(gachaCfg().limitBreakBonus) || 0) * (inst.limitBreak || 0) * 100);
    const inParty = S().partyIds().includes(inst.speciesId);
    const name = M().displayName(inst);
    const isMax = inst.level >= maxLv;
    const cap = S().levelCap ? S().levelCap() : maxLv;
    const isCap = !isMax && inst.level >= cap;
    const newList = newMoves(inst);

    const renameBtn = el('button', { class: 'pt-rename', type: 'button', title: 'ニックネームを かえる', 'aria-label': 'ニックネームを かえる', text: '✎' });
    renameBtn.addEventListener('click', () => rename(inst));

    const hero = el('div', { class: 'pt-d-hero' },
      el('div', { class: 'pt-d-art' }, el('div', { class: 'pt-d-glow' }), spriteImg(def, 'pt-d-img'), el('span', { class: 'pt-d-no', text: noText(def) })),
      el('div', { class: 'pt-d-head' },
        el('div', { class: 'pt-d-badges' }, App.ui.rarityBadge(def.rarity), App.ui.stars(inst.limitBreak || 0, maxLB)),
        el('div', { class: 'pt-d-namerow' }, el('h3', { class: 'pt-d-name', text: name, title: name }), renameBtn),
        inst.nickname ? el('div', { class: 'pt-d-species', text: def.name }) : null,
        el('div', { class: 'pt-d-types' }, (def.types || []).map((t) => App.ui.typeBadge(t))),
        el('div', { class: 'pt-d-lvrow' },
          el('span', { class: 'pt-d-lv' }, el('small', { text: 'Lv.' }), String(inst.level)),
          statusChip(inst)),
        el('div', { class: 'pt-d-exp' },
          el('span', { class: 'pt-d-explabel', text: 'EXP' }),
          el('span', { class: ['pt-d-exptrack', isCap ? 'is-cap' : ''] }, el('span', { class: 'pt-d-expfill', style: { width: (M().expProgress(inst, cap) * 100).toFixed(1) + '%' } }), isCap ? el('span', { class: 'pt-d-expmax', text: 'MAX' }) : null)),
        el('div', { class: ['pt-d-expnote', isCap ? 'is-cap' : ''], text: isMax ? 'レベル MAX！' : (isCap ? 'Lv上限 ' + cap + '（バッジで あがる）' : 'つぎの Lvまで あと ' + U().formatNumber(M().expToNext(inst)) + ' EXP') }),
        el('div', { class: 'pt-d-hp' }, App.ui.hpBar(inst.hp, st.hp), el('span', { class: 'pt-d-hpnum', text: inst.hp + ' / ' + st.hp }))));

    const partyBtn = inParty
      ? App.ui.button('はずす', { size: 'sm', className: 'pt-btn-remove', title: 'パーティから はずす', disabled: S().partyIds().length <= 1, onClick: () => removeFromParty(inst.speciesId) })
      : App.ui.button('パーティに いれる', { size: 'sm', variant: 'primary', className: 'pt-btn-add', onClick: () => addToParty(inst.speciesId) });
    const actions = el('div', { class: 'pt-d-actions' },
      el('span', { class: ['pt-d-where', inParty ? 'is-in' : ''], text: inParty ? 'パーティ ' + (S().partyIds().indexOf(inst.speciesId) + 1) + 'ばんめ' : 'ボックス' }),
      partyBtn,
      App.ui.button('ニックネーム', { size: 'sm', variant: 'ghost', className: 'pt-btn-rename', onClick: () => rename(inst) }),
      evolveButton(inst));

    // 能力値
    const statRows = STAT_KEYS.map((k) => {
      const ref = statRef(inst, k);
      const ratio = Math.max(0.03, Math.min(1, st[k] / ref));
      return el('div', { class: ['pt-stat', 'stat-' + k] },
        el('span', { class: 'pt-stat-label', text: STAT_LABELS[k] }),
        el('span', { class: 'pt-stat-track' }, el('span', { class: 'pt-stat-fill', style: { width: (ratio * 100).toFixed(1) + '%' } })),
        el('span', { class: 'pt-stat-val', text: String(st[k]) }));
    });

    // わざ
    const moveBtn = el('button', { class: 'pt-move-edit', type: 'button' },
      'わざを いれかえる', newList.length ? el('span', { class: 'pt-newmove', text: 'NEWわざ' }) : null);
    moveBtn.addEventListener('click', () => editMoves(inst));
    const moveCards = [];
    for (let i = 0; i < 4; i++) moveCards.push(inst.moves[i] ? moveCard(inst.moves[i].id, inst.moves[i].pp) : el('div', { class: 'pt-move is-empty', text: 'ー' }));

    const meta = [];
    if (def.category) meta.push(def.category);
    if (def.height) meta.push('たかさ ' + def.height + 'm');
    if (def.weight) meta.push('おもさ ' + def.weight + 'kg');

    d.replaceChildren(
      hero,
      actions,
      el('h4', { class: 'pt-d-sub' }, 'のうりょく', lbBonus ? el('small', { class: 'pt-lb', text: 'げんかいとっぱ +' + lbBonus + '%' }) : null),
      el('div', { class: 'pt-stats' }, statRows),
      el('h4', { class: 'pt-d-sub' }, 'わざ', moveBtn),
      el('div', { class: 'pt-moves' }, moveCards),
      el('h4', { class: 'pt-d-sub' }, 'ずかん'),
      el('div', { class: 'pt-d-dex' },
        meta.length ? el('div', { class: 'pt-d-meta', text: meta.join(' / ') }) : null,
        el('p', { class: 'pt-d-desc', text: def.desc || '' })));
  }

  // 能力バーの基準値: 同レベル・同凸で種族値 150 のときの値
  function statRef(inst, k) {
    const L = Math.floor(Number(inst.level) || 1);
    const iv = Number(cfg().iv) || 0;
    const B = 150;
    const raw = k === 'hp' ? Math.floor(((2 * B + iv) * L) / 100) + L + 10 : Math.floor(((2 * B + iv) * L) / 100) + 5;
    const mult = 1 + (Number(gachaCfg().limitBreakBonus) || 0) * (Number(inst.limitBreak) || 0);
    return Math.max(1, raw * mult);
  }

  function moveCard(moveId, pp) {
    const mv = D().move(moveId);
    if (!mv) return el('div', { class: 'pt-move is-empty', text: '？' });
    const max = M().maxPP(moveId);
    const cat = mv.category || 'physical';
    return el('div', { class: ['pt-move', 'type-' + cssId(mv.type)], dataset: { move: moveId } },
      el('div', { class: 'pt-move-top' },
        el('span', { class: 'pt-move-name', text: mv.name || moveId, title: mv.name || moveId }),
        el('span', { class: ['pt-move-pp', pp !== undefined && pp <= 0 ? 'is-zero' : ''] }, 'PP ', el('b', { text: (pp !== undefined ? pp + '/' : '') + max }))),
      el('div', { class: 'pt-move-tags' },
        App.ui.typeBadge(mv.type),
        el('span', { class: ['pt-cat', 'cat-' + cat], text: CATEGORY_LABELS[cat] || cat })),
      el('div', { class: 'pt-move-nums' },
        el('span', {}, 'いりょく ', el('b', { text: mv.power > 0 ? String(mv.power) : '―' })),
        el('span', {}, 'めいちゅう ', el('b', { text: mv.accuracy > 0 ? String(mv.accuracy) : '―' }))),
      el('div', { class: 'pt-move-desc', text: mv.desc || '' }));
  }

  // ---------------------------------------------------------------- 進化（SPEC 10.4）
  // 進化しない種は null（非表示）。条件未達は「Lv〇〇で しんか」の無効ボタン
  function evolveButton(inst) {
    const ev = D().evolutionOf ? D().evolutionOf(inst.speciesId) : null;
    if (!ev) return null;
    const ready = !!M().canEvolve(inst) && !S().owned(ev.to);
    return App.ui.button(ready ? 'しんかさせる' : 'Lv' + ev.level + 'で しんか', {
      size: 'sm', variant: ready ? 'gold' : 'ghost', className: 'pt-btn-evolve', disabled: !ready,
      title: ready ? 'しんかさせる' : 'Lv' + ev.level + 'に なると しんかできる',
      onClick: () => evolveInst(inst),
    });
  }

  function evolveInst(inst) {
    const fromId = inst && inst.speciesId;
    const toId = inst ? M().canEvolve(inst) : null;
    const toDef = toId ? D().monster(toId) : null;
    if (!toDef || S().owned(toId)) return Promise.resolve(false);
    const name = M().displayName(inst);
    sfx('select');
    return App.ui.confirm(name + 'を ' + toDef.name + 'に しんかさせますか？', { title: 'しんか', okLabel: 'しんかさせる' })
      .then((ok) => (ok ? evolveAnim(inst, fromId, toDef, name) : false));
  }

  function flashOverlay(node) {
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
  }

  // DOM による簡易進化演出 → App.state.evolve → 新わざ習得（空き枠のみ。残りは NEWわざ として入れ替え可能）
  function evolveAnim(inst, fromId, toDef, name) {
    const fromImg = spriteImg(D().monster(fromId), 'pt-evo-img');
    const toImg = spriteImg(toDef, 'pt-evo-img');
    toImg.classList.add('is-hidden');
    const stage = el('div', { class: 'pt-evo-stage is-glow' }, fromImg, toImg);
    const msg = el('p', { class: 'pt-evo-msg', text: 'おや…？ ' + name + 'の ようすが…！' });
    const okBtn = App.ui.button('OK', { variant: 'primary', className: 'pt-evo-ok' });
    okBtn.hidden = true;
    const overlay = el('div', { class: 'pt-evo-overlay', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'pt-evo-box' }, stage, msg, okBtn));
    document.body.appendChild(overlay);
    sfx('statUp');
    const steps = 14;
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (i < steps) {
          const showTo = i % 2 === 1;
          fromImg.classList.toggle('is-hidden', showTo);
          toImg.classList.toggle('is-hidden', !showTo);
          if (i % 4 === 0) flashOverlay(overlay);
          i++;
          setTimeout(tick, Math.max(80, 320 - i * 18));
          return;
        }
        stage.classList.remove('is-glow');
        fromImg.classList.add('is-hidden');
        toImg.classList.remove('is-hidden');
        flashOverlay(overlay);
        const r = S().evolve(fromId);
        if (!r) {
          fromImg.classList.remove('is-hidden');
          toImg.classList.add('is-hidden');
          msg.textContent = 'しんか できませんでした';
          sfx('error');
        } else {
          sfx('levelup');
          const learned = [];
          for (const id of r.newMoves || []) {
            if (inst.moves.length >= 4 || inst.moves.some((m) => m.id === id)) continue;
            inst.moves.push({ id, pp: M().maxPP(id) });
            learned.push(id);
          }
          if (learned.length) notifyUpdated(inst);
          const lines = ['おめでとう！ ' + name + 'は ' + toDef.name + 'に しんかした！'];
          learned.forEach((id) => { const mv = D().move(id); lines.push(M().displayName(inst) + 'は ' + (mv ? mv.name : id) + 'を おぼえた！'); });
          if ((r.newMoves || []).length > learned.length) lines.push('あたらしい わざは 「わざを いれかえる」から おぼえられます');
          msg.textContent = lines.join('\n');
          selectedId = r.to;
          markDirty();
        }
        okBtn.hidden = false;
        try { okBtn.focus({ preventScroll: true }); } catch (e) { /* 無視 */ }
        okBtn.addEventListener('click', () => { sfx('confirm'); overlay.remove(); resolve(!!r); }, { once: true });
      };
      setTimeout(tick, 900);
    });
  }

  // ---------------------------------------------------------------- ニックネーム
  function rename(inst) {
    const def = M().species(inst);
    sfx('select');
    App.ui.prompt('あたらしい ニックネームを いれてください。\nからっぽにすると もとの なまえに もどります。', {
      title: 'ニックネーム',
      value: inst.nickname || def.name,
      maxLength: NICK_MAX,
      placeholder: def.name,
      hint: '最大 ' + NICK_MAX + '文字',
      okLabel: 'けってい',
    }).then((v) => {
      if (v === null || v === undefined) return;
      const name = String(v).trim().slice(0, NICK_MAX);
      const next = name === def.name ? '' : name;
      if (next === (inst.nickname || '')) return;
      inst.nickname = next;
      notifyUpdated(inst);
      sfx('confirm');
      App.ui.toast(next ? 'ニックネームを 「' + next + '」に した！' : 'ニックネームを もとに もどした', { type: 'success' });
    });
  }

  // ---------------------------------------------------------------- わざの入れ替え
  function editMoves(inst) {
    const learnable = M().learnableMoves(inst);
    const fresh = newMoves(inst);
    const lvOf = learnLevels(M().species(inst));
    let chosen = (inst.moves || []).map((m) => m.id).filter((id) => learnable.includes(id));
    const counter = el('span', { class: 'pt-mv-count' });
    const listEl = el('div', { class: 'pt-mv-list' });
    let okBtn = null;

    const refresh = () => {
      counter.textContent = chosen.length + ' / 4';
      counter.classList.toggle('is-full', chosen.length >= 4);
      listEl.querySelectorAll('.pt-mv-opt').forEach((b) => {
        const idx = chosen.indexOf(b.dataset.move);
        b.classList.toggle('is-on', idx >= 0);
        b.setAttribute('aria-pressed', idx >= 0 ? 'true' : 'false');
        b.querySelector('.pt-mv-order').textContent = idx >= 0 ? String(idx + 1) : '';
        b.classList.toggle('is-locked', idx < 0 && chosen.length >= 4);
      });
      if (okBtn) okBtn.disabled = chosen.length < 1;
    };

    learnable.forEach((id) => {
      const mv = D().move(id) || {};
      const cat = mv.category || 'physical';
      const b = el('button', { class: ['pt-mv-opt', 'type-' + cssId(mv.type)], type: 'button', dataset: { move: id } },
        el('span', { class: 'pt-mv-order' }),
        el('span', { class: 'pt-mv-body' },
          el('span', { class: 'pt-mv-top' },
            el('span', { class: 'pt-mv-name', text: mv.name || id }),
            fresh.includes(id) ? el('span', { class: 'pt-newmove', text: 'NEW' }) : null,
            el('span', { class: 'pt-mv-lv', text: 'Lv.' + (lvOf[id] || 1) })),
          el('span', { class: 'pt-mv-info' },
            App.ui.typeBadge(mv.type),
            el('span', { class: ['pt-cat', 'cat-' + cat], text: CATEGORY_LABELS[cat] || cat }),
            el('span', { class: 'pt-mv-num', text: 'いりょく ' + (mv.power > 0 ? mv.power : '―') }),
            el('span', { class: 'pt-mv-num', text: 'めいちゅう ' + (mv.accuracy > 0 ? mv.accuracy : '―') }),
            el('span', { class: 'pt-mv-num', text: 'PP ' + M().maxPP(id) })),
          el('span', { class: 'pt-mv-desc', text: mv.desc || '' })));
      b.addEventListener('click', () => {
        const idx = chosen.indexOf(id);
        if (idx >= 0) {
          chosen.splice(idx, 1);
          sfx('cancel');
        } else if (chosen.length < 4) {
          chosen.push(id);
          sfx('select');
        } else {
          sfx('error');
          App.ui.toast('わざは 4つまでです。はずす わざを えらんでね', { type: 'warn' });
          return;
        }
        refresh();
      });
      listEl.appendChild(b);
    });

    const body = el('div', { class: 'pt-mv' },
      el('div', { class: 'pt-mv-head' },
        el('span', { text: M().displayName(inst) + 'に おぼえさせる わざを えらんでね（1〜4こ）' }), counter),
      listEl);

    markMovesSeen(inst);
    sfx('select');
    App.ui.modal({
      title: 'わざの いれかえ',
      className: 'pt-mv-modal',
      size: 'wide',
      body,
      buttons: [
        { label: 'キャンセル', value: null },
        { label: 'けってい', primary: true, value: () => chosen.slice() },
      ],
      onOpen: ({ box }) => {
        okBtn = box.querySelector('.modal-footer .btn-primary');
        refresh();
      },
    }).then((ids) => {
      updateTabBadge();
      if (!Array.isArray(ids)) { markDirty(); return; }
      const before = (inst.moves || []).map((m) => m.id).join(',');
      if (ids.join(',') === before) { markDirty(); return; }
      if (M().setMoves(inst, ids)) {
        notifyUpdated(inst);
        sfx('confirm');
        App.ui.toast('わざを いれかえた！', { type: 'success' });
      } else {
        sfx('error');
        App.ui.toast('わざを いれかえられませんでした', { type: 'error' });
      }
    });
  }

  // ---------------------------------------------------------------- タブIF
  function onShow() {
    visible = true;
    if (dirty) render();
  }
  function onHide() {
    visible = false;
    endDrag();
  }

  App.partyTab = {
    init, onShow, onHide,
    // 追加（テスト・他モジュール用）
    select(id) { if (S().owned(id)) { selectedId = id; if (visible) render(); else markDirty(); } },
    evolve(id) { return evolveInst(S().owned(id)); },
    selected() { return selectedId; },
    newMoves,
    filters() { return { rarity: Array.from(filters.rarity), type: filters.type, where: filters.where, sort: filters.sort, desc: filters.desc }; },
  };
})();
