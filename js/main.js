// =====================================================================
// main.js — 起動シーケンス・タブ切替・トップバー・ニューゲーム・ログインボーナス
//   どのモジュールが欠けていても（未作成・例外）起動を続行する。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const TABS = [
    { id: 'adventure', label: 'ぼうけん', mod: 'field' },
    { id: 'party', label: 'へんせい', mod: 'partyTab' },
    { id: 'gacha', label: 'ガチャ', mod: 'gachaTab' },
    { id: 'dex', label: 'ずかん', mod: 'dexTab' },
    { id: 'settings', label: 'その他', mod: 'settingsTab' },
  ];
  const INIT_ORDER = ['audio', 'ui', 'input', 'dialog', 'sprites', 'field', 'battle', 'gachaTab', 'partyTab', 'dexTab', 'settingsTab'];
  const TAB_MODS = new Set(TABS.map((t) => t.mod));
  const SCALE_MIN = 0.35;
  const SCALE_MAX = 1.5;

  // ドット絵アイコン（X = 濃い / o = 薄い）
  const ICONS = {
    adventure: [
      '......X.......',
      '......XXXX....',
      '......XXXXXX..',
      '......XXXXXXXX',
      '......XXXXXX..',
      '......XXXX....',
      '......X.......',
      '......X.......',
      '......X.......',
      '....ooXoo.....',
      '..oooooooooo..',
      '.oooooooooooo.',
      'oooooooooooooo',
      'oooooooooooooo',
    ],
    party: [
      '.........ooo..',
      '........ooooo.',
      '...XXX..ooooo.',
      '..XXXXX..ooo..',
      '..XXXXX.......',
      '..XXXXX.ooooo.',
      '...XXX.ooooooo',
      '.......ooooooo',
      '.XXXXXXX.ooooo',
      'XXXXXXXXX.oooo',
      'XXXXXXXXX.oooo',
      'XXXXXXXXX.....',
      'XXXXXXXXX.....',
    ],
    gacha: [
      '...XXXXXXXX...',
      '..XX......XX..',
      '.XX.oo..o..XX.',
      '.X.oooo.oo..X.',
      '.X..oo.oooo.X.',
      '.X.o...oooo.X.',
      '.XXXXXXXXXXXX.',
      '.X..........X.',
      '.X....XX....X.',
      '.X...X..X...X.',
      '.X....XX....X.',
      '.XXXXXXXXXXXX.',
      '..XX......XX..',
      '..XX......XX..',
    ],
    dex: [
      '.XXXXXXXXXXX..',
      '.X.........XX.',
      '.X.ooooooo.XX.',
      '.X.o.....o.XX.',
      '.X.ooooooo.XX.',
      '.X.........XX.',
      '.X..ooooo..XX.',
      '.X.........XX.',
      '.X..ooooo..XX.',
      '.X.........XX.',
      '.XXXXXXXXXXXX.',
      '.X.XXXXXXXXXX.',
      '..XXXXXXXXXX..',
    ],
    settings: [
      '.....XXX.....',
      '..X..XXX..X..',
      '.XXXXXXXXXXX.',
      '..XXXXXXXXX..',
      '..XXXoooXXX..',
      'XXXXo...oXXXX',
      'XXXXo...oXXXX',
      'XXXXo...oXXXX',
      '..XXXoooXXX..',
      '..XXXXXXXXX..',
      '.XXXXXXXXXXX.',
      '..X..XXX..X..',
      '.....XXX.....',
    ],
    soundOn: [
      '.....X........',
      '....XX...X....',
      '...XXX....X...',
      'XXXXXX..X..X..',
      'XXXXXX...X.X..',
      'XXXXXX...X.X..',
      'XXXXXX..X..X..',
      '...XXX....X...',
      '....XX...X....',
      '.....X........',
    ],
    soundOff: [
      '.....X........',
      '....XX........',
      '...XXX........',
      'XXXXXX.X...X..',
      'XXXXXX..X.X...',
      'XXXXXX...X....',
      'XXXXXX..X.X...',
      '...XXX.X...X..',
      '....XX........',
      '.....X........',
    ],
    soon: [
      '....XXXXX....',
      '..XX.....XX..',
      '.X....X....X.',
      '.X....X....X.',
      'X.....X.....X',
      'X.....X.....X',
      'X.....XXXX..X',
      'X...........X',
      '.X.........X.',
      '.X.........X.',
      '..XX.....XX..',
      '....XXXXX....',
    ],
  };

  function pixelIcon(name, cls) {
    const rows = ICONS[name];
    if (!rows) return '';
    const w = Math.max(...rows.map((r) => r.length));
    const h = rows.length;
    let full = '';
    let dim = '';
    rows.forEach((r, y) => {
      let x = 0;
      while (x < r.length) {
        const ch = r[x];
        if (ch === 'X' || ch === 'o') {
          let x2 = x;
          while (x2 < r.length && r[x2] === ch) x2++;
          const rect = `M${x} ${y}h${x2 - x}v1h-${x2 - x}z`;
          if (ch === 'X') full += rect; else dim += rect;
          x = x2;
        } else x++;
      }
    });
    return `<svg class="px-icon ${cls || ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" shape-rendering="crispEdges">` +
      (dim ? `<path d="${dim}" fill="currentColor" opacity="0.5"/>` : '') +
      `<path d="${full}" fill="currentColor"/></svg>`;
  }

  let current = null;
  let locked = false;
  let lockReason = '';
  const devMessages = [];
  const missing = new Set();
  const params = new URLSearchParams(location.search);

  const $ = (sel) => document.querySelector(sel);
  const emit = (n, p) => { if (App.events) App.events.emit(n, p || {}); };
  const sfx = (n) => { try { if (App.audio && App.audio.play) App.audio.play(n); } catch (e) { /* 無視 */ } };
  const cfg = () => (window.GameData && window.GameData.config) || {};
  const fmt = (n) => (App.util ? App.util.formatNumber(n) : String(n));

  function devMsg(level, text) {
    devMessages.push({ level, text });
    if (App.ui && App.ui.devPanel && document.getElementById('modal-root')) App.ui.devPanel([{ level, text }]);
  }

  function safe(label, fn) {
    try { return fn(); } catch (e) {
      console.error('[main] ' + label + ' で例外:', e);
      devMsg('error', label + ' で例外: ' + (e && e.message ? e.message : e));
      return undefined;
    }
  }

  // ---------------------------------------------------------------- モジュール初期化
  function panelOf(id) { return document.getElementById('tab-' + id); }

  function initModule(name) {
    const mod = App[name];
    if (!mod || typeof mod.init !== 'function') {
      missing.add(name);
      console.info('[main] モジュール App.' + name + ' は未実装のためスキップします');
      return;
    }
    const tab = TABS.find((t) => t.mod === name);
    try {
      if (tab) mod.init(panelOf(tab.id));
      else mod.init();
    } catch (e) {
      missing.add(name);
      console.error('[main] App.' + name + '.init() で例外:', e);
      devMsg('error', 'App.' + name + '.init() で例外: ' + (e && e.message ? e.message : e));
    }
  }

  function comingSoon(panel, label) {
    const el = App.util.el;
    panel.appendChild(el('div', { class: 'coming-soon' },
      el('div', { class: 'coming-soon-icon', html: pixelIcon('soon') }),
      el('b', { text: label + ' は じゅんびちゅう…' }),
      el('span', { class: 'muted', text: 'このきのうは まだ つくられていません。' })));
  }

  function tabModule(tab) {
    const m = App[tab.mod];
    return m && !missing.has(tab.mod) ? m : null;
  }

  // ---------------------------------------------------------------- トップバー
  let shownPoints = 0;
  let pointsRaf = 0;

  function buildTopbar() {
    const title = $('#tb-title');
    const sub = $('#tb-sub');
    if (title) title.textContent = cfg().title || 'ガチャモン';
    if (sub) sub.textContent = cfg().subtitle || '';
    if (cfg().title) document.title = cfg().title;

    shownPoints = App.state.points();
    const val = $('#tb-points .pt-value');
    if (val) val.textContent = fmt(shownPoints);
    updateFreePulls(App.state.freePulls());
    updateSoundBtn();

    const soundBtn = $('#tb-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const next = !App.state.setting('sound');
        App.state.setSetting('sound', next);
        if (next) sfx('confirm');
        App.ui.toast(next ? 'サウンド ON' : 'サウンド OFF', { duration: 1200 });
      });
    }
    const pill = $('#tb-points');
    if (pill) pill.addEventListener('click', () => switchTab('gacha'));
    const free = $('#tb-free');
    if (free) free.addEventListener('click', () => switchTab('gacha'));

    // バッジ数の小表示（クリックで その他タブのバッジケースへ）
    const right = $('#topbar .tb-right');
    const badgeTotal = (window.GameData && Array.isArray(window.GameData.badges)) ? window.GameData.badges.length : 0;
    if (right && badgeTotal && App.state.badgeCount) {
      const el = App.util.el;
      const btn = el('button', { id: 'tb-badges', class: 'tb-badges', type: 'button' }, el('span', { class: 'gm-badge' }), el('b', { text: '0' }));
      right.insertBefore(btn, $('#tb-points'));
      btn.addEventListener('click', () => switchTab('settings'));
      updateBadges();
      App.events.on('badges:changed', updateBadges);
      App.events.on('state:loaded', updateBadges);
    }

    App.events.on('points:changed', (p) => animatePoints(p.points, p.delta));
    App.events.on('freepulls:changed', (p) => updateFreePulls(p.freePulls));
    App.events.on('settings:changed', (p) => { if (p.key === 'sound') updateSoundBtn(); });
  }

  function animatePoints(target, delta) {
    const pill = $('#tb-points');
    const val = pill && pill.querySelector('.pt-value');
    if (!val) return;
    cancelAnimationFrame(pointsRaf);
    const from = shownPoints;
    const start = performance.now();
    const dur = Math.min(900, 350 + Math.abs(target - from) / 20);
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      shownPoints = Math.round(from + (target - from) * e);
      val.textContent = fmt(shownPoints);
      if (t < 1) pointsRaf = requestAnimationFrame(step);
      else { shownPoints = target; val.textContent = fmt(target); }
    };
    pointsRaf = requestAnimationFrame(step);
    if (!delta) return;
    pill.classList.remove('is-pop', 'is-drop');
    void pill.offsetWidth;
    pill.classList.add(delta > 0 ? 'is-pop' : 'is-drop');
    const fl = App.util.el('span', { class: 'pt-float ' + (delta > 0 ? 'is-plus' : 'is-minus'), text: (delta > 0 ? '+' : '−') + fmt(Math.abs(delta)) });
    pill.appendChild(fl);
    setTimeout(() => fl.remove(), 1200);
  }

  function updateBadges() {
    const btn = $('#tb-badges');
    if (!btn || !App.state.data) return;
    const total = (window.GameData.badges || []).length;
    const n = App.state.badgeCount();
    btn.querySelector('b').textContent = n + '/' + total;
    btn.classList.toggle('is-none', n === 0);
    btn.title = 'バッジ ' + n + '/' + total + '（Lv上限 ' + App.state.levelCap() + '）' + (App.state.isChampion() ? ' ・チャンピオン' : '');
  }

  function updateFreePulls(n) {
    const free = $('#tb-free');
    if (free) {
      free.hidden = !(n > 0);
      const b = free.querySelector('b');
      if (b) b.textContent = String(n);
    }
    setTabBadge('gacha', n > 0 ? '無料' + n : null);
  }

  function updateSoundBtn() {
    const btn = $('#tb-sound');
    if (!btn || !App.state.data) return;
    const on = !!App.state.setting('sound');
    btn.innerHTML = pixelIcon(on ? 'soundOn' : 'soundOff');
    btn.classList.toggle('is-off', !on);
    btn.title = on ? 'サウンド ON（クリックで OFF）' : 'サウンド OFF（クリックで ON）';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ---------------------------------------------------------------- タブ
  function buildTabs() {
    const bar = $('#tabbar');
    if (!bar) return;
    TABS.forEach((tab, i) => {
      let btn = bar.querySelector(`[data-tab="${tab.id}"]`);
      if (!btn) {
        btn = App.util.el('button', { class: 'tab-btn', type: 'button', role: 'tab', dataset: { tab: tab.id } },
          App.util.el('span', { class: 'tab-icon' }), App.util.el('span', { class: 'tab-label', text: tab.label }),
          App.util.el('span', { class: 'tab-badge', hidden: true }));
        bar.appendChild(btn);
      }
      const icon = btn.querySelector('.tab-icon');
      if (icon) icon.innerHTML = pixelIcon(tab.id);
      btn.title = tab.label + '（' + (i + 1) + '）';
      btn.addEventListener('click', () => switchTab(tab.id));
      const panel = panelOf(tab.id);
      if (panel && !tabModule(tab) && tab.id !== 'adventure') comingSoon(panel, tab.label);
    });
    if (!tabModule(TABS[0])) {
      const layer = $('#field-layer');
      if (layer) layer.appendChild(App.util.el('div', { class: 'screen-placeholder' },
        App.util.el('b', { text: 'ぼうけん は じゅんびちゅう…' }), App.util.el('span', { text: 'PLEASE WAIT' })));
    }
  }

  function callTab(tab, fn) {
    const m = tabModule(tab);
    if (m && typeof m[fn] === 'function') safe('App.' + tab.mod + '.' + fn + '()', () => m[fn]());
  }

  function switchTab(id) {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return false;
    if (id === current) return true;
    if (locked && current) {
      App.ui.toast(lockReason || 'いまは きりかえ できません', { type: 'warn', duration: 1600 });
      sfx('error');
      return false;
    }
    const prev = current;
    const prevTab = TABS.find((t) => t.id === prev);
    if (prevTab) {
      const pp = panelOf(prev);
      if (pp) { pp.hidden = true; pp.classList.remove('is-active'); }
      callTab(prevTab, 'onHide');
    }
    current = id;
    const panel = panelOf(id);
    if (panel) {
      panel.hidden = false;
      panel.classList.remove('is-active');
      void panel.offsetWidth;
      panel.classList.add('is-active');
    }
    document.querySelectorAll('#tabbar .tab-btn').forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.body.dataset.activeTab = id;
    if (App.input && App.input.setActive) App.input.setActive(id === 'adventure');
    if (id === 'adventure') layoutScreen();
    callTab(tab, 'onShow');
    if (prev) sfx('select');
    if (id !== 'adventure') window.scrollTo(0, 0);
    emit('tab:changed', { id, prev });
    return true;
  }

  function setTabLock(v, reason) {
    locked = !!v;
    lockReason = locked ? (reason || '') : '';
    document.body.classList.toggle('tabs-locked', locked);
    document.querySelectorAll('#tabbar .tab-btn').forEach((b) => {
      const dis = locked && b.dataset.tab !== current;
      b.classList.toggle('is-locked', dis);
      b.setAttribute('aria-disabled', dis ? 'true' : 'false');
    });
  }

  function setTabBadge(id, text) {
    const btn = document.querySelector(`#tabbar [data-tab="${id}"]`);
    const badge = btn && btn.querySelector('.tab-badge');
    if (!badge) return;
    const show = text !== null && text !== undefined && text !== '' && text !== false;
    badge.hidden = !show;
    badge.textContent = show ? String(text) : '';
  }

  function bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const m = /^(Digit|Numpad)([1-5])$/.exec(e.code || '');
      const num = m ? Number(m[2]) : (/^[1-5]$/.test(e.key) ? Number(e.key) : 0);
      if (!num) return;
      if (App.util.isTypingTarget(e.target)) return;
      if (App.ui && App.ui.isModalOpen && App.ui.isModalOpen()) return;
      if (App.battle && App.battle.isActive && safe('battle.isActive', () => App.battle.isActive())) return;
      if (locked) return;
      e.preventDefault();
      switchTab(TABS[num - 1].id);
    });
  }

  // ---------------------------------------------------------------- #screen の拡大縮小
  function applyScale(s) {
    document.documentElement.style.setProperty('--screen-scale', String(s));
    const wrap = $('#screen-wrap');
    if (wrap) {
      wrap.style.width = Math.round(720 * s) + 'px';
      wrap.style.height = Math.round(480 * s) + 'px';
    }
  }

  function layoutScreen() {
    const panel = panelOf('adventure');
    const gba = $('#gba');
    if (!panel || !gba || panel.hidden) return;
    const cs = getComputedStyle(panel);
    const availW = panel.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const vh = window.innerHeight;
    const tabbar = $('#tabbar');
    const tcs = tabbar ? getComputedStyle(tabbar) : null;
    const bottomReserved = tcs && tcs.position === 'fixed' && tabbar.getBoundingClientRect().top > vh / 2 ? tabbar.offsetHeight : 0;
    const hint = $('#gba-hint');

    const measure = (mode) => {
      gba.classList.toggle('gba-wide', mode === 'wide');
      gba.classList.toggle('gba-narrow', mode === 'narrow');
      applyScale(1);
      const r = gba.getBoundingClientRect();
      const ovW = r.width - 720;
      const ovH = r.height - 480;
      const top = r.top + window.scrollY;
      const hcs = hint ? getComputedStyle(hint) : null;
      const hintH = hcs && hcs.display !== 'none' ? hint.offsetHeight + (parseFloat(hcs.marginTop) || 0) : 0;
      const availH = vh - top - bottomReserved - hintH - (parseFloat(cs.paddingBottom) || 0) - 2;
      return Math.min((availW - ovW) / 720, (availH - ovH) / 480);
    };
    const sWide = measure('wide');
    const sNarrow = measure('narrow');
    const mode = sWide >= sNarrow * 0.92 ? 'wide' : 'narrow';
    let s = mode === 'wide' ? sWide : sNarrow;
    s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.floor(s * 100) / 100));
    gba.classList.toggle('gba-wide', mode === 'wide');
    gba.classList.toggle('gba-narrow', mode === 'narrow');
    document.body.dataset.gbaLayout = mode;
    applyScale(s);
  }

  function bindResize() {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (current === 'adventure') layoutScreen(); });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize).catch(() => {});
  }

  // ---------------------------------------------------------------- ニューゲーム・ログボ
  function welcomeArt() {
    const el = App.util.el;
    return el('div', { class: 'welcome-art', 'aria-hidden': 'true' },
      el('span', { class: 'capsule c1' }), el('span', { class: 'capsule c2' }), el('span', { class: 'capsule c3' }));
  }

  async function askName() {
    const el = App.util.el;
    const def = (cfg().player && cfg().player.defaultName) || 'ユウ';
    const input = el('input', { class: 'input input-lg', type: 'text', value: def, maxlength: 8, placeholder: def, autocomplete: 'off', spellcheck: 'false' });
    const body = el('div', { class: 'newgame-body' },
      el('div', { class: 'newgame-logo' },
        el('span', { class: 'logo-main', text: cfg().title || 'ガチャモン' }),
        el('span', { class: 'logo-sub', text: cfg().subtitle || '' })),
      el('p', { class: 'modal-text center', text: 'ようこそ！ ガチャで なかまを あつめて\nぼうけんに でかけよう！' }),
      el('label', { class: 'field-label', text: 'きみの なまえを おしえてね（8もじまで）' }),
      input);
    const v = await App.ui.modal({
      title: 'はじめから',
      className: 'modal-newgame',
      body,
      closable: false,
      buttons: [{ label: 'けってい', primary: true, value: () => input.value.trim() }],
    });
    return (v && String(v).trim()) || def;
  }

  async function newGame(autostart) {
    const S = App.state;
    const name = autostart ? ((cfg().player && cfg().player.defaultName) || 'ユウ') : await askName();
    const ws = (window.GameData && window.GameData.worldStart) || { map: '', x: 0, y: 0, dir: 'down' };
    S.data.player.name = String(name).slice(0, 8);
    S.data.createdAt = Date.now();
    S.data.lastLogin = App.util.today();
    S.data.stats.loginDays = Math.max(1, S.data.stats.loginDays || 0);
    S.setPlayerPos(ws.map, ws.x, ws.y, ws.dir || 'down');
    S.setRespawn(ws.map, ws.x, ws.y, ws.dir || 'down');
    S.saveNow();
    emit('player:renamed', { name: S.data.player.name });
    if (autostart) return;
    sfx('coin');
    const el = App.util.el;
    const n = S.freePulls();
    await App.ui.modal({
      title: 'プレゼント！',
      className: 'modal-gift',
      closable: false,
      body: el('div', { class: 'gift-body' },
        welcomeArt(),
        el('div', { class: 'gift-title' }, '無料ガチャ ', el('b', { text: n + '回' }), ' プレゼント！'),
        el('p', { class: 'modal-text center', text: S.data.player.name + ' さん、ようこそ！\nまずは ガチャで さいしょの なかまを てにいれよう！\nモンスターが いないと まちの そとには でられないよ。' })),
      buttons: [{ label: 'ガチャへ すすむ！', value: true, gold: true, primary: true }],
    });
  }

  async function loginBonus(autostart) {
    const S = App.state;
    const t = App.util.today();
    if (S.data.lastLogin === t) return;
    const bonus = Math.max(0, Math.floor(Number(cfg().loginBonus) || 0));
    const days = (S.data.stats.loginDays || 0) + 1;
    if (bonus > 0 && !autostart) {
      // 「うけとる」を押した時点で付与（トップバーのカウントアップが見えるように）
      const el = App.util.el;
      await App.ui.modal({
        title: 'ログインボーナス',
        className: 'modal-gift',
        closable: false,
        body: el('div', { class: 'gift-body' },
          el('div', { class: 'bonus-days', text: 'ログイン ' + days + '日目' }),
          el('div', { class: 'bonus-amount' }, el('span', { class: 'pt-gem big' }), el('b', { text: '+' + fmt(bonus) }), el('small', { text: 'pt' })),
          el('p', { class: 'modal-text center', text: 'まいにち ログインで ポイントが もらえるよ！\nガチャを まわして なかまを ふやそう！' })),
        buttons: [{ label: 'うけとる', value: true, gold: true, primary: true }],
      });
    }
    S.data.lastLogin = t;
    S.data.stats.loginDays = days;
    S.save();
    if (!bonus) return;
    S.addPoints(bonus, 'login');
    sfx('coin');
    if (autostart) App.ui.toast('ログインボーナス +' + fmt(bonus) + ' pt', { type: 'success' });
  }

  // ---------------------------------------------------------------- 起動
  async function boot() {
    App.ready = false;
    if (cfg().debug) {
      window.addEventListener('error', (e) => devMsg('error', '例外: ' + (e.message || e.error)));
      window.addEventListener('unhandledrejection', (e) => devMsg('error', '未処理の Promise 例外: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
    }
    if (!App.util || !App.events || !App.data || !App.state) {
      console.error('[main] コアモジュールが読み込まれていません');
      document.body.appendChild(document.createTextNode('起動に失敗しました（コアモジュールがありません）'));
      return;
    }

    // 1) エディタ上書き → 検証
    safe('App.data.applyOverrides()', () => App.data.applyOverrides());
    const report = safe('App.data.validate()', () => App.data.validate()) || { errors: [], warnings: [] };
    report.errors.forEach((t) => devMessages.push({ level: 'error', text: t }));
    report.warnings.forEach((t) => devMessages.push({ level: 'warn', text: t }));
    if (report.errors.length) console.warn('[main] データ検証エラー:\n' + report.errors.join('\n'));
    if (report.warnings.length) console.warn('[main] データ検証の警告:\n' + report.warnings.join('\n'));

    // 2) セーブ読込
    safe('App.state.load()', () => App.state.load());
    if (!App.state.data) {
      console.error('[main] セーブデータを初期化できませんでした');
      return;
    }

    // 3) 各モジュール init
    for (const name of INIT_ORDER) initModule(name);
    if (!App.ui || missing.has('ui')) {
      console.error('[main] App.ui が使えないため起動を中止します');
      return;
    }

    // 4) トップバー・タブ
    safe('buildTopbar', buildTopbar);
    safe('buildTabs', buildTabs);
    bindGlobalKeys();
    bindResize();

    const lw = App.state.loadWarnings || [];
    lw.forEach((t) => devMessages.push({ level: 'warn', text: t }));
    if (lw.length) App.ui.toast('セーブデータを ほせい しました（くわしくは 開発メッセージ）', { type: 'warn', duration: 4000 });
    if (devMessages.length) App.ui.devPanel(devMessages);
    if (App.data.overrideInfo && App.data.overrideInfo().active) document.body.classList.add('has-overrides');
    App.booted = true;

    // 5) ゲーム開始
    const autostart = params.get('autostart') === '1';
    const tabParam = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : null;
    if (App.state.isNewGame()) {
      switchTab(tabParam || 'adventure');
      await newGame(autostart);
      switchTab(tabParam || 'gacha');
    } else {
      switchTab(tabParam || 'adventure');
      await loginBonus(autostart);
    }
    App.ready = true;
    emit('app:ready', {});
  }

  App.main = {
    switchTab,
    currentTab() { return current; },
    setTabLock,
    isTabLocked() { return locked; },
    setTabBadge,
    // 追加
    layoutScreen,
    pixelIcon,
    tabs() { return TABS.map((t) => Object.assign({}, t)); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); });
  else boot();
})();
