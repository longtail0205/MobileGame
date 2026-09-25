// 進化テスト補助（tools/steps/evo-*.json から読み込む）。ゲーム本体では使わない。
// 一時的な進化系統 zzbase → zzmid(Lv8) → zztop(Lv12) を GameData に差し込む。
(function () {
  'use strict';
  const results = [];
  function ok(cond, name, detail) {
    results.push({ ok: !!cond, name, detail: detail === undefined ? '' : detail });
    if (!cond) console.error('[evo-test] NG: ' + name + ' ' + (detail === undefined ? '' : JSON.stringify(detail)));
  }
  function mon(id, no, name, bs, learnset, extra) {
    return Object.assign({
      id, no, name, rarity: 'N', types: ['fire'],
      baseStats: { hp: bs, atk: bs, def: bs, spa: bs, spd: bs, spe: bs },
      learnset, expGroup: 'medium_fast', baseExp: 60, image: '', backImage: '',
      sprite: { shape: 'quadruped', colors: ['#f07830', '#f8d880', '#a02818'] }, desc: 'テスト用',
    }, extra || {});
  }
  function monsters() {
    const list = JSON.parse(JSON.stringify(GameData.monsters)).filter((m) => !/^zz/.test(m.id));
    list.push(mon('zzbase', 991, 'ズズモト', 40, [{ lv: 1, move: 'tackle' }, { lv: 1, move: 'growl' }, { lv: 5, move: 'ember' }],
      { evolution: { to: 'zzmid', level: 8 } }));
    list.push(mon('zzmid', 992, 'ズズナカ', 60, [{ lv: 1, move: 'tackle' }, { lv: 1, move: 'growl' }, { lv: 5, move: 'ember' }, { lv: 7, move: 'flameclaw' }, { lv: 10, move: 'hotbreath' }],
      { gacha: false, evolution: { to: 'zztop', level: 12 } }));
    list.push(mon('zztop', 993, 'ズズオウ', 80, [{ lv: 1, move: 'scratch' }, { lv: 12, move: 'flamebullet' }], { gacha: false }));
    return list;
  }
  function inject() { GameData.monsters = monsters(); return GameData.monsters.length; }
  function setOverride() {
    localStorage.setItem(GameData.config.overrideKey || 'gachamon_data_override_v1', JSON.stringify({ monsters: monsters(), _savedAt: Date.now() }));
    return true;
  }
  function unit() {
    results.length = 0;
    const D = App.data, M = App.monster, S = App.state;
    inject();
    ok(JSON.stringify(D.familyOf('zzmid')) === '["zzbase","zzmid","zztop"]', 'familyOf', D.familyOf('zzmid'));
    ok(JSON.stringify(D.familyOf('zzbase')) === JSON.stringify(D.familyOf('zztop')), 'familyOf same for all');
    ok(D.familyRoot('zztop') === 'zzbase' && D.preEvolutionOf('zzmid') === 'zzbase' && D.preEvolutionOf('zzbase') === null, 'root/pre');
    ok(D.evolutionOf('zzbase').to === 'zzmid' && D.evolutionOf('zzbase').level === 8 && D.evolutionOf('zztop') === null, 'evolutionOf');
    ok(JSON.stringify(D.familyOf('tackle_nope')) === '[]', 'familyOf unknown');
    ok(M.canEvolve(M.create('zzbase', 7)) === null && M.canEvolve(M.create('zzbase', 8)) === 'zzmid' && M.canEvolve(M.create('zztop', 50)) === null, 'canEvolve');
    const top = M.create('zztop', 12);
    const lm = M.learnableMoves(top);
    ok(['tackle', 'growl', 'ember', 'flameclaw', 'hotbreath', 'scratch', 'flamebullet'].every((x) => lm.includes(x)) && lm.length === 7, 'learnableMoves incl pre-evo', lm);
    ok(!M.learnableMoves(M.create('zztop', 9)).includes('hotbreath'), 'learnableMoves lv filter');
    ok(M.setMoves(top, ['ember', 'flameclaw', 'scratch', 'flamebullet']), 'setMoves pre-evo move');

    // evolve
    S.reset();
    const a = S.addMonster('hinokon', { level: 5 });
    const r0 = S.addMonster('zzbase', { level: 7 });
    ok(r0.isNew && r0.joinedParty, 'add zzbase');
    ok(S.evolve('zzbase') === null, 'evolve refuses under level');
    S.addMonster('zzbase'); S.addMonster('zzbase');   // 凸2
    const inst = S.owned('zzbase');
    inst.nickname = 'ポチ';
    M.addExp(inst, M.expForLevel(9, 'medium_fast') - inst.exp);
    inst.moves = inst.moves.slice(0, 2);
    inst.hp = 5;
    const hpMaxBefore = M.stats(inst).hp;
    const ev = [];
    ['collection:changed', 'party:changed', 'monster:updated', 'dex:changed'].forEach((n) => App.events.on(n, (p) => ev.push(n + ':' + JSON.stringify(p))));
    const r = S.evolve('zzbase');
    const hpMaxAfter = M.stats(inst).hp;
    ok(r && r.from === 'zzbase' && r.to === 'zzmid' && r.inst === inst, 'evolve result', r && { from: r.from, to: r.to });
    ok(!S.owned('zzbase') && S.owned('zzmid') === inst && inst.speciesId === 'zzmid', 'collection key moved');
    ok(JSON.stringify(S.partyIds()) === '["hinokon","zzmid"]', 'party replaced', S.partyIds());
    ok(inst.hp === 5 + (hpMaxAfter - hpMaxBefore) && hpMaxAfter > hpMaxBefore, 'hp increased', { hp: inst.hp, hpMaxBefore, hpMaxAfter });
    ok(inst.limitBreak === 2 && inst.nickname === 'ポチ' && inst.level === 9, 'lb/nick/level kept');
    ok(S.data.dex.owned.zzbase && S.data.dex.owned.zzmid && S.data.dex.seen.zzmid, 'dex updated');
    ok(JSON.stringify(r.newMoves) === '["flameclaw"]', 'newMoves', r.newMoves);
    ok(ev.some((x) => x.indexOf('collection:changed:{"speciesId":"zzmid","evolvedFrom":"zzbase"') === 0) && ev.some((x) => x.indexOf('party:changed') === 0), 'events', ev);
    ok(S.ownedInFamily('zzbase') === inst && S.ownedInFamily('zztop') === inst && S.ownedInFamily('hinokon') === S.owned('hinokon'), 'ownedInFamily');
    ok(S.evolve('zzmid') === null, 'evolve zzmid refuses under lv12');

    // 系統重複ガチャ: zzbase を引く → zzmid の凸 → MAX 後返還
    const maxLB = GameData.gacha.maxLimitBreak;
    const lbs = [];
    for (let i = inst.limitBreak; i < maxLB; i++) {
      const x = S.addMonster('zzbase');
      lbs.push(x.limitBreak);
      if (x.isNew || x.ownedId !== 'zzmid') ok(false, 'family dup must be LB', x);
    }
    ok(inst.limitBreak === maxLB && !S.owned('zzbase'), 'LB to max via pre-evo', lbs);
    const p0 = S.points();
    const x2 = S.addMonster('zzbase');
    ok(!x2.isNew && x2.refund === GameData.rarities.N.refund && S.points() === p0 + x2.refund && !S.owned('zzbase'), 'refund at max', x2.refund);
    ok(!S.addMonster('zztop').isNew, 'final form counts as family');
    // gacha pool は gacha:false を除外
    ok(App.data.monsters().filter((m) => m.gacha !== false).every((m) => m.id !== 'zzmid' && m.id !== 'zztop'), 'pool excludes gacha:false');

    // validate
    const base = D.validate();
    ok(!base.errors.some((e) => /zz/.test(e)), 'validate clean for zz', base.errors.filter((e) => /zz|進化/.test(e)));
    const topDef = GameData.monsters.find((m) => m.id === 'zztop');
    topDef.evolution = { to: 'zzbase', level: 20 };
    const v1 = D.validate();
    ok(v1.errors.some((e) => /循環/.test(e) && /zzbase/.test(e)), 'validate cycle', v1.errors.filter((e) => /進化|循環/.test(e)));
    ok(D.familyOf('zzmid').length === 3, 'familyOf terminates on cycle', D.familyOf('zzmid'));
    topDef.evolution = { to: 'zztop', level: 20 };
    ok(D.validate().errors.some((e) => /zztop/.test(e) && /自分自身/.test(e)), 'validate self');
    topDef.evolution = { to: 'nope', level: 20 };
    ok(D.validate().errors.some((e) => /nope/.test(e)), 'validate missing ref');
    topDef.evolution = { to: 'zzbase', level: 1 };
    ok(D.validate().errors.some((e) => /evolution\.level/.test(e)), 'validate level range');
    delete topDef.evolution;
    const midDef = GameData.monsters.find((m) => m.id === 'zzmid');
    midDef.gacha = true; midDef.rarity = 'R';
    const v2 = D.validate();
    ok(v2.warnings.some((w) => /zzmid/.test(w) && /gacha: false/.test(w)) && v2.warnings.some((w) => /zzmid/.test(w) && /レア度/.test(w)) && !v2.errors.some((e) => /zzmid/.test(e) && /gacha|レア度/.test(e)), 'validate warnings');
    midDef.gacha = false; midDef.rarity = 'N';
    S.reset();
    const ng = results.filter((x) => !x.ok);
    return (ng.length ? 'NG ' + ng.length + ': ' + JSON.stringify(ng) : 'ALL OK') + ' (' + results.length + ')';
  }

  window.EvoTest = { ok, results, monsters, inject, setOverride, unit };
})();
