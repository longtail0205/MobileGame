// integration テスト用の補助（テスト時だけ読み込む。ゲーム本体からは使わない）
//   IT.walk('right', 3)        … 方向キーを押し続けて n マス歩く（会話・バトル・ワープが始まったら止まる）
//   IT.path('R3 U7 L2')        … 連続移動。結果は最終状態の文字列
(function () {
  const CODE = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const KEY = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', KeyZ: 'z', KeyX: 'x' };
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function tgt() { return document.body; }   // window だと e.target が Node でなく ui.js のモーダル判定で例外になる
  function down(code) { tgt().dispatchEvent(new KeyboardEvent('keydown', { code, key: KEY[code] || code, bubbles: true })); }
  function up(code) { tgt().dispatchEvent(new KeyboardEvent('keyup', { code, key: KEY[code] || code, bubbles: true })); }
  const st = () => App.field.debug.state();
  const interrupted = () => App.dialog.isOpen() || (App.battle && App.battle.isActive()) || st().busy;
  function fmt() { const s = st(); return [s.map, s.x, s.y, s.dir].join(' ') + (interrupted() ? ' (interrupted)' : ''); }

  function walk(dir, n, opts) {
    opts = opts || {};
    const s0 = st();
    const map0 = s0.map;
    const [dx, dy] = DV[dir];
    const code = CODE[dir];
    const lastX = s0.x + dx * (n - 1), lastY = s0.y + dy * (n - 1);
    return new Promise((resolve) => {
      if (opts.run) down('KeyX');
      down(code);
      const t0 = Date.now();
      let released = false;
      const tick = () => {
        const s = st();
        const done = (why) => {
          if (!released) up(code);
          if (opts.run) up('KeyX');
          setTimeout(() => resolve(why + ': ' + fmt()), 30);
        };
        if (s.map !== map0) { done('warp'); return; }
        if (App.dialog.isOpen() || (App.battle && App.battle.isActive())) { done('event'); return; }
        if (!released && s.moving && s.x === lastX && s.y === lastY) { up(code); released = true; }
        if (released && !s.moving) { setTimeout(() => resolve('ok: ' + fmt()), 60); if (opts.run) up('KeyX'); return; }
        if (Date.now() - t0 > (opts.timeout || 400 * n + 1500)) { done('timeout'); return; }
        setTimeout(tick, 8);
      };
      tick();
    });
  }
  async function path(spec) {
    const out = [];
    for (const tok of spec.trim().split(/\s+/)) {
      const d = { U: 'up', D: 'down', L: 'left', R: 'right' }[tok[0]];
      const r = await walk(d, parseInt(tok.slice(1), 10) || 1);
      out.push(tok + '→' + r);
      if (!r.startsWith('ok')) break;
      await new Promise((res) => setTimeout(res, 80));
    }
    return out.join(' | ');
  }
  // 同じマップ内の (tx, ty) まで最短経路で歩く（NPC・ワープマスは避ける。ふさがれたら再計算）
  function bfs(tx, ty) {
    const s = st();
    const m = GameData.maps[s.map];
    const H = m.tiles.length, W = m.tiles[0].length;
    const npcSet = new Set(s.npcs.filter((n) => !n.hidden).map((n) => n.x + ',' + n.y));
    const warpSet = new Set((m.warps || []).map((w) => w.x + ',' + w.y));
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && GameData.tiles[m.tiles[y][x]] && GameData.tiles[m.tiles[y][x]].walk &&
      !npcSet.has(x + ',' + y) && (!warpSet.has(x + ',' + y) || (x === tx && y === ty));
    const prev = new Map([[s.x + ',' + s.y, null]]);
    const q = [[s.x, s.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const d of ['up', 'down', 'left', 'right']) {
        const nx = x + DV[d][0], ny = y + DV[d][1], k = nx + ',' + ny;
        if (prev.has(k) || !ok(nx, ny)) continue;
        prev.set(k, [x, y, d]);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(tx + ',' + ty)) return null;
    const dirs = [];
    for (let k = tx + ',' + ty; prev.get(k); ) { const p = prev.get(k); dirs.unshift(p[2]); k = p[0] + ',' + p[1]; }
    return dirs;
  }
  async function goto(tx, ty) {
    const map0 = st().map;
    for (let tries = 0; tries < 12; tries++) {
      const s = st();
      if (s.map !== map0) return 'warp: ' + fmt();
      if (s.x === tx && s.y === ty) return 'ok: ' + fmt();
      const dirs = bfs(tx, ty);
      if (!dirs) { await new Promise((r) => setTimeout(r, 500)); continue; }
      let n = 1;
      while (n < dirs.length && dirs[n] === dirs[0]) n++;
      const r = await walk(dirs[0], n);
      if (r.startsWith('warp') || r.startsWith('event')) return r;
      await new Promise((res) => setTimeout(res, 60));
    }
    return 'gave up: ' + fmt();
  }
  function tapZ() { down('KeyZ'); setTimeout(() => up('KeyZ'), 40); }
  // 条件が真になるまで Z を押し続ける
  function zUntil(cond, maxMs) {
    const t0 = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (cond()) { resolve('ok ' + (Date.now() - t0) + 'ms'); return; }
        if (Date.now() - t0 > (maxMs || 60000)) { resolve('timeout'); return; }
        tapZ();
        setTimeout(tick, 220);
      };
      tick();
    });
  }
  // バトル（＋前後の会話）が終わるまで進める。わざ選択では PP の残っている いちばん いりょくの高い わざを えらぶ
  function fight(maxMs) {
    const t0 = Date.now();
    let presses = 0, calm = 0, picks = 0;
    const bat = () => App.battle && App.battle.isActive();
    return new Promise((resolve) => {
      const tick = () => {
        if (Date.now() - t0 > (maxMs || 120000)) { resolve({ timeout: true, presses, picks }); return; }
        if (!bat() && !App.dialog.isOpen() && !st().busy) { if (++calm >= 3) { resolve({ timeout: false, presses, picks }); return; } } else calm = 0;
        const ds = bat() ? App.battle.debugState() : null;
        if (ds && ds.phase === 'moves' && ds.player) {
          let best = -1, bp = -1;
          ds.player.moves.forEach((m, i) => { const d = App.data.move(m.id); const p = d && m.pp > 0 ? (d.power || 0) : -1; if (p > bp) { bp = p; best = i; } });
          const cell = document.querySelector('#battle-layer .bt-move[data-index="' + best + '"]');
          if (cell) { cell.click(); picks++; }
        } else if (bat() || App.dialog.isOpen()) { tapZ(); presses++; }
        setTimeout(tick, 230);
      };
      tick();
    });
  }
  window.IT = { walk, path, goto, bfs, fmt, zUntil, tapZ, down, up, fight };
})();
