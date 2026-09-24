// =====================================================================
// App.battleEngine — バトルの純粋ロジック（DOM 非依存・乱数注入可能）
//   ターン解決はイベント列を返し、UI（battle.js）が順番に演出する。
//   イベント: { type, side?, text?, ... }
//     message  … { text, anim? }                     文章のみ（anim: 'sleep'|'freeze'|'paralyze'|'flinch' 等）
//     move     … { side, moveId, name, moveType, category, text }  わざ使用（文章 → 演出）
//     miss     … { side, text }
//     damage   … { side, amount, hp, maxHp, effectiveness, crit, source, moveType }
//     heal     … { side, amount, hp, maxHp, text }
//     status   … { side, status(null=回復), text }
//     stat     … { side, stat, delta, stage, text }
//     faint    … { side, index, text }
//     recall   … { side, index, text } / switch … { side, index, text }
//     run      … { success, text }
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const STAGE_KEYS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
  const STAT_NAMES = { atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ', acc: 'めいちゅうりつ', eva: 'かいひりつ' };
  const STATUS_NAMES = { poison: 'どく', burn: 'やけど', paralyze: 'まひ', sleep: 'ねむり', freeze: 'こおり' };
  const STATUS_IMMUNE = { burn: ['fire'], poison: ['poison', 'steel'], freeze: ['ice'], paralyze: ['electric'] };
  const STATUS_INFLICT_TEXT = {
    poison: '{n}は どくを あびた！',
    burn: '{n}は やけどを おった！',
    paralyze: '{n}は まひして わざが でにくくなった！',
    sleep: '{n}は ねむって しまった！',
    freeze: '{n}は こおって しまった！',
  };
  // わるあがき（タイプなし・威力50・与ダメの1/4反動）
  const STRUGGLE = Object.freeze({
    id: 'struggle', name: 'わるあがき', type: null, category: 'physical', power: 50, accuracy: 0, pp: 1,
    priority: 0, critStage: 0, effects: Object.freeze([Object.freeze({ kind: 'recoil', ratio: 0.25 })]),
  });

  const cfg = () => (App.data && App.data.config) || (window.GameData && window.GameData.config) || {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const other = (side) => (side === 'player' ? 'enemy' : 'player');
  const fainted = (inst) => !inst || !(inst.hp > 0);

  // ---------------------------------------------------------------- 基本計算
  function stageMult(n) {
    n = clamp(Math.trunc(n) || 0, -6, 6);
    return n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
  }
  function accStageMult(n) {
    n = clamp(Math.trunc(n) || 0, -6, 6);
    return n >= 0 ? (3 + n) / 3 : 3 / (3 - n);
  }
  function critRate(stage) {
    const s = Math.max(0, Math.trunc(stage) || 0);
    if (s === 0) return num(cfg().critChance, 1 / 16);
    if (s === 1) return 1 / 8;
    if (s === 2) return 1 / 4;
    return 1 / 2;
  }
  function typeEffect(moveType, defTypes) {
    if (!moveType) return 1;
    return App.data.typeEffect(moveType, defTypes || []);
  }
  function typesOf(inst) {
    const def = inst && App.data.monster(inst.speciesId);
    return (def && Array.isArray(def.types)) ? def.types : [];
  }
  function statsOf(inst) { return App.monster.stats(inst); }
  function maxHp(inst) { return statsOf(inst).hp; }

  // わざ定義（id 付き）。未知なら null
  function moveOf(id) {
    if (id === 'struggle') return STRUGGLE;
    const m = App.data.move(id);
    return m ? Object.assign({ id }, m) : null;
  }
  function effectsOf(move) { return Array.isArray(move && move.effects) ? move.effects.filter(Boolean) : []; }

  // ダメージ式（SPEC 8章・Gen3風）。各倍率の後で切り捨てる。
  //   p: { level, power, atk, def, crit, roll(85..100), stab, effect, burn, critMult?, stabMult? }
  function damageFormula(p) {
    const effect = num(p.effect, 1);
    if (!(effect > 0)) return 0;
    const L = Math.max(1, Math.floor(num(p.level, 1)));
    const A = Math.max(1, Math.floor(num(p.atk, 1)));
    const D = Math.max(1, Math.floor(num(p.def, 1)));
    const power = Math.max(0, num(p.power, 0));
    let d = Math.floor(Math.floor(Math.floor((2 * L) / 5 + 2) * power * A / D) / 50) + 2;
    if (p.crit) d = Math.floor(d * num(p.critMult, num(cfg().critMultiplier, 1.5)));
    d = Math.floor(d * clamp(num(p.roll, 100), 0, 100) / 100);
    if (p.stab) d = Math.floor(d * num(p.stabMult, num(cfg().stab, 1.5)));
    d = Math.floor(d * effect);
    if (p.burn) d = Math.floor(d / 2);
    return Math.max(1, d);
  }

  // バトラー（場に出ているモンスター）の能力値（ランク補正込み）
  function battleStat(bt, key, opts) {
    const base = statsOf(bt.inst)[key];
    let st = bt.stages[key] || 0;
    if (opts && opts.ignorePositive) st = Math.min(0, st);
    if (opts && opts.ignoreNegative) st = Math.max(0, st);
    return Math.max(1, Math.floor(base * stageMult(st)));
  }
  function speedOf(bt) {
    let s = battleStat(bt, 'spe');
    if (bt.inst.status === 'paralyze') s = Math.floor(s / 4);
    return Math.max(1, s);
  }

  // attacker/defender: バトラー（{ inst, stages }）
  // opts: { crit: bool, roll: 85..100, rng }  crit/roll 省略時は rng で決定
  function calcDamage(attacker, defender, move, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    if (!move || move.category === 'status' || !(move.power > 0)) {
      return { damage: 0, effectiveness: 1, crit: false, stab: false, roll: 100 };
    }
    const physical = move.category !== 'special';
    const effectiveness = typeEffect(move.type, typesOf(defender.inst));
    const crit = opts.crit !== undefined ? !!opts.crit : rng() < critRate(move.critStage);
    const roll = opts.roll !== undefined ? opts.roll : 85 + Math.floor(rng() * 16);
    const aKey = physical ? 'atk' : 'spa';
    const dKey = physical ? 'def' : 'spd';
    // 急所時は 攻撃側の不利なランク（マイナス）と 防御側の有利なランク（プラス）を無視
    const A = battleStat(attacker, aKey, crit ? { ignoreNegative: true } : null);
    const D = battleStat(defender, dKey, crit ? { ignorePositive: true } : null);
    const stab = !!move.type && typesOf(attacker.inst).includes(move.type);
    const damage = damageFormula({
      level: attacker.inst.level, power: move.power, atk: A, def: D,
      crit, roll, stab, effect: effectiveness,
      burn: physical && attacker.inst.status === 'burn',
    });
    return { damage, effectiveness, crit, stab, roll, atk: A, def: D };
  }

  function statusImmune(status, types) {
    const list = STATUS_IMMUNE[status] || [];
    return (types || []).some((t) => list.includes(t));
  }

  function hasUsableMoves(inst) {
    return !!(inst && Array.isArray(inst.moves) && inst.moves.some((m) => m && m.pp > 0 && App.data.move(m.id)));
  }
  function usableMoveIndices(inst) {
    const out = [];
    (inst && inst.moves || []).forEach((m, i) => { if (m && m.pp > 0 && App.data.move(m.id)) out.push(i); });
    return out;
  }

  function multiHitCount(eff, rng) {
    const min = Math.max(1, Math.floor(num(eff.min, 2)));
    const max = Math.max(min, Math.floor(num(eff.max, 5)));
    if (min === 2 && max === 5) {
      // Gen3 と同じ分布: 2,3 が 3/8 ずつ、4,5 が 1/8 ずつ
      return [2, 2, 2, 3, 3, 3, 4, 5][Math.floor(rng() * 8)];
    }
    return min + Math.floor(rng() * (max - min + 1));
  }

  // ---------------------------------------------------------------- バトル状態
  function zeroStages() {
    const s = {};
    STAGE_KEYS.forEach((k) => { s[k] = 0; });
    return s;
  }
  function makeBattler(inst, side, index) {
    return { side, index, inst, stages: zeroStages(), flinch: false, moved: false };
  }
  function firstHealthyIndex(party) {
    const i = party.findIndex((p) => !fainted(p));
    return i < 0 ? 0 : i;
  }

  // opts: { kind:'wild'|'trainer', playerParty:[inst], enemyParty:[inst], playerIndex?, enemyIndex?,
  //         ai:'random'|'smart', rng?:()=>[0,1), trainerLabel?: 'たんパンこぞうの ケンタ' }
  function create(opts) {
    opts = opts || {};
    const playerParty = (opts.playerParty || []).filter(Boolean);
    const enemyParty = (opts.enemyParty || []).filter(Boolean);
    if (!playerParty.length) throw new Error('battleEngine.create: playerParty が空です');
    if (!enemyParty.length) throw new Error('battleEngine.create: enemyParty が空です');
    const pi = Number.isInteger(opts.playerIndex) ? opts.playerIndex : firstHealthyIndex(playerParty);
    const ei = Number.isInteger(opts.enemyIndex) ? opts.enemyIndex : firstHealthyIndex(enemyParty);
    const b = {
      kind: opts.kind === 'trainer' ? 'trainer' : 'wild',
      ai: opts.ai === 'smart' ? 'smart' : 'random',
      rng: typeof opts.rng === 'function' ? opts.rng : Math.random,
      trainerLabel: opts.trainerLabel || '',
      turn: 0,
      escapeAttempts: 0,
      player: { party: playerParty, active: pi, battler: makeBattler(playerParty[pi], 'player', pi) },
      enemy: { party: enemyParty, active: ei, battler: makeBattler(enemyParty[ei], 'enemy', ei) },
      participants: {},   // 敵パーティ index → 場に出た味方 index の配列
      over: null,         // 'win' | 'lose' | 'run'
    };
    b.participants[ei] = fainted(playerParty[pi]) ? [] : [pi];
    return b;
  }

  function nameOf(b, side) {
    const inst = b[side].battler.inst;
    const n = App.monster.displayName(inst);
    if (side === 'player') return n;
    return (b.kind === 'wild' ? 'やせいの ' : 'あいての ') + n;
  }

  function addParticipant(b) {
    const ei = b.enemy.active;
    const pi = b.player.active;
    const list = b.participants[ei] || (b.participants[ei] = []);
    if (!fainted(b.player.party[pi]) && !list.includes(pi)) list.push(pi);
  }

  // 交代（プレイヤーの任意交代 / ひんし後の繰り出し / トレーナーの次のモンスター）
  function switchIn(b, side, index, opts) {
    opts = opts || {};
    const ev = [];
    const s = b[side];
    const inst = s.party[index];
    if (!inst || fainted(inst)) throw new Error('battleEngine.switchIn: 出せないモンスターです index=' + index);
    if (opts.voluntary && side === 'player' && !fainted(s.battler.inst)) {
      ev.push({ type: 'recall', side, index: s.active, text: App.monster.displayName(s.battler.inst) + ' もどれ！' });
    }
    s.active = index;
    s.battler = makeBattler(inst, side, index);
    const n = App.monster.displayName(inst);
    if (side === 'player') {
      addParticipant(b);
      ev.push({ type: 'switch', side, index, text: 'ゆけっ！ ' + n + '！' });
    } else {
      b.participants[index] = fainted(b.player.battler.inst) ? [] : [b.player.active];
      ev.push({ type: 'switch', side, index, text: (b.trainerLabel ? b.trainerLabel + 'は ' : '') + n + 'を くりだした！' });
    }
    return ev;
  }

  function healthyIndices(b, side) {
    const out = [];
    b[side].party.forEach((p, i) => { if (!fainted(p)) out.push(i); });
    return out;
  }
  function nextEnemyIndex(b) {
    const list = healthyIndices(b, 'enemy');
    return list.length ? list[0] : -1;
  }
  function sideDefeated(b, side) { return healthyIndices(b, side).length === 0; }

  // ---------------------------------------------------------------- 状態異常・ランク
  function applyStage(b, side, stat, delta, ev, opts) {
    const bt = b[side].battler;
    if (fainted(bt.inst) || !STAGE_KEYS.includes(stat) || !delta) return false;
    const n = nameOf(b, side);
    const cur = bt.stages[stat] || 0;
    const next = clamp(cur + delta, -6, 6);
    if (next === cur) {
      if (opts && opts.silent) return false;
      ev.push({ type: 'message', text: n + 'の ' + STAT_NAMES[stat] + 'は もう ' + (delta > 0 ? 'あがらない！' : 'さがらない！') });
      return true;
    }
    bt.stages[stat] = next;
    const d = next - cur;
    const word = d >= 2 ? 'ぐーんと あがった！' : (d === 1 ? 'あがった！' : (d === -1 ? 'さがった！' : 'がくっと さがった！'));
    ev.push({ type: 'stat', side, stat, delta: d, stage: next, text: n + 'の ' + STAT_NAMES[stat] + 'が ' + word });
    return true;
  }

  function tryInflict(b, side, status, ev, opts) {
    const bt = b[side].battler;
    const silent = !!(opts && opts.silent);
    if (fainted(bt.inst) || !STATUS_NAMES[status]) return false;
    const n = nameOf(b, side);
    if (bt.inst.status) {
      if (!silent) ev.push({ type: 'message', text: 'しかし うまく きまらなかった！' });
      return !silent;
    }
    if (statusImmune(status, typesOf(bt.inst))) {
      if (!silent) ev.push({ type: 'message', text: n + 'には こうかが ないようだ…' });
      return !silent;
    }
    bt.inst.status = status;
    bt.inst.statusTurns = status === 'sleep' ? 1 + Math.floor(b.rng() * 3) : 0;
    ev.push({ type: 'status', side, status, text: STATUS_INFLICT_TEXT[status].replace('{n}', n) });
    return true;
  }

  function healSide(b, side, amount, ev, text) {
    const inst = b[side].battler.inst;
    const mx = maxHp(inst);
    const a = Math.min(Math.max(0, Math.floor(amount)), mx - inst.hp);
    if (a <= 0 || fainted(inst)) return 0;
    inst.hp += a;
    ev.push({ type: 'heal', side, amount: a, hp: inst.hp, maxHp: mx, text });
    return a;
  }

  function damageSide(b, side, amount, ev, extra) {
    const inst = b[side].battler.inst;
    const a = Math.min(Math.max(0, Math.floor(amount)), inst.hp);
    inst.hp -= a;
    ev.push(Object.assign({ type: 'damage', side, amount: a, hp: inst.hp, maxHp: maxHp(inst), effectiveness: 1, crit: false, source: 'move' }, extra || {}));
    return a;
  }

  function checkFaint(b, side, ev) {
    const bt = b[side].battler;
    if (!fainted(bt.inst) || bt.faintReported) return false;
    bt.faintReported = true;
    bt.inst.status = null;
    bt.inst.statusTurns = 0;
    ev.push({ type: 'faint', side, index: b[side].active, text: nameOf(b, side) + 'は たおれた！' });
    return true;
  }

  // 行動前の状態異常判定。false なら行動できない
  function canAct(b, side, ev) {
    const bt = b[side].battler;
    const inst = bt.inst;
    const n = nameOf(b, side);
    if (inst.status === 'sleep') {
      if ((inst.statusTurns | 0) > 0) {
        inst.statusTurns--;
        ev.push({ type: 'message', side, anim: 'sleep', text: n + 'は ぐうぐう ねむっている' });
        return false;
      }
      inst.status = null;
      inst.statusTurns = 0;
      ev.push({ type: 'status', side, status: null, text: n + 'は めを さました！' });
    }
    if (inst.status === 'freeze') {
      if (b.rng() < 0.2) {
        inst.status = null;
        ev.push({ type: 'status', side, status: null, text: n + 'の こおりが とけた！' });
      } else {
        ev.push({ type: 'message', side, anim: 'freeze', text: n + 'は こおって しまって うごけない！' });
        return false;
      }
    }
    if (bt.flinch) {
      ev.push({ type: 'message', side, anim: 'flinch', text: n + 'は ひるんで わざが だせない！' });
      return false;
    }
    if (inst.status === 'paralyze' && b.rng() < 0.25) {
      ev.push({ type: 'message', side, anim: 'paralyze', text: n + 'は からだが しびれて うごけない！' });
      return false;
    }
    return true;
  }

  function isSelfOnly(move) {
    const eff = effectsOf(move);
    return move.category === 'status' && eff.length > 0 &&
      eff.every((e) => e.kind === 'heal' || (e.kind === 'stat' && e.target === 'self'));
  }

  function rollChance(b, chance) {
    const c = num(chance, 100);
    return c >= 100 || b.rng() * 100 < c;
  }

  // ---------------------------------------------------------------- わざの実行
  // action: { type:'move', index }（index<0 または 使えるわざ無し → わるあがき）
  function execMove(b, side, action, ev) {
    const foeSide = other(side);
    const user = b[side].battler;
    const target = b[foeSide].battler;
    if (fainted(user.inst) || fainted(target.inst)) return;
    user.moved = true;
    if (!canAct(b, side, ev)) return;

    const un = nameOf(b, side);
    const tn = nameOf(b, foeSide);
    let move = null;
    if (!hasUsableMoves(user.inst)) {
      ev.push({ type: 'message', text: un + 'は だせる わざが ない！' });
      move = STRUGGLE;
    } else {
      let idx = action && Number.isInteger(action.index) ? action.index : -1;
      let slot = user.inst.moves[idx];
      if (!slot || !(slot.pp > 0) || !App.data.move(slot.id)) {
        idx = usableMoveIndices(user.inst)[0];
        slot = user.inst.moves[idx];
      }
      move = moveOf(slot.id);
      slot.pp = Math.max(0, slot.pp - 1);
    }
    ev.push({ type: 'move', side, moveId: move.id, name: move.name, moveType: move.type, category: move.category, text: un + 'の ' + move.name + '！' });

    // 命中判定（自分だけに効く変化わざは必中）
    if (!isSelfOnly(move) && move.accuracy > 0) {
      const p = move.accuracy * accStageMult(user.stages.acc) / accStageMult(target.stages.eva);
      if (b.rng() * 100 >= p) {
        ev.push({ type: 'miss', side, text: un + 'の こうげきは はずれた！' });
        return;
      }
    }

    const effects = effectsOf(move);
    if (move.category === 'status' || !(move.power > 0)) {
      execStatusMove(b, side, move, effects, ev);
      return;
    }

    // ---- こうげきわざ
    const eff = typeEffect(move.type, typesOf(target.inst));
    if (eff === 0) {
      ev.push({ type: 'message', text: tn + 'には こうかが ないようだ…' });
      return;
    }
    const mh = effects.find((e) => e.kind === 'multihit');
    const hits = mh ? multiHitCount(mh, b.rng) : 1;
    let total = 0;
    let count = 0;
    for (let i = 0; i < hits; i++) {
      if (fainted(target.inst) || fainted(user.inst)) break;
      const r = calcDamage(user, target, move, { rng: b.rng });
      total += damageSide(b, foeSide, r.damage, ev, { effectiveness: eff, crit: r.crit, moveType: move.type, hit: i, source: 'move' });
      count++;
      if (r.crit) ev.push({ type: 'message', text: 'きゅうしょに あたった！' });
    }
    if (hits > 1) ev.push({ type: 'message', text: count + 'かい あたった！' });
    if (eff > 1) ev.push({ type: 'message', text: 'こうかは ばつぐんだ！' });
    else if (eff < 1) ev.push({ type: 'message', text: 'こうかは いまひとつの ようだ…' });

    // ほのおわざで こおり状態が とける
    if (move.type === 'fire' && target.inst.status === 'freeze' && !fainted(target.inst)) {
      target.inst.status = null;
      ev.push({ type: 'status', side: foeSide, status: null, text: tn + 'の こおりが とけた！' });
    }

    // HP吸収
    for (const e of effects.filter((x) => x.kind === 'drain')) {
      if (total > 0 && !fainted(user.inst)) {
        healSide(b, side, Math.max(1, Math.floor(total * num(e.ratio, 0.5))), ev, tn + 'から たいりょくを すいとった！');
      }
    }
    checkFaint(b, foeSide, ev);

    // 追加効果
    for (const e of effects) {
      if (e.kind === 'status') {
        if (!fainted(target.inst) && rollChance(b, e.chance)) tryInflict(b, foeSide, e.status, ev, { silent: true });
      } else if (e.kind === 'stat') {
        const ts = e.target === 'self' ? side : foeSide;
        if (!fainted(b[ts].battler.inst) && rollChance(b, e.chance)) applyStage(b, ts, e.stat, Math.trunc(num(e.stages, 0)), ev, { silent: true });
      } else if (e.kind === 'flinch') {
        if (!fainted(target.inst) && !target.moved && rollChance(b, e.chance)) target.flinch = true;
      } else if (e.kind === 'heal') {
        if (!fainted(user.inst)) healSide(b, side, Math.max(1, Math.floor(maxHp(user.inst) * num(e.ratio, 0.5))), ev, un + 'の たいりょくが かいふくした！');
      }
    }

    // 反動
    for (const e of effects.filter((x) => x.kind === 'recoil')) {
      if (total > 0 && !fainted(user.inst)) {
        ev.push({ type: 'message', text: un + 'は こうげきの はんどうを うけた！' });
        damageSide(b, side, Math.max(1, Math.floor(total * num(e.ratio, 0.25))), ev, { source: 'recoil' });
      }
    }
    checkFaint(b, side, ev);
  }

  function execStatusMove(b, side, move, effects, ev) {
    const foeSide = other(side);
    const un = nameOf(b, side);
    let shown = false;
    for (const e of effects) {
      if (!rollChance(b, e.chance)) continue;
      if (e.kind === 'stat') {
        shown = applyStage(b, e.target === 'self' ? side : foeSide, e.stat, Math.trunc(num(e.stages, 0)), ev) || shown;
      } else if (e.kind === 'status') {
        shown = tryInflict(b, foeSide, e.status, ev) || shown;
      } else if (e.kind === 'heal') {
        const inst = b[side].battler.inst;
        if (inst.hp >= maxHp(inst)) {
          ev.push({ type: 'message', text: un + 'の HPは まんたんだ！' });
          shown = true;
        } else {
          shown = healSide(b, side, Math.max(1, Math.floor(maxHp(inst) * num(e.ratio, 0.5))), ev, un + 'の たいりょくが かいふくした！') > 0 || shown;
        }
      }
    }
    if (!shown) ev.push({ type: 'message', text: 'しかし うまく きまらなかった！' });
  }

  // ---------------------------------------------------------------- 行動順・逃走
  function actionPriority(b, side, action) {
    if (!action || action.type !== 'move') return 0;
    const inst = b[side].battler.inst;
    if (!hasUsableMoves(inst)) return 0;
    const slot = inst.moves[action.index];
    const m = slot && App.data.move(slot.id);
    return m ? num(m.priority, 0) : 0;
  }
  // 'player' が先なら ['player','enemy']
  function moveOrder(b, playerAction, enemyAction) {
    const pp = actionPriority(b, 'player', playerAction);
    const ep = actionPriority(b, 'enemy', enemyAction);
    let first;
    if (pp !== ep) first = pp > ep ? 'player' : 'enemy';
    else {
      const ps = speedOf(b.player.battler);
      const es = speedOf(b.enemy.battler);
      if (ps !== es) first = ps > es ? 'player' : 'enemy';
      else first = b.rng() < 0.5 ? 'player' : 'enemy';
    }
    return first === 'player' ? ['player', 'enemy'] : ['enemy', 'player'];
  }

  // 現在の試行（attempt 回目）の逃走成功率 0..1
  function escapeChance(b, attempt) {
    if (b.kind !== 'wild') return 0;
    const my = speedOf(b.player.battler);
    const foe = speedOf(b.enemy.battler);
    if (my >= foe) return 1;
    const c = attempt !== undefined ? attempt : b.escapeAttempts + 1;
    return clamp((my * 128 / foe + 30 * c) / 256, 0, 1);
  }

  function attemptEscape(b) {
    if (b.kind !== 'wild') {
      return { success: false, events: [{ type: 'message', text: 'だめだ！ トレーナーとの しょうぶから にげることは できない！' }] };
    }
    b.escapeAttempts++;
    const p = escapeChance(b, b.escapeAttempts);
    const success = p >= 1 || b.rng() < p;
    return {
      success,
      events: [success ? { type: 'run', success: true, text: 'うまく にげきれた！' } : { type: 'run', success: false, text: 'にげられない！' }],
    };
  }

  // ---------------------------------------------------------------- ターン終了
  function endOfTurn(b, ev) {
    const order = speedOf(b.player.battler) >= speedOf(b.enemy.battler) ? ['player', 'enemy'] : ['enemy', 'player'];
    for (const side of order) {
      const inst = b[side].battler.inst;
      if (fainted(inst)) continue;
      if (inst.status === 'poison' || inst.status === 'burn') {
        const n = nameOf(b, side);
        ev.push({ type: 'message', side, anim: inst.status, text: n + 'は ' + (inst.status === 'poison' ? 'どく' : 'やけど') + 'の ダメージを うけている！' });
        damageSide(b, side, Math.max(1, Math.floor(maxHp(inst) / 8)), ev, { source: inst.status });
        checkFaint(b, side, ev);
      }
    }
    b.player.battler.flinch = false;
    b.enemy.battler.flinch = false;
  }

  // ---------------------------------------------------------------- ターン解決
  // playerAction: { type:'move', index } | { type:'switch', index } | { type:'run' }
  // enemyAction: 省略時は AI が選ぶ
  function resolveTurn(b, playerAction, enemyAction) {
    const ev = [];
    if (b.over) return ev;
    b.turn++;
    const P = b.player.battler;
    const E = b.enemy.battler;
    P.moved = false; E.moved = false; P.flinch = false; E.flinch = false;
    playerAction = playerAction || { type: 'move', index: 0 };
    const eAct = enemyAction || chooseEnemyAction(b);

    if (playerAction.type === 'run') {
      const r = attemptEscape(b);
      ev.push(...r.events);
      if (r.success) { b.over = 'run'; return ev; }
      execMove(b, 'enemy', eAct, ev);
    } else if (playerAction.type === 'switch') {
      ev.push(...switchIn(b, 'player', playerAction.index, { voluntary: true }));
      execMove(b, 'enemy', eAct, ev);
    } else {
      const order = moveOrder(b, playerAction, eAct);
      for (const side of order) execMove(b, side, side === 'player' ? playerAction : eAct, ev);
    }
    endOfTurn(b, ev);
    return ev;
  }

  // ---------------------------------------------------------------- 敵AI
  function scoreMove(b, side, idx) {
    const foeSide = other(side);
    const user = b[side].battler;
    const target = b[foeSide].battler;
    const slot = user.inst.moves[idx];
    const move = slot && moveOf(slot.id);
    if (!move) return -999;
    const effects = effectsOf(move);
    const tHp = Math.max(1, target.inst.hp);
    if (move.category !== 'status' && move.power > 0) {
      const r = calcDamage(user, target, move, { crit: false, roll: 92 });
      if (r.effectiveness === 0) return -100;
      const mh = effects.find((e) => e.kind === 'multihit');
      const hits = mh ? (num(mh.min, 2) + num(mh.max, 5)) / 2 : 1;
      const acc = move.accuracy > 0 ? Math.min(100, move.accuracy) / 100 : 1;
      const dmg = r.damage * hits;
      let s = Math.min(dmg / tHp, 1) * 100 * acc;
      if (dmg >= tHp) s += 40 * acc + (num(move.priority, 0) > 0 ? 25 : 0);
      if (r.effectiveness > 1) s += 8;
      if (effects.some((e) => e.kind === 'recoil')) s -= 6;
      return s;
    }
    // 変化わざ
    const uRatio = user.inst.hp / Math.max(1, maxHp(user.inst));
    const tTypes = typesOf(target.inst);
    let s = 0;
    for (const e of effects) {
      if (e.kind === 'stat') {
        const st = (e.target === 'self' ? user : target).stages[e.stat] || 0;
        if (e.target === 'self' && e.stages > 0) s += (st < 2 && uRatio > 0.5) ? 22 - st * 8 : 0;
        else if (e.target !== 'self' && e.stages < 0) s += st > -2 ? 12 + st * 5 : 0;
      } else if (e.kind === 'status') {
        if (!target.inst.status && !statusImmune(e.status, tTypes)) {
          if (e.status === 'sleep') s += 45;
          else if (e.status === 'paralyze') s += 38;
          else if (e.status === 'burn') s += statsOf(target.inst).atk > statsOf(target.inst).spa ? 38 : 24;
          else s += 30;
        }
      } else if (e.kind === 'heal') {
        s += uRatio < 0.5 ? 20 + 70 * (1 - uRatio) : (uRatio < 0.8 ? 6 : -20);
      }
    }
    if (move.accuracy > 0) s *= Math.min(100, move.accuracy) / 100;
    return s;
  }

  function aiScores(b, side) {
    side = side || 'enemy';
    return usableMoveIndices(b[side].battler.inst).map((i) => ({ index: i, score: scoreMove(b, side, i) }));
  }

  function chooseEnemyAction(b) {
    const inst = b.enemy.battler.inst;
    const usable = usableMoveIndices(inst);
    if (!usable.length) return { type: 'move', index: -1 };
    const randomPick = () => ({ type: 'move', index: usable[Math.floor(b.rng() * usable.length)] });
    if (b.ai !== 'smart') return randomPick();
    if (b.rng() < 0.1) return randomPick();
    let best = null;
    for (const s of aiScores(b, 'enemy')) {
      const v = s.score * (0.8 + b.rng() * 0.4);
      if (!best || v > best.v) best = { index: s.index, v };
    }
    return { type: 'move', index: best ? best.index : usable[0] };
  }

  // ---------------------------------------------------------------- 経験値
  // 倒した敵（enemyIndex）の経験値の配分 → [{ index, inst, amount, participant }]
  function expShares(b, enemyIndex) {
    const foe = b.enemy.party[enemyIndex];
    if (!foe) return [];
    const maxLv = num(cfg().maxLevel, 100);
    const y = App.monster.expYield(foe, b.kind === 'trainer');
    const party = b.player.party;
    const part = (b.participants[enemyIndex] || []).filter((i) => party[i] && !fainted(party[i]));
    const out = [];
    const each = part.length ? Math.max(1, Math.floor(y / part.length)) : 0;
    part.forEach((i) => { if (party[i].level < maxLv) out.push({ index: i, inst: party[i], amount: each, participant: true }); });
    const ratio = num(cfg().expShareRatio, 0);
    if (ratio > 0) {
      party.forEach((inst, i) => {
        if (part.includes(i) || fainted(inst) || inst.level >= maxLv) return;
        out.push({ index: i, inst, amount: Math.max(1, Math.floor(y * ratio)), participant: false });
      });
    }
    return out;
  }

  App.battleEngine = {
    STAGE_KEYS, STAT_NAMES, STATUS_NAMES, STATUS_IMMUNE, STRUGGLE,
    // 計算
    stageMult, accStageMult, critRate, typeEffect, typesOf, damageFormula, calcDamage,
    battleStat, speedOf, statusImmune, maxHp, moveOf,
    hasUsableMoves, usableMoveIndices, multiHitCount,
    // 進行
    create, makeBattler, nameOf, switchIn, healthyIndices, nextEnemyIndex, sideDefeated,
    moveOrder, escapeChance, attemptEscape, resolveTurn, execMove,
    applyStage, tryInflict, canAct, endOfTurn,
    // AI・経験値
    chooseEnemyAction, aiScores, scoreMove, expShares,
  };
})();
