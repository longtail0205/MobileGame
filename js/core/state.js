// =====================================================================
// App.state — セーブデータ（localStorage）
//   変更系メソッドは save()（デバウンス）とイベント emit を行う。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const SAVE_VERSION = 1;
  const HISTORY_MAX = 200;
  const SAVE_DELAY = 300;
  const STATUSES = ['poison', 'burn', 'paralyze', 'sleep', 'freeze'];
  const DIRS = ['up', 'down', 'left', 'right'];

  let data = null;
  let saveTimer = null;
  let dirty = false;
  let unloadBound = false;
  const loadWarnings = [];

  const cfg = () => (window.GameData && window.GameData.config) || {};
  const gachaCfg = () => (window.GameData && window.GameData.gacha) || {};
  const partyMax = () => cfg().partyMax || 6;
  const saveKey = () => cfg().saveKey || 'gachamon_save_v1';
  const emit = (name, payload) => { if (App.events) App.events.emit(name, payload || {}); };
  const today = () => (App.util ? App.util.today() : new Date().toISOString().slice(0, 10));
  const isPlain = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

  function startPos() {
    const ws = (window.GameData && window.GameData.worldStart) || {};
    return { map: ws.map || '', x: Math.floor(Number(ws.x) || 0), y: Math.floor(Number(ws.y) || 0), dir: DIRS.includes(ws.dir) ? ws.dir : 'down' };
  }

  function defaultData() {
    const c = cfg();
    const sp = startPos();
    return {
      version: SAVE_VERSION,
      createdAt: Date.now(),
      player: { name: '', map: sp.map, x: sp.x, y: sp.y, dir: sp.dir },
      respawn: { map: sp.map, x: sp.x, y: sp.y, dir: sp.dir },
      points: Math.max(0, Math.floor(Number(c.startPoints) || 0)),
      freePulls: Math.max(0, Math.floor(c.freeGachaPulls === undefined ? 3 : Number(c.freeGachaPulls) || 0)),
      collection: {},
      party: [],
      dex: { seen: {}, owned: {} },
      trainers: {},
      pickups: {},
      flags: {},
      gacha: { history: [], pity: 0, totalPulls: 0 },
      stats: { battles: 0, wins: 0, losses: 0, runs: 0, wildWins: 0, trainerWins: 0, pointsEarned: 0, pointsSpent: 0, steps: 0, loginDays: 0 },
      lastLogin: '',
      settings: { textSpeed: 'normal', sound: true, volume: 0.6 },
    };
  }

  // 既定値で欠けたキーを補う深いマージ（型が違う値は既定値に戻す）
  function mergeDefaults(def, src, path, warns) {
    if (!isPlain(src)) {
      if (src !== undefined) warns.push(`セーブデータの ${path || '(root)'} の形式が不正なため初期値に戻しました`);
      return def;
    }
    const out = {};
    for (const k of Object.keys(src)) out[k] = src[k];
    for (const k of Object.keys(def)) {
      const d = def[k];
      const s = src[k];
      const p = path ? path + '.' + k : k;
      if (isPlain(d)) out[k] = mergeDefaults(d, s, p, warns);
      else if (s === undefined) out[k] = d;
      else if (Array.isArray(d)) {
        if (!Array.isArray(s)) { out[k] = d; warns.push(`セーブデータの ${p} の形式が不正なため初期値に戻しました`); }
      } else if (typeof d === 'number') {
        if (typeof s !== 'number' || !isFinite(s)) { out[k] = d; warns.push(`セーブデータの ${p} の形式が不正なため初期値に戻しました`); }
      } else if (typeof d === 'string' || typeof d === 'boolean') {
        if (typeof s !== typeof d) { out[k] = d; warns.push(`セーブデータの ${p} の形式が不正なため初期値に戻しました`); }
      }
    }
    return out;
  }

  // 所持モンスター1体の整合性をとる
  function fixInstance(inst, id) {
    const M = App.monster;
    const maxLv = cfg().maxLevel || 100;
    inst.speciesId = id;
    inst.nickname = typeof inst.nickname === 'string' ? inst.nickname : '';
    inst.level = Math.max(1, Math.min(maxLv, Math.floor(Number(inst.level) || 1)));
    const def = App.data.monster(id);
    const g = (def && def.expGroup) || 'medium_fast';
    const cur = M.expForLevel(inst.level, g);
    const next = inst.level >= maxLv ? Infinity : M.expForLevel(inst.level + 1, g);
    if (!(typeof inst.exp === 'number' && inst.exp >= cur && inst.exp < next)) inst.exp = cur;
    const maxLB = Math.max(0, Math.floor(Number(gachaCfg().maxLimitBreak) || 0));
    inst.limitBreak = Math.max(0, Math.min(maxLB, Math.floor(Number(inst.limitBreak) || 0)));
    let moves = Array.isArray(inst.moves) ? inst.moves.filter((m) => m && App.data.move(m.id)) : [];
    moves = moves.filter((m, i) => moves.findIndex((x) => x.id === m.id) === i).slice(0, 4);
    moves.forEach((m) => {
      const max = M.maxPP(m.id);
      m.pp = Math.max(0, Math.min(max, Math.floor(typeof m.pp === 'number' ? m.pp : max)));
    });
    if (!moves.length) moves = M.create(id, inst.level).moves;
    inst.moves = moves;
    const maxHp = M.stats(inst).hp;
    inst.hp = Math.max(0, Math.min(maxHp, Math.floor(typeof inst.hp === 'number' ? inst.hp : maxHp)));
    if (!STATUSES.includes(inst.status)) inst.status = null;
    inst.statusTurns = Math.max(0, Math.floor(Number(inst.statusTurns) || 0));
    inst.obtainedAt = Number(inst.obtainedAt) || 0;
    return inst;
  }

  function validPos(pos) {
    const m = App.data.map(pos && pos.map);
    if (!m || !Array.isArray(m.tiles) || !m.tiles.length) return false;
    const h = m.tiles.length;
    const w = String(m.tiles[0]).length;
    return Number.isInteger(pos.x) && Number.isInteger(pos.y) && pos.x >= 0 && pos.y >= 0 && pos.x < w && pos.y < h;
  }

  // データ編集で消えた種族などを整理する。警告メッセージ配列を返す
  function sanitize(d) {
    const warns = [];
    const nameOf = (id) => { const m = App.data.monster(id); return m ? m.name : id; };
    // 以前除外したモンスターがデータに戻っていれば復帰
    if (isPlain(d._orphans)) {
      for (const id of Object.keys(d._orphans)) {
        if (App.data.monster(id) && !d.collection[id] && isPlain(d._orphans[id])) {
          d.collection[id] = d._orphans[id];
          delete d._orphans[id];
          warns.push(`「${nameOf(id)}」がデータに戻ったため、所持モンスターに復帰しました`);
        }
      }
    } else {
      delete d._orphans;
    }
    for (const id of Object.keys(d.collection)) {
      const inst = d.collection[id];
      if (!App.data.monster(id) || !isPlain(inst)) {
        if (isPlain(inst)) {
          d._orphans = isPlain(d._orphans) ? d._orphans : {};
          d._orphans[id] = inst;
        }
        delete d.collection[id];
        warns.push(`モンスター "${id}" はデータに存在しないため、所持・パーティから除外しました（データに戻れば復帰します）`);
        continue;
      }
      fixInstance(inst, id);
    }
    if (isPlain(d._orphans) && !Object.keys(d._orphans).length) delete d._orphans;

    const seen = new Set();
    const before = d.party.length;
    d.party = d.party.filter((id) => {
      if (typeof id !== 'string' || !d.collection[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, partyMax());
    if (!d.party.length && Object.keys(d.collection).length) {
      d.party = sortedOwned(d).slice(0, partyMax()).map((i) => i.speciesId);
      if (before) warns.push('パーティが空になったため、所持モンスターから自動で編成しました');
    }
    for (const id of Object.keys(d.collection)) {
      d.dex.owned[id] = true;
      d.dex.seen[id] = true;
    }
    if (d.player.name) {
      if (!validPos(d.player)) {
        Object.assign(d.player, startPos());
        warns.push('プレイヤーの位置がマップ外になったため、開始地点に戻しました');
      }
      if (!validPos(d.respawn)) Object.assign(d.respawn, startPos());
    }
    if (!DIRS.includes(d.player.dir)) d.player.dir = 'down';
    if (!DIRS.includes(d.respawn.dir)) d.respawn.dir = 'down';
    if (d.gacha.history.length > HISTORY_MAX) d.gacha.history = d.gacha.history.slice(-HISTORY_MAX);
    const speeds = Object.keys(cfg().textSpeed || { slow: 1, normal: 1, fast: 1 });
    if (!speeds.includes(d.settings.textSpeed)) d.settings.textSpeed = 'normal';
    d.settings.volume = Math.max(0, Math.min(1, Number(d.settings.volume)));
    d.points = Math.max(0, Math.floor(d.points));
    d.freePulls = Math.max(0, Math.floor(d.freePulls));
    return warns;
  }

  function sortedOwned(d) {
    const nos = (id) => { const m = App.data.monster(id); return m ? Number(m.no) || 0 : 0; };
    return Object.keys(d.collection).map((id) => d.collection[id])
      .sort((a, b) => ((a.obtainedAt || 0) - (b.obtainedAt || 0)) || (nos(a.speciesId) - nos(b.speciesId)));
  }

  function bindUnload() {
    if (unloadBound) return;
    unloadBound = true;
    window.addEventListener('beforeunload', () => { if (dirty) saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) saveNow(); });
  }

  // ---------------------------------------------------------------- 保存・読込
  function load() {
    bindUnload();
    loadWarnings.length = 0;
    let raw = null;
    try { raw = localStorage.getItem(saveKey()); } catch (e) { console.warn('[state] localStorage を読めません', e); }
    if (!raw) {
      data = defaultData();
      emit('state:loaded', {});
      return false;
    }
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!isPlain(parsed)) {
      try { localStorage.setItem(saveKey() + '_broken', raw); } catch (e) { /* 無視 */ }
      loadWarnings.push(`セーブデータが壊れていたため、新しいデータで始めます（壊れたデータは ${saveKey()}_broken に退避しました）`);
      data = defaultData();
      emit('state:loaded', {});
      return false;
    }
    const warns = [];
    data = mergeDefaults(defaultData(), parsed, '', warns);
    warns.push(...sanitize(data));
    loadWarnings.push(...warns);
    if (warns.length) console.warn('[state] セーブデータを補正しました:\n' + warns.join('\n'));
    emit('state:loaded', {});
    return true;
  }

  function save() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!data) return false;
    try {
      localStorage.setItem(saveKey(), JSON.stringify(data));
      dirty = false;
      emit('state:saved', {});
      return true;
    } catch (e) {
      console.warn('[state] セーブに失敗しました', e);
      if (App.ui && App.ui.toast) App.ui.toast('セーブに しっぱいしました', { type: 'error' });
      return false;
    }
  }

  function reset() {
    clearTimeout(saveTimer);
    data = defaultData();
    saveNow();
    emit('state:reset', {});
    emit('points:changed', { points: data.points, delta: 0, reason: 'reset' });
    emit('freepulls:changed', { freePulls: data.freePulls });
    emit('party:changed', { party: data.party.slice() });
  }

  function exportJSON() {
    if (dirty) saveNow();
    return JSON.stringify(data, null, 2);
  }

  function importJSON(str) {
    let parsed;
    try { parsed = typeof str === 'string' ? JSON.parse(str) : str; } catch (e) { return false; }
    if (!isPlain(parsed) || !isPlain(parsed.player) || (parsed.collection !== undefined && !isPlain(parsed.collection))) return false;
    loadWarnings.length = 0;
    const warns = [];
    data = mergeDefaults(defaultData(), parsed, '', warns);
    warns.push(...sanitize(data));
    loadWarnings.push(...warns);
    saveNow();
    emit('state:loaded', {});
    emit('points:changed', { points: data.points, delta: 0, reason: 'import' });
    emit('freepulls:changed', { freePulls: data.freePulls });
    emit('party:changed', { party: data.party.slice() });
    return true;
  }

  // ---------------------------------------------------------------- ポイント
  function points() { return data.points; }

  // n < 0 も可（0 未満にはならない）。獲得統計は正の分だけ加算
  function addPoints(n, reason) {
    n = Math.trunc(Number(n) || 0);
    if (!n) return data.points;
    const before = data.points;
    data.points = Math.max(0, before + n);
    const delta = data.points - before;
    if (delta > 0) data.stats.pointsEarned += delta;
    save();
    emit('points:changed', { points: data.points, delta, reason: reason || '' });
    return data.points;
  }

  function spendPoints(n, reason) {
    n = Math.trunc(Number(n) || 0);
    if (n <= 0) return true;
    if (data.points < n) return false;
    data.points -= n;
    data.stats.pointsSpent += n;
    save();
    emit('points:changed', { points: data.points, delta: -n, reason: reason || '' });
    return true;
  }

  function freePulls() { return data.freePulls; }
  function useFreePull() {
    if (data.freePulls <= 0) return false;
    data.freePulls--;
    save();
    emit('freepulls:changed', { freePulls: data.freePulls });
    return true;
  }
  function addFreePulls(n) {
    data.freePulls = Math.max(0, data.freePulls + Math.trunc(Number(n) || 0));
    save();
    emit('freepulls:changed', { freePulls: data.freePulls });
    return data.freePulls;
  }

  // ---------------------------------------------------------------- 所持モンスター
  function owned(id) { return (data.collection && data.collection[id]) || null; }
  function ownedList() { return sortedOwned(data); }
  function ownedCount() { return Object.keys(data.collection).length; }
  function isOwned(id) { return !!owned(id); }

  function addMonster(speciesId, opts) {
    const def = App.data.monster(speciesId);
    if (!def) throw new Error('App.state.addMonster: 未知のモンスター "' + speciesId + '"');
    opts = opts || {};
    const g = gachaCfg();
    const maxLB = Math.max(0, Math.floor(Number(g.maxLimitBreak) || 0));
    let inst = owned(speciesId);
    let isNew = false;
    let refund = 0;
    let joinedParty = false;
    if (!inst) {
      isNew = true;
      const lv = opts.level !== undefined ? opts.level : (g.startLevel || 5);
      inst = App.monster.create(speciesId, lv, { moves: opts.moves });
      if (opts.nickname) inst.nickname = String(opts.nickname);
      data.collection[speciesId] = inst;
      const wasSeen = !!data.dex.seen[speciesId];
      data.dex.seen[speciesId] = true;
      data.dex.owned[speciesId] = true;
      if (data.party.length < partyMax()) {
        data.party.push(speciesId);
        joinedParty = true;
      }
      save();
      emit('dex:changed', { speciesId, seen: true, owned: true, newlySeen: !wasSeen });
      emit('collection:changed', { speciesId, isNew: true, limitBreak: 0, refund: 0 });
      if (joinedParty) emit('party:changed', { party: data.party.slice() });
    } else if (inst.limitBreak < maxLB) {
      const hpBefore = App.monster.stats(inst).hp;
      inst.limitBreak++;
      const hpAfter = App.monster.stats(inst).hp;
      if (inst.hp > 0) inst.hp = Math.min(hpAfter, inst.hp + Math.max(0, hpAfter - hpBefore));
      save();
      emit('collection:changed', { speciesId, isNew: false, limitBreak: inst.limitBreak, refund: 0 });
      emit('monster:updated', { speciesId });
    } else {
      const r = App.data.rarity(def.rarity);
      refund = Math.max(0, Math.floor(Number(r && r.refund) || 0));
      emit('collection:changed', { speciesId, isNew: false, limitBreak: inst.limitBreak, refund });
      if (refund) addPoints(refund, 'refund');
      else save();
    }
    return { inst, isNew, limitBreak: inst.limitBreak, refund, joinedParty };
  }

  // ---------------------------------------------------------------- パーティ
  function partyIds() { return data.party.slice(); }
  function party() { return data.party.map((id) => data.collection[id]).filter(Boolean); }
  function emitParty() { save(); emit('party:changed', { party: data.party.slice() }); }

  // 所持している ID のみ・重複除去・最大 partyMax。所持モンスターがいるのに空にはできない
  function setParty(ids) {
    const seen = new Set();
    const next = (Array.isArray(ids) ? ids : []).filter((id) => {
      if (!owned(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, partyMax());
    if (!next.length && ownedCount() > 0) return false;
    data.party = next;
    emitParty();
    return true;
  }
  function addToParty(id) {
    if (!owned(id) || data.party.includes(id) || data.party.length >= partyMax()) return false;
    data.party.push(id);
    emitParty();
    return true;
  }
  // 最後の1体は外せない（false を返す）
  function removeFromParty(id) {
    const i = data.party.indexOf(id);
    if (i < 0 || data.party.length <= 1) return false;
    data.party.splice(i, 1);
    emitParty();
    return true;
  }
  function moveInParty(from, to) {
    const n = data.party.length;
    if (!(from >= 0 && from < n && to >= 0 && to < n) || from === to) return false;
    const [id] = data.party.splice(from, 1);
    data.party.splice(to, 0, id);
    emitParty();
    return true;
  }
  function firstHealthy() { return party().find((i) => i.hp > 0) || null; }
  function hasHealthy() { return !!firstHealthy(); }

  function healAll() {
    for (const inst of Object.values(data.collection)) {
      const max = App.monster.stats(inst).hp;
      const needs = inst.hp < max || inst.status || (inst.moves || []).some((m) => m.pp < App.monster.maxPP(m.id));
      App.monster.heal(inst);
      if (needs) emit('monster:updated', { speciesId: inst.speciesId });
    }
    save();
  }

  // ---------------------------------------------------------------- 図鑑・フラグ等
  function markSeen(id) {
    if (!App.data.monster(id) || data.dex.seen[id]) return;
    data.dex.seen[id] = true;
    save();
    emit('dex:changed', { speciesId: id, seen: true, owned: !!data.dex.owned[id], newlySeen: true });
  }
  function isSeen(id) { return !!data.dex.seen[id]; }

  function flag(key) { return data.flags[key]; }
  function setFlag(key, value) { data.flags[key] = value; save(); }

  function isTrainerDefeated(id) {
    const date = data.trainers[id];
    if (!date) return false;
    const t = App.data.trainer(id);
    if (t && t.rematch === 'daily') return date === today();
    return true;
  }
  function setTrainerDefeated(id) { data.trainers[id] = today(); save(); }

  function isPickupTaken(id) { return !!data.pickups[id]; }
  function takePickup(id) { data.pickups[id] = true; save(); }

  function setPlayerPos(map, x, y, dir) {
    const p = data.player;
    p.map = map; p.x = x; p.y = y;
    if (dir) p.dir = dir;
    save();
  }
  function setRespawn(map, x, y, dir) {
    data.respawn = { map, x, y, dir: dir || 'down' };
    save();
  }
  function setPlayerName(name) {
    data.player.name = String(name || '').trim();
    save();
    emit('player:renamed', { name: data.player.name });
  }

  function setting(key) { return data.settings[key]; }
  function setSetting(key, value) {
    data.settings[key] = value;
    save();
    emit('settings:changed', { key, value });
  }

  // entries: [{ speciesId, rarity, bannerId, at?, isNew, limitBreak, refund }]
  //   履歴は古い順に追加し、最新 200 件を保持。totalPulls も加算する（pity は App.gacha が管理）
  function recordGacha(entries) {
    const list = Array.isArray(entries) ? entries : [entries];
    const now = Date.now();
    for (const e of list) {
      if (!e) continue;
      data.gacha.history.push({
        speciesId: e.speciesId, rarity: e.rarity, bannerId: e.bannerId || '', at: e.at || now,
        isNew: !!e.isNew, limitBreak: e.limitBreak || 0, refund: e.refund || 0,
      });
    }
    if (data.gacha.history.length > HISTORY_MAX) data.gacha.history = data.gacha.history.slice(-HISTORY_MAX);
    data.gacha.totalPulls += list.filter(Boolean).length;
    save();
  }

  function incStat(key, n) {
    const add = n === undefined ? 1 : Number(n) || 0;
    data.stats[key] = (Number(data.stats[key]) || 0) + add;
    save();
  }

  function isNewGame() { return !data || !data.player || !data.player.name; }

  App.state = {
    get data() { return data; },
    get loadWarnings() { return loadWarnings.slice(); },
    load, save, saveNow, reset, isNewGame,
    points, addPoints, spendPoints,
    freePulls, useFreePull, addFreePulls,
    owned, ownedList, ownedCount, addMonster,
    party, partyIds, setParty, addToParty, removeFromParty, moveInParty,
    firstHealthy, hasHealthy, healAll,
    markSeen, isSeen, isOwned,
    flag, setFlag,
    isTrainerDefeated, setTrainerDefeated,
    isPickupTaken, takePickup,
    setPlayerPos, setRespawn, setPlayerName,
    setting, setSetting,
    recordGacha, incStat,
    exportJSON, importJSON,
    defaultData,
  };
})();
