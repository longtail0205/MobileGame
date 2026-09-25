// =====================================================================
// App.gachaTab — ガチャ画面（バナー・ボタン・提供割合・履歴・演出オーバーレイ）
//   抽選ロジックは App.gacha（js/gacha/gacha.js）。ここは見た目と進行だけ。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const LS_BANNER = 'gachamon_gacha_banner';
  const GUIDE_FLAG = 'gachaGuideDone';
  const SFX_BY_RANK = ['gachaN', 'gachaR', 'gachaSR', 'gachaSSR', 'gachaUR'];

  let panel = null;
  let built = false;
  let visible = false;
  let bgmBefore = null;   // ガチャタブに入る前に流れていた BGM（はなれるときに もどす）
  let busy = false;
  let bannerId = null;
  let refs = {};
  let refreshQueued = false;

  // ---------------------------------------------------------------- 小物
  const el = (...a) => App.util.el(...a);
  const fmt = (n) => App.util.formatNumber(n);
  const cssId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');
  function sfx(name) { try { if (App.audio) App.audio.play(name); } catch (e) { /* 無視 */ } }
  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function order() { return App.data.rarityOrder(); }
  function rank(r) { return App.data.rarityRank(r); }
  function rarityDef(r) { return App.data.rarity(r) || { name: String(r), color: '#8890a0', glow: '#cccccc', stars: 1 }; }
  function rarityClass(r) { return 'rarity-' + cssId(r); }
  function raritySfx(r) {
    if (SFX_BY_RANK.includes('gacha' + r)) return 'gacha' + r;
    const i = Math.round(rank(r) / Math.max(1, order().length - 1) * (SFX_BY_RANK.length - 1));
    return SFX_BY_RANK[Math.max(0, Math.min(SFX_BY_RANK.length - 1, i))];
  }
  function maxRarity(results) {
    let best = results[0].rarity;
    results.forEach((r) => { if (rank(r.rarity) > rank(best)) best = r.rarity; });
    return best;
  }
  function spriteImg(speciesId, cls) {
    const def = App.data.monster(speciesId);
    if (!def || !App.sprites || typeof App.sprites.monsterSprite !== 'function') return null;
    try {
      const sp = App.sprites.monsterSprite(def, 'front');
      if (!sp || !sp.src) return null;
      const img = el('img', { class: [cls, sp.flip ? 'is-flip' : ''], src: sp.src, alt: '', draggable: 'false' });
      img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });
      return img;
    } catch (e) {
      console.warn('[gachaTab] monsterSprite で例外', e);
      return null;
    }
  }
  function pct(v, digits) {
    const d = digits === undefined ? 2 : digits;
    return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d) + '%';
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 無視 */ } }

  function guideActive() {
    return !!(App.state && App.state.data && App.state.ownedCount() > 0 && !App.state.flag(GUIDE_FLAG));
  }
  function goAdventure() {
    if (App.state && App.state.data) App.state.setFlag(GUIDE_FLAG, true);
    if (App.main) App.main.switchTab('adventure');
    queueRefresh();
  }

  // バナーの代表モンスター（ピックアップ優先、なければ最上位レア度から3体）
  function featured(b) {
    const pu = App.gacha.pickupIds(b.id);
    if (pu.length) return pu.slice(0, 3);
    const out = [];
    order().slice().reverse().forEach((r) => {
      App.gacha.pool(b.id, r).forEach((id) => { if (out.length < 3) out.push(id); });
    });
    return out;
  }

  function currentBanner() {
    const list = App.gacha.banners();
    let b = list.find((x) => x.id === bannerId);
    if (!b) { b = list[0] || null; bannerId = b ? b.id : null; }
    return b;
  }

  // ---------------------------------------------------------------- タブバッジ
  //   表記は main.js と同じ「無料n」（main.js も freepulls:changed で同じ表記に更新する）
  function updateBadge() {
    if (!App.main || typeof App.main.setTabBadge !== 'function' || !App.state || !App.state.data) return;
    const n = App.state.freePulls();
    App.main.setTabBadge('gacha', n > 0 ? '無料' + n : null);
  }

  // ---------------------------------------------------------------- 画面構築
  function build() {
    panel.textContent = '';
    refs = {};
    const list = App.gacha.banners();
    if (!list.length) {
      panel.appendChild(el('div', { class: 'gc-empty-banner panel' },
        el('b', { text: 'いま ひける ガチャは ありません' }),
        el('span', { class: 'muted small', text: 'data/gacha.js の banners を かくにんしてください。' })));
      built = true;
      return;
    }
    const saved = lsGet(LS_BANNER);
    if (!bannerId && saved && list.some((b) => b.id === saved)) bannerId = saved;
    currentBanner();

    // ヘッダー
    refs.wallet = el('span', { class: 'gc-wallet-val', text: '0' });
    refs.freeChip = el('span', { class: 'gc-free-chip', hidden: true });
    const head = el('div', { class: 'gc-head' },
      el('h2', { class: 'gc-title' }, el('span', { class: 'gc-title-icon', 'aria-hidden': 'true' }), 'ガチャ'),
      el('div', { class: 'gc-head-right' },
        refs.freeChip,
        el('span', { class: 'gc-wallet', title: '所持ポイント' }, el('span', { class: 'pt-gem', 'aria-hidden': 'true' }), refs.wallet, el('small', { text: 'pt' }))));

    // バナー切替タブ
    refs.btabs = el('div', { class: 'gc-btabs', role: 'tablist', 'aria-label': 'ガチャの しゅるい' });
    list.forEach((b) => {
      const cols = Array.isArray(b.colors) && b.colors.length ? b.colors : ['#1e3a8a', '#3b82f6'];
      refs.btabs.appendChild(el('button', {
        class: 'gc-btab', type: 'button', role: 'tab', dataset: { id: b.id },
        style: { '--c1': cols[0], '--c2': cols[1] || cols[0] },
        onclick: () => selectBanner(b.id),
      }, el('span', { class: 'gc-btab-dot' }), el('span', { class: 'gc-btab-name', text: b.name || b.id }),
      App.gacha.pickupIds(b.id).length ? el('span', { class: 'gc-btab-pu', text: 'PU' }) : null));
    });

    // バナーアート（カルーセル）
    refs.art = el('div', { class: 'gc-art-host' });
    refs.dots = el('div', { class: 'gc-dots' }, list.map((b) => el('button', {
      class: 'gc-dot', type: 'button', 'aria-label': b.name || b.id, dataset: { id: b.id }, onclick: () => selectBanner(b.id),
    })));
    const multi = list.length > 1;
    const stage = el('div', { class: 'gc-stage' },
      multi ? el('button', { class: 'gc-nav gc-prev', type: 'button', 'aria-label': 'まえの ガチャ', onclick: () => stepBanner(-1) }) : null,
      refs.art,
      multi ? el('button', { class: 'gc-nav gc-next', type: 'button', 'aria-label': 'つぎの ガチャ', onclick: () => stepBanner(1) }) : null);
    bindSwipe(refs.art);

    // 情報タイル
    refs.pityVal = el('b', { class: 'gc-info-val' });
    refs.pityBar = el('i');
    refs.pityLabel = el('span', { class: 'gc-info-label' });
    refs.dexVal = el('b', { class: 'gc-info-val' });
    refs.dexBar = el('i');
    refs.pityTile = el('div', { class: 'gc-info-tile is-pity' },
      refs.pityLabel, refs.pityVal, el('span', { class: 'gc-info-bar' }, refs.pityBar));
    const info = el('div', { class: 'gc-info' },
      refs.pityTile,
      el('div', { class: 'gc-info-tile is-dex' },
        el('span', { class: 'gc-info-label', text: 'ずかん（しょじ）' }), refs.dexVal, el('span', { class: 'gc-info-bar' }, refs.dexBar)));

    // ボタン
    refs.freeSub = el('span', { class: 'gc-pull-sub' });
    refs.freeBtn = el('button', { class: 'gc-pull gc-pull-free', type: 'button', onclick: () => doPull('free') },
      el('span', { class: 'gc-pull-shine', 'aria-hidden': 'true' }),
      el('span', { class: 'gc-pull-main', text: '無料ガチャ' }), refs.freeSub);
    refs.single = pullButton('single');
    refs.multi = pullButton('multi');
    const actions = el('div', { class: 'gc-actions' }, refs.freeBtn, refs.single.btn, refs.multi.btn);

    const links = el('div', { class: 'gc-links' },
      el('button', { class: 'btn btn-sm btn-ghost gc-link-rates', type: 'button', onclick: showRates }, el('span', { class: 'btn-icon', text: '％' }), '提供割合'),
      el('button', { class: 'btn btn-sm btn-ghost gc-link-history', type: 'button', onclick: showHistory }, el('span', { class: 'btn-icon', text: '≡' }), 'ガチャ履歴'));

    // 案内
    refs.guide = el('div', { class: 'gc-guide', hidden: true });

    panel.appendChild(el('div', { class: 'gc-root' }, head, refs.btabs, stage, refs.dots, refs.guide, actions, info, links));
    built = true;
    renderArt(0);
    refresh();
  }

  function pullButton(kind) {
    const main = el('span', { class: 'gc-pull-main' });
    const cost = el('span', { class: 'gc-pull-cost' });
    const short = el('span', { class: 'gc-pull-short', hidden: true });
    const ribbon = kind === 'multi' ? el('span', { class: 'gc-pull-ribbon', hidden: true }) : null;
    const btn = el('button', { class: ['gc-pull', 'gc-pull-' + kind], type: 'button', onclick: () => doPull(kind) },
      ribbon, main, cost, short);
    return { btn, main, cost, short, ribbon };
  }

  function bindSwipe(node) {
    let sx = null;
    let sy = 0;
    node.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    node.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) stepBanner(dx < 0 ? 1 : -1);
    });
    node.addEventListener('pointercancel', () => { sx = null; });
  }

  function selectBanner(id, dir) {
    if (busy || id === bannerId) return;
    const list = App.gacha.banners();
    const from = list.findIndex((b) => b.id === bannerId);
    const to = list.findIndex((b) => b.id === id);
    if (to < 0) return;
    bannerId = id;
    lsSet(LS_BANNER, id);
    sfx('select');
    renderArt(dir || (to > from ? 1 : -1));
    refresh();
  }
  function stepBanner(d) {
    const list = App.gacha.banners();
    if (list.length < 2) return;
    const i = list.findIndex((b) => b.id === bannerId);
    const n = (i + d + list.length) % list.length;
    selectBanner(list[n].id, d);
  }

  function renderArt(dir) {
    const b = currentBanner();
    if (!b || !refs.art) return;
    const art = buildArt(b);
    refs.art.textContent = '';
    refs.art.appendChild(art);
    if (dir && !reducedMotion()) {
      art.animate([
        { opacity: 0, transform: `translateX(${dir * 56}px) scale(0.98)` },
        { opacity: 1, transform: 'none' },
      ], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
  }

  function buildArt(b) {
    const cols = Array.isArray(b.colors) && b.colors.length ? b.colors : ['#1e3a8a', '#3b82f6'];
    const feat = featured(b);
    const pu = App.gacha.pickupIds(b.id);
    const rr = App.gacha.rates(b.id);
    const topR = order().slice().reverse().find((r) => rr[r] > 0);
    const sparkPos = [[8, 18], [30, 8], [52, 80], [70, 12], [88, 30], [92, 76], [40, 60], [62, 44]];
    const mons = feat.map((id, i) => {
      const def = App.data.monster(id);
      const rd = rarityDef(def ? def.rarity : 'N');
      const img = spriteImg(id, 'gc-art-img');
      return el('div', { class: ['gc-art-mon', 'm' + i], style: { '--g': rd.glow || rd.color } },
        el('span', { class: 'gc-art-mon-halo' }), img);
    });
    const tags = pu.map((id) => {
      const def = App.data.monster(id);
      return el('span', { class: 'gc-art-tag' }, App.ui.rarityBadge(def.rarity), el('span', { text: def.name }));
    });
    const g = App.gacha.multiGuarantee();
    return el('div', { class: 'gc-art', style: { '--c1': cols[0], '--c2': cols[1] || cols[0] } },
      el('div', { class: 'gc-art-rays' }, el('i')),
      el('div', { class: 'gc-art-dots' }),
      sparkPos.map((p, i) => el('i', { class: 'gc-art-spark', style: { left: p[0] + '%', top: p[1] + '%', animationDelay: (i * 0.37).toFixed(2) + 's' } })),
      el('div', { class: 'gc-art-mons' }, mons),
      el('div', { class: 'gc-art-text' },
        el('div', { class: 'gc-art-top' },
          el('span', { class: 'gc-live' }, el('i'), '開催中'),
          pu.length ? el('span', { class: 'gc-pu-label', text: 'PICK UP' }) : null),
        el('h3', { class: 'gc-art-name', text: b.name || b.id }),
        b.desc ? el('p', { class: 'gc-art-desc', text: b.desc }) : null,
        tags.length ? el('div', { class: 'gc-art-tags' }, tags) : null),
      el('div', { class: 'gc-art-chips' },
        topR ? el('span', { class: 'gc-art-chip' }, App.ui.rarityBadge(topR), ' ' + pct(rr[topR], rr[topR] % 1 ? 1 : 0)) : null,
        g ? el('span', { class: 'gc-art-chip is-gold', text: App.gacha.multiCount() + '連で ' + g + '以上 確定' }) : null));
  }

  // ---------------------------------------------------------------- 表示更新
  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    Promise.resolve().then(() => { refreshQueued = false; refresh(); });
  }

  function refresh() {
    if (!built || !refs.single || !App.state || !App.state.data) return;
    const S = App.state;
    const G = App.gacha;
    const b = currentBanner();
    if (!b) return;
    const free = S.freePulls();
    const pts = S.points();
    refs.wallet.textContent = fmt(pts);
    refs.freeChip.hidden = free <= 0;
    refs.freeChip.textContent = '無料ガチャ ' + free + '回';

    // 無料
    refs.freeBtn.hidden = free <= 0;
    refs.freeSub.textContent = 'のこり ' + free + '回';
    refs.freeBtn.disabled = busy || !G.canPull(b.id, 1, { free: true });

    // 単発・10連
    const mc = G.multiCount();
    setPull(refs.single, b, 1, '1回 ひく');
    setPull(refs.multi, b, mc, mc + '回 ひく');
    const g = G.multiGuarantee();
    if (refs.multi.ribbon) {
      refs.multi.ribbon.hidden = !g || mc < 2;
      refs.multi.ribbon.textContent = g ? g + '以上 1体確定！' : '';
    }

    // 天井
    const remain = G.pityRemaining();
    const pc = G.pityCount();
    refs.pityTile.hidden = !Number.isFinite(remain);
    if (Number.isFinite(remain)) {
      refs.pityLabel.textContent = G.pityRarity() + '以上 かくていまで';
      refs.pityVal.textContent = '';
      refs.pityVal.append('あと ', el('em', { text: fmt(remain) }), ' 回');
      refs.pityBar.style.width = (Math.max(0, Math.min(1, (pc - remain) / pc)) * 100).toFixed(1) + '%';
      refs.pityTile.classList.toggle('is-near', remain <= Math.max(10, pc * 0.1));
    }
    // 図鑑
    const total = App.data.monsters().length;
    const owned = S.ownedCount();
    refs.dexVal.textContent = '';
    refs.dexVal.append(el('em', { text: String(owned) }), ' / ' + total);
    refs.dexBar.style.width = (total ? owned / total * 100 : 0).toFixed(1) + '%';

    // バナータブ
    refs.btabs.querySelectorAll('.gc-btab').forEach((t) => {
      const on = t.dataset.id === b.id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    refs.dots.querySelectorAll('.gc-dot').forEach((d) => d.classList.toggle('is-active', d.dataset.id === b.id));
    refs.dots.hidden = G.banners().length < 2;

    renderGuide();
  }

  function setPull(p, b, count, label) {
    const G = App.gacha;
    const cost = G.costOf(count, false);
    const can = G.canPull(b.id, count, {});
    p.main.textContent = label;
    p.cost.textContent = '';
    p.cost.append(el('span', { class: 'pt-gem', 'aria-hidden': 'true' }), fmt(cost), el('small', { text: 'pt' }));
    const short = G.shortage(b.id, count);
    p.short.hidden = can || short <= 0;
    p.short.textContent = short > 0 ? 'あと ' + fmt(short) + 'pt たりない' : '';
    p.btn.disabled = busy || !can;
    p.btn.classList.toggle('is-short', !can);
  }

  function renderGuide() {
    const g = refs.guide;
    if (!g) return;
    g.textContent = '';
    const S = App.state;
    if (S.ownedCount() === 0 && S.freePulls() > 0) {
      g.hidden = false;
      g.className = 'gc-guide is-first';
      g.append(el('span', { class: 'gc-guide-icon', text: '!' }),
        el('span', { class: 'gc-guide-text' }, 'まずは ', el('b', { text: '無料ガチャ' }), ' で さいしょの なかまを てにいれよう！'));
    } else if (guideActive()) {
      g.hidden = false;
      g.className = 'gc-guide is-adv';
      g.append(el('span', { class: 'gc-guide-icon', text: '★' }),
        el('span', { class: 'gc-guide-text' }, 'なかまが できた！ ', el('b', { text: 'ぼうけん' }), ' に でて ポイントを あつめよう！'),
        el('button', { class: 'btn btn-sm btn-primary gc-guide-btn', type: 'button', onclick: goAdventure }, 'ぼうけんに でかけよう！ ▶'));
    } else {
      g.hidden = true;
    }
  }

  // ---------------------------------------------------------------- ガチャ実行
  function nextKind(kind) {
    if (kind === 'free') return App.state.freePulls() > 0 ? 'free' : 'single';
    return kind;
  }
  function kindCount(kind) { return kind === 'multi' ? App.gacha.multiCount() : 1; }

  async function doPull(kind) {
    if (busy) return;
    const G = App.gacha;
    const b = currentBanner();
    if (!b) return;
    if (!G.canPull(b.id, kindCount(kind), { free: kind === 'free' })) {
      sfx('error');
      const short = kind === 'free' ? 0 : G.shortage(b.id, kindCount(kind));
      App.ui.toast(short > 0 ? 'ポイントが たりません（あと ' + fmt(short) + 'pt）' : 'いまは ひけません', { type: 'warn' });
      refresh();
      return;
    }
    busy = true;
    refresh();
    let action = 'close';
    let k = kind;
    lockTabs(true);
    try {
      for (;;) {
        const results = G.pull(b.id, kindCount(k), { free: k === 'free' });
        if (!results || !results.length) {
          App.ui.toast('ガチャを ひけませんでした', { type: 'error' });
          break;
        }
        action = await Show.run(results, { kind: k, bannerId: b.id });
        if (action !== 'again') break;
        k = nextKind(k);
      }
    } catch (e) {
      console.error('[gachaTab] ガチャ演出で例外', e);
    } finally {
      await Show.close();
      lockTabs(false);
      busy = false;
      refresh();
    }
    if (action === 'adventure') goAdventure();
  }

  function lockTabs(on) {
    if (!App.main || typeof App.main.setTabLock !== 'function') return;
    App.main.setTabLock(on, on ? 'ガチャの えんしゅつちゅう です' : '');
  }

  // =====================================================================
  // 演出オーバーレイ
  // =====================================================================
  const Show = (function () {
    let ov = null;
    let P = {};
    let D = null;

    // ------------------------------------------------ 進行管理（タップで早送り・SKIP）
    function makeDirector() {
      const d = {
        hurry: false, skip: false, rm: reducedMotion(), phase: 'idle',
        anims: new Set(), waiters: new Set(), tapResolve: null, endResolve: null,
      };
      d.play = (node, kf, opt) => {
        if (!node || typeof node.animate !== 'function') return Promise.resolve();
        const o = Object.assign({ fill: 'forwards', easing: 'ease-out' }, opt || {});
        if (d.rm) { o.duration = Math.min(o.duration || 0, 1); o.delay = 0; }
        const a = node.animate(kf, o);
        if (d.hurry || d.skip) { try { a.finish(); } catch (e) { /* 無視 */ } return Promise.resolve(); }
        d.anims.add(a);
        return a.finished.then(() => {}, () => {}).then(() => { d.anims.delete(a); });
      };
      d.wait = (ms) => {
        if (d.hurry || d.skip) return Promise.resolve();
        const t = d.rm ? Math.min(ms, 120) : ms;
        return new Promise((res) => {
          const f = () => { clearTimeout(timer); d.waiters.delete(f); res(); };
          const timer = setTimeout(f, t);
          d.waiters.add(f);
        });
      };
      d.fastForward = () => {
        d.hurry = true;
        d.anims.forEach((a) => { try { a.finish(); } catch (e) { /* 無視 */ } });
        d.anims.clear();
        Array.from(d.waiters).forEach((f) => f());
      };
      d.waitTap = () => new Promise((res) => { d.tapResolve = res; });
      d.tap = () => {
        if (d.tapResolve) { const r = d.tapResolve; d.tapResolve = null; r('tap'); }
        else if (d.phase === 'anim') d.fastForward();
      };
      d.doSkip = () => {
        d.skip = true;
        d.fastForward();
        if (d.tapResolve) { const r = d.tapResolve; d.tapResolve = null; r('skip'); }
      };
      return d;
    }

    // ------------------------------------------------ オーバーレイ
    function ensure() {
      if (ov) return;
      P = {};
      ov = el('div', { class: 'gc-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ガチャ えんしゅつ' },
        P.bg = el('div', { class: 'gc-ov-bg' }),
        P.rays = el('div', { class: 'gc-ov-rays' }, el('i')),
        P.stage = el('div', { class: 'gc-ov-stage' }),
        P.fx = el('div', { class: 'gc-ov-fx' }),
        P.flash = el('div', { class: 'gc-ov-flash' }),
        el('div', { class: 'gc-ov-top' },
          P.progress = el('div', { class: 'gc-ov-progress' }),
          P.skip = el('button', { class: 'gc-skip', type: 'button' }, 'SKIP', el('span', { text: '▶▶' }))),
        P.hint = el('div', { class: 'gc-ov-hint', text: 'タップで つぎへ', hidden: true }),
        P.footer = el('div', { class: 'gc-ov-footer', hidden: true }));
      ov.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (D) D.tap();
      });
      P.skip.addEventListener('click', (e) => { e.stopPropagation(); if (D) D.doSkip(); });
      document.body.appendChild(ov);
      document.body.classList.add('gc-ov-open');
      window.addEventListener('keydown', onKey, true);
      if (!reducedMotion()) ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }

    function onKey(e) {
      if (!ov || !D) return;
      if (App.ui.isModalOpen && App.ui.isModalOpen()) return;
      const k = e.code || e.key;
      const tapKeys = ['Enter', 'NumpadEnter', 'Space', 'KeyZ'];
      const backKeys = ['Escape', 'KeyX', 'Backspace'];
      if (tapKeys.includes(k)) {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        if (D.phase === 'end' && tag === 'button' && ov.contains(e.target)) return;   // フォーカス中のボタンを押す
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) D.tap();
      } else if (backKeys.includes(k)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (D.phase === 'end' && D.endResolve) D.endResolve('close');
        else if (D.multi) D.doSkip();
        else D.tap();
      }
    }

    async function close() {
      if (!ov) return;
      const o = ov;
      ov = null;
      D = null;
      window.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('gc-ov-open');
      if (!reducedMotion()) {
        try {
          await o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;
        } catch (e) { /* 無視 */ }
      }
      o.remove();
    }

    function isOpen() { return !!ov; }

    // ------------------------------------------------ 演出パーツ
    function setTint(r) {
      if (!r) {
        P.bg.classList.remove('is-lit', 'is-rainbow');
        P.rays.classList.remove('is-on', 'is-strong', 'is-rainbow');
        return;
      }
      const d = rarityDef(r);
      ov.style.setProperty('--fx', d.glow || d.color);
      ov.style.setProperty('--fx2', d.color);
      P.bg.classList.add('is-lit');
      P.bg.classList.toggle('is-rainbow', !!d.rainbow);
      const rk = rank(r);
      P.rays.classList.toggle('is-on', rk >= 1);
      P.rays.classList.toggle('is-strong', rk >= 3);
      P.rays.classList.toggle('is-rainbow', !!d.rainbow);
    }

    function flash(op, ms) {
      if (D.rm || D.skip) return;
      P.flash.animate([{ opacity: 0 }, { opacity: op, offset: 0.2 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
    }

    function shake(node, px, ms) {
      if (D.rm || D.hurry || D.skip) return;
      node.animate([
        { transform: 'translate(0, 0)' }, { transform: `translate(${-px}px, ${px / 2}px)` }, { transform: `translate(${px}px, ${-px / 2}px)` },
        { transform: `translate(${-px / 2}px, ${px / 2}px)` }, { transform: `translate(${px / 2}px, 0)` }, { transform: 'translate(0, 0)' },
      ], { duration: ms, easing: 'linear' });
    }

    // 光の粒を放射（装飾。待たない）
    function sparkBurst(r, count, spread) {
      if (D.rm || D.skip) return;
      const d = rarityDef(r);
      const cols = d.rainbow ? ['#ff4d6d', '#ffae3a', '#ffe45c', '#4ef08a', '#4fd8ff', '#b36bff'] : [d.glow || d.color, d.color, '#ffffff'];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = (spread || 180) * (0.45 + Math.random() * 0.75);
        const size = 6 + Math.floor(Math.random() * 3) * 3;
        const p = el('i', { class: 'gc-spark', style: { width: size + 'px', height: size + 'px', background: cols[i % cols.length] } });
        P.fx.appendChild(p);
        const a = p.animate([
          { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0.3) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' });
        a.onfinish = () => p.remove();
        a.oncancel = () => p.remove();
      }
    }

    function burstRing(r) {
      if (D.rm || D.skip) return;
      const d = rarityDef(r);
      const ring = el('i', { class: ['gc-ring', d.rainbow ? 'is-rainbow' : ''], style: { '--rc': d.glow || d.color } });
      P.fx.appendChild(ring);
      const a = ring.animate([
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(4.5)', opacity: 0 },
      ], { duration: 650, easing: 'cubic-bezier(0.1, 0.6, 0.3, 1)' });
      a.onfinish = () => ring.remove();
      a.oncancel = () => ring.remove();
    }

    function capsule(r) {
      const c = el('div', { class: 'gc-cap' },
        el('div', { class: 'gc-cap-glow' }),
        el('div', { class: 'gc-cap-top' }, el('i', { class: 'gc-cap-shine' }), el('i', { class: 'gc-cap-star' })),
        el('div', { class: 'gc-cap-bot' }, el('i', { class: 'gc-cap-shine2' })),
        el('div', { class: 'gc-cap-band' }));
      paintCapsule(c, r);
      return c;
    }
    function paintCapsule(c, r) {
      const d = rarityDef(r);
      c.style.setProperty('--cap', d.color);
      c.style.setProperty('--cap-glow', d.glow || d.color);
      c.classList.toggle('is-rainbow', !!d.rainbow);
      c.dataset.rarity = r;
      c.classList.toggle('is-high', rank(r) >= 2);
    }

    function machine(r) {
      const d = rarityDef(r);
      const pal = order().map((x) => rarityDef(x).color);
      const pos = [[16, 62], [34, 70], [52, 66], [70, 70], [84, 60], [24, 44], [44, 50], [62, 46], [78, 42], [36, 30], [56, 28], [20, 26], [70, 24]];
      const minis = pos.map((p, i) => el('i', {
        class: 'gc-mini',
        style: { left: p[0] + '%', top: p[1] + '%', '--mc': pal[(i * 3 + 1) % pal.length], animationDelay: (i * 0.07).toFixed(2) + 's' },
      }));
      return el('div', { class: 'gc-machine', style: { '--m-glow': d.glow || d.color } },
        el('div', { class: 'gc-m-dome' }, minis, el('i', { class: 'gc-m-shine' })),
        el('div', { class: 'gc-m-body' },
          el('div', { class: 'gc-m-label', text: 'GACHA' }),
          el('div', { class: 'gc-m-handle' }, el('i')),
          el('div', { class: 'gc-m-slot' })),
        el('div', { class: 'gc-m-base' }));
    }

    function updateProgress(results, i) {
      if (results.length < 2) { P.progress.hidden = true; return; }
      P.progress.hidden = false;
      P.progress.textContent = '';
      P.progress.append(el('span', { class: 'gc-prog-num' }, el('b', { text: String(i + 1) }), ' / ' + results.length));
      const dots = el('span', { class: 'gc-prog-dots' });
      results.forEach((r, j) => {
        const d = rarityDef(r.rarity);
        dots.appendChild(el('i', {
          class: [j < i ? 'is-done' : '', j === i ? 'is-now' : '', j < i && d.rainbow ? 'is-rainbow' : ''],
          style: j < i ? { '--dc': d.color } : null,
        }));
      });
      P.progress.appendChild(dots);
    }

    // 昇格演出の抽選（SR以上でたまに、1つ下の色から始める）
    function hintFor(r) {
      const rk = rank(r);
      if (D.rm || rk < 2) return r;
      const ch = Math.min(0.7, 0.28 + (rk - 2) * 0.14);
      if (Math.random() >= ch) return r;
      const down = rk >= 4 && Math.random() < 0.4 ? 2 : 1;
      return order()[Math.max(0, rk - down)];
    }

    // ------------------------------------------------ 1体ぶんの演出
    async function reveal(results, i, ctx) {
      const res = results[i];
      const r = res.rarity;
      const rk = rank(r);
      D.hurry = false;
      D.phase = 'anim';
      P.stage.textContent = '';
      P.fx.textContent = '';
      P.hint.hidden = true;
      setTint(null);
      updateProgress(results, i);

      const shown = hintFor(r);
      const cap = capsule(shown);

      if (i === 0 && !D.rm) {
        // ガチャマシン → カプセルが出てくる
        const m = machine(maxRarity(results));
        P.stage.appendChild(m);
        sfx('gachaRoll');
        await D.play(m, [{ transform: 'translateY(50px) scale(0.85)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 280, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
        m.classList.add('is-rolling');
        await Promise.all([
          D.play(m.querySelector('.gc-m-handle'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(720deg)' }], { duration: 950, easing: 'ease-in-out' }),
          D.play(m, [
            { transform: 'rotate(0deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(-2deg)' },
            { transform: 'rotate(2deg)' }, { transform: 'rotate(-1deg)' }, { transform: 'rotate(0deg)' },
          ], { duration: 950, easing: 'linear' }),
        ]);
        if (rank(maxRarity(results)) >= 2) m.classList.add('is-glow');
        P.stage.appendChild(cap);
        await Promise.all([
          D.play(cap, [
            { transform: 'translate(52px, 80px) scale(0.3)', opacity: 0 },
            { transform: 'translate(52px, 92px) scale(0.4)', opacity: 1, offset: 0.15 },
            { transform: 'translate(0, -50px) scale(1.08)', offset: 0.7 },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          ], { duration: 600, easing: 'ease-out' }),
          D.play(m, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(70px) scale(0.9)' }],
            { duration: 420, delay: 160, easing: 'ease-in' }),
        ]);
      } else {
        P.stage.appendChild(cap);
        if (i === 0) sfx('gachaRoll');
        else sfx('bump');
        await D.play(cap, [
          { transform: 'translateY(-70vh) rotate(-40deg)', opacity: 1, easing: 'cubic-bezier(0.5, 0, 1, 0.6)' },
          { transform: 'translateY(0) rotate(0deg)', offset: 0.6, easing: 'ease-out' },
          { transform: 'translateY(-30px) rotate(8deg)', offset: 0.8, easing: 'ease-in' },
          { transform: 'none' },
        ], { duration: 560 });
      }

      // ゆれる（レア度が高いほど長く）
      const n = rk >= 3 ? 3 : (rk >= 2 ? 2 : 1);
      cap.classList.add('is-charging');
      for (let k = 0; k < n; k++) {
        await D.play(cap, [
          { transform: 'rotate(0deg)' }, { transform: 'rotate(-16deg)' }, { transform: 'rotate(13deg)' },
          { transform: 'rotate(-7deg)' }, { transform: 'rotate(0deg)' },
        ], { duration: 440, easing: 'ease-in-out' });
        if (k < n - 1) await D.wait(140);
      }

      // 昇格（色が上位に変わる）
      if (shown !== r) {
        await D.wait(120);
        sfx('statUp');
        flash(0.9, 420);
        await D.wait(110);
        paintCapsule(cap, r);
        burstRing(r);
        sparkBurst(r, 14, 150);
        const up = el('div', { class: 'gc-rankup', text: 'RANK UP!' });
        P.fx.appendChild(up);
        if (!D.hurry && !D.skip) {
          up.animate([
            { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
            { transform: 'translate(-50%, -30px) scale(1.1)', opacity: 1, offset: 0.3 },
            { transform: 'translate(-50%, -46px) scale(1)', opacity: 0 },
          ], { duration: 900, easing: 'ease-out', fill: 'forwards' });
        } else up.remove();
        await D.play(cap, [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
          { duration: 380, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
        await D.wait(260);
      }

      // ひらく
      await D.wait(rk >= 2 ? 180 : 60);
      sfx(raritySfx(r));
      setTint(r);
      flash(rk >= 3 ? 1 : 0.75, rk >= 3 ? 520 : 300);
      burstRing(r);
      sparkBurst(r, rk >= 3 ? 34 : (rk >= 2 ? 22 : 10), rk >= 3 ? 280 : 200);
      if (rk >= 3) shake(P.stage, 10, 360);
      await Promise.all([
        D.play(cap.querySelector('.gc-cap-top'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(-50px, -130px) rotate(-55deg)', opacity: 0 }],
          { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }),
        D.play(cap.querySelector('.gc-cap-bot'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(40px, 120px) rotate(40deg)', opacity: 0 }],
          { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }),
        D.play(cap.querySelector('.gc-cap-band'), [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }),
        D.play(cap.querySelector('.gc-cap-glow'), [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 460 }),
      ]);

      // カード
      D.hurry = false;
      if (D.skip && results.length > 1) return;
      setTint(r);
      const card = revealCard(res);
      P.stage.textContent = '';
      P.stage.appendChild(card);
      if (D.skip) sfx(raritySfx(r));
      const mc = card.querySelector('.mcard');
      await D.play(mc, [
        { transform: 'perspective(700px) rotateY(95deg) scale(0.7)', opacity: 0 },
        { transform: 'perspective(700px) rotateY(-10deg) scale(1.08)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ], { duration: 520, easing: 'ease-out' });
      const details = card.querySelectorAll('.gc-rv-detail');
      details.forEach((node, j) => {
        D.play(node, [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 260, delay: 60 * j, easing: 'ease-out', fill: 'both' });
      });
      if (rk >= 2) sparkBurst(r, rk >= 3 ? 20 : 12, 240);
      D.phase = 'card';
    }

    function revealCard(res) {
      const r = res.rarity;
      const d = rarityDef(r);
      const def = App.data.monster(res.speciesId);
      const card = App.ui.monsterCard(res.speciesId, { size: 'l', badge: res.isNew ? 'NEW!' : null });
      const starsEl = el('div', { class: 'gc-rv-stars gc-rv-detail', 'aria-label': 'レア度 ' + (d.stars || 1) });
      for (let i = 0; i < (d.stars || 1); i++) starsEl.appendChild(el('span', { text: '★' }));
      let status;
      if (res.isNew) {
        status = el('div', { class: 'gc-rv-status is-new gc-rv-detail' }, el('b', { text: 'NEW!' }), ' はじめて てにいれた！');
      } else if (res.refund > 0) {
        status = el('div', { class: 'gc-rv-status is-refund gc-rv-detail' },
          '限界突破 MAX！ ', el('b', { text: '+' + fmt(res.refund) + 'pt' }), ' に 変換');
      } else {
        status = el('div', { class: 'gc-rv-status is-lb gc-rv-detail' },
          el('span', { text: '限界突破 ' }), el('b', { text: '★' + res.limitBreak }), App.ui.stars(res.limitBreak));
      }
      const ownedDef = !res.isNew && res.ownedId && res.ownedId !== res.speciesId ? App.data.monster(res.ownedId) : null;
      if (ownedDef) status.appendChild(el('small', { class: 'gc-rv-family', text: '（' + ownedDef.name + ' に はんえい）' }));
      return el('div', { class: ['gc-rv', rarityClass(r), d.rainbow ? 'is-rainbow' : ''] },
        el('div', { class: 'gc-rv-halo' }),
        res.pickup ? el('div', { class: 'gc-rv-pu gc-rv-detail', text: 'PICK UP!' }) : null,
        card,
        el('div', { class: 'gc-rv-rname gc-rv-detail' }, App.ui.rarityBadge(r), el('span', { text: d.name || r })),
        starsEl,
        status,
        res.joinedParty ? el('div', { class: 'gc-rv-party gc-rv-detail' }, el('b', { text: def ? def.name : '' }), ' が パーティに くわわった！') : null);
    }

    // ------------------------------------------------ 10連の結果一覧
    function summary(results) {
      D.phase = 'summary';
      P.skip.hidden = true;
      P.hint.hidden = true;
      P.progress.hidden = true;
      P.fx.textContent = '';
      const best = maxRarity(results);
      setTint(best);
      if (D.skip) sfx(raritySfx(best));
      P.stage.textContent = '';
      const newCount = results.filter((x) => x.isNew).length;
      const lbCount = results.filter((x) => !x.isNew && !x.refund).length;
      const refund = results.reduce((a, x) => a + (x.refund || 0), 0);
      const cells = results.map((res) => {
        const d = rarityDef(res.rarity);
        let tag = null;
        if (!res.isNew) {
          tag = res.refund > 0
            ? el('span', { class: 'gc-sum-tag is-refund', text: '+' + fmt(res.refund) + 'pt' })
            : el('span', { class: 'gc-sum-tag is-lb', text: '凸★' + res.limitBreak });
        }
        return el('div', { class: ['gc-sum-cell', rarityClass(res.rarity), d.rainbow ? 'is-rainbow' : '', rank(res.rarity) >= 2 ? 'is-high' : ''] },
          App.ui.monsterCard(res.speciesId, { size: 's', badge: res.isNew ? 'NEW' : null }),
          res.pickup ? el('span', { class: 'gc-sum-pu', text: 'PU' }) : null,
          tag);
      });
      const box = el('div', { class: 'gc-sum' },
        el('h3', { class: 'gc-sum-title', text: 'ガチャ けっか' }),
        el('div', { class: 'gc-sum-grid' }, cells),
        el('div', { class: 'gc-sum-meta' },
          newCount ? el('span', { class: 'gc-sum-chip is-new' }, 'NEW ', el('b', { text: newCount + '体' })) : null,
          lbCount ? el('span', { class: 'gc-sum-chip is-lb' }, '限界突破 ', el('b', { text: lbCount + '回' })) : null,
          refund ? el('span', { class: 'gc-sum-chip is-refund' }, 'ポイント変換 ', el('b', { text: '+' + fmt(refund) + 'pt' })) : null));
      P.stage.appendChild(box);
      if (!D.rm) {
        box.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
        cells.forEach((c, i) => {
          c.animate([{ opacity: 0, transform: 'translateY(18px) scale(0.8)' }, { opacity: 1, transform: 'none' }],
            { duration: 320, delay: 80 + i * 55, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)', fill: 'backwards' });
        });
      }
    }

    // ------------------------------------------------ 終了ボタン
    function footer(results, ctx) {
      return new Promise((resolve) => {
        const G = App.gacha;
        const again = nextKind(ctx.kind);
        const cnt = kindCount(again);
        const free = again === 'free';
        const can = G.canPull(ctx.bannerId, cnt, { free });
        const short = free ? 0 : G.shortage(ctx.bannerId, cnt);
        let label;
        if (free) label = '無料で もう1回';
        else if (cnt > 1) label = 'もう一度 ' + cnt + '回 ひく';
        else label = 'もう1回 ひく';
        const sub = free ? 'のこり ' + App.state.freePulls() + '回'
          : (short > 0 ? 'あと ' + fmt(short) + 'pt たりない' : fmt(G.costOf(cnt, false)) + 'pt');
        const done = (v) => {
          if (!D || D.endResolve !== done) return;
          D.endResolve = null;
          D.tapResolve = null;
          P.footer.hidden = true;
          if (v === 'again') sfx('confirm');
          else if (v === 'close') sfx('cancel');
          resolve(v);
        };
        P.footer.textContent = '';
        const againBtn = el('button', { class: 'btn btn-gold btn-lg gc-again', type: 'button', disabled: !can, onclick: () => done('again') },
          el('span', { class: 'gc-again-label', text: label }), el('small', { class: 'gc-again-sub', text: sub }));
        const closeBtn = el('button', { class: 'btn btn-lg gc-close', type: 'button', text: 'とじる', onclick: () => done('close') });
        const advBtn = guideActive()
          ? el('button', { class: 'btn btn-primary btn-lg gc-go-adv', type: 'button', onclick: () => done('adventure') }, 'ぼうけんに でかけよう！', el('span', { text: ' ▶' }))
          : null;
        P.footer.append(el('div', { class: 'gc-ov-btns' }, closeBtn, againBtn));
        if (advBtn) P.footer.append(advBtn);
        P.footer.hidden = false;
        if (!D.rm) P.footer.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
        D.phase = 'end';
        D.endResolve = done;
        // 単発はカード以外をタップでとじる
        if (results.length === 1) D.tapResolve = () => { if (D && D.endResolve === done) done('close'); };
        setTimeout(() => { try { (can ? againBtn : closeBtn).focus({ preventScroll: true }); } catch (e) { /* 無視 */ } }, 30);
      });
    }

    // ------------------------------------------------ 実行
    // run(results, { kind, bannerId }) → Promise<'close'|'again'|'adventure'>
    async function run(results, ctx) {
      ensure();
      D = makeDirector();
      D.multi = results.length > 1;
      P.footer.hidden = true;
      P.footer.textContent = '';
      P.skip.hidden = false;
      for (let i = 0; i < results.length; i++) {
        if (D.skip && D.multi) break;
        await reveal(results, i, ctx);
        if (!D.multi) break;
        if (D.skip) break;
        P.hint.hidden = false;
        P.hint.textContent = i < results.length - 1 ? 'タップで つぎへ' : 'タップで けっかへ';
        const v = await D.waitTap();
        if (v === 'skip') break;
      }
      P.hint.hidden = true;
      if (D.multi) summary(results);
      else P.skip.hidden = true;
      return footer(results, ctx);
    }

    return { run, close, isOpen, _director: () => D };
  })();

  // ---------------------------------------------------------------- 提供割合
  function showRates() {
    const b = currentBanner();
    if (!b) return;
    sfx('select');
    const G = App.gacha;
    const rr = G.rates(b.id);
    const sr = G.speciesRates(b.id);
    const cols = Array.isArray(b.colors) && b.colors.length ? b.colors : ['#1e3a8a', '#3b82f6'];
    const ord = order();
    const table = el('div', { class: 'gc-rate-table' }, ord.map((r) => {
      const d = rarityDef(r);
      return el('div', { class: ['gc-rate-row', rarityClass(r), d.rainbow ? 'is-rainbow' : ''] },
        App.ui.rarityBadge(r),
        el('span', { class: 'gc-rate-name', text: d.name }),
        el('span', { class: 'gc-rate-bar' }, el('i', { style: { width: Math.max(rr[r] > 0 ? 1.5 : 0, rr[r]).toFixed(2) + '%' } })),
        el('b', { class: 'gc-rate-val', text: pct(rr[r]) }));
    }));
    const notes = [];
    const g = G.multiGuarantee();
    if (g && G.multiCount() > 1) notes.push(G.multiCount() + '連ガチャの さいごの 1回は ' + g + '以上が かならず でます（それまでに ' + g + '以上が でていれば つうじょうの かくりつ）。');
    if (Number.isFinite(G.pityRemaining())) notes.push('天井: ' + G.pityRarity() + '以上が でないまま ' + G.pityCount() + '回 ひくと ' + G.pityRarity() + '以上が かくてい。（すべての ガチャで きょうつう・いま あと ' + G.pityRemaining() + '回）');
    if (G.pickupIds(b.id).length) notes.push('ピックアップ: その レア度が でたとき ' + Math.round(G.pickupRate(b.id) * 100) + '% の かくりつで ピックアップ たいしょうが えらばれます。');
    const mlb = Math.max(0, Math.floor(Number(((window.GameData || {}).gacha || {}).maxLimitBreak) || 0));
    notes.push('おなじ モンスターが でると 限界突破（さいだい ★' + mlb + '）。MAX のあとは レア度に おうじた ポイントに 変換されます。');

    const groups = ord.slice().reverse().filter((r) => G.pool(b.id, r).length).map((r) => {
      const d = rarityDef(r);
      const items = sr.filter((x) => x.rarity === r).sort((a, c) => (c.pickup - a.pickup) || (c.rate - a.rate));
      return el('section', { class: ['gc-rate-group', rarityClass(r)] },
        el('h4', { class: 'gc-rate-gtitle' }, App.ui.rarityBadge(r), el('span', { text: d.name }), el('b', { text: pct(rr[r]) })),
        el('ul', { class: 'gc-rate-list' }, items.map((x) => {
          const def = App.data.monster(x.speciesId);
          const owned = App.state.ownedInFamily ? !!App.state.ownedInFamily(x.speciesId) : App.state.isOwned(x.speciesId);
          return el('li', { class: ['gc-rate-item', x.pickup ? 'is-pu' : ''] },
            el('span', { class: 'gc-rate-img' }, spriteImg(x.speciesId, 'gc-rate-sprite')),
            el('span', { class: 'gc-rate-mname', text: def ? def.name : x.speciesId }),
            x.pickup ? el('span', { class: 'gc-rate-pu', text: 'PU' }) : null,
            owned ? el('span', { class: 'gc-rate-owned', title: 'しょじ', text: '✓' }) : null,
            el('b', { class: 'gc-rate-mval', text: pct(x.rate, 3) }));
        })));
    });

    const body = el('div', { class: 'gc-rates' },
      el('div', { class: 'gc-rate-head', style: { '--c1': cols[0], '--c2': cols[1] || cols[0] } },
        el('b', { text: b.name || b.id }), b.desc ? el('small', { text: b.desc }) : null),
      el('h4', { class: 'gc-rate-sub', text: 'レア度ごとの 出現率' }),
      table,
      el('ul', { class: 'gc-rate-notes' }, notes.map((t) => el('li', { text: t }))),
      el('h4', { class: 'gc-rate-sub', text: 'モンスターごとの 出現率' }),
      groups);
    App.ui.modal({ title: '提供割合', body, size: 'wide', className: 'gc-modal', buttons: [{ label: 'とじる', value: true, primary: true }] });
  }

  // ---------------------------------------------------------------- 履歴
  function showHistory() {
    sfx('select');
    const d = App.state.data;
    const hist = ((d.gacha && d.gacha.history) || []).slice().reverse();
    const st = App.gacha.stats();
    const bname = (id) => { const b = App.gacha.banner(id); return b ? (b.name || b.id) : (id || '—'); };
    const two = (n) => String(n).padStart(2, '0');
    const when = (ms) => {
      const t = new Date(ms || 0);
      return (t.getMonth() + 1) + '/' + t.getDate() + ' ' + two(t.getHours()) + ':' + two(t.getMinutes());
    };
    const summaryRow = el('div', { class: 'gc-hist-sum' },
      el('div', { class: 'gc-hist-total' }, 'そうかいすう ', el('b', { text: fmt(st.totalPulls) + '回' })),
      el('div', { class: 'gc-hist-chips' }, order().map((r) => el('span', { class: 'gc-hist-chip' }, App.ui.rarityBadge(r), el('b', { text: fmt(st.byRarity[r] || 0) })))));
    const list = hist.length
      ? el('ol', { class: 'gc-hist-list' }, hist.map((e) => {
        const def = App.data.monster(e.speciesId);
        const rd = rarityDef(e.rarity);
        let res;
        if (e.isNew) res = el('span', { class: 'gc-hist-res is-new', text: 'NEW' });
        else if (e.refund) res = el('span', { class: 'gc-hist-res is-refund', text: '+' + fmt(e.refund) + 'pt' });
        else res = el('span', { class: 'gc-hist-res is-lb', text: '凸★' + (e.limitBreak || 0) });
        return el('li', { class: ['gc-hist-row', rarityClass(e.rarity), rd.rainbow ? 'is-rainbow' : ''] },
          el('span', { class: 'gc-hist-img' }, spriteImg(e.speciesId, 'gc-hist-sprite')),
          el('span', { class: 'gc-hist-main' },
            el('span', { class: 'gc-hist-name' }, App.ui.rarityBadge(e.rarity), el('span', { text: def ? def.name : e.speciesId })),
            el('small', { class: 'gc-hist-meta', text: when(e.at) + '・' + bname(e.bannerId) })),
          res);
      }))
      : el('p', { class: 'gc-hist-empty', text: 'まだ ガチャを ひいていません。' });
    const body = el('div', { class: 'gc-hist' },
      summaryRow,
      el('p', { class: 'gc-hist-note', text: 'さいしんの 200件まで きろくされます（あたらしい じゅん）。' }),
      list);
    App.ui.modal({ title: 'ガチャ履歴', body, size: 'wide', className: 'gc-modal', buttons: [{ label: 'とじる', value: true, primary: true }] });
  }

  // ---------------------------------------------------------------- タブインターフェース
  function init(panelEl) {
    panel = panelEl || document.getElementById('tab-gacha');
    if (!panel) throw new Error('#tab-gacha が見つかりません');
    panel.classList.add('gc-panel');
    build();
    const E = App.events;
    ['points:changed', 'collection:changed', 'gacha:pulled', 'party:changed'].forEach((n) => E.on(n, queueRefresh));
    E.on('freepulls:changed', () => { queueRefresh(); updateBadge(); });
    ['state:loaded', 'state:reset'].forEach((n) => E.on(n, () => {
      if (Show.isOpen()) return;
      build();
      updateBadge();
    }));
    E.on('tab:changed', (p) => {
      if (p && p.id === 'adventure' && App.state.data && App.state.ownedCount() > 0 && !App.state.flag(GUIDE_FLAG)) {
        App.state.setFlag(GUIDE_FLAG, true);
        queueRefresh();
      }
    });
    updateBadge();
  }

  function onShow() {
    visible = true;
    if (!built) build();
    refresh();
    try {
      if (App.audio) {
        const cur = typeof App.audio.currentBgm === 'function' ? App.audio.currentBgm() : null;
        bgmBefore = cur && cur !== 'gacha' ? cur : null;
        App.audio.playBgm('gacha');
      }
    } catch (e) { /* 無視 */ }
  }

  function onHide() {
    visible = false;
    try {
      if (App.audio && typeof App.audio.currentBgm === 'function' && App.audio.currentBgm() === 'gacha') {
        if (bgmBefore) App.audio.playBgm(bgmBefore);
        else App.audio.stopBgm();
      }
    } catch (e) { /* 無視 */ }
    bgmBefore = null;
  }

  App.gachaTab = {
    init, onShow, onHide,
    // 以下は拡張（テスト・他モジュール用）
    refresh,
    pull: doPull,
    selectBanner,
    currentBannerId() { return bannerId; },
    isBusy() { return busy; },
    isVisible() { return visible; },
    showRates, showHistory,
    _show: Show,
  };
})();
