// =====================================================================
// バランスシミュレーター（tools/balance-sim.html から読み込む。ゲーム本体では使わない）
//   App.battleEngine で ジム・四天王・チャンピオンとの自動対戦を N 回くり返し、勝率を出す。
//   window.BalanceSim.run({ n, seed }) → { rows, league, parties, markdown }
// =====================================================================
(function () {
  'use strict';
  const App = window.App;
  const Eng = () => App.battleEngine;

  // ---- 相手（ジム1〜4 → 四天王 → チャンピオン） ----------------------
  const GYMS = [
    { id: 'kazami_leader', label: 'ジム1 フウカ', type: 'flying', size: 3 },
    { id: 'shiosai_leader', label: 'ジム2 ミナモ', type: 'water', size: 4 },
    { id: 'kanatoko_leader', label: 'ジム3 ゲンテツ', type: 'steel', size: 5 },
    { id: 'ikazuchi_leader', label: 'ジム4 ライカ', type: 'electric', size: 6 },
  ];
  const LEAGUE = [
    { id: 'league_yomi', label: '四天王1 ヨミ', type: 'ghost' },
    { id: 'league_goriki', label: '四天王2 ゴウリキ', type: 'fighting' },
    { id: 'league_hisame', label: '四天王3 ヒサメ', type: 'ice' },
    { id: 'league_kurobane', label: '四天王4 クロバネ', type: 'dark' },
    { id: 'league_champion', label: 'チャンピオン タツキ', type: 'dragon' },
  ];
  const PATTERNS = ['adv', 'even', 'dis', 'ur'];
  const PATTERN_NAMES = { adv: '有利', even: '普通', dis: '不利', ur: 'UR凸MAX入り普通' };

  // ---- 乱数（再現性のため seed 付き） -------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const lg2 = (x) => (x > 0 ? Math.log2(x) : -2);
  function bst(def) { const b = def.baseStats; return b.hp + b.atk + b.def + b.spa + b.spd + b.spe; }

  // ---- プレイヤー側の候補 ------------------------------------------
  // レベル L で使える最終形（進化Lvに達したぶんだけ進化させる）
  function evolveTo(id, L) {
    let cur = id;
    for (let i = 0; i < 5; i++) {
      const ev = App.data.evolutionOf(cur);
      if (!ev || ev.level > L) break;
      cur = ev.to;
    }
    return cur;
  }

  // わざ選び: 覚えられるこうげきわざから 威力×命中×タイプ一致 の高い順に、タイプが重ならないよう4つ
  function pickMoves(speciesId, L) {
    const inst = App.monster.create(speciesId, L);
    const def = App.data.monster(speciesId);
    const learn = App.monster.learnableMoves(inst);
    const scored = learn.map((id) => {
      const m = App.data.move(id);
      if (!m || m.category === 'status' || !(m.power > 0)) return null;
      const mh = (m.effects || []).find((e) => e && e.kind === 'multihit');
      const hits = mh ? ((mh.min || 2) + (mh.max || 5)) / 2 : 1;
      const acc = m.accuracy > 0 ? m.accuracy / 100 : 1;
      const stab = def.types.includes(m.type) ? 1.5 : 1;
      const recoil = (m.effects || []).some((e) => e && e.kind === 'recoil') ? 0.9 : 1;
      return { id, type: m.type, v: m.power * hits * acc * stab * recoil };
    }).filter(Boolean).sort((a, b) => b.v - a.v);
    const out = [];
    for (const s of scored) if (out.length < 4 && !out.some((o) => o.type === s.type)) out.push(s);
    for (const s of scored) if (out.length < 4 && !out.includes(s)) out.push(s);
    return out.map((s) => s.id);
  }

  function candidates(L, rarities) {
    const seen = {};
    const out = [];
    for (const def of App.data.monsters()) {
      if (def.gacha === false || !rarities.includes(def.rarity)) continue;
      const id = evolveTo(def.id, L);
      if (seen[id]) continue;
      seen[id] = true;
      const d = App.data.monster(id);
      out.push({ id, def: d, moves: pickMoves(id, L), bst: bst(d) });
    }
    return out;
  }

  // 専門タイプ T に対する相性スコア（攻め: わざの最大相性 / 守り: T わざを受ける相性）
  function matchup(c, T) {
    let off = 0;
    for (const mid of c.moves) {
      const m = App.data.move(mid);
      off = Math.max(off, App.data.typeEffect(m.type, [T]));
    }
    const offS = lg2(off);
    const defS = -lg2(App.data.typeEffect(T, c.def.types));
    return { off: offS, def: defS, score: offS + defS };
  }
  function matchupMulti(c, types) {
    const r = { off: 0, def: 0, score: 0, abs: 0, minDef: 9 };
    for (const T of types) {
      const m = matchup(c, T);
      r.off += m.off; r.def += m.def; r.score += m.score; r.abs += Math.abs(m.off) + Math.abs(m.def);
      r.minDef = Math.min(r.minDef, m.def);
    }
    return r;
  }

  // 素の強さ（相性抜き）: 最大わざの 威力×能力 × 耐久（HP×防御平均）
  function strength(c, L) {
    const st = App.monster.stats(App.monster.create(c.id, L));
    let off = 1;
    for (const mid of c.moves) {
      const m = App.data.move(mid);
      const stab = c.def.types.includes(m.type) ? 1.5 : 1;
      const acc = m.accuracy > 0 ? m.accuracy / 100 : 1;
      off = Math.max(off, m.power * stab * acc * (m.category === 'special' ? st.spa : st.atk));
    }
    return off * st.hp * (st.def + st.spd) / 2 * (1 + st.spe / 200);
  }

  // 相性クラスごとに 素の強さが高い順（プレイヤーは手持ちの強い子を使う想定）
  //   単タイプ（ジム）: スコア >= 1 有利 / 攻め守りとも等倍 普通 / <= -1 不利
  //   複数タイプ（リーグ5連戦）: 合計スコアの順位で 上位1/3 有利 / 中位 普通 / 下位 不利（合計は大半が正になるため相対評価）
  function buildParties(L, types, size) {
    const pool = candidates(L, ['N', 'R', 'SR']).map((c) => Object.assign(c, { m: matchupMulti(c, types), str: strength(c, L) }));
    if (types.length > 1) {
      const rank = pool.slice().sort((x, y) => (y.m.score - x.m.score) || (y.str - x.str));
      const n3 = Math.floor(rank.length / 3);
      rank.forEach((c, i) => { c.cls = i < n3 ? 'adv' : (i >= rank.length - n3 ? 'dis' : 'even'); });
    } else {
      pool.forEach((c) => { c.cls = c.m.score >= 1 ? 'adv' : (c.m.score <= -1 ? 'dis' : (c.m.abs === 0 ? 'even' : 'mix')); });
    }
    const pick = (inClass, fallback) => {
      const a = pool.filter(inClass).sort((x, y) => (y.str - x.str) || (x.id < y.id ? -1 : 1));
      const b = pool.filter((c) => !inClass(c)).sort(fallback);
      return { fixed: [], pool: a.concat(b).slice(0, Math.min(pool.length, size * 2)), size };
    };
    const adv = pick((c) => c.cls === 'adv', (x, y) => (y.m.score - x.m.score) || (y.str - x.str));
    const dis = pick((c) => c.cls === 'dis', (x, y) => (x.m.score - y.m.score) || (y.str - x.str));
    const even = pick((c) => c.cls === 'even', (x, y) => (Math.abs(x.m.score) - Math.abs(y.m.score)) || (y.str - x.str));
    // UR 凸MAX: いちばん相性が中立の UR を 普通パーティの いちばん弱い1体と入れ替える
    const urs = candidates(L, ['UR']).map((c) => Object.assign(c, { m: matchupMulti(c, types), limitBreak: maxLB() }));
    urs.sort((a, b) => (Math.abs(a.m.score) - Math.abs(b.m.score)) || (a.m.abs - b.m.abs) || (b.bst - a.bst));
    const ur = { fixed: [urs[0]], pool: even.pool, size };
    return { adv, even, dis, ur };
  }
  function maxLB() { return (GameData.gacha && GameData.gacha.maxLimitBreak) || 5; }

  // 候補から size 体を無作為に選ぶ（固定枠は必ず入れる）
  function sample(pt, rng) {
    const pool = pt.pool.slice();
    const out = pt.fixed.slice();
    while (out.length < pt.size && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  }
  function instantiate(list, L) {
    return list.map((c) => App.monster.create(c.id, L, { moves: c.moves, limitBreak: c.limitBreak || 0 }));
  }
  function enemyParty(trainerId) {
    const t = App.data.trainer(trainerId);
    return (t.party || []).map((p) => App.monster.create(p.species, p.level || 5, { moves: p.moves, limitBreak: p.limitBreak }));
  }

  // ---- プレイヤーの行動（期待ダメージ最大） --------------------------
  function expected(b, userBt, targetBt, move) {
    if (!move || move.category === 'status' || !(move.power > 0)) return 0;
    const r = Eng().calcDamage(userBt, targetBt, move, { crit: false, roll: 92 });
    if (r.effectiveness === 0) return 0;
    const mh = (move.effects || []).find((e) => e && e.kind === 'multihit');
    const hits = mh ? ((mh.min || 2) + (mh.max || 5)) / 2 : 1;
    const acc = move.accuracy > 0 ? Math.min(100, move.accuracy) / 100 : 1;
    return Math.min(r.damage * hits, Math.max(1, targetBt.inst.hp)) * acc;
  }
  function bestMove(b) {
    const P = b.player.battler, E = b.enemy.battler;
    let best = { index: -1, v: -1 };
    for (const i of Eng().usableMoveIndices(P.inst)) {
      const v = expected(b, P, E, Eng().moveOf(P.inst.moves[i].id));
      if (v > best.v) best = { index: i, v };
    }
    return { type: 'move', index: best.index };
  }
  // 控えの評価: 相手への最大期待ダメージ割合 − 相手からの最大期待ダメージ割合
  function switchScore(inst, foeInst) {
    const me = Eng().makeBattler(inst, 'player', 0), foe = Eng().makeBattler(foeInst, 'enemy', 0);
    let give = 0, take = 0;
    for (const s of inst.moves) if (s.pp > 0) give = Math.max(give, expected(null, me, foe, Eng().moveOf(s.id)) / Math.max(1, foeInst.hp));
    for (const s of foeInst.moves) {
      const m = Eng().moveOf(s.id);
      if (!m || m.category === 'status' || !(m.power > 0)) continue;
      const r = Eng().calcDamage(foe, me, m, { crit: false, roll: 92 });
      take = Math.max(take, r.damage / Math.max(1, inst.hp));
    }
    return Math.min(give, 1) - Math.min(take, 1);
  }
  function chooseSwitch(b, foeInst) {
    let best = -1, bv = -Infinity;
    b.player.party.forEach((p, i) => {
      if (!(p.hp > 0)) return;
      const v = switchScore(p, foeInst);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }

  // 1戦。playerParty の個体は HP/PP/状態を そのまま持ち越す（連戦用）
  function fight(playerParty, trainerId, rng) {
    const t = App.data.trainer(trainerId);
    const ep = enemyParty(trainerId);
    const tmp = { player: { party: playerParty } };
    const lead = chooseSwitch(tmp, ep[0]);
    const b = Eng().create({ kind: 'trainer', playerParty, enemyParty: ep, playerIndex: lead, ai: t.ai === 'random' ? 'random' : 'smart', rng });
    while (b.turn < 400) {
      Eng().resolveTurn(b, bestMove(b));
      const eDown = !(b.enemy.battler.inst.hp > 0);
      const pDown = !(b.player.battler.inst.hp > 0);
      if (pDown && window.BalanceSim.tally) { const k = trainerId + ':' + b.enemy.battler.inst.speciesId; BalanceSim.tally[k] = (BalanceSim.tally[k] || 0) + 1; }
      if (Eng().sideDefeated(b, 'player')) return { win: false, turns: b.turn };
      if (eDown && Eng().nextEnemyIndex(b) < 0) return { win: true, turns: b.turn };
      const nextFoe = eDown ? b.enemy.party[Eng().nextEnemyIndex(b)] : b.enemy.battler.inst;
      if (pDown) Eng().switchIn(b, 'player', chooseSwitch(b, nextFoe));
      if (eDown) Eng().switchIn(b, 'enemy', Eng().nextEnemyIndex(b));
    }
    return { win: false, turns: b.turn, timeout: true };
  }

  // ---- 実行 ---------------------------------------------------------
  function run(opts) {
    opts = opts || {};
    const n = opts.n || 200;
    const seed = opts.seed || 12345;
    const caps = App.data.config.levelCaps;
    const rows = [];
    const parties = {};
    const only = opts.only || null;   // ['kazami_leader', 'league'] など
    const want = (id) => !only || only.includes(id);

    GYMS.forEach((g, gi) => {
      if (!want(g.id)) return;
      const L = caps[gi];
      const ps = buildParties(L, [g.type], g.size);
      parties[g.id] = ps;
      const row = { id: g.id, label: g.label, cap: L };
      PATTERNS.forEach((pat, pi) => {
        const rng = mulberry32(seed + gi * 1000 + pi * 100000);
        let wins = 0, turns = 0, timeouts = 0;
        for (let i = 0; i < n; i++) {
          const r = fight(instantiate(sample(ps[pat], rng), L), g.id, rng);
          if (r.win) wins++;
          if (r.timeout) timeouts++;
          turns += r.turns;
        }
        row[pat] = { win: wins / n, turns: turns / n, timeouts };
      });
      rows.push(row);
    });

    let league = null;
    if (want('league')) {
      const L = caps[caps.length - 1];
      const ps = buildParties(L, LEAGUE.map((x) => x.type), 6);
      parties.league = ps;
      league = { cap: L, patterns: {} };
      PATTERNS.forEach((pat, pi) => {
        const rng = mulberry32(seed + 77 + pi * 100000);
        const reach = LEAGUE.map(() => 0), win = LEAGUE.map(() => 0), turns = LEAGUE.map(() => 0);
        const hpIn = LEAGUE.map(() => 0), ppIn = LEAGUE.map(() => 0);
        let clear = 0;
        for (let i = 0; i < n; i++) {
          const party = instantiate(sample(ps[pat], rng), L);
          let ok = true;
          for (let k = 0; k < LEAGUE.length && ok; k++) {
            reach[k]++;
            hpIn[k] += party.reduce((s, p) => s + Math.max(0, p.hp) / App.monster.stats(p).hp, 0) / party.length;
            ppIn[k] += party.reduce((s, p) => s + p.moves.reduce((a, m) => a + m.pp, 0) / Math.max(1, p.moves.reduce((a, m) => a + App.monster.maxPP(m.id), 0)), 0) / party.length;
            const r = fight(party, LEAGUE[k].id, rng);
            turns[k] += r.turns;
            if (r.win) win[k]++; else ok = false;
          }
          if (ok) clear++;
        }
        // 単発（全回復で その相手だけと戦う）の勝率も参考に出す
        const solo = LEAGUE.map((x, k) => {
          const rng2 = mulberry32(seed + 999 + k * 31 + pi * 100000);
          let w = 0;
          for (let i = 0; i < n; i++) if (fight(instantiate(sample(ps[pat], rng2), L), x.id, rng2).win) w++;
          return w / n;
        });
        league.patterns[pat] = {
          clear: clear / n,
          stages: LEAGUE.map((x, k) => ({ label: x.label, reach: reach[k] / n, cond: reach[k] ? win[k] / reach[k] : 0, turns: reach[k] ? turns[k] / reach[k] : 0, solo: solo[k], hpIn: reach[k] ? hpIn[k] / reach[k] : 0, ppIn: reach[k] ? ppIn[k] / reach[k] : 0 })),
        };
      });
    }
    const out = { n, seed, rows, league, parties: summarizeParties(parties) };
    out.markdown = toMarkdown(out);
    return out;
  }

  function summarizeParties(parties) {
    const o = {};
    Object.keys(parties).forEach((k) => {
      o[k] = {};
      PATTERNS.forEach((p) => {
        const pt = parties[k][p];
        o[k][p] = (pt.fixed.length ? ["固定:"] : []).concat(pt.fixed, ["候補" + pt.pool.length + "から" + (pt.size - pt.fixed.length) + "体:"], pt.pool).map((c) => typeof c === 'string' ? c : c.id + (c.limitBreak ? '+' + c.limitBreak : '') + '[' + c.moves.join(',') + ']');
      });
    });
    return o;
  }

  const pct = (v) => (v * 100).toFixed(1) + '%';
  function toMarkdown(r) {
    const L = [];
    L.push('N=' + r.n + ' seed=' + r.seed);
    if (r.rows.length) {
      L.push('', '| 相手 | 上限Lv | 有利 | 普通 | 不利 | UR凸MAX入り |', '|---|---|---|---|---|---|');
      r.rows.forEach((row) => {
        L.push('| ' + row.label + ' | ' + row.cap + ' | ' + PATTERNS.map((p) => pct(row[p].win) + ' (' + row[p].turns.toFixed(1) + 'T)' + (row[p].timeouts ? ' TO' + row[p].timeouts : '')).join(' | ') + ' |');
      });
    }
    if (r.league) {
      L.push('', '四天王→チャンピオン 5連戦（HP/PP持ち越し）: 通し勝率 / 各戦の勝率（到達した場合）/ 平均ターン / その戦の開始時の平均HP・PP残量 / 参考: 全回復で単発の勝率', '');
      L.push('| 相手 | 有利 | 普通 | 不利 | UR凸MAX入り |', '|---|---|---|---|---|');
      L.push('| **5連戦 通し** | ' + PATTERNS.map((p) => '**' + pct(r.league.patterns[p].clear) + '**').join(' | ') + ' |');
      r.league.patterns.adv.stages.forEach((s, k) => {
        L.push('| ' + s.label + ' | ' + PATTERNS.map((p) => {
          const st = r.league.patterns[p].stages[k];
          return pct(st.cond) + ' (' + st.turns.toFixed(1) + 'T, 開始時HP' + pct(st.hpIn) + ' PP' + pct(st.ppIn) + ', 単発' + pct(st.solo) + ')';
        }).join(' | ') + ' |');
      });
    }
    L.push('', 'パーティ:');
    Object.keys(r.parties).forEach((k) => PATTERNS.forEach((p) => L.push('- ' + k + ' ' + PATTERN_NAMES[p] + ': ' + r.parties[k][p].join(' '))));
    return L.join('\n');
  }

  // ---- 道中の整合チェック -------------------------------------------
  // town1 から warp をたどり、各マップに初めて入れるときの必要バッジ数を求める（warp.requireBadges と、
  // warp の近く（3マス以内）に立つ通せんぼ npc の requireBadges を考慮）。
  // そのマップの 野生の最大Lv / トレーナーの手持ちLv と、そのときのレベル上限を比べる。
  function routeCheck(startId) {
    const maps = GameData.maps;
    const caps = App.data.config.levelCaps;
    const need = {};
    need[startId || 'town1'] = 0;
    const queue = [startId || 'town1'];
    while (queue.length) {
      const id = queue.shift();
      const m = maps[id];
      if (!m) continue;
      const guards = (m.npcs || []).filter((n) => n.requireBadges);
      for (const w of m.warps || []) {
        let req = need[id];
        if (w.requireBadges) req = Math.max(req, w.requireBadges);
        for (const g of guards) if (Math.abs(g.x - w.x) + Math.abs(g.y - w.y) <= 3) req = Math.max(req, g.requireBadges);
        if (need[w.to] === undefined || req < need[w.to]) { need[w.to] = req; queue.push(w.to); }
      }
    }
    const rows = [];
    const issues = [];
    Object.keys(maps).forEach((id) => {
      const m = maps[id];
      const b = need[id];
      const cap = b === undefined ? null : caps[Math.min(b, caps.length - 1)];
      const enc = m.encounters && Array.isArray(m.encounters.table) ? m.encounters.table : [];
      const wildMax = enc.length ? Math.max(...enc.map((e) => e.max || e.min || 0)) : null;
      const trainers = (m.npcs || []).filter((n) => n.trainer).map((n) => {
        const t = App.data.trainer(n.trainer);
        const lv = t ? Math.max(...t.party.map((p) => p.level || 0)) : 0;
        return { id: n.trainer, max: lv, leader: !!(t && (t.badge || t.league)) };
      });
      if (!enc.length && !trainers.length) return;
      rows.push({ id, name: m.name, badges: b, cap, wildMax, trainers });
      if (cap === null) { issues.push(id + ': 到達できない'); return; }
      if (wildMax !== null && wildMax > cap) issues.push(id + ': 野生 Lv' + wildMax + ' > 上限' + cap);
      enc.forEach((e) => { if ((e.max || 0) > cap) issues.push(id + ':   ' + e.species + ' Lv' + e.min + '〜' + e.max); });
      trainers.forEach((t) => { if (t.max > cap) issues.push(id + ': トレーナー ' + t.id + ' Lv' + t.max + ' > 上限' + cap); });
    });
    const L = ['| マップ | 必要バッジ | 上限Lv | 野生最大Lv | トレーナー最大Lv |', '|---|---|---|---|---|'];
    rows.forEach((r) => L.push('| ' + r.id + ' ' + r.name + ' | ' + (r.badges === undefined ? '-' : r.badges) + ' | ' + (r.cap === null ? '-' : r.cap) + ' | ' + (r.wildMax === null ? '-' : r.wildMax) + ' | ' +
      (r.trainers.length ? r.trainers.map((t) => t.id + ':' + t.max).join(', ') : '-') + ' |'));
    L.push('', issues.length ? '上限超え: ' + issues.length + ' 件' : '上限超え: なし');
    issues.forEach((s) => L.push('- ' + s));
    return { rows, issues, markdown: L.join('\n') };
  }

  window.BalanceSim = { routeCheck, run, buildParties, candidates, matchupMulti, strength, fight, GYMS, LEAGUE, mulberry32 };
})();
