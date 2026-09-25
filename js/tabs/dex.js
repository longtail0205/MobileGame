// =====================================================================
// App.dexTab — 「ずかん」タブ
//   達成率 / フィルタ / 全モンスターのグリッド（未発見=シルエット、見た=灰色、所持=フルカラー）/ 詳細モーダル
//   ※ フィルタ部品のスタイルは party.css の .pt-chip / .pt-select を共用
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const U = () => App.util;
  const S = () => App.state;
  const D = () => App.data;
  const el = (...args) => App.util.el(...args);
  const sfx = (n) => { try { if (App.audio && App.audio.play) App.audio.play(n); } catch (e) { /* 無視 */ } };
  const cssId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');

  const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const STAT_LABELS = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ' };
  const STAT_BAR_MAX = 160;
  const CATEGORY_LABELS = { physical: 'ぶつり', special: 'とくしゅ', status: 'へんか' };
  const STATES = [['all', 'すべて'], ['owned', 'もっている'], ['seen', 'みただけ'], ['unknown', 'みつけてない']];

  let panel = null;
  let visible = false;
  let dirty = true;
  let renderQueued = false;
  const filters = { rarity: new Set(), type: '', state: 'all' };
  const refs = {};
  let modalCtx = null;   // 詳細モーダル表示中 { id, list, body, box, close }

  // ---------------------------------------------------------------- ヘルパー
  function stateOf(id) {
    if (S().isOwned(id) || !!(((S().data || {}).dex || {}).owned || {})[id]) return 'owned';   // 進化して手放した種も「てにいれた」扱い
    if (S().isSeen(id)) return 'seen';
    return 'unknown';
  }
  function noText(def) { return 'No.' + String(def ? def.no : 0).padStart(3, '0'); }

  function spriteImg(def, cls, view) {
    let sp = null;
    try { if (App.sprites && App.sprites.monsterSprite) sp = App.sprites.monsterSprite(def, view || 'front'); } catch (e) { sp = null; }
    if (!sp || !sp.src) return el('span', { class: [cls, 'dx-noimg'], text: '?' });
    const img = el('img', { class: [cls, sp.flip ? 'is-flip' : ''], src: sp.src, alt: '', draggable: 'false', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(el('span', { class: [cls, 'dx-noimg'], text: '?' })), { once: true });
    return img;
  }

  function rarityClasses(def) {
    const r = D().rarity(def.rarity);
    return ['rarity-' + cssId(def.rarity), r && r.rainbow ? 'is-rainbow' : ''];
  }

  // ガチャで入手できるか（App.gacha があればそのロジックを優先）
  function gachaInfo(def) {
    let banners = [];
    try {
      banners = App.gacha && typeof App.gacha.banners === 'function'
        ? App.gacha.banners()
        : (((window.GameData || {}).gacha || {}).banners || []);
    } catch (e) {
      banners = ((window.GameData || {}).gacha || {}).banners || [];
    }
    const hits = [];
    for (const b of banners || []) {
      if (!b) continue;
      let inPool = false;
      try {
        if (App.gacha && typeof App.gacha.pool === 'function') {
          const pool = App.gacha.pool(b.id, def.rarity);
          inPool = Array.isArray(pool) && pool.includes(def.id);
        } else {
          inPool = Array.isArray(b.pool) ? b.pool.includes(def.id) : def.gacha !== false;
        }
      } catch (e) {
        inPool = Array.isArray(b.pool) ? b.pool.includes(def.id) : def.gacha !== false;
      }
      if (inPool) hits.push({ id: b.id, name: b.name || b.id, pickup: Array.isArray(b.pickup) && b.pickup.includes(def.id), colors: b.colors });
    }
    return hits;
  }

  // ---------------------------------------------------------------- 構築
  function init(panelEl) {
    panel = panelEl;
    if (!panel) return;
    panel.classList.add('dx-tab');
    build();
    if (App.events) {
      ['dex:changed', 'collection:changed', 'monster:updated', 'state:loaded', 'state:reset'].forEach((ev) => App.events.on(ev, markDirty));
    }
    markDirty();
  }

  function build() {
    // 達成率
    refs.ring = el('div', { class: 'dx-ring' }, el('div', { class: 'dx-ring-inner' },
      refs.ringPct = el('b', { class: 'dx-ring-pct' }), el('small', { text: 'コンプリート' })));
    refs.ownedNum = el('b');
    refs.seenNum = el('b');
    refs.ownedBar = el('span', { class: 'dx-bar-fill is-owned' });
    refs.seenBar = el('span', { class: 'dx-bar-fill is-seen' });
    refs.rarityRows = el('div', { class: 'dx-rar-list' });
    const summary = el('section', { class: 'panel dx-summary' },
      refs.ring,
      el('div', { class: 'dx-sum-main' },
        el('h3', { class: 'section-title' }, el('span', { class: 'section-icon', text: '▤' }), 'モンスターずかん'),
        el('div', { class: 'dx-sum-row' },
          el('span', { class: 'dx-sum-label', text: 'もっている' }), el('span', { class: 'dx-sum-val' }, refs.ownedNum, refs.totalA = el('small')),
          el('span', { class: 'dx-bar' }, refs.ownedBar)),
        el('div', { class: 'dx-sum-row' },
          el('span', { class: 'dx-sum-label', text: 'みつけた' }), el('span', { class: 'dx-sum-val' }, refs.seenNum, refs.totalB = el('small')),
          el('span', { class: 'dx-bar' }, refs.seenBar))),
      refs.rarityRows);

    // フィルタ
    refs.rarityChips = el('div', { class: 'pt-chips' }, D().rarityOrder().map((r) => {
      const b = el('button', { class: ['pt-chip', 'rarity-' + cssId(r)], type: 'button', text: r, dataset: { rarity: r }, 'aria-pressed': 'false' });
      b.addEventListener('click', () => {
        if (filters.rarity.has(r)) filters.rarity.delete(r); else filters.rarity.add(r);
        sfx('select'); syncFilterUi(); renderGrid();
      });
      return b;
    }));
    refs.typeSelect = el('select', { class: 'pt-select dx-type-select', 'aria-label': 'タイプ' },
      el('option', { value: '', text: 'すべての タイプ' }),
      D().types().map((t) => el('option', { value: t, text: (D().type(t) || {}).name || t })));
    refs.typeSelect.addEventListener('change', () => { filters.type = refs.typeSelect.value; sfx('select'); renderGrid(); });
    refs.stateSeg = el('div', { class: 'segmented dx-state' }, STATES.map(([id, label]) => {
      const b = el('button', { class: 'seg-btn', type: 'button', text: label, dataset: { state: id } });
      b.addEventListener('click', () => { filters.state = id; sfx('select'); syncFilterUi(); renderGrid(); });
      return b;
    }));
    refs.resetFilter = el('button', { class: 'pt-reset dx-reset', type: 'button', text: 'リセット' });
    refs.resetFilter.addEventListener('click', () => {
      filters.rarity.clear(); filters.type = ''; filters.state = 'all';
      sfx('cancel'); syncFilterUi(); renderGrid();
    });
    refs.count = el('span', { class: 'pt-count dx-count' });
    refs.grid = el('div', { class: 'dx-grid' });
    refs.none = el('div', { class: 'dx-none', hidden: true, text: 'じょうけんに あう モンスターが いません' });
    const list = el('section', { class: 'panel dx-list' },
      el('h3', { class: 'section-title' }, el('span', { class: 'section-icon', text: '№' }), 'いちらん', refs.count),
      el('div', { class: 'dx-filters' },
        el('div', { class: 'dx-frow' }, el('span', { class: 'dx-flabel', text: 'レア度' }), refs.rarityChips),
        el('div', { class: 'dx-frow' }, el('span', { class: 'dx-flabel', text: 'しぼりこみ' }), refs.typeSelect, refs.stateSeg, refs.resetFilter)),
      refs.grid, refs.none);

    panel.appendChild(el('div', { class: 'dx-root' }, summary, list));
    syncFilterUi();
  }

  function syncFilterUi() {
    refs.rarityChips.querySelectorAll('.pt-chip').forEach((b) => {
      const on = filters.rarity.has(b.dataset.rarity);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    refs.typeSelect.value = filters.type;
    refs.stateSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.state === filters.state));
    refs.resetFilter.hidden = !(filters.rarity.size || filters.type || filters.state !== 'all');
  }

  // ---------------------------------------------------------------- 描画
  function markDirty() {
    dirty = true;
    if (renderQueued) return;
    renderQueued = true;
    Promise.resolve().then(() => {
      renderQueued = false;
      if (visible && dirty) render();
    });
  }

  function render() {
    if (!panel || !S() || !S().data) return;
    dirty = false;
    renderSummary();
    renderGrid();
    if (modalCtx) renderDetail();
  }

  function renderSummary() {
    const all = D().monsters();
    const total = all.length;
    let owned = 0;
    let seen = 0;
    const byR = {};
    D().rarityOrder().forEach((r) => { byR[r] = { owned: 0, total: 0 }; });
    for (const m of all) {
      const st = stateOf(m.id);
      if (st === 'owned') owned++;
      if (st !== 'unknown') seen++;
      if (!byR[m.rarity]) byR[m.rarity] = { owned: 0, total: 0 };
      byR[m.rarity].total++;
      if (st === 'owned') byR[m.rarity].owned++;
    }
    const pct = total ? Math.floor((owned / total) * 1000) / 10 : 0;
    refs.ring.style.setProperty('--p', (total ? (owned / total) * 100 : 0).toFixed(2) + '%');
    refs.ring.style.setProperty('--s', (total ? (seen / total) * 100 : 0).toFixed(2) + '%');
    refs.ring.classList.toggle('is-complete', total > 0 && owned === total);
    refs.ringPct.textContent = pct + '%';
    refs.ownedNum.textContent = String(owned);
    refs.seenNum.textContent = String(seen);
    refs.totalA.textContent = ' / ' + total;
    refs.totalB.textContent = ' / ' + total;
    refs.ownedBar.style.width = (total ? (owned / total) * 100 : 0) + '%';
    refs.seenBar.style.width = (total ? (seen / total) * 100 : 0) + '%';
    refs.rarityRows.replaceChildren(...Object.keys(byR).filter((r) => byR[r].total > 0).map((r) => {
      const v = byR[r];
      return el('div', { class: ['dx-rar', 'rarity-' + cssId(r), v.owned === v.total ? 'is-complete' : ''], dataset: { rarity: r } },
        App.ui.rarityBadge(r),
        el('span', { class: 'dx-rar-bar' }, el('span', { class: 'dx-rar-fill', style: { width: ((v.owned / v.total) * 100).toFixed(1) + '%' } })),
        el('span', { class: 'dx-rar-num' }, el('b', { text: String(v.owned) }), ' / ' + v.total));
    }));
  }

  function filteredList() {
    return D().monsters().filter((m) => {
      const st = stateOf(m.id);
      if (filters.state !== 'all' && st !== filters.state) return false;
      // 未発見のモンスターはレア度・タイプが分からないので、それらで絞り込むときは除外
      if (filters.rarity.size && (st === 'unknown' || !filters.rarity.has(m.rarity))) return false;
      if (filters.type && (st === 'unknown' || !(m.types || []).includes(filters.type))) return false;
      return true;
    });
  }

  function renderGrid() {
    const list = filteredList();
    const total = D().monsters().length;
    refs.count.textContent = list.length === total ? total + '種' : list.length + ' / ' + total + '種';
    refs.grid.replaceChildren(...list.map((m) => dexCard(m, list)));
    refs.none.hidden = list.length > 0;
  }

  function dexCard(def, list) {
    const st = stateOf(def.id);
    const inst = st === 'owned' ? S().owned(def.id) : null;
    const card = el('button', {
      class: ['dx-card', 'is-' + st, ...(st === 'owned' ? rarityClasses(def) : [])],
      type: 'button',
      dataset: { species: def.id, state: st },
      title: st === 'unknown' ? noText(def) + ' ？？？' : noText(def) + ' ' + def.name,
    },
    el('span', { class: 'dx-frame' },
      el('span', { class: 'dx-art' },
        spriteImg(def, 'dx-img'),
        st === 'owned' ? App.ui.rarityBadge(def.rarity) : null,
        st === 'owned' && inst ? el('span', { class: 'dx-lv', text: 'Lv.' + inst.level }) : null,
        st === 'seen' ? el('span', { class: 'dx-seen-tag', text: 'みた' }) : null),
      el('span', { class: 'dx-no', text: noText(def) })),
    el('span', { class: 'dx-name', text: st === 'unknown' ? '？？？' : def.name }));
    card.addEventListener('click', () => openDetail(def.id, list));
    return card;
  }

  // ---------------------------------------------------------------- 詳細モーダル
  function openDetail(id, list) {
    if (modalCtx) return;
    const ids = (list || D().monsters()).map((m) => m.id);
    const body = el('div', { class: 'dx-detail' });
    modalCtx = { id, ids, body, box: null, close: null, view: 'front' };
    const onKey = (e) => {
      if (!modalCtx) return;
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    };
    renderDetail();
    sfx('select');
    window.addEventListener('keydown', onKey);
    App.ui.modal({
      title: 'ずかん',
      className: 'dx-modal',
      size: 'wide',
      body,
      buttons: [{ label: 'とじる', value: null, primary: true }],
      onOpen: ({ box, close }) => { if (modalCtx) { modalCtx.box = box; modalCtx.close = close; } },
    }).then(() => {
      window.removeEventListener('keydown', onKey);
      modalCtx = null;
    });
  }

  function step(delta) {
    if (!modalCtx) return;
    const ids = modalCtx.ids;
    const i = ids.indexOf(modalCtx.id);
    if (i < 0 || !ids.length) return;
    const next = ids[(i + delta + ids.length) % ids.length];
    if (next === modalCtx.id) return;
    modalCtx.id = next;
    modalCtx.view = 'front';
    sfx('select');
    renderDetail();
  }

  function renderDetail() {
    if (!modalCtx) return;
    const def = D().monster(modalCtx.id);
    const body = modalCtx.body;
    if (!def) { body.replaceChildren(el('p', { class: 'muted', text: 'データが みつかりません' })); return; }
    const st = stateOf(def.id);
    const known = st !== 'unknown';
    const inst = st === 'owned' ? S().owned(def.id) : null;
    body.className = ['dx-detail', 'is-' + st, ...(known ? rarityClasses(def) : [])].filter(Boolean).join(' ');
    body.dataset.species = def.id;

    // スプライト（正面/背面切替）
    const art = el('div', { class: 'dx-d-art' }, el('div', { class: 'dx-d-bg' }), spriteImg(def, 'dx-d-img', modalCtx.view));
    const viewSeg = el('div', { class: 'segmented dx-view' }, [['front', 'しょうめん'], ['back', 'うしろ']].map(([v, label]) => {
      const b = el('button', { class: ['seg-btn', modalCtx.view === v ? 'is-active' : ''], type: 'button', text: label, dataset: { view: v } });
      b.addEventListener('click', () => { if (modalCtx.view !== v) { modalCtx.view = v; sfx('select'); renderDetail(); } });
      return b;
    }));

    const metaRow = (label, value) => el('div', { class: 'dx-meta' }, el('span', { text: label }), el('b', { text: value }));
    const stTag = st === 'owned'
      ? el('span', { class: 'dx-st dx-st-owned', text: inst ? 'もっている' : 'しんかずみ' })
      : (st === 'seen' ? el('span', { class: 'dx-st dx-st-seen', text: 'みただけ' }) : el('span', { class: 'dx-st dx-st-unknown', text: 'みはっけん' }));

    const info = el('div', { class: 'dx-d-info' },
      el('div', { class: 'dx-d-norow' }, el('span', { class: 'dx-d-no', text: noText(def) }), stTag),
      el('h3', { class: 'dx-d-name', text: known ? def.name : '？？？' }),
      el('div', { class: 'dx-d-cat', text: known ? (def.category || '') : '？？？モンスター' }),
      el('div', { class: 'dx-d-badges' },
        known ? App.ui.rarityBadge(def.rarity) : el('span', { class: 'dx-q-badge', text: '？' }),
        known ? (def.types || []).map((t) => App.ui.typeBadge(t)) : el('span', { class: 'dx-q-badge wide', text: '？？？' }),
        inst ? App.ui.stars(inst.limitBreak || 0) : null),
      el('div', { class: 'dx-metas' },
        metaRow('たかさ', known && def.height ? def.height + ' m' : '？？？'),
        metaRow('おもさ', known && def.weight ? def.weight + ' kg' : '？？？'),
        inst ? metaRow('レベル', 'Lv.' + inst.level) : null),
      el('p', { class: 'dx-d-desc', text: known ? (def.desc || '') : 'まだ みつけていない モンスター。ガチャや やせいで さがしてみよう！' }));

    // 種族値
    const statsSec = el('section', { class: 'dx-sec dx-sec-stats' }, el('h4', { class: 'dx-sec-title', text: 'しゅぞくち' }));
    if (known) {
      let sum = 0;
      STAT_KEYS.forEach((k) => {
        const v = Number((def.baseStats || {})[k]) || 0;
        sum += v;
        statsSec.appendChild(el('div', { class: ['dx-stat', 'stat-' + k] },
          el('span', { class: 'dx-stat-label', text: STAT_LABELS[k] }),
          el('span', { class: 'dx-stat-val', text: String(v) }),
          el('span', { class: 'dx-stat-track' }, el('span', { class: 'dx-stat-fill', style: { width: Math.min(100, (v / STAT_BAR_MAX) * 100).toFixed(1) + '%' } }))));
      });
      statsSec.appendChild(el('div', { class: 'dx-stat-total' }, el('span', { text: 'ごうけい' }), el('b', { text: String(sum) })));
    } else {
      statsSec.appendChild(el('p', { class: 'dx-hidden', text: '？？？' }));
    }

    // 習得わざ
    const movesSec = el('section', { class: 'dx-sec dx-sec-moves' }, el('h4', { class: 'dx-sec-title', text: 'おぼえる わざ' }));
    if (known) {
      const rows = (def.learnset || []).map((l, i) => ({ lv: Number(l && l.lv) || 1, move: l && l.move, i }))
        .filter((l) => l.move).sort((a, b) => (a.lv - b.lv) || (a.i - b.i));
      const setIds = inst ? (inst.moves || []).map((m) => m.id) : [];
      const table = el('div', { class: 'dx-moves' }, rows.map((l) => {
        const mv = D().move(l.move) || { name: l.move, type: 'normal', category: 'status', power: 0, accuracy: 0 };
        const cat = mv.category || 'physical';
        return el('div', {
          class: ['dx-move', inst && l.lv > inst.level ? 'is-locked' : '', setIds.includes(l.move) ? 'is-set' : ''],
          title: mv.desc || '',
        },
        el('span', { class: 'dx-move-lv', text: 'Lv.' + l.lv }),
        el('span', { class: 'dx-move-name', text: mv.name || l.move }),
        App.ui.typeBadge(mv.type),
        el('span', { class: ['dx-cat', 'cat-' + cat], text: CATEGORY_LABELS[cat] || cat }),
        el('span', { class: 'dx-move-num', text: mv.power > 0 ? String(mv.power) : '―' }),
        el('span', { class: 'dx-move-num', text: mv.accuracy > 0 ? String(mv.accuracy) : '―' }));
      }));
      movesSec.appendChild(el('div', { class: 'dx-move dx-move-head' },
        el('span', { class: 'dx-move-lv', text: 'Lv' }), el('span', { class: 'dx-move-name', text: 'わざ' }),
        el('span', { class: 'dx-move-h', text: 'タイプ' }), el('span', { class: 'dx-move-h', text: 'ぶんるい' }),
        el('span', { class: 'dx-move-num', text: 'いりょく' }), el('span', { class: 'dx-move-num', text: 'めいちゅう' })));
      movesSec.appendChild(table);
    } else {
      movesSec.appendChild(el('p', { class: 'dx-hidden', text: '？？？' }));
    }

    // 出現場所
    const locSec = el('section', { class: 'dx-sec dx-sec-loc' }, el('h4', { class: 'dx-sec-title', text: 'であえる ばしょ' }));
    if (known) {
      let locs = [];
      try { locs = D().encounterLocations(def.id) || []; } catch (e) { locs = []; }
      if (locs.length) {
        locSec.appendChild(el('ul', { class: 'dx-locs' }, locs.map((l) => el('li', {},
          el('span', { class: 'dx-loc-pin', text: '▼' }),
          el('span', { class: 'dx-loc-name', text: l.mapName }),
          el('span', { class: 'dx-loc-lv', text: l.min === l.max ? 'Lv.' + l.min : 'Lv.' + l.min + '〜' + l.max })))));
      } else {
        locSec.appendChild(el('p', { class: 'dx-empty', text: 'やせいでは みつかっていない' }));
      }
    } else {
      locSec.appendChild(el('p', { class: 'dx-hidden', text: '？？？' }));
    }

    // ガチャ
    const gachaSec = el('section', { class: 'dx-sec dx-sec-gacha' }, el('h4', { class: 'dx-sec-title', text: 'ガチャ' }));
    const hits = gachaInfo(def);
    if (def.gacha === false && D().preEvolutionOf && D().preEvolutionOf(def.id)) {
      gachaSec.appendChild(el('p', { class: 'dx-gacha-evo', text: 'しんかで てにいれる' }));
    } else if (!hits.length) {
      gachaSec.appendChild(el('p', { class: 'dx-empty', text: 'いまは ガチャに でてこない' }));
    } else if (!known) {
      gachaSec.appendChild(el('p', { class: 'dx-gacha-yes', text: 'ガチャで であえる かも…？' }));
    } else {
      gachaSec.appendChild(el('p', { class: 'dx-gacha-yes', text: 'ガチャで てにはいる！' }));
      gachaSec.appendChild(el('ul', { class: 'dx-banners' }, hits.map((b) => el('li', {
        class: ['dx-banner', b.pickup ? 'is-pickup' : ''],
        style: Array.isArray(b.colors) && b.colors.length ? { '--b1': b.colors[0], '--b2': b.colors[1] || b.colors[0] } : null,
      }, el('span', { class: 'dx-banner-name', text: b.name }), b.pickup ? el('span', { class: 'dx-pickup', text: 'PICK UP' }) : null))));
    }

    // 進化系統（アイコン → Lv〇〇 → アイコン。未発見は ？？？）
    let evoSec = null;
    const family = known && D().familyOf ? D().familyOf(def.id) : [];
    if (family.length > 1) {
      const chain = el('div', { class: 'dx-evo' });
      family.forEach((fid, i) => {
        const fdef = D().monster(fid);
        const fknown = stateOf(fid) !== 'unknown';
        if (i > 0) {
          const ev = D().evolutionOf(family[i - 1]);
          chain.appendChild(el('span', { class: 'dx-evo-arrow' }, el('small', { text: ev ? 'Lv' + ev.level : '' }), el('span', { text: '→' })));
        }
        const node = el('button', {
          class: ['dx-evo-node', fid === def.id ? 'is-current' : '', fknown ? '' : 'is-unknown'],
          type: 'button', disabled: !fknown || fid === def.id, dataset: { species: fid },
        },
        el('span', { class: 'dx-evo-art' }, fknown ? spriteImg(fdef, 'dx-evo-img') : el('span', { class: 'dx-evo-img dx-noimg', text: '？' })),
        el('span', { class: 'dx-evo-name', text: fknown ? fdef.name : '？？？' }));
        if (fknown && fid !== def.id) node.addEventListener('click', () => { modalCtx.id = fid; sfx('select'); renderDetail(); });
        chain.appendChild(node);
      });
      evoSec = el('section', { class: 'dx-sec dx-sec-evo' }, el('h4', { class: 'dx-sec-title', text: 'しんか' }), chain);
    }

    // 前後ナビ
    const ids = modalCtx.ids;
    const idx = ids.indexOf(def.id);
    const navBtn = (delta, label, cls) => {
      const b = el('button', { class: ['dx-nav-btn', cls], type: 'button', text: label, disabled: ids.length < 2 });
      b.addEventListener('click', () => step(delta));
      return b;
    };
    const nav = el('div', { class: 'dx-nav' },
      navBtn(-1, '◀ まえ', 'dx-prev'),
      el('span', { class: 'dx-nav-pos', text: (idx + 1) + ' / ' + ids.length }),
      navBtn(1, 'つぎ ▶', 'dx-next'));

    body.replaceChildren(
      el('div', { class: 'dx-d-top' }, el('div', { class: 'dx-d-artbox' }, art, viewSeg), info),
      el('div', { class: 'dx-d-cols' }, statsSec, movesSec),
      ...(evoSec ? [evoSec] : []),
      el('div', { class: 'dx-d-cols' }, locSec, gachaSec),
      nav);
  }

  // ---------------------------------------------------------------- タブIF
  function onShow() {
    visible = true;
    if (dirty) render();
  }
  function onHide() { visible = false; }

  App.dexTab = {
    init, onShow, onHide,
    // 追加（テスト・他モジュール用）
    open(id) { if (D().monster(id)) openDetail(id, filteredList()); },
    stateOf,
    gachaInfo,
  };
})();
