// =====================================================================
// App.gacha — ガチャ抽選ロジック（UI なし）
//   レア度抽選（空レア度の按分）・ピックアップ・10連確定・天井・
//   ポイント/無料回数の消費・入手/凸/返還・履歴記録・gacha:pulled 通知。
//   乱数を注入できる roll() と、状態を変えない simulate() はテスト用。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  const GD = () => window.GameData || {};
  const cfg = () => GD().gacha || {};
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const int0 = (v) => Math.max(0, Math.floor(num(v, 0)));

  // ---------------------------------------------------------------- 設定値
  function singleCost() { return int0(cfg().singleCost !== undefined ? cfg().singleCost : 100); }
  function multiCost() { return int0(cfg().multiCost !== undefined ? cfg().multiCost : 1000); }
  function multiCount() { return Math.max(1, int0(cfg().multiCount !== undefined ? cfg().multiCount : 10)); }
  function pityCount() { return int0(cfg().pityCount); }
  function order() { return App.data.rarityOrder(); }
  function rank(r) { return order().indexOf(r); }
  // レア度IDが有効なら返す（無効・null は null）
  function validRarity(r) { return r && rank(r) >= 0 ? r : null; }
  function multiGuarantee() { return validRarity(cfg().multiGuarantee); }
  function pityRarity() { return pityCount() > 0 ? validRarity(cfg().pityRarity) : null; }

  // ---------------------------------------------------------------- バナー
  function banners() {
    const list = Array.isArray(cfg().banners) ? cfg().banners : [];
    return list.filter((b) => b && typeof b === 'object' && b.id);
  }
  function banner(id) {
    const list = banners();
    if (id === undefined || id === null) return list[0] || null;
    return list.find((b) => b.id === id) || null;
  }

  // バナーの対象モンスター（全レア度）
  //   pool: null / [] = gacha !== false の全モンスター、['id', ...] = 列挙したモンスター（gacha フラグより優先）
  function bannerSpecies(b) {
    const valid = (def) => def && App.data.rarity(def.rarity);
    if (b && Array.isArray(b.pool) && b.pool.length) {
      const seen = new Set();
      const out = [];
      for (const id of b.pool) {
        const def = App.data.monster(id);
        if (!valid(def) || seen.has(def.id)) continue;
        seen.add(def.id);
        out.push(def);
      }
      return out;
    }
    return App.data.monsters().filter((def) => valid(def) && def.gacha !== false);
  }

  // pool(bannerId, rarity) → speciesId[]（図鑑番号順）
  function pool(bannerId, rarity) {
    const b = banner(bannerId);
    if (!b) return [];
    return bannerSpecies(b).filter((d) => d.rarity === rarity).map((d) => d.id);
  }

  // ピックアップ対象（pool に含まれるものだけ有効）
  function pickupIds(bannerId) {
    const b = banner(bannerId);
    if (!b || !Array.isArray(b.pickup)) return [];
    const inPool = new Set(bannerSpecies(b).map((d) => d.id));
    return b.pickup.filter((id, i, a) => inPool.has(id) && a.indexOf(id) === i);
  }
  function isPickup(bannerId, speciesId) { return pickupIds(bannerId).includes(speciesId); }
  function pickupRate(bannerId) {
    const b = banner(bannerId);
    return Math.max(0, Math.min(1, num(b && b.pickupRate, 0.5)));
  }

  // ---------------------------------------------------------------- 確率
  // rates(bannerId, minRarity?) → { N: %, ... }（合計100）
  //   対象モンスターが0体のレア度は 0% にして、残りのレア度へ元の比率で按分する。
  //   minRarity を指定すると それ未満も 0% にして按分（10連確定・天井用）。
  function rates(bannerId, minRarity) {
    const b = banner(bannerId);
    const ord = order();
    const out = {};
    ord.forEach((r) => { out[r] = 0; });
    if (!b) return out;
    const species = bannerSpecies(b);
    const minRank = minRarity ? Math.max(0, rank(minRarity)) : 0;
    const has = {};
    species.forEach((d) => { has[d.rarity] = true; });
    const raw = b.rates || {};
    const avail = ord.filter((r, i) => has[r] && i >= minRank);
    let targets = avail;
    if (!targets.length) {
      // 指定レア度以上に対象がいない → 対象がいる最上位レア度で確定
      const any = ord.filter((r) => has[r]);
      if (!any.length) return out;
      targets = [any[any.length - 1]];
    }
    let sum = 0;
    targets.forEach((r) => { sum += Math.max(0, num(raw[r], 0)); });
    if (sum > 0) targets.forEach((r) => { out[r] = Math.max(0, num(raw[r], 0)) / sum * 100; });
    else targets.forEach((r) => { out[r] = 100 / targets.length; });   // 確率未設定なら均等
    return out;
  }

  // 1体ごとの出現率（%）: [{ speciesId, rarity, rate, pickup }]
  function speciesRates(bannerId, minRarity) {
    const rr = rates(bannerId, minRarity);
    const picks = new Set(pickupIds(bannerId));
    const pr = pickupRate(bannerId);
    const out = [];
    for (const r of order()) {
      const ids = pool(bannerId, r);
      if (!ids.length || !rr[r]) {
        ids.forEach((id) => out.push({ speciesId: id, rarity: r, rate: 0, pickup: picks.has(id) }));
        continue;
      }
      const pu = ids.filter((id) => picks.has(id));
      const rest = ids.filter((id) => !picks.has(id));
      const puShare = pu.length ? (rest.length ? pr : 1) : 0;
      ids.forEach((id) => {
        const rate = picks.has(id) ? rr[r] * puShare / pu.length : rr[r] * (1 - puShare) / rest.length;
        out.push({ speciesId: id, rarity: r, rate, pickup: picks.has(id) });
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- 抽選（純粋）
  function pickIndex(rng, n) { return Math.min(n - 1, Math.floor(rng() * n)); }

  // roll(bannerId, rng, minRarity?) → { speciesId, rarity, pickup } | null
  //   状態を一切変えない1回分の抽選。rng は () => [0,1)
  function roll(bannerId, rng, minRarity) {
    rng = typeof rng === 'function' ? rng : Math.random;
    const rr = rates(bannerId, minRarity);
    const ord = order().filter((r) => rr[r] > 0);
    if (!ord.length) return null;
    let x = rng() * 100;
    let rarity = ord[ord.length - 1];
    for (const r of ord) {
      if (x < rr[r]) { rarity = r; break; }
      x -= rr[r];
    }
    const ids = pool(bannerId, rarity);
    if (!ids.length) return null;
    const picks = new Set(pickupIds(bannerId));
    const pu = ids.filter((id) => picks.has(id));
    const rest = ids.filter((id) => !picks.has(id));
    let speciesId;
    let pickup = false;
    if (pu.length && (!rest.length || rng() < pickupRate(bannerId))) {
      speciesId = pu[pickIndex(rng, pu.length)];
      pickup = true;
    } else {
      speciesId = rest[pickIndex(rng, rest.length)];
    }
    return { speciesId, rarity, pickup };
  }

  // 連続抽選（10連確定・天井込み）。ps = { pity } を直接更新する。状態（セーブ）には触れない
  //   opts: { multi: 10連扱いか, guarantee: false で10連確定なし, pity: false で天井なし }
  function drawSeries(bannerId, count, rng, ps, opts) {
    opts = opts || {};
    const out = [];
    const gRar = opts.guarantee === false ? null : multiGuarantee();
    const pRar = opts.pity === false ? null : pityRarity();
    const pc = pityCount();
    let bestRank = -1;
    for (let i = 0; i < count; i++) {
      let min = null;
      let forced = null;
      if (opts.multi && gRar && i === count - 1 && count > 1 && bestRank < rank(gRar)) {
        min = gRar;
        forced = 'guarantee';
      }
      if (pRar && pc > 0 && ps.pity >= pc - 1 && (!min || rank(pRar) >= rank(min))) {
        min = pRar;
        forced = 'pity';
      }
      const res = roll(bannerId, rng, min);
      if (!res) return null;
      res.forced = forced;
      bestRank = Math.max(bestRank, rank(res.rarity));
      if (pRar) ps.pity = rank(res.rarity) >= rank(pRar) ? 0 : ps.pity + 1;
      out.push(res);
    }
    return out;
  }

  // ---------------------------------------------------------------- 天井
  function pityValue() {
    const d = App.state && App.state.data;
    return d && d.gacha ? int0(d.gacha.pity) : 0;
  }
  // pityRemaining() → 確定まであと何回（次の1回で確定なら 1）。天井なしは Infinity
  function pityRemaining() {
    const pc = pityCount();
    if (!pc || !pityRarity()) return Infinity;
    return Math.max(1, pc - pityValue());
  }

  // ---------------------------------------------------------------- 実行
  function costOf(count, free) {
    if (free) return 0;
    if (count === 1) return singleCost();
    if (count === multiCount()) return multiCost();
    return singleCost() * count;
  }

  // canPull(bannerId, count, { free }) → bool
  function canPull(bannerId, count, opts) {
    opts = opts || {};
    const b = banner(bannerId);
    count = Math.floor(num(count, 1));
    if (!b || count < 1 || !App.state || !App.state.data) return false;
    if (!order().some((r) => pool(b.id, r).length)) return false;
    if (opts.free) return count === 1 && App.state.freePulls() > 0;
    return App.state.points() >= costOf(count, false);
  }

  // 不足ポイント（無料なら 0）
  function shortage(bannerId, count) {
    if (!App.state || !App.state.data) return 0;
    return Math.max(0, costOf(Math.floor(num(count, 1)), false) - App.state.points());
  }

  // pull(bannerId, count, { free, rng? }) → results[] | null
  //   results: [{ speciesId, rarity, isNew, limitBreak, refund, pickup, joinedParty, forced }]
  function pull(bannerId, count, opts) {
    opts = opts || {};
    const b = banner(bannerId);
    count = Math.floor(num(count, 1));
    if (!canPull(bannerId, count, opts)) return null;
    const S = App.state;
    const ps = { pity: pityValue() };
    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    // 先に抽選（失敗時は何も消費しない）
    const draws = drawSeries(b.id, count, rng, ps, { multi: count === multiCount() && count > 1 });
    if (!draws || draws.length !== count) return null;
    if (opts.free) {
      if (!S.useFreePull()) return null;
    } else if (!S.spendPoints(costOf(count, false), 'gacha')) {
      return null;
    }
    const firstMonster = S.ownedCount() === 0;
    const results = draws.map((d) => {
      const r = S.addMonster(d.speciesId);
      return {
        speciesId: d.speciesId, rarity: d.rarity, pickup: d.pickup, forced: d.forced,
        isNew: r.isNew, limitBreak: r.limitBreak, refund: r.refund, joinedParty: r.joinedParty,
      };
    });
    if (S.data.gacha) S.data.gacha.pity = ps.pity;
    const at = Date.now();
    S.recordGacha(results.map((r) => ({
      speciesId: r.speciesId, rarity: r.rarity, bannerId: b.id, at,
      isNew: r.isNew, limitBreak: r.limitBreak, refund: r.refund,
    })));
    if (App.events) App.events.emit('gacha:pulled', { bannerId: b.id, results, free: !!opts.free, firstMonster });
    return results;
  }

  // ---------------------------------------------------------------- 統計・シミュレーション
  // stats() → 所持・履歴の集計
  function stats() {
    const d = (App.state && App.state.data) || {};
    const g = d.gacha || { history: [], totalPulls: 0 };
    const byRarity = {};
    order().forEach((r) => { byRarity[r] = 0; });
    (g.history || []).forEach((h) => { if (h && byRarity[h.rarity] !== undefined) byRarity[h.rarity]++; });
    const all = App.data.monsters().filter((m) => m.gacha !== false);
    return {
      totalPulls: int0(g.totalPulls),
      historyCount: (g.history || []).length,
      byRarity,
      pity: pityValue(),
      pityRemaining: pityRemaining(),
      owned: App.state && App.state.data ? App.state.ownedCount() : 0,
      total: all.length,
    };
  }

  // simulate(bannerId, n, opts?) → 集計（ポイント・セーブは一切変更しない）
  //   opts: { mode: 'single'|'multi'（既定 single）, seed: 数値で再現可能, rng, pity: false, guarantee: false, startPity }
  function simulate(bannerId, n, opts) {
    opts = opts || {};
    const b = banner(bannerId);
    if (!b) return null;
    const rng = typeof opts.rng === 'function' ? opts.rng
      : (opts.seed !== undefined ? App.util.mulberry32(Math.floor(num(opts.seed, 1)) >>> 0) : Math.random);
    const multi = opts.mode === 'multi';
    const size = multi ? multiCount() : 1;
    const ps = { pity: int0(opts.startPity) };
    const res = {
      bannerId: b.id, pulls: 0, rarity: {}, species: {}, pickup: 0, pickupByRarity: {},
      forcedGuarantee: 0, forcedPity: 0, maxDry: 0, multiWithoutGuarantee: 0,
    };
    order().forEach((r) => { res.rarity[r] = 0; res.pickupByRarity[r] = 0; });
    const gRar = multiGuarantee();
    const pRar = pityRarity();
    let dry = 0;
    const total = Math.max(0, Math.floor(num(n, 0)));
    while (res.pulls < total) {
      const k = Math.min(size, total - res.pulls);
      const list = drawSeries(b.id, k, rng, ps, { multi: multi && k === size, pity: opts.pity, guarantee: opts.guarantee });
      if (!list) break;
      if (multi && k === size && gRar && !list.some((x) => rank(x.rarity) >= rank(gRar))) res.multiWithoutGuarantee++;
      for (const x of list) {
        res.pulls++;
        res.rarity[x.rarity]++;
        res.species[x.speciesId] = (res.species[x.speciesId] || 0) + 1;
        if (x.pickup) { res.pickup++; res.pickupByRarity[x.rarity]++; }
        if (x.forced === 'guarantee') res.forcedGuarantee++;
        if (x.forced === 'pity') res.forcedPity++;
        if (pRar) {
          dry = rank(x.rarity) >= rank(pRar) ? 0 : dry + 1;
          res.maxDry = Math.max(res.maxDry, dry);
        }
      }
    }
    res.percent = {};
    order().forEach((r) => { res.percent[r] = res.pulls ? res.rarity[r] / res.pulls * 100 : 0; });
    res.endPity = ps.pity;
    return res;
  }

  App.gacha = {
    banners, banner, rates, pool, canPull, pull, pityRemaining,
    // 以下は拡張（SPEC 外）
    roll, simulate, stats, speciesRates, pickupIds, isPickup, pickupRate,
    costOf, shortage, singleCost, multiCost, multiCount, multiGuarantee, pityRarity, pityCount,
    _drawSeries: drawSeries,
  };
})();
