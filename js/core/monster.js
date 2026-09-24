// =====================================================================
// App.monster — 個体生成・能力値・経験値（純粋関数。セーブや UI は触らない）
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const cfg = () => (window.GameData && window.GameData.config) || {};
  const gachaCfg = () => (window.GameData && window.GameData.gacha) || {};
  const maxLevel = () => cfg().maxLevel || 100;
  const species = (idOrInst) => {
    if (!idOrInst) return null;
    const id = typeof idOrInst === 'string' ? idOrInst : idOrInst.speciesId;
    return App.data.monster(id);
  };

  function maxPP(moveId) {
    const m = App.data.move(moveId);
    if (!m) return 0;
    return Math.max(1, Math.floor(Number(m.pp) || 0));
  }

  // 指定レベルまでに覚えるわざ（lv 昇順・重複除去・存在するわざのみ）
  function learnsetUpTo(def, level) {
    const list = (def && Array.isArray(def.learnset) ? def.learnset : [])
      .map((l, i) => ({ lv: Number(l && l.lv) || 1, move: l && l.move, i }))
      .filter((l) => l.lv <= level && App.data.move(l.move))
      .sort((a, b) => (a.lv - b.lv) || (a.i - b.i));
    const out = [];
    for (const l of list) if (!out.includes(l.move)) out.push(l.move);
    return out;
  }

  function expForLevel(level, group) {
    const n = Math.floor(Number(level) || 1);
    if (n <= 1) return 0;
    const n3 = n * n * n;
    switch (group) {
      case 'fast': return Math.floor((4 * n3) / 5);
      case 'medium_slow': return Math.max(0, Math.floor((6 * n3) / 5 - 15 * n * n + 100 * n - 140));
      case 'slow': return Math.floor((5 * n3) / 4);
      default: return n3;   // medium_fast（省略・未知も含む）
    }
  }

  function groupOf(inst) {
    const def = species(inst);
    return (def && def.expGroup) || 'medium_fast';
  }

  function stats(inst) {
    const def = species(inst);
    if (!def || !def.baseStats) return { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };
    const L = Math.floor(Number(inst.level) || 1);
    const iv = Number(cfg().iv) || 0;
    const lbBonus = Number(gachaCfg().limitBreakBonus) || 0;
    // 浮動小数の誤差（例: 70 * 1.2 = 83.999…）を避けるため 1/10000 単位の整数で掛ける
    const multBp = 10000 + Math.round(lbBonus * (Number(inst.limitBreak) || 0) * 10000);
    const out = {};
    for (const k of STAT_KEYS) {
      const B = Number(def.baseStats[k]) || 1;
      const raw = k === 'hp'
        ? Math.floor(((2 * B + iv) * L) / 100) + L + 10
        : Math.floor(((2 * B + iv) * L) / 100) + 5;
      out[k] = Math.floor((raw * multBp) / 10000);
    }
    return out;
  }

  function create(speciesId, level, opts) {
    const def = App.data.monster(speciesId);
    if (!def) throw new Error('App.monster.create: 未知のモンスター "' + speciesId + '"');
    opts = opts || {};
    const L = Math.max(1, Math.min(maxLevel(), Math.floor(Number(level) || 1)));
    const learnable = learnsetUpTo(def, L);
    let moveIds = Array.isArray(opts.moves) ? opts.moves.filter((id) => App.data.move(id)) : [];
    moveIds = moveIds.filter((id, i) => moveIds.indexOf(id) === i).slice(0, 4);
    if (!moveIds.length) moveIds = learnable.slice(-4);
    if (!moveIds.length) {
      // learnset が壊れていても戦えるように
      const any = (def.learnset || []).map((l) => l && l.move).find((id) => App.data.move(id));
      if (any) moveIds = [any];
    }
    const inst = {
      speciesId: def.id,
      nickname: '',
      level: L,
      exp: expForLevel(L, def.expGroup || 'medium_fast'),
      limitBreak: Math.max(0, Math.floor(Number(opts.limitBreak) || 0)),
      hp: 1,
      status: null,
      statusTurns: 0,
      moves: moveIds.map((id) => ({ id, pp: maxPP(id) })),
      obtainedAt: Date.now(),
    };
    inst.hp = stats(inst).hp;
    return inst;
  }

  function expProgress(inst) {
    const L = inst.level;
    if (L >= maxLevel()) return 1;
    const g = groupOf(inst);
    const cur = expForLevel(L, g);
    const next = expForLevel(L + 1, g);
    if (next <= cur) return 1;
    return Math.max(0, Math.min(1, (inst.exp - cur) / (next - cur)));
  }

  function expToNext(inst) {
    if (inst.level >= maxLevel()) return 0;
    return Math.max(0, expForLevel(inst.level + 1, groupOf(inst)) - inst.exp);
  }

  function isFainted(inst) { return !inst || !(inst.hp > 0); }

  function addExp(inst, amount) {
    const g = groupOf(inst);
    const def = species(inst);
    const oldLevel = inst.level;
    const statsBefore = stats(inst);
    const learned = [];
    const pending = [];
    const cap = maxLevel();
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (inst.level < cap) {
      inst.exp = (Number(inst.exp) || 0) + add;
      while (inst.level < cap && inst.exp >= expForLevel(inst.level + 1, g)) {
        inst.level++;
        const newMoves = (def && Array.isArray(def.learnset) ? def.learnset : [])
          .filter((l) => l && Number(l.lv) === inst.level && App.data.move(l.move))
          .map((l) => l.move);
        for (const id of newMoves) {
          if (inst.moves.some((m) => m.id === id) || pending.includes(id)) continue;
          if (inst.moves.length < 4) {
            inst.moves.push({ id, pp: maxPP(id) });
            learned.push(id);
          } else {
            pending.push(id);
          }
        }
      }
      if (inst.level >= cap) inst.exp = expForLevel(cap, g);
    }
    const statsAfter = stats(inst);
    if (!isFainted(inst)) {
      inst.hp = Math.min(statsAfter.hp, inst.hp + Math.max(0, statsAfter.hp - statsBefore.hp));
    }
    return {
      oldLevel,
      newLevel: inst.level,
      levelsGained: inst.level - oldLevel,
      learned,
      pending,
      statsBefore,
      statsAfter,
    };
  }

  function learnableMoves(inst) {
    return learnsetUpTo(species(inst), inst.level);
  }

  function setMoves(inst, moveIds) {
    if (!Array.isArray(moveIds) || moveIds.length < 1 || moveIds.length > 4) return false;
    if (new Set(moveIds).size !== moveIds.length) return false;
    const learnable = learnableMoves(inst);
    if (!moveIds.every((id) => learnable.includes(id))) return false;
    const old = new Map((inst.moves || []).map((m) => [m.id, m.pp]));
    inst.moves = moveIds.map((id) => ({ id, pp: old.has(id) ? Math.min(old.get(id), maxPP(id)) : maxPP(id) }));
    return true;
  }

  function heal(inst) {
    inst.hp = stats(inst).hp;
    inst.status = null;
    inst.statusTurns = 0;
    (inst.moves || []).forEach((m) => { m.pp = maxPP(m.id); });
    return inst;
  }

  function displayName(inst) {
    if (!inst) return '';
    if (inst.nickname) return inst.nickname;
    const def = species(inst);
    return def ? (def.name || def.id) : String(inst.speciesId || '？？？');
  }

  function expYield(inst, isTrainer) {
    const def = species(inst);
    const baseExp = def && isFinite(def.baseExp) ? Number(def.baseExp) : 50;
    const mult = isFinite(cfg().expMultiplier) ? Number(cfg().expMultiplier) : 1;
    return Math.floor(baseExp * inst.level / 7 * (isTrainer ? 1.5 : 1) * mult);
  }

  function wildPoints(inst) {
    const def = species(inst);
    const rw = cfg().rewards || {};
    const r = def ? App.data.rarity(def.rarity) : null;
    const mult = r && isFinite(r.pointMult) ? Number(r.pointMult) : 1;
    return Math.round(((Number(rw.wildBase) || 0) + (Number(rw.wildPerLevel) || 0) * inst.level) * mult);
  }

  App.monster = {
    create, stats,
    expForLevel, expProgress, expToNext, addExp,
    learnableMoves, setMoves,
    heal, isFainted, maxPP,
    displayName, expYield, wildPoints,
    // 追加: 個体 or ID から種族定義を得る
    species,
  };
})();
