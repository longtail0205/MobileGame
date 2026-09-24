// =====================================================================
// App.battle — バトル画面（#battle-layer, 720x480 実ピクセル / GBA 1ドット=3px）
//   ロジックは App.battleEngine。ここはイベント列の演出・メニュー・報酬・セーブを担当する。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const STATUS_LABEL = { poison: 'どく', burn: 'やけど', paralyze: 'まひ', sleep: 'ねむり', freeze: 'こおり' };
  const STATUS_COLOR = { poison: '#a040c0', burn: '#f06830', paralyze: '#e8c020', sleep: '#8890a0', freeze: '#58c8f0' };
  const STAT_ROWS = [['さいだいHP', 'hp'], ['こうげき', 'atk'], ['ぼうぎょ', 'def'], ['とくこう', 'spa'], ['とくぼう', 'spd'], ['すばやさ', 'spe']];
  const NO_HEAD = '、。，．！？!?,.」』）)ーぁぃぅぇぉっゃゅょァィゥェォッャュョ…';
  const HP_DOTS = 48;                       // HPバーの長さ（GBAドット）
  const EXP_DOTS = 64;
  // 画面上の基準座標（720x480）
  const POS = {
    enemy: { cx: 528, cy: 118, foot: 186 },
    player: { cx: 216, cy: 250, foot: 324 },
  };

  let inited = false;
  let layer = null;
  let active = false;
  let ui = {};
  let ctx = null;                  // 進行中のバトル
  let mode = null;                 // 現在の入力受付 { onPress(action) }
  let popInput = null;
  let phase = 'idle';
  let lastText = '';
  let animScale = 1;
  let measureCtx = null;
  const cursor = { cmd: 0, move: 0, party: 0 };

  const el = (...a) => App.util.el(...a);
  const Eng = () => App.battleEngine;
  const cfg = () => (App.data && App.data.config) || {};
  const fainted = (inst) => !inst || !(inst.hp > 0);
  const other = (side) => (side === 'player' ? 'enemy' : 'player');
  const dname = (inst) => App.monster.displayName(inst);
  const playerName = () => (App.state.data && App.state.data.player && App.state.data.player.name) || (cfg().player && cfg().player.defaultName) || '';
  const fmt = (n) => (App.util.formatNumber ? App.util.formatNumber(n) : String(n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  const wait = (ms) => sleep(ms * animScale);

  function sfx(name) { try { if (App.audio && App.audio.play) App.audio.play(name); } catch (e) { /* 無視 */ } }
  function bgm(name) { try { if (App.audio && App.audio.playBgm) App.audio.playBgm(name); } catch (e) { /* 無視 */ } }
  function emit(name, payload) { try { if (App.events) App.events.emit(name, payload); } catch (e) { console.error('[battle] emit ' + name, e); } }

  function typeColor(typeId) {
    const t = typeId && App.data.type(typeId);
    return (t && t.color) || '#a8a8a8';
  }
  function typeName(typeId) {
    const t = typeId && App.data.type(typeId);
    return (t && t.name) || '？？？';
  }
  function moveName(id) {
    const m = App.data.move(id);
    return (m && m.name) || id;
  }

  // ---------------------------------------------------------------- アニメーション補助
  function anim(node, frames, opts) {
    if (!node || typeof node.animate !== 'function') return Promise.resolve();
    const o = Object.assign({ duration: 300, easing: 'linear', fill: 'none' }, opts || {});
    o.duration = Math.max(1, o.duration * animScale);
    if (o.delay) o.delay *= animScale;
    const keep = o.fill === 'forwards' || o.fill === 'both';
    let a;
    try { a = node.animate(frames, o); } catch (e) { return Promise.resolve(); }
    return a.finished.then(() => {
      if (keep) {
        try { if (node.isConnected) a.commitStyles(); } catch (e) { /* 無視 */ }
        a.cancel();
      }
    }, () => {});
  }

  function removeLater(node, ms) { setTimeout(() => { if (node && node.parentNode) node.parentNode.removeChild(node); }, ms * animScale); }

  // ---------------------------------------------------------------- 背景（240x160 ドット）
  function seeded(seed) {
    return App.util.mulberry32 ? App.util.mulberry32(seed) : Math.random;
  }

  function detectTerrain(opts) {
    if (opts && opts.terrain) return opts.terrain;
    let map = null;
    let mapId = '';
    try {
      mapId = (App.state.data && App.state.data.player && App.state.data.player.map) || '';
      map = App.data.map(mapId);
    } catch (e) { map = null; }
    if (!map) return 'grass';
    const bgmName = String(map.bgm || '');
    const label = String(map.name || '') + ' ' + mapId;
    let cave = 0;
    let total = 0;
    (Array.isArray(map.tiles) ? map.tiles : []).forEach((row) => {
      for (const ch of String(row)) { total++; if ('uqr'.includes(ch)) cave++; }
    });
    if (bgmName === 'cave' || /cave|どうくつ|洞窟/i.test(label) || (total && cave / total > 0.3)) return 'cave';
    if (map.indoor || bgmName === 'gym' || /gym|ジム/i.test(label)) return 'indoor';
    if (bgmName === 'forest' || /forest|もり|森/i.test(label)) return 'forest';
    return 'grass';
  }

  function drawBackground(cv, terrain) {
    const g = cv.getContext('2d');
    const R = seeded(terrain === 'cave' ? 77 : terrain === 'indoor' ? 55 : 33);
    const rect = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const dither = (c, x0, y0, w, h, phase) => {
      g.fillStyle = c;
      for (let y = y0; y < y0 + h; y++) for (let x = x0 + ((y + (phase || 0)) & 1); x < x0 + w; x += 2) g.fillRect(x, y, 1, 1);
    };
    if (terrain === 'cave') {
      rect('#2a2030', 0, 0, 240, 160);
      // 奥の岩壁
      rect('#3c3040', 0, 0, 240, 64);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(R() * 240), y = Math.floor(R() * 56), w = 10 + Math.floor(R() * 22), h = 6 + Math.floor(R() * 10);
        rect(i % 2 ? '#463848' : '#342838', x, y, w, h);
        rect('#54445a', x, y, w, 1);
      }
      // つらら
      for (let x = 4; x < 240; x += 14 + Math.floor(R() * 10)) {
        const len = 6 + Math.floor(R() * 14);
        for (let j = 0; j < len; j++) {
          const w = Math.max(1, Math.round((1 - j / len) * 5));
          rect(j < 2 ? '#6a5870' : '#56465c', x - (w >> 1), j, w, 1);
        }
      }
      // 床
      rect('#5c4a44', 0, 60, 240, 100);
      rect('#4a3a38', 0, 60, 240, 3);
      dither('#4a3a38', 0, 63, 240, 3);
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(R() * 240), y = 66 + Math.floor(R() * 94);
        rect(R() < 0.5 ? '#6c5850' : '#4c3c38', x, y, 2 + Math.floor(R() * 4), 1);
      }
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(R() * 230), y = 70 + Math.floor(R() * 80);
        rect('#3e302e', x, y, 7, 4); rect('#7a665c', x + 1, y, 5, 1);
      }
      // 周辺減光
      dither('rgba(0,0,0,0.55)', 0, 0, 20, 160);
      dither('rgba(0,0,0,0.55)', 220, 0, 20, 160, 1);
      return;
    }
    if (terrain === 'indoor') {
      // 壁
      rect('#d8c49c', 0, 0, 240, 58);
      rect('#8a6440', 0, 0, 240, 4);
      rect('#b89c70', 0, 4, 240, 2);
      for (let x = 0; x < 240; x += 24) { rect('#c4ac80', x, 8, 1, 44); rect('#e8d8b4', x + 1, 8, 1, 44); }
      rect('#c83c3c', 0, 30, 240, 6);
      rect('#e86060', 0, 30, 240, 1);
      rect('#f0c040', 0, 33, 240, 1);
      rect('#8a6440', 0, 52, 240, 6);
      rect('#a07850', 0, 52, 240, 1);
      // 床（タイル）
      for (let y = 58; y < 160; y += 10) {
        for (let x = 0; x < 240; x += 20) {
          const odd = ((x / 20) + ((y - 58) / 10)) & 1;
          rect(odd ? '#d8d4dc' : '#c8c4d4', x, y, 20, 10);
          rect('#eceaf0', x, y, 20, 1);
          rect('#a8a4b8', x, y + 9, 20, 1);
          rect('#b4b0c4', x + 19, y, 1, 10);
        }
      }
      return;
    }
    const forest = terrain === 'forest';
    // 空
    const sky = forest ? ['#58a8c8', '#70b8d0', '#88c8d8', '#a0d4dc'] : ['#68b8f0', '#88c8f4', '#a8d8f8', '#c8e8f8'];
    [0, 10, 20, 30].forEach((y, i) => { rect(sky[i], 0, y, 240, 10); if (i) dither(sky[i - 1], 0, y, 240, 2); });
    // 雲
    const cloud = (cx, cy, w) => {
      rect('#f8f8f8', cx, cy, w, 4); rect('#f8f8f8', cx + 3, cy - 3, w - 8, 3); rect('#f8f8f8', cx + 6, cy - 5, Math.max(4, w - 16), 2);
      rect('#d8e8f0', cx, cy + 3, w, 1);
    };
    if (!forest) { cloud(18, 12, 30); cloud(150, 8, 40); cloud(96, 22, 22); cloud(206, 20, 26); }
    // 遠くの山
    g.fillStyle = forest ? '#4c8870' : '#88b8a8';
    for (let x = 0; x < 240; x++) {
      const h = 10 + Math.round(6 * Math.sin(x / 19) + 4 * Math.sin(x / 7.3 + 1));
      g.fillRect(x, 40 - h, 1, h + 4);
    }
    // 森の帯
    const tree = forest ? ['#1e5a30', '#2c7040', '#3c8850'] : ['#347c40', '#48944c', '#68b060'];
    rect(tree[0], 0, 40, 240, 16);
    for (let x = -4; x < 244; x += 9) {
      const cy = 42 + ((x * 7) % 5);
      g.fillStyle = tree[1];
      for (let dy = -6; dy <= 6; dy++) {
        const w = Math.round(Math.sqrt(Math.max(0, 36 - dy * dy)));
        g.fillRect(x - w, cy + dy, w * 2, 1);
      }
      rect(tree[2], x - 3, cy - 4, 3, 2);
    }
    if (forest) {
      for (let x = 6; x < 240; x += 26) { rect('#4a3020', x, 50, 4, 10); rect('#6a4830', x, 50, 1, 10); }
    }
    // 草原
    const field = forest ? ['#6cb058', '#62a450', '#4c8c40'] : ['#a0d878', '#90cc68', '#70b050'];
    rect(field[0], 0, 56, 240, 104);
    let y = 58;
    let gap = 3;
    while (y < 160) {
      rect(field[1], 0, y, 240, Math.max(1, gap >> 1));
      y += gap + 2;
      gap = Math.min(12, gap + 1);
    }
    dither(field[1], 0, 56, 240, 2);
    for (let i = 0; i < 60; i++) {
      const tx = Math.floor(R() * 240), ty = 60 + Math.floor(R() * 100);
      g.fillStyle = field[2];
      g.fillRect(tx, ty, 1, 2); g.fillRect(tx + 2, ty - 1, 1, 3); g.fillRect(tx + 4, ty, 1, 2);
    }
  }

  function drawPlatform(cv, terrain) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const pal = terrain === 'cave' ? ['#3a2c2a', '#6c5a50', '#86705e', '#9a846e']
      : terrain === 'indoor' ? ['#505478', '#b8bccc', '#e4e6f0', '#f8f8fc']
        : terrain === 'forest' ? ['#3a7432', '#5a9846', '#78b458', '#90c868']
          : ['#58a040', '#7cc058', '#a0dc78', '#b8ec90'];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        let c = d > 0.8 ? pal[0] : d > 0.55 ? pal[1] : pal[2];
        if (d <= 0.55 && dy < -0.25 && d > 0.2) c = pal[3];
        if (terrain === 'indoor' && d > 0.3 && d < 0.4) c = '#e0a040';
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
    if (terrain === 'grass' || terrain === 'forest') {
      const R = seeded(w * 7 + h);
      g.fillStyle = pal[0];
      for (let i = 0; i < w / 5; i++) {
        const x = Math.floor(R() * (w - 8)) + 4;
        const yy = Math.floor(cy + ry * 0.6 * (R() * 2 - 1));
        g.fillRect(x, yy, 1, 2); g.fillRect(x + 2, yy - 1, 1, 3);
      }
    }
  }

  // ---------------------------------------------------------------- DOM 構築
  function buildHud(side) {
    const h = { side };
    const hpTrack = el('div', { class: 'bt-hp-track' }, h.fill = el('div', { class: 'bt-hp-fill' }));
    h.root = el('div', { class: 'bt-hud bt-hud-' + side },
      el('div', { class: 'bt-hud-row1' },
        h.name = el('span', { class: 'bt-hud-name' }),
        h.rar = side === 'enemy' ? el('span', { class: 'bt-rar' }) : null,
        h.lv = el('span', { class: 'bt-hud-lv' })),
      el('div', { class: 'bt-hud-row2' },
        h.status = el('span', { class: 'bt-status', hidden: true }),
        el('div', { class: 'bt-hpbar' }, el('span', { class: 'bt-hp-label', text: 'HP' }), hpTrack)),
      side === 'player' ? (h.hpText = el('div', { class: 'bt-hud-hptext' })) : null,
      side === 'player' ? el('div', { class: 'bt-expbar' }, el('span', { class: 'bt-exp-label', text: 'EXP' }),
        el('div', { class: 'bt-exp-track' }, h.exp = el('div', { class: 'bt-exp-fill' }))) : null);
    return h;
  }

  function build(c) {
    layer.innerHTML = '';
    ui = {};
    const t = c.terrain;
    ui.root = el('div', { class: 'bt-root bt-terrain-' + t });
    ui.bg = el('canvas', { class: 'bt-bg', width: 240, height: 160 });
    drawBackground(ui.bg, t);
    ui.enemyPlat = el('canvas', { class: 'bt-plat bt-plat-enemy', width: 96, height: 20 });
    ui.playerPlat = el('canvas', { class: 'bt-plat bt-plat-player', width: 128, height: 32 });
    drawPlatform(ui.enemyPlat, t);
    drawPlatform(ui.playerPlat, t);
    ui.enemyImg = el('img', { class: 'bt-sprite', alt: '', draggable: 'false' });
    ui.playerImg = el('img', { class: 'bt-sprite', alt: '', draggable: 'false' });
    ui.enemyMon = el('div', { class: 'bt-mon bt-mon-enemy' }, ui.enemyImg);
    ui.playerMon = el('div', { class: 'bt-mon bt-mon-player' }, ui.playerImg);
    ui.trainerImg = el('img', { class: 'bt-trainer', alt: '', draggable: 'false', hidden: true });
    ui.playerBack = el('img', { class: 'bt-playerback', alt: '', draggable: 'false' });
    ui.enemySide = el('div', { class: 'bt-side bt-side-enemy' }, ui.enemyPlat, ui.enemyMon, ui.trainerImg);
    ui.playerSide = el('div', { class: 'bt-side bt-side-player' }, ui.playerPlat, ui.playerMon, ui.playerBack);
    ui.fx = el('div', { class: 'bt-fx' });
    ui.enemyHud = buildHud('enemy');
    ui.playerHud = buildHud('player');
    ui.balls = el('div', { class: 'bt-balls-wrap', hidden: true });
    ui.msgText = el('div', { class: 'bt-msg-text' });
    ui.msgArrow = el('div', { class: 'bt-msg-arrow', hidden: true });
    ui.msg = el('div', { class: 'bt-msg' }, ui.msgText, ui.msgArrow);
    // 文章送り中は 画面のどこをタップしても A と同じ（メニュー類は stopPropagation 済み）
    ui.msg.addEventListener('click', (e) => { e.stopPropagation(); tapAdvance(); });
    ui.cmd = el('div', { class: 'bt-cmd', hidden: true });
    ui.moves = el('div', { class: 'bt-moves', hidden: true });
    ui.party = el('div', { class: 'bt-party', hidden: true });
    ui.lvpanel = el('div', { class: 'bt-lvpanel', hidden: true });
    ui.lvpanel.addEventListener('click', (e) => { e.stopPropagation(); tapAdvance(); });
    ui.flash = el('div', { class: 'bt-flash' });
    ui.shade = el('div', { class: 'bt-shade' });
    ui.root.append(ui.bg, ui.enemySide, ui.playerSide, ui.fx, ui.enemyHud.root, ui.playerHud.root, ui.balls,
      ui.msg, ui.cmd, ui.moves, ui.lvpanel, ui.party, ui.flash, ui.shade);
    ui.root.addEventListener('click', () => tapAdvance());
    layer.appendChild(ui.root);
    hudOut('enemy');
    hudOut('player');
  }

  // ---------------------------------------------------------------- HUD
  function hud(side) { return side === 'enemy' ? ui.enemyHud : ui.playerHud; }
  function pad3(n) { const s = String(n); return s.length >= 3 ? s : ' '.repeat(3 - s.length) + s; }

  function setHpBar(h, hp, mx) {
    const r = mx > 0 ? Math.max(0, Math.min(1, hp / mx)) : 0;
    const dots = hp > 0 ? Math.max(1, Math.round(r * HP_DOTS)) : 0;
    h.fill.style.width = (dots * 3) + 'px';
    h.fill.className = 'bt-hp-fill ' + (r > 0.5 ? 'is-green' : (r > 0.2 ? 'is-yellow' : 'is-red'));
    if (h.hpText) h.hpText.textContent = pad3(Math.max(0, Math.round(hp))) + '/' + pad3(mx);
    h.shownHp = hp;
  }
  function setExpBar(h, ratio) {
    if (!h.exp) return;
    const dots = Math.round(Math.max(0, Math.min(1, ratio)) * EXP_DOTS);
    h.exp.style.width = (dots * 3) + 'px';
  }
  function setStatusBadge(h, status) {
    if (status && STATUS_LABEL[status]) {
      h.status.hidden = false;
      h.status.textContent = STATUS_LABEL[status];
      h.status.style.setProperty('--st-color', STATUS_COLOR[status]);
    } else {
      h.status.hidden = true;
    }
  }
  function setLevel(h, level) {
    h.lv.innerHTML = '';
    h.lv.append(el('small', { text: 'Lv' }), String(level));
  }
  function setHud(side, inst) {
    const h = hud(side);
    const def = App.data.monster(inst.speciesId);
    h.inst = inst;
    h.name.textContent = dname(inst);
    if (h.rar) {
      const r = (def && def.rarity) || 'N';
      const rd = App.data.rarity(r);
      h.rar.textContent = r;
      h.rar.className = 'bt-rar' + (rd && rd.rainbow ? ' is-rainbow' : '');
      h.rar.style.setProperty('--rc', (rd && rd.color) || '#9aa3ad');
    }
    setLevel(h, inst.level);
    setStatusBadge(h, inst.status);
    setHpBar(h, inst.hp, App.monster.stats(inst).hp);
    if (h.exp) setExpBar(h, App.monster.expProgress(inst));
  }
  function hudOut(side) {
    const h = hud(side);
    h.root.style.transform = side === 'enemy' ? 'translateX(-420px)' : 'translateX(420px)';
  }
  function hudIn(side) {
    const h = hud(side);
    const from = side === 'enemy' ? 'translateX(-420px)' : 'translateX(420px)';
    return anim(h.root, [{ transform: from }, { transform: 'translateX(0px)' }], { duration: 280, easing: 'ease-out', fill: 'forwards' });
  }
  function hudSlideOut(side) {
    const h = hud(side);
    const to = side === 'enemy' ? 'translateX(-420px)' : 'translateX(420px)';
    return anim(h.root, [{ transform: 'translateX(0px)' }, { transform: to }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
  }

  function animateHp(side, to, mx) {
    const h = hud(side);
    const from = typeof h.shownHp === 'number' ? h.shownHp : to;
    if (from === to) { setHpBar(h, to, mx); return Promise.resolve(); }
    const dur = Math.max(220, Math.min(1000, Math.abs(to - from) / Math.max(1, mx) * 1300)) * animScale;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / dur);
        setHpBar(h, Math.round(from + (to - from) * t), mx);
        if (t >= 1) resolve();
        else setTimeout(step, 16);
      };
      step();
    });
  }
  function animateExpTo(h, from, to, dur) {
    const d = Math.max(1, dur * animScale);
    const start = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / d);
        setExpBar(h, from + (to - from) * t);
        if (t >= 1) resolve();
        else setTimeout(step, 16);
      };
      step();
    });
  }

  // ---------------------------------------------------------------- スプライト
  function monEl(side) { return side === 'enemy' ? ui.enemyMon : ui.playerMon; }
  function setMonSprite(side, inst) {
    const img = side === 'enemy' ? ui.enemyImg : ui.playerImg;
    const view = side === 'enemy' ? 'front' : 'back';
    const get = () => (App.sprites && App.sprites.monsterSprite ? App.sprites.monsterSprite(inst.speciesId, view) : null);
    try {
      const sp = get();
      img.onerror = () => {
        // 画像の読み込みに失敗したら 1回だけ取り直す（sprites 側で自動生成に切り替わる）
        img.onerror = null;
        setTimeout(() => {
          try {
            const sp2 = get();
            if (sp2 && sp2.src && sp2.src !== img.getAttribute('src')) { img.src = sp2.src; img.classList.toggle('is-flip', !!sp2.flip); }
          } catch (e) { /* 無視 */ }
        }, 50);
      };
      img.src = sp && sp.src ? sp.src : '';
      img.classList.toggle('is-flip', !!(sp && sp.flip));
    } catch (e) {
      console.warn('[battle] スプライト取得に失敗', e);
    }
  }
  function resetMon(side) {
    const m = monEl(side);
    m.getAnimations().forEach((a) => a.cancel());
    m.style.transform = '';
    m.style.clipPath = '';
    m.style.opacity = '';
    m.style.filter = '';
  }
  function hideMon(side) { resetMon(side); monEl(side).style.opacity = '0'; }

  // ---------------------------------------------------------------- メッセージ
  function textSpeed() {
    const table = cfg().textSpeed || { normal: 30 };
    let key = 'normal';
    try { key = App.state.setting('textSpeed') || 'normal'; } catch (e) { /* 無視 */ }
    const v = table[key];
    return typeof v === 'number' ? v : (table.normal || 30);
  }
  function autoDelay() {
    let key = 'normal';
    try { key = App.state.setting('textSpeed') || 'normal'; } catch (e) { /* 無視 */ }
    return ({ slow: 1100, normal: 760, fast: 420 }[key] || 760) * animScale;
  }

  function measurer() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(ui.msgText);
    const font = cs.font && cs.font.trim() ? cs.font : (cs.fontSize + ' ' + cs.fontFamily);
    measureCtx.font = font && font.trim() ? font : "32px 'DotGothic16', monospace";
    return (s) => measureCtx.measureText(s).width;
  }
  function wrap(text, maxW) {
    const measure = measurer();
    const out = [];
    String(text).split('\n').forEach((src) => {
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
    });
    return out;
  }

  function setMsg(text) {
    ui.msgText.textContent = text;
    ui.msgArrow.hidden = true;
    lastText = text;
  }

  function typePage(text) {
    return new Promise((resolve) => {
      const chars = Array.from(text);
      const speed = textSpeed();
      ui.msgArrow.hidden = true;
      lastText = text;
      phase = 'typing';
      let done = false;
      let tmo = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(tmo);
        ui.msgText.textContent = text;
        mode = null;
        resolve();
      };
      if (!(speed > 0) || !chars.length) { finish(); return; }
      mode = { onPress(a) { if (a === 'a' || a === 'b') finish(); } };
      const start = performance.now();
      let shown = -1;
      const step = () => {
        if (done) return;
        const n = Math.min(chars.length, Math.floor((performance.now() - start) / speed) + 1);
        if (n !== shown) { shown = n; ui.msgText.textContent = chars.slice(0, n).join(''); }
        if (n >= chars.length) finish();
        else tmo = setTimeout(step, Math.max(8, Math.min(speed, 33)));
      };
      step();
    });
  }

  function waitA() {
    return new Promise((resolve) => {
      ui.msgArrow.hidden = false;
      phase = 'wait';
      mode = {
        onPress(a) {
          if (a !== 'a' && a !== 'b') return;
          mode = null;
          ui.msgArrow.hidden = true;
          sfx('select');
          resolve();
        },
      };
    });
  }
  function autoWait(ms) {
    return new Promise((resolve) => {
      phase = 'auto';
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(t); mode = null; resolve(); };
      const t = setTimeout(finish, ms);
      mode = { onPress(a) { if (a === 'a' || a === 'b') finish(); } };
    });
  }

  // opts: { wait: A待ち, hold: 表示したまま即 resolve, delay: 自動送りまでの ms }
  async function say(text, opts) {
    opts = opts || {};
    const str = App.util.format(String(text === null || text === undefined ? '' : text));
    const maxW = Math.max(200, (ui.msgText.clientWidth || 648) - 6);
    const lines = wrap(str, maxW);
    const pages = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2).join('\n'));
    if (!pages.length) pages.push('');
    for (let i = 0; i < pages.length; i++) {
      await typePage(pages[i]);
      const last = i === pages.length - 1;
      if (!last) { await waitA(); continue; }
      if (opts.wait) await waitA();
      else if (opts.hold) { phase = 'anim'; }
      else await autoWait(opts.delay !== undefined ? opts.delay * animScale : autoDelay());
    }
    phase = 'anim';
  }

  // ---------------------------------------------------------------- 入力
  function press(action, info) {
    if (mode && typeof mode.onPress === 'function') {
      try { mode.onPress(action, info || {}); } catch (e) { console.error('[battle] 入力処理で例外', e); }
    }
  }
  function tapAdvance() {
    if (phase === 'typing' || phase === 'wait' || phase === 'auto' || phase === 'levelup') press('a');
  }
  const inputHandler = {
    onPress(action, info) {
      if ((action === 'a' || action === 'b') && info && info.repeat) return;
      press(action, info);
    },
  };

  // ---------------------------------------------------------------- エフェクト
  function fxNode(cls, x, y, style) {
    const n = el('div', { class: 'bt-p ' + cls, style: Object.assign({ left: x + 'px', top: y + 'px' }, style || {}) });
    ui.fx.appendChild(n);
    return n;
  }
  function flash(color, dur, peak) {
    ui.flash.style.background = color || '#fff';
    return anim(ui.flash, [{ opacity: peak || 0.8 }, { opacity: 0 }], { duration: dur || 160 });
  }
  function shake(power) {
    const p = power || 9;
    return anim(ui.root, [
      { transform: 'translate(0,0)' }, { transform: `translate(${-p}px,0)` }, { transform: `translate(${p}px,0)` },
      { transform: `translate(${-p * 0.66}px,0)` }, { transform: `translate(${p * 0.66}px,0)` },
      { transform: `translate(${-p * 0.33}px,0)` }, { transform: 'translate(0,0)' }], { duration: 360 });
  }
  function blink(side, times) {
    const frames = [];
    const n = times || 4;
    for (let i = 0; i < n; i++) { frames.push({ opacity: 0 }, { opacity: 1 }); }
    return anim(monEl(side), frames, { duration: n * 110, easing: 'steps(1, end)' });
  }
  function lunge(side) {
    const dx = side === 'player' ? 42 : -42;
    const dy = side === 'player' ? -15 : 15;
    return anim(monEl(side), [
      { transform: 'translate(0,0)' }, { transform: `translate(${-dx * 0.25}px,${-dy * 0.25}px)`, offset: 0.25 },
      { transform: `translate(${dx}px,${dy}px)`, offset: 0.55 }, { transform: 'translate(0,0)' }], { duration: 330, easing: 'ease-out' });
  }
  function hop(side) {
    return anim(monEl(side), [
      { transform: 'translateY(0)' }, { transform: 'translateY(-18px)', offset: 0.25 }, { transform: 'translateY(0)', offset: 0.5 },
      { transform: 'translateY(-12px)', offset: 0.75 }, { transform: 'translateY(0)' }], { duration: 360 });
  }

  // 粒子バースト。kind: 'burst'|'rise'|'fall'|'spin'|'ring'|'spark'
  function particles(side, color, kind, count) {
    const c = POS[side];
    const ps = [];
    const n = count || 10;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 60 + Math.random() * 50;
      let dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      let sx = c.cx - 6, sy = c.cy - 6;
      if (kind === 'rise') { sx += (Math.random() - 0.5) * 120; sy += 40 + Math.random() * 30; dx = (Math.random() - 0.5) * 20; dy = -90 - Math.random() * 50; }
      if (kind === 'fall') { sx += (Math.random() - 0.5) * 130; sy -= 80 + Math.random() * 20; dx = (Math.random() - 0.5) * 16; dy = 110 + Math.random() * 40; }
      const size = kind === 'spark' ? 9 : 12 + Math.floor(Math.random() * 3) * 3;
      const node = fxNode('bt-p-' + kind, sx, sy, { width: size + 'px', height: size + 'px', background: color });
      const rot = kind === 'spin' ? 360 + Math.random() * 360 : 45;
      ps.push(anim(node, [
        { transform: 'translate(0,0) rotate(0deg) scale(0.6)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px,${dy * 0.6}px) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(0.4)`, opacity: 0 }],
      { duration: 460 + Math.random() * 160, easing: 'ease-out', delay: kind === 'rise' || kind === 'fall' ? Math.random() * 180 : 0 }).then(() => node.remove()));
    }
    return Promise.all(ps);
  }
  function ring(side, color, count) {
    const c = POS[side];
    const ps = [];
    for (let i = 0; i < (count || 2); i++) {
      const node = fxNode('bt-ring', c.cx - 60, c.cy - 60, { borderColor: color });
      ps.push(anim(node, [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }],
        { duration: 420, delay: i * 140, easing: 'ease-out' }).then(() => node.remove()));
    }
    return Promise.all(ps);
  }
  function impact(side, color) {
    const c = POS[side];
    const node = fxNode('bt-impact', c.cx - 48, c.cy - 48, { '--c': color });
    return anim(node, [{ transform: 'scale(0.3) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.2) rotate(20deg)', opacity: 1, offset: 0.5 },
      { transform: 'scale(1.4) rotate(30deg)', opacity: 0 }], { duration: 300, easing: 'ease-out' }).then(() => node.remove());
  }
  function projectile(from, to, color) {
    const a = POS[from], b = POS[to];
    const node = fxNode('bt-orb', a.cx - 18, a.cy - 18, { background: color, '--c': color });
    return anim(node, [{ transform: 'translate(0,0) scale(0.5)' }, { transform: `translate(${b.cx - a.cx}px,${b.cy - a.cy}px) scale(1.2)` }],
      { duration: 300, easing: 'ease-in' }).then(() => node.remove());
  }

  function typeFx(side, typeId) {
    const color = typeColor(typeId);
    switch (typeId) {
      case 'fire': return Promise.all([particles(side, color, 'rise', 14), particles(side, '#f8d030', 'rise', 6)]);
      case 'water': return Promise.all([particles(side, color, 'burst', 12), particles(side, '#c8e8f8', 'fall', 6)]);
      case 'ice': return Promise.all([particles(side, color, 'spin', 10), flash('#c8f0ff', 200, 0.5)]);
      case 'electric': return Promise.all([flash('#f8e878', 140, 0.7), particles(side, color, 'spark', 16)]);
      case 'grass': case 'bug': return particles(side, color, 'spin', 10);
      case 'poison': return particles(side, color, 'rise', 12);
      case 'psychic': case 'ghost': case 'dark': return ring(side, color, 3);
      case 'rock': case 'ground': return Promise.all([particles(side, color, 'fall', 10), shake(4)]);
      case 'flying': case 'dragon': return Promise.all([particles(side, color, 'spin', 8), ring(side, color, 1)]);
      default: return Promise.all([impact(side, color), particles(side, color, 'burst', 8)]);
    }
  }

  function moveTargetsSelf(moveId) {
    const m = App.data.move(moveId);
    const eff = Array.isArray(m && m.effects) ? m.effects : [];
    return !!m && m.category === 'status' && eff.length > 0 && eff.every((e) => e && (e.kind === 'heal' || (e.kind === 'stat' && e.target === 'self')));
  }

  async function animMove(e) {
    const user = e.side;
    const tgt = other(user);
    const color = typeColor(e.moveType);
    if (e.category === 'status') {
      const selfT = moveTargetsSelf(e.moveId);
      await hop(user);
      await (selfT ? ring(user, color, 2) : typeFx(tgt, e.moveType));
    } else if (e.category === 'special') {
      await anim(monEl(user), [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 220 });
      await projectile(user, tgt, color);
      await typeFx(tgt, e.moveType);
    } else {
      await lunge(user);
      if (e.moveType) await typeFx(tgt, e.moveType); else await impact(tgt, '#f8f8f8');
    }
  }

  async function statFx(side, up) {
    const color = up ? '#58a8f8' : '#f06060';
    const c = POS[side];
    const ps = [];
    for (let i = 0; i < 8; i++) {
      const node = fxNode(up ? 'bt-arrow-up' : 'bt-arrow-down', c.cx - 90 + i * 24, c.cy + (up ? 40 : -60), { '--c': color });
      ps.push(anim(node, [{ transform: 'translateY(0)', opacity: 0 }, { transform: `translateY(${up ? -30 : 30}px)`, opacity: 1, offset: 0.3 },
        { transform: `translateY(${up ? -90 : 90}px)`, opacity: 0 }], { duration: 620, delay: (i % 4) * 70 }).then(() => node.remove()));
    }
    ps.push(anim(monEl(side), [{ filter: 'none' },
      { filter: up ? 'brightness(1.3) sepia(1) hue-rotate(170deg) saturate(3)' : 'brightness(0.9) sepia(1) hue-rotate(-40deg) saturate(3)' },
      { filter: 'none' }], { duration: 620 }));
    sfx(up ? 'statUp' : 'statDown');
    return Promise.all(ps);
  }

  function statusFx(side, status) {
    const color = STATUS_COLOR[status] || '#ffffff';
    if (status === 'sleep') {
      const c = POS[side];
      const ps = [0, 1, 2].map((i) => {
        const node = fxNode('bt-zz', c.cx + 30 + i * 18, c.cy - 30 - i * 24);
        node.textContent = 'Z';
        return anim(node, [{ opacity: 0, transform: 'translate(0,0) scale(0.6)' }, { opacity: 1, offset: 0.3 },
          { opacity: 0, transform: 'translate(24px,-36px) scale(1.2)' }], { duration: 700, delay: i * 160 }).then(() => node.remove());
      });
      return Promise.all(ps);
    }
    const kind = status === 'paralyze' ? 'spark' : status === 'freeze' ? 'spin' : 'rise';
    return Promise.all([particles(side, color, kind, 10),
      anim(monEl(side), [{ filter: 'none' }, { filter: `drop-shadow(0 0 0 ${color}) brightness(1.2)` }, { filter: 'none' }], { duration: 480 })]);
  }

  function healFx(side) {
    return Promise.all([particles(side, '#98f8a8', 'rise', 10), particles(side, '#f8f8f8', 'rise', 5)]);
  }

  // カプセル投げ → 開いて登場
  function capsule(x, y) {
    const node = el('div', { class: 'bt-capsule', style: { left: (x - 15) + 'px', top: (y - 15) + 'px' } });
    ui.fx.appendChild(node);
    return node;
  }
  async function sendOutAnim(side, opts) {
    opts = opts || {};
    const c = POS[side];
    const m = monEl(side);
    resetMon(side);
    m.style.opacity = '0';
    let cap;
    if (side === 'player') {
      cap = capsule(60, 360);
      await anim(cap, [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: `translate(${(c.cx - 60) * 0.5}px,-150px) rotate(360deg)`, offset: 0.5 },
        { transform: `translate(${c.cx - 60}px,${c.foot - 60 - 360}px) rotate(720deg)` }], { duration: 480, easing: 'ease-out', fill: 'forwards' });
    } else {
      cap = capsule(c.cx + 40, 40);
      await anim(cap, [
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: `translate(-20px,${c.foot - 60 - 40 - 30}px) rotate(-360deg)`, offset: 0.7 },
        { transform: `translate(-40px,${c.foot - 60 - 40}px) rotate(-540deg)` }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
    }
    cap.classList.add('is-open');
    const burst = fxNode('bt-burst', c.cx - 60, c.foot - 120);
    sfx('confirm');
    const pBurst = anim(burst, [{ transform: 'scale(0.1)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 360, easing: 'ease-out' }).then(() => burst.remove());
    removeLater(cap, 160);
    await anim(m, [
      { transform: 'scale(0.05)', filter: 'brightness(0) invert(1)', opacity: 1 },
      { transform: 'scale(1.08)', filter: 'brightness(0) invert(1)', opacity: 1, offset: 0.55 },
      { transform: 'scale(1)', filter: 'brightness(1)', opacity: 1 }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
    await pBurst;
    resetMon(side);
  }

  async function recallAnim(side) {
    const m = monEl(side);
    await anim(m, [
      { transform: 'scale(1)', filter: 'none', opacity: 1 },
      { transform: 'scale(0.9)', filter: 'brightness(1.4) sepia(1) hue-rotate(-50deg) saturate(6)', opacity: 1, offset: 0.35 },
      { transform: 'scale(0.02)', filter: 'brightness(1.4) sepia(1) hue-rotate(-50deg) saturate(6)', opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
    hideMon(side);
  }

  async function faintAnim(side) {
    sfx('faint');
    await anim(monEl(side), [
      { transform: 'translateY(0)', clipPath: 'inset(0px 0px 0px 0px)', opacity: 1 },
      { transform: 'translateY(192px)', clipPath: 'inset(0px 0px 192px 0px)', opacity: 1 }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
    hideMon(side);
  }

  // 報酬ポップ（ソシャゲ風）
  function rewardPop(points) {
    const node = el('div', { class: 'bt-reward' }, el('span', { class: 'bt-reward-gem' }), el('b', { text: '+' + fmt(points) }), el('small', { text: 'pt' }));
    ui.fx.appendChild(node);
    anim(node, [
      { transform: 'translate(-50%, 20px) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, 0) scale(1.1)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%, -6px) scale(1)', opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%, -30px) scale(1)', opacity: 0 }], { duration: 1600, easing: 'ease-out' }).then(() => node.remove());
  }

  // パーティの状態を表すボール列（トレーナー戦の導入）
  function showBalls(show) {
    ui.balls.innerHTML = '';
    ui.balls.hidden = !show;
    if (!show || !ctx) return;
    const row = (side) => {
      const party = ctx.b[side].party;
      const box = el('div', { class: 'bt-balls bt-balls-' + side });
      for (let i = 0; i < 6; i++) {
        const inst = party[i];
        box.appendChild(el('span', { class: 'bt-ball' + (!inst ? ' is-empty' : (fainted(inst) ? ' is-fainted' : '')) }));
      }
      return box;
    };
    ui.balls.append(row('enemy'), row('player'));
  }

  // ---------------------------------------------------------------- メニュー
  function menuCommand() {
    return new Promise((resolve) => {
      const items = [
        { id: 'fight', label: 'たたかう', pos: 0 },
        { id: 'party', label: 'モンスター', pos: 1 },
        { id: 'run', label: 'にげる', pos: 2 },
      ];
      ui.cmd.innerHTML = '';
      const cells = [];
      for (let p = 0; p < 4; p++) {
        const it = items.find((x) => x.pos === p);
        const cell = el('div', { class: 'bt-cmd-item' + (it ? '' : ' is-empty'), dataset: { cmd: it ? it.id : '' } },
          el('span', { class: 'bt-cur' }), el('span', { class: 'bt-cmd-label', text: it ? it.label : '' }));
        if (it) {
          cell.addEventListener('click', (ev) => { ev.stopPropagation(); pos = p; done(it.id); });
          cell.addEventListener('pointerenter', () => { if (pos !== p) { pos = p; render(); } });
        }
        cells.push(cell);
        ui.cmd.appendChild(cell);
      }
      let pos = items.some((x) => x.pos === cursor.cmd) ? cursor.cmd : 0;
      const render = () => cells.forEach((c, i) => c.classList.toggle('is-active', i === pos));
      const moveTo = (p) => { if (items.some((x) => x.pos === p) && p !== pos) { pos = p; render(); sfx('select'); } };
      render();
      ui.cmd.hidden = false;
      phase = 'command';
      let finished = false;
      function done(id) {
        if (finished) return;
        finished = true;
        sfx('confirm');
        cursor.cmd = pos;
        ui.cmd.hidden = true;
        mode = null;
        phase = 'anim';
        resolve(id);
      }
      mode = {
        onPress(a) {
          if (a === 'up' || a === 'down') moveTo(pos ^ 2);
          else if (a === 'left' || a === 'right') moveTo(pos ^ 1);
          else if (a === 'a') { const it = items.find((x) => x.pos === pos); if (it) done(it.id); }
        },
      };
    });
  }

  function menuMovesOnce(inst) {
    return new Promise((resolve) => {
      ui.moves.innerHTML = '';
      const grid = el('div', { class: 'bt-moves-grid' });
      const info = el('div', { class: 'bt-moves-info' });
      const ppLine = el('div', { class: 'bt-pp' });
      const typeLine = el('div', { class: 'bt-mtype' });
      info.append(ppLine, typeLine);
      ui.moves.append(grid, info);
      const cells = [];
      for (let i = 0; i < 4; i++) {
        const slot = inst.moves[i];
        const def = slot && App.data.move(slot.id);
        const cell = el('div', { class: 'bt-move' + (def ? '' : ' is-empty'), dataset: { index: i } },
          el('span', { class: 'bt-cur' }), el('span', { class: 'bt-move-name', text: def ? def.name : 'ー' }));
        if (def) {
          cell.style.setProperty('--tc', typeColor(def.type));
          cell.addEventListener('click', (ev) => { ev.stopPropagation(); idx = i; render(); pick(); });
          cell.addEventListener('pointerenter', () => { if (idx !== i) { idx = i; render(); } });
        }
        cells.push(cell);
        grid.appendChild(cell);
      }
      const back = el('button', { class: 'bt-back', type: 'button', text: 'もどる' });
      back.addEventListener('click', (ev) => { ev.stopPropagation(); finish({ back: true }, 'cancel'); });
      ui.moves.appendChild(back);
      const valid = (i) => !!(inst.moves[i] && App.data.move(inst.moves[i].id));
      let idx = valid(cursor.move) ? cursor.move : 0;
      const render = () => {
        cells.forEach((c, i) => c.classList.toggle('is-active', i === idx));
        const slot = inst.moves[idx];
        const def = slot && App.data.move(slot.id);
        if (!def) return;
        const mx = App.monster.maxPP(slot.id);
        const ratio = mx ? slot.pp / mx : 0;
        ppLine.innerHTML = '';
        ppLine.append(el('span', { class: 'bt-pp-label', text: 'PP' }),
          el('span', { class: 'bt-pp-val' + (slot.pp <= 0 ? ' is-empty' : (ratio <= 0.25 ? ' is-low' : (ratio <= 0.5 ? ' is-half' : ''))), text: pad3(slot.pp) + '/' + pad3(mx) }));
        typeLine.innerHTML = '';
        typeLine.append(el('span', { class: 'bt-mtype-label', text: 'タイプ/' }),
          el('span', { class: 'bt-type-chip', text: typeName(def.type), style: { '--tc': typeColor(def.type) } }));
      };
      const moveTo = (i) => { if (valid(i) && i !== idx) { idx = i; render(); sfx('select'); } };
      render();
      ui.moves.hidden = false;
      ui.msg.classList.add('is-under');
      phase = 'moves';
      let finished = false;
      function finish(r, sound) {
        if (finished) return;
        finished = true;
        if (sound) sfx(sound);
        cursor.move = idx;
        ui.moves.hidden = true;
        ui.msg.classList.remove('is-under');
        mode = null;
        phase = 'anim';
        resolve(r);
      }
      function pick() {
        const slot = inst.moves[idx];
        if (!slot) return;
        if (!(slot.pp > 0)) { finish({ noPP: true }, 'error'); return; }
        finish({ index: idx }, 'confirm');
      }
      mode = {
        onPress(a) {
          if (a === 'up' || a === 'down') moveTo(idx ^ 2);
          else if (a === 'left' || a === 'right') moveTo(idx ^ 1);
          else if (a === 'a') pick();
          else if (a === 'b') finish({ back: true }, 'cancel');
        },
      };
    });
  }
  async function menuMoves(inst) {
    for (;;) {
      const r = await menuMovesOnce(inst);
      if (r.back) return null;
      if (r.noPP) { await say('わざの ポイントが のこっていない！', { wait: true }); continue; }
      return r.index;
    }
  }

  // opts: { cancelable, prompt }
  function menuParty(opts) {
    opts = opts || {};
    const b = ctx.b;
    const party = b.player.party;
    return new Promise((resolve) => {
      ui.party.innerHTML = '';
      const grid = el('div', { class: 'bt-party-grid' });
      const note = el('div', { class: 'bt-party-note' });
      const bar = el('div', { class: 'bt-party-bar' }, note);
      const cards = [];
      party.forEach((inst, i) => {
        const mx = App.monster.stats(inst).hp;
        let src = '';
        let flip = false;
        try { const sp = App.sprites.monsterSprite(inst.speciesId, 'front'); src = sp.src; flip = sp.flip; } catch (e) { /* 無視 */ }
        const h = { fill: el('div', { class: 'bt-hp-fill' }) };
        const card = el('div', {
          class: 'bt-pcard' + (fainted(inst) ? ' is-fainted' : '') + (i === b.player.active && !fainted(inst) ? ' is-current' : ''),
          dataset: { index: i },
        },
        el('img', { class: 'bt-pcard-icon' + (flip ? ' is-flip' : ''), src, alt: '', draggable: 'false' }),
        el('div', { class: 'bt-pcard-body' },
          el('div', { class: 'bt-pcard-top' },
            el('span', { class: 'bt-pcard-name', text: dname(inst) }),
            el('span', { class: 'bt-pcard-lv' }, el('small', { text: 'Lv' }), String(inst.level))),
          el('div', { class: 'bt-pcard-mid' },
            inst.status ? el('span', { class: 'bt-status', text: STATUS_LABEL[inst.status], style: { '--st-color': STATUS_COLOR[inst.status] } }) : null,
            fainted(inst) ? el('span', { class: 'bt-status is-faint', text: 'ひんし' }) : null,
            el('div', { class: 'bt-hpbar' }, el('span', { class: 'bt-hp-label', text: 'HP' }), el('div', { class: 'bt-hp-track' }, h.fill))),
          el('div', { class: 'bt-pcard-hp', text: pad3(inst.hp) + '/' + pad3(mx) })));
        setHpBar(h, inst.hp, mx);
        card.addEventListener('click', (ev) => { ev.stopPropagation(); idx = i; render(); choose(); });
        card.addEventListener('pointerenter', () => { if (idx !== i) { idx = i; render(); } });
        cards.push(card);
        grid.appendChild(card);
      });
      if (opts.cancelable) {
        const back = el('button', { class: 'bt-back bt-party-back', type: 'button', text: 'もどる' });
        back.addEventListener('click', (ev) => { ev.stopPropagation(); finish(null, 'cancel'); });
        bar.appendChild(back);
      }
      ui.party.append(grid, bar);
      const defaultNote = opts.prompt || 'どの モンスターを だしますか？';
      note.textContent = defaultNote;
      let idx = Math.min(party.length - 1, Math.max(0, opts.cancelable ? b.player.active : party.findIndex((p) => !fainted(p))));
      const render = () => cards.forEach((c, i) => c.classList.toggle('is-active', i === idx));
      render();
      ui.party.hidden = false;
      phase = 'party';
      let finished = false;
      let noteTimer = null;
      const warn = (text) => {
        sfx('error');
        note.textContent = text;
        note.classList.add('is-warn');
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => { note.textContent = defaultNote; note.classList.remove('is-warn'); }, 1400);
      };
      function finish(v, sound) {
        if (finished) return;
        finished = true;
        clearTimeout(noteTimer);
        if (sound) sfx(sound);
        ui.party.hidden = true;
        mode = null;
        phase = 'anim';
        resolve(v);
      }
      function choose() {
        const inst = party[idx];
        if (!inst) return;
        if (fainted(inst)) { warn(dname(inst) + 'は たたかう げんきが ない！'); return; }
        if (idx === b.player.active && !fainted(b.player.battler.inst)) { warn(dname(inst) + 'は もう たたかっている！'); return; }
        finish(idx, 'confirm');
      }
      const n = party.length;
      mode = {
        onPress(a) {
          let ni = idx;
          if (a === 'up') ni = idx - 2;
          else if (a === 'down') ni = idx + 2;
          else if (a === 'left') ni = idx - 1;
          else if (a === 'right') ni = idx + 1;
          else if (a === 'a') { choose(); return; }
          else if (a === 'b') { if (opts.cancelable) finish(null, 'cancel'); return; }
          else return;
          if (ni >= 0 && ni < n && ni !== idx) { idx = ni; render(); sfx('select'); }
        },
      };
    });
  }

  function showLevelPanel(before, after) {
    return new Promise((resolve) => {
      const render = (totals) => {
        ui.lvpanel.innerHTML = '';
        STAT_ROWS.forEach(([label, key]) => {
          const d = after[key] - before[key];
          ui.lvpanel.appendChild(el('div', { class: 'bt-lv-row' },
            el('span', { class: 'bt-lv-label', text: label }),
            el('span', { class: 'bt-lv-val' + (totals ? '' : ' is-diff'), text: totals ? String(after[key]) : '+' + d })));
        });
      };
      render(false);
      ui.lvpanel.hidden = false;
      anim(ui.lvpanel, [{ transform: 'scale(0.9)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 120 });
      phase = 'levelup';
      let page = 0;
      mode = {
        onPress(a) {
          if (a !== 'a' && a !== 'b') return;
          sfx('select');
          if (page === 0) { page = 1; render(true); return; }
          mode = null;
          ui.lvpanel.hidden = true;
          phase = 'anim';
          resolve();
        },
      };
    });
  }

  // ---------------------------------------------------------------- イベント演出
  async function playEvents(events) {
    for (const e of events) await playEvent(e);
  }

  async function playEvent(e) {
    const b = ctx.b;
    switch (e.type) {
      case 'move':
        await say(e.text, { hold: true });
        await animMove(e);
        await wait(120);
        break;
      case 'miss':
        sfx('miss');
        await say(e.text);
        break;
      case 'damage': {
        if (e.source === 'move') {
          sfx(e.effectiveness > 1 ? 'hitSuper' : (e.effectiveness < 1 ? 'hitWeak' : 'hit'));
          const pr = [blink(e.side, 3)];
          if (e.crit) pr.push(flash('#ffffff', 140, 0.6));
          if (e.effectiveness > 1) pr.push(shake(10));
          await Promise.all(pr);
        } else if (e.source === 'poison' || e.source === 'burn') {
          sfx('hit');
          await Promise.all([statusFx(e.side, e.source), blink(e.side, 2)]);
        } else {
          sfx('hit');
          await blink(e.side, 2);
        }
        await animateHp(e.side, e.hp, e.maxHp);
        await wait(80);
        break;
      }
      case 'heal':
        sfx('heal');
        await Promise.all([healFx(e.side), animateHp(e.side, e.hp, e.maxHp)]);
        if (e.text) await say(e.text);
        break;
      case 'status':
        setStatusBadge(hud(e.side), e.status);
        if (e.status) await statusFx(e.side, e.status);
        if (e.text) await say(e.text);
        break;
      case 'stat':
        await statFx(e.side, e.delta > 0);
        await say(e.text);
        break;
      case 'faint':
        await faintAnim(e.side);
        await hudSlideOut(e.side);
        if (e.side === 'enemy' && Eng().sideDefeated(b, 'enemy')) bgm('victory');
        await say(e.text, { wait: e.side === 'player' });
        break;
      case 'recall':
        await say(e.text, { hold: true });
        await recallAnim(e.side);
        await hudSlideOut(e.side);
        break;
      case 'switch': {
        const inst = b[e.side].party[e.index];
        setMonSprite(e.side, inst);
        setHud(e.side, inst);
        if (e.side === 'enemy') {
          App.state.markSeen(inst.speciesId);
          await say(e.text, { hold: true });
          await sendOutAnim('enemy');
          await hudIn('enemy');
          await wait(200);
        } else {
          await say(e.text, { hold: true });
          await sendOutAnim('player');
          await hudIn('player');
          await wait(200);
        }
        break;
      }
      case 'run':
        if (e.success) sfx('run');
        await say(e.text);
        break;
      case 'message':
        if (e.anim && e.side) {
          if (STATUS_COLOR[e.anim]) {
            // 状態異常の演出は damage 側で行う（どく・やけど）
            if (e.anim !== 'poison' && e.anim !== 'burn') await statusFx(e.side, e.anim);
          }
        }
        if (e.text) await say(e.text);
        break;
      default:
        if (e.text) await say(e.text);
    }
  }

  // ---------------------------------------------------------------- 経験値・レベルアップ
  async function applyExp(s) {
    const b = ctx.b;
    const inst = s.inst;
    const isActive = inst === b.player.battler.inst;
    const beforeProg = App.monster.expProgress(inst);
    const r = App.monster.addExp(inst, s.amount);
    if (isActive) {
      const h = hud('player');
      if (r.levelsGained > 0) {
        await animateExpTo(h, beforeProg, 1, 500 * (1 - beforeProg) + 150);
        for (let i = 1; i < r.levelsGained; i++) await animateExpTo(h, 0, 1, 250);
        setHud('player', inst);
        setExpBar(h, 0);
        anim(h.root, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], { duration: 420 });
        await animateExpTo(h, 0, App.monster.expProgress(inst), 400);
      } else {
        const to = App.monster.expProgress(inst);
        await animateExpTo(h, beforeProg, to, Math.max(200, 700 * (to - beforeProg)));
      }
    }
    emit('monster:updated', { speciesId: inst.speciesId });
    return r;
  }

  async function levelUpMessages(inst, r, withPanel) {
    if (!(r.levelsGained > 0)) return;
    const name = dname(inst);
    sfx('levelup');
    await say(name + 'は\nレベル ' + r.newLevel + 'に あがった！', { hold: true });
    if (withPanel) await showLevelPanel(r.statsBefore, r.statsAfter);
    else await waitA();
    for (const id of r.learned) {
      sfx('levelup');
      await say(name + 'は あたらしく\n' + moveName(id) + 'を おぼえた！', { wait: true });
    }
    for (const id of r.pending) {
      await say(name + 'は ' + moveName(id) + 'を\nおぼえたいが わざが いっぱいだ！', { wait: true });
      await say('へんせい画面で わざを いれかえられます', { wait: true });
    }
  }

  // 倒した敵の経験値を配分（場に出たもの → 控え の順）
  async function gainExp(enemyIndex) {
    const shares = Eng().expShares(ctx.b, enemyIndex);
    const parts = shares.filter((s) => s.participant);
    const bench = shares.filter((s) => !s.participant);
    for (const s of parts) {
      await say(dname(s.inst) + 'は\n' + fmt(s.amount) + ' けいけんちを もらった！', { hold: true });
      const r = await applyExp(s);
      await waitA();
      await levelUpMessages(s.inst, r, true);
    }
    if (bench.length) {
      await say('てもちの モンスターたちも\nけいけんちを もらった！', { wait: true });
      for (const s of bench) {
        const r = await applyExp(s);
        await levelUpMessages(s.inst, r, false);
      }
    }
  }

  // ---------------------------------------------------------------- 進行
  async function chooseAction() {
    const b = ctx.b;
    for (;;) {
      const inst = b.player.battler.inst;
      ui.msg.classList.add('is-prompt');
      setMsg(dname(inst) + 'は\nどうする？');
      const cmd = await menuCommand();
      ui.msg.classList.remove('is-prompt');
      if (cmd === 'fight') {
        if (!Eng().hasUsableMoves(inst)) return { type: 'move', index: -1 };
        setMsg('');
        const mi = await menuMoves(inst);
        if (mi === null) continue;
        return { type: 'move', index: mi };
      }
      if (cmd === 'party') {
        const pi = await menuParty({ cancelable: true, prompt: 'どの モンスターと いれかえる？' });
        if (pi === null) continue;
        return { type: 'switch', index: pi };
      }
      if (cmd === 'run') {
        if (b.kind !== 'wild') {
          await say('だめだ！ トレーナーとの\nしょうぶから にげることは できない！', { wait: true });
          continue;
        }
        return { type: 'run' };
      }
    }
  }

  async function afterTurn() {
    const b = ctx.b;
    const enemyDown = fainted(b.enemy.battler.inst);
    const playerDown = fainted(b.player.battler.inst);
    if (enemyDown) await gainExp(b.enemy.active);
    if (Eng().sideDefeated(b, 'player')) return 'lose';
    if (enemyDown && Eng().nextEnemyIndex(b) < 0) return 'win';
    if (playerDown) {
      const idx = await menuParty({ cancelable: false, prompt: 'つぎの モンスターを えらんでください' });
      await playEvents(Eng().switchIn(b, 'player', idx));
    }
    if (enemyDown) {
      const next = Eng().nextEnemyIndex(b);
      await playEvents(Eng().switchIn(b, 'enemy', next));
    }
    return null;
  }

  async function mainLoop() {
    const b = ctx.b;
    for (;;) {
      const action = await chooseAction();
      const events = Eng().resolveTurn(b, action);
      await playEvents(events);
      if (b.over === 'run') return 'run';
      const r = await afterTurn();
      if (r) return r;
    }
  }

  async function slideInSides() {
    ui.shade.style.opacity = '1';
    const p1 = anim(ui.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
    const p2 = anim(ui.enemySide, [{ transform: 'translateX(-720px)' }, { transform: 'translateX(0px)' }], { duration: 1000, easing: 'cubic-bezier(.2,.6,.3,1)' });
    const p3 = anim(ui.playerSide, [{ transform: 'translateX(720px)' }, { transform: 'translateX(0px)' }], { duration: 1000, easing: 'cubic-bezier(.2,.6,.3,1)' });
    await Promise.all([p1, p2, p3]);
  }

  function setupPlayerBack() {
    try {
      const look = cfg().player && cfg().player.look;
      ui.playerBack.src = App.sprites && App.sprites.playerBack ? App.sprites.playerBack(look || {}) : '';
    } catch (e) { ui.playerBack.src = ''; }
    ui.playerBack.style.opacity = '1';
  }

  async function sendOutPlayerFirst() {
    const b = ctx.b;
    const inst = b.player.battler.inst;
    setMonSprite('player', inst);
    setHud('player', inst);
    await say('ゆけっ！ ' + dname(inst) + '！', { hold: true });
    await anim(ui.playerBack, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-300px)', opacity: 1 }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
    ui.playerBack.style.opacity = '0';
    await sendOutAnim('player');
    await hudIn('player');
    await wait(250);
  }

  async function introWild() {
    const b = ctx.b;
    const enemy = b.enemy.battler.inst;
    setMonSprite('enemy', enemy);
    setHud('enemy', enemy);
    hideMon('player');
    setupPlayerBack();
    ui.enemyImg.style.filter = 'brightness(0.25)';
    App.state.markSeen(enemy.speciesId);
    await slideInSides();
    await anim(ui.enemyImg, [{ filter: 'brightness(0.25)' }, { filter: 'brightness(2)' }, { filter: 'brightness(1)' }], { duration: 360 });
    ui.enemyImg.style.filter = '';
    await hudIn('enemy');
    await say('やせいの ' + dname(enemy) + 'が とびだしてきた！', { wait: true });
    await sendOutPlayerFirst();
  }

  function trainerSrc(t) {
    if (t && typeof t.image === 'string' && t.image.trim()) return t.image.trim();
    try { return App.sprites.trainerPortrait((t && t.look) || {}); } catch (e) { return ''; }
  }

  async function introTrainer() {
    const b = ctx.b;
    const t = ctx.trainer;
    hideMon('enemy');
    hideMon('player');
    setupPlayerBack();
    ui.trainerImg.src = trainerSrc(t);
    ui.trainerImg.hidden = false;
    ui.trainerImg.style.transform = '';
    await slideInSides();
    showBalls(true);
    await say(ctx.trainerLabel + 'が\nしょうぶを しかけてきた！', { wait: true });
    showBalls(false);
    await anim(ui.trainerImg, [{ transform: 'translateX(0)' }, { transform: 'translateX(340px)' }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
    ui.trainerImg.hidden = true;
    const inst = b.enemy.battler.inst;
    setMonSprite('enemy', inst);
    setHud('enemy', inst);
    App.state.markSeen(inst.speciesId);
    await say(ctx.trainerLabel + 'は\n' + dname(inst) + 'を くりだした！', { hold: true });
    await sendOutAnim('enemy');
    await hudIn('enemy');
    await wait(200);
    await sendOutPlayerFirst();
  }

  async function trainerSlideBack() {
    ui.trainerImg.hidden = false;
    await anim(ui.trainerImg, [{ transform: 'translateX(340px)' }, { transform: 'translateX(0)' }], { duration: 460, easing: 'ease-out', fill: 'forwards' });
  }

  async function giveReward(points, reason) {
    const pts = Math.max(0, Math.floor(Number(points) || 0));
    if (pts <= 0) return;
    App.state.addPoints(pts, reason);
    sfx('coin');
    rewardPop(pts);
    await say(playerName() + 'は\n' + fmt(pts) + 'ポイント てにいれた！', { wait: true });
  }

  async function outro(result) {
    const b = ctx.b;
    const t = ctx.trainer;
    if (result === 'win') {
      App.state.incStat('wins');
      if (b.kind === 'wild') {
        App.state.incStat('wildWins');
        await giveReward(App.monster.wildPoints(b.enemy.party[0]), 'wild');
      } else {
        App.state.incStat('trainerWins');
        await trainerSlideBack();
        await say(ctx.trainerLabel + 'との\nしょうぶに かった！', { wait: true });
        for (const line of (t && Array.isArray(t.lose) ? t.lose : [])) await say(line, { wait: true });
        const rw = t && typeof t.reward === 'number' ? t.reward : ((cfg().rewards && cfg().rewards.trainerDefault) || 0);
        if (ctx.trainerId) App.state.setTrainerDefeated(ctx.trainerId);
        await giveReward(rw, 'trainer');
      }
    } else if (result === 'lose') {
      App.state.incStat('losses');
      try { if (App.audio && App.audio.stopBgm) App.audio.stopBgm(); } catch (e) { /* 無視 */ }
      sfx('lose');
      await say(playerName() + 'の てもちには\nたたかえる モンスターが いない！', { wait: true });
      if (b.kind === 'trainer') {
        await trainerSlideBack();
        for (const line of (t && Array.isArray(t.win) ? t.win : [])) await say(line, { wait: true });
      }
    } else {
      App.state.incStat('runs');
    }
  }

  function restoreBgm(prev) {
    let name = null;
    try {
      const map = App.data.map(App.state.data.player.map);
      name = map && map.bgm;
    } catch (e) { name = null; }
    if (!name) name = prev && !/^battle|^victory$/.test(prev) ? prev : null;
    if (name) bgm(name);
    else { try { if (App.audio && App.audio.stopBgm) App.audio.stopBgm(); } catch (e) { /* 無視 */ } }
  }

  async function run(c) {
    if (active) throw new Error('App.battle: すでにバトル中です');
    if (!inited) init();
    active = true;
    ctx = c;
    phase = 'intro';
    let result = null;
    let prevBgm = null;
    try { prevBgm = App.audio && App.audio.currentBgm ? App.audio.currentBgm() : null; } catch (e) { prevBgm = null; }
    try {
      if (App.main && App.main.setTabLock) App.main.setTabLock(true, 'バトル中は きりかえ できません');
      if (App.input && App.input.push) popInput = App.input.push(inputHandler);
      const party = App.state.party().filter((p) => p && App.data.monster(p.speciesId));
      c.terrain = detectTerrain(c.opts);
      c.b = Eng().create({
        kind: c.kind, playerParty: party, enemyParty: c.enemyParty, ai: c.ai,
        trainerLabel: c.trainerLabel, rng: c.opts && c.opts.rng,
      });
      App.state.incStat('battles');
      emit('battle:start', c.kind === 'trainer' ? { kind: 'trainer', trainerId: c.trainerId } : { kind: 'wild' });
      build(c);
      layer.hidden = false;
      bgm(c.kind === 'trainer' ? (c.trainer && c.trainer.boss ? 'battleBoss' : 'battleTrainer') : 'battleWild');
      if (c.kind === 'trainer') await introTrainer();
      else await introWild();
      result = await mainLoop();
      await outro(result);
    } catch (e) {
      console.error('[battle] バトル進行中に例外', e);
      result = result || (c.b && Eng().sideDefeated(c.b, 'player') ? 'lose' : 'run');
    } finally {
      await finish(c, result || 'run', prevBgm);
    }
    return result || 'run';
  }

  async function finish(c, result, prevBgm) {
    mode = null;
    phase = 'end';
    let bgmRestored = false;
    try {
      if (ui.shade) {
        await anim(ui.shade, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, fill: 'forwards' });
        restoreBgm(prevBgm);
        bgmRestored = true;
        // 暗転したまま中身を消し、フィールドへ明転する
        Array.from(ui.root.children).forEach((n) => { if (n !== ui.shade) n.remove(); });
        ui.root.style.background = 'transparent';
        await anim(ui.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      }
    } catch (e) { /* 無視 */ }
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    ui = {};
    if (!bgmRestored) restoreBgm(prevBgm);
    try {
      App.state.save();
      (c.b ? c.b.player.party : []).forEach((inst) => emit('monster:updated', { speciesId: inst.speciesId }));
    } catch (e) { console.error('[battle] 保存に失敗', e); }
    if (popInput) { popInput(); popInput = null; }
    if (App.main && App.main.setTabLock) App.main.setTabLock(false);
    active = false;
    ctx = null;
    phase = 'idle';
    emit('battle:end', { kind: c.kind, result });
  }

  // ---------------------------------------------------------------- 公開 API
  function init() {
    if (inited) return;
    inited = true;
    layer = document.getElementById('battle-layer');
    if (!layer) {
      layer = el('div', { id: 'battle-layer', hidden: true });
      (document.getElementById('screen') || document.body).appendChild(layer);
    }
  }

  // opts（拡張・省略可）: { terrain: 'grass'|'forest'|'cave'|'indoor', rng }
  function startWild(speciesId, level, opts) {
    if (!App.data.monster(speciesId)) return Promise.reject(new Error('App.battle.startWild: 未知のモンスター "' + speciesId + '"'));
    if (!App.state.hasHealthy()) {
      console.warn('[battle] たたかえるモンスターがいないため バトルを開始しません');
      return Promise.resolve('lose');
    }
    const enemy = App.monster.create(speciesId, level);
    return run({ kind: 'wild', enemyParty: [enemy], ai: 'random', opts: opts || {} });
  }

  function startTrainer(trainerId, opts) {
    const t = App.data.trainer(trainerId);
    if (!t) return Promise.reject(new Error('App.battle.startTrainer: 未知のトレーナー "' + trainerId + '"'));
    const enemyParty = (Array.isArray(t.party) ? t.party : [])
      .filter((p) => p && App.data.monster(p.species))
      .map((p) => App.monster.create(p.species, p.level || 5, { moves: p.moves }));
    if (!enemyParty.length) return Promise.reject(new Error('App.battle.startTrainer: トレーナー "' + trainerId + '" の手持ちが空です'));
    if (!App.state.hasHealthy()) {
      console.warn('[battle] たたかえるモンスターがいないため バトルを開始しません');
      return Promise.resolve('lose');
    }
    const label = (t.className ? t.className + 'の ' : '') + (t.name || '');
    return run({
      kind: 'trainer', trainer: t, trainerId, trainerLabel: label, enemyParty,
      ai: t.ai === 'random' ? 'random' : 'smart', opts: opts || {},
    });
  }

  function isActive() { return active; }

  App.battle = {
    init, startWild, startTrainer, isActive,
    // 以下は拡張（テスト・デバッグ用）
    debugState() {
      const b = ctx && ctx.b;
      const side = (s) => {
        if (!b) return null;
        const inst = b[s].battler.inst;
        return { speciesId: inst.speciesId, hp: inst.hp, maxHp: App.monster.stats(inst).hp, level: inst.level, status: inst.status, active: b[s].active,
          moves: inst.moves.map((m) => ({ id: m.id, pp: m.pp })) };
      };
      return { active, phase, text: lastText, kind: ctx && ctx.kind, turn: b ? b.turn : 0, terrain: ctx && ctx.terrain, player: side('player'), enemy: side('enemy') };
    },
    setAnimScale(s) { animScale = Math.max(0.01, Number(s) || 1); },
    _ctx() { return ctx; },
    _press: press,
  };
})();
