// =====================================================================
// タイル描画（App.tiles）— graphics 担当
//   16x16 のマップタイルを自動生成ドット絵（GBA R/S 風の明るいパレット）で描く。
//   周囲の記号（at(dx,dy)）を見て、岸・道の縁・屋根の端/棟・木のつながり・壁の面 などを描き分ける。
//   静的タイル: (draw名 + 周囲シグネチャ) でオフスクリーン canvas をキャッシュ。
//   アニメタイル: 少数フレームをキャッシュ（水・花・ガチャマシン・回復マシン）。
//   依存: GameData.tiles と App.sprites.getImage（画像タイル用・任意）のみ。App.util には依存しない。
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = 16;

  // ------------------------------------------------------------------ 色・乱数
  function K(h) {
    h = String(h).replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function pal(o) {
    const r = {};
    for (const k of Object.keys(o)) r[k] = Array.isArray(o[k]) ? o[k].map(K) : K(o[k]);
    return r;
  }
  function mix(a, b, t) { return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)); }
  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];
  function hs(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------ 16x16 ピクセルバッファ
  class Buf {
    constructor() {
      this.d = new Uint8ClampedArray(S * S * 4);
      this.m = new Uint8Array(S * S);   // 汎用マスク（形状・陰影段階など）
    }
    px(x, y, c, a) {
      x |= 0; y |= 0;
      if (!c || x < 0 || y < 0 || x >= S || y >= S) return;
      const i = (y * S + x) * 4;
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a == null ? 255 : a;
    }
    pxw(x, y, c) { this.px(((x % S) + S) % S, ((y % S) + S) % S, c); }
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
    fill(c) { this.rect(0, 0, S, S, c); }
    get(x, y) { const i = (y * S + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
    alpha(x, y) { return this.d[(y * S + x) * 4 + 3]; }
    copy(src) { this.d.set(src.d); }
    copyPx(src, x, y) { const i = (y * S + x) * 4; for (let k = 0; k < 4; k++) this.d[i + k] = src.d[i + k]; }
    // rows: 文字列配列。map: 文字→色（未定義の文字は透過＝描かない）
    pat(ox, oy, rows, map) {
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];
        for (let i = 0; i < r.length; i++) { const c = map[r[i]]; if (c) this.px(ox + i, oy + j, c); }
      }
    }
    darken(x, y, t) { if (x < 0 || y < 0 || x >= S || y >= S) return; this.px(x, y, mix(this.get(x, y), BLACK, t), this.alpha(x, y)); }
    canvas() {
      const cv = document.createElement('canvas');
      cv.width = S; cv.height = S;
      const ctx = cv.getContext('2d');
      const id = ctx.createImageData(S, S);
      id.data.set(this.d);
      ctx.putImageData(id, 0, 0);
      return cv;
    }
  }

  // 形状を陰影付きで塗る。test(x,y) → 法線 [nx,ny]（形状外は null）。cols=[輪郭,暗,中,明,ハイライト]
  function shade(b, test, cols, opt) {
    opt = opt || {};
    const M = new Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) M[y * S + x] = test(x, y);
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= S || y >= S) return opt.edge ? !!opt.edge(x, y) : false;
      return !!M[y * S + x];
    };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = M[y * S + x];
        if (!n) continue;
        let idx;
        if (opt.outline !== false && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) idx = 0;
        else {
          const l = -(n[0] * 0.62 + n[1] * 0.78) + (opt.bias || 0);
          idx = l > 0.62 ? 4 : l > 0.14 ? 3 : l > -0.42 ? 2 : 1;
        }
        b.px(x, y, cols[idx]);
        b.m[y * S + x] = idx + 1;
      }
    }
    return M;
  }
  function ell(cx, cy, rx, ry, wob, lobes) {
    return (x, y) => {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      let r = 1;
      if (wob) r += wob * Math.cos(Math.atan2(ny, nx) * (lobes || 7));
      return nx * nx + ny * ny <= r * r ? [nx, ny] : null;
    };
  }
  function union() {
    const tests = Array.prototype.slice.call(arguments);
    return (x, y) => { for (let i = tests.length - 1; i >= 0; i--) { const n = tests[i](x, y); if (n) return n; } return null; };
  }
  // 岩塊の集まりを横方向に継ぎ目なく（左右のタイルへ回り込むように）陰影付きで塗る。list: [[cx,cy,rx,ry],...]
  function lumpShade(b, list, cols) {
    const parts = [];
    for (const [cx, cy, rx, ry] of list) {
      parts.push(ell(cx, cy, rx, ry));
      if (cx - rx < 0) parts.push(ell(cx + S, cy, rx, ry));
      if (cx + rx > S) parts.push(ell(cx - S, cy, rx, ry));
    }
    const test = union.apply(null, parts);
    shade(b, test, cols, { bias: 0.05, edge: (x, y) => y >= 0 && y < S && !!test(((x % S) + S) % S, y) });
  }
  function bits() { let s = '';for (let i = 0; i < arguments.length; i++) s += arguments[i] ? '1' : '0'; return s; }

  // ------------------------------------------------------------------ パレット
  const GR = pal({ base: '#84cc64', light: '#b4e88c', dark: '#64ac4c', deep: '#4c9040', shadow: '#5c9e48' });
  const TG = pal({ out: '#245c24', dark: '#347c30', mid: '#54a440', light: '#78c450', hl: '#a4e474' });
  const PA = pal({ base: '#e4c48c', light: '#f4dcac', dark: '#c8a46c', edge: '#b48c58', speck: '#d4b078' });
  const SA = pal({ base: '#f4e4ac', light: '#fcf4d4', dark: '#dcc890', edge: '#c8b078', speck: '#e4d09a' });
  const WA = pal({ base: '#5898f0', deep: '#4480e0', light: '#90c8fc', foam: '#d4eeff', edge: '#3060b8', white: '#f8fcff' });
  const TR = pal({ out: '#1c4428', dark: '#2c6c3c', mid: '#3c8c48', light: '#5cac58', hl: '#8cd070', trunk: '#8c5c34', trunkD: '#5c3820', trunkL: '#b47c48', floor: '#2c5c34' });
  const FW = pal({ red: '#f45058', redD: '#b82c40', yel: '#fcdc40', yelD: '#c8a020', wht: '#fcfcfc', whtD: '#c4c8e0', ctr: '#f8b030', ctrR: '#fcf080', stem: '#3c9038' });
  const BR = pal({ out: '#5c3818', dark: '#946038', mid: '#c48c54', light: '#e4b478', post: '#7c4c28' });
  const FE = pal({ out: '#5c3c1c', dark: '#a86c3c', mid: '#d4a468', light: '#f4d8a0' });
  const RK = pal({ out: '#4c4850', dark: '#7c7884', mid: '#a8a4b0', light: '#d0ccd8', hl: '#f0eef4' });
  const SG = pal({ out: '#5c3818', dark: '#9c6430', mid: '#cc9050', light: '#ecbc74', text: '#6c4420' });
  const CL = pal({ out: '#5c3c28', dark: '#8c6040', mid: '#b88454', light: '#d8a870', hl: '#ecc890' });
  const ROOF = {
    roofHouse: pal({ out: '#243060', dark: '#3a509c', mid: '#5070c4', light: '#7898e0', hl: '#b0c8f4' }),
    roofCenter: pal({ out: '#6c1424', dark: '#b02838', mid: '#e04450', light: '#f47478', hl: '#fcb0a8' }),
    roofShop: pal({ out: '#3c1c5c', dark: '#6c3c9c', mid: '#8c58c0', light: '#ac80dc', hl: '#d4b0f4', trim: '#f8c848', trimD: '#b88818' }),
    roofGym: pal({ out: '#303438', dark: '#545c64', mid: '#78808a', light: '#9ca4ae', hl: '#c4ccd2', trim: '#30bca8', trimD: '#1c7c70' }),
  };
  const ROOF_KIND = { roofHouse: 'house', roofCenter: 'center', roofShop: 'shop', roofGym: 'gym' };
  const WALLK = {
    house: pal({ base: '#f4e4c4', light: '#fcf4e0', dark: '#dcc8a0', shade: '#b8a07c', out: '#6c5038', trim: '#a87848', found: '#a4a4ac', foundD: '#6c6c78' }),
    center: pal({ base: '#f8f8f4', light: '#ffffff', dark: '#dcdcd8', shade: '#b4b4bc', out: '#585866', trim: '#e04450', found: '#a4a4ac', foundD: '#6c6c78' }),
    shop: pal({ base: '#f4ecfc', light: '#fffcff', dark: '#dcd0e8', shade: '#b4a4c8', out: '#5c4c6c', trim: '#8c58c0', found: '#a4a4ac', foundD: '#6c6c78' }),
    gym: pal({ base: '#dce0dc', light: '#f0f4f0', dark: '#bcc0bc', shade: '#9ca09c', out: '#444a4c', trim: '#30bca8', found: '#8c9094', foundD: '#5c6064' }),
  };
  const GL = pal({ base: '#74b4ec', light: '#c8e8ff', dark: '#4c88c8', frame: '#fcfcfc', frameD: '#c4c8d4' });
  const DW = pal({ base: '#b8743c', dark: '#8c5028', light: '#d8985c', out: '#4c2c18', knob: '#f8d048' });
  const FL = pal({ base: '#ecd0a0', light: '#f8e0b8', dark: '#d8b884', seam: '#bc9860' });
  const RG = pal({ base: '#c84c58', dark: '#9c3444', light: '#e4747c', border: '#f4c458', borderD: '#b08434' });
  const WI = pal({ paper: '#f4e8cc', paperD: '#e0d0ac', paperL: '#fcf4e0', trim: '#b0845c', trimD: '#7c5634', trimL: '#d4a87c', top: '#4c3c34', topD: '#2c2420', topL: '#8c7464' });
  const CT = pal({ top: '#f8f0dc', topD: '#dcccb0', front: '#b87444', frontD: '#8c5030', frontL: '#d89464', out: '#4c2c18' });
  const TB = pal({ top: '#d4a064', topL: '#ecc088', topD: '#a87444', out: '#5c3820', leg: '#8c5c34' });
  const BS = pal({ frame: '#9c6434', frameD: '#6c4020', frameL: '#c08850', back: '#503020', out: '#3c2414', books: ['#d44c4c', '#4c7cd4', '#4cac5c', '#e4b444', '#a45cc4', '#e47c3c', '#44b4b4'] });
  const PL = pal({ pot: '#d07048', potD: '#a04c30', potL: '#ec9c70', out: '#3c2418', lout: '#1c4c24', ldark: '#2c7c38', lmid: '#44a048', llight: '#6cc458', lhl: '#9ce07c' });
  const BD = pal({ frame: '#a86c3c', frameD: '#744424', frameL: '#c89060', out: '#4c2c18', pillow: '#fcfcfc', pillowD: '#d0d4e4', sheet: '#5c8ce0', sheetD: '#3c64b8', sheetL: '#8cb4f4' });
  const MT = pal({ base: '#d05848', dark: '#a03830', light: '#ec8870', out: '#702820' });
  const GC = pal({ body: '#e8405a', bodyD: '#b02440', bodyL: '#ff7c90', gold: '#f8c848', goldD: '#c89020', goldL: '#fff0a0', glass: '#dcf2ff', glassD: '#a8d0f0', hl: '#ffffff', out: '#3c1828', dark: '#2c1c24', silver: '#d4d8e0', silverD: '#8c94a0' });
  const CAPS = ['#f04848', '#4880f0', '#f8d030', '#48c060', '#c060e0', '#ff9030'].map(K);
  const HM = pal({ body: '#f4f4f8', bodyD: '#c4c8d4', bodyL: '#ffffff', out: '#3c4454', screen: '#1c5c44', glow: '#58f0a0', glow2: '#c0ffe0', pink: '#f07898', pinkL: '#ffb0c8', slot: '#8890a0', slotD: '#5c6474' });
  const CV = pal({ base: '#ac8c6c', light: '#c8a884', dark: '#8c6c54', deep: '#6c5444' });
  const CVS = pal({ base: '#bea282', light: '#d6bc98', dark: '#a2866a', deep: '#826a52' });
  const CW = pal({ face: '#8c6c54', faceD: '#6c5040', faceL: '#ac8c6c', faceH: '#c8a884', top: '#584434', topD: '#3c2c24', topL: '#8c7058', out: '#2c2018' });
  const VOID = K('#080810');

  // ------------------------------------------------------------------ タイル定義・周囲参照
  function tileDefs() { const G = window.GameData; return (G && G.tiles) || {}; }
  function defOf(ch) {
    const t = tileDefs();
    return (ch != null && Object.prototype.hasOwnProperty.call(t, ch)) ? t[ch] : null;
  }
  // N(dx,dy) → 周囲タイルの draw 名。at が無い/値が無いときは自分と同じ（継ぎ目なし）とみなす。未知の記号は '?'
  function mkN(at, self) {
    if (typeof at !== 'function') return () => self;
    return (dx, dy) => {
      let s;
      try { s = at(dx, dy); } catch (e) { return self; }
      if (s == null || s === '') return self;
      const d = defOf(s);
      return d ? String(d.draw || '?') : '?';
    };
  }
  const ORTH = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const RING = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function ring(N, pred) { let s = ''; for (const [dx, dy] of RING) s += pred(N(dx, dy)) ? '1' : '0'; return s; }

  // ------------------------------------------------------------------ 地面（下地）
  let grassCache = null;
  function grassBuf() {
    if (grassCache) return grassCache;
    const b = new Buf();
    b.fill(GR.base);
    // 小さな草の房（ʌ）
    [[1, 3], [9, 1], [5, 8], [12, 10], [0, 13], [8, 14]].forEach(([x, y]) => {
      b.pxw(x, y + 1, GR.dark); b.pxw(x + 1, y, GR.dark); b.pxw(x + 2, y + 1, GR.dark);
      b.pxw(x + 1, y + 1, GR.light);
    });
    [[5, 3], [14, 5], [3, 11], [11, 13], [13, 1]].forEach(([x, y]) => b.pxw(x, y, GR.light));
    grassCache = b;
    return b;
  }
  function groundTex(b, P, seed) {
    b.fill(P.base);
    const r = rng(seed);
    for (let i = 0; i < 7; i++) {
      const x = (r() * 15) | 0, y = 1 + ((r() * 14) | 0);
      b.px(x, y, P.dark); b.px(x + 1, y, P.speck); b.px(x, y - 1, P.light);
    }
    for (let i = 0; i < 5; i++) b.px((r() * 16) | 0, (r() * 16) | 0, P.speck);
  }
  function floorTex(b) {
    b.fill(FL.base);
    for (let y = 0; y < S; y++) {
      const ph = y % 4, blk = y >> 2;
      if (ph === 3) b.rect(0, y, S, 1, FL.seam);
      else if (ph === 0) b.rect(0, y, S, 1, FL.light);
      const jx = (blk * 7 + 3) % S;   // 板の継ぎ目（段ごとにずらす）
      if (ph !== 3) b.px(jx, y, FL.seam);
      if (ph === 1) { b.px((jx + 5) % S, y, FL.dark); b.px((jx + 11) % S, y + 1, FL.dark); }
    }
  }
  function caveTex(b, safe) {
    const P = safe ? CVS : CV;
    b.fill(P.base);
    const r = rng(safe ? 717 : 331);
    const n = safe ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const x = (r() * 14) | 0, y = 1 + ((r() * 14) | 0);
      b.px(x, y, P.dark); b.px(x + 1, y, P.dark); b.px(x, y - 1, P.light); b.px(x + 1, y - 1, P.light);
      if (!safe && r() < 0.5) b.px(x + 2, y, P.deep);
    }
    if (safe) {
      for (let y = 2; y < S; y += 5) for (let x = (y * 3) % 7; x < S; x += 7) b.px(x, y, P.light);
    } else {
      // ひび
      const cx = 3 + ((r() * 9) | 0), cy = 3 + ((r() * 9) | 0);
      b.px(cx, cy, P.deep); b.px(cx + 1, cy + 1, P.deep); b.px(cx + 1, cy + 2, P.deep); b.px(cx + 2, cy + 3, P.dark);
    }
  }
  const BASE_OF = {
    path: 'path', sand: 'sand', bridge: 'path', caveFloor: 'cave', caveFloorSafe: 'cave',
    floor: 'floor', rug: 'floor', mat: 'floor', counter: 'floor', table: 'floor', bed: 'floor', plant: 'floor', bookshelf: 'floor', gachaMachine: 'floor', healMachine: 'floor',
  };
  // 小物（岩・看板・柵）の下地を周囲から推定
  function baseKind(N) {
    const cnt = {};
    for (const [dx, dy] of ORTH) { const k = BASE_OF[N(dx, dy)]; if (k) cnt[k] = (cnt[k] || 0) + 1; }
    let best = 'grass', bc = 0;
    for (const k of Object.keys(cnt)) if (cnt[k] > bc) { best = k; bc = cnt[k]; }
    if (best === 'path' || best === 'sand') return bc >= 2 ? best : 'grass';
    return bc >= 1 ? best : 'grass';
  }
  function paintBase(b, kind) {
    if (kind === 'path') groundTex(b, PA, 101);
    else if (kind === 'sand') groundTex(b, SA, 202);
    else if (kind === 'cave') caveTex(b, false);
    else if (kind === 'floor') floorTex(b);
    else b.copy(grassBuf());
  }
  function baseShadow(kind) {
    return kind === 'path' ? PA.dark : kind === 'sand' ? SA.dark : kind === 'cave' ? CV.dark : kind === 'floor' ? FL.seam : GR.shadow;
  }
  // 室内家具の下地（床）。上が室内の壁なら影を落とす
  function floorBase(b, N) {
    floorTex(b);
    if (N(0, -1) === 'wallIn') { b.rect(0, 0, S, 1, mix(FL.seam, BLACK, 0.25)); b.rect(0, 1, S, 1, FL.seam); }
  }
  function wallAboveBit(N) { return N(0, -1) === 'wallIn' ? 'w' : ''; }

  // ------------------------------------------------------------------ 道・砂（周囲の草となじませる）
  const GRASSY = { grass: 1, tallgrass: 1, flower: 1, tree: 1 };
  const PROPS = { rock: 1, sign: 1, fence: 1 };
  function grassyAt(N, dx, dy) {
    const d = N(dx, dy);
    if (GRASSY[d]) return true;
    if (PROPS[d]) return baseKind((ex, ey) => N(dx + ex, dy + ey)) === 'grass';
    return false;
  }
  const WOB = [2, 2, 3, 3, 2, 2, 1, 2, 2, 3, 2, 2, 1, 1, 2, 2];
  function edgedSig(N) {
    return bits(grassyAt(N, 0, -1), grassyAt(N, 1, 0), grassyAt(N, 0, 1), grassyAt(N, -1, 0),
      grassyAt(N, -1, -1), grassyAt(N, 1, -1), grassyAt(N, -1, 1), grassyAt(N, 1, 1));
  }
  function paintEdged(b, N, P, seed) {
    groundTex(b, P, seed);
    const s = edgedSig(N);
    const up = s[0] === '1', rt = s[1] === '1', dn = s[2] === '1', lf = s[3] === '1';
    const ul = !up && !lf && s[4] === '1', ur = !up && !rt && s[5] === '1', dl = !dn && !lf && s[6] === '1', dr = !dn && !rt && s[7] === '1';
    if (!(up || rt || dn || lf || ul || ur || dl || dr)) return;
    const G = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const X = 15 - x, Y = 15 - y;
        G[y * S + x] = ((up && y < WOB[x]) || (dn && Y < WOB[x]) || (lf && x < WOB[y]) || (rt && X < WOB[y]) ||
          (up && lf && x + y < 5) || (up && rt && X + y < 5) || (dn && lf && x + Y < 5) || (dn && rt && X + Y < 5) ||
          (ul && x + y < 3) || (ur && X + y < 3) || (dl && x + Y < 3) || (dr && X + Y < 3)) ? 1 : 0;
      }
    }
    const g = grassBuf();
    const inG = (x, y) => (x < 0 || y < 0 || x >= S || y >= S) ? -1 : G[y * S + x];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const v = G[y * S + x];
        const nb = [inG(x - 1, y), inG(x + 1, y), inG(x, y - 1), inG(x, y + 1)];
        if (v) {
          if (nb.indexOf(0) >= 0) b.px(x, y, GR.dark);
          else b.copyPx(g, x, y);
        } else if (nb.indexOf(1) >= 0) {
          b.px(x, y, P.edge);
        }
      }
    }
  }

  // ------------------------------------------------------------------ 草むら
  let tallCache = null;
  function tallBuf() {
    if (tallCache) return tallCache;
    const b = new Buf();
    b.fill(TG.dark);
    const put = (x, y, c, m) => { if (y < 0 || y >= S) return; const xx = ((x % S) + S) % S; b.px(xx, y, c); b.m[y * S + xx] = m; };
    const isBlade = (x, y) => { if (y < 0 || y >= S) return false; const xx = ((x % S) + S) % S; return b.m[y * S + xx] === 1; };
    const blade = (cx, top, bot, hw) => {
      for (let y = top; y <= bot; y++) {
        const w = Math.round((y - top) / Math.max(1, bot - top) * hw);
        if (isBlade(cx - w - 1, y)) put(cx - w - 1, y, TG.out, 2);
        if (isBlade(cx + w + 1, y)) put(cx + w + 1, y, TG.out, 2);
        for (let x = cx - w; x <= cx + w; x++) {
          const c = x < cx ? TG.light : (x === cx ? (y - top < 2 ? TG.hl : TG.light) : TG.mid);
          put(x, y, c, 1);
        }
      }
    };
    const tuft = (cx, top) => { blade(cx - 3, top + 3, top + 7, 2); blade(cx + 3, top + 2, top + 7, 2); blade(cx, top, top + 7, 2); };
    tuft(4, 0); tuft(12, 0); tuft(0, 8); tuft(8, 8);
    // 葉の輪郭
    const mark = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (b.m[y * S + x] !== 0) continue;
        if (isBlade(x - 1, y) || isBlade(x + 1, y) || isBlade(x, y - 1) || isBlade(x, (y + 1) % S)) mark.push([x, y]);
      }
    }
    mark.forEach(([x, y]) => { b.px(x, y, TG.out); b.m[y * S + x] = 2; });
    tallCache = b;
    return b;
  }

  // ------------------------------------------------------------------ 木
  function isTree(d) { return d === 'tree'; }
  function paintTree(b, N) {
    const U = isTree(N(0, -1)), D = isTree(N(0, 1)), L = isTree(N(-1, 0)), R = isTree(N(1, 0));
    const g = grassBuf();
    // 背景: 上半分は上が木なら林床の暗がり、下半分は下が木なら暗がり
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dark = y < 8 ? U : D;
        if (dark) b.px(x, y, TR.floor); else b.copyPx(g, x, y);
      }
    }
    // 地面の影
    if (!D) {
      for (let y = 12; y < S; y++) for (let x = 2; x < 14; x++) {
        const nx = (x + 0.5 - 8) / 6, ny = (y + 0.5 - 13.5) / 2.4;
        if (nx * nx + ny * ny <= 1) b.px(x, y, GR.shadow);
      }
    }
    // 幹
    b.rect(6, 11, 4, 5, TR.trunk);
    b.rect(6, 11, 1, 5, TR.trunkD); b.rect(9, 11, 1, 5, TR.trunkD);
    b.rect(7, 11, 1, 5, TR.trunkL);
    b.px(6, 15, TR.trunkD); b.px(9, 15, TR.trunkD);
    // 樹冠
    const main = ell(8, 6.3, 7.6, 6.4, 0.06, 6);
    const test = (x, y) => {
      const n = main(x, y);
      if (n) return n;
      const nx = (x + 0.5 - 8) / 7.6, ny = (y + 0.5 - 6.3) / 6.4;
      if (L && x < 8 && y >= 2 && y <= 10) return [nx, ny];
      if (R && x >= 8 && y >= 2 && y <= 10) return [nx, ny];
      if (U && y < 6 && x >= 3 && x <= 12) return [nx, ny];
      return null;
    };
    const edge = (x, y) => (x < 0 ? (L && y >= 2 && y <= 10) : x >= S ? (R && y >= 2 && y <= 10) : y < 0 ? (U && x >= 3 && x <= 12) : false);
    const cols = [TR.out, TR.dark, TR.mid, TR.light, TR.hl];
    shade(b, test, cols, { edge, bias: 0.05 });
    // 葉のかたまり（明るい弧＋下の暗い弧）
    const clumps = [[4, 3], [9, 2], [6, 6], [11, 6], [2, 8], [8, 9], [13, 9], [4, 10]];
    for (const [cx, cy] of clumps) {
      const lit = [[cx, cy], [cx + 1, cy]];
      const shd = [[cx - 1, cy + 1], [cx + 2, cy + 1], [cx, cy + 2], [cx + 1, cy + 2]];
      for (const [x, y] of lit) { const m = b.m[y * S + x]; if (m >= 2 && m <= 4) b.px(x, y, cols[m]); }
      for (const [x, y] of shd) { if (x < 0 || x >= S || y >= S) continue; const m = b.m[y * S + x]; if (m >= 3) b.px(x, y, cols[m - 2]); }
    }
  }

  // ------------------------------------------------------------------ 水
  function isWaterish(d) { return d === 'water' || d === 'bridge'; }
  const WAVES = [[1, 3, 5], [9, 6, 4], [4, 10, 4], [11, 13, 4]];
  function paintWater(b, N, f) {
    b.fill(WA.base);
    // 深い色の揺らぎ（固定）
    [[6, 1], [13, 3], [2, 7], [10, 9], [14, 12], [5, 14]].forEach(([x, y]) => { b.pxw(x, y, WA.deep); b.pxw(x + 1, y, WA.deep); });
    const sh = [0, 1, 2, 1][f % 4];
    WAVES.forEach(([x, y, len], i) => {
      const s = i % 2 ? -sh : sh;
      for (let k = 0; k < len; k++) b.pxw(x + s + k, y, WA.light);
      b.pxw(x + s + 1, y - 1, WA.light);
      b.pxw(x + s + 2, y - 1, WA.light);
      if ((f + i) % 4 === 0) b.pxw(x + s + 1, y - 1, WA.white);
    });
    const U = isWaterish(N(0, -1)), R = isWaterish(N(1, 0)), D = isWaterish(N(0, 1)), L = isWaterish(N(-1, 0));
    const UL = isWaterish(N(-1, -1)), UR = isWaterish(N(1, -1)), DL = isWaterish(N(-1, 1)), DR = isWaterish(N(1, 1));
    // 岸の浅瀬（暗い帯）＋寄せては返す泡（破線がアニメで動く）→ 最後に岸の線
    const foamAt = (k) => ((k + f) % 8) < 2;
    const band = mix(WA.edge, WA.base, 0.55);
    if (!U) for (let x = 0; x < S; x++) { b.px(x, 1, band); b.px(x, 2, foamAt(x) ? WA.foam : WA.base); }
    if (!D) for (let x = 0; x < S; x++) { b.px(x, 14, band); b.px(x, 13, foamAt(x + 3) ? WA.foam : WA.base); }
    if (!L) for (let y = 0; y < S; y++) { b.px(1, y, band); b.px(2, y, foamAt(y + 1) ? WA.foam : WA.base); }
    if (!R) for (let y = 0; y < S; y++) { b.px(14, y, band); b.px(13, y, foamAt(y + 4) ? WA.foam : WA.base); }
    if (!U) b.rect(0, 0, S, 1, WA.edge);
    if (!D) b.rect(0, 15, S, 1, WA.edge);
    if (!L) b.rect(0, 0, 1, S, WA.edge);
    if (!R) b.rect(15, 0, 1, S, WA.edge);
    // 外側の角を丸める
    if (!U && !L) { b.px(1, 1, WA.edge); b.px(2, 2, band); }
    if (!U && !R) { b.px(14, 1, WA.edge); b.px(13, 2, band); }
    if (!D && !L) { b.px(1, 14, WA.edge); b.px(2, 13, band); }
    if (!D && !R) { b.px(14, 14, WA.edge); b.px(13, 13, band); }
    // 内側の角
    if (U && L && !UL) { b.px(0, 0, WA.edge); b.px(1, 0, band); b.px(0, 1, band); b.px(1, 1, band); }
    if (U && R && !UR) { b.px(15, 0, WA.edge); b.px(14, 0, band); b.px(15, 1, band); b.px(14, 1, band); }
    if (D && L && !DL) { b.px(0, 15, WA.edge); b.px(1, 15, band); b.px(0, 14, band); b.px(1, 14, band); }
    if (D && R && !DR) { b.px(15, 15, WA.edge); b.px(14, 15, band); b.px(15, 14, band); b.px(14, 14, band); }
  }

  // ------------------------------------------------------------------ 橋
  // 橋の向き: 橋タイルの連なりの両端が陸なら、その方向に渡る橋
  function bridgeVert(N) {
    const isB = (d) => d === 'bridge';
    const end = (dx, dy) => { let k = 1; while (k < 12 && isB(N(dx * k, dy * k))) k++; return N(dx * k, dy * k); };
    const land = (d) => !isWaterish(d);
    const vOk = land(end(0, -1)) && land(end(0, 1));
    const hOk = land(end(-1, 0)) && land(end(1, 0));
    if (vOk !== hOk) return vOk;
    const v = isB(N(0, -1)) || isB(N(0, 1)), h = isB(N(-1, 0)) || isB(N(1, 0));
    if (v !== h) return v;
    return isWaterish(N(-1, 0)) && isWaterish(N(1, 0)) && !(isWaterish(N(0, -1)) && isWaterish(N(0, 1)));
  }
  function bridgeSig(N) {
    const v = bridgeVert(N);
    const a = v ? N(-1, 0) : N(0, -1), c = v ? N(1, 0) : N(0, 1);
    return (v ? 'v' : 'h') + bits(a === 'bridge', c === 'bridge', isWaterish(a), isWaterish(c));
  }
  function paintBridge(b, N) {
    const vert = bridgeVert(N);
    const a = vert ? N(-1, 0) : N(0, -1), c = vert ? N(1, 0) : N(0, 1);
    const railA = a !== 'bridge', railB = c !== 'bridge';   // 幅2以上の橋は外側だけに欄干
    const t = new Buf();
    const rim = (y, water, shadow) => { for (let x = 0; x < S; x++) t.px(x, y, water ? (shadow ? WA.deep : WA.base) : (shadow ? GR.shadow : GR.base)); };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const ph = x % 4;
        let col = ph === 3 ? BR.dark : ph === 0 ? BR.light : BR.mid;
        if (ph === 1 && (y % 8 === 1 || y % 8 === 6)) col = BR.out;
        t.px(x, y, col);
      }
    }
    if (railA) {
      rim(0, isWaterish(a), false);
      t.rect(0, 1, S, 1, BR.out); t.rect(0, 2, S, 1, BR.light); t.rect(0, 3, S, 1, BR.dark);
    }
    if (railB) {
      t.rect(0, 11, S, 1, mix(BR.mid, BR.dark, 0.6));
      t.rect(0, 12, S, 1, BR.out); t.rect(0, 13, S, 1, BR.light); t.rect(0, 14, S, 1, BR.dark);
      rim(15, isWaterish(c), true);
    }
    for (const x0 of [3, 11]) {
      const ys = [];
      if (railA) ys.push(1);
      if (railB) ys.push(12);
      for (const y0 of ys) {
        t.rect(x0, y0, 2, 3, BR.post); t.px(x0, y0, BR.light); t.px(x0 + 1, y0, BR.mid);
        t.px(x0 - 1, y0 + 1, BR.out); t.px(x0 + 2, y0 + 1, BR.out);
      }
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (vert) b.copyPxFrom(t, y, x, x, y); else b.copyPxFrom(t, x, y, x, y);
    }
  }
  Buf.prototype.copyPxFrom = function (src, sx, sy, dx, dy) {
    const i = (sy * S + sx) * 4, j = (dy * S + dx) * 4;
    for (let k = 0; k < 4; k++) this.d[j + k] = src.d[i + k];
  };

  // ------------------------------------------------------------------ 花
  // [左上x, 左上y, 色]。花は 4x4（花びら＋2x2 の花芯）、風で頭が左右に揺れる
  const FLOWERS = [[1, 1, 'red'], [9, 3, 'wht'], [4, 9, 'yel'], [11, 11, 'red']];
  const FLOWER_ART = ['.pp.', 'pccp', 'dccd', '.dd.'];
  function paintFlower(b, N, f) {
    b.copy(grassBuf());
    const off = [0, 1, 0, -1][f % 4];
    FLOWERS.forEach(([x, y, c], i) => {
      const s = i % 2 ? -off : off;
      b.pxw(x + 1, y + 4, FW.stem); b.pxw(x + 2, y + 4, FW.stem); b.pxw(x + 3, y + 4, GR.dark); b.pxw(x, y + 4, GR.dark);
      const map = { p: FW[c], d: FW[c + 'D'], c: c === 'yel' ? FW.ctrR : FW.ctr };
      FLOWER_ART.forEach((row, j) => {
        for (let k = 0; k < 4; k++) { const col = map[row[k]]; if (col) b.pxw(x + k + s, y + j, col); }
      });
    });
  }

  // ------------------------------------------------------------------ 柵
  function paintFence(b, N) {
    const kind = baseKind(N);
    paintBase(b, kind);
    const sh = baseShadow(kind);
    const isF = (d) => d === 'fence';
    const l = isF(N(-1, 0)), r = isF(N(1, 0)), u = isF(N(0, -1)), d = isF(N(0, 1));
    const rail = (x0, x1) => {
      for (const y of [4, 8]) {
        b.rect(x0, y, x1 - x0 + 1, 1, FE.out);
        b.rect(x0, y + 1, x1 - x0 + 1, 1, FE.light);
        b.rect(x0, y + 2, x1 - x0 + 1, 1, FE.dark);
      }
      b.rect(x0, 11, x1 - x0 + 1, 1, FE.out);
      b.rect(x0, 12, x1 - x0 + 1, 1, sh);
    };
    if (l) rail(0, 6);
    if (r) rail(9, 15);
    if (u) { b.rect(6, 0, 4, 3, FE.out); b.rect(7, 0, 1, 3, FE.light); b.rect(8, 0, 1, 3, FE.dark); }
    if (d) { b.rect(6, 13, 4, 3, FE.out); b.rect(7, 13, 1, 3, FE.light); b.rect(8, 13, 1, 3, FE.dark); }
    // 杭
    b.pat(6, 1, [
      '.oo.',
      'oLLo',
      'oLMo',
      'oLMo',
      'oLMo',
      'oLDo',
      'oLMo',
      'oLMo',
      'oLMo',
      'oLDo',
      'oLMo',
      'oMDo',
      'oooo',
    ], { o: FE.out, L: FE.light, M: FE.mid, D: FE.dark });
    if (!d) { b.rect(6, 14, 5, 1, sh); b.px(10, 13, sh); }
  }

  // ------------------------------------------------------------------ 岩・看板
  function paintRock(b, N) {
    const kind = baseKind(N);
    paintBase(b, kind);
    const sh = baseShadow(kind);
    for (let y = 11; y < S; y++) for (let x = 1; x < S; x++) {
      const nx = (x + 0.5 - 9) / 6.8, ny = (y + 0.5 - 13.6) / 2.2;
      if (nx * nx + ny * ny <= 1) b.px(x, y, sh);
    }
    shade(b, union(ell(8, 9.2, 7.2, 5.6), ell(6.5, 6.8, 4.8, 4.4)), [RK.out, RK.dark, RK.mid, RK.light, RK.hl], { bias: 0.08 });
    // ひび
    [[10, 6], [10, 7], [11, 8], [11, 9]].forEach(([x, y]) => b.px(x, y, RK.dark));
    b.px(4, 10, RK.dark); b.px(5, 11, RK.dark);
  }
  function paintSign(b, N) {
    const kind = baseKind(N);
    paintBase(b, kind);
    const sh = baseShadow(kind);
    b.rect(5, 14, 7, 1, sh); b.rect(6, 15, 5, 1, sh);
    b.rect(6, 10, 4, 5, SG.out);
    b.rect(7, 10, 1, 4, SG.light); b.rect(8, 10, 1, 4, SG.dark);
    b.rect(1, 2, 14, 9, SG.out);
    b.rect(2, 3, 12, 7, SG.mid);
    b.rect(2, 3, 12, 1, SG.light); b.rect(2, 3, 1, 7, SG.light);
    b.rect(2, 9, 12, 1, SG.dark); b.rect(13, 3, 1, 7, SG.dark);
    b.rect(4, 5, 3, 1, SG.text); b.rect(8, 5, 4, 1, SG.text);
    b.rect(4, 7, 5, 1, SG.text); b.rect(10, 7, 2, 1, SG.text);
  }

  // ------------------------------------------------------------------ 崖
  function paintCliff(b, N) {
    const isC = (d) => d === 'cliff';
    const u = isC(N(0, -1)), d = isC(N(0, 1)), l = isC(N(-1, 0)), r = isC(N(1, 0));
    // 岩肌: ごつごつした岩塊（左右のタイルと横に並ぶよう端の岩は半分ずつ）
    b.fill(CL.dark);
    lumpShade(b, [[4, 6, 4.8, 5.2], [12, 5, 4.6, 5.4], [0, 12, 4.2, 4.4], [8, 12.5, 4.6, 4.2]], [CL.out, CL.dark, CL.mid, CL.light, CL.hl]);
    // 下ほど暗く
    for (let y = 11; y < S; y++) for (let x = 0; x < S; x++) b.darken(x, y, (y - 10) * 0.035);
    if (!u) {   // 上の縁: 草がせり出す
      const g = grassBuf();
      const HANG = [3, 3, 4, 3, 3, 2, 3, 4, 4, 3, 3, 2, 3, 3, 4, 3];
      for (let x = 0; x < S; x++) {
        const h = HANG[x];
        for (let y = 0; y < h; y++) b.copyPx(g, x, y);
        b.px(x, h, GR.deep);
        b.px(x, h + 1, CL.out);
        b.px(x, h + 2, mix(CL.dark, CL.mid, 0.3));
      }
    }
    if (!d) {   // 下の縁: 足元の影
      b.rect(0, 14, S, 1, CL.dark); b.rect(0, 15, S, 1, CL.out);
      [[3, 14], [4, 14], [11, 14]].forEach(([x, y]) => b.px(x, y, CL.light));
    }
    const top = u ? 0 : 4;
    if (!l) { b.rect(0, top, 1, S - top, CL.out); b.rect(1, top + 1, 1, S - top - 2, CL.hl); }
    if (!r) { b.rect(15, top, 1, S - top, CL.out); b.rect(14, top + 1, 1, S - top - 2, CL.dark); }
    if (!d && !l) b.px(1, 14, CL.out);
    if (!d && !r) b.px(14, 14, CL.out);
  }

  // ------------------------------------------------------------------ 屋根（同じ屋根記号の広がりを見て端・棟・紋章を描く）
  function spanCount(N, kind, dir) { let k = 0; while (k < 10 && N(dir * (k + 1), 0) === kind) k++; return k; }
  const EMBLEM = {
    roofCenter: {
      rows: ['..ooooooo..', '.owwwwwwwo.', 'owwppwppwwo', 'owpppppppwo', 'owpppppppwo', 'owwpppppwwo', 'owwwpppwwwo', '.owwwpwwwo.', '..ooooooo..'],
      map: (P) => ({ o: P.out, w: WHITE, p: K('#f05878') }),
    },
    roofShop: {
      rows: ['...ooooo...', '.ooGGGGGoo.', 'oGGGGwGGGGo', 'oGGGwwwGGGo', 'oGwwwwwwwGo', 'oGGwwwwwGGo', 'oGGwwGwwGGo', '.ooGGGGGoo.', '...ooooo...'],
      map: (P) => ({ o: K('#7c5410'), G: P.trim, w: WHITE }),
    },
    roofGym: {
      rows: ['.ooooooooo.', 'oTTTTTTTTTo', 'oTTTTwTTTto', 'oTTTwwwTTto', 'oTTwwwwwTto', '.oTTwwwTto.', '..oTTwTto..', '...oTTto...', '....ooo....'],
      map: (P) => ({ o: P.out, T: P.trim, t: P.trimD, w: WHITE }),
    },
  };

  function roofPainter(kind) {
    return {
      sig(N) {
        const u = N(0, -1) === kind, d = N(0, 1) === kind, l = N(-1, 0) === kind, r = N(1, 0) === kind;
        let s = bits(u, d, l, r);
        if (!u || !d) s += '|' + spanCount(N, kind, -1) + ',' + spanCount(N, kind, 1);
        return s;
      },
      paint(b, N) {
        const P = ROOF[kind];
        const u = N(0, -1) === kind, d = N(0, 1) === kind, l = N(-1, 0) === kind, r = N(1, 0) === kind;
        const dl = spanCount(N, kind, -1), dr = spanCount(N, kind, 1);
        b.fill(P.mid);
        // 瓦
        for (let y = 0; y < S; y++) {
          const ph = y % 4, row = y >> 2;
          for (let x = 0; x < S; x++) {
            const sx = (x + (row & 1) * 4) % 8;
            if (ph === 3) b.px(x, y, P.dark);
            else if (ph === 0) b.px(x, y, sx === 1 ? P.hl : P.light);
            else if (sx === 0) b.px(x, y, P.dark);
            else if (sx === 1 && ph === 1) b.px(x, y, P.light);
          }
        }
        const hi = P.trim || P.hl, hi2 = P.trimD || P.light;
        if (!u) {   // 棟
          b.rect(0, 0, S, 1, P.out); b.rect(0, 1, S, 1, hi); b.rect(0, 2, S, 1, hi2); b.rect(0, 3, S, 1, P.dark);
        }
        if (!d) {   // 軒先
          b.rect(0, 12, S, 1, P.dark);
          b.rect(0, 13, S, 1, P.trim || P.light); b.rect(0, 14, S, 1, P.trimD || P.dark); b.rect(0, 15, S, 1, P.out);
        }
        if (!l) { b.rect(0, 0, 1, S, P.out); b.rect(1, u ? 0 : 1, 1, S - (u ? 0 : 1) - (d ? 0 : 1), P.light); }
        if (!r) { b.rect(15, 0, 1, S, P.out); b.rect(14, u ? 0 : 1, 1, S - (u ? 0 : 1) - (d ? 0 : 1), P.dark); }
        // 紋章（屋根の最下段・横幅の中央。偶数幅なら2タイルにまたがる）
        const em = EMBLEM[kind];
        if (em && !d) {
          const cx = 8 + 8 * (dr - dl);
          const w = em.rows[0].length;
          const oy = u ? 3 : 4;
          b.pat(cx - Math.floor(w / 2), oy, em.rows, em.map(P));
        }
        // 家: 煙突（最上段・左から2番目）
        if (kind === 'roofHouse' && !u && dl === 1 && dl + dr + 1 >= 3) {
          b.pat(2, 0, ['oooooo', 'oggggo', 'oooooo', '.oBbo.', '.oBbo.', '.oBbo.', '.oooo.'],
            { o: P.out, g: K('#c4c4cc'), B: K('#c86048'), b: K('#8c3c30') });
          b.rect(2, 7, 5, 1, P.dark);
        }
      },
    };
  }

  // ------------------------------------------------------------------ 建物の壁・窓・ドア
  const WALLGROUP = { wall: 1, window: 1, door: 1 };
  function buildingKind(N) {
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      for (let k = dx === 0 ? 1 : 0; k <= 6; k++) {
        const d = N(dx, -k);
        if (ROOF_KIND[d]) return ROOF_KIND[d];
        if (!WALLGROUP[d]) break;
      }
    }
    return 'house';
  }
  function wallSig(N) {
    return buildingKind(N) + bits(ROOF_KIND[N(0, -1)], WALLGROUP[N(0, -1)], WALLGROUP[N(0, 1)], WALLGROUP[N(-1, 0)], WALLGROUP[N(1, 0)]);
  }
  function wallBase(b, N, kind) {
    const P = WALLK[kind];
    const up = N(0, -1);
    const bottom = !WALLGROUP[N(0, 1)];
    const lEdge = !WALLGROUP[N(-1, 0)], rEdge = !WALLGROUP[N(1, 0)];
    b.fill(P.base);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (kind === 'house') {   // 板張り
          if (y % 4 === 3) b.px(x, y, P.dark); else if (y % 4 === 0) b.px(x, y, P.light);
        } else if (kind === 'gym') {   // 石積み
          const ph = y % 4, sx = (x + ((y >> 2) & 1) * 4) % 8;
          if (ph === 3 || sx === 0) b.px(x, y, P.dark); else if (ph === 0) b.px(x, y, P.light);
        } else if (kind === 'shop') {   // 縦パネル
          if (x % 8 === 7) b.px(x, y, P.dark); else if (x % 8 === 0) b.px(x, y, P.light);
        } else if (y % 8 === 7) {   // センター: 大きなタイル
          b.px(x, y, P.dark);
        }
      }
    }
    if (bottom) {
      if (kind === 'house') b.rect(0, 12, S, 1, P.trim);
      else { b.rect(0, 10, S, 2, P.trim); b.rect(0, 12, S, 1, mix(P.trim, BLACK, 0.3)); }
      b.rect(0, 13, S, 1, P.foundD); b.rect(0, 14, S, 1, P.found); b.rect(0, 15, S, 1, P.foundD);
    }
    if (ROOF_KIND[up]) { b.rect(0, 0, S, 1, P.out); b.rect(0, 1, S, 1, P.shade); b.rect(0, 2, S, 1, mix(P.shade, P.base, 0.5)); }
    else if (!WALLGROUP[up]) b.rect(0, 0, S, 1, P.out);
    if (lEdge) { b.rect(0, 0, 1, S, P.out); b.rect(1, 1, 1, S - 2, P.light); }
    if (rEdge) { b.rect(15, 0, 1, S, P.out); b.rect(14, 1, 1, S - 2, P.dark); }
  }
  function paintWindow(b, N) {
    const kind = buildingKind(N);
    wallBase(b, N, kind);
    const P = WALLK[kind];
    const bottom = !WALLGROUP[N(0, 1)];
    const y0 = 3, y1 = bottom ? 9 : 11;
    const x0 = 3, x1 = 12;
    b.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.out);
    b.rect(x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1, GL.frame);
    b.rect(x0 + 2, y0 + 2, x1 - x0 - 3, y1 - y0 - 3, GL.base);
    // 反射
    for (let i = 0; i < 4; i++) { b.px(x0 + 3 + i, y0 + 2 + (3 - i), GL.light); b.px(x0 + 4 + i, y0 + 2 + (3 - i), GL.light); }
    b.rect(x0 + 2, y1 - 2, x1 - x0 - 3, 1, GL.dark);
    // 桟
    b.rect(7, y0 + 1, 2, y1 - y0 - 1, GL.frame);
    b.rect(x0 + 1, y0 + 1 + Math.floor((y1 - y0 - 1) / 2), x1 - x0 - 1, 1, GL.frameD);
    // 窓台
    b.rect(x0 - 1, y1 + 1, x1 - x0 + 3, 1, P.out);
    b.rect(x0, y1 + 1, x1 - x0 + 1, 1, GL.frameD);
    if (kind === 'house') {   // 花のプランター
      b.rect(x0, y1 + 2, x1 - x0 + 1, 1, DW.dark);
      [4, 7, 10].forEach((x, i) => b.px(x, y1, i === 1 ? FW.yel : FW.red));
    }
  }
  function paintDoor(b, N) {
    const kind = buildingKind(N);
    wallBase(b, N, kind);
    const P = WALLK[kind];
    if (kind === 'house') {
      b.rect(3, 2, 10, 14, P.out);
      b.rect(4, 3, 8, 13, DW.base);
      b.rect(4, 3, 8, 1, DW.light); b.rect(4, 3, 1, 13, DW.light); b.rect(11, 3, 1, 13, DW.dark);
      b.rect(6, 5, 4, 3, DW.dark); b.rect(6, 9, 4, 4, DW.dark);
      b.rect(7, 6, 2, 1, DW.light); b.rect(7, 10, 2, 2, DW.light);
      b.px(10, 10, DW.knob); b.px(10, 11, DW.out);
      b.rect(2, 15, 12, 1, K('#c8c8d0'));
    } else if (kind === 'gym') {
      const M = pal({ base: '#687480', dark: '#48525c', light: '#909ca8' });
      b.rect(2, 2, 12, 14, P.out);
      b.rect(3, 3, 10, 13, M.base);
      b.rect(3, 3, 10, 1, M.light); b.rect(7, 3, 2, 13, M.dark);
      b.rect(3, 8, 10, 2, P.trim); b.rect(7, 8, 2, 2, mix(P.trim, BLACK, 0.3));
      b.rect(3, 15, 10, 1, M.dark);
    } else {   // センター・ショップ: ガラスの自動ドア
      b.rect(1, 2, 14, 14, P.out);
      b.rect(2, 3, 12, 13, GL.frameD);
      b.rect(3, 4, 4, 11, GL.base); b.rect(9, 4, 4, 11, GL.base);
      b.rect(3, 4, 4, 1, GL.light); b.rect(9, 4, 4, 1, GL.light);
      [[4, 7], [5, 6], [4, 8], [10, 7], [11, 6], [10, 8]].forEach(([x, y]) => b.px(x, y, GL.light));
      b.rect(3, 13, 4, 1, GL.dark); b.rect(9, 13, 4, 1, GL.dark);
      b.rect(7, 3, 2, 13, P.out);
      b.rect(1, 1, 14, 1, P.trim);   // 上の看板帯
      b.rect(2, 15, 12, 1, K('#8c8c98'));
    }
  }

  // ------------------------------------------------------------------ 室内の壁・洞窟の壁（面／上面を描き分け）
  function isOpen(d, self) { return d !== self && d !== 'void' && d !== '?'; }
  function faceMode(N, self, dx) {
    const d1 = N(dx, 1), d2 = N(dx, 2);
    if (isOpen(d1, self)) return 'L';
    if (d1 === self && isOpen(d2, self)) return 'U';
    return 'T';
  }
  function wallLikeSig(N, self) {
    const m = faceMode(N, self, 0);
    const side = (dx) => { const d = N(dx, 0); return d === self ? faceMode(N, self, dx) : (isOpen(d, self) ? 'o' : 'v'); };
    if (m === 'T') {
      const up = N(0, -1);
      return 'T' + side(-1) + side(1) + (isOpen(up, self) ? 'o' : '-') +
        bits(isOpen(N(-1, -1), self), isOpen(N(1, -1), self), isOpen(N(-1, 1), self), isOpen(N(1, 1), self));
    }
    return m + side(-1) + side(1);
  }
  function paintWallLike(b, N, self, cave) {
    const P = cave ? CW : WI;
    const m = faceMode(N, self, 0);
    const side = (dx) => { const d = N(dx, 0); return d === self ? faceMode(N, self, dx) : (isOpen(d, self) ? 'o' : 'v'); };
    const sl = side(-1), sr = side(1);
    if (m === 'T') {
      b.fill(P.top);
      const r = rng(cave ? 91 : 19);
      for (let i = 0; i < 6; i++) b.px((r() * 16) | 0, (r() * 16) | 0, P.topD);
      const rimL = sl === 'o' || sl === 'L' || sl === 'U';
      const rimR = sr === 'o' || sr === 'L' || sr === 'U';
      const rimU = isOpen(N(0, -1), self);
      const light = cave ? CW.topL : WI.topL;
      if (rimL) { b.rect(0, 0, 1, S, light); b.rect(1, 0, 1, S, mix(light, P.top, 0.5)); }
      if (rimR) { b.rect(15, 0, 1, S, light); b.rect(14, 0, 1, S, mix(light, P.top, 0.5)); }
      if (rimU) { b.rect(0, 0, S, 1, light); b.rect(0, 1, S, 1, mix(light, P.top, 0.5)); }
      if (!rimU && !rimL && isOpen(N(-1, -1), self)) b.px(0, 0, light);
      if (!rimU && !rimR && isOpen(N(1, -1), self)) b.px(15, 0, light);
      return;
    }
    if (cave) {
      // 岩肌: ごつごつした岩塊（上の段と下の段で配置を変える）
      b.fill(CW.faceD);
      lumpShade(b, m === 'U'
        ? [[6, 6, 4.6, 5.5], [14, 7, 4.4, 5.2], [2, 12, 4, 4.2], [10, 12.5, 4.4, 4]]
        : [[2, 4, 4.6, 5], [10, 5, 4.4, 5.4], [6, 10.5, 4.4, 4.6], [14, 11, 4, 4.6]], [CW.out, CW.faceD, CW.face, CW.faceL, CW.faceH]);
      if (m === 'U') { b.rect(0, 0, S, 1, CW.out); b.rect(0, 1, S, 1, CW.faceH); b.rect(0, 2, S, 1, mix(CW.faceL, CW.face, 0.5)); }
      else { b.rect(0, 14, S, 1, CW.out); b.rect(0, 15, S, 1, mix(CV.dark, BLACK, 0.2)); }
    } else {
      b.fill(WI.paper);
      for (let x = 0; x < S; x++) if (x % 4 === 1) b.rect(x, 0, 1, S, WI.paperD);
      for (let y = 2; y < S; y += 4) for (let x = 3; x < S; x += 4) b.px(x, y + ((x >> 2) & 1) * 2, WI.paperL);
      if (m === 'U') {   // 上の縁（モールディング）
        b.rect(0, 0, S, 1, WI.trimD); b.rect(0, 1, S, 1, WI.trim); b.rect(0, 2, S, 1, WI.trimL); b.rect(0, 3, S, 1, WI.paperD);
      } else {   // 幅木
        b.rect(0, 11, S, 1, WI.paperD);
        b.rect(0, 12, S, 1, WI.trimL); b.rect(0, 13, S, 2, WI.trim); b.rect(0, 15, S, 1, WI.trimD);
      }
    }
    const edge = cave ? CW.out : WI.trimD;
    if (sl !== m) b.rect(0, 0, 1, S, edge);
    if (sr !== m) b.rect(15, 0, 1, S, edge);
  }

  // ------------------------------------------------------------------ 室内の家具
  function paintRug(b, N) {
    const isR = (d) => d === 'rug';
    const s = ring(N, isR);
    const u = s[0] === '1', r = s[1] === '1', d = s[2] === '1', l = s[3] === '1';
    b.fill(RG.base);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (k === 5) b.px(x, y, RG.light);
      else if (k === 2) b.px(x, y, RG.dark);
    }
    b.rect(7, 7, 2, 2, RG.border);
    const edge = (horiz, pos, dir) => {
      const c = [RG.borderD, RG.border, RG.dark];
      for (let k = 0; k < 3; k++) {
        const p = pos + dir * k;
        if (horiz) b.rect(0, p, S, 1, c[k]); else b.rect(p, 0, 1, S, c[k]);
      }
    };
    if (!u) edge(true, 0, 1);
    if (!d) edge(true, 15, -1);
    if (!l) edge(false, 0, 1);
    if (!r) edge(false, 15, -1);
    if (!u && !l) { b.px(0, 0, RG.borderD); }
    const ic = (x, y) => { b.px(x, y, RG.borderD); };
    if (u && l && s[4] === '0') ic(0, 0);
    if (u && r && s[5] === '0') ic(15, 0);
    if (d && l && s[6] === '0') ic(0, 15);
    if (d && r && s[7] === '0') ic(15, 15);
  }
  function paintCounter(b, N) {
    floorBase(b, N);
    const isC = (d) => d === 'counter';
    const l = isC(N(-1, 0)), r = isC(N(1, 0)), u = isC(N(0, -1));
    const x0 = l ? 0 : 1, x1 = r ? 15 : 14;
    const w = x1 - x0 + 1;
    b.rect(x0, 15, w, 1, FL.seam);
    b.rect(x0, u ? 0 : 1, w, u ? 8 : 7, CT.top);
    if (!u) b.rect(x0, 0, w, 1, CT.out);
    b.rect(x0, 2, w, 1, WHITE);
    b.rect(x0, 7, w, 1, CT.topD);
    b.rect(x0, 8, w, 1, CT.out);
    b.rect(x0, 9, w, 5, CT.front);
    b.rect(x0, 9, w, 1, CT.frontL);
    for (let x = x0; x <= x1; x++) if (x % 8 === 3) b.rect(x, 10, 1, 4, CT.frontD);
    b.rect(x0, 14, w, 1, CT.out);
    if (!l) { b.rect(0, u ? 0 : 1, 1, 14, CT.out); b.rect(1, 9, 1, 5, CT.frontL); }
    if (!r) { b.rect(15, u ? 0 : 1, 1, 14, CT.out); b.rect(14, 9, 1, 5, CT.frontD); }
  }
  function paintTable(b, N) {
    floorBase(b, N);
    const isT = (d) => d === 'table';
    const l = isT(N(-1, 0)), r = isT(N(1, 0)), u = isT(N(0, -1)), d = isT(N(0, 1));
    const x0 = l ? 0 : 1, x1 = r ? 15 : 14, y0 = u ? 0 : 2, y1 = d ? 15 : 10;
    // 影
    if (!d) b.rect(x0 + 1, 14, x1 - x0, 2, FL.seam);
    // 脚
    if (!d) {
      if (!l) { b.rect(x0 + 1, y1 + 1, 2, 3, TB.out); b.px(x0 + 1, y1 + 1, TB.leg); }
      if (!r) { b.rect(x1 - 2, y1 + 1, 2, 3, TB.out); b.px(x1 - 2, y1 + 1, TB.leg); }
    }
    b.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, TB.top);
    if (!u) { b.rect(x0, y0, x1 - x0 + 1, 1, TB.out); b.rect(x0, y0 + 1, x1 - x0 + 1, 1, TB.topL); }
    if (!d) { b.rect(x0, y1 - 1, x1 - x0 + 1, 1, TB.topD); b.rect(x0, y1, x1 - x0 + 1, 1, TB.out); b.rect(x0, y1 + 1, x1 - x0 + 1, 1, TB.leg); }
    if (!l) b.rect(x0, y0, 1, y1 - y0 + (d ? 1 : 2), TB.out);
    if (!r) b.rect(x1, y0, 1, y1 - y0 + (d ? 1 : 2), TB.out);
    // 木目
    for (let y = y0 + 3; y < y1 - 1; y += 3) for (let x = x0 + 2; x < x1 - 1; x += 5) b.rect(x, y, 2, 1, TB.topL);
  }
  function paintBookshelf(b, N) {
    floorBase(b, N);
    const isB = (d) => d === 'bookshelf';
    const u = isB(N(0, -1)), d = isB(N(0, 1)), l = isB(N(-1, 0)), r = isB(N(1, 0));
    b.fill(BS.frame);
    const r2 = rng(4242);
    const shelf = (top, bot) => {
      b.rect(1, top, 14, bot - top + 1, BS.back);
      let x = 1;
      while (x < 15) {
        const w = r2() < 0.35 ? 1 : 2;
        const c = BS.books[(r2() * BS.books.length) | 0];
        const t = top + ((r2() * 2) | 0);
        const ww = Math.min(w, 15 - x);
        b.rect(x, t, ww, bot - t + 1, c);
        b.rect(x, t, 1, bot - t + 1, mix(c, WHITE, 0.3));
        if (ww === 2) b.rect(x + 1, t, 1, bot - t + 1, mix(c, BLACK, 0.15));
        b.px(x, t + 2, mix(c, WHITE, 0.6));
        x += ww + (r2() < 0.15 ? 1 : 0);
      }
    };
    shelf(2, 6); shelf(9, 13);
    b.rect(0, 7, S, 1, BS.frameL); b.rect(0, 8, S, 1, BS.frameD);
    if (!u) { b.rect(0, 0, S, 1, BS.out); b.rect(0, 1, S, 1, BS.frameL); }
    else { b.rect(0, 0, S, 1, BS.frameD); b.rect(0, 1, S, 1, BS.frame); }
    b.rect(0, 14, S, 1, BS.frameL);
    if (!d) b.rect(0, 15, S, 1, BS.out); else b.rect(0, 15, S, 1, BS.frameD);
    b.rect(0, 0, 1, S, l ? BS.frameD : BS.out);
    b.rect(15, 0, 1, S, r ? BS.frameL : BS.out);
  }
  function paintPlant(b, N) {
    floorBase(b, N);
    b.rect(4, 15, 9, 1, FL.seam);
    const leaves = union(ell(4.6, 6.5, 3.6, 2.4), ell(11.4, 6.5, 3.6, 2.4), ell(6, 3.5, 2.6, 3.2), ell(10, 3.5, 2.6, 3.2), ell(8, 6, 3, 4.4), ell(8, 1.8, 2, 2.2));
    shade(b, leaves, [PL.lout, PL.ldark, PL.lmid, PL.llight, PL.lhl], { bias: 0.1 });
    b.px(8, 8, PL.ldark); b.px(8, 9, PL.ldark);
    b.pat(4, 9, [
      'oooooooo',
      'oLLLLLLo',
      'oppppppo',
      'oLpppDDo',
      '.oLppDo.',
      '.oLpDDo.',
      '..oooo..',
    ], { o: PL.out, L: PL.potL, p: PL.pot, D: PL.potD });
  }
  function paintBed(b, N) {
    floorBase(b, N);
    const isB = (d) => d === 'bed';
    const u = isB(N(0, -1)), d = isB(N(0, 1));
    const top = u ? 0 : 0, bot = d ? 15 : 14;
    b.rect(1, top, 14, bot - top + 1, BD.out);
    if (!d) b.rect(2, 15, 13, 1, FL.seam);
    b.rect(2, top, 12, bot - top + (d ? 1 : 0), BD.frame);
    let y = 0;
    if (!u) {   // ヘッドボード＋枕
      b.rect(2, 1, 12, 1, BD.frameL); b.rect(2, 2, 12, 1, BD.frame); b.rect(2, 3, 12, 1, BD.frameD);
      b.rect(3, 4, 10, 4, BD.pillow); b.rect(3, 7, 10, 1, BD.pillowD); b.rect(12, 4, 1, 4, BD.pillowD);
      b.px(3, 4, BD.frame); b.px(12, 4, BD.frame);
      y = d ? 9 : 8;
    }
    const yEnd = d ? 15 : 12;
    if (yEnd >= y) {
      b.rect(2, y, 12, yEnd - y + 1, BD.sheet);
      if (!u) { b.rect(2, y, 12, 1, BD.sheetL); b.rect(2, y + 1, 12, 1, WHITE); }
      b.rect(13, y, 1, yEnd - y + 1, BD.sheetD);
      b.rect(2, y, 1, yEnd - y + 1, BD.sheetL);
    }
    if (!d) { b.rect(2, 13, 12, 1, BD.frameL); b.rect(2, 14, 12, 1, BD.frameD); }
  }
  function paintMat(b, N) {
    floorBase(b, N);
    const isM = (d) => d === 'mat';
    const l = isM(N(-1, 0)), r = isM(N(1, 0));
    const x0 = l ? 0 : 1, x1 = r ? 15 : 14, w = x1 - x0 + 1;
    b.rect(x0, 3, w, 11, MT.out);
    b.rect(x0 + (l ? 0 : 1), 4, w - (l ? 0 : 1) - (r ? 0 : 1), 9, MT.base);
    for (let y = 5; y <= 11; y += 3) b.rect(x0 + (l ? 0 : 1), y, w - (l ? 0 : 1) - (r ? 0 : 1), 1, MT.light);
    b.rect(x0, 13, w, 1, MT.dark);
    if (!l) b.px(x0, 3, FL.base);
    if (!r) b.px(x1, 3, FL.base);
  }
  function paintGacha(b, N, f) {
    floorBase(b, N);
    b.rect(3, 15, 11, 1, FL.seam);
    // 本体
    b.rect(2, 8, 12, 8, GC.out);
    b.rect(3, 9, 10, 5, GC.body);
    b.rect(3, 9, 1, 5, GC.bodyL); b.rect(12, 9, 1, 5, GC.bodyD);
    b.rect(3, 9, 10, 1, GC.gold); b.rect(3, 10, 10, 1, GC.goldD);
    b.rect(5, 11, 1, 2, GC.dark);                 // コイン投入口
    b.pat(8, 11, ['.s.', 'sSs', '.s.'], { s: GC.silverD, S: GC.silver });   // ダイヤル
    b.rect(3, 14, 10, 1, GC.bodyD);
    b.rect(4, 13, 3, 2, GC.dark); b.rect(4, 13, 3, 1, GC.goldD);   // 取り出し口
    // ドーム
    const dome = (x, y) => { const nx = (x + 0.5 - 8) / 5.6, ny = (y + 0.5 - 5.2) / 5.2; return nx * nx + ny * ny <= 1 && y <= 8 ? [nx, ny] : null; };
    for (let y = 0; y <= 8; y++) for (let x = 1; x < 15; x++) {
      if (!dome(x, y)) continue;
      const edge = !dome(x - 1, y) || !dome(x + 1, y) || !dome(x, y - 1);
      b.px(x, y, edge ? GC.out : (x > 9 ? GC.glassD : GC.glass));
    }
    // カプセル
    const caps = [[4, 6, 0], [6, 7, 1], [8, 6, 2], [10, 7, 3], [5, 4, 4], [9, 4, 5], [7, 5, 1], [11, 5, 0], [3, 7, 2]];
    caps.forEach(([x, y, c]) => {
      if (!dome(x, y) || !dome(x + 1, y + 1)) return;
      b.px(x, y, mix(CAPS[c], WHITE, 0.45)); b.px(x + 1, y, CAPS[c]); b.px(x, y + 1, CAPS[c]); b.px(x + 1, y + 1, mix(CAPS[c], BLACK, 0.25));
    });
    b.px(5, 2, GC.hl); b.px(4, 3, GC.hl); b.px(5, 3, GC.hl);
    // ランプ（点滅）
    b.rect(6, 0, 4, 2, GC.out);
    b.rect(7, 0, 2, 1, f ? GC.goldL : GC.gold); b.rect(7, 1, 2, 1, f ? GC.gold : GC.goldD);
    if (f) { b.px(10, 3, GC.hl); b.px(11, 2, GC.goldL); }
  }
  function paintHeal(b, N, f) {
    floorBase(b, N);
    b.rect(2, 15, 13, 1, FL.seam);
    b.rect(1, 2, 14, 13, HM.out);
    b.rect(2, 3, 12, 11, HM.body);
    b.rect(2, 3, 12, 1, HM.bodyL); b.rect(13, 3, 1, 11, HM.bodyD); b.rect(2, 13, 12, 1, HM.bodyD);
    // モニター
    b.rect(3, 4, 10, 5, HM.out);
    b.rect(4, 5, 8, 3, HM.screen);
    const g = f === 1 ? HM.glow2 : HM.glow;
    b.pat(6, 5, f === 1 ? ['.#.#', '####', '.##.'] : ['.#.#', '.###', '..#.'], { '#': g });
    b.rect(4, 5, 8, 1, mix(HM.screen, g, f === 1 ? 0.45 : 0.25));
    // カプセル台（6つのくぼみ）
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const x = 4 + i * 3, y = 9 + j * 2;
        b.rect(x, y, 2, 1, HM.slotD);
        const lit = (i + j + f) % 3 === 0;
        b.px(x, y, lit ? g : HM.slot);
        b.px(x + 1, y, lit ? HM.glow : HM.slotD);
      }
    }
    b.px(12, 10, HM.pink); b.px(12, 11, f === 1 ? HM.pinkL : HM.pink);
  }

  // ------------------------------------------------------------------ 描画関数テーブル
  // paint(b, N, frame)。sig(N) は見た目に影響する周囲情報を文字列化したもの（キャッシュキー）
  const DR = {
    grass: { paint(b) { b.copy(grassBuf()); } },
    tallgrass: {
      paint(b) { b.copy(tallBuf()); },
      overlay(b) {
        const t = tallBuf();
        for (let y = 8; y < S; y++) for (let x = 0; x < S; x++) {
          if (y >= 11 || t.m[y * S + x] >= 1) b.copyPx(t, x, y);
        }
      },
    },
    path: { sig: edgedSig, paint(b, N) { paintEdged(b, N, PA, 101); } },
    sand: { sig: edgedSig, paint(b, N) { paintEdged(b, N, SA, 202); } },
    flower: { frames: 4, period: 260, paint: paintFlower },
    tree: { sig: (N) => bits(isTree(N(0, -1)), isTree(N(0, 1)), isTree(N(-1, 0)), isTree(N(1, 0))), paint: paintTree },
    water: { frames: 4, period: 280, sig: (N) => ring(N, isWaterish), paint: paintWater },
    bridge: { sig: bridgeSig, paint: paintBridge },
    fence: { sig: (N) => baseKind(N) + ring(N, (d) => d === 'fence').slice(0, 4), paint: paintFence },
    rock: { sig: baseKind, paint: paintRock },
    sign: { sig: baseKind, paint: paintSign },
    cliff: { sig: (N) => ring(N, (d) => d === 'cliff').slice(0, 4), paint: paintCliff },
    roofHouse: roofPainter('roofHouse'),
    roofCenter: roofPainter('roofCenter'),
    roofShop: roofPainter('roofShop'),
    roofGym: roofPainter('roofGym'),
    wall: { sig: wallSig, paint(b, N) { wallBase(b, N, buildingKind(N)); } },
    window: { sig: wallSig, paint: paintWindow },
    door: { sig: wallSig, paint: paintDoor },
    floor: { sig: wallAboveBit, paint: floorBase },
    rug: { sig: (N) => ring(N, (d) => d === 'rug'), paint: paintRug },
    wallIn: { sig: (N) => wallLikeSig(N, 'wallIn'), paint(b, N) { paintWallLike(b, N, 'wallIn', false); } },
    counter: { sig: (N) => wallAboveBit(N) + ring(N, (d) => d === 'counter').slice(0, 4), paint: paintCounter },
    table: { sig: (N) => wallAboveBit(N) + ring(N, (d) => d === 'table').slice(0, 4), paint: paintTable },
    bookshelf: { sig: (N) => wallAboveBit(N) + ring(N, (d) => d === 'bookshelf').slice(0, 4), paint: paintBookshelf },
    plant: { sig: wallAboveBit, paint: paintPlant },
    bed: { sig: (N) => wallAboveBit(N) + ring(N, (d) => d === 'bed').slice(0, 4), paint: paintBed },
    mat: { sig: (N) => wallAboveBit(N) + ring(N, (d) => d === 'mat').slice(0, 4), paint: paintMat },
    gachaMachine: { frames: 2, period: 420, sig: wallAboveBit, paint: paintGacha },
    healMachine: { frames: 2, period: 520, sig: wallAboveBit, paint: paintHeal },
    caveFloor: { sig: (N) => (N(0, -1) === 'caveWall' ? 'w' : ''), paint(b, N) { caveTex(b, false); caveShadow(b, N, CV); } },
    caveFloorSafe: { sig: (N) => (N(0, -1) === 'caveWall' ? 'w' : ''), paint(b, N) { caveTex(b, true); caveShadow(b, N, CVS); } },
    caveWall: { sig: (N) => wallLikeSig(N, 'caveWall'), paint(b, N) { paintWallLike(b, N, 'caveWall', true); } },
    void: { paint(b) { b.fill(VOID); } },
  };
  function caveShadow(b, N, P) {
    if (N(0, -1) === 'caveWall') { b.rect(0, 0, S, 1, P.deep); b.rect(0, 1, S, 1, P.dark); }
  }
  function paintUnknown(b) {
    const mg = K('#ff00dc'), bk = K('#200020');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) b.px(x, y, ((x >> 2) + (y >> 2)) & 1 ? mg : bk);
    b.pat(5, 4, ['.##.', '#..#', '..#.', '.#..', '....', '.#..'], { '#': WHITE });
  }

  // ------------------------------------------------------------------ キャッシュと公開 API
  const cache = new Map();
  let cacheHits = 0, cacheMiss = 0;
  function cached(key, make) {
    let cv = cache.get(key);
    if (cv) { cacheHits++; return cv; }
    cacheMiss++;
    if (cache.size > 6000) cache.clear();
    cv = make();
    cache.set(key, cv);
    return cv;
  }
  function frameOf(dr, t) {
    if (!dr || !(dr.frames > 1)) return 0;
    const n = Math.floor((Number(t) || 0) / dr.period);
    return ((n % dr.frames) + dr.frames) % dr.frames;
  }
  function imageOf(def) {
    if (!def || typeof def.image !== 'string' || !def.image.trim()) return null;
    const sp = App.sprites;
    if (!sp || typeof sp.getImage !== 'function') return null;
    const img = sp.getImage(def.image.trim());
    return img && img.naturalWidth ? img : null;
  }
  // 周囲を考慮した 16x16 タイル canvas を返す（キャッシュ）
  function tileCanvas(ch, t, at) {
    const def = defOf(ch);
    const name = def ? String(def.draw || '') : '';
    const dr = Object.prototype.hasOwnProperty.call(DR, name) ? DR[name] : null;
    if (!dr) return cached('?|' + name, () => { const b = new Buf(); paintUnknown(b); return b.canvas(); });
    const N = mkN(at, name);
    const f = frameOf(dr, t);
    const sig = dr.sig ? dr.sig(N) : '';
    return cached(name + '|' + sig + '|' + f, () => {
      const b = new Buf();
      try { dr.paint(b, N, f); } catch (e) { console.warn('[tiles] 描画エラー: ' + name, e); paintUnknown(b); }
      return b.canvas();
    });
  }
  function draw(ctx, ch, px, py, t, at) {
    const x = Math.round(px), y = Math.round(py);
    const img = imageOf(defOf(ch));
    if (img) {
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, S, S);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    ctx.drawImage(tileCanvas(ch, t, at), x, y);
  }
  function drawOverlay(ctx, ch, px, py, t) {
    const def = defOf(ch);
    if (!def || !def.overlay) return;
    const x = Math.round(px), y = Math.round(py);
    const img = imageOf(def);
    if (img) {   // 画像タイル: 下半分を重ねる
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      const h = img.naturalHeight;
      ctx.drawImage(img, 0, Math.floor(h * 9 / 16), img.naturalWidth, h - Math.floor(h * 9 / 16), x, y + 9, S, 7);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    const name = String(def.draw || '');
    const dr = Object.prototype.hasOwnProperty.call(DR, name) ? DR[name] : null;
    if (!dr) return;
    const f = frameOf(dr, t);
    const cv = cached('ov|' + name + '|' + f, () => {
      const b = new Buf();
      if (dr.overlay) dr.overlay(b, f);
      else {   // 汎用: タイルの下側 7 ドットを重ねる
        const full = new Buf();
        dr.paint(full, mkN(null, name), f);
        for (let yy = 9; yy < S; yy++) for (let xx = 0; xx < S; xx++) b.copyPx(full, xx, yy);
      }
      return b.canvas();
    });
    ctx.drawImage(cv, x, y);
  }
  function isAnimated(ch) {
    const def = defOf(ch);
    if (!def) return false;
    if (imageOf(def)) return false;
    const dr = DR[String(def.draw || '')];
    return !!(dr && dr.frames > 1);
  }
  // マップ全体を canvas に描く（プレビュー・エディタ用。契約外の補助 API）
  //   opts: { pad: マップ外に描く border の幅(マス), t: 経過ms, scale: 整数倍率 }
  function renderMap(map, opts) {
    opts = opts || {};
    const rows = (map && Array.isArray(map.tiles)) ? map.tiles.map(String) : [];
    const h = rows.length, w = h ? rows[0].length : 0;
    const pad = Math.max(0, opts.pad | 0), scale = Math.max(1, opts.scale | 0 || 1);
    const border = map && map.border != null && defOf(map.border) ? map.border : null;
    const tileAt = (x, y) => {
      if (y >= 0 && y < h && x >= 0 && x < rows[y].length) return rows[y][x];
      if (border != null) return border;
      if (!h) return 'V';
      const yy = Math.min(h - 1, Math.max(0, y));
      return rows[yy][Math.min(rows[yy].length - 1, Math.max(0, x))];
    };
    const cv = document.createElement('canvas');
    cv.width = (w + pad * 2) * S; cv.height = (h + pad * 2) * S;
    const ctx = cv.getContext('2d');
    for (let y = -pad; y < h + pad; y++) {
      for (let x = -pad; x < w + pad; x++) {
        draw(ctx, tileAt(x, y), (x + pad) * S, (y + pad) * S, opts.t || 0, (dx, dy) => tileAt(x + dx, y + dy));
      }
    }
    if (scale === 1) return cv;
    const out = document.createElement('canvas');
    out.width = cv.width * scale; out.height = cv.height * scale;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }
  function clearCache() { cache.clear(); grassCache = null; tallCache = null; }

  App.tiles = {
    draw,
    drawOverlay,
    isAnimated,
    // 追加 API（契約外・任意利用）
    tileCanvas,
    renderMap,
    clearCache,
    drawNames: () => Object.keys(DR),
    hasDraw: (name) => Object.prototype.hasOwnProperty.call(DR, name),
    stats: () => ({ cached: cache.size, hits: cacheHits, miss: cacheMiss }),
  };
})();
