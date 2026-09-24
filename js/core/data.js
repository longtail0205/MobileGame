// =====================================================================
// App.data — GameData アクセサ・データ検証・エディタ上書きの適用
//   GameData はエディタの上書きで丸ごと置き換わることがあるため、
//   常に呼び出し時点の window.GameData を参照する。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const G = () => window.GameData || {};
  const cfg = () => G().config || {};

  // 上書き可能なキーと期待する型
  const OVERRIDE_KEYS = {
    monsters: 'array', moves: 'object', types: 'object', typeChart: 'object', rarities: 'object',
    rarityOrder: 'array', gacha: 'object', trainers: 'object', maps: 'object', worldStart: 'object', tiles: 'object',
  };
  const UNKNOWN_TILE = Object.freeze({ name: '？', draw: 'void', walk: false });

  const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const MOVE_CATEGORIES = ['physical', 'special', 'status'];
  const EFFECT_KINDS = ['stat', 'status', 'heal', 'drain', 'recoil', 'flinch', 'multihit'];
  const EFFECT_STATS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
  const STATUSES = ['poison', 'burn', 'paralyze', 'sleep', 'freeze'];
  const EXP_GROUPS = ['fast', 'medium_fast', 'medium_slow', 'slow'];
  const SHAPES = ['blob', 'biped', 'quadruped', 'bird', 'fish', 'serpent', 'insect', 'plant', 'ghost', 'dragon'];
  const DIRS = ['up', 'down', 'left', 'right'];
  const NPC_MOVES = ['still', 'turn', 'wander'];
  const AIS = ['random', 'smart'];
  const REMATCH = ['never', 'daily'];

  let overrideWarnings = [];
  let overrideInfo = { active: false, keys: [], savedAt: 0, broken: false };

  // ---------------------------------------------------------------- アクセサ
  function monsterList() {
    const m = G().monsters;
    return Array.isArray(m) ? m : [];
  }
  function monster(id) {
    if (id === null || id === undefined) return null;
    const list = monsterList();
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }
  function monsters() {
    return monsterList().filter(Boolean).slice().sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
  }
  function move(id) { const m = G().moves; return (m && id && Object.prototype.hasOwnProperty.call(m, id)) ? m[id] : null; }
  function type(id) { const t = G().types; return (t && id && Object.prototype.hasOwnProperty.call(t, id)) ? t[id] : null; }
  function types() { return Object.keys(G().types || {}); }
  function rarity(id) { const r = G().rarities; return (r && id && Object.prototype.hasOwnProperty.call(r, id)) ? r[id] : null; }
  function rarityOrder() {
    const o = G().rarityOrder;
    if (Array.isArray(o) && o.length) return o.slice();
    return Object.keys(G().rarities || {});
  }
  function rarityRank(id) {
    const i = rarityOrder().indexOf(id);
    return i < 0 ? 0 : i;
  }
  function trainer(id) { const t = G().trainers; return (t && id && Object.prototype.hasOwnProperty.call(t, id)) ? t[id] : null; }
  function map(id) { const m = G().maps; return (m && id && Object.prototype.hasOwnProperty.call(m, id)) ? m[id] : null; }
  function tile(ch) {
    const t = G().tiles;
    return (t && ch !== undefined && Object.prototype.hasOwnProperty.call(t, ch)) ? t[ch] : UNKNOWN_TILE;
  }

  // 攻撃タイプ → 防御側タイプ配列 の倍率（積）。タイプなし（わるあがき等）は 1
  function typeEffect(moveType, defTypes) {
    if (!moveType) return 1;
    const row = (G().typeChart || {})[moveType] || {};
    let mul = 1;
    for (const t of (defTypes || [])) {
      const v = row[t];
      if (typeof v === 'number') mul *= v;
    }
    return mul;
  }

  // そのモンスターが野生で出現する場所
  function encounterLocations(speciesId) {
    const out = [];
    const maps = G().maps || {};
    for (const mapId of Object.keys(maps)) {
      const m = maps[mapId];
      const table = m && m.encounters && Array.isArray(m.encounters.table) ? m.encounters.table : [];
      let entry = null;
      for (const e of table) {
        if (!e || e.species !== speciesId) continue;
        const min = Number(e.min) || 1;
        const max = Number(e.max) || min;
        if (!entry) {
          entry = { mapId, mapName: m.name || mapId, min, max };
          out.push(entry);
        } else {
          entry.min = Math.min(entry.min, min);
          entry.max = Math.max(entry.max, max);
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- 検証
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const isInt = (v) => isNum(v) && Math.floor(v) === v;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function validate() {
    const errors = [];
    const warnings = [];
    const err = (m) => errors.push(m);
    const warn = (m) => warnings.push(m);
    const GD = G();
    const c = cfg();
    const maxLevel = c.maxLevel || 100;

    overrideWarnings.forEach(warn);

    if (!GD.config) err('GameData.config がありません（data/config.js）');

    // ---- タイプ
    const typesObj = isObj(GD.types) ? GD.types : {};
    if (!Object.keys(typesObj).length) err('GameData.types が空です（data/types.js）');
    for (const id of Object.keys(typesObj)) {
      const t = typesObj[id];
      if (!isObj(t)) { err(`[タイプ ${id}] 定義がオブジェクトではありません`); continue; }
      if (!t.name) warn(`[タイプ ${id}] name がありません`);
      if (!t.color) warn(`[タイプ ${id}] color がありません`);
    }
    const chart = isObj(GD.typeChart) ? GD.typeChart : {};
    for (const atk of Object.keys(chart)) {
      if (!typesObj[atk]) warn(`[相性表] 攻撃タイプ "${atk}" は types に存在しません`);
      const row = chart[atk];
      if (!isObj(row)) { warn(`[相性表 ${atk}] オブジェクトではありません`); continue; }
      for (const def of Object.keys(row)) {
        if (!typesObj[def]) warn(`[相性表 ${atk}] 防御タイプ "${def}" は types に存在しません`);
        if (!isNum(row[def]) || row[def] < 0) warn(`[相性表 ${atk}→${def}] 倍率が不正です (${row[def]})`);
      }
    }

    // ---- わざ
    const movesObj = isObj(GD.moves) ? GD.moves : {};
    if (!Object.keys(movesObj).length) err('GameData.moves が空です（data/moves.js）');
    for (const id of Object.keys(movesObj)) {
      const m = movesObj[id];
      const p = `[わざ ${id}]`;
      if (!isObj(m)) { err(`${p} 定義がオブジェクトではありません`); continue; }
      if (!m.name) warn(`${p} name がありません`);
      if (!typesObj[m.type]) err(`${p} タイプ "${m.type}" が types に存在しません`);
      if (!MOVE_CATEGORIES.includes(m.category)) err(`${p} category "${m.category}" が不正です（physical / special / status）`);
      if (m.category === 'status') {
        if (m.power) warn(`${p} status わざの power は 0 にしてください (${m.power})`);
      } else if (MOVE_CATEGORIES.includes(m.category) && !(isNum(m.power) && m.power > 0)) {
        warn(`${p} 攻撃わざの power が正の数ではありません (${m.power})`);
      }
      if (m.accuracy !== undefined && !(isNum(m.accuracy) && m.accuracy >= 0 && m.accuracy <= 100)) warn(`${p} accuracy は 0〜100 にしてください (${m.accuracy})`);
      if (!(isInt(m.pp) && m.pp > 0)) warn(`${p} pp が正の整数ではありません (${m.pp})`);
      if (m.priority !== undefined && !(isInt(m.priority) && m.priority >= -7 && m.priority <= 5)) warn(`${p} priority は -7〜5 にしてください (${m.priority})`);
      if (m.effects !== undefined) {
        if (!Array.isArray(m.effects)) { warn(`${p} effects は配列にしてください`); continue; }
        m.effects.forEach((ef, i) => {
          const q = `${p} effects[${i}]`;
          if (!isObj(ef)) { warn(`${q} がオブジェクトではありません`); return; }
          if (!EFFECT_KINDS.includes(ef.kind)) { warn(`${q} kind "${ef.kind}" は未知です`); return; }
          if (ef.chance !== undefined && !(isNum(ef.chance) && ef.chance > 0 && ef.chance <= 100)) warn(`${q} chance は 1〜100 にしてください`);
          if (ef.kind === 'stat') {
            if (!['self', 'foe'].includes(ef.target)) warn(`${q} target は 'self' か 'foe' にしてください`);
            if (!EFFECT_STATS.includes(ef.stat)) warn(`${q} stat "${ef.stat}" は未知です`);
            if (!(isInt(ef.stages) && ef.stages !== 0 && Math.abs(ef.stages) <= 6)) warn(`${q} stages が不正です (${ef.stages})`);
          } else if (ef.kind === 'status') {
            if (!STATUSES.includes(ef.status)) warn(`${q} status "${ef.status}" は未知です`);
          } else if (ef.kind === 'heal' || ef.kind === 'drain' || ef.kind === 'recoil') {
            if (!(isNum(ef.ratio) && ef.ratio > 0)) warn(`${q} ratio が正の数ではありません`);
          } else if (ef.kind === 'multihit') {
            if (!(isInt(ef.min) && isInt(ef.max) && ef.min >= 1 && ef.min <= ef.max)) warn(`${q} min / max が不正です`);
          }
        });
      }
    }

    // ---- レア度
    const rar = isObj(GD.rarities) ? GD.rarities : {};
    if (!Object.keys(rar).length) err('GameData.rarities が空です（data/gacha.js）');
    const order = Array.isArray(GD.rarityOrder) ? GD.rarityOrder : null;
    if (!order) err('GameData.rarityOrder が配列ではありません（data/gacha.js）');
    else {
      order.forEach((r) => { if (!rar[r]) err(`[rarityOrder] "${r}" が rarities に存在しません`); });
      Object.keys(rar).forEach((r) => { if (!order.includes(r)) warn(`[レア度 ${r}] rarityOrder に含まれていません`); });
    }
    for (const id of Object.keys(rar)) {
      const r = rar[id];
      if (!isObj(r)) { err(`[レア度 ${id}] 定義がオブジェクトではありません`); continue; }
      if (!r.color) warn(`[レア度 ${id}] color がありません`);
      if (r.pointMult !== undefined && !isNum(r.pointMult)) warn(`[レア度 ${id}] pointMult が数値ではありません`);
      if (r.refund !== undefined && !isNum(r.refund)) warn(`[レア度 ${id}] refund が数値ではありません`);
    }

    // ---- モンスター
    const monArr = GD.monsters;
    const monIds = new Set();
    if (!Array.isArray(monArr)) err('GameData.monsters が配列ではありません（data/monsters.js）');
    else {
      if (!monArr.length) err('GameData.monsters が空です');
      const nos = new Map();
      monArr.forEach((m, idx) => {
        if (!isObj(m)) { err(`[モンスター #${idx}] 定義がオブジェクトではありません`); return; }
        const p = `[モンスター ${m.id || '#' + idx}${m.name ? '（' + m.name + '）' : ''}]`;
        if (!m.id || typeof m.id !== 'string') err(`${p} id がありません`);
        else {
          if (!/^[a-z0-9_]+$/.test(m.id)) warn(`${p} id は英小文字・数字・_ のみにしてください`);
          if (monIds.has(m.id)) err(`${p} id "${m.id}" が重複しています`);
          monIds.add(m.id);
        }
        if (!isInt(m.no)) warn(`${p} 図鑑番号 no が整数ではありません (${m.no})`);
        else if (nos.has(m.no)) err(`${p} 図鑑番号 ${m.no} が「${nos.get(m.no)}」と重複しています`);
        else nos.set(m.no, m.id);
        if (!m.name) warn(`${p} name がありません`);
        if (!rar[m.rarity]) err(`${p} レア度 "${m.rarity}" が rarities に存在しません`);
        if (!Array.isArray(m.types) || m.types.length < 1 || m.types.length > 2) err(`${p} types は1〜2個の配列にしてください`);
        else {
          m.types.forEach((t) => { if (!typesObj[t]) err(`${p} タイプ "${t}" が types に存在しません`); });
          if (m.types.length === 2 && m.types[0] === m.types[1]) warn(`${p} types が重複しています`);
        }
        if (!isObj(m.baseStats)) err(`${p} baseStats がありません`);
        else {
          STAT_KEYS.forEach((k) => {
            if (!(isNum(m.baseStats[k]) && m.baseStats[k] > 0)) err(`${p} baseStats.${k} が正の数ではありません (${m.baseStats[k]})`);
          });
        }
        if (!Array.isArray(m.learnset) || !m.learnset.length) err(`${p} learnset がありません`);
        else {
          let hasLv1 = false;
          m.learnset.forEach((l, i) => {
            if (!isObj(l)) { err(`${p} learnset[${i}] がオブジェクトではありません`); return; }
            if (!movesObj[l.move]) err(`${p} learnset のわざ "${l.move}" が moves に存在しません`);
            if (!(isInt(l.lv) && l.lv >= 1 && l.lv <= maxLevel)) warn(`${p} learnset[${i}] の lv が不正です (${l.lv})`);
            if (l.lv === 1 && movesObj[l.move]) hasLv1 = true;
          });
          if (!hasLv1) err(`${p} learnset に lv1 のわざがありません（最低1つ必要）`);
        }
        if (m.expGroup !== undefined && !EXP_GROUPS.includes(m.expGroup)) warn(`${p} expGroup "${m.expGroup}" は未知です（${EXP_GROUPS.join(' / ')}）`);
        if (m.baseExp !== undefined && !(isNum(m.baseExp) && m.baseExp > 0)) warn(`${p} baseExp が正の数ではありません`);
        if (m.image !== undefined && typeof m.image !== 'string') warn(`${p} image は文字列にしてください`);
        if (m.backImage !== undefined && typeof m.backImage !== 'string') warn(`${p} backImage は文字列にしてください`);
        if (m.sprite !== undefined) {
          if (!isObj(m.sprite)) warn(`${p} sprite はオブジェクトにしてください`);
          else {
            if (m.sprite.shape !== undefined && !SHAPES.includes(m.sprite.shape)) warn(`${p} sprite.shape "${m.sprite.shape}" は未知です`);
            if (m.sprite.colors !== undefined && !Array.isArray(m.sprite.colors)) warn(`${p} sprite.colors は配列にしてください`);
          }
        }
      });
    }
    const monById = (id) => (Array.isArray(monArr) ? monArr.find((m) => m && m.id === id) : null);

    // ---- ガチャ
    const gacha = GD.gacha;
    if (!isObj(gacha)) err('GameData.gacha がありません（data/gacha.js）');
    else {
      if (!(isNum(gacha.singleCost) && gacha.singleCost >= 0)) warn('[ガチャ] singleCost が不正です');
      if (!(isNum(gacha.multiCost) && gacha.multiCost >= 0)) warn('[ガチャ] multiCost が不正です');
      if (!(isInt(gacha.multiCount) && gacha.multiCount >= 1)) warn('[ガチャ] multiCount が不正です');
      if (gacha.multiGuarantee !== null && gacha.multiGuarantee !== undefined && !rar[gacha.multiGuarantee]) err(`[ガチャ] multiGuarantee "${gacha.multiGuarantee}" が rarities に存在しません`);
      if (gacha.pityCount && !rar[gacha.pityRarity]) err(`[ガチャ] pityRarity "${gacha.pityRarity}" が rarities に存在しません`);
      if (!(isInt(gacha.maxLimitBreak) && gacha.maxLimitBreak >= 0)) warn('[ガチャ] maxLimitBreak が不正です');
      if (gacha.startLevel !== undefined && !(isInt(gacha.startLevel) && gacha.startLevel >= 1 && gacha.startLevel <= maxLevel)) warn('[ガチャ] startLevel が不正です');
      const gachaMons = Array.isArray(monArr) ? monArr.filter((m) => m && m.gacha !== false) : [];
      if (!gachaMons.length) err('[ガチャ] ガチャ対象のモンスターが1体もいません');
      if (!Array.isArray(gacha.banners) || !gacha.banners.length) err('[ガチャ] banners が空です');
      else {
        const bIds = new Set();
        gacha.banners.forEach((b, idx) => {
          if (!isObj(b)) { err(`[バナー #${idx}] 定義がオブジェクトではありません`); return; }
          const p = `[バナー ${b.id || '#' + idx}]`;
          if (!b.id) err(`${p} id がありません`);
          else if (bIds.has(b.id)) err(`${p} id "${b.id}" が重複しています`);
          bIds.add(b.id);
          if (!b.name) warn(`${p} name がありません`);
          if (!isObj(b.rates)) err(`${p} rates がありません`);
          else {
            let sum = 0;
            for (const r of Object.keys(b.rates)) {
              if (!rar[r]) err(`${p} rates のレア度 "${r}" が rarities に存在しません`);
              const v = b.rates[r];
              if (!(isNum(v) && v >= 0)) err(`${p} rates.${r} が不正です (${v})`);
              else sum += v;
            }
            if (Math.abs(sum - 100) > 0.001) err(`${p} rates の合計が100ではありません（${Math.round(sum * 1000) / 1000}）`);
          }
          let pool = null;
          if (b.pool !== null && b.pool !== undefined) {
            if (!Array.isArray(b.pool)) err(`${p} pool は null か ID の配列にしてください`);
            else {
              b.pool.forEach((id) => { if (!monIds.has(id)) err(`${p} pool のモンスター "${id}" が存在しません`); });
              pool = b.pool.filter((id) => monIds.has(id));
            }
          } else {
            pool = gachaMons.map((m) => m.id);
          }
          if (b.pickup !== undefined) {
            if (!Array.isArray(b.pickup)) err(`${p} pickup は配列にしてください`);
            else {
              b.pickup.forEach((id) => {
                if (!monIds.has(id)) err(`${p} pickup のモンスター "${id}" が存在しません`);
                else if (pool && !pool.includes(id)) warn(`${p} pickup のモンスター "${id}" が pool に含まれていません`);
              });
            }
          }
          if (b.pickupRate !== undefined && !(isNum(b.pickupRate) && b.pickupRate >= 0 && b.pickupRate <= 1)) warn(`${p} pickupRate は 0〜1 にしてください`);
          if (pool && isObj(b.rates)) {
            const avail = Object.keys(b.rates).filter((r) => b.rates[r] > 0 && pool.some((id) => { const m = monById(id); return m && m.rarity === r; }));
            if (!avail.length) err(`${p} このバナーから出るモンスターがいません（pool と rates を確認）`);
          }
        });
      }
    }

    // ---- トレーナー
    const trainersObj = isObj(GD.trainers) ? GD.trainers : {};
    if (GD.trainers !== undefined && !isObj(GD.trainers)) err('GameData.trainers がオブジェクトではありません（data/trainers.js）');
    for (const id of Object.keys(trainersObj)) {
      const t = trainersObj[id];
      const p = `[トレーナー ${id}]`;
      if (!isObj(t)) { err(`${p} 定義がオブジェクトではありません`); continue; }
      if (!t.name) warn(`${p} name がありません`);
      if (!Array.isArray(t.party) || !t.party.length) err(`${p} party が空です`);
      else {
        t.party.forEach((pm, i) => {
          if (!isObj(pm)) { err(`${p} party[${i}] がオブジェクトではありません`); return; }
          if (!monIds.has(pm.species)) err(`${p} party[${i}] のモンスター "${pm.species}" が存在しません`);
          if (!(isInt(pm.level) && pm.level >= 1 && pm.level <= maxLevel)) warn(`${p} party[${i}] の level が不正です (${pm.level})`);
          if (pm.moves !== undefined) {
            if (!Array.isArray(pm.moves)) warn(`${p} party[${i}].moves は配列にしてください`);
            else {
              if (pm.moves.length > 4) warn(`${p} party[${i}].moves は4つまでです`);
              pm.moves.forEach((mv) => { if (!movesObj[mv]) err(`${p} party[${i}] のわざ "${mv}" が存在しません`); });
            }
          }
        });
      }
      if (t.reward !== undefined && !(isNum(t.reward) && t.reward >= 0)) warn(`${p} reward が不正です`);
      if (t.ai !== undefined && !AIS.includes(t.ai)) warn(`${p} ai "${t.ai}" は未知です`);
      if (t.rematch !== undefined && !REMATCH.includes(t.rematch)) warn(`${p} rematch "${t.rematch}" は未知です`);
      ['intro', 'lose', 'win', 'after'].forEach((k) => {
        if (t[k] !== undefined && !Array.isArray(t[k]) && typeof t[k] !== 'string') warn(`${p} ${k} は文字列の配列にしてください`);
      });
    }

    // ---- タイル
    const tilesObj = isObj(GD.tiles) ? GD.tiles : {};
    if (!Object.keys(tilesObj).length) err('GameData.tiles が空です（data/tiles.js）');
    for (const ch of Object.keys(tilesObj)) {
      const t = tilesObj[ch];
      if (!isObj(t)) { err(`[タイル "${ch}"] 定義がオブジェクトではありません`); continue; }
      if (ch.length !== 1) warn(`[タイル "${ch}"] 記号は1文字にしてください`);
      if (!t.draw && !t.image) warn(`[タイル "${ch}"] draw も image もありません`);
    }

    // ---- マップ
    const mapsObj = isObj(GD.maps) ? GD.maps : {};
    if (!Object.keys(mapsObj).length) err('GameData.maps が空です（data/maps.js）');
    const mapSize = (m) => {
      if (!m || !Array.isArray(m.tiles) || !m.tiles.length) return null;
      return { w: String(m.tiles[0] || '').length, h: m.tiles.length };
    };
    const inMap = (m, x, y) => {
      const s = mapSize(m);
      return !!s && isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < s.w && y < s.h;
    };
    const tileAt = (m, x, y) => (inMap(m, x, y) ? String(m.tiles[y])[x] : undefined);
    const walkable = (m, x, y) => { const ch = tileAt(m, x, y); return ch !== undefined && !!(tilesObj[ch] && tilesObj[ch].walk); };
    const pickupIds = new Map();
    for (const mapId of Object.keys(mapsObj)) {
      const m = mapsObj[mapId];
      const p = `[マップ ${mapId}]`;
      if (!isObj(m)) { err(`${p} 定義がオブジェクトではありません`); continue; }
      if (!m.name) warn(`${p} name がありません`);
      if (!Array.isArray(m.tiles) || !m.tiles.length) { err(`${p} tiles が空です`); continue; }
      const w = String(m.tiles[0] || '').length;
      const unknown = new Map();
      m.tiles.forEach((row, y) => {
        if (typeof row !== 'string') { err(`${p} tiles[${y}] が文字列ではありません`); return; }
        if (row.length !== w) err(`${p} ${y}行目の長さ ${row.length} が0行目の長さ ${w} と違います`);
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (!tilesObj[ch] && !unknown.has(ch)) unknown.set(ch, `(${x},${y})`);
        }
      });
      unknown.forEach((pos, ch) => err(`${p} 未知のタイル記号 "${ch}" があります（最初の位置 ${pos}）`));
      if (m.border !== undefined && !tilesObj[m.border]) warn(`${p} border のタイル記号 "${m.border}" が tiles に存在しません`);
      if (m.encounters !== undefined) {
        const enc = m.encounters;
        if (!isObj(enc)) warn(`${p} encounters はオブジェクトにしてください`);
        else {
          if (enc.rate !== undefined && !(isNum(enc.rate) && enc.rate >= 0 && enc.rate <= 1)) warn(`${p} encounters.rate は 0〜1 にしてください`);
          if (!Array.isArray(enc.table) || !enc.table.length) warn(`${p} encounters.table が空です`);
          else {
            enc.table.forEach((e, i) => {
              if (!isObj(e)) { err(`${p} encounters.table[${i}] がオブジェクトではありません`); return; }
              if (!monIds.has(e.species)) err(`${p} 野生モンスター "${e.species}" が存在しません`);
              if (!(isInt(e.min) && isInt(e.max) && e.min >= 1 && e.min <= e.max && e.max <= maxLevel)) warn(`${p} encounters.table[${i}] の min / max が不正です`);
              if (e.weight !== undefined && !(isNum(e.weight) && e.weight > 0)) warn(`${p} encounters.table[${i}] の weight が正の数ではありません`);
            });
          }
        }
      }
      const occupied = new Map();
      (Array.isArray(m.warps) ? m.warps : []).forEach((wp, i) => {
        const q = `${p} warps[${i}]`;
        if (!isObj(wp)) { err(`${q} がオブジェクトではありません`); return; }
        if (!inMap(m, wp.x, wp.y)) err(`${q} の座標 (${wp.x},${wp.y}) がマップ外です`);
        const dest = mapsObj[wp.to];
        if (!dest) err(`${q} のワープ先マップ "${wp.to}" が存在しません`);
        else if (!inMap(dest, wp.tx, wp.ty)) err(`${q} のワープ先座標 (${wp.tx},${wp.ty}) が ${wp.to} の範囲外です`);
        else if (!walkable(dest, wp.tx, wp.ty)) warn(`${q} のワープ先 (${wp.tx},${wp.ty}) は歩けないタイルです`);
        if (wp.dir !== undefined && !DIRS.includes(wp.dir)) warn(`${q} の dir "${wp.dir}" が不正です`);
      });
      const npcIds = new Set();
      (Array.isArray(m.npcs) ? m.npcs : []).forEach((n, i) => {
        if (!isObj(n)) { err(`${p} npcs[${i}] がオブジェクトではありません`); return; }
        const q = `${p} NPC ${n.id || '#' + i}`;
        if (!n.id) warn(`${q} id がありません`);
        else if (npcIds.has(n.id)) warn(`${q} id "${n.id}" がマップ内で重複しています`);
        npcIds.add(n.id);
        if (!inMap(m, n.x, n.y)) err(`${q} の座標 (${n.x},${n.y}) がマップ外です`);
        else {
          const key = n.x + ',' + n.y;
          if (occupied.has(key)) warn(`${q} が ${occupied.get(key)} と同じ座標にいます`);
          occupied.set(key, 'NPC ' + (n.id || '#' + i));
        }
        if (n.trainer !== undefined && !trainersObj[n.trainer]) err(`${q} のトレーナー "${n.trainer}" が trainers に存在しません`);
        if (n.dir !== undefined && !DIRS.includes(n.dir)) warn(`${q} の dir "${n.dir}" が不正です`);
        if (n.move !== undefined && !NPC_MOVES.includes(n.move)) warn(`${q} の move "${n.move}" は未知です`);
        if (n.sight !== undefined && !(isInt(n.sight) && n.sight >= 0)) warn(`${q} の sight が不正です`);
      });
      (Array.isArray(m.signs) ? m.signs : []).forEach((s, i) => {
        if (!isObj(s)) { err(`${p} signs[${i}] がオブジェクトではありません`); return; }
        if (!inMap(m, s.x, s.y)) err(`${p} signs[${i}] の座標 (${s.x},${s.y}) がマップ外です`);
        if (!s.text) warn(`${p} signs[${i}] に text がありません`);
      });
      (Array.isArray(m.pickups) ? m.pickups : []).forEach((pk, i) => {
        if (!isObj(pk)) { err(`${p} pickups[${i}] がオブジェクトではありません`); return; }
        if (!pk.id) err(`${p} pickups[${i}] に id がありません`);
        else if (pickupIds.has(pk.id)) err(`${p} pickup id "${pk.id}" が ${pickupIds.get(pk.id)} と重複しています`);
        else pickupIds.set(pk.id, mapId);
        if (!inMap(m, pk.x, pk.y)) err(`${p} pickups[${i}] の座標 (${pk.x},${pk.y}) がマップ外です`);
        if (!(isNum(pk.points) && pk.points > 0)) warn(`${p} pickups[${i}] の points が正の数ではありません`);
      });
    }

    // ---- 開始位置
    const ws = GD.worldStart;
    if (!isObj(ws)) err('GameData.worldStart がありません（data/maps.js）');
    else if (!mapsObj[ws.map]) err(`[worldStart] マップ "${ws.map}" が存在しません`);
    else if (!inMap(mapsObj[ws.map], ws.x, ws.y)) err(`[worldStart] 座標 (${ws.x},${ws.y}) が ${ws.map} の範囲外です`);
    else if (!walkable(mapsObj[ws.map], ws.x, ws.y)) err(`[worldStart] (${ws.x},${ws.y}) は歩けないタイルです`);
    if (isObj(ws) && ws.dir !== undefined && !DIRS.includes(ws.dir)) warn(`[worldStart] dir "${ws.dir}" が不正です`);

    return { errors, warnings };
  }

  // ---------------------------------------------------------------- エディタ上書き
  function overrideKey() { return cfg().overrideKey || 'gachamon_data_override_v1'; }

  function readOverrideRaw() {
    try { return localStorage.getItem(overrideKey()); } catch (e) { return null; }
  }

  // localStorage の上書きデータで GameData のキーを丸ごと置き換える。適用したキー配列を返す
  function applyOverrides() {
    overrideWarnings = [];
    overrideInfo = { active: false, keys: [], savedAt: 0, broken: false };
    const raw = readOverrideRaw();
    if (!raw) return [];
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      overrideInfo.broken = true;
      overrideWarnings.push('エディタの上書きデータが壊れているため無視しました（' + e.message + '）');
      console.warn('[data] 上書きデータの JSON が壊れています', e);
      return [];
    }
    if (!isObj(obj)) {
      overrideInfo.broken = true;
      overrideWarnings.push('エディタの上書きデータの形式が不正なため無視しました');
      return [];
    }
    const GD = window.GameData = window.GameData || {};
    const applied = [];
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) continue;
      const want = OVERRIDE_KEYS[key];
      if (!want) {
        overrideWarnings.push(`エディタの上書きデータのキー "${key}" は対象外のため無視しました`);
        continue;
      }
      const v = obj[key];
      const ok = want === 'array' ? Array.isArray(v) : isObj(v);
      if (!ok) {
        overrideWarnings.push(`エディタの上書きデータ "${key}" の型が不正なため無視しました`);
        continue;
      }
      GD[key] = v;
      applied.push(key);
    }
    overrideInfo = { active: applied.length > 0, keys: applied, savedAt: Number(obj._savedAt) || 0, broken: false };
    if (applied.length) console.info('[data] エディタの上書きデータを適用:', applied.join(', '));
    return applied;
  }

  function hasOverrides() { return !!readOverrideRaw(); }

  function clearOverrides() {
    try { localStorage.removeItem(overrideKey()); } catch (e) { /* 無視 */ }
    overrideInfo = { active: false, keys: [], savedAt: 0, broken: false };
  }

  App.data = {
    get config() { return cfg(); },
    monster, monsters, move, type, types,
    rarity, rarityOrder, rarityRank,
    trainer, map, tile,
    typeEffect, encounterLocations,
    validate,
    applyOverrides, hasOverrides, clearOverrides,
    // 追加: 上書きの適用状況 { active, keys, savedAt, broken }
    overrideInfo() { return Object.assign({}, overrideInfo, { keys: overrideInfo.keys.slice() }); },
  };
})();
