// =====================================================================
// App.field — ぼうけん（フィールド）タブ
//   #field-canvas（240x160）にマップ・キャラを描き、移動・会話・ワープ・
//   エンカウント・トレーナー戦・ポイント拾い・全滅処理を行う。
//   描画順: 地形（事前描画）→ アニメタイル → ポイントのキラキラ →
//           キャラ（y順、各キャラの直後に足元の草むらオーバーレイ）→ 吹き出し
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const TS = 16;
  const VW = 240;
  const VH = 160;
  const PAD = 9;                 // 事前描画するマップ外（border）の幅（マス）
  const TURN_MS = 110;           // 立ち止まって別の向きを押したとき、歩き出すまでの猶予
  const PENDING_MS = 260;        // 短いタップを「1歩」として受け付ける有効時間
  const BUMP_SFX_GAP = 420;      // 壁にぶつかる音の最短間隔
  const WANDER_R = 2;            // wander NPC がホームから離れる最大マス数
  const DIRS = ['up', 'down', 'left', 'right'];
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const DEFAULT_LOOK = { skin: '#f8d0a8', hair: '#503020', hairStyle: 'short', shirt: '#3070d0', pants: '#304060', hat: null, accent: '#ffffff' };

  let inited = false;
  let canvas = null;
  let ctx = null;
  let layer = null;              // #field-layer
  let fxEl = null;               // #fx-layer 内の暗転/フラッシュ用
  let curtainEl = null;          // #field-layer 内の暗幕（会話ウィンドウより下）
  let nameEl = null;             // マップ名プレート
  let titleEl = null;
  let nameTimer = 0;

  let shown = false;
  let raf = 0;
  let started = false;           // タイトル画面を抜けたか
  let busy = 0;                  // 会話・ワープ・バトルなどの進行中フロー数
  let loopError = false;

  let mapId = null;
  let map = null;
  let rows = [];
  let mw = 0;
  let mh = 0;
  let staticCv = null;
  let dynTiles = [];             // アニメ/画像タイル [{ x, y, ch }]
  let player = null;
  let npcs = [];
  let pickups = [];
  let rustles = [];              // 草むらの揺れ [{ x, y, t0 }]
  let pendingDir = null;
  let pendingAt = 0;
  let lastBumpSfx = 0;
  let needSightCheck = false;

  // ------------------------------------------------------------------ 小物
  const cfg = () => (window.GameData && GameData.config) || {};
  const now = () => performance.now();
  const U = () => App.util;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function sfx(name) { try { if (App.audio && App.audio.play) App.audio.play(name); } catch (e) { /* 無視 */ } }
  function bgm(name) { try { if (name && App.audio && App.audio.playBgm) App.audio.playBgm(name); } catch (e) { /* 無視 */ } }
  function fmt(n) { return U() && U().formatNumber ? U().formatNumber(n) : String(n); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function say(lines, opts) {
    if (!App.dialog || !App.dialog.say) return Promise.resolve();
    return App.dialog.say(lines, Object.assign({ style: 'field' }, opts || {}));
  }
  function ask(text, choices) {
    if (!App.dialog || !App.dialog.ask) return Promise.resolve(1);
    return App.dialog.ask(text, choices || ['はい', 'いいえ'], { style: 'field' });
  }
  function battleReady() {
    return !!(App.battle && typeof App.battle.startWild === 'function' && typeof App.battle.startTrainer === 'function');
  }
  function battleActive() { return !!(App.battle && App.battle.isActive && App.battle.isActive()); }
  function dialogOpen() { return !!(App.dialog && App.dialog.isOpen && App.dialog.isOpen()); }

  function tileDef(ch) {
    const d = App.data && App.data.tile ? App.data.tile(ch) : (GameData.tiles || {})[ch];
    return d || { walk: false, draw: 'void' };
  }
  function borderCh() { return map && map.border != null && String(map.border) ? String(map.border).charAt(0) : 'V'; }
  function inMap(x, y) { return x >= 0 && y >= 0 && x < mw && y < mh; }
  function tileAt(x, y) { return inMap(x, y) ? rows[y].charAt(x) : borderCh(); }
  function walkable(x, y) { return inMap(x, y) && !!tileDef(tileAt(x, y)).walk; }
  function isDynamic(ch) {
    const d = tileDef(ch);
    if (d && typeof d.image === 'string' && d.image.trim()) return true;
    try { return !!(App.tiles && App.tiles.isAnimated && App.tiles.isAnimated(ch)); } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ キャラクター
  function mkChar(x, y, dir, look) {
    return { x, y, dir: DIRS.includes(dir) ? dir : 'down', look: look || DEFAULT_LOOK, mv: null, bump: null, parity: 0, emote: null, turnUntil: 0 };
  }
  function charPos(c, t) {
    if (!c.mv) return [c.x * TS, c.y * TS];
    const k = clamp((t - c.mv.t0) / c.mv.dur, 0, 1);
    return [(c.mv.fx + (c.mv.tx - c.mv.fx) * k) * TS, (c.mv.fy + (c.mv.ty - c.mv.fy) * k) * TS];
  }
  function charFrame(c, t) {
    const m = c.mv || c.bump;
    if (!m) return 0;
    const k = (t - m.t0) / m.dur;
    return k >= 0 && k < 0.5 ? (c.parity ? 2 : 1) : 0;
  }
  function occupies(c, x, y) { return (c.x === x && c.y === y) || !!(c.mv && c.mv.tx === x && c.mv.ty === y); }
  function npcAt(x, y, except) {
    for (const n of npcs) {
      if (n === except || n.hidden) continue;
      if (occupies(n, x, y)) return n;
    }
    return null;
  }
  function blocked(x, y, self) {
    if (player && self !== player && occupies(player, x, y)) return true;
    return !!npcAt(x, y, self);
  }
  function startMove(c, nx, ny, dur, t, extra) {
    c.mv = Object.assign({ fx: c.x, fy: c.y, tx: nx, ty: ny, t0: t, dur: Math.max(30, dur | 0) }, extra || {});
    c.bump = null;
    c.parity ^= 1;
    if (tileDef(tileAt(nx, ny)).overlay) rustles.push({ x: nx, y: ny, t0: t });
  }
  function moveAsync(c, nx, ny, dur, extra) {
    return new Promise((resolve) => startMove(c, nx, ny, dur, now(), Object.assign({ done: resolve }, extra || {})));
  }
  // 到着したら true
  function stepChar(c, t) {
    if (!c.mv || t - c.mv.t0 < c.mv.dur) return false;
    const mv = c.mv;
    c.x = mv.tx; c.y = mv.ty; c.mv = null;
    if (mv.done) mv.done();
    return mv;
  }
  function waitIdle(c) {
    return new Promise((resolve) => {
      const chk = () => { if (!c.mv) resolve(); else setTimeout(chk, 16); };
      chk();
    });
  }
  function walkMs() { return Number(cfg().walkMs) || 220; }
  function runMs() { return Number(cfg().runMs) || 120; }

  // ------------------------------------------------------------------ マップ
  function trainerLook(id) {
    const t = App.data.trainer ? App.data.trainer(id) : null;
    return (t && t.look) || DEFAULT_LOOK;
  }
  function badgeCount() { return App.state.badgeCount ? App.state.badgeCount() : 0; }
  function npcHidden(d) {
    if (d.requireBadges > 0 && badgeCount() >= d.requireBadges) return true;
    return !!(d.hideAfter && App.state.isTrainerDefeated && App.state.isTrainerDefeated(d.hideAfter));
  }
  function buildNpcs() {
    const t = now();
    npcs = (Array.isArray(map.npcs) ? map.npcs : []).filter((d) => d && Number.isInteger(d.x) && Number.isInteger(d.y)).map((d) => {
      const n = mkChar(d.x, d.y, d.dir, d.trainer ? trainerLook(d.trainer) : (d.look || DEFAULT_LOOK));
      n.d = d;
      n.id = d.id;
      n.homeX = d.x; n.homeY = d.y;
      n.move = d.move || 'still';
      n.trainerId = d.trainer || null;
      n.sight = d.sight == null ? 3 : Math.max(0, d.sight | 0);
      n.hidden = npcHidden(d);
      n.nextAct = t + U().randInt(800, 3000);
      n.snoozed = false;
      return n;
    });
  }
  function refreshHidden() { npcs.forEach((n) => { n.hidden = npcHidden(n.d); }); }

  function buildStatic() {
    const W = (mw + PAD * 2) * TS;
    const H = (mh + PAD * 2) * TS;
    if (!staticCv) staticCv = document.createElement('canvas');
    staticCv.width = W; staticCv.height = H;
    const g = staticCv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    dynTiles = [];
    const dynCache = {};
    for (let y = -PAD; y < mh + PAD; y++) {
      for (let x = -PAD; x < mw + PAD; x++) {
        const ch = tileAt(x, y);
        const dyn = dynCache[ch] !== undefined ? dynCache[ch] : (dynCache[ch] = isDynamic(ch));
        if (dyn) { dynTiles.push({ x, y, ch }); continue; }
        try {
          App.tiles.draw(g, ch, (x + PAD) * TS, (y + PAD) * TS, 0, (dx, dy) => tileAt(x + dx, y + dy));
        } catch (e) {
          console.error('[field] タイル描画に失敗', ch, e);
          return;
        }
      }
    }
  }

  function warpAt(x, y) { return (map.warps || []).find((w) => w && w.x === x && w.y === y) || null; }
  function signAt(x, y) { return (map.signs || []).find((s) => s && s.x === x && s.y === y) || null; }
  function pickupAt(x, y) { return pickups.find((p) => p.x === x && p.y === y) || null; }

  function validSpot(id, x, y) {
    const m = App.data.map(id);
    if (!m || !Array.isArray(m.tiles) || !m.tiles.length) return false;
    const r = m.tiles[y];
    if (!Number.isInteger(x) || !Number.isInteger(y) || r == null || x < 0 || x >= String(r).length) return false;
    return !!tileDef(String(r).charAt(x)).walk;
  }

  // マップを読み込み、主人公を (x,y) に置く（演出なし）
  function loadMap(id, x, y, dir, opts) {
    opts = opts || {};
    const m = App.data.map(id);
    if (!m) { console.warn('[field] 未知のマップ', id); return false; }
    const prev = map;
    mapId = id;
    map = m;
    rows = (Array.isArray(m.tiles) ? m.tiles : []).map(String);
    mh = rows.length;
    mw = mh ? rows[0].length : 0;
    buildStatic();
    const look = (cfg().player && cfg().player.look) || DEFAULT_LOOK;
    player = mkChar(x | 0, y | 0, dir || (player && player.dir) || 'down', look);
    buildNpcs();
    pickups = (Array.isArray(m.pickups) ? m.pickups : []).filter((p) => p && p.id && !App.state.isPickupTaken(p.id));
    rustles = [];
    pendingDir = null;
    App.state.setPlayerPos(id, player.x, player.y, player.dir);
    if (!opts.noBgm) bgm(m.bgm);
    if (!opts.noName && !m.indoor && (!prev || (!prev.indoor && prev.name !== m.name) || opts.forceName)) showMapName(m.name);
    else if (m.indoor) hideMapName();
    return true;
  }

  function loadFromState(opts) {
    const p = (App.state.data && App.state.data.player) || {};
    const ws = GameData.worldStart || {};
    if (validSpot(p.map, p.x, p.y)) return loadMap(p.map, p.x, p.y, p.dir, opts);
    if (validSpot(ws.map, ws.x, ws.y)) return loadMap(ws.map, ws.x, ws.y, ws.dir, opts);
    const first = Object.keys(GameData.maps || {})[0];
    if (!first) return false;
    const fm = App.data.map(first);
    for (let yy = 0; yy < fm.tiles.length; yy++) {
      for (let xx = 0; xx < String(fm.tiles[yy]).length; xx++) if (validSpot(first, xx, yy)) return loadMap(first, xx, yy, 'down', opts);
    }
    return false;
  }

  // ------------------------------------------------------------------ 演出（DOM）
  function showMapName(name) {
    if (!nameEl || !name) return;
    clearTimeout(nameTimer);
    nameEl.textContent = name;
    nameEl.classList.remove('is-show');
    void nameEl.offsetWidth;
    nameEl.classList.add('is-show');
    nameTimer = setTimeout(() => nameEl.classList.remove('is-show'), 2600);
  }
  function hideMapName() {
    if (!nameEl) return;
    clearTimeout(nameTimer);
    nameEl.classList.remove('is-show');
  }

  function animate(elm, frames, dur) {
    return new Promise((resolve) => {
      let doneFlag = false;
      const done = () => { if (!doneFlag) { doneFlag = true; resolve(); } };
      try {
        const a = elm.animate(frames, { duration: dur, fill: 'forwards', easing: 'linear' });
        a.finished.then(done, done);
        setTimeout(done, dur + 150);
        a.finished.then(() => { try { elm.style.opacity = String(frames[frames.length - 1].opacity); a.cancel(); } catch (e) { /* 無視 */ } }, () => {});
      } catch (e) {
        elm.style.opacity = String(frames[frames.length - 1].opacity);
        done();
      }
    });
  }
  function fxFade(to, dur, color) {
    if (!fxEl) return Promise.resolve();
    if (color) fxEl.style.background = color;
    const from = Number(getComputedStyle(fxEl).opacity) || 0;
    return animate(fxEl, [{ opacity: from }, { opacity: to }], dur);
  }
  async function flashFx() {
    for (let i = 0; i < 3; i++) {
      await fxFade(0.9, 70, '#ffffff');
      await fxFade(0, 90, '#ffffff');
    }
    await fxFade(1, 260, '#000000');
  }
  function curtain(to, dur) {
    if (!curtainEl) return Promise.resolve();
    if (!dur) { curtainEl.style.opacity = String(to); return Promise.resolve(); }
    const from = Number(getComputedStyle(curtainEl).opacity) || 0;
    return animate(curtainEl, [{ opacity: from }, { opacity: to }], dur);
  }

  // ------------------------------------------------------------------ タイトル画面
  function buildTitle() {
    const el = U().el;
    const c = cfg();
    let mons = [];
    try {
      mons = U().shuffle(App.data.monsters().filter((m) => m && !(typeof m.image === 'string' && m.image.trim()))).slice(0, 3);
    } catch (e) { mons = []; }
    const monEls = mons.map((m, i) => {
      let src = '';
      let flip = false;
      try { const s = App.sprites.monsterSprite(m.id, 'front'); src = s.src; flip = !!s.flip; } catch (e) { src = ''; }
      const img = el('img', { class: 'fd-title-mon fd-title-mon-' + i, src, alt: '', draggable: 'false' });
      if (flip !== (i === 2)) img.style.transform = 'scaleX(-1)';
      return img;
    });
    titleEl = el('div', { class: 'fd-title', role: 'button', 'aria-label': 'スタート' },
      el('div', { class: 'fd-title-stars' }),
      el('div', { class: 'fd-title-hill' }),
      el('div', { class: 'fd-title-logo' },
        el('span', { class: 'fd-title-main', text: c.title || 'ガチャモン' }),
        el('span', { class: 'fd-title-sub', text: c.subtitle || 'GACHA MONSTERS' })),
      el('div', { class: 'fd-title-mons' }, monEls),
      el('div', { class: 'fd-title-press', text: 'Aボタン / Zキーで スタート' }),
      el('div', { class: 'fd-title-ver', text: 'ver ' + (c.version || '1.0.0') }));
    titleEl.addEventListener('click', (e) => { e.preventDefault(); startGame(); });
    layer.appendChild(titleEl);
  }
  function startGame() {
    if (started) return;
    started = true;
    try { if (App.audio && App.audio.unlock) App.audio.unlock(); } catch (e) { /* 無視 */ }
    sfx('confirm');
    if (titleEl) {
      const t = titleEl;
      titleEl = null;
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), 420);
    }
    if (map) {
      bgm(map.bgm);
      if (!map.indoor) showMapName(map.name);
    }
    needSightCheck = true;
  }

  // ------------------------------------------------------------------ 入力
  const inputHandler = {
    onPress(action, info) {
      if (!shown) return;
      const rep = !!(info && info.repeat);
      if (!started) {
        if ((action === 'a' || action === 'start') && !rep) startGame();
        return;
      }
      if (isBusy()) return;
      if (DIRS.includes(action)) {
        if (!rep) { pendingDir = action; pendingAt = now(); }
        return;
      }
      if (action === 'a' && !rep && player && !player.mv) interact();
    },
  };

  // ------------------------------------------------------------------ フロー
  function flow(fn) {
    busy++;
    return Promise.resolve()
      .then(fn)
      .catch((e) => { console.error('[field] 処理中に例外', e); })
      .finally(() => { busy = Math.max(0, busy - 1); needSightCheck = true; pendingDir = null; });
  }

  function isBusy() {
    return !started || busy > 0 || dialogOpen() || battleActive();
  }

  // ------------------------------------------------------------------ 更新
  function update(t) {
    for (const n of npcs) {
      const arrived = stepChar(n, t);
      if (arrived && n.trainerId) needSightCheck = true;
      if (n.bump && t - n.bump.t0 >= n.bump.dur) n.bump = null;
      if (n.emote && n.emote.until && t >= n.emote.until) n.emote = null;
      if (!n.mv && !n.hidden && !n.talking && t >= n.nextAct && !isBusy()) npcAct(n, t);
    }
    rustles = rustles.filter((r) => t - r.t0 < 360);

    if (!player) return;
    const arrived = stepChar(player, t);
    if (player.bump && t - player.bump.t0 >= player.bump.dur) player.bump = null;
    if (arrived && !arrived.silent) {
      if (onArrive()) return;
    }
    if (player.mv || player.bump || isBusy()) return;
    if (needSightCheck) {
      needSightCheck = false;
      if (checkTrainers()) return;
    }
    let dir = App.input && App.input.heldDir ? App.input.heldDir() : null;
    if (!dir && pendingDir && t - pendingAt <= PENDING_MS) dir = pendingDir;
    pendingDir = null;
    if (!dir) return;
    if (dir !== player.dir) {
      player.dir = dir;
      if (arrived) tryStep(dir, t);
      else {
        player.turnUntil = t + TURN_MS;
        App.state.setPlayerPos(mapId, player.x, player.y, dir);
      }
    } else if (t >= player.turnUntil) {
      tryStep(dir, t);
    }
  }

  function tryStep(dir, t) {
    const [dx, dy] = DV[dir];
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!walkable(nx, ny) || blocked(nx, ny, player)) {
      player.bump = { t0: t, dur: Math.round(walkMs() * 1.15) };
      player.parity ^= 1;
      if (t - lastBumpSfx > BUMP_SFX_GAP) { sfx('bump'); lastBumpSfx = t; }
      return;
    }
    const run = !!(App.input && App.input.isDown && App.input.isDown('b'));
    startMove(player, nx, ny, run ? runMs() : walkMs(), t);
  }

  // 1マス進み終わったとき。何かが始まったら true
  function onArrive() {
    App.state.setPlayerPos(mapId, player.x, player.y, player.dir);
    App.state.incStat('steps');
    const w = warpAt(player.x, player.y);
    if (w) { flow(() => warpStep(w)); return true; }
    const pk = pickupAt(player.x, player.y);
    if (pk) { flow(() => takePickup(pk)); return true; }
    if (checkTrainers()) return true;
    if (checkWild()) return true;
    return false;
  }

  function npcAct(n, t) {
    n.nextAct = t + U().randInt(1400, 3600);
    if (n.move === 'turn' || (n.move === 'wander' && U().chance(0.35))) {
      const opts = DIRS.filter((d) => d !== n.dir);
      n.dir = U().pick(opts);
      if (n.trainerId) needSightCheck = true;
      return;
    }
    if (n.move !== 'wander') return;
    const dir = U().pick(DIRS);
    const [dx, dy] = DV[dir];
    const nx = n.x + dx;
    const ny = n.y + dy;
    n.dir = dir;
    if (Math.abs(nx - n.homeX) > WANDER_R || Math.abs(ny - n.homeY) > WANDER_R) return;
    if (!walkable(nx, ny) || blocked(nx, ny, n) || warpAt(nx, ny) || pickupAt(nx, ny) || signAt(nx, ny)) return;
    const d = tileDef(tileAt(nx, ny));
    if (d.draw === 'door' || d.draw === 'mat') return;
    startMove(n, nx, ny, Math.round(walkMs() * 1.3), t);
  }

  // ------------------------------------------------------------------ ワープ
  // 通れないワープの上から1歩戻す
  async function stepBack() {
    const back = OPP[player.dir];
    const [dx, dy] = DV[back];
    const bx = player.x + dx;
    const by = player.y + dy;
    if (walkable(bx, by) && !blocked(bx, by, player)) {
      player.dir = back;
      await moveAsync(player, bx, by, walkMs(), { silent: true });
      App.state.setPlayerPos(mapId, player.x, player.y, player.dir);
    }
  }
  // 通れない理由（通れるなら null）
  function warpBlockReason(w) {
    if (w.requireParty && App.state.ownedCount() === 0) return 'モンスターを もっていないと あぶないよ！';
    if (w.requireBadges > 0 && badgeCount() < w.requireBadges) {
      return 'ジムバッジが ' + w.requireBadges + 'こ ないと とおれない！（いま ' + badgeCount() + 'こ）';
    }
    if (w.requireTrainer && !(App.state.isTrainerDefeated && App.state.isTrainerDefeated(w.requireTrainer))) {
      const t = App.data.trainer ? App.data.trainer(w.requireTrainer) : null;
      return (t && t.name ? t.name + 'に かたないと' : 'まだ') + ' さきへは すすめない！';
    }
    return null;
  }

  async function warpStep(w) {
    const reason = warpBlockReason(w);
    if (reason) {
      sfx('bump');
      await say(reason);
      await stepBack();
      return;
    }
    const d = tileDef(tileAt(player.x, player.y));
    if (d.draw === 'door' || d.draw === 'mat' || tileAt(player.x, player.y) === 'D' || tileAt(player.x, player.y) === 'm') sfx('door');
    await warpTo(w.to, w.tx, w.ty, w.dir || player.dir);
  }

  async function warpTo(id, x, y, dir) {
    if (!App.data.map(id)) { console.warn('[field] warpTo: 未知のマップ', id); return false; }
    busy++;
    try {
      await fxFade(1, 200, '#000000');
      loadMap(id, x, y, dir);
      render(now());
      await sleep(80);
      await fxFade(0, 220, '#000000');
    } finally {
      busy = Math.max(0, busy - 1);
      needSightCheck = true;
    }
    return true;
  }

  // ------------------------------------------------------------------ ポイント拾い
  async function takePickup(pk) {
    pickups = pickups.filter((p) => p !== pk);
    if (App.state.isPickupTaken(pk.id)) return;
    App.state.takePickup(pk.id);
    const pts = Math.max(0, Number(pk.points) || 0);
    if (pts) App.state.addPoints(pts, 'pickup');
    sfx('coin');
    await say(fmt(pts) + 'ポイント ひろった！');
  }

  // ------------------------------------------------------------------ 調べる・話す
  function interact() {
    const [dx, dy] = DV[player.dir];
    const x = player.x + dx;
    const y = player.y + dy;
    let n = npcAt(x, y);
    if (!n && inMap(x, y) && tileDef(tileAt(x, y)).counter) n = npcAt(x + dx, y + dy);
    if (n) { flow(() => talkTo(n)); return; }
    const sign = signAt(x, y);
    if (sign) { flow(() => say(Array.isArray(sign.text) ? sign.text : [String(sign.text || '')])); return; }
    const pk = pickupAt(x, y);
    if (pk) { flow(() => takePickup(pk)); return; }
    if (!inMap(x, y)) return;
    const ch = tileAt(x, y);
    const d = tileDef(ch);
    if (d.draw === 'gachaMachine') { flow(gachaAsk); return; }
    if (d.draw === 'bookshelf') { flow(() => say('いろいろな ほんが ぎっしり ならんでいる。')); return; }
    if (d.draw === 'healMachine') { flow(() => say('モンスターを かいふくする マシンだ。')); return; }
  }

  async function talkTo(n) {
    await waitIdle(n);
    n.talking = true;
    try {
      n.dir = OPP[player.dir];
      const d = n.d;
      if (n.trainerId) await trainerTalk(n);
      else if (d.heal) await healTalk(n);
      else if (d.action === 'gacha') {
        if (Array.isArray(d.dialog) && d.dialog.length) await say(d.dialog);
        await gachaAsk();
      } else {
        await say(Array.isArray(d.dialog) && d.dialog.length ? d.dialog : (d.dialog ? [String(d.dialog)] : ['……']));
      }
    } finally {
      n.talking = false;
      n.nextAct = now() + 2200;
    }
  }

  async function gachaAsk() {
    const i = await ask('ガチャを まわしに いきますか？');
    if (i === 0 && App.main && App.main.switchTab) App.main.switchTab('gacha');
  }

  async function healTalk(n) {
    const d = n.d;
    if (Array.isArray(d.dialog) && d.dialog.length) await say(d.dialog);
    const i = await ask('モンスターを かいふく しますか？');
    if (i === 0) {
      if (App.state.ownedCount() === 0) {
        await say(['あら？ モンスターを もっていない みたいですね。', 'なかまに なったら つれてきてくださいね！']);
      } else {
        await say('それでは おあずかり します！', { auto: 700 });
        const face = n.dir;
        const hdir = DIRS.find((dd) => { const [ax, ay] = DV[dd]; return tileDef(tileAt(n.x + ax, n.y + ay)).draw === 'healMachine'; });
        if (hdir) n.dir = hdir;
        App.state.healAll();
        sfx('heal');
        await sleep(1300);
        n.dir = face;
        App.state.setRespawn(mapId, player.x, player.y, player.dir);
        await say(['おまちどうさま！', 'おあずかりした モンスターは みんな げんきに なりました！']);
      }
    }
    await say('またの ごりようを おまちしています！');
  }

  async function trainerTalk(n) {
    const t = App.data.trainer(n.trainerId);
    if (!t) { await say('……'); return; }
    if (App.state.isTrainerDefeated(n.trainerId)) {
      await say(Array.isArray(t.after) && t.after.length ? t.after : ['……']);
      return;
    }
    if (!App.state.hasHealthy()) {
      await say(['たたかえる モンスターが いないみたいだね。', 'また こんど しょうぶ しよう！']);
      return;
    }
    await trainerBattle(n);
  }

  async function trainerBattle(n) {
    const t = App.data.trainer(n.trainerId) || {};
    if (Array.isArray(t.intro) && t.intro.length) await say(t.intro);
    if (!battleReady()) {
      n.snoozed = true;
      await say('（バトルは じゅんびちゅう）');
      return 'none';
    }
    return runBattle(() => App.battle.startTrainer(n.trainerId));
  }

  // ------------------------------------------------------------------ トレーナーの視線
  function checkTrainers() {
    if (!player || !App.state.hasHealthy()) return false;
    for (const n of npcs) {
      if (!n.trainerId || n.hidden || n.mv || n.talking || n.snoozed || !n.sight) continue;
      if (App.state.isTrainerDefeated(n.trainerId)) continue;
      const [dx, dy] = DV[n.dir];
      for (let k = 1; k <= n.sight; k++) {
        const x = n.x + dx * k;
        const y = n.y + dy * k;
        if (occupies(player, x, y) && !player.mv) {
          flow(() => trainerSpotted(n));
          return true;
        }
        if (!walkable(x, y) || npcAt(x, y, n)) break;
      }
    }
    return false;
  }

  async function trainerSpotted(n) {
    pendingDir = null;
    n.emote = { type: '!', until: 0 };
    sfx('trainerSpot');
    await sleep(900);
    n.emote = null;
    let guard = 20;
    while (Math.abs(n.x - player.x) + Math.abs(n.y - player.y) > 1 && guard-- > 0) {
      const [dx, dy] = DV[n.dir];
      const nx = n.x + dx;
      const ny = n.y + dy;
      if (!walkable(nx, ny) || blocked(nx, ny, n)) break;
      await moveAsync(n, nx, ny, walkMs());
    }
    player.dir = OPP[n.dir];
    await sleep(120);
    await trainerBattle(n);
  }

  // ------------------------------------------------------------------ 野生
  function checkWild() {
    const d = tileDef(tileAt(player.x, player.y));
    const enc = map && map.encounters;
    if (!d.encounter || !enc || !Array.isArray(enc.table) || !enc.table.length) return false;
    if (!App.state.hasHealthy()) return false;
    const rate = enc.rate != null ? Number(enc.rate) : Number(cfg().encounterRate != null ? cfg().encounterRate : 0.1);
    if (!(Math.random() < rate)) return false;
    const e = U().weightedPick(enc.table.filter((x) => x && App.data.monster(x.species)), (x) => x.weight);
    if (!e) return false;
    const min = Math.max(1, e.min | 0 || 1);
    const max = Math.max(min, e.max | 0 || min);
    const lv = U().randInt(min, max);
    flow(() => wildBattle(e.species, lv));
    return true;
  }

  async function wildBattle(speciesId, level) {
    pendingDir = null;
    if (!battleReady()) {
      sfx('encounter');
      await say('（バトルは じゅんびちゅう）');
      return 'none';
    }
    if (!App.state.hasHealthy()) {
      await say('たたかえる モンスターが いない！');
      return 'none';
    }
    sfx('encounter');
    return runBattle(() => App.battle.startWild(speciesId, level));
  }

  async function runBattle(startFn) {
    await flashFx();
    let p;
    try {
      p = Promise.resolve(startFn());
    } catch (e) {
      await fxFade(0, 120);
      throw e;
    }
    fxFade(0, 240);
    let res = 'run';
    try { res = await p; } finally { await sleep(20); }
    refreshHidden();
    if (res === 'lose') await blackout();
    return res;
  }

  // ------------------------------------------------------------------ 全滅
  async function blackout() {
    await curtain(1, 160);
    hideMapName();
    await say('めのまえが まっくらに なった！');
    const ratio = clamp(Number(cfg().blackoutPointLoss) || 0, 0, 1);
    const loss = Math.floor(App.state.points() * ratio);
    if (loss > 0) {
      App.state.addPoints(-loss, 'blackout');
      await say('あわてて ' + fmt(loss) + 'ポイントを おとして しまった…');
    }
    // マップに respawn があればそこへ（リーグの部屋 → リーグ入口のセンター）。なければ最後に回復した場所
    const mr = map && map.respawn;
    const r = (mr && validSpot(mr.map, mr.x, mr.y)) ? mr : ((App.state.data && App.state.data.respawn) || {});
    const ws = GameData.worldStart || {};
    const dest = validSpot(r.map, r.x, r.y) ? r : ws;
    loadMap(dest.map, dest.x, dest.y, dest.dir || 'down', { noName: true });
    App.state.healAll();
    render(now());
    await sleep(350);
    await curtain(0, 420);
    await say('モンスターたちは げんきを とりもどした！');
  }

  // ------------------------------------------------------------------ 描画
  function camera(t) {
    const [px, py] = charPos(player, t);
    const cx = mw * TS <= VW ? (mw * TS - VW) / 2 : px + TS / 2 - VW / 2;
    const cy = mh * TS <= VH ? (mh * TS - VH) / 2 : py + TS / 2 - VH / 2;
    return [Math.round(cx), Math.round(cy)];
  }

  function drawSparkle(g, x, y, t, seed) {
    const ph = Math.floor((t + seed * 173) / 120) % 10;
    const cx = x + 8;
    const cy = y + 8;
    const size = [2, 3, 5, 6, 5, 3, 2, 1, 1, 1][ph];
    g.fillStyle = 'rgba(60,50,10,0.25)';
    g.fillRect(cx - 3, cy + 5, 6, 1);
    // 腕（淡い金）→ 先端（金）→ 中心（白）
    g.fillStyle = '#fff4b0';
    g.fillRect(cx - 1, cy - size, 2, size * 2);
    g.fillRect(cx - size, cy - 1, size * 2, 2);
    if (size >= 5) {
      g.fillStyle = '#ffc830';
      g.fillRect(cx - 1, cy - size - 1, 2, 1);
      g.fillRect(cx - 1, cy + size, 2, 1);
      g.fillRect(cx - size - 1, cy - 1, 1, 2);
      g.fillRect(cx + size, cy - 1, 1, 2);
      g.fillStyle = '#fffbe0';
      g.fillRect(cx - 3, cy - 3, 1, 1); g.fillRect(cx + 2, cy - 3, 1, 1);
      g.fillRect(cx - 3, cy + 2, 1, 1); g.fillRect(cx + 2, cy + 2, 1, 1);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 1, cy - 1, 2, 2);
    if (ph === 7 || ph === 9) {
      g.fillStyle = '#ffffff';
      g.fillRect(cx + (ph === 7 ? 4 : -5), cy - 4, 1, 1);
    }
  }

  function drawRustle(g, r, sx, sy, t) {
    const k = clamp((t - r.t0) / 360, 0, 1);
    const up = Math.round(Math.sin(k * Math.PI) * 5);
    const spread = Math.round(k * 5);
    g.fillStyle = '#58b040';
    g.fillRect(sx + 3 - spread, sy + 10 - up, 2, 2);
    g.fillRect(sx + 11 + spread, sy + 10 - up, 2, 2);
    g.fillStyle = '#306828';
    g.fillRect(sx + 4 - spread, sy + 12 - up, 1, 1);
    g.fillRect(sx + 11 + spread, sy + 12 - up, 1, 1);
  }

  function render(t) {
    if (!ctx || !map || !player) return;
    const [camX, camY] = camera(t);
    const g = ctx;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, VW, VH);
    if (staticCv) g.drawImage(staticCv, camX + PAD * TS, camY + PAD * TS, VW, VH, 0, 0, VW, VH);
    // アニメ/画像タイル
    const tx0 = Math.floor(camX / TS) - 1;
    const ty0 = Math.floor(camY / TS) - 1;
    const tx1 = tx0 + VW / TS + 2;
    const ty1 = ty0 + VH / TS + 2;
    for (const d of dynTiles) {
      if (d.x < tx0 || d.x > tx1 || d.y < ty0 || d.y > ty1) continue;
      App.tiles.draw(g, d.ch, d.x * TS - camX, d.y * TS - camY, t, (dx, dy) => tileAt(d.x + dx, d.y + dy));
    }
    // ポイントのキラキラ
    pickups.forEach((p, i) => {
      if (p.x < tx0 || p.x > tx1 || p.y < ty0 || p.y > ty1) return;
      drawSparkle(g, p.x * TS - camX, p.y * TS - camY, t, i + p.x * 3 + p.y * 7);
    });
    // キャラクター（y順）
    const list = npcs.filter((n) => !n.hidden).map((n) => ({ c: n, pos: charPos(n, t), pl: 0 }));
    list.push({ c: player, pos: charPos(player, t), pl: 1 });
    list.sort((a, b) => (a.pos[1] - b.pos[1]) || (a.pl - b.pl));
    for (const it of list) {
      const c = it.c;
      const sx = Math.round(it.pos[0] - camX);
      const sy = Math.round(it.pos[1] - camY);
      if (sx < -TS || sx > VW + TS || sy < -TS * 2 || sy > VH + TS) continue;
      App.sprites.drawCharacter(g, sx, sy, c.dir, charFrame(c, t), c.look);
      const ox = c.mv ? c.mv.tx : c.x;
      const oy = c.mv ? c.mv.ty : c.y;
      const och = tileAt(ox, oy);
      if (tileDef(och).overlay) App.tiles.drawOverlay(g, och, ox * TS - camX, oy * TS - camY, t);
    }
    for (const r of rustles) drawRustle(g, r, r.x * TS - camX, r.y * TS - camY, t);
    // 吹き出し
    for (const it of list) {
      if (!it.c.emote) continue;
      App.sprites.drawEmote(g, Math.round(it.pos[0] - camX), Math.round(it.pos[1] - camY) - 24, it.c.emote.type || '!');
    }
  }

  function frame() {
    raf = 0;
    if (!shown) return;
    raf = requestAnimationFrame(frame);
    const t = now();
    try {
      if (started) update(t);
      if (!battleActive()) render(t);
    } catch (e) {
      if (!loopError) { loopError = true; console.error('[field] フレーム処理で例外', e); }
    }
  }

  // ------------------------------------------------------------------ 公開 API
  function init(panelEl) {
    if (inited) return;
    inited = true;
    const root = panelEl || document.getElementById('tab-adventure') || document;
    canvas = root.querySelector ? root.querySelector('#field-canvas') : null;
    if (!canvas) canvas = document.getElementById('field-canvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    layer = document.getElementById('field-layer');
    const fxLayer = document.getElementById('fx-layer');
    const el = U().el;
    nameEl = el('div', { class: 'fd-mapname', 'aria-live': 'polite' });
    curtainEl = el('div', { class: 'fd-curtain' });
    layer.appendChild(curtainEl);
    layer.appendChild(nameEl);
    fxEl = el('div', { class: 'fd-fx' });
    fxLayer.appendChild(fxEl);
    loadFromState({ noBgm: true, noName: true });
    buildTitle();
    if (App.input && App.input.push) App.input.push(inputHandler);
    if (App.events && App.events.on) {
      ['state:loaded', 'state:reset'].forEach((ev) => App.events.on(ev, () => {
        if (busy > 0) return;
        loadFromState({ noBgm: !started || !shown, noName: true });
      }));
      // バッジの増減・リーグのリセットで 通せんぼNPC / hideAfter の表示を更新
      ['badges:changed', 'league:reset'].forEach((ev) => App.events.on(ev, () => { if (map) refreshHidden(); }));
    }
  }

  function onShow() {
    if (!inited) return;
    shown = true;
    if (!started) bgm('title');
    else if (map) bgm(map.bgm);
    if (!raf) raf = requestAnimationFrame(frame);
    render(now());
  }

  function onHide() {
    shown = false;
    pendingDir = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function teleport(id, x, y, dir) {
    if (!App.data.map(id)) return false;
    if (!validSpot(id, x, y)) console.warn('[field] teleport: 歩けないマスです', id, x, y);
    if (!started) startGame();
    const ok = loadMap(id, x, y, dir || 'down', { forceName: true });
    needSightCheck = false;
    render(now());
    return ok;
  }

  App.field = {
    init, onShow, onHide, warpTo, isBusy,
    debug: {
      teleport,
      encounter(speciesId, level) {
        if (!started) startGame();
        return flow(() => wildBattle(speciesId, level || 5));
      },
      trainer(trainerId) {
        if (!started) startGame();
        if (!App.data.trainer(trainerId)) return Promise.reject(new Error('未知のトレーナー ' + trainerId));
        return flow(async () => {
          if (!battleReady()) { await say('（バトルは じゅんびちゅう）'); return 'none'; }
          return runBattle(() => App.battle.startTrainer(trainerId));
        });
      },
      start: startGame,
      state() {
        return {
          map: mapId, x: player && player.x, y: player && player.y, dir: player && player.dir,
          moving: !!(player && player.mv), busy: isBusy(), busyCount: busy, started, shown, title: !!titleEl,
          npcs: npcs.map((n) => ({ id: n.id, x: n.x, y: n.y, dir: n.dir, hidden: n.hidden })),
          pickups: pickups.map((p) => p.id),
        };
      },
      npc(id) { return npcs.find((n) => n.id === id) || null; },
      render() { render(now()); },
    },
  };
})();
