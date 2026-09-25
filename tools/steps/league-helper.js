// バッジ・レベル上限・リーグ（SPEC 11）のテスト補助。tools/steps/league-*.json から読み込む。ゲーム本体では使わない。
(function () {
  'use strict';
  const results = [];
  function ok(cond, name, detail) {
    results.push({ ok: !!cond, name, detail: detail === undefined ? '' : detail });
    if (!cond) console.error('[league-test] NG: ' + name + ' ' + (detail === undefined ? '' : JSON.stringify(detail)));
  }
  const S = () => App.state;
  const M = () => App.monster;
  const today = () => App.util.today();
  function summary() {
    const ng = results.filter((r) => !r.ok);
    return (ng.length ? 'NG ' + ng.length + ': ' + ng.map((r) => r.name).join(', ') : 'ALL OK') + ' (' + results.length + ' checks)';
  }

  // 進化しない・進化形でもない種（レベルだけ見たいテスト用）
  function plainSpecies(skip) {
    const m = App.data.monsters().find((d) => !d.evolution && !App.data.preEvolutionOf(d.id) && d.gacha !== false && !(skip || []).includes(d.id));
    return m && m.id;
  }

  // 一時トレーナー（league / badge）。GameData.trainers に直接差し込む
  function injectTrainers(opts) {
    opts = opts || {};
    const sp = opts.species || plainSpecies();
    const lv = opts.level || 2;
    // 本物のデータの league / badge: 'wind' は一時的に外す（重複警告を避ける。メモリ上のみ）
    Object.keys(GameData.trainers).forEach((id) => {
      const t = GameData.trainers[id];
      if (/^lt_/.test(id) || !t) return;
      if (t.league) delete t.league;
      if (t.badge === 'wind') delete t.badge;
    });
    const mk =(id, name, extra) => {
      GameData.trainers[id] = Object.assign({
        name, className: 'テスト', party: [{ species: sp, level: lv }], reward: 10,
        intro: ['しょうぶだ！'], lose: ['まけた…'], win: ['かった！'],
      }, extra || {});
    };
    mk('lt_gym', 'ジムテスト', { className: 'ジムリーダー', badge: 'wind', reward: 100, party: [{ species: sp, level: lv, limitBreak: 3 }] });
    ['してんのう1', 'してんのう2', 'してんのう3', 'してんのう4', 'チャンピオン'].forEach((n, i) => mk('lt_l' + (i + 1), n, { league: i + 1 }));
    return sp;
  }

  function unit() {
    results.length = 0;
    const cfg = GameData.config;
    const caps = cfg.levelCaps;
    const events = [];
    const off = App.events.on('badges:changed', (p) => events.push(p));

    // ---- levelCap / giveBadge
    S().data.badges = {};
    ok(S().badgeCount() === 0 && S().levelCap() === caps[0], 'levelCap 0 badges', S().levelCap());
    ok(S().giveBadge('nope') === false, 'giveBadge unknown → false');
    ok(S().giveBadge('wind') === true && S().hasBadge('wind') && S().levelCap() === caps[1], 'giveBadge wind → cap ' + caps[1], S().levelCap());
    ok(S().giveBadge('wind') === false && S().badgeCount() === 1, 'giveBadge duplicate → false');
    ok(S().data.badges.wind === today() && S().badgeDate('wind') === today(), 'badge date', S().data.badges);
    ok(events.length === 1 && events[0].badgeId === 'wind' && events[0].capBefore === caps[0] && events[0].cap === caps[1], 'badges:changed event', events);
    S().giveBadge('iron');
    ok(S().badgeCount() === 2 && S().levelCap() === caps[2] && S().badges().join() === 'wind,iron', 'badges() order', S().badges());
    GameData.badges.forEach((b) => S().giveBadge(b.id));
    ok(S().badgeCount() === 4 && S().levelCap() === caps[4], 'all badges → cap ' + caps[4], S().levelCap());
    S().data.badges.ghost = '2026-01-01';
    ok(S().badgeCount() === 4, 'unknown badge id not counted');
    S().removeBadge('spark');
    ok(S().badgeCount() === 3 && S().levelCap() === caps[3], 'removeBadge → cap ' + caps[3]);
    S().data.badges = {};
    ok(S().levelCap() === caps[0], 'cap reset');

    // ---- catchUpMult（上限 − Lv が below 以上）
    const cu = M().catchUpMult;
    ok(cu(5, 20) === 3 && cu(6, 20) === 2 && cu(10, 20) === 2 && cu(11, 20) === 1.5 && cu(15, 20) === 1.5 && cu(16, 20) === 1 && cu(20, 20) === 1 && cu(25, 20) === 1,
      'catchUpMult table', [cu(5, 20), cu(6, 20), cu(10, 20), cu(11, 20), cu(15, 20), cu(16, 20), cu(20, 20), cu(25, 20)]);

    // ---- addExp cap / overflow
    const sp = plainSpecies();
    const g = App.data.monster(sp).expGroup || 'medium_fast';
    const a = M().create(sp, 18);
    const need = M().expForLevel(20, g) - a.exp;
    let r = M().addExp(a, need + 123, { cap: 20 });
    ok(a.level === 20 && r.levelsGained === 2 && r.overflow === 123 && r.capped === true && a.exp === M().expForLevel(20, g), 'addExp stops at cap with overflow', { lv: a.level, of: r.overflow, exp: a.exp });
    r = M().addExp(a, 77, { cap: 20 });
    ok(a.level === 20 && r.levelsGained === 0 && r.overflow === 77 && a.exp === M().expForLevel(20, g), 'addExp at cap → all overflow', r.overflow);
    ok(M().expProgress(a, 20) === 1 && M().expToNext(a, 20) === 0 && M().expProgress(a) === 0, 'expProgress/expToNext with cap');
    r = M().addExp(a, M().expForLevel(21, g) - a.exp + 5, { cap: 30 });
    ok(a.level === 21 && r.overflow === 0 && r.capped === false, 'cap raised → levels again', { lv: a.level, of: r.overflow });
    const b = M().create(sp, 10);
    r = M().addExp(b, 10);
    ok(r.overflow === 0 && r.capped === false, 'addExp without cap: overflow 0');
    const c = M().create(sp, 25);
    r = M().addExp(c, 50, { cap: 20 });
    ok(c.level === 25 && r.overflow === 50, 'above cap (old save) keeps level, all overflow');
    const d = M().create(sp, cfg.maxLevel);
    r = M().addExp(d, 40);
    ok(r.overflow === 40 && d.level === cfg.maxLevel, 'maxLevel overflow');
    const e = M().create(sp, 5, { limitBreak: 3 });
    ok(e.limitBreak === 3, 'create with limitBreak');

    // ---- あふれ経験値 → pt（1日上限）
    const per = cfg.overflowExpPerPoint;
    const max = cfg.overflowDailyMax;
    delete S().data.flags.overflowPts;
    let p0 = S().points();
    ok(S().addOverflowExp(per + 20) === 1 && S().points() === p0 + 1 && S().data.flags.overflowPts.rest === 20, 'overflow 1pt + rest', S().data.flags.overflowPts);
    ok(S().addOverflowExp(per - 20) === 1 && S().data.flags.overflowPts.rest === 0 && S().overflowPtsToday() === 2, 'rest carried', S().data.flags.overflowPts);
    S().data.flags.overflowPts = { date: today(), pts: max - 3, rest: 0 };
    p0 = S().points();
    ok(S().addOverflowExp(per * 10) === 3 && S().points() === p0 + 3 && S().overflowPtsToday() === max, 'daily max clamps', S().data.flags.overflowPts);
    ok(S().addOverflowExp(per * 10) === 0 && S().points() === p0 + 3, 'daily max reached → 0');
    S().data.flags.overflowPts = { date: '2000-01-01', pts: max, rest: 0 };
    ok(S().overflowPtsToday() === 0 && S().addOverflowExp(per * 2) === 2, 'new day resets');
    delete S().data.flags.overflowPts;

    // ---- resetLeague / champion
    injectTrainers();
    GameData.trainers.lt_other = { name: 'ふつう', party: [{ species: sp, level: 2 }] };
    ['lt_l1', 'lt_l2', 'lt_l3', 'lt_other', 'lt_gym'].forEach((id) => S().setTrainerDefeated(id));
    const cleared = S().resetLeague();
    ok(cleared.sort().join() === 'lt_l1,lt_l2,lt_l3' && !S().isTrainerDefeated('lt_l1') && S().isTrainerDefeated('lt_other') && S().isTrainerDefeated('lt_gym'), 'resetLeague clears league only', cleared);
    ok(!S().isChampion(), 'not champion');
    ok(S().setChampion() === true && S().isChampion() && typeof S().flag('champion') === 'number', 'setChampion first');
    const at = S().flag('champion');
    ok(S().setChampion() === false && S().flag('champion') === at && S().flag('championCount') === 2, 'setChampion again keeps first date');
    S().clearChampion();
    ok(!S().isChampion(), 'clearChampion');

    // ---- セーブの補完（badges が無い古いセーブ）
    const old = JSON.parse(S().exportJSON());
    delete old.badges;
    S().importJSON(JSON.stringify(old));
    ok(S().data.badges && typeof S().data.badges === 'object' && S().badgeCount() === 0 && S().levelCap() === caps[0], 'load old save → badges {}');
    old.badges = { wind: '2026-09-01', wave: 5 };
    S().importJSON(JSON.stringify(old));
    ok(S().badgeCount() === 1 && !('wave' in S().data.badges), 'sanitize invalid badge value', S().data.badges);
    S().data.badges = {};

    // ---- validate
    const base = App.data.validate();
    const T = GameData.trainers;
    T.lt_bad1 = { name: 'x', badge: 'nope', party: [{ species: sp, level: 2, limitBreak: 99 }] };
    T.lt_bad2 = { name: 'y', badge: 'wind', party: [{ species: sp, level: 2 }] };
    T.lt_bad3 = { name: 'z', league: 7, party: [{ species: sp, level: 2 }] };
    delete T.lt_l3;
    T.lt_dup = { name: 'w', league: 2, party: [{ species: sp, level: 2 }] };
    const mapId = Object.keys(GameData.maps)[0];
    const mp = GameData.maps[mapId];
    const savedWarps = mp.warps;
    const savedNpcs = mp.npcs;
    mp.warps = (savedWarps || []).concat([{ x: 0, y: 0, to: mapId, tx: 0, ty: 0, requireTrainer: 'nobody', requireBadges: 9 }]);
    mp.npcs = (savedNpcs || []).concat([{ id: 'lt_npc', x: 1, y: 0, requireBadges: -1 }]);
    const v = App.data.validate();
    mp.warps = savedWarps;
    mp.npcs = savedNpcs;
    const has = (list, re) => list.some((m) => re.test(m));
    const newE = v.errors.filter((m) => !base.errors.includes(m));
    const newW = v.warnings.filter((m) => !base.warnings.includes(m));
    ok(has(newE, /lt_bad1.*バッジ "nope"/), 'validate: unknown badge', newE);
    ok(has(newE, /lt_bad2.*バッジ "wind".*lt_gym/), 'validate: duplicate badge', newE);
    ok(has(newE, /lt_bad3.*league/), 'validate: league range', newE);
    ok(has(newW, /リーグ.*3番目/), 'validate: league missing', newW);
    ok(has(newW, /リーグ.*2番目.*重複/), 'validate: league duplicate', newW);
    ok(has(newW, /lt_bad1.*limitBreak/), 'validate: limitBreak range', newW);
    ok(has(newE, /requireTrainer "nobody"/), 'validate: requireTrainer ref', newE);
    ok(has(newW, /requireBadges 9/) && has(newW, /lt_npc.*requireBadges/), 'validate: requireBadges range', newW);
    ['lt_bad1', 'lt_bad2', 'lt_bad3', 'lt_dup', 'lt_other'].forEach((id) => delete T[id]);
    injectTrainers();
    const v2 = App.data.validate();
    ok(!v2.warnings.some((m) => /リーグ/.test(m)) && !v2.errors.some((m) => /lt_/.test(m)), 'validate: clean temp league', v2.errors.concat(v2.warnings).filter((m) => /lt_|リーグ/.test(m)));

    off && off();
    return summary();
  }

  // 条件が真になるまで バトル（＋会話）を進める。わざは いちばん いりょくの高いもの
  function fightUntil(cond, maxMs) {
    const t0 = Date.now();
    const bat = () => App.battle && App.battle.isActive();
    return new Promise((resolve) => {
      const tick = () => {
        if (cond && cond()) { resolve('hit ' + (Date.now() - t0) + 'ms'); return; }
        if (Date.now() - t0 > (maxMs || 60000)) { resolve('timeout'); return; }
        if (!cond && !bat() && !App.dialog.isOpen() && !App.field.isBusy()) { resolve('done'); return; }
        const ds = bat() ? App.battle.debugState() : null;
        if (ds && ds.phase === 'moves' && ds.player) {
          let best = -1, bp = -1;
          ds.player.moves.forEach((m, i) => { const dd = App.data.move(m.id); const pw = dd && m.pp > 0 ? (dd.power || 0) : -1; if (pw > bp) { bp = pw; best = i; } });
          const cell = document.querySelector('#battle-layer .bt-move[data-index="' + best + '"]');
          if (cell) cell.click();
        } else if (bat() || App.dialog.isOpen()) IT.tapZ();
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  // バトルのメッセージ履歴を集める
  const log = [];
  let logT = null;
  function startLog() {
    log.length = 0;
    clearInterval(logT);
    logT = setInterval(() => {
      const s = App.battle.debugState();
      if (s.active && s.text && log[log.length - 1] !== s.text) log.push(s.text);
      const dl = document.querySelector('#dialog-layer');
      const tx = dl && App.dialog.isOpen() ? dl.textContent.trim() : '';
      if (tx && log[log.length - 1] !== tx) log.push('[dlg] ' + tx);
    }, 40);
    return 'logging';
  }
  function logHas(re) { return log.some((t) => re.test(t)); }

  // 現在のマップに requireBadges のワープ（プレイヤーの隣）と 通せんぼNPC を一時的に追加する
  function setupGate(needWarp, needNpc) {
    const s = App.field.debug.state();
    const m = GameData.maps[s.map];
    const rows = m.tiles.map(String);
    const walk = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && !!(GameData.tiles[rows[y][x]] || {}).walk;
    const used = (x, y) => (m.warps || []).some((w) => w.x === x && w.y === y) || (m.npcs || []).some((n) => n.x === x && n.y === y)
      || (m.signs || []).some((n) => n.x === x && n.y === y) || (m.pickups || []).some((n) => n.x === x && n.y === y);
    const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const dir = Object.keys(DV).find((d) => { const [dx, dy] = DV[d]; return walk(s.x + dx, s.y + dy) && !used(s.x + dx, s.y + dy); });
    const [dx, dy] = DV[dir];
    const wx = s.x + dx, wy = s.y + dy;
    const dest = (m.warps || [])[0];
    m.warps = (m.warps || []).concat([{ x: wx, y: wy, to: dest.to, tx: dest.tx, ty: dest.ty, requireBadges: needWarp }]);
    let npc = null;
    for (let y = 0; y < rows.length && !npc; y++) {
      for (let x = 0; x < rows[0].length && !npc; x++) {
        if (walk(x, y) && !used(x, y) && !(x === s.x && y === s.y) && !(x === wx && y === wy)) npc = { id: 'lt_block', x, y, dir: 'down', requireBadges: needNpc, dialog: ['バッジが たりないと ここは とおさないよ'] };
      }
    }
    m.npcs = (m.npcs || []).concat([npc]);
    App.field.debug.teleport(s.map, s.x, s.y, s.dir);
    return { map: s.map, x: s.x, y: s.y, dir, warp: [wx, wy], dest: [dest.to, dest.tx, dest.ty], npc: [npc.x, npc.y] };
  }
  function npcHidden(id) { const n = App.field.debug.state().npcs.find((x) => x.id === id); return n ? n.hidden : 'none'; }

  window.LT = { setupGate, npcHidden, unit, results, ok, summary, plainSpecies, injectTrainers, fightUntil, startLog, log, logHas };
})();
