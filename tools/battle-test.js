// battle 担当のテスト補助（tools/steps/battle-*.json から読み込む）。ゲーム本体では使わない。
(function () {
  'use strict';
  const results = [];
  function ok(cond, name, detail) {
    results.push({ ok: !!cond, name, detail: detail === undefined ? '' : detail });
    if (!cond) console.error('[battle-test] NG: ' + name + ' ' + (detail === undefined ? '' : JSON.stringify(detail)));
  }
  const constRng = (v) => () => v;
  function seqRng(list, fallback) {
    let i = 0;
    return () => (i < list.length ? list[i++] : (fallback === undefined ? 0.5 : fallback));
  }
  function mk(species, level, moves) {
    return App.monster.create(species, level, moves ? { moves } : undefined);
  }
  function battle(p, e, opts) {
    return App.battleEngine.create(Object.assign({
      kind: 'wild', playerParty: Array.isArray(p) ? p : [p], enemyParty: Array.isArray(e) ? e : [e], ai: 'random', rng: constRng(0.99),
    }, opts || {}));
  }
  function findSpecies(pred) { return App.data.monsters().find(pred); }
  function findMove(pred) {
    const all = GameData.moves;
    const id = Object.keys(all).find((k) => pred(all[k], k));
    return id || null;
  }

  function engine() {
    results.length = 0;
    const E = App.battleEngine;
    const cfg = GameData.config;

    // ---- ランク補正・急所率
    ok(E.stageMult(0) === 1 && E.stageMult(1) === 1.5 && E.stageMult(-1) === 2 / 3 && E.stageMult(6) === 4 && E.stageMult(-6) === 0.25, 'stageMult');
    ok(E.accStageMult(1) === 4 / 3 && E.accStageMult(-1) === 0.75 && E.accStageMult(6) === 3, 'accStageMult');
    ok(E.critRate(0) === cfg.critChance && E.critRate(1) === 1 / 8 && E.critRate(2) === 1 / 4 && E.critRate(3) === 1 / 2 && E.critRate(5) === 1 / 2, 'critRate');

    // ---- ダメージ式（手計算）
    // L10 威力40 A20 D15: floor(2*10/5+2)=6 → floor(6*40*20/15)=320 → floor(320/50)=6 → +2 = 8
    ok(E.damageFormula({ level: 10, power: 40, atk: 20, def: 15, roll: 100, effect: 1 }) === 8, 'dmg base 8');
    ok(E.damageFormula({ level: 10, power: 40, atk: 20, def: 15, roll: 100, effect: 1, stab: true }) === 12, 'dmg stab 12');
    ok(E.damageFormula({ level: 10, power: 40, atk: 20, def: 15, roll: 100, effect: 2 }) === 16, 'dmg x2 16');
    // 急所 8→12, 乱数85% 12→10, 一致 10→15, ばつぐん 15→30, やけど 30→15
    ok(E.damageFormula({ level: 10, power: 40, atk: 20, def: 15, roll: 85, effect: 2, stab: true, crit: true }) === 30, 'dmg crit+roll85+stab+x2 = 30');
    ok(E.damageFormula({ level: 10, power: 40, atk: 20, def: 15, roll: 85, effect: 2, stab: true, crit: true, burn: true }) === 15, 'dmg burn = 15');
    // L50 威力90 A120 D100: 22*90*120/100=2376 → 47 → 49 → 一致 73 → 半減 36
    ok(E.damageFormula({ level: 50, power: 90, atk: 120, def: 100, roll: 100, effect: 0.5, stab: true }) === 36, 'dmg L50 = 36');
    ok(E.damageFormula({ level: 50, power: 90, atk: 120, def: 100, roll: 100, effect: 0 }) === 0, 'dmg immune = 0');
    ok(E.damageFormula({ level: 1, power: 10, atk: 1, def: 999, roll: 85, effect: 0.25 }) === 1, 'dmg min 1');

    // ---- 実モンスターでの calcDamage（ひのこ: ヒノコン→ミズピョン）
    {
      const a = mk('hinokon', 10), d = mk('mizupyon', 10);
      const b = battle(a, d);
      const sa = App.monster.stats(a), sd = App.monster.stats(d);
      const mv = E.moveOf('ember');
      const r = E.calcDamage(b.player.battler, b.enemy.battler, mv, { crit: false, roll: 100 });
      const L = 10;
      let exp = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * mv.power * sa.spa / sd.spd) / 50) + 2;
      exp = Math.floor(exp * cfg.stab);
      exp = Math.floor(exp * 0.5);
      ok(r.damage === Math.max(1, exp) && r.stab === true && r.effectiveness === 0.5, 'calcDamage ember hinokon→mizupyon', { got: r.damage, exp });
      // ランク +2 で攻撃側 A が 2倍
      b.player.battler.stages.spa = 2;
      const r2 = E.calcDamage(b.player.battler, b.enemy.battler, mv, { crit: false, roll: 100 });
      ok(r2.atk === Math.floor(sa.spa * 2), 'calcDamage stage +2', r2.atk);
      // 急所時は攻撃側のマイナスランク・防御側のプラスランクを無視
      b.player.battler.stages.spa = -2; b.enemy.battler.stages.spd = 3;
      const r3 = E.calcDamage(b.player.battler, b.enemy.battler, mv, { crit: true, roll: 100 });
      ok(r3.atk === sa.spa && r3.def === sd.spd, 'crit ignores bad stages', { atk: r3.atk, def: r3.def });
      const r4 = E.calcDamage(b.player.battler, b.enemy.battler, mv, { crit: false, roll: 100 });
      ok(r4.atk === Math.floor(sa.spa / 2) && r4.def === Math.floor(sd.spd * 2.5), 'no-crit uses stages', { atk: r4.atk, def: r4.def });
      // やけどで物理半減
      b.player.battler.stages.spa = 0; b.enemy.battler.stages.spd = 0;
      const tackle = E.moveOf('tackle');
      const n1 = E.calcDamage(b.player.battler, b.enemy.battler, tackle, { crit: false, roll: 100 }).damage;
      a.status = 'burn';
      const n2 = E.calcDamage(b.player.battler, b.enemy.battler, tackle, { crit: false, roll: 100 }).damage;
      ok(n2 === Math.max(1, Math.floor(n1 / 2)) || n2 === Math.max(1, Math.floor(E.damageFormula({ level: 10, power: 40, atk: App.monster.stats(a).atk, def: sd.def, roll: 100, effect: 1 }) / 2)), 'burn halves physical', { n1, n2 });
      a.status = null;
    }

    // ---- タイプ相性
    ok(E.typeEffect('fire', ['grass']) === 2, 'fire→grass 2');
    ok(E.typeEffect('water', ['fire']) === 2, 'water→fire 2');
    ok(E.typeEffect('electric', ['ground']) === 0, 'electric→ground 0');
    ok(E.typeEffect('normal', ['ghost']) === 0, 'normal→ghost 0');
    ok(E.typeEffect('fire', ['grass', 'steel']) === 4, 'fire→grass/steel 4');
    ok(E.typeEffect('fire', ['water', 'rock']) === 0.25, 'fire→water/rock 0.25');
    ok(E.typeEffect(null, ['ghost']) === 1, 'typeless (struggle) 1');

    // ---- 状態異常の免疫
    {
      const fireMon = findSpecies((m) => m.types.includes('fire'));
      const steelMon = findSpecies((m) => m.types.includes('steel'));
      const poisonMon = findSpecies((m) => m.types.includes('poison'));
      const elecMon = findSpecies((m) => m.types.includes('electric'));
      const iceMon = findSpecies((m) => m.types.includes('ice'));
      const normalMon = findSpecies((m) => m.types.length === 1 && m.types[0] === 'normal');
      const check = (sp, status, expectImmune) => {
        if (!sp) { ok(false, 'species for ' + status + ' missing'); return; }
        const b = battle(mk('hinokon', 10), mk(sp.id, 10));
        const ev = [];
        E.tryInflict(b, 'enemy', status, ev, {});
        const got = b.enemy.battler.inst.status;
        ok(expectImmune ? got === null : got === status, 'immune ' + status + ' vs ' + sp.id + ' (' + sp.types.join('/') + ')', { got, ev: ev.map((e) => e.text) });
      };
      check(fireMon, 'burn', true);
      check(steelMon, 'poison', true);
      check(poisonMon, 'poison', true);
      check(elecMon, 'paralyze', true);
      check(iceMon, 'freeze', true);
      check(normalMon, 'burn', false);
      check(normalMon, 'sleep', false);
      // 既に状態異常なら上書きしない
      const b = battle(mk('hinokon', 10), mk(normalMon.id, 10));
      b.enemy.battler.inst.status = 'poison';
      E.tryInflict(b, 'enemy', 'paralyze', [], {});
      ok(b.enemy.battler.inst.status === 'poison', 'no overwrite status');
      // ねむりは 1〜3 ターン
      const turns = new Set();
      for (const v of [0, 0.34, 0.67, 0.99]) {
        const bb = battle(mk('hinokon', 10), mk(normalMon.id, 10), { rng: constRng(v) });
        E.tryInflict(bb, 'enemy', 'sleep', [], {});
        turns.add(bb.enemy.battler.inst.statusTurns);
      }
      ok([...turns].every((t) => t >= 1 && t <= 3) && turns.size === 3, 'sleep turns 1..3', [...turns]);
    }

    // ---- 行動順
    {
      const fast = mk('hinokon', 20, ['tackle']);   // spe 62
      const slow = mk('hinokon', 5, ['tackle']);
      let b = battle(fast, slow);
      ok(E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join() === 'player,enemy', 'order faster first');
      b = battle(slow, fast);
      ok(E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join() === 'enemy,player', 'order slower second');
      // 先制わざ
      const prio = findMove((m) => (m.priority || 0) > 0 && m.category !== 'status');
      if (prio) {
        const s2 = mk('hinokon', 5, [prio]);
        b = battle(s2, mk('hinokon', 20, ['tackle']));
        ok(E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join() === 'player,enemy', 'priority move first (' + prio + ')');
      } else ok(false, 'priority move missing');
      // まひで すばやさ 1/4
      const f2 = mk('hinokon', 20, ['tackle']);
      const s3 = mk('hinokon', 12, ['tackle']);
      b = battle(f2, s3);
      const before = E.speedOf(b.player.battler);
      f2.status = 'paralyze';
      ok(E.speedOf(b.player.battler) === Math.floor(before / 4), 'paralyze speed /4');
      ok(E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join() === 'enemy,player', 'paralyze changes order');
      // 同速は乱数
      const t1 = mk('hinokon', 10, ['tackle']), t2 = mk('hinokon', 10, ['tackle']);
      b = battle(t1, t2, { rng: constRng(0.1) });
      const o1 = E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join();
      b = battle(t1, t2, { rng: constRng(0.9) });
      const o2 = E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join();
      ok(o1 === 'player,enemy' && o2 === 'enemy,player', 'speed tie random', { o1, o2 });
      // ランク補正
      b = battle(mk('hinokon', 10, ['tackle']), mk('hinokon', 12, ['tackle']));
      b.player.battler.stages.spe = 2;
      ok(E.moveOrder(b, { type: 'move', index: 0 }, { type: 'move', index: 0 }).join() === 'player,enemy', 'speed stage affects order');
    }

    // ---- わるあがき
    {
      const p = mk('hinokon', 10, ['tackle', 'ember']);
      p.moves.forEach((m) => { m.pp = 0; });
      const e = mk('mizupyon', 10, ['growl']);
      const b = battle(p, e);
      ok(!E.hasUsableMoves(p), 'no usable moves');
      const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      const mv = ev.find((x) => x.type === 'move' && x.side === 'player');
      const dmg = ev.find((x) => x.type === 'damage' && x.side === 'enemy');
      const rec = ev.find((x) => x.type === 'damage' && x.side === 'player' && x.source === 'recoil');
      ok(mv && mv.moveId === 'struggle' && mv.name === 'わるあがき', 'struggle used');
      ok(dmg && rec && rec.amount === Math.max(1, Math.floor(dmg.amount / 4)), 'struggle recoil 1/4', { dmg: dmg && dmg.amount, rec: rec && rec.amount });
      ok(dmg && dmg.effectiveness === 1, 'struggle typeless');
      ok(p.moves.every((m) => m.pp === 0), 'struggle no pp change');
    }

    // ---- PP 消費
    {
      const p = mk('hinokon', 10, ['tackle']);
      const e = mk('mizupyon', 10, ['growl']);
      const b = battle(p, e);
      const pp0 = p.moves[0].pp;
      E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(p.moves[0].pp === pp0 - 1 && e.moves[0].pp === App.monster.maxPP('growl') - 1, 'pp consumed');
    }

    // ---- 逃走
    {
      const fast = mk('hinokon', 30), slow = mk('hinokon', 5);
      let b = battle(fast, slow);
      ok(E.escapeChance(b) === 1, 'escape faster = 1');
      b = battle(slow, fast);
      const my = E.speedOf(b.player.battler), foe = E.speedOf(b.enemy.battler);
      const p1 = (my * 128 / foe + 30 * 1) / 256;
      const p2 = (my * 128 / foe + 30 * 2) / 256;
      ok(Math.abs(E.escapeChance(b, 1) - p1) < 1e-9 && Math.abs(E.escapeChance(b, 2) - p2) < 1e-9, 'escape formula', { my, foe, p1, p2 });
      b = battle(slow, fast, { rng: constRng(0.999) });
      const r1 = E.attemptEscape(b);
      ok(!r1.success && b.escapeAttempts === 1, 'escape fail with high rng');
      b = battle(slow, fast, { rng: constRng(0) });
      ok(E.attemptEscape(b).success, 'escape success with low rng');
      b = battle(slow, fast, { kind: 'trainer' });
      ok(E.escapeChance(b) === 0 && !E.attemptEscape(b).success, 'no escape from trainer');
      // resolveTurn run
      b = battle(fast, slow);
      const ev = E.resolveTurn(b, { type: 'run' });
      ok(b.over === 'run' && ev[0].type === 'run' && ev[0].success, 'resolveTurn run');
    }

    // ---- 状態異常の行動判定・ターン終了ダメージ
    {
      const p = mk('hinokon', 10, ['tackle']);
      const e = mk('mizupyon', 10, ['growl']);
      let b = battle(p, e);
      p.status = 'sleep'; p.statusTurns = 2;
      let ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(!ev.some((x) => x.type === 'move' && x.side === 'player') && p.statusTurns === 1, 'sleep skip 1');
      E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(ev.some((x) => x.type === 'status' && x.side === 'player' && x.status === null) && ev.some((x) => x.type === 'move' && x.side === 'player') && p.status === null, 'wake after 2 turns');
      // まひ 25%
      const p2 = mk('hinokon', 10, ['tackle']);
      p2.status = 'paralyze';
      b = battle(p2, mk('mizupyon', 10, ['growl']), { rng: constRng(0.1) });
      ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(!ev.some((x) => x.type === 'move' && x.side === 'player'), 'full paralysis (rng 0.1)');
      // こおり
      const p3 = mk('hinokon', 10, ['tackle']);
      p3.status = 'freeze';
      b = battle(p3, mk('mizupyon', 10, ['growl']), { rng: constRng(0.5) });
      ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(!ev.some((x) => x.type === 'move' && x.side === 'player') && p3.status === 'freeze', 'frozen (rng 0.5)');
      b = battle(p3, mk('mizupyon', 10, ['growl']), { rng: constRng(0.1) });
      ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(p3.status === null && ev.some((x) => x.type === 'move' && x.side === 'player'), 'thaw (rng 0.1)');
      // どく 1/8
      const p4 = mk('hinokon', 10, ['growl']);
      p4.status = 'poison';
      const hp0 = p4.hp;
      b = battle(p4, mk('mizupyon', 10, ['growl']));
      ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      const pd = ev.find((x) => x.type === 'damage' && x.source === 'poison');
      ok(pd && pd.amount === Math.max(1, Math.floor(App.monster.stats(p4).hp / 8)) && p4.hp === hp0 - pd.amount, 'poison 1/8', pd);
    }

    // ---- ひるみ（先に行動したときのみ）
    {
      const fl = findMove((m) => (m.effects || []).some((x) => x.kind === 'flinch') && m.category !== 'status' && (m.priority || 0) === 0 && (m.accuracy === 0 || m.accuracy >= 90));
      if (fl) {
        const fast = mk('hinokon', 30, [fl]);
        const slow = mk('mizupyon', 5, ['growl']);
        slow.hp = 9999;
        let b = battle(fast, slow, { rng: constRng(0) });
        let ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        ok(ev.some((x) => x.type === 'message' && x.anim === 'flinch' && x.side === 'enemy'), 'flinch when first (' + fl + ')');
        const f2 = mk('hinokon', 5, [fl]);
        const s2 = mk('mizupyon', 30, ['growl']);
        b = battle(f2, s2, { rng: constRng(0) });
        ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        ok(!ev.some((x) => x.anim === 'flinch'), 'no flinch when second');
      } else ok(false, 'flinch move missing');
    }

    // ---- effects: stat / heal / drain / recoil / multihit
    {
      const growlB = battle(mk('hinokon', 10, ['growl']), mk('mizupyon', 10, ['growl']));
      E.resolveTurn(growlB, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(growlB.enemy.battler.stages.atk === -1 && growlB.player.battler.stages.atk === -1, 'growl -1 atk');
      const selfUp = findMove((m) => m.category === 'status' && (m.effects || []).length === 1 && m.effects[0].kind === 'stat' && m.effects[0].target === 'self' && m.effects[0].stages === 2);
      if (selfUp) {
        const pu = mk('hinokon', 10, [selfUp]); pu.hp = 9999; const b = battle(pu, mk('mizupyon', 5, ['tackle']));
        for (let i = 0; i < 4; i++) E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        const st = GameData.moves[selfUp].effects[0].stat;
        ok(b.player.battler.stages[st] === 6, 'self +2 capped at 6 (' + selfUp + ')', b.player.battler.stages[st]);
      }
      const healMv = findMove((m) => m.category === 'status' && (m.effects || []).some((x) => x.kind === 'heal'));
      if (healMv) {
        const p = mk('hinokon', 20, [healMv]);
        const mx = App.monster.stats(p).hp;
        p.hp = 1;
        const b = battle(p, mk('mizupyon', 5, ['growl']));
        const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        const h = ev.find((x) => x.type === 'heal');
        const ratio = GameData.moves[healMv].effects.find((x) => x.kind === 'heal').ratio;
        ok(h && h.amount === Math.min(mx - 1, Math.floor(mx * ratio)), 'heal move (' + healMv + ')', h);
      }
      const drainMv = findMove((m) => m.category !== 'status' && (m.effects || []).some((x) => x.kind === 'drain') && !(m.effects || []).some((x) => x.kind === 'multihit'));
      if (drainMv) {
        const p = mk('hinokon', 20, [drainMv]);
        p.hp = 1;
        const e = mk('mizupyon', 20, ['growl']);
        e.hp = 9999;
        const b = battle(p, e);
        const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        const d = ev.find((x) => x.type === 'damage' && x.side === 'enemy');
        const h = ev.find((x) => x.type === 'heal' && x.side === 'player');
        const ratio = GameData.moves[drainMv].effects.find((x) => x.kind === 'drain').ratio;
        ok(d && h && h.amount === Math.max(1, Math.floor(d.amount * ratio)), 'drain (' + drainMv + ')', { d: d && d.amount, h: h && h.amount });
      }
      const recoilMv = findMove((m) => m.category !== 'status' && (m.effects || []).some((x) => x.kind === 'recoil'));
      if (recoilMv) {
        const p = mk('hinokon', 20, [recoilMv]);
        const e = mk('mizupyon', 20, ['growl']);
        e.hp = 9999;
        const b = battle(p, e);
        const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        const d = ev.find((x) => x.type === 'damage' && x.side === 'enemy');
        const r = ev.find((x) => x.type === 'damage' && x.side === 'player' && x.source === 'recoil');
        const ratio = GameData.moves[recoilMv].effects.find((x) => x.kind === 'recoil').ratio;
        ok(d && r && r.amount === Math.max(1, Math.floor(d.amount * ratio)), 'recoil (' + recoilMv + ')', { d: d && d.amount, r: r && r.amount });
      }
      const mhMv = findMove((m) => (m.effects || []).some((x) => x.kind === 'multihit'));
      if (mhMv) {
        const mh = GameData.moves[mhMv].effects.find((x) => x.kind === 'multihit');
        const counts = new Set();
        for (const v of [0, 0.3, 0.45, 0.6, 0.8, 0.95]) counts.add(E.multiHitCount(mh, constRng(v)));
        ok([...counts].every((c) => c >= mh.min && c <= mh.max), 'multihit range', [...counts]);
        const p = mk('hinokon', 20, [mhMv]);
        const e = mk('mizupyon', 20, ['growl']);
        e.hp = 9999;
        const b = battle(p, e, { rng: constRng(0.5) });
        const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
        const hits = ev.filter((x) => x.type === 'damage' && x.side === 'enemy').length;
        ok(hits === E.multiHitCount(mh, constRng(0.5)) && ev.some((x) => x.type === 'message' && /かい あたった/.test(x.text)), 'multihit events (' + mhMv + ')', hits);
      }
      // 命中: 命中ランク -6 & 回避 +6 ならほぼ外れる
      const b = battle(mk('hinokon', 10, ['tackle']), mk('mizupyon', 10, ['growl']), { rng: constRng(0.5) });
      b.player.battler.stages.acc = -6; b.enemy.battler.stages.eva = 6;
      const ev = E.resolveTurn(b, { type: 'move', index: 0 }, { type: 'move', index: 0 });
      ok(ev.some((x) => x.type === 'miss' && x.side === 'player'), 'accuracy/evasion stages → miss');
      // 相性0
      const ghost = findSpecies((m) => m.types.includes('ghost'));
      if (ghost) {
        const b2 = battle(mk('hinokon', 10, ['tackle']), mk(ghost.id, 10, null));
        const ev2 = E.resolveTurn(b2, { type: 'move', index: 0 });
        ok(!ev2.some((x) => x.type === 'damage' && x.side === 'enemy') && ev2.some((x) => /こうかが ないようだ/.test(x.text || '')), 'normal vs ghost no effect');
      }
    }

    // ---- ひんし・経験値配分・トレーナーの手持ち複数
    {
      const a = mk('hinokon', 30, ['tackle']);
      const bnc = mk('mizupyon', 10, ['tackle']);
      const dead = mk('happamaru', 10, ['tackle']);
      dead.hp = 0;
      const e1 = mk('hinokon', 3, ['growl']), e2 = mk('mizupyon', 3, ['growl']), e3 = mk('hinokon', 4, ['growl']);
      const b = battle([a, bnc, dead], [e1, e2, e3], { kind: 'trainer', ai: 'smart', trainerLabel: 'たんパンこぞうの ケンタ' });
      let ev = E.resolveTurn(b, { type: 'move', index: 0 });
      ok(ev.some((x) => x.type === 'faint' && x.side === 'enemy') && e1.hp === 0, 'enemy 1 fainted');
      const y = App.monster.expYield(e1, true);
      let shares = E.expShares(b, 0);
      const sa = shares.find((s) => s.inst === a), sb = shares.find((s) => s.inst === bnc), sd = shares.find((s) => s.inst === dead);
      ok(sa && sa.participant && sa.amount === y, 'exp participant full', { y, sa: sa && sa.amount });
      ok(sb && !sb.participant && sb.amount === Math.max(1, Math.floor(y * cfg.expShareRatio)), 'exp share bench', sb && sb.amount);
      ok(!sd, 'fainted gets no exp');
      ok(E.nextEnemyIndex(b) === 1, 'next enemy index 1');
      ev = E.switchIn(b, 'enemy', 1);
      ok(ev[0].type === 'switch' && /くりだした/.test(ev[0].text) && b.enemy.battler.inst === e2, 'enemy switchIn');
      // 交代して2体で倒す → 等分
      ev = E.resolveTurn(b, { type: 'switch', index: 1 }, { type: 'move', index: 0 });
      ok(ev[0].type === 'recall' && ev[1].type === 'switch' && b.player.battler.inst === bnc, 'player voluntary switch');
      e2.hp = 1;
      ev = E.resolveTurn(b, { type: 'move', index: 0 });
      ok(e2.hp === 0, 'enemy 2 fainted by bnc');
      shares = E.expShares(b, 1);
      const y2 = App.monster.expYield(e2, true);
      const s1 = shares.find((s) => s.inst === a), s2 = shares.find((s) => s.inst === bnc);
      ok(s1 && s2 && s1.participant && s2.participant && s1.amount === Math.floor(y2 / 2) && s2.amount === Math.floor(y2 / 2), 'exp split among participants', { y2, s1: s1 && s1.amount, s2: s2 && s2.amount });
      E.switchIn(b, 'enemy', 2);
      ok(JSON.stringify(b.participants[2]) === JSON.stringify([1]), 'participants reset on new enemy', b.participants[2]);
      e3.hp = 0;
      ok(E.sideDefeated(b, 'enemy') && E.nextEnemyIndex(b) === -1, 'enemy side defeated');
      // 味方のひんし
      const b2 = battle([mk('hinokon', 3, ['growl'])], [mk('kaenryu', 50, ['tackle'])], { kind: 'wild' });
      E.resolveTurn(b2, { type: 'move', index: 0 });
      ok(E.sideDefeated(b2, 'player'), 'player side defeated');
    }

    // ---- 敵AI
    {
      // ばつぐんで倒せるわざを選ぶ（smart）
      const e = mk('mizupyon', 20, ['tackle', 'growl', 'watergun']);
      const p = mk('hinokon', 12, ['tackle']);
      const b = battle(p, e, { ai: 'smart', rng: constRng(0.5) });
      const act = E.chooseEnemyAction(b);
      ok(act.index === 2, 'smart picks super effective', { act, scores: E.aiScores(b) });
      // random は使えるわざのみ
      e.moves[0].pp = 0; e.moves[2].pp = 0;
      const b2 = battle(p, e, { ai: 'random', rng: Math.random });
      let allGrowl = true;
      for (let i = 0; i < 20; i++) if (E.chooseEnemyAction(b2).index !== 1) allGrowl = false;
      ok(allGrowl, 'random uses only usable moves');
      e.moves.forEach((m) => { m.pp = 0; });
      ok(E.chooseEnemyAction(b2).index === -1, 'ai struggle when no pp');
      // smart でも ときどき変化わざ
      const e3 = mk('mizupyon', 10, ['tackle', 'growl']);
      const p3 = mk('kaenryu', 30);
      p3.hp = App.monster.stats(p3).hp;
      const b3 = battle(p3, e3, { ai: 'smart', rng: Math.random });
      let status = 0;
      for (let i = 0; i < 200; i++) if (E.chooseEnemyAction(b3).index === 1) status++;
      ok(status > 0 && status < 200, 'smart sometimes uses status move', status);
    }

    const failed = results.filter((r) => !r.ok);
    return { total: results.length, passed: results.length - failed.length, failed };
  }

  // ---------------------------------------------------------------- UI 自動操作（実キーイベント経由）
  const KEY_NAMES = { KeyZ: 'z', KeyX: 'x', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  function key(code) {
    const k = KEY_NAMES[code] || code;
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: k, bubbles: true }));
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function activeIndex(sel) {
    return Array.from(document.querySelectorAll(sel)).findIndex((e) => e.classList.contains('is-active'));
  }
  // 2x2 グリッドで cur → want へ1歩
  function gridStep(cur, want) {
    if ((cur ^ 1) === want) return 'ArrowRight';
    if ((cur ^ 2) === want) return 'ArrowDown';
    return 'ArrowUp';
  }
  // opts: { command: 'fight'|'party'|'run'|fn(state), move: idx|fn, party: idx|fn, stopAt: phase, gap, maxSteps }
  async function autoplay(opts) {
    opts = Object.assign({ command: 'fight', move: 0, gap: 110, maxSteps: 1500 }, opts || {});
    const log = window.__btlog = window.__btlog || [];
    let lastT = log.length ? log[log.length - 1] : '';
    let prevPhase = App.battle.debugState().phase;
    for (let i = 0; i < opts.maxSteps; i++) {
      const s = App.battle.debugState();
      if (!s.active) break;
      if (s.text && s.text !== lastT) { log.push(s.text); lastT = s.text; }
      if (opts.stopAt && s.phase === opts.stopAt && prevPhase !== s.phase) return { stopped: s.phase, log };
      prevPhase = s.phase;
      if (s.phase === 'wait' || s.phase === 'levelup') {
        key('KeyZ');
      } else if (s.phase === 'command') {
        const want = { fight: 0, party: 1, run: 2 }[typeof opts.command === 'function' ? opts.command(s) : opts.command];
        const cur = activeIndex('.bt-cmd-item');
        key(cur === want ? 'KeyZ' : gridStep(cur, want));
      } else if (s.phase === 'moves') {
        const want = typeof opts.move === 'function' ? opts.move(s) : opts.move;
        const cur = activeIndex('.bt-move');
        key(cur === want ? 'KeyZ' : gridStep(cur, want));
      } else if (s.phase === 'party') {
        const cards = Array.from(document.querySelectorAll('.bt-pcard'));
        let want = typeof opts.party === 'function' ? opts.party(s) : opts.party;
        if (!(want >= 0) || cards[want].classList.contains('is-fainted') || cards[want].classList.contains('is-current') && !cards[want].classList.contains('is-fainted') && s.player.hp > 0) {
          want = cards.findIndex((c) => !c.classList.contains('is-fainted') && !c.classList.contains('is-current'));
        }
        const cur = activeIndex('.bt-pcard');
        key(cur === want ? 'KeyZ' : (want > cur ? 'ArrowRight' : 'ArrowLeft'));
      }
      await sleep(opts.gap);
    }
    for (let i = 0; i < 100 && App.battle.isActive(); i++) await sleep(100);
    return { stopped: null, active: App.battle.isActive(), log };
  }

  window.BattleTest = { engine, results, constRng, seqRng, key, autoplay };
})();
