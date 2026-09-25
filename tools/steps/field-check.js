// field 担当のテスト補助（tools/steps/field-*.json から読み込む）。ゲーム本体では使わない。
//   FieldCheck.run() → { errors, warnings, info }
//   ワープの行き先・戻りワープ・開始位置・NPC/ピックアップ/看板の座標・到達可能性を調べる。
(function () {
  'use strict';
  const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  function run() {
    const errors = [];
    const warnings = [];
    const info = [];
    const maps = GameData.maps || {};
    const tile = (ch) => App.data.tile(ch) || { walk: false };
    const rowsOf = (m) => (m.tiles || []).map(String);
    const at = (m, x, y) => { const r = rowsOf(m); return y >= 0 && y < r.length && x >= 0 && x < r[y].length ? r[y][x] : null; };
    const walk = (m, x, y) => { const ch = at(m, x, y); return ch !== null && !!tile(ch).walk; };
    const key = (x, y) => x + ',' + y;

    // ---- 開始位置
    const ws = GameData.worldStart || {};
    if (!maps[ws.map]) errors.push('worldStart: 未知のマップ ' + ws.map);
    else if (!walk(maps[ws.map], ws.x, ws.y)) errors.push('worldStart: 歩けないマス ' + JSON.stringify(ws));

    // ---- マップごとの静的チェック
    const entries = {};   // mapId -> [{x,y,from}]
    Object.keys(maps).forEach((id) => { entries[id] = []; });
    if (maps[ws.map]) entries[ws.map].push({ x: ws.x, y: ws.y, from: 'worldStart' });

    Object.keys(maps).forEach((id) => {
      const m = maps[id];
      const npcTiles = {};
      (m.warps || []).forEach((w, i) => {
        const tag = id + '.warps[' + i + ']';
        if (!walk(m, w.x, w.y)) errors.push(tag + ': ワープのマスが歩けない (' + w.x + ',' + w.y + ') "' + at(m, w.x, w.y) + '"');
        const t = maps[w.to];
        if (!t) { errors.push(tag + ': 未知の行き先 ' + w.to); return; }
        if (!walk(t, w.tx, w.ty)) errors.push(tag + ': 行き先が範囲外/歩けない ' + w.to + '(' + w.tx + ',' + w.ty + ') "' + at(t, w.tx, w.ty) + '"');
        if ((t.warps || []).some((b) => b.x === w.tx && b.y === w.ty)) errors.push(tag + ': 行き先がワープマスの上 ' + w.to + '(' + w.tx + ',' + w.ty + ')');
        if (!(t.warps || []).some((b) => b.to === id)) errors.push(tag + ': 戻りワープがない ' + w.to + ' → ' + id);
        if ((t.npcs || []).some((n) => n.x === w.tx && n.y === w.ty)) errors.push(tag + ': 行き先に NPC がいる');
        entries[w.to].push({ x: w.tx, y: w.ty, from: tag });
      });
      (m.npcs || []).forEach((n, i) => {
        const tag = id + '.npcs[' + i + '](' + n.id + ')';
        if (at(m, n.x, n.y) === null) { errors.push(tag + ': 範囲外'); return; }
        if (!walk(m, n.x, n.y)) warnings.push(tag + ': 歩けないマスの上に立っている "' + at(m, n.x, n.y) + '"');
        if ((m.warps || []).some((w) => w.x === n.x && w.y === n.y)) errors.push(tag + ': ワープの上');
        if (npcTiles[key(n.x, n.y)]) errors.push(tag + ': 他の NPC と重なっている');
        npcTiles[key(n.x, n.y)] = n;
        if (n.trainer && !App.data.trainer(n.trainer)) errors.push(tag + ': 未知のトレーナー ' + n.trainer);
      });
      (m.pickups || []).forEach((p, i) => {
        const tag = id + '.pickups[' + i + '](' + p.id + ')';
        if (!walk(m, p.x, p.y)) errors.push(tag + ': 歩けないマス/範囲外 "' + at(m, p.x, p.y) + '"');
        if (npcTiles[key(p.x, p.y)]) errors.push(tag + ': NPC と重なっている');
        if ((m.warps || []).some((w) => w.x === p.x && w.y === p.y)) errors.push(tag + ': ワープの上');
      });
      (m.signs || []).forEach((s, i) => {
        const ch = at(m, s.x, s.y);
        if (ch === null) errors.push(id + '.signs[' + i + ']: 範囲外');
        else if (tile(ch).walk) warnings.push(id + '.signs[' + i + ']: 看板が歩けるマスにある "' + ch + '"');
      });
    });

    // ---- 到達可能性（マップ内 BFS。NPC は通れない。hideAfter NPC は撃破後いなくなるので通れる扱い）
    const reach = {};
    Object.keys(maps).forEach((id) => {
      const m = maps[id];
      const block = {};
      (m.npcs || []).forEach((n) => { if (!n.hideAfter) block[key(n.x, n.y)] = true; });
      const seen = {};
      const q = [];
      entries[id].forEach((e) => { if (walk(m, e.x, e.y) && !seen[key(e.x, e.y)]) { seen[key(e.x, e.y)] = true; q.push([e.x, e.y]); } });
      const warpSet = {};
      (m.warps || []).forEach((w) => { warpSet[key(w.x, w.y)] = true; });
      while (q.length) {
        const [x, y] = q.shift();
        if (warpSet[key(x, y)] && !entries[id].some((e) => e.x === x && e.y === y)) continue;   // ワープに乗ったら移動する
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (seen[k] || !walk(m, nx, ny) || block[k]) continue;
          seen[k] = true;
          q.push([nx, ny]);
        }
      }
      reach[id] = seen;
      if (!entries[id].length) errors.push(id + ': どこからも入れない（入口のワープがない）');
      // 各入口から出口（ワープ）に行けるか
      entries[id].forEach((e) => {
        const s2 = {}; const q2 = [[e.x, e.y]]; s2[key(e.x, e.y)] = true; let exit = false;
        while (q2.length && !exit) {
          const [x, y] = q2.shift();
          for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy, k = key(nx, ny);
            if (s2[k] || !walk(m, nx, ny) || block[k]) continue;
            if (warpSet[k]) { exit = true; break; }
            s2[k] = true; q2.push([nx, ny]);
          }
        }
        if (!exit && (m.warps || []).length) errors.push(id + ': 入口 (' + e.x + ',' + e.y + ') [' + e.from + '] から出口に行けない（閉じ込め）');
      });
      (m.warps || []).forEach((w, i) => { if (!seen[key(w.x, w.y)]) warnings.push(id + '.warps[' + i + '] (' + w.x + ',' + w.y + ') に到達できない'); });
      (m.pickups || []).forEach((p) => { if (!seen[key(p.x, p.y)]) errors.push(id + ': ピックアップ ' + p.id + ' に到達できない'); });
      const canFace = (x, y) => DIRS.some(([dx, dy]) => {
        if (seen[key(x + dx, y + dy)]) return true;
        const mid = at(m, x + dx, y + dy);
        return mid !== null && tile(mid).counter && seen[key(x + dx * 2, y + dy * 2)];
      });
      (m.npcs || []).forEach((n) => { if (!canFace(n.x, n.y)) errors.push(id + ': NPC ' + n.id + ' に話しかけられない'); });
      (m.signs || []).forEach((s) => { if (!canFace(s.x, s.y)) errors.push(id + ': 看板 (' + s.x + ',' + s.y + ') を読めない'); });
      // 草むら/洞窟で encounters が無いマップ
      const hasEnc = rowsOf(m).some((r) => Array.from(r).some((ch) => tile(ch).encounter));
      if (hasEnc && !(m.encounters && m.encounters.table && m.encounters.table.length)) warnings.push(id + ': エンカウントタイルがあるが encounters が無い');
      info.push(id + ': ' + Object.keys(seen).length + ' マス到達可能');
    });

    // ---- マップ間の到達（worldStart から）
    const vis = {}; const mq = [ws.map]; vis[ws.map] = true;
    while (mq.length) {
      const id = mq.shift();
      (maps[id].warps || []).forEach((w) => {
        if (reach[id] && reach[id][key(w.x, w.y)] && maps[w.to] && !vis[w.to]) { vis[w.to] = true; mq.push(w.to); }
      });
    }
    Object.keys(maps).forEach((id) => { if (!vis[id]) errors.push(id + ': 開始位置から到達できないマップ'); });
    return { errors, warnings, info };
  }

  // ---- 入力補助（App.input が拾う合成キーイベント）
  const KEYS = { KeyZ: 'z', KeyX: 'x', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  function down(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: KEYS[code] || code, bubbles: true })); }
  function up(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, key: KEYS[code] || code, bubbles: true })); }
  function tap(code) { down(code); setTimeout(() => up(code), 40); }
  const dlg = () => App.dialog.isOpen();
  const bat = () => !!(App.battle && App.battle.isActive());
  // 会話ウィンドウが開いている間だけ Z を押し続け、閉じて落ち着いたら終わる
  function drain(maxMs) {
    return waitLoop(maxMs || 20000, () => dlg(), () => !dlg() && !App.field.isBusy());
  }
  // バトル（＋その後の会話）が終わるまで Z を押し続ける
  function mash(maxMs) {
    return waitLoop(maxMs || 120000, () => bat() || dlg(), () => !bat() && !dlg() && !App.field.isBusy());
  }
  function waitLoop(maxMs, shouldPress, isDone) {
    const t0 = Date.now();
    let presses = 0;
    let calm = 0;
    return new Promise((resolve) => {
      const tick = () => {
        if (Date.now() - t0 > maxMs) { resolve({ timeout: true, presses }); return; }
        if (isDone()) { calm += 1; if (calm >= 3) { resolve({ timeout: false, presses }); return; } } else calm = 0;
        if (shouldPress()) { tap('KeyZ'); presses++; }
        setTimeout(tick, 230);
      };
      tick();
    });
  }
  function st() {
    const s = App.field.debug.state();
    return [s.map, s.x, s.y, s.dir, s.busy ? 'busy' : 'idle'].join(' ');
  }

  window.FieldCheck = { run, down, up, tap, drain, mash, st };
})();
