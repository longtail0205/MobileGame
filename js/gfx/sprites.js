/* =====================================================================
   js/gfx/sprites.js — モンスター/キャラクターの自動生成ドット絵・画像管理
   依存: window.GameData のみ（App.util は使わない）

   ■ モンスター（64x64）
     monsterSprite(speciesOrId, view) → { src, flip }
       正面: image → 自動生成
       背面: backImage → image(左右反転) → 自動生成の背面
     自動生成は sprite.shape / sprite.colors / sprite.seed とレア度・タイプから決定的に作る。
     seed が 0/未指定なら id のハッシュを使う。

   ■ キャラクター（16x24 / 4方向 x 3フレーム）
     look.image を指定すると画像をスプライトシートとして使う:
       横 3 フレーム（0=立ち 1,2=歩き）× 縦 4 方向（上から 下,左,右,上）
       1コマ 16x24（シート全体 48x96）。拡大した画像でもコマ比率が同じなら縮小して使う。
   ===================================================================== */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  // =================================================================== 基本
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function GD() { return window.GameData || {}; }

  function hashStr(str) {
    str = String(str);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const f = mulberry32(seed >>> 0);
    return {
      r: f,
      f: (a, b) => a + (b - a) * f(),
      i: (a, b) => a + Math.floor(f() * (b - a + 1)),
      c: (p) => f() < p,
      pick: (arr) => arr[Math.floor(f() * arr.length) % arr.length],
      wpick: (obj) => {
        const keys = Object.keys(obj);
        let sum = 0;
        for (const k of keys) sum += obj[k];
        let v = f() * sum;
        for (const k of keys) { v -= obj[k]; if (v < 0) return k; }
        return keys[keys.length - 1];
      },
    };
  }

  // =================================================================== 色
  const parseCache = new Map();
  function parseColor(c) {
    const key = String(c || '');
    if (parseCache.has(key)) return parseCache.get(key);
    let out = [136, 136, 136];
    let m = /^#?([0-9a-f]{6})$/i.exec(key.trim());
    if (m) {
      const n = parseInt(m[1], 16);
      out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else if ((m = /^#?([0-9a-f]{3})$/i.exec(key.trim()))) {
      out = m[1].split('').map((ch) => parseInt(ch + ch, 16));
    } else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(key.trim()))) {
      out = [+m[1], +m[2], +m[3]].map((v) => clamp(v, 0, 255));
    }
    parseCache.set(key, out);
    return out;
  }
  function rgb2hsl(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl2rgb(hsl) {
    const h = ((hsl[0] % 360) + 360) % 360 / 360, s = clamp(hsl[1], 0, 1), l = clamp(hsl[2], 0, 1);
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  function toHex(rgb) { return '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round); }
  function mixHex(a, b, t) { return toHex(mixRgb(parseColor(a), parseColor(b), t)); }
  function hueToward(h, target, amt) {
    const d = ((target - h + 540) % 360) - 180;
    return (h + clamp(d, -amt, amt) + 360) % 360;
  }
  function jitterHex(hex, dh, dl) {
    const hsl = rgb2hsl(parseColor(hex));
    return toHex(hsl2rgb([hsl[0] + dh, hsl[1], clamp(hsl[2] + dl, 0.05, 0.95)]));
  }
  // 色から 6 段階のランプ [アウトライン, 濃い影, 影, 基本, 明, ハイライト] を作る（影は青寄り・光は黄寄りに色相をずらす）
  const rampCache = new Map();
  function makeRamp(hex) {
    const key = String(hex);
    if (rampCache.has(key)) return rampCache.get(key);
    const rgb = parseColor(hex);
    const hsl = rgb2hsl(rgb);
    const h = hsl[0], l = hsl[2];
    let s = hsl[1];
    const grayish = s < 0.08;
    const mk = (hh, ss, ll) => hsl2rgb([hh, clamp(ss, 0, 1), clamp(ll, 0, 1)]);
    const lOut = clamp(l * 0.34, 0.07, 0.24);
    const lDark = Math.max(lOut + 0.05, l - Math.max(0.17, l * 0.36));
    const lSh = Math.max(lOut + 0.08, l - Math.max(0.1, l * 0.19));
    const lLt = l + Math.max(0.07, (1 - l) * 0.34);
    const lHi = l + Math.max(0.14, (1 - l) * 0.7);
    const sBase = grayish ? s : s;
    const ramp = [
      mk(grayish ? 250 : hueToward(h, 255, 24), grayish ? 0.18 : sBase * 0.85 + 0.15, lOut),
      mk(grayish ? 245 : hueToward(h, 250, 16), grayish ? 0.1 : sBase + 0.06, lDark),
      mk(grayish ? 240 : hueToward(h, 245, 9), grayish ? 0.06 : sBase + 0.04, lSh),
      rgb,
      mk(grayish ? 50 : hueToward(h, 55, 7), grayish ? s : sBase - 0.02, lLt),
      mk(grayish ? 50 : hueToward(h, 55, 12), grayish ? s : sBase - 0.12, lHi),
    ];
    rampCache.set(key, ramp);
    return ramp;
  }

  // =================================================================== 画像管理
  const imgCache = new Map();   // src → { img, ok, failed, promise }
  function loadImage(src) {
    if (!src) return Promise.reject(new Error('画像パスが空です'));
    let e = imgCache.get(src);
    if (!e) {
      e = { img: new Image(), ok: false, failed: false, promise: null };
      const ent = e;
      ent.promise = new Promise((resolve, reject) => {
        ent.img.onload = () => { ent.ok = true; resolve(ent.img); };
        ent.img.onerror = () => {
          ent.failed = true;
          console.warn('[sprites] 画像を読み込めません（自動生成で代用します）: ' + src);
          reject(new Error('画像を読み込めません: ' + src));
        };
      });
      ent.promise.catch(() => {});
      ent.img.decoding = 'async';
      ent.img.src = src;
      imgCache.set(src, ent);
    }
    return e.promise;
  }
  function getImage(src) {
    if (!src) return null;
    const e = imgCache.get(src);
    if (!e) { loadImage(src); return null; }
    return e.ok ? e.img : null;
  }
  function imageFailed(src) { const e = imgCache.get(src); return !!(e && e.failed); }

  // =================================================================== ピクセルバッファ + ベクター描画
  // 各パーツを「法線付き」で塗り、最後に光源（左上）で陰影・アウトラインを付ける。
  const LIGHT = (() => { const v = [-0.52, -0.68, 0.78]; const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); })();
  const TH = [-0.3, 0.3, 0.8, 0.955];   // 濃い影 / 影 / 基本 / 明 / ハイライト の境界

  function makeBuf(w, h) {
    const n = w * h;
    return {
      w, h, n,
      g: new Int16Array(n), z: new Float64Array(n), m: new Uint8Array(n),
      nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n), b: new Float32Array(n),
      nl: new Uint8Array(n), sil: new Uint8Array(n), col: new Uint8ClampedArray(n * 4),
    };
  }
  function inPoly(pts, x, y) {
    let inside = false;
    const n = pts.length >> 1;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const xa = pts[a * 2], ya = pts[a * 2 + 1], xb = pts[b * 2], yb = pts[b * 2 + 1];
      if (((ya > y) !== (yb > y)) && (x < (xb - xa) * (y - ya) / (yb - ya) + xa)) inside = !inside;
    }
    return inside;
  }

  // tf: { s, ax, ay, ox, oy, clip:[x0,y0,x1,y1] }  デザイン座標 (x,y) → ピクセル (ox+(x-ax)*s, oy+(y-ay)*s)
  function createDrawer(B, tf) {
    let seq = 0, gid = 0;
    const s = tf.s, inv = 1 / s;
    const c = tf.clip || [0, 0, B.w - 1, B.h - 1];
    const X = (x) => tf.ox + (x - tf.ax) * s;
    const Y = (y) => tf.oy + (y - tf.ay) * s;
    const DX = (px) => tf.ax + (px - tf.ox) * inv;
    const DY = (py) => tf.ay + (py - tf.oy) * inv;
    const minR = 0.62 * inv;

    function scan(x0, y0, x1, y1, fn) {
      const px0 = Math.max(c[0], Math.floor(X(x0)) - 1), px1 = Math.min(c[2], Math.ceil(X(x1)) + 1);
      const py0 = Math.max(c[1], Math.floor(Y(y0)) - 1), py1 = Math.min(c[3], Math.ceil(Y(y1)) + 1);
      for (let py = py0; py <= py1; py++) {
        const y = DY(py + 0.5);
        for (let px = px0; px <= px1; px++) fn(DX(px + 0.5), y, py * B.w + px);
      }
    }
    function put(i, m, nx, ny, o, g, zz) {
      if (B.g[i] && B.z[i] > zz) return;
      if (o.flat !== undefined) { nx *= o.flat; ny *= o.flat; }
      if (o.tilt) { nx += o.tilt[0]; ny += o.tilt[1]; }
      let n2 = nx * nx + ny * ny;
      if (n2 > 1) { const k = 1 / Math.sqrt(n2); nx *= k; ny *= k; n2 = 1; }
      B.g[i] = g; B.z[i] = zz; B.m[i] = m;
      B.nx[i] = nx; B.ny[i] = ny; B.nz[i] = Math.sqrt(1 - n2);
      B.b[i] = o.bias !== undefined ? o.bias : ((o.z || 0) < -2.5 ? -0.07 : 0);
      B.nl[i] = o.line === false ? 1 : 0;
    }
    function begin(o) { seq++; return [o.g || ++gid, (o.z || 0) * 100000 + seq]; }

    const D = {
      s, X, Y,
      g() { return ++gid; },
      sym(fn) { fn(1); fn(-1); },
      ell(m, cx, cy, rx, ry, o) {
        o = o || {};
        const [g, zz] = begin(o);
        rx = Math.max(rx, minR); ry = Math.max(ry, minR);
        const rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
        const R = Math.max(rx, ry);
        scan(cx - R, cy - R, cx + R, cy + R, (x, y, i) => {
          if (o.yMax !== undefined && y > o.yMax) return;
          if (o.yMin !== undefined && y < o.yMin) return;
          if (o.clip && !o.clip(x, y)) return;
          const px = x - cx, py = y - cy;
          const lx = px * cs + py * sn, ly = -px * sn + py * cs;
          const dx = lx / rx, dy = ly / ry;
          if (dx * dx + dy * dy > 1) return;
          put(i, m, dx * cs - dy * sn, dx * sn + dy * cs, o, g, zz);
        });
        return g;
      },
      cap(m, x1, y1, r1, x2, y2, r2, o) {
        o = o || {};
        const [g, zz] = begin(o);
        r1 = Math.max(r1, minR); r2 = Math.max(r2, minR);
        const vx = x2 - x1, vy = y2 - y1, L2 = vx * vx + vy * vy || 1e-9;
        scan(Math.min(x1 - r1, x2 - r2), Math.min(y1 - r1, y2 - r2), Math.max(x1 + r1, x2 + r2), Math.max(y1 + r1, y2 + r2), (x, y, i) => {
          let t = ((x - x1) * vx + (y - y1) * vy) / L2;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const r = r1 + (r2 - r1) * t;
          const dx = (x - (x1 + vx * t)) / r, dy = (y - (y1 + vy * t)) / r;
          if (dx * dx + dy * dy > 1) return;
          if (o.clip && !o.clip(x, y)) return;
          put(i, m, dx, dy, o, g, zz);
        });
        return g;
      },
      // 折れ線（太さ r0→r1 で先細り）
      line(m, pts, r0, r1, o) {
        o = Object.assign({}, o || {});
        o.g = o.g || ++gid;
        let total = 0;
        const segs = [];
        for (let i = 0; i + 3 < pts.length; i += 2) {
          const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
          segs.push(l); total += l;
        }
        total = total || 1;
        let acc = 0;
        for (let i = 0, k = 0; i + 3 < pts.length; i += 2, k++) {
          const ra = r0 + (r1 - r0) * (acc / total);
          acc += segs[k];
          const rb = r0 + (r1 - r0) * (acc / total);
          D.cap(m, pts[i], pts[i + 1], ra, pts[i + 2], pts[i + 3], rb, o);
        }
        return o.g;
      },
      poly(m, pts, o) {
        o = o || {};
        const [g, zz] = begin(o);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
          x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
          y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
        }
        const bev = o.bevel === undefined ? 2.4 : o.bevel;
        const n = pts.length >> 1;
        scan(x0, y0, x1, y1, (x, y, i) => {
          if (!inPoly(pts, x, y)) return;
          if (o.clip && !o.clip(x, y)) return;
          let best = Infinity, bx = 0, by = 0;
          for (let a = 0, b = n - 1; a < n; b = a++) {
            const xa = pts[a * 2], ya = pts[a * 2 + 1], ex = pts[b * 2] - xa, ey = pts[b * 2 + 1] - ya;
            const L2 = ex * ex + ey * ey || 1e-9;
            let t = ((x - xa) * ex + (y - ya) * ey) / L2;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            const qx = xa + ex * t - x, qy = ya + ey * t - y;
            const d2 = qx * qx + qy * qy;
            if (d2 < best) { best = d2; bx = qx; by = qy; }
          }
          const d = Math.sqrt(best);
          let nx = 0, ny = 0;
          if (bev > 0 && d < bev && d > 1e-6) { const k = (1 - d / bev) * 0.92 / d; nx = bx * k; ny = by * k; }
          put(i, m, nx, ny, o, g, zz);
        });
        return g;
      },
      // 楕円リング（光輪など）
      ring(m, cx, cy, rx, ry, th, o) {
        o = o || {};
        const [g, zz] = begin(o);
        scan(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, i) => {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          const di = Math.sqrt(((x - cx) / (rx - th)) ** 2 + ((y - cy) / Math.max(0.3, ry - th)) ** 2);
          if (d > 1 || di < 1) return;
          const t = (d - (1 - th / rx)) / (th / rx) * 2 - 1;
          put(i, m, dx / (d || 1) * t * 0.8, dy / (d || 1) * t * 0.8, o, g, zz);
        });
        return g;
      },
      // 既存ピクセルの素材だけ塗り替える（陰影の法線はそのまま）
      paint(m, test, o) {
        o = o || {};
        const gs = o.g === undefined ? null : (Array.isArray(o.g) ? o.g : [o.g]);
        for (let py = c[1]; py <= c[3]; py++) {
          const y = DY(py + 0.5);
          for (let px = c[0]; px <= c[2]; px++) {
            const i = py * B.w + px;
            if (!B.g[i]) continue;
            if (gs && gs.indexOf(B.g[i]) < 0) continue;
            if (o.only !== undefined && B.m[i] !== o.only) continue;
            if (test(DX(px + 0.5), y)) {
              if (m !== null) B.m[i] = m;
              if (o.bias) B.b[i] += o.bias;
            }
          }
        }
      },
      paintEll(m, cx, cy, rx, ry, o) {
        o = o || {};
        const rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
        D.paint(m, (x, y) => {
          const px = x - cx, py = y - cy;
          const lx = px * cs + py * sn, ly = -px * sn + py * cs;
          return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
        }, o);
      },
    };
    return D;
  }

  function setPx(B, i, rgb, a) {
    const j = i * 4;
    B.col[j] = rgb[0]; B.col[j + 1] = rgb[1]; B.col[j + 2] = rgb[2]; B.col[j + 3] = a === undefined ? 255 : a;
  }
  function blendPx(B, i, rgb, t) {
    const j = i * 4;
    if (!B.col[j + 3]) { setPx(B, i, rgb, Math.round(255 * t)); return; }
    B.col[j] = B.col[j] + (rgb[0] - B.col[j]) * t;
    B.col[j + 1] = B.col[j + 1] + (rgb[1] - B.col[j + 1]) * t;
    B.col[j + 2] = B.col[j + 2] + (rgb[2] - B.col[j + 2]) * t;
  }
  function shadePass(B, ramps, gloss) {
    for (let i = 0; i < B.n; i++) {
      if (!B.g[i]) continue;
      const I = B.nx[i] * LIGHT[0] + B.ny[i] * LIGHT[1] + B.nz[i] * LIGHT[2] + B.b[i];
      let lv = I < TH[0] ? 1 : I < TH[1] ? 2 : I < TH[2] ? 3 : I < TH[3] ? 4 : 5;
      const m = B.m[i];
      if (lv === 5 && !gloss[m]) lv = 4;
      setPx(B, i, ramps[m][lv]);
    }
  }
  // 前にあるパーツとの境目に、奥側パーツの暗色で線を引く
  function innerLinePass(B, ramps) {
    const W = B.w, mark = [];
    for (let y = 0; y < B.h; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!B.g[i]) continue;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < B.h - 1 ? i + W : -1];
        for (const j of nb) {
          if (j < 0 || !B.g[j] || B.nl[j]) continue;
          if (B.g[j] !== B.g[i] && B.z[j] > B.z[i]) { mark.push(i); break; }
        }
      }
    }
    for (const i of mark) setPx(B, i, mixRgb(ramps[B.m[i]][0], ramps[B.m[i]][1], 0.25));
  }
  // シルエット外周に 1px のアウトライン（隣接パーツ色の暗色。光が当たる左上側は少し明るく）
  function outlinePass(B, ramps, overrideRgb) {
    const W = B.w, H = B.h, out = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (B.g[i]) { B.sil[i] = 1; continue; }
        let m = -1, lit = false;
        if (y < H - 1 && B.g[i + W]) { m = B.m[i + W]; lit = true; }
        else if (x < W - 1 && B.g[i + 1]) { m = B.m[i + 1]; lit = true; }
        else if (x > 0 && B.g[i - 1]) m = B.m[i - 1];
        else if (y > 0 && B.g[i - W]) m = B.m[i - W];
        if (m >= 0) out.push([i, m, lit]);
      }
    }
    for (const [i, m, lit] of out) {
      const base = overrideRgb || ramps[m][0];
      setPx(B, i, lit && !overrideRgb ? mixRgb(base, ramps[m][1], 0.22) : base);
      B.sil[i] = 1;
    }
  }
  function bufToCanvas(B) {
    const cv = document.createElement('canvas');
    cv.width = B.w; cv.height = B.h;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(B.w, B.h);
    id.data.set(B.col);
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  // =================================================================== モンスター: 素材・配色
  const M = { main: 0, sub: 1, acc: 2, white: 3, dark: 4, gold: 5, horn: 6, pink: 7, iris: 8, gem: 9, leaf: 10, wood: 11, wing: 12, flame: 13, flame2: 14, metal: 15, beak: 16, glow: 17, rock: 18 };
  const GLOSS = { 3: 1, 5: 1, 6: 1, 8: 1, 9: 1, 14: 1, 15: 1, 17: 1 };
  const SHAPES = ['blob', 'biped', 'quadruped', 'bird', 'fish', 'serpent', 'insect', 'plant', 'ghost', 'dragon'];
  const TYPE_PAL = {
    normal: { main: ['#d8b088', '#e8d0b0', '#b8a8a0', '#f0b8b0', '#c8a068'], sub: ['#fff8e8', '#f8f0d8'], acc: ['#a86848', '#e86868', '#7890d0'] },
    fire: { main: ['#f07038', '#e85830', '#f89040', '#e84848'], sub: ['#fff0b0', '#f8e0a0'], acc: ['#ffd030', '#fff070'] },
    water: { main: ['#4890f0', '#5898e8', '#38a8d8', '#6880e8'], sub: ['#f0f8ff', '#fff4c8', '#c8e8ff'], acc: ['#f8d848', '#f86880', '#ffffff'] },
    grass: { main: ['#58b050', '#70c050', '#48a068', '#88c848'], sub: ['#e8f8b0', '#fff8d0'], acc: ['#f870a0', '#f8d040', '#ff9060'] },
    electric: { main: ['#f8d030', '#f8c020', '#ffe050'], sub: ['#fff8d0', '#fff0b8'], acc: ['#404048', '#f06030', '#4088f0'] },
    ice: { main: ['#88d8e8', '#a8e0f0', '#b0c8f8'], sub: ['#ffffff', '#e8f8ff'], acc: ['#4878d8', '#8060d0'] },
    fighting: { main: ['#c85838', '#b86848', '#d07048'], sub: ['#f8e0c0', '#f0d0a0'], acc: ['#3858a8', '#f8d040'] },
    poison: { main: ['#a050c0', '#9048b0', '#b868c8'], sub: ['#e8c8f0', '#f0e0f8'], acc: ['#78d850', '#f8e050'] },
    ground: { main: ['#c8a050', '#b88848', '#d8b060'], sub: ['#f0e0b0', '#e8d8a8'], acc: ['#806040', '#e07038'] },
    flying: { main: ['#90a8f0', '#a0b8f8', '#88c0e8'], sub: ['#ffffff', '#f8f0e0'], acc: ['#f8b030', '#f07050'] },
    psychic: { main: ['#f068a0', '#e878c0', '#c878e0'], sub: ['#fff0f8', '#f8e0ff'], acc: ['#58c8f8', '#f8d040'] },
    bug: { main: ['#98b820', '#a8c830', '#78a838'], sub: ['#f0f8b0', '#e8e0a0'], acc: ['#e04838', '#f8d040', '#4070c0'] },
    rock: { main: ['#b0a068', '#a09078', '#988870'], sub: ['#e0d8b8', '#d8c8a8'], acc: ['#e08040', '#70a8d0'] },
    ghost: { main: ['#7058a0', '#6868b0', '#8060b0'], sub: ['#c0b0e8', '#d8d0f8'], acc: ['#f8e058', '#f86898', '#78f0d0'] },
    dragon: { main: ['#6848e8', '#4868d0', '#3890a0'], sub: ['#f8e0a0', '#e8d8b0'], acc: ['#f84848', '#f8c030'] },
    dark: { main: ['#584840', '#484050', '#3c3848'], sub: ['#a09080', '#8c8098'], acc: ['#f84848', '#f8c830'] },
    steel: { main: ['#a8b0c8', '#98a8b8', '#b8b8d0'], sub: ['#e8f0f8', '#d0d8e0'], acc: ['#48a8e8', '#f8c030'] },
  };
  const TYPE_GEM = { fire: '#ff5040', water: '#40a0ff', grass: '#40e080', electric: '#ffe040', ice: '#80f0ff', psychic: '#ff60c0', dragon: '#a060ff', dark: '#ff3050', ghost: '#c070ff', steel: '#60d0ff', poison: '#c050f0', fairy: '#ff90d0' };
  const SHAPE_BY_TYPE = {
    normal: { blob: 3, quadruped: 3, biped: 3, bird: 2 },
    fire: { quadruped: 4, biped: 3, dragon: 2, blob: 1 },
    water: { fish: 4, blob: 2, serpent: 2, quadruped: 1 },
    grass: { plant: 5, quadruped: 2, blob: 1, biped: 1 },
    electric: { quadruped: 3, blob: 3, biped: 2, bird: 1 },
    ice: { blob: 3, quadruped: 2, bird: 2, biped: 1 },
    fighting: { biped: 6, quadruped: 1 },
    poison: { serpent: 3, blob: 3, insect: 2, plant: 1 },
    ground: { quadruped: 4, biped: 2, serpent: 1, blob: 1 },
    flying: { bird: 7, dragon: 1 },
    psychic: { biped: 3, blob: 3, ghost: 2, bird: 1 },
    bug: { insect: 7, blob: 1 },
    rock: { biped: 3, quadruped: 2, blob: 3 },
    ghost: { ghost: 7, blob: 1 },
    dragon: { dragon: 6, serpent: 2 },
    dark: { quadruped: 3, biped: 2, bird: 2, ghost: 1 },
    steel: { biped: 3, blob: 2, insect: 1, quadruped: 2 },
  };

  function rarityRankOf(r) {
    const order = Array.isArray(GD().rarityOrder) && GD().rarityOrder.length ? GD().rarityOrder : ['N', 'R', 'SR', 'SSR', 'UR'];
    const i = order.indexOf(r);
    return clamp(i < 0 ? 0 : i, 0, 4);
  }
  function monsterSeed(def) {
    const sp = def.sprite || {};
    const sd = Number(sp.seed);
    if (sd && isFinite(sd)) return (sd >>> 0) || 1;
    return hashStr(def.id || def.name || 'monster');
  }

  // =================================================================== モンスター: 部品
  const CX = 32, GY = 61;

  function drawLeaf(D, x, y, len, wid, ang, mat, z, g) {
    const pts = [], n = 8, ca = Math.cos(ang), sa = Math.sin(ang);
    const wAt = (t) => wid * Math.sin(Math.PI * t) * (1 - 0.25 * t);
    for (let i = 0; i <= n; i++) { const t = i / n, ax = t * len, w = wAt(t); pts.push(x + ca * ax - sa * w, y + sa * ax + ca * w); }
    for (let i = n - 1; i >= 1; i--) { const t = i / n, ax = t * len, w = wAt(t); pts.push(x + ca * ax + sa * w, y + sa * ax - ca * w); }
    const gg = D.poly(mat, pts, { z, g, bevel: Math.max(1.2, wid * 0.7) });
    D.paint(null, (px, py) => {
      const rx = px - x, ry = py - y, along = rx * ca + ry * sa, across = -rx * sa + ry * ca;
      return along > len * 0.12 && along < len * 0.78 && Math.abs(across) < 0.5;
    }, { g: gg, bias: -0.45 });
    return gg;
  }
  function drawFlame(D, x, y, R, z) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push(x + Math.cos(a) * R, y + Math.sin(a) * R * 0.85); }
    pts.push(x - R * 1.0, y - R * 0.35, x - R * 0.95, y - R * 1.35, x - R * 0.35, y - R * 0.75, x + R * 0.05, y - R * 2.3,
      x + R * 0.42, y - R * 0.95, x + R * 0.95, y - R * 1.45, x + R * 1.02, y - R * 0.2);
    const g = D.poly(M.flame, pts, { z, bevel: R * 0.6, bias: 0.18 });
    D.paint(M.flame2, (px, py) => {
      const dx = (px - x - R * 0.05) / (R * 0.55), dy = (py - y - R * 0.05) / (R * 0.7);
      return dx * dx + dy * dy <= 1 || (py < y && py > y - R * 1.5 && Math.abs(px - x - R * 0.05) < (py - (y - R * 1.5)) * 0.35);
    }, { g });
    return g;
  }
  function drawBolt(D, x, y, sz, z, mat, k) {
    k = k || 1;
    const p = [0, 0, 5, -5, 2.5, -5.5, 7, -11, 1, -6.5, 3.5, -6, -1.5, 0.5];
    const pts = [];
    for (let i = 0; i < p.length; i += 2) pts.push(x + p[i] * sz * k, y + p[i + 1] * sz);
    return D.poly(mat, pts, { z, bevel: 1.4 });
  }
  function drawCrystal(D, x, y, h, w, ang, z, mat) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (a, b) => [x + ca * a - sa * b, y + sa * a + ca * b];
    const pts = [].concat(P(0, -w * 0.5), P(h * 0.62, -w * 0.5), P(h, 0), P(h * 0.62, w * 0.5), P(0, w * 0.5));
    return D.poly(mat, pts, { z, bevel: w * 0.55 });
  }
  function drawSpikeRow(D, pts, mat, z, sz) {
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], a = pts[i + 2];
      const ca = Math.cos(a), sa = Math.sin(a), w = 2.6 * sz, h = 5.5 * sz;
      D.poly(mat, [x - sa * w, y + ca * w, x + ca * h, y + sa * h, x + sa * w, y - ca * w], { z, bevel: 1.5 });
    }
  }

  function drawEars(D, P, kind, hx, hy, hr, hry, sz, zh) {
    if (!kind || kind === 'none') return;
    const back = P.back;
    D.sym((k) => {
      const bx = hx + k * hr * 0.55, by = hy - hry * 0.72;
      const g = D.g();
      if (kind === 'cat' || kind === 'pointy') {
        const h = (kind === 'pointy' ? 14 : 10) * sz, w = (kind === 'pointy' ? 5.4 : 5.8) * sz;
        const pts = [bx - k * w, by + 3.5, bx + k * w * 1.05, by + 4, bx + k * w * 0.6, by - h];
        D.poly(M.main, pts, { g, z: zh - 1, bevel: 2.6 });
        if (!back) {
          const cxT = (pts[0] + pts[2] + pts[4]) / 3, cyT = (pts[1] + pts[3] + pts[5]) / 3 + 1.2;
          const sh = pts.map((v, i) => (i % 2 ? cyT + (v - cyT) * 0.55 : cxT + (v - cxT) * 0.5));
          D.paint(P.innerEar, (x, y) => inPoly(sh, x, y), { g });
        }
      } else if (kind === 'round') {
        D.ell(M.main, bx + k * 1.2, by - 1.2, 5 * sz, 4.7 * sz, { g, z: zh - 1 });
        if (!back) D.paintEll(P.innerEar, bx + k * 1.2, by - 0.6, 2.7 * sz, 2.5 * sz, { g });
      } else if (kind === 'bunny') {
        D.ell(M.main, bx + k * 1.2, by - 9 * sz, 3.5 * sz, 10.5 * sz, { g, z: zh - 1, rot: k * 0.2 });
        if (!back) D.paintEll(P.innerEar, bx + k * 1.2, by - 8.3 * sz, 1.6 * sz, 7.8 * sz, { g, rot: k * 0.2 });
      } else if (kind === 'droop') {
        D.ell(M.main, hx + k * (hr - 0.2), hy - hry * 0.02, 4 * sz, 8.8 * sz, { g, z: zh + 0.5, rot: -k * 0.32 });
        D.paintEll(null, hx + k * (hr + 1.5), hy + hry * 0.2, 4 * sz, 5 * sz, { g, bias: -0.12 });
      } else if (kind === 'fin') {
        const pts = [bx - k * 2.5, by + 3.5, bx + k * 2, by - 9 * sz, bx + k * 6 * sz, by - 5.5 * sz, bx + k * 10 * sz, by - 5 * sz, bx + k * 5.5, by + 3.5];
        D.poly(P.finMat, pts, { g, z: zh - 1, bevel: 2 });
      }
    });
  }

  function drawTuft(D, P, kind, x, y, sz, z) {
    if (kind === 'sprout') {
      D.line(M.leaf, [x, y + 2.5, x + 0.3, y - 2.5], 1.1, 0.9, { z });
      drawLeaf(D, x, y - 2, 9 * sz, 3.8 * sz, -2.35, M.leaf, z + 0.1);
      drawLeaf(D, x, y - 2, 10 * sz, 4.2 * sz, -0.75, M.leaf, z + 0.1);
    } else if (kind === 'curl') {
      D.line(M.main, [x - 1, y + 3, x - 0.5, y - 2.5, x + 2, y - 5.5, x + 5, y - 5, x + 5.5, y - 2.5, x + 3.5, y - 1.5], 2.4 * sz, 1.1 * sz, { z });
    } else if (kind === 'spikes') {
      const g = D.g();
      D.poly(M.main, [x - 6, y + 3, x - 5.5, y - 5 * sz, x - 2, y + 2], { g, z, bevel: 1.6 });
      D.poly(M.main, [x - 2.5, y + 3, x, y - 8 * sz, x + 2.5, y + 3], { g, z, bevel: 1.6 });
      D.poly(M.main, [x + 2, y + 2, x + 5.5, y - 5 * sz, x + 6, y + 3], { g, z, bevel: 1.6 });
    } else if (kind === 'antenna') {
      D.line(M.main, [x, y + 2.5, x + 1, y - 5, x + 3.5, y - 9], 1.3, 0.9, { z });
      D.ell(M.acc, x + 3.8, y - 10.5, 2.6, 2.6, { z: z + 0.1 });
    } else if (kind === 'fluff') {
      const g = D.g();
      D.ell(M.main, x - 3.5, y, 3.4, 3, { g, z });
      D.ell(M.main, x + 3.5, y, 3.4, 3, { g, z });
      D.ell(M.main, x, y - 2.5, 3.8, 3.4, { g, z });
    }
  }

  // しっぽ（正面では体の後ろから横に、背面では体の手前中央から）
  function drawTail(D, P, kind, bx, by, size, sc) {
    const k = P.tdir, back = P.back;
    const z = back ? 6 : -6;
    const x0 = back ? CX + k * 1.5 : bx, y0 = back ? by + 1.5 : by;
    const g = D.g();
    const o = { g, z };
    let tip = null;
    const pts = [];
    if (kind === 'point') {
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(x0 + k * size * (0.25 * t + 0.42 * Math.sin(t * 2.6)), y0 - size * 1.05 * t); }
      D.line(M.main, pts, 2.9 * sc, 1.3 * sc, o);
      const tx = pts[16], ty = pts[17];
      D.poly(M.main, [tx - 3.6 * sc, ty + 1.5, tx + k * 0.5, ty - 5.5 * sc, tx + 3.6 * sc, ty + 1.5, tx, ty + 0.2], { g, z, bevel: 1.6 });
      tip = { x: tx, y: ty - 3 };
    } else if (kind === 'curl') {
      const rad = size * 0.36, cx0 = x0 + k * size * 0.38, cy0 = y0 - rad * 0.95;
      pts.push(x0, y0);
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 0.5 - i / 12 * Math.PI * 1.75, rr = rad * (1 - i / 12 * 0.5);
        pts.push(cx0 + k * Math.cos(a) * rr, cy0 + Math.sin(a) * rr);
      }
      D.line(M.main, pts, 3.1 * sc, 1.7 * sc, o);
      tip = { x: cx0 + k * rad * 0.9, y: cy0 - rad * 0.7 };
    } else if (kind === 'thick') {
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(x0 + k * size * (0.15 + 0.85 * t), y0 + size * (0.22 * Math.sin(t * 2.2) - 0.75 * t * t)); }
      D.line(M.main, pts, 5 * sc, 1.4 * sc, o);
      tip = { x: pts[16], y: pts[17] - 1 };
    } else if (kind === 'bushy') {
      D.ell(M.main, x0 + k * 3, y0 - 1, 4.5 * sc, 4 * sc, o);
      D.ell(M.main, x0 + k * size * 0.45, y0 - size * 0.42, 6 * sc, 7.2 * sc, Object.assign({ rot: k * 0.45 }, o));
      D.ell(M.main, x0 + k * size * 0.58, y0 - size * 0.9, 5.6 * sc, 6.4 * sc, Object.assign({ rot: k * 0.2 }, o));
      D.paintEll(M.sub, x0 + k * size * 0.62, y0 - size * 1.05, 5 * sc, 4.2 * sc, { g });
      tip = { x: x0 + k * size * 0.6, y: y0 - size * 1.1 };
    } else if (kind === 'round') {
      D.ell(M.sub, x0 + k * (back ? 0 : size * 0.22), y0 + (back ? -1 : 0), 4.6 * sc, 4.2 * sc, o);
    } else if (kind === 'thin') {
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(x0 + k * size * (0.1 + 0.8 * t), y0 - size * (0.9 * t * t - 0.2 * t)); }
      D.line(M.main, pts, 1.6 * sc, 1.2 * sc, o);
      const tx = pts[16], ty = pts[17];
      D.ell(M.acc, tx + k * 0.5, ty - 1.5, 3 * sc, 3.6 * sc, Object.assign({ rot: k * 0.4 }, o));
      tip = { x: tx, y: ty - 3 };
    }
    if (tip) tip.z = z + 0.2;
    return tip;
  }

  function drawWings(D, P, kind, x, y, span, mat) {
    const back = P.back, z = back ? 7 : -7;
    D.sym((k) => {
      const g = D.g();
      if (kind === 'feather' || kind === 'angel') {
        const pts = [x + k * 2, y - 2, x + k * span * 0.45, y - span * 0.62, x + k * span, y - span * 0.8,
          x + k * span * 0.96, y - span * 0.42, x + k * span * 0.8, y - span * 0.3, x + k * span * 0.84, y - span * 0.02,
          x + k * span * 0.62, y - span * 0.06, x + k * span * 0.62, y + span * 0.22, x + k * span * 0.38, y + span * 0.08, x + k * 2, y + 3.5];
        D.poly(mat, pts, { g, z, bevel: 2.4 });
        D.paint(kind === 'angel' ? null : M.sub, (px, py) => (px - x) * k > span * 0.55 && py > y - span * 0.5, { g, bias: -0.06 });
        D.paint(null, (px, py) => { const u = (px - x) * k; return (Math.abs(py - (y - span * 0.3 + u * 0.12)) < 0.5 && u > span * 0.3 && u < span * 0.85); }, { g, bias: -0.35 });
      } else if (kind === 'bat') {
        const tipX = x + k * span, tipY = y - span * 0.72;
        const pts = [x + k * 1.5, y - 3, x + k * span * 0.5, y - span * 0.75, tipX, tipY,
          x + k * span * 0.96, y + span * 0.12, x + k * span * 0.72, y - span * 0.04, x + k * span * 0.6, y + span * 0.3,
          x + k * span * 0.4, y + span * 0.06, x + k * span * 0.26, y + span * 0.32, x + k * 1.5, y + 3];
        D.poly(mat, pts, { g, z, bevel: 1.8 });
        const bones = [[x + k * span * 0.96, y + span * 0.12], [x + k * span * 0.6, y + span * 0.3], [x + k * span * 0.26, y + span * 0.32]];
        for (const bn of bones) D.line(M.main, [tipX, tipY, bn[0], bn[1]], 1, 0.7, { g, z: z + 0.01 });
        D.line(M.main, [x + k * 1.5, y - 2, x + k * span * 0.5, y - span * 0.74, tipX, tipY], 1.5, 1, { g, z: z + 0.01 });
      } else if (kind === 'bug') {
        D.ell(mat, x + k * span * 0.52, y - span * 0.34, span * 0.58, span * 0.26, { g, z, rot: -k * 0.55, flat: 0.5 });
        D.ell(mat, x + k * span * 0.42, y + span * 0.08, span * 0.4, span * 0.2, { g, z: z - 0.1, rot: k * 0.3, flat: 0.5 });
        D.paint(null, (px, py) => { const u = (px - x) * k; return Math.abs((py - y) + u * 0.55 + span * 0.05) < 0.45 && u > 2; }, { g, bias: -0.4 });
      } else if (kind === 'tiny') {
        const s2 = span;
        D.poly(mat, [x + k * 1, y - 1, x + k * s2 * 0.9, y - s2 * 0.75, x + k * s2, y - s2 * 0.3, x + k * s2 * 0.7, y - s2 * 0.15, x + k * s2 * 0.72, y + s2 * 0.12, x + k * 1, y + 2.5], { g, z, bevel: 1.8 });
      }
    });
  }

  function drawHorns(D, P, kind, head, mat, sz) {
    const z = head.z - 0.5, top = head.top, rx = head.rx;
    if (kind === 'uni') {
      D.poly(mat, [CX - 3 * sz, top + 3.5, CX, top - 11 * sz, CX + 3 * sz, top + 3.5], { z, bevel: 2 });
      return;
    }
    D.sym((k) => {
      const bx = CX + k * rx * 0.42;
      if (kind === 'curve') {
        D.line(mat, [bx, top + 3, bx + k * 2.5 * sz, top - 3 * sz, bx + k * 6 * sz, top - 8 * sz, bx + k * 11 * sz, top - 10 * sz], 3 * sz, 0.8, { z });
      } else if (kind === 'straight') {
        D.cap(mat, bx, top + 3, 2.8 * sz, bx + k * 3 * sz, top - 8 * sz, 0.7, { z });
      } else if (kind === 'ram') {
        const cx = CX + k * (rx * 0.82), cy = head.cy - head.ry * 0.35;
        const pts = [];
        for (let i = 0; i <= 10; i++) { const a = -Math.PI * 0.75 + i / 10 * Math.PI * 1.5; const rr = 6 * sz * (1 - i / 10 * 0.45); pts.push(cx + k * Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        D.line(mat, pts, 2.8 * sz, 1.4 * sz, { z: head.z + 0.4 });
      } else if (kind === 'antler') {
        D.line(mat, [bx, top + 3, bx + k * 2 * sz, top - 5 * sz, bx + k * 4 * sz, top - 11 * sz], 1.8 * sz, 1, { z });
        D.line(mat, [bx + k * 2 * sz, top - 5 * sz, bx + k * 7 * sz, top - 8 * sz], 1.4 * sz, 0.9, { z });
        D.line(mat, [bx + k * 1 * sz, top - 1 * sz, bx - k * 1.5 * sz, top - 6 * sz], 1.3 * sz, 0.9, { z });
      }
    });
  }

  function drawCrown(D, head, back) {
    const w = clamp(head.rx * 0.95, 8, 13), by = head.top + 3, z = head.z + (back ? 0.5 : 0.5);
    const pts = [CX - w / 2, by, CX - w / 2, by - 6.5, CX - w / 4, by - 3.2, CX, by - 8.5, CX + w / 4, by - 3.2, CX + w / 2, by - 6.5, CX + w / 2, by];
    const g = D.poly(M.gold, pts, { z, bevel: 1.8 });
    D.ell(M.gold, CX - w / 2, by - 7, 1.4, 1.4, { g, z });
    D.ell(M.gold, CX + w / 2, by - 7, 1.4, 1.4, { g, z });
    D.ell(M.gold, CX, by - 9, 1.5, 1.5, { g, z });
    D.ell(M.gem, CX, by - 2, 1.9, 1.7, { z: z + 0.1 });
  }

  function drawMane(D, head, mat) {
    const g = D.g();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.92 + i / (n - 1) * 1.16);
      D.ell(mat, head.cx + Math.cos(a) * (head.rx + 0.5), head.cy + Math.sin(a) * (head.ry + 0.5) + 1, 4.8, 4.4, { g, z: head.z - 0.8 });
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.18 + i / 3 * 0.64);
      D.ell(mat, head.cx + Math.cos(a) * head.rx * 0.95, head.cy + Math.sin(a) * head.ry * 0.9, 4.2, 4, { g, z: head.z - 0.8 });
    }
  }

  // =================================================================== モンスター: 形状ビルダー
  // それぞれ乱数を先にすべて引いてから描く（正面/背面で同じ乱数列を使うため）
  const BUILDERS = {};

  BUILDERS.blob = function (D, R, P) {
    const bw = R.f(15, 19), bh = R.f(13, 16);
    const ear = R.pick(['none', 'cat', 'round', 'bunny', 'droop', 'pointy', 'none']);
    const earSz = R.f(0.8, 1.1);
    const feet = R.c(0.75), arms = R.c(0.6);
    const tail = R.pick(['none', 'curl', 'round', 'point', 'none']);
    const tuft = R.pick(['none', 'none', 'sprout', 'curl', 'spikes', 'antenna']);
    const belly = R.c(0.6);
    const squash = R.f(0.92, 1.05);
    const back = P.back;
    const cy = GY - bh * squash;
    const A = { headFree: tuft === 'none', hasEars: ear !== 'none' };
    if (tail !== 'none') A.tailTip = drawTail(D, P, tail, CX + P.tdir * bw * 0.6, cy + bh * 0.35, bh * 0.95, 0.9);
    drawEars(D, P, ear, CX, cy + bh * 0.05, bw * 0.92, bh, earSz, 0);
    const gb = D.ell(M.main, CX, cy, bw, bh * squash, {});
    if (belly && !back) D.paintEll(M.sub, CX, cy + bh * 0.55, bw * 0.62, bh * 0.6, { g: gb });
    if (feet) D.sym((k) => D.ell(M.main, CX + k * bw * 0.5, GY - 1.2, bw * 0.26, 2.8, { z: 1 }));
    if (arms) D.sym((k) => D.ell(M.main, CX + k * (bw - 0.8), cy + bh * 0.22, 3.8, 2.6, { rot: -k * 0.6, z: back ? -1 : 1 }));
    drawTuft(D, P, tuft, CX, cy - bh * squash + 1, 1, 0.5);
    A.head = { cx: CX, cy, rx: bw, ry: bh, top: cy - bh * squash, g: gb, z: 0 };
    A.body = A.head;
    A.face = { y: cy - bh * 0.1, gap: bw * 0.2, ew: bh * 0.3, eh: bh * 0.42, my: cy + bh * 0.24 };
    A.forehead = { x: CX, y: cy - bh * 0.58 };
    A.backPt = { x: CX, y: cy - bh * 0.35 };
    return A;
  };

  BUILDERS.biped = function (D, R, P) {
    const hr = R.f(11.5, 14), hry = hr * R.f(0.86, 0.97);
    const br = R.f(8.5, 11), bry = R.f(8.5, 10.5);
    const legH = R.f(3.5, 6.5), legR = R.f(3, 4);
    const armR = R.f(2.5, 3.3), armOut = R.f(1.5, 5), armDown = R.f(0.15, 0.55);
    const ear = R.pick(['cat', 'round', 'bunny', 'droop', 'pointy', 'none', 'fin']);
    const earSz = R.f(0.85, 1.15);
    const tail = R.pick(['curl', 'point', 'round', 'none', 'thick', 'bushy']);
    const tuft = R.pick(['none', 'none', 'curl', 'spikes', 'sprout']);
    const belly = R.c(0.75);
    const back = P.back;
    const bodyCy = GY - legH - bry * 0.9;
    const headCy = bodyCy - bry * 0.62 - hry * 0.82;
    const A = { headFree: tuft === 'none', hasEars: ear !== 'none' };
    if (tail !== 'none') A.tailTip = drawTail(D, P, tail, CX + P.tdir * br * 0.7, bodyCy + bry * 0.3, 14, 1);
    D.sym((k) => {
      const g = D.g();
      D.cap(M.main, CX + k * br * 0.42, bodyCy + bry * 0.4, legR, CX + k * br * 0.48, GY - 2, legR * 0.95, { g, z: -0.5 });
      D.ell(M.main, CX + k * br * 0.52, GY - 2.2, legR + 1.3, 2.4, { g, z: -0.5 });
    });
    const gb = D.ell(M.main, CX, bodyCy, br, bry, {});
    if (belly && !back) D.paintEll(M.sub, CX, bodyCy + bry * 0.15, br * 0.62, bry * 0.72, { g: gb });
    D.sym((k) => {
      D.cap(M.main, CX + k * (br - 1.2), bodyCy - bry * 0.5, armR, CX + k * (br + armOut), bodyCy + bry * armDown, armR * 0.95, { z: back ? -1 : 1 });
    });
    const zH = 2;
    drawEars(D, P, ear, CX, headCy, hr, hry, earSz, zH);
    const gh = D.ell(M.main, CX, headCy, hr, hry, { z: zH });
    drawTuft(D, P, tuft, CX, headCy - hry + 1, 1, zH + 0.5);
    A.head = { cx: CX, cy: headCy, rx: hr, ry: hry, top: headCy - hry, g: gh, z: zH };
    A.body = { cx: CX, cy: bodyCy, rx: br, ry: bry, g: gb };
    A.face = { y: headCy + hry * 0.08, gap: hr * 0.2, ew: hr * 0.3, eh: hry * 0.42, my: headCy + hry * 0.52 };
    A.forehead = { x: CX, y: headCy - hry * 0.5 };
    A.backPt = { x: CX, y: bodyCy - bry * 0.4 };
    return A;
  };

  BUILDERS.quadruped = function (D, R, P) {
    const bw = R.f(15, 19), bh = R.f(9.5, 12);
    const hr = R.f(11, 13.5), hry = hr * R.f(0.82, 0.94);
    const legR = R.f(3.2, 4.2), legH = R.f(9, 12.5);
    const snout = R.pick(['short', 'short', 'long', 'none']);
    const ear = R.pick(['pointy', 'cat', 'round', 'droop', 'pointy', 'bunny']);
    const earSz = R.f(0.9, 1.2);
    const tail = R.pick(['bushy', 'curl', 'point', 'thin', 'bushy']);
    const chest = R.pick(['ruff', 'patch', 'none', 'patch']);
    const back = P.back;
    const bodyCy = GY - legH - bh * 0.3;
    const headCy = bodyCy - bh * 0.5 - hry * 0.42;
    const A = { headFree: true, hasEars: true };
    if (tail !== 'none') A.tailTip = drawTail(D, P, tail, CX + P.tdir * bw * 0.62, bodyCy - bh * 0.3, 15, 1);
    D.sym((k) => {
      const g = D.g();
      D.cap(M.main, CX + k * bw * 0.7, bodyCy, legR * 0.95, CX + k * bw * 0.74, GY - 3.2, legR * 0.9, { g, z: back ? 2 : -2 });
      D.ell(M.main, CX + k * bw * 0.76, GY - 3.2, legR + 1, 2.2, { g, z: back ? 2 : -2 });
    });
    const gb = D.ell(M.main, CX, bodyCy, bw, bh, { z: back ? 1 : -1 });
    D.sym((k) => {
      const g = D.g();
      D.cap(M.main, CX + k * bw * 0.3, bodyCy + 1, legR, CX + k * bw * 0.32, GY - 2, legR * 0.95, { g, z: back ? -2 : 1 });
      D.ell(M.main, CX + k * bw * 0.33, GY - 2, legR + 1.3, 2.4, { g, z: back ? -2 : 1 });
    });
    if (!back && chest === 'patch') D.paintEll(M.sub, CX, bodyCy + bh * 0.1, bw * 0.42, bh * 0.75, { g: gb });
    if (back) D.paintEll(null, CX, bodyCy + bh * 0.2, bw * 0.3, bh * 0.35, { g: gb, bias: -0.05 });
    const hy = back ? headCy - 2.5 : headCy;
    const zH = back ? -3 : 3;
    if (!back && chest === 'ruff') {
      const ry = hy + hry * 0.7;
      D.poly(M.sub, [CX - 9, ry - 2, CX + 9, ry - 2, CX + 7.5, ry + 4, CX + 4, ry + 2.5, CX + 2, ry + 6.5, CX, ry + 3.5, CX - 2, ry + 6.5, CX - 4, ry + 2.5, CX - 7.5, ry + 4], { z: zH - 0.5, bevel: 2 });
    }
    drawEars(D, P, ear, CX, hy, hr, hry, earSz, zH);
    const gh = D.ell(M.main, CX, hy, hr, hry, { z: zH });
    A.head = { cx: CX, cy: hy, rx: hr, ry: hry, top: hy - hry, g: gh, z: zH };
    A.body = { cx: CX, cy: bodyCy, rx: bw, ry: bh, g: gb };
    A.face = { y: hy - hry * 0.05, gap: hr * 0.22, ew: hr * 0.27, eh: hry * 0.38, my: hy + hry * 0.55 };
    if (snout !== 'none' && !back) {
      const sy = hy + hry * 0.42;
      const srx = snout === 'long' ? 6.8 : 5.6, sry = snout === 'long' ? 4.8 : 3.8;
      D.ell(M.sub, CX, sy, srx, sry, { z: zH + 0.5 });
      A.face.nose = { y: sy - sry * 0.45 };
      A.face.my = sy + sry * 0.35;
      A.face.y = hy - hry * 0.18;
    }
    A.forehead = { x: CX, y: hy - hry * 0.55 };
    A.backPt = { x: CX, y: bodyCy - bh * 0.6 };
    return A;
  };

  BUILDERS.bird = function (D, R, P) {
    const br = R.f(11.5, 14), bry = R.f(12.5, 15);
    const sepHead = R.c(0.55), hr = R.f(9, 11);
    const wing = R.pick(['spread', 'spread', 'folded', 'up']);
    const span = R.f(13, 18);
    const crest = R.pick(['none', 'tuft', 'long', 'three', 'none']);
    const beak = R.pick(['short', 'hook', 'long']);
    const tailF = R.c(0.8);
    const legLen = R.f(3.5, 6);
    const back = P.back;
    const bodyCy = GY - legLen - bry;
    const A = { headFree: crest === 'none', hasWings: true, hasEars: false };
    if (tailF) {
      const g = D.g(), ty = bodyCy + bry * 0.55, zt = back ? 5 : -3;
      D.sym((k) => D.poly(M.main, [CX + k * 2, ty - 4, CX + k * 9, ty + 7, CX + k * 4.5, ty + 9, CX + k * 1, ty + 4], { g, z: zt, bevel: 2 }));
      D.poly(M.main, [CX - 2.8, ty - 3, CX + 2.8, ty - 3, CX + 2.5, ty + 11, CX - 2.5, ty + 11], { g, z: zt, bevel: 2 });
      D.paint(M.acc, (x, y) => y > ty + 6, { g });
    }
    if (wing === 'spread' || wing === 'up') {
      drawWings(D, P, 'feather', CX + 0, bodyCy - bry * 0.35 - (wing === 'up' ? 3 : 0), br + span * (wing === 'up' ? 0.85 : 1), M.main);
    }
    D.sym((k) => {
      const g = D.g();
      D.cap(M.beak, CX + k * 4, bodyCy + bry * 0.8, 1.3, CX + k * 4.5, GY - 1, 1.2, { g, z: -0.5 });
      D.cap(M.beak, CX + k * 4.5, GY - 1, 1.1, CX + k * 7.5, GY - 0.5, 0.9, { g, z: -0.5 });
      D.cap(M.beak, CX + k * 4.5, GY - 1, 1.1, CX + k * 2, GY - 0.3, 0.9, { g, z: -0.5 });
    });
    const gb = D.ell(M.main, CX, bodyCy, br, bry, {});
    if (!back) D.paintEll(M.sub, CX, bodyCy + bry * 0.35, br * 0.66, bry * 0.66, { g: gb });
    if (wing === 'folded') {
      D.sym((k) => {
        const g = D.ell(M.main, CX + k * br * 0.82, bodyCy + 1, 5.5, bry * 0.72, { z: 1, rot: -k * 0.22 });
        D.paint(M.acc, (x, y) => y > bodyCy + bry * 0.35, { g });
      });
    }
    let head;
    if (sepHead) {
      const hy = bodyCy - bry * 0.88;
      const gh = D.ell(M.main, CX, hy, hr, hr * 0.92, { z: 2 });
      head = { cx: CX, cy: hy, rx: hr, ry: hr * 0.92, top: hy - hr * 0.92, g: gh, z: 2 };
    } else {
      head = { cx: CX, cy: bodyCy - bry * 0.35, rx: br, ry: bry * 0.65, top: bodyCy - bry, g: gb, z: 0 };
    }
    const zc = head.z - 0.5;
    if (crest === 'tuft') drawTuft(D, P, 'spikes', CX, head.top + 1.5, 0.9, zc);
    else if (crest === 'long') D.sym((k) => D.line(M.acc, [CX + k * 1, head.top + 2, CX + k * 3, head.top - 5, CX + k * 7, head.top - 9], 2, 0.8, { z: zc }));
    else if (crest === 'three') {
      const g = D.g();
      for (let i = -1; i <= 1; i++) D.line(M.acc, [CX + i * 1.5, head.top + 2, CX + i * 4, head.top - 5, CX + i * 6.5, head.top - 8.5], 1.8, 0.8, { g, z: zc });
    }
    const eyeY = head.cy - head.ry * (sepHead ? 0.05 : 0.2);
    A.face = { y: eyeY, gap: head.rx * 0.24, ew: head.rx * 0.3, eh: head.rx * 0.42, my: eyeY + 5, noMouth: true };
    if (!back) {
      const by = eyeY + head.rx * 0.18;
      if (beak === 'short') D.poly(M.beak, [CX - 3.2, by, CX + 3.2, by, CX, by + 5], { z: head.z + 0.5, bevel: 1.6 });
      else if (beak === 'hook') D.poly(M.beak, [CX - 3.5, by, CX + 3.5, by, CX + 2, by + 4, CX, by + 6.5, CX - 1.2, by + 4.5], { z: head.z + 0.5, bevel: 1.6 });
      else D.poly(M.beak, [CX - 2.6, by, CX + 2.6, by, CX + 0.6, by + 8, CX - 0.6, by + 8], { z: head.z + 0.5, bevel: 1.4 });
    }
    A.head = head;
    A.body = { cx: CX, cy: bodyCy, rx: br, ry: bry, g: gb };
    A.forehead = { x: CX, y: head.cy - head.ry * 0.55 };
    A.backPt = { x: CX, y: bodyCy - bry * 0.4 };
    return A;
  };

  BUILDERS.fish = function (D, R, P) {
    const bw = R.f(15, 18.5), bh = R.f(12.5, 15.5);
    const side = R.pick(['fan', 'small', 'long']);
    const dorsal = R.pick(['sail', 'spike', 'fan', 'none']);
    const tailF = R.pick(['fork', 'fan', 'round']);
    const lips = R.c(0.45), whisk = R.c(0.3), lantern = R.c(0.25), gills = R.c(0.6);
    const bubbles = R.c(0.6);
    const back = P.back;
    const cy = 32;
    const A = { headFree: dorsal === 'none' && !lantern, hasEars: false, floating: true };
    const zd = back ? -2 : -2;
    if (dorsal === 'sail') {
      const g = D.poly(P.finMat, [CX - 7, cy - bh + 3, CX - 2, cy - bh - 10, CX + 4, cy - bh - 7, CX + 9, cy - bh + 3], { z: zd, bevel: 2 });
      D.paint(null, (x, y) => Math.abs(((x - CX) + 1) % 4) < 0.6, { g, bias: -0.3 });
    } else if (dorsal === 'spike') {
      drawSpikeRow(D, [CX - 6, cy - bh + 2, -2.1, CX, cy - bh + 1, -Math.PI / 2, CX + 6, cy - bh + 2, -1.05], P.finMat, zd, 1.1);
    } else if (dorsal === 'fan') {
      const g = D.g();
      for (let i = -2; i <= 2; i++) D.line(P.finMat, [CX + i * 1.2, cy - bh + 3, CX + i * 3.5, cy - bh - 7 + Math.abs(i) * 1.5], 2.2, 1.6, { g, z: zd });
    }
    if (back) {
      const g = D.g(), ty = cy + bh * 0.5;
      if (tailF === 'fork') D.poly(P.finMat, [CX - 3, ty - 5, CX + 3, ty - 5, CX + 13, ty + 9, CX + 5, ty + 6, CX, ty + 3, CX - 5, ty + 6, CX - 13, ty + 9], { g, z: 5, bevel: 2 });
      else if (tailF === 'fan') D.poly(P.finMat, [CX - 3, ty - 5, CX + 3, ty - 5, CX + 12, ty + 7, CX + 6, ty + 10, CX, ty + 8, CX - 6, ty + 10, CX - 12, ty + 7], { g, z: 5, bevel: 2 });
      else D.ell(P.finMat, CX, ty + 3, 8, 7, { g, z: 5 });
      D.paint(null, (x, y) => y > ty - 2 && Math.abs(((x - CX) % 3.5 + 3.5) % 3.5 - 1.75) < 0.4, { g, bias: -0.3 });
    }
    const gb = D.ell(M.main, CX, cy, bw, bh, {});
    if (!back) D.paintEll(M.sub, CX, cy + bh * 0.62, bw * 0.78, bh * 0.62, { g: gb });
    else D.paint(M.acc, (x, y) => Math.abs(x - CX) < 1.3 && y < cy + bh * 0.3, { g: gb });
    if (gills && !back) D.sym((k) => D.paint(null, (x, y) => { const u = (x - CX) * k; return Math.abs(u - bw * 0.72 - (y - cy) * 0.15) < 0.5 && Math.abs(y - cy) < bh * 0.35; }, { g: gb, bias: -0.35 }));
    D.sym((k) => {
      const g = D.g(), fx = CX + k * (bw - 2), fy = cy + bh * 0.1;
      if (side === 'fan') D.poly(P.finMat, [fx, fy - 3, fx + k * 10, fy - 1, fx + k * 11, fy + 5, fx + k * 6, fy + 7, fx, fy + 3], { g, z: 1, bevel: 2 });
      else if (side === 'small') D.ell(P.finMat, fx + k * 3, fy + 1, 4.5, 3, { g, z: 1, rot: k * 0.5 });
      else D.poly(P.finMat, [fx, fy - 2, fx + k * 8, fy + 3, fx + k * 9, fy + 12, fx + k * 3, fy + 6, fx - k * 1, fy + 3], { g, z: 1, bevel: 2 });
      D.paint(null, (x, y) => Math.abs(((y - fy) % 2.6 + 2.6) % 2.6 - 1.3) < 0.35 && (x - CX) * k > bw + 1, { g, bias: -0.3 });
    });
    if (lantern) {
      D.line(M.main, [CX, cy - bh + 1.5, CX + 1, cy - bh - 5, CX + 5, cy - bh - 8, CX + 8, cy - bh - 6], 1.3, 1, { z: -1 });
      D.ell(M.glow, CX + 8.5, cy - bh - 4, 2.8, 2.8, { z: -0.9, bias: 0.3 });
    }
    if (whisk && !back) D.sym((k) => D.line(M.main, [CX + k * 5, cy + bh * 0.28, CX + k * 11, cy + bh * 0.42, CX + k * 15, cy + bh * 0.75], 0.9, 0.7, { z: 2 }));
    A.head = { cx: CX, cy, rx: bw, ry: bh, top: cy - bh, g: gb, z: 0 };
    A.body = A.head;
    A.face = { y: cy - bh * 0.15, gap: bw * 0.3, ew: bh * 0.32, eh: bh * 0.42, my: cy + bh * 0.3, lips };
    A.forehead = { x: CX, y: cy - bh * 0.6 };
    A.backPt = { x: CX, y: cy - bh * 0.4 };
    if (bubbles && !back) {
      const g = D.g();
      D.ell(M.white, CX + P.tdir * (bw + 3), cy - bh - 2, 2.3, 2.3, { g, z: 3, flat: 0.6, line: true });
      D.ell(M.white, CX + P.tdir * (bw + 7), cy - bh - 7, 1.5, 1.5, { g, z: 3, flat: 0.6 });
    }
    return A;
  };

  BUILDERS.serpent = function (D, R, P) {
    const coilR = R.f(15, 18.5), coilH = R.f(5, 6.2);
    const neckR = R.f(4.3, 5.6);
    const hr = R.f(9.5, 12), hry = hr * R.f(0.74, 0.88);
    const hood = R.c(0.35);
    const tongue = R.c(0.5);
    const sway = R.f(-3, 3);
    const tailTip = R.pick(['plain', 'rattle', 'spike', 'plain']);
    const scales = R.c(0.6);
    const back = P.back;
    const A = { headFree: true, hasEars: false };
    const c1y = GY - coilH, c2y = GY - coilH * 2.4, c3y = GY - coilH * 3.6;
    const g1 = D.ell(M.main, CX, c1y, coilR, coilH, { z: 3 });
    const g2 = D.ell(M.main, CX - 0.5, c2y, coilR * 0.82, coilH * 0.95, { z: 2 });
    const g3 = D.ell(M.main, CX + 0.5, c3y, coilR * 0.62, coilH * 0.9, { z: 1 });
    const k = P.tdir;
    const tg = D.line(M.main, [CX + k * coilR * 0.8, c1y + 1, CX + k * (coilR + 4), c1y - 1, CX + k * (coilR + 6), c1y - 6], 3, 1.2, { z: back ? 4 : 3.5 });
    if (tailTip === 'rattle') { for (let i = 0; i < 3; i++) D.ell(M.acc, CX + k * (coilR + 6.2), c1y - 7 - i * 2.4, 2 - i * 0.3, 1.5, { z: 3.6 + i * 0.01 }); }
    else if (tailTip === 'spike') D.poly(M.acc, [CX + k * (coilR + 4.5), c1y - 5, CX + k * (coilR + 7.5), c1y - 5.5, CX + k * (coilR + 6.5), c1y - 12], { z: 3.7, bevel: 1.5 });
    A.tailTip = { x: CX + k * (coilR + 6), y: c1y - 8, z: 3.7 };
    const hy = GY - coilH * 3.6 - 16;
    const neck = [CX, c3y + 1, CX + sway * 0.6, c3y - 6, CX - sway * 0.4, hy + 6, CX, hy + 2];
    const gn = D.line(M.main, neck, neckR * 1.08, neckR * 0.9, { z: 1.5 });
    if (!back) {
      D.paint(M.sub, (x, y) => y > hy + 4 && Math.abs(x - CX - (y > c3y - 6 ? sway * 0.3 : -sway * 0.2)) < neckR * 0.55, { g: gn });
      D.paint(M.sub, (x, y) => (y - c1y) > coilH * 0.3 || (Math.abs(y - c2y - coilH * 0.5) < 1.2), { g: [g1] });
      if (scales) D.paint(null, (x, y) => y > hy + 5 && ((y - hy) % 3.2) < 0.6 && Math.abs(x - CX) < neckR * 0.5, { g: gn, bias: -0.35 });
    } else {
      D.paint(M.acc, (x, y) => ((Math.floor((y - hy) / 4)) % 2 === 0) && Math.abs(x - CX) < 1.6, { g: gn });
    }
    if (hood) {
      const gh = D.ell(M.main, CX, hy + 5, hr * 1.5, hry * 1.7, { z: 1.2 });
      if (!back) D.paintEll(M.sub, CX, hy + 7, hr * 1.0, hry * 1.25, { g: gh });
      if (!back) D.sym((kk) => D.paintEll(M.acc, CX + kk * hr * 0.95, hy + 4, 2.2, 2.6, { g: gh }));
    }
    const gh = D.ell(M.main, CX, hy, hr, hry, { z: 2.5 });
    A.head = { cx: CX, cy: hy, rx: hr, ry: hry, top: hy - hry, g: gh, z: 2.5 };
    A.body = { cx: CX, cy: c2y, rx: coilR * 0.8, ry: coilH * 2, g: [g1, g2, g3] };
    A.face = { y: hy - hry * 0.08, gap: hr * 0.26, ew: hr * 0.3, eh: hry * 0.46, my: hy + hry * 0.52, tongue };
    A.forehead = { x: CX, y: hy - hry * 0.55 };
    A.backPt = { x: CX, y: hy + 10 };
    return A;
  };

  BUILDERS.insect = function (D, R, P) {
    const hr = R.f(10, 12.5), hry = hr * R.f(0.84, 0.95);
    const thr = R.f(6.5, 8.5);
    const abr = R.f(9.5, 12.5), abry = R.f(9.5, 12);
    const wing = R.pick(['none', 'clear', 'clear', 'shell']);
    const horn = R.pick(['none', 'none', 'beetle', 'mandible']);
    const antenna = R.pick(['curl', 'straight', 'feather', 'ball', 'none']);
    const compound = R.c(0.35);
    const stripes = R.c(0.6);
    const back = P.back;
    const thY = GY - 16, abY = GY - abry * 0.95, hy = thY - thr * 0.5 - hry * 0.72;
    const A = { headFree: antenna === 'none' && horn !== 'beetle', hasEars: false };
    if (wing === 'clear') { drawWings(D, P, 'bug', CX, thY - 2, 20, M.wing); A.hasWings = true; }
    const ga = D.ell(M.main, CX, abY, abr, abry, { z: back ? 0.5 : -1 });
    if (stripes) D.paint(M.acc, (x, y) => ((y - abY + abry) % 5) > 3.1, { g: ga });
    const legs = [
      [5, 0.5, 10, 5, 9, GY - 0.8, back ? -2 : 1.5],
      [7, -1, 15, 0, 17, GY - 1.5, -1.5],
      [6.5, -2, 17, -6, 22, GY - 5, -2.5],
    ];
    for (const L of legs) D.sym((k) => D.line(M.main, [CX + k * L[0], thY + L[1], CX + k * L[2], thY + L[3], CX + k * L[4], L[5]], 1.7, 1.3, { z: L[6] }));
    const gt = D.ell(M.main, CX, thY, thr, thr * 0.85, { z: 0.8 });
    if (wing === 'shell' && back) {
      D.sym((k) => D.ell(M.acc, CX + k * abr * 0.46, abY - 3, abr * 0.55, abry * 1.02, { z: 1.5, rot: -k * 0.08 }));
      A.hasWings = true;
    } else if (wing === 'shell') {
      D.sym((k) => D.ell(M.acc, CX + k * (abr * 0.72), abY - 5, abr * 0.42, abry * 0.9, { z: -1.5, rot: k * 0.35 }));
    }
    const zH = back ? -0.5 : 2;
    const hyy = back ? hy + 2 : hy;
    if (antenna !== 'none') {
      D.sym((k) => {
        const bx = CX + k * hr * 0.3, by = hyy - hry * 0.75;
        const g = D.g();
        if (antenna === 'curl') D.line(M.main, [bx, by + 2, bx + k * 2, by - 6, bx + k * 6, by - 10, bx + k * 9, by - 9, bx + k * 8.5, by - 6.5], 1.2, 1, { g, z: zH - 0.5 });
        else if (antenna === 'straight') D.line(M.main, [bx, by + 2, bx + k * 4, by - 8, bx + k * 8, by - 13], 1.2, 0.9, { g, z: zH - 0.5 });
        else if (antenna === 'ball') { D.line(M.main, [bx, by + 2, bx + k * 3, by - 7, bx + k * 5, by - 10], 1.1, 0.9, { g, z: zH - 0.5 }); D.ell(M.acc, bx + k * 5.5, by - 11.5, 2.4, 2.4, { z: zH - 0.4 }); }
        else if (antenna === 'feather') { const f = D.g(); drawLeaf(D, bx, by + 1, 13, 3.4, k > 0 ? -1.05 : -2.09, M.acc, zH - 0.5, f); }
      });
    }
    if (horn === 'beetle') D.line(M.horn, [CX, hyy - hry * 0.4, CX, hyy - hry - 3, CX + 2, hyy - hry - 9, CX + 5, hyy - hry - 11], 3, 1, { z: zH + 0.3 });
    const gh = D.ell(M.main, CX, hyy, hr, hry, { z: zH });
    if (horn === 'mandible' && !back) D.sym((k) => D.line(M.horn, [CX + k * 3, hyy + hry * 0.72, CX + k * 5.5, hyy + hry + 2, CX + k * 3, hyy + hry + 4.5], 1.8, 0.8, { z: zH + 0.3 }));
    A.head = { cx: CX, cy: hyy, rx: hr, ry: hry, top: hyy - hry, g: gh, z: zH };
    A.body = { cx: CX, cy: abY, rx: abr, ry: abry, g: [ga, gt] };
    A.face = { y: hyy + hry * 0.02, gap: hr * (compound ? 0.14 : 0.22), ew: hr * (compound ? 0.46 : 0.3), eh: hry * (compound ? 0.6 : 0.42), my: hyy + hry * 0.55 };
    if (compound) A.face.style = 'compound';
    A.forehead = { x: CX, y: hyy - hry * 0.55 };
    A.backPt = { x: CX, y: thY - 3 };
    return A;
  };

  BUILDERS.plant = function (D, R, P) {
    const variant = R.pick(['bulb', 'flower', 'mushroom', 'cactus', 'bulb', 'flower']);
    const petals = R.i(5, 8);
    const petalR = R.f(5.5, 7.5);
    const leafN = R.i(1, 3);
    const spots = R.c(0.7);
    const rootFeet = R.c(0.7);
    const sz = R.f(0.92, 1.08);
    const back = P.back;
    const A = { headFree: false, hasEars: false };
    if (variant === 'bulb') {
      const bw = 15 * sz, bh = 13 * sz, cy = GY - bh - 1;
      if (rootFeet) D.sym((k) => D.line(M.wood, [CX + k * 5, GY - 4, CX + k * 7, GY - 1, CX + k * 9.5, GY - 0.8], 2, 1.3, { z: 1 }));
      D.sym((k) => drawLeaf(D, CX + k * (bw - 2), cy + 3, 11, 4.4, k > 0 ? -0.25 : Math.PI + 0.25, M.leaf, back ? -1 : 1));
      const gb = D.ell(M.main, CX, cy, bw, bh, {});
      if (!back) D.paintEll(M.sub, CX, cy + bh * 0.55, bw * 0.6, bh * 0.55, { g: gb });
      const ty = cy - bh + 2;
      D.line(M.leaf, [CX, ty + 2, CX, ty - 4], 1.4, 1.1, { z: -0.5 });
      drawLeaf(D, CX, ty - 3, 14 * sz, 5.5 * sz, -2.5, M.leaf, -0.4);
      drawLeaf(D, CX, ty - 3, 15 * sz, 6 * sz, -0.62, M.leaf, -0.4);
      if (leafN >= 2) drawLeaf(D, CX, ty - 3, 11 * sz, 4.5 * sz, -1.6, M.leaf, -0.45);
      A.head = { cx: CX, cy, rx: bw, ry: bh, top: cy - bh - 10, g: gb, z: 0 };
      A.body = A.head;
      A.face = { y: cy - bh * 0.05, gap: bw * 0.2, ew: bh * 0.3, eh: bh * 0.42, my: cy + bh * 0.3 };
      A.forehead = { x: CX, y: cy - bh * 0.55 };
    } else if (variant === 'flower') {
      const fy = GY - 32 * sz, disc = 9.5 * sz;
      D.line(M.leaf, [CX, GY - 2, CX, fy + disc - 1], 2.4, 2, { z: -1 });
      D.sym((k) => drawLeaf(D, CX + k * 1, GY - 11, 12 * sz, 4.5 * sz, k > 0 ? -0.5 : Math.PI + 0.5, M.leaf, back ? -1.5 : 0.5));
      if (rootFeet) D.sym((k) => D.line(M.wood, [CX, GY - 3, CX + k * 4, GY - 1, CX + k * 7, GY - 0.5], 2, 1.3, { z: 0 }));
      const gp = D.g();
      for (let i = 0; i < petals; i++) {
        const a = -Math.PI / 2 + i / petals * Math.PI * 2 + (petals % 2 ? 0 : Math.PI / petals);
        D.ell(M.acc, CX + Math.cos(a) * (disc + petalR * 0.55), fy + Math.sin(a) * (disc + petalR * 0.55), petalR, petalR * 0.62, { g: gp, rot: a, z: 0.5 });
      }
      const gd = D.ell(back ? M.leaf : M.sub, CX, fy, disc, disc * 0.94, { z: 1 });
      A.head = { cx: CX, cy: fy, rx: disc + petalR, ry: disc + petalR, top: fy - disc - petalR * 1.4, g: gd, z: 1 };
      A.body = { cx: CX, cy: fy, rx: disc, ry: disc, g: gd };
      A.face = { y: fy - disc * 0.1, gap: disc * 0.24, ew: disc * 0.34, eh: disc * 0.46, my: fy + disc * 0.45 };
      A.forehead = { x: CX, y: fy - disc * 0.6 };
    } else if (variant === 'mushroom') {
      const sw = 11 * sz, sh = 12 * sz, sy = GY - sh;
      if (rootFeet) D.sym((k) => D.ell(M.sub, CX + k * 5, GY - 1.5, 4, 2.5, { z: 0.5 }));
      const gs = D.ell(M.sub, CX, sy, sw, sh, {});
      const cyc = sy - sh * 0.75, cw = 21 * sz, ch = 12 * sz;
      const gc = D.ell(M.main, CX, cyc, cw, ch, { z: 1, yMax: cyc + ch * 0.45 });
      D.paintEll(null, CX, cyc + ch * 0.75, cw * 0.9, ch * 0.5, { g: gc, bias: -0.2 });
      if (spots) {
        D.paintEll(M.white, CX, cyc - ch * 0.55, 3.2, 2.4, { g: gc });
        D.sym((k) => { D.paintEll(M.white, CX + k * cw * 0.55, cyc - ch * 0.15, 2.8, 2.6, { g: gc }); D.paintEll(M.white, CX + k * cw * 0.3, cyc - ch * 0.62, 2, 1.6, { g: gc }); });
      }
      A.head = { cx: CX, cy: cyc, rx: cw * 0.7, ry: ch, top: cyc - ch, g: gc, z: 1 };
      A.body = { cx: CX, cy: sy, rx: sw, ry: sh, g: gs };
      A.face = { y: sy - sh * 0.05, gap: sw * 0.2, ew: sh * 0.3, eh: sh * 0.42, my: sy + sh * 0.4 };
      A.forehead = null;
    } else {
      const bw = 10.5 * sz, bh = 19 * sz, cy = GY - bh;
      D.sym((k) => {
        const g = D.g();
        D.line(M.main, [CX + k * (bw - 2), cy + 2, CX + k * (bw + 6), cy + 1, CX + k * (bw + 7), cy - 7], 3.6, 3, { g, z: back ? -1 : -0.5 });
      });
      const gb = D.ell(M.main, CX, cy, bw, bh, {});
      D.paint(null, (x, y) => Math.abs(((x - CX) % 4 + 4) % 4 - 2) < 0.5 && Math.abs(x - CX) > 1, { g: gb, bias: -0.12 });
      const sp = [];
      for (let i = 0; i < 6; i++) sp.push(CX + (i % 2 ? 1 : -1) * (bw - 1), cy - bh * 0.6 + i * 5, (i % 2 ? 0 : Math.PI) + (i % 2 ? -0.4 : 0.4));
      drawSpikeRow(D, sp, M.white, 0.2, 0.45);
      const g = D.g();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * Math.PI * 2; D.ell(M.acc, CX + Math.cos(a) * 3.2, cy - bh + 1 + Math.sin(a) * 3.2, 2.8, 1.9, { g, rot: a, z: 1 }); }
      D.ell(M.gold, CX, cy - bh + 1, 1.7, 1.7, { z: 1.1 });
      A.head = { cx: CX, cy: cy - bh * 0.3, rx: bw, ry: bh * 0.6, top: cy - bh - 3, g: gb, z: 0 };
      A.body = { cx: CX, cy, rx: bw, ry: bh, g: gb };
      A.face = { y: cy - bh * 0.28, gap: bw * 0.22, ew: bw * 0.36, eh: bw * 0.52, my: cy - bh * 0.02 };
      A.forehead = null;
    }
    A.backPt = { x: CX, y: A.body.cy - 4 };
    return A;
  };

  BUILDERS.ghost = function (D, R, P) {
    const bw = R.f(14, 17.5), bh = R.f(12.5, 15.5);
    const skirt = R.pick(['zigzag', 'wave', 'tail']);
    const arms = R.pick(['nub', 'none', 'wisp', 'nub']);
    const wisps = R.i(0, 2);
    const topper = R.pick(['none', 'tuft', 'point', 'none']);
    const tongue = R.c(0.4);
    const back = P.back;
    const cy = 26;
    const A = { headFree: topper === 'none', hasEars: false, floating: true };
    const gb = D.g();
    D.ell(M.main, CX, cy, bw, bh, { g: gb });
    const sy = cy + bh + 12;
    let pts;
    if (skirt === 'zigzag') pts = [CX - bw, cy, CX + bw, cy, CX + bw * 0.95, sy - 3, CX + bw * 0.62, sy - 8, CX + bw * 0.34, sy, CX, sy - 7, CX - bw * 0.34, sy, CX - bw * 0.62, sy - 8, CX - bw * 0.95, sy - 3];
    else if (skirt === 'wave') {
      pts = [CX - bw, cy, CX + bw, cy];
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(CX + bw * (1 - 2 * t) * (0.98 - 0.05 * Math.sin(t * Math.PI)), sy - 4 + Math.cos(t * Math.PI * 6) * 3.2); }
    } else pts = [CX - bw, cy, CX + bw, cy, CX + bw * 0.7, sy - 6, CX + P.tdir * 6, sy + 4, CX - bw * 0.6, sy - 7];
    D.poly(M.main, pts, { g: gb, bevel: 7 });
    D.paint(null, (x, y) => y > sy - 9, { g: gb, bias: -0.08 });
    if (arms === 'nub') D.sym((k) => D.ell(M.main, CX + k * (bw + 1), cy + bh * 0.55, 4.8, 3, { rot: -k * 0.5, z: back ? -1 : 1 }));
    else if (arms === 'wisp') D.sym((k) => D.line(M.main, [CX + k * (bw - 2), cy + bh * 0.3, CX + k * (bw + 5), cy + bh * 0.55, CX + k * (bw + 8), cy + bh * 0.3], 3, 1.2, { z: back ? -1 : 1 }));
    if (topper === 'tuft') drawTuft(D, P, 'curl', CX, cy - bh + 1.5, 1.1, 0.5);
    else if (topper === 'point') D.poly(M.main, [CX - 5, cy - bh + 3, CX + P.tdir * 4, cy - bh - 9, CX + 5, cy - bh + 3], { g: gb, bevel: 3 });
    for (let i = 0; i < wisps; i++) {
      const k = i === 0 ? -P.tdir : P.tdir;
      drawFlame(D, CX + k * (bw + 8), cy - bh * 0.2 + i * 10, 2.6, -3);
    }
    A.head = { cx: CX, cy, rx: bw, ry: bh, top: cy - bh, g: gb, z: 0 };
    A.body = A.head;
    A.face = { y: cy + bh * 0.05, gap: bw * 0.18, ew: bh * 0.34, eh: bh * 0.5, my: cy + bh * 0.62, tongue, grin: R.c(0.4) };
    A.forehead = { x: CX, y: cy - bh * 0.55 };
    A.backPt = { x: CX, y: cy };
    return A;
  };

  BUILDERS.dragon = function (D, R, P) {
    const hr = R.f(10.5, 12.5), hry = hr * R.f(0.8, 0.92);
    const br = R.f(10.5, 13), bry = R.f(10, 12.5);
    const legR = R.f(4, 5), legH = R.f(4, 6);
    const horn = R.pick(['curve', 'straight', 'curve', 'antler']);
    const wing = R.pick(['bat', 'bat', 'none', 'feather']);
    const span = R.f(14, 19);
    const spikes = R.c(0.7);
    const snoutL = R.f(4.5, 6.5);
    const back = P.back;
    const bodyCy = GY - legH - bry * 0.85;
    const headCy = bodyCy - bry * 0.7 - hry * 0.75;
    const A = { headFree: false, hasEars: false, hasHorns: true, hasWings: wing !== 'none' };
    if (wing !== 'none') drawWings(D, P, wing === 'bat' ? 'bat' : 'feather', CX, bodyCy - bry * 0.55, br + span, wing === 'bat' ? M.sub : M.main);
    A.tailTip = drawTail(D, P, 'thick', CX + P.tdir * br * 0.6, bodyCy + bry * 0.45, 20, 1.1);
    if (A.tailTip) D.poly(M.acc, [A.tailTip.x - 3, A.tailTip.y + 2, A.tailTip.x + P.tdir * 1, A.tailTip.y - 6, A.tailTip.x + 3.5, A.tailTip.y + 1.5], { z: A.tailTip.z, bevel: 1.5 });
    D.sym((k) => {
      const g = D.g();
      D.cap(M.main, CX + k * br * 0.5, bodyCy + bry * 0.3, legR, CX + k * br * 0.56, GY - 2.5, legR * 0.9, { g, z: -0.5 });
      D.ell(M.main, CX + k * br * 0.6, GY - 2.4, legR + 1.6, 2.6, { g, z: -0.5 });
      if (!back) for (let c = -1; c <= 1; c++) D.poly(M.white, [CX + k * br * 0.6 + c * 2.2 - 0.9, GY - 1.2, CX + k * br * 0.6 + c * 2.2 + 0.9, GY - 1.2, CX + k * br * 0.6 + c * 2.2, GY + 0.6], { z: 0, bevel: 0.8 });
    });
    const gb = D.ell(M.main, CX, bodyCy, br, bry, {});
    if (!back) {
      D.paintEll(M.sub, CX, bodyCy + bry * 0.12, br * 0.58, bry * 0.82, { g: gb });
      D.paint(null, (x, y) => ((y - bodyCy + 20) % 3.2) < 0.6 && Math.abs(x - CX) < br * 0.5, { g: gb, only: M.sub, bias: -0.35 });
    } else if (spikes) {
      for (let i = 0; i < 4; i++) D.poly(M.acc, [CX - 2.4, bodyCy - bry * 0.75 + i * 5.5, CX + 2.4, bodyCy - bry * 0.75 + i * 5.5, CX, bodyCy - bry * 0.75 + i * 5.5 - 4], { z: 1, bevel: 1.2 });
    }
    D.sym((k) => D.cap(M.main, CX + k * (br - 1.5), bodyCy - bry * 0.45, 3.3, CX + k * (br + 3.5), bodyCy + bry * 0.15, 2.8, { z: back ? -1 : 1 }));
    const zH = 2;
    const gh = D.ell(M.main, CX, headCy, hr, hry, { z: zH });
    const head = { cx: CX, cy: headCy, rx: hr, ry: hry, top: headCy - hry, g: gh, z: zH };
    drawHorns(D, P, horn, head, M.horn, 1);
    if (spikes && !back) drawSpikeRow(D, [CX - hr * 0.95, headCy - 1, Math.PI + 0.3, CX + hr * 0.95, headCy - 1, -0.3], M.acc, zH - 0.5, 0.8);
    A.face = { y: headCy - hry * 0.2, gap: hr * 0.24, ew: hr * 0.28, eh: hry * 0.36, my: headCy + hry * 0.62 };
    if (!back) {
      const sy = headCy + hry * 0.42;
      D.ell(M.main, CX, sy, snoutL + 1.5, snoutL * 0.72, { z: zH + 0.5 });
      A.face.nose = { y: sy - snoutL * 0.2, wide: true };
      A.face.my = sy + snoutL * 0.35;
      A.face.fang = true;
    }
    A.head = head;
    A.body = { cx: CX, cy: bodyCy, rx: br, ry: bry, g: gb };
    A.forehead = { x: CX, y: headCy - hry * 0.6 };
    A.backPt = { x: CX, y: bodyCy - bry * 0.5 };
    return A;
  };

  // =================================================================== モンスター: 装飾（タイプ・レア度）
  function applyTypeDecor(D, R, P, A) {
    const t = P.t0, back = P.back, head = A.head;
    const v = R.r();
    const headTopZ = head.z - 0.5;
    switch (t) {
      case 'fire':
        if (A.tailTip) drawFlame(D, A.tailTip.x, A.tailTip.y - 1, 4.5, A.tailTip.z);
        else if (A.headFree) { drawFlame(D, CX, head.top + 3, 4.8, headTopZ); A.headFree = false; }
        break;
      case 'water':
        if (A.headFree && P.shape !== 'fish') {
          D.poly(P.finMat, [CX - 4, head.top + 4, CX - 1, head.top - 7, CX + 5, head.top - 3, CX + 4, head.top + 4], { z: headTopZ, bevel: 2 });
          A.headFree = false;
        }
        break;
      case 'grass':
        if (A.headFree && P.shape !== 'plant') { drawTuft(D, P, 'sprout', CX, head.top + 1.5, 1, headTopZ); A.headFree = false; }
        else if (A.tailTip) drawLeaf(D, A.tailTip.x, A.tailTip.y + 1, 9, 4, -Math.PI / 2 + P.tdir * 0.5, M.leaf, A.tailTip.z);
        break;
      case 'electric':
        if (A.tailTip) drawBolt(D, A.tailTip.x - P.tdir * 2, A.tailTip.y + 3, 0.9, A.tailTip.z, M.gold, P.tdir);
        else if (A.headFree) { drawBolt(D, CX - 2, head.top + 3, 0.95, headTopZ, M.gold, 1); A.headFree = false; }
        break;
      case 'ice':
        if (A.headFree) { drawCrystal(D, CX, head.top + 3, 10, 4.2, -Math.PI / 2, headTopZ, M.white); drawCrystal(D, CX - 3, head.top + 4, 7, 3.4, -2.2, headTopZ, M.white); drawCrystal(D, CX + 3, head.top + 4, 7, 3.4, -0.94, headTopZ, M.white); A.headFree = false; }
        else D.sym((k) => drawCrystal(D, CX + k * A.body.rx * 0.6, A.backPt.y, 8, 3.4, -Math.PI / 2 + k * 0.5, back ? 4 : -4, M.white));
        break;
      case 'fighting': {
        const by = head.cy - head.ry * 0.5;
        D.paint(M.acc, (x, y) => Math.abs(y - by + (x - CX) * 0.03) < 1.7, { g: head.g });
        const kx = CX - P.tdir * head.rx * 0.9;
        D.poly(M.acc, [kx, by - 1.5, kx - P.tdir * 7, by + 1, kx - P.tdir * 6, by + 5, kx, by + 1.5], { z: back ? head.z + 0.3 : head.z - 0.3, bevel: 1.4 });
        break;
      }
      case 'poison':
        if (P.pattern === 'none') {
          const gs = [head.g].concat(A.body.g);
          D.sym((k) => { D.paintEll(M.acc, CX + k * A.body.rx * 0.45, A.body.cy - A.body.ry * 0.2, 2.2, 2, { g: gs, only: M.main }); D.paintEll(M.acc, CX + k * A.body.rx * 0.2, A.body.cy + A.body.ry * 0.4, 1.6, 1.5, { g: gs, only: M.main }); });
        }
        if (A.headFree) { drawSpikeRow(D, [CX, head.top + 2, -Math.PI / 2], M.acc, headTopZ, 1.1); A.headFree = false; }
        break;
      case 'ground':
        if (A.headFree && v < 0.6) { D.poly(M.horn, [CX - 3, head.top + 4, CX, head.top - 6, CX + 3, head.top + 4], { z: headTopZ, bevel: 1.8 }); A.headFree = false; }
        break;
      case 'flying':
        if (!A.hasWings) { drawWings(D, P, 'tiny', CX, A.backPt.y, A.body.rx + 8, M.white); A.hasWings = true; }
        break;
      case 'psychic':
        if (!back && A.forehead) { D.ell(M.gem, A.forehead.x, A.forehead.y, 2.2, 2.4, { z: head.z + 0.6 }); A.foreheadUsed = true; }
        break;
      case 'bug':
        if (A.headFree) { D.sym((k) => { D.line(M.main, [CX + k * 3, head.top + 2, CX + k * 5, head.top - 5, CX + k * 8, head.top - 8], 1.1, 0.9, { z: headTopZ }); D.ell(M.acc, CX + k * 8.5, head.top - 9, 2, 2, { z: headTopZ + 0.05 }); }); A.headFree = false; }
        break;
      case 'rock':
        D.sym((k) => D.poly(M.rock, [CX + k * head.rx * 0.45, head.top + 3, CX + k * head.rx * 0.6, head.top - 2, CX + k * head.rx * 0.95, head.top + 1, CX + k * head.rx * 0.98, head.top + 6], { z: head.z + 0.3, bevel: 2 }));
        break;
      case 'ghost':
        if (P.shape !== 'ghost') D.sym((k) => drawFlame(D, CX + k * (A.body.rx + 9), A.body.cy - 6 + (k > 0 ? 4 : 0), 2.4, -4));
        break;
      case 'dragon':
        if (!A.hasHorns) { drawHorns(D, P, 'straight', head, M.horn, 0.8); A.hasHorns = true; }
        break;
      case 'dark':
        if (!back && A.forehead && !A.foreheadUsed) {
          const fx = A.forehead.x, fy = A.forehead.y;
          D.paint(M.acc, (x, y) => { const d1 = Math.hypot(x - fx, y - fy), d2 = Math.hypot(x - fx - 1.3, y - fy + 0.8); return d1 < 2.6 && d2 > 2.2; }, { g: head.g });
          A.foreheadUsed = true;
        }
        break;
      case 'steel':
        if (!back && A.forehead && !A.foreheadUsed) {
          const g = D.poly(M.metal, [A.forehead.x - 4, A.forehead.y - 2, A.forehead.x + 4, A.forehead.y - 2, A.forehead.x + 3, A.forehead.y + 2.5, A.forehead.x - 3, A.forehead.y + 2.5], { z: head.z + 0.5, bevel: 1.2 });
          D.paint(M.dark, (x, y) => Math.hypot(x - A.forehead.x + 2, y - A.forehead.y) < 0.8 || Math.hypot(x - A.forehead.x - 2, y - A.forehead.y) < 0.8, { g });
          A.foreheadUsed = true;
        }
        break;
      case 'normal':
        if (A.headFree && v < 0.5) { drawTuft(D, P, 'fluff', CX, head.top + 1, 1, headTopZ); A.headFree = false; }
        break;
      default: break;
    }
  }

  function applyPattern(D, R, P, A) {
    const pat = P.pattern;
    const u1 = R.f(0.2, 0.55), u2 = R.f(-0.4, 0.1), u3 = R.f(0.3, 0.7);
    if (pat === 'none') return;
    const b = A.body, gs = [].concat(b.g, A.head.g);
    const opt = { g: gs, only: M.main };
    if (pat === 'spots') {
      D.sym((k) => {
        D.paintEll(M.acc, b.cx + k * b.rx * u1, b.cy + b.ry * u2, 2.4, 2.1, opt);
        D.paintEll(M.acc, b.cx + k * b.rx * u3, b.cy + b.ry * (u2 + 0.45), 1.8, 1.6, opt);
        D.paintEll(M.acc, A.head.cx + k * A.head.rx * 0.55, A.head.cy - A.head.ry * 0.5, 1.6, 1.5, opt);
      });
    } else if (pat === 'stripes') {
      D.paint(M.acc, (x, y) => { const v = (y - b.cy) / b.ry; return Math.abs(Math.abs(x - b.cx) / b.rx) > 0.35 && (Math.abs(v + 0.35) < 0.1 || Math.abs(v - 0.1) < 0.1 || Math.abs(v - 0.55) < 0.09); }, opt);
    } else if (pat === 'bands') {
      D.paint(M.acc, (x, y) => {
        const ax = Math.abs(x - b.cx) / b.rx, v = (y - b.cy) / b.ry;
        for (let i = -1; i <= 1; i++) { const c = i * 0.42; if (ax > 0.55 && Math.abs(v - c - (1 - ax) * 0.3) < 0.09 + (ax - 0.55) * 0.18) return true; }
        return false;
      }, { g: gs });
    } else if (pat === 'mark') {
      if (!P.back && A.forehead && !A.foreheadUsed) {
        const fx = A.forehead.x, fy = A.forehead.y;
        D.paint(M.acc, (x, y) => Math.abs(x - fx) / 2.6 + Math.abs(y - fy) / 3.2 <= 1, { g: A.head.g });
        A.foreheadUsed = true;
      } else if (P.back) {
        D.paint(M.acc, (x, y) => Math.abs(x - b.cx) / 3 + Math.abs(y - b.cy + b.ry * 0.2) / 4 <= 1, opt);
      }
    } else if (pat === 'chevron') {
      const cy = b.cy - b.ry * (P.back ? 0.3 : 0.05);
      D.paint(M.acc, (x, y) => { const d = y - cy - Math.abs(x - b.cx) * 0.55; return d > 0 && d < 1.8 && Math.abs(x - b.cx) < b.rx * 0.75; }, { g: [].concat(b.g) });
    }
  }

  function applyLux(D, R, P, A, kind) {
    const head = A.head, back = P.back;
    if (kind === 'crown') drawCrown(D, head, back);
    else if (kind === 'halo') D.ring(M.gold, CX, head.top - 4.5, clamp(head.rx * 0.75, 7, 12), 2.8, 1.5, { z: head.z + 1, bias: 0.15 });
    else if (kind === 'horns') drawHorns(D, P, R.pick(['curve', 'ram', 'antler']), head, M.gold, 1.05);
    else if (kind === 'wings') drawWings(D, P, R.pick(['angel', 'feather', 'bat']), CX, A.backPt.y, A.body.rx + (P.shape === 'fish' ? 10 : 14), R.c(0.5) ? M.white : M.acc);
    else if (kind === 'mane') drawMane(D, head, M.acc);
  }
  function luxOptions(P, A) {
    const opts = [];
    if (A.headFree) opts.push('crown', 'halo', 'crown');
    if (!A.hasHorns && P.shape !== 'plant') opts.push('horns');
    if (!A.hasWings) opts.push('wings', 'wings');
    if (['quadruped', 'biped', 'dragon'].indexOf(P.shape) >= 0) opts.push('mane');
    if (!opts.length) opts.push('halo');
    return opts;
  }

  // =================================================================== モンスター: 顔（陰影後に直接ドットで描く）
  function eyeMask(ew, eh) {
    const m = new Uint8Array(ew * eh);
    const cx = (ew - 1) / 2, cy = (eh - 1) / 2, rx = ew / 2, ry = eh / 2;
    for (let v = 0; v < eh; v++) {
      for (let u = 0; u < ew; u++) {
        const dx = (u - cx) / rx, dy = (v - cy) / ry;
        m[v * ew + u] = (ew <= 2 || eh <= 2 || dx * dx + dy * dy <= 1.08) ? 1 : 0;
      }
    }
    return m;
  }
  function drawFace(B, D, P, A, ramps) {
    const f = A.face;
    if (!f || P.back) return;
    const s = D.s;
    const W = B.w;
    const style = f.style || P.eye;
    let ew = Math.max(2, Math.round(f.ew * s)), eh = Math.max(2, Math.round(f.eh * s));
    const gap = Math.max(1, Math.round(f.gap * s));
    if (style === 'dot') { ew = Math.max(2, Math.round(ew * 0.55)); eh = Math.max(2, Math.round(eh * 0.6)); }
    if (style === 'sharp') { eh = Math.max(3, Math.round(eh * 0.85)); ew = Math.max(3, ew); }
    const cyE = D.Y(f.y);
    const top = Math.round(cyE - eh / 2);
    const outl = ramps[M.main][0];
    const irisR = ramps[M.iris];
    const white = [252, 252, 248];
    const put = (x, y, rgb) => { if (x >= 0 && x < W && y >= 0 && y < B.h) setPx(B, y * W + x, rgb); };
    const accR = ramps[M.acc];
    const glowR = ramps[M.glow];

    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 32 - gap - ew : 32 + gap;
      const mask = eyeMask(ew, eh);
      if (style === 'sharp') {
        for (let v = 0; v < eh; v++) {
          for (let u = 0; u < ew; u++) {
            const inner = side < 0 ? u / (ew - 1) : 1 - u / (ew - 1);
            if (v < inner * eh * 0.5 - 0.2) mask[v * ew + u] = 0;
          }
        }
      }
      const inM = (u, v) => u >= 0 && v >= 0 && u < ew && v < eh && mask[v * ew + u];
      const edge = (u, v) => inM(u, v) && (!inM(u - 1, v) || !inM(u + 1, v) || !inM(u, v - 1) || !inM(u, v + 1));
      if (style === 'happy') {
        const cu = (ew - 1) / 2;
        for (let u = 0; u < ew; u++) {
          const t = Math.abs(u - cu) / Math.max(1, ew / 2);
          const vy = Math.round(t * t * (Math.max(2, eh * 0.5) - 1));
          put(x0 + u, top + Math.round(eh * 0.3) + vy, outl);
          if (ew >= 5) put(x0 + u, top + Math.round(eh * 0.3) + vy + 1, outl);
        }
        continue;
      }
      for (let v = 0; v < eh; v++) {
        for (let u = 0; u < ew; u++) {
          if (!inM(u, v)) continue;
          const x = x0 + u, y = top + v;
          if (style === 'round' || style === 'dot') {
            let c = irisR[1];
            if (!edge(u, v) && v >= eh * 0.58) c = irisR[3];
            if (edge(u, v)) c = irisR[0];
            put(x, y, c);
          } else if (style === 'sclera' || style === 'sharp') {
            put(x, y, edge(u, v) ? outl : (inM(u, v - 1) && !edge(u, v - 1) ? white : [226, 226, 236]));
          } else if (style === 'glow') {
            put(x, y, edge(u, v) ? outl : (v < eh * 0.5 ? glowR[5] : glowR[4]));
          } else if (style === 'compound') {
            if (edge(u, v)) put(x, y, accR[0]);
            else {
              const dx = (u - (ew - 1) / 2) / (ew / 2), dy = (v - (eh - 1) / 2) / (eh / 2);
              const I = -dx * 0.6 - dy * 0.8;
              put(x, y, I > 0.45 ? accR[4] : I > -0.3 ? accR[3] : accR[2]);
            }
          }
        }
      }
      if (style === 'sharp') {
        for (let u = 0; u < ew; u++) {
          for (let v = 0; v < eh; v++) {
            if (inM(u, v)) { if (inM(u, v + 1) && v + 1 < eh - 1) put(x0 + u, top + v + 1, outl); break; }
          }
        }
      }
      if (style === 'sclera' || style === 'sharp') {
        const pw = Math.max(1, Math.round(ew * 0.42)), ph = Math.max(2, Math.round(eh * (style === 'sharp' ? 0.62 : 0.58)));
        let pu = Math.round((ew - pw) / 2 + (ew >= 4 ? -side * 0.5 : 0));
        pu = clamp(pu, 1, Math.max(1, ew - pw - 1));
        const pv = clamp(Math.round(eh - ph - Math.max(1, eh * 0.12)), 1, eh - 1);
        for (let v = pv; v < pv + ph; v++) for (let u = pu; u < pu + pw; u++) if (inM(u, v) && !edge(u, v)) put(x0 + u, top + v, v === pv + ph - 1 && ph >= 4 ? irisR[2] : irisR[1]);
        if (pw >= 2 && ph >= 3) put(x0 + pu, top + pv, white);
      } else if (style === 'round') {
        const hs = ew >= 5 && eh >= 6 ? 2 : 1;
        for (let v = 1; v < 1 + hs; v++) for (let u = 1; u < 1 + hs; u++) if (inM(u, v)) put(x0 + u, top + v, white);
        if (ew >= 4 && eh >= 6) put(x0 + ew - 2, top + eh - 3, white);
      } else if (style === 'dot') {
        if (eh >= 3) put(x0 + (ew >= 3 ? 1 : 0), top + (eh >= 4 ? 1 : 0), white);
      } else if (style === 'glow') {
        if (ew >= 3 && eh >= 4) for (let v = 1; v < eh - 1; v++) put(x0 + Math.floor(ew / 2) - (side > 0 ? 0 : 0), top + v, v > 0 && v < eh - 1 ? irisR[0] : outl);
      } else if (style === 'compound') {
        put(x0 + 1, top + 1, white); if (ew >= 4) put(x0 + 2, top + 1, white);
        if (ew >= 5 && eh >= 5) put(x0 + ew - 2, top + eh - 3, white);
      }
    }
    // 頬
    if (P.blush && style !== 'compound') {
      const pk = [248, 150, 176];
      const by = top + eh + (eh >= 6 ? 0 : 0);
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? 32 - gap - ew - 1 : 32 + gap + ew - 1;
        for (let u = 0; u < 3; u++) {
          for (let v = 0; v < (eh >= 6 ? 2 : 1); v++) {
            const x = x0 + u, y = by + v;
            if (x < 0 || x >= W || y >= B.h) continue;
            const i = y * W + x;
            if (B.g[i]) blendPx(B, i, pk, (u === 1 ? 0.6 : 0.42));
          }
        }
      }
    }
    // 鼻
    if (f.nose) {
      const ny = Math.round(D.Y(f.nose.y));
      const nw = f.nose.wide ? 2 : 1;
      for (let dx = -nw; dx < nw; dx++) put(32 + dx, ny, outl);
      if (f.nose.wide) { put(29, ny + 1, outl); put(34, ny + 1, outl); put(30, ny, outl); put(33, ny, outl); }
      else { put(31, ny - 1, outl); put(32, ny - 1, outl); put(31, ny - 1, mixRgb(outl, [255, 255, 255], 0.45)); }
    }
    // 口
    if (!f.noMouth) {
      const my = Math.round(D.Y(f.my));
      const mouth = f.grin ? 'grin' : (f.tongue ? 'tongue' : (f.fang ? 'fang' : P.mouth));
      const mc = outl;
      const pink = [240, 104, 128];
      if (f.lips) {
        for (let dx = -3; dx < 3; dx++) { put(32 + dx, my, ramps[M.pink][3]); put(32 + dx, my + 1, ramps[M.pink][2]); }
        put(31, my, mc); put(32, my, mc); put(30, my, mc); put(33, my, mc);
      } else if (mouth === 'smile') {
        put(30, my, mc); put(33, my, mc); put(31, my + 1, mc); put(32, my + 1, mc);
      } else if (mouth === 'cat') {
        put(29, my, mc); put(31, my, mc); put(32, my, mc); put(34, my, mc); put(30, my + 1, mc); put(33, my + 1, mc);
      } else if (mouth === 'open' || mouth === 'tongue') {
        for (let dx = -2; dx < 2; dx++) put(32 + dx, my, mc);
        put(30, my + 1, mc); put(33, my + 1, mc); put(31, my + 1, pink); put(32, my + 1, mouth === 'tongue' ? [248, 128, 152] : pink);
        put(31, my + 2, mc); put(32, my + 2, mc);
        if (mouth === 'tongue') { put(31, my + 2, [248, 120, 150]); put(32, my + 2, [248, 120, 150]); put(31, my + 3, mc); put(32, my + 3, mc); }
      } else if (mouth === 'fang') {
        put(29, my, mc); put(34, my, mc); put(30, my + 1, mc); put(31, my + 1, mc); put(32, my + 1, mc); put(33, my + 1, mc);
        put(30, my + 2, white); put(33, my + 2, white);
      } else if (mouth === 'grin') {
        for (let dx = -4; dx < 4; dx++) put(32 + dx, my, mc);
        for (let dx = -3; dx < 3; dx++) put(32 + dx, my + 1, dx % 2 ? white : [230, 230, 240]);
        put(28, my - 1, mc); put(35, my - 1, mc); put(29, my + 1, mc); put(34, my + 1, mc);
        for (let dx = -2; dx < 2; dx++) put(32 + dx, my + 2, mc);
      } else if (mouth === 'line') {
        put(31, my, mc); put(32, my, mc);
      }
    }
  }

  // =================================================================== モンスター: 生成本体
  function pickShape(R, types) {
    const tbl = SHAPE_BY_TYPE[types[0]] || SHAPE_BY_TYPE.normal;
    return R.wpick(tbl);
  }
  function makePalette(R, types, colors) {
    const tp = TYPE_PAL[types[0]] || TYPE_PAL.normal;
    const tp2 = types[1] ? (TYPE_PAL[types[1]] || null) : null;
    let main = R.pick(tp.main), sub = R.pick(tp.sub), acc = R.pick(tp.acc);
    const mix2 = R.r(), mix3 = R.r();
    if (tp2 && mix2 < 0.65) { if (mix3 < 0.5) acc = tp2.main[0]; else sub = tp2.main[Math.min(1, tp2.main.length - 1)]; }
    main = jitterHex(main, R.f(-9, 9), R.f(-0.04, 0.04));
    if (Array.isArray(colors)) {
      if (colors[0]) main = colors[0];
      if (colors[1]) sub = colors[1];
      if (colors[2]) acc = colors[2];
    }
    return { main, sub, acc };
  }
  function pickEye(R, rank, types, shape) {
    const t = types[0];
    let pool = rank <= 1 ? ['round', 'round', 'sclera', 'dot', 'happy', 'round'] : rank === 2 ? ['round', 'sclera', 'sharp', 'round'] : ['sharp', 'sclera', 'sharp', 'round'];
    if (t === 'dark' || t === 'dragon') pool = pool.concat(['sharp', 'sharp']);
    if (t === 'ghost') pool = pool.concat(['glow', 'glow']);
    const e = R.pick(pool);
    return (shape === 'ghost' && e === 'happy') ? 'glow' : e;
  }

  function buildMonster(D, def, view) {
    const seed = monsterSeed(def);
    const R = makeRng(seed);
    const rank = rarityRankOf(def.rarity);
    const types = (Array.isArray(def.types) && def.types.length ? def.types : ['normal']).map(String);
    const sp = def.sprite || {};
    const shape = SHAPES.indexOf(sp.shape) >= 0 ? sp.shape : pickShape(R, types);
    const pal = makePalette(R, types, sp.colors);
    const eye = pickEye(R, rank, types, shape);
    const P = {
      back: view === 'back', rank, types, t0: types[0], shape,
      tdir: R.c(0.5) ? 1 : -1,
      eye,
      mouth: R.pick(rank <= 1 ? ['smile', 'cat', 'open', 'smile', 'line'] : ['smile', 'fang', 'line', 'open', 'cat']),
      blush: (eye === 'round' || eye === 'happy' || eye === 'dot') ? R.c(rank <= 1 ? 0.7 : 0.3) : R.c(0.1),
      innerEar: R.c(0.5) ? M.pink : M.sub,
      finMat: R.c(0.5) ? M.sub : M.acc,
      pattern: 'none',
    };
    const patRoll = R.pick(['spots', 'stripes', 'mark', 'bands', 'chevron']);
    if (rank >= 2) P.pattern = patRoll;
    const colors = buildMaterials(pal, types, eye, R);
    const A = BUILDERS[shape](D, R, P);
    A.body = A.body || A.head;
    A.backPt = A.backPt || { x: CX, y: A.body.cy };
    // レア度の豪華パーツ（頭の枠を先に確保）
    const luxRoll = R.r(), lux2Roll = R.r();
    let lux = 'none', lux2 = 'none';
    if (rank >= 3) {
      const o = luxOptions(P, A);
      lux = o[Math.floor(luxRoll * o.length) % o.length];
      if (lux === 'crown' || lux === 'halo') A.headFree = false;
      if (lux === 'horns') A.hasHorns = true;
      if (lux === 'wings') A.hasWings = true;
      if (rank >= 4) {
        const o2 = luxOptions(P, A).filter((x) => x !== lux);
        if (o2.length) lux2 = o2[Math.floor(lux2Roll * o2.length) % o2.length];
        if (lux2 === 'crown' || lux2 === 'halo') A.headFree = false;
      }
    }
    applyTypeDecor(D, R, P, A);
    applyPattern(D, R, P, A);
    if (lux !== 'none') applyLux(D, R, P, A, lux);
    if (lux2 !== 'none') applyLux(D, R, P, A, lux2);
    if (rank >= 4 && !P.back && A.forehead && !A.foreheadUsed) {
      D.poly(M.gem, [A.forehead.x, A.forehead.y - 3, A.forehead.x + 2.4, A.forehead.y, A.forehead.x, A.forehead.y + 3, A.forehead.x - 2.4, A.forehead.y], { z: A.head.z + 0.6, bevel: 1.6 });
    }
    return { P, A, colors, rank, seed, shape, floating: !!A.floating };
  }
  function buildMaterials(pal, types, eye, R) {
    const t = types[0];
    const irisPick = R.r();
    const c = [];
    c[M.main] = pal.main; c[M.sub] = pal.sub; c[M.acc] = pal.acc;
    c[M.white] = '#f4f6f8';
    c[M.dark] = '#383040';
    c[M.gold] = '#f8c838';
    c[M.horn] = mixHex('#f4ecd0', pal.sub, 0.25);
    c[M.pink] = '#f898b0';
    c[M.iris] = (t === 'dark' || t === 'dragon') && irisPick < 0.6 ? '#b82838' : (irisPick < 0.3 ? mixHex(pal.acc, '#303048', 0.35) : '#3c3458');
    c[M.gem] = TYPE_GEM[t] || '#ff5070';
    c[M.leaf] = (t === 'grass' && rgb2hsl(parseColor(pal.main))[0] > 70 && rgb2hsl(parseColor(pal.main))[0] < 160) ? jitterHex(pal.main, 8, -0.08) : '#58b848';
    c[M.wood] = '#a07048';
    c[M.wing] = mixHex(pal.sub, '#e8f8ff', 0.5);
    c[M.flame] = '#f86828';
    c[M.flame2] = '#ffe060';
    c[M.metal] = '#c0c8d8';
    c[M.beak] = '#f8b030';
    c[M.glow] = t === 'ghost' ? '#f8f0a0' : mixHex(pal.acc, '#fffbe0', 0.4);
    c[M.rock] = '#a09080';
    return c;
  }

  function measure(B) {
    let x0 = B.w, y0 = B.h, x1 = -1, y1 = -1;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.g[y * B.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  function genMonsterCanvas(def, view) {
    const rank = rarityRankOf(def.rarity);
    const aura = rank >= 4;
    const auraW = aura ? 2 : 0;
    const lo = 1 + auraW, hi = 62 - auraW;
    // 1回目: 大きなバッファで原寸描画してサイズを測る
    const B1 = makeBuf(128, 128);
    const D1 = createDrawer(B1, { s: 1, ax: 32, ay: 32, ox: 64, oy: 64 });
    const info1 = buildMonster(D1, def, view);
    const bb = measure(B1) || { x0: 44, y0: 44, x1: 84, y1: 84 };
    const dx0 = bb.x0 - 64 + 32, dx1 = bb.x1 + 1 - 64 + 32, dy0 = bb.y0 - 64 + 32, dy1 = bb.y1 + 1 - 64 + 32;
    const halfW = Math.max(32 - dx0, dx1 - 32), hgt = dy1 - dy0;
    const R2 = makeRng(info1.seed ^ 0x9e3779b9);
    const target = 41 + rank * 4.2 + R2.f(-1.5, 1.5);
    const availHalf = 32 - lo, availH = hi - lo + 1;
    let s = Math.min(target / Math.max(hgt, halfW * 1.7), availHalf / halfW, availH / hgt);
    if (view === 'back') s *= 1.0;
    let ay, oy;
    if (info1.floating) { ay = (dy0 + dy1) / 2; oy = 31.5; }
    else { ay = dy1; oy = hi + 1; }
    // 2回目: 本番
    const B = makeBuf(64, 64);
    const D = createDrawer(B, { s, ax: 32, ay, ox: 32, oy, clip: [lo, lo, hi, hi] });
    const info = buildMonster(D, def, view);
    const ramps = info.colors.map(makeRamp);
    shadePass(B, ramps, GLOSS);
    innerLinePass(B, ramps);
    drawFace(B, D, info.P, info.A, ramps);
    outlinePass(B, ramps);
    if (aura) drawAura(B, R2);
    if (rank === 3) drawSparkles(B, R2, 2);
    if (aura) drawSparkles(B, R2, 5);
    return bufToCanvas(B);
  }

  function drawAura(B, R) {
    const W = B.w, H = B.h;
    const ring = (src, dist) => {
      const out = new Uint8Array(B.n);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (src[i]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && src[yy * W + xx]) { out[i] = dist; }
        }
      }
      return out;
    };
    const r1 = ring(B.sil, 1);
    const both = new Uint8Array(B.n);
    for (let i = 0; i < B.n; i++) both[i] = B.sil[i] || r1[i];
    const r2 = ring(both, 2);
    const off = R.f(0, 360);
    for (let i = 0; i < B.n; i++) {
      if (!r1[i] && !r2[i]) continue;
      const x = i % W, y = (i / W) | 0;
      const a = Math.atan2(y - 32, x - 32) * 180 / Math.PI;
      const rgb = hsl2rgb([a + off, 0.95, r1[i] ? 0.72 : 0.8]);
      setPx(B, i, rgb, r1[i] ? 170 : 80);
    }
  }
  function drawSparkles(B, R, count) {
    const W = B.w;
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < count; tries++) {
      const x = R.i(3, 60), y = R.i(3, 58);
      let near = false, hit = false;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2; dx++) if (B.sil[(y + dy) * W + x + dx]) { hit = true; break; }
      if (hit) continue;
      for (let dy = -7; dy <= 7 && !near; dy++) for (let dx = -7; dx <= 7; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < B.h && B.sil[yy * W + xx]) { near = true; break; }
      }
      if (!near) continue;
      const big = R.c(0.45);
      const core = [255, 255, 255], arm = [255, 240, 150];
      setPx(B, y * W + x, core);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setPx(B, (y + dy) * W + x + dx, arm, 230);
      if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) setPx(B, (y + dy) * W + x + dx, arm, 140);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < B.h) B.sil[yy * W + xx] = 1; }
      placed++;
    }
  }

  // =================================================================== モンスター: 公開 API
  const spriteCache = new Map();
  let monIndex = null, monIndexSrc = null, monIndexLen = -1;
  function findMonster(id) {
    const list = GD().monsters;
    if (!Array.isArray(list)) return null;
    if (monIndexSrc !== list || monIndexLen !== list.length || !monIndex) {
      monIndex = new Map();
      for (const m of list) if (m && m.id) monIndex.set(m.id, m);
      monIndexSrc = list; monIndexLen = list.length;
    }
    return monIndex.get(id) || null;
  }
  function resolveMonster(x) {
    if (!x) return null;
    if (typeof x === 'string') return findMonster(x);
    if (typeof x === 'object') {
      if (x.speciesId && !x.baseStats && !x.types) return findMonster(x.speciesId);
      return x;
    }
    return null;
  }
  function spriteKey(def, view) {
    return [def.id || def.name || '?', view, def.rarity || '', (def.types || []).join(','), JSON.stringify(def.sprite || {})].join('|');
  }
  function autoMonster(def, view) {
    const key = spriteKey(def, view);
    let src = spriteCache.get(key);
    if (!src) {
      let cv;
      try {
        cv = genMonsterCanvas(def, view);
      } catch (e) {
        console.warn('[sprites] 自動生成に失敗しました: ' + (def.id || '?'), e);
        cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      }
      src = cv.toDataURL('image/png');
      spriteCache.set(key, src);
    }
    return src;
  }
  function monsterSprite(speciesOrId, view) {
    view = view === 'back' ? 'back' : 'front';
    let def = resolveMonster(speciesOrId);
    if (!def) def = { id: String(typeof speciesOrId === 'string' ? speciesOrId : 'unknown'), rarity: 'N', types: ['normal'] };
    const img = typeof def.image === 'string' ? def.image.trim() : '';
    const bimg = typeof def.backImage === 'string' ? def.backImage.trim() : '';
    if (view === 'front') {
      if (img && !imageFailed(img)) { loadImage(img); return { src: img, flip: false }; }
    } else {
      if (bimg && !imageFailed(bimg)) { loadImage(bimg); return { src: bimg, flip: false }; }
      if (img && !imageFailed(img)) { loadImage(img); return { src: img, flip: true }; }
    }
    return { src: autoMonster(def, view), flip: false };
  }
  // 自動生成のキャンバス（編集画面のプレビュー等に。画像指定は無視）
  function monsterCanvas(speciesOrId, view) {
    const def = resolveMonster(speciesOrId) || { id: String(speciesOrId), rarity: 'N', types: ['normal'] };
    return genMonsterCanvas(def, view === 'back' ? 'back' : 'front');
  }

  // =================================================================== キャラクター（16x24 フィールド用）
  const DIRS = ['down', 'left', 'right', 'up'];
  const HEADS = {
    down: {
      short: [
        '................', '................',
        '....hhhhhhhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhssshhssshH..', '..hssessssessh..', '..hssessssessh..', '..hssssssssssh..',
        '...SssssssssS...', '....SssssssS....'],
      long: [
        '................', '................',
        '....hhhhhhhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '.hhhhhhhhhhhhhH.',
        '.hhhssshhssshhH.', '.hhssessssesshH.', '.hhssessssesshH.', '.hhsssssssssshH.',
        '.hhSssssssssShH.', '.hhhSssssssShhH.', '.hhh........hhH.', '.Hhh........hhH.', '.HH..........HH.'],
      spiky: [
        '...h...hh...h...', '...hh.hhhh.hh...',
        '..hhhhhhhhhhhh..', '.hhhLLhhhhhhhhH.', '..hLhhhhhhhhhH..', '.hhhhhhhhhhhhhH.',
        '..hhshsssshshH..', '..hssessssessh..', '..hssessssessh..', '..hssssssssssh..',
        '...SssssssssS...', '....SssssssS....'],
      bald: [
        '................', '................',
        '....ssssssss....', '...sllssssssS...', '..sllssssssssS..', '..slsssssssssS..',
        '..hssssssssssh..', '..hssessssessh..', '..hssessssessh..', '..sssssssssssS..',
        '...SssssssssS...', '....SssssssS....'],
      bun: [
        '......hhhh......', '.....hLhhhH.....',
        '....hhhhhhhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhssshhssshH..', '..hssessssessh..', '..hssessssessh..', '..hssssssssssh..',
        '...SssssssssS...', '....SssssssS....'],
    },
    up: {
      short: [
        '................', '................',
        '....hhhhhhhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhHH..', '..HhhhhhhhhhHH..',
        '...HHhhhhhhHH...', '....SssssssS....'],
      long: [
        '................', '................',
        '....hhhhhhhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '.hhhhhhhhhhhhhH.',
        '.hhhhhhhhhhhhhH.', '.hhhhhhhhhhhhhH.', '.hhhhhhhhhhhhhH.', '.hhhhhhhhhhhhHH.',
        '.hhhhhhhhhhhhHH.', '.hhhhhhhhhhhhHH.', '.hhhhhhhhhhhhHH.', '..hhhhhhhhhhHH..', '...HhhhhhhhHH...', '....HHHHHHHH....'],
      spiky: [
        '...h...hh...h...', '...hh.hhhh.hh...',
        '..hhhhhhhhhhhh..', '.hhhLLhhhhhhhhH.', '..hLhhhhhhhhhH..', '.hhhhhhhhhhhhhH.',
        '..hhhhhhhhhhhH..', '.hhhhhhhhhhhhhH.', '..hhhhhhhhhhHH..', '..HhhhhhhhhhHH..',
        '...HhHhhhHhHH...', '....SssssssS....'],
      bald: [
        '................', '................',
        '....ssssssss....', '...sllssssssS...', '..sllssssssssS..', '..slsssssssssS..',
        '..hsssssssssSh..', '..hsssssssssSh..', '..hhssssssssHh..', '..hhhhhhhhhhHH..',
        '...HhhhhhhhHH...', '....SssssssS....'],
      bun: [
        '......hhhh......', '.....hLhhhH.....',
        '....hhhaahhh....', '...hhLLhhhhhh...', '..hLLhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhhhhhhhhhhH..', '..hhhhhhhhhhhH..', '..hhhhhhhhhhHH..', '..HhhhhhhhhhHH..',
        '...HHhhhhhhHH...', '....SssssssS....'],
    },
    side: {
      short: [
        '................', '................',
        '....hhhhhhhh....', '...hLLhhhhhhh...', '..hLhhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhsssshhhhhH..', '..ssessshhhhhH..', '.sssesssShhhhH..', '..sssssSShhhhH..',
        '...ssssSShhHH...', '....SsssSHHH....'],
      long: [
        '................', '................',
        '....hhhhhhhh....', '...hLLhhhhhhh...', '..hLhhhhhhhhhH..', '..hhhhhhhhhhhhH.',
        '..hhsssshhhhhhH.', '..ssessshhhhhhH.', '.sssesssShhhhhH.', '..sssssSShhhhhH.',
        '...ssssShhhhhhH.', '....SssShhhhhhH.', '........hhhhhhH.', '........HhhhhHH.', '.........HHHH...'],
      spiky: [
        '......h...h.....', '.....hh..hhh.h..',
        '....hhhhhhhhhh..', '...hLLhhhhhhhhh.', '..hLhhhhhhhhhhH.', '..hhhhhhhhhhhhH.',
        '..hhsssshhhhhhH.', '..ssessshhhhhH..', '.sssesssShhhhhH.', '..sssssSShhhhH..',
        '...ssssSShhHH...', '....SsssSHHH....'],
      bald: [
        '................', '................',
        '....ssssssss....', '...sllssssssS...', '..slsssssssssS..', '..sssssssssssS..',
        '..ssssssshhhhH..', '..ssesssshhhhH..', '.sssesssSShhhH..', '..sssssSShhhHH..',
        '...ssssSShHHH...', '....SsssSSSS....'],
      bun: [
        '..........hhh...', '.........hLhhH..',
        '....hhhhhhhhhh..', '...hLLhhhhhhh...', '..hLhhhhhhhhhH..', '..hhhhhhhhhhhH..',
        '..hhsssshhhhhH..', '..ssessshhhhhH..', '.sssesssShhhhH..', '..sssssSShhhhH..',
        '...ssssSShhHH...', '....SsssSHHH....'],
    },
  };
  const HATS = {
    down: ['................', '.....tttttt.....', '....tuuttttT....', '...tuttaatttT...', '...ttttaattTT...', '..bbbbbbbbbbbb..'],
    up: ['................', '.....tttttt.....', '....tuuttttT....', '...tuttttttTT...', '...ttttttttTT...', '...TTaaaaaaTT...'],
    side: ['................', '.....tttttt.....', '....tuutttttT...', '...tutttttttTT..', '...ttttttttTTT..', '.bbbbbbtttttTT..'],
  };
  const BODIES = {
    down: ['...CccaaaaccC...', '...CcccccccCC...', '...CcccccccCC...', '....cccccccC....', '....CccccccC....', '....pppppppP....', '....pppPPppP....'],
    up: ['...CccccccccC...', '...CcccccccCC...', '...CcccccccCC...', '....cccccccC....', '....CccccccC....', '....pppppppP....', '....pppPPppP....'],
    side: ['.....cccccC.....', '.....ccccCC.....', '.....ccccCC.....', '.....ccccCC.....', '.....CcccCC.....', '.....pppppP.....', '.....pppppP.....'],
  };
  const SIDE_LEGS = {
    stand: ['......ppP.......', '......ppP.......', '.....Kkkk.......', '.....kkkk.......'],
    walk1: ['.....pP.PP......', '....pP...PP.....', '...Kkk...kkk....', '...kkk...kkk....'],
    walk2: ['.....PP.pP......', '....PP...pP.....', '...Kkk...Kkk....', '...kkk...kkk....'],
  };

  function lookKey(look) {
    return [look.skin, look.hair, look.hairStyle, look.shirt, look.pants, look.hat, look.accent].join('|');
  }
  function charColors(look) {
    const skin = look.skin || '#f8d0a8', hair = look.hair || '#503020', shirt = look.shirt || '#3070d0';
    const pants = look.pants || '#304060', hat = look.hat || hair, acc = look.accent || '#ffffff';
    const sk = makeRamp(skin), hr = makeRamp(hair), sh = makeRamp(shirt), pa = makeRamp(pants), ht = makeRamp(hat), ac = makeRamp(acc);
    const shoe = makeRamp(mixHex(pants, '#281c20', 0.55));
    const col = {
      s: sk[3], S: sk[2], l: sk[4], h: hr[3], H: hr[2], L: hr[4], e: [36, 30, 44],
      c: sh[3], C: sh[2], a: ac[3], p: pa[3], P: pa[2], k: shoe[3], K: shoe[4],
      t: ht[3], T: ht[2], u: ht[4], b: ht[1], w: [248, 248, 248],
    };
    const dk = (r) => mixRgb(r[0], [16, 12, 20], 0.35);
    const out = {
      s: dk(sk), S: dk(sk), l: dk(sk), h: dk(hr), H: dk(hr), L: dk(hr), e: dk(sk),
      c: dk(sh), C: dk(sh), a: dk(ac), p: dk(pa), P: dk(pa), k: dk(shoe), K: dk(shoe),
      t: dk(ht), T: dk(ht), u: dk(ht), b: dk(ht), w: dk(ac),
    };
    return { col, out };
  }
  function buildCharGrid(look, dir, frame) {
    const view = dir === 'up' ? 'up' : (dir === 'down' ? 'down' : 'side');
    const g = [];
    for (let y = 0; y < 24; y++) g.push(new Array(16).fill('.'));
    const stamp = (rows, y0) => {
      rows.forEach((r, j) => {
        const y = y0 + j;
        if (y < 0 || y >= 24) return;
        for (let i = 0; i < 16 && i < r.length; i++) if (r[i] !== '.') g[y][i] = r[i];
      });
    };
    const set = (x, y, ch) => { if (x >= 0 && x < 16 && y >= 0 && y < 24) g[y][x] = ch; };
    stamp(BODIES[view], 12);
    if (view === 'side') {
      stamp(frame === 0 ? SIDE_LEGS.stand : (frame === 1 ? SIDE_LEGS.walk1 : SIDE_LEGS.walk2), 19);
      if (frame === 0) { set(7, 13, 'C'); set(8, 13, 'c'); set(7, 14, 'C'); set(8, 14, 'c'); set(7, 15, 'C'); set(8, 15, 'c'); set(7, 16, 's'); set(8, 16, 'S'); }
      else if (frame === 1) { set(7, 13, 'C'); set(8, 13, 'c'); set(6, 14, 'C'); set(7, 14, 'c'); set(5, 15, 's'); set(6, 15, 'S'); }
      else { set(8, 13, 'C'); set(9, 13, 'c'); set(9, 14, 'C'); set(10, 14, 'c'); set(10, 15, 's'); set(11, 15, 'S'); }
    } else {
      const leg = (x, lift, shoeX) => {
        set(x, 19, 'p'); set(x + 1, 19, 'P');
        if (!lift) { set(x, 20, 'p'); set(x + 1, 20, 'P'); }
        const sy = lift ? 20 : 21;
        set(shoeX, sy, 'K'); set(shoeX + 1, sy, 'k'); set(shoeX + 2, sy, 'k');
        set(shoeX, sy + 1, 'k'); set(shoeX + 1, sy + 1, 'k'); set(shoeX + 2, sy + 1, 'k');
      };
      leg(5, frame === 2, 4);
      leg(9, frame === 1, 9);
      const hand = (x, dy) => { set(x, 15 + dy, 's'); set(x, 16 + dy, 'S'); if (dy < 0) set(x, 16, '.'); };
      hand(3, frame === 1 ? 1 : (frame === 2 ? -1 : 0));
      hand(12, frame === 2 ? 1 : (frame === 1 ? -1 : 0));
      if (frame === 1) set(3, 15, 'C');
      if (frame === 2) set(12, 15, 'C');
    }
    const style = HEADS[view][look.hairStyle] ? look.hairStyle : 'short';
    stamp(HEADS[view][style], 0);
    if (look.hat) {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) if ('hHL'.indexOf(g[y][x]) >= 0) g[y][x] = '.';
      stamp(HATS[view], 0);
    }
    if (dir === 'right') for (let y = 0; y < 24; y++) g[y].reverse();
    return g;
  }
  const charCache = new Map();
  function genCharCanvas(look, dir, frame) {
    const grid = buildCharGrid(look, dir, frame);
    const { col, out } = charColors(look);
    const B = { w: 16, h: 24, n: 16 * 24, col: new Uint8ClampedArray(16 * 24 * 4) };
    const filled = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 24 && grid[y][x] !== '.';
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = grid[y][x];
        if (ch !== '.') { setPx(B, y * 16 + x, col[ch] || [255, 0, 255]); continue; }
        let n = null;
        if (filled(x, y + 1)) n = grid[y + 1][x];
        else if (filled(x, y - 1)) n = grid[y - 1][x];
        else if (filled(x - 1, y)) n = grid[y][x - 1];
        else if (filled(x + 1, y)) n = grid[y][x + 1];
        if (n) setPx(B, y * 16 + x, out[n] || [30, 24, 36]);
      }
    }
    return bufToCanvas(B);
  }
  function normLook(look) {
    const base = (GD().config && GD().config.player && GD().config.player.look) || {};
    return look && typeof look === 'object' ? look : base;
  }
  function characterCanvas(look, dir, frame) {
    look = normLook(look);
    dir = DIRS.indexOf(dir) >= 0 ? dir : 'down';
    frame = ((frame | 0) % 3 + 3) % 3;
    if (look.image) {
      const img = getImage(look.image);
      if (img && img.naturalWidth) {
        const key = 'img|' + look.image + '|' + dir + '|' + frame;
        let cv = charCache.get(key);
        if (!cv) {
          cv = document.createElement('canvas'); cv.width = 16; cv.height = 24;
          const cw = img.naturalWidth / 3, ch = img.naturalHeight / 4;
          const c2 = cv.getContext('2d');
          c2.imageSmoothingEnabled = false;
          c2.drawImage(img, frame * cw, DIRS.indexOf(dir) * ch, cw, ch, 0, 0, 16, 24);
          charCache.set(key, cv);
        }
        return cv;
      }
    }
    const key = lookKey(look) + '|' + dir + '|' + frame;
    let cv = charCache.get(key);
    if (!cv) { cv = genCharCanvas(look, dir, frame); charCache.set(key, cv); }
    return cv;
  }
  function drawCharacter(ctx, x, y, dir, frame, look) {
    ctx.drawImage(characterCanvas(look, dir, frame), Math.round(x), Math.round(y) - 8);
  }

  // =================================================================== トレーナー立ち絵・主人公の後ろ姿（64x64）
  const C = { skin: 0, hair: 1, shirt: 2, pants: 3, hat: 4, acc: 5, shoe: 6, white: 7, iris: 8, pink: 9 };
  function portraitRamps(look) {
    const cols = [];
    cols[C.skin] = look.skin || '#f8d0a8';
    cols[C.hair] = look.hair || '#503020';
    cols[C.shirt] = look.shirt || '#3070d0';
    cols[C.pants] = look.pants || '#304060';
    cols[C.hat] = look.hat || look.hair || '#503020';
    cols[C.acc] = look.accent || '#ffffff';
    cols[C.shoe] = mixHex(look.pants || '#304060', '#281c20', 0.55);
    cols[C.white] = '#f8f8f8';
    cols[C.iris] = '#3a3050';
    cols[C.pink] = '#f8a0b0';
    return cols.map(makeRamp);
  }
  function drawHairFront(D, look, style, hasHat) {
    const H = C.hair;
    if (style === 'bald') return;
    if (style === 'long') {
      D.ell(H, 32, 27, 16.5, 17.5, { z: 0.8 });
      D.sym((k) => D.cap(H, 32 + k * 13, 17, 3.2, 32 + k * 14.5, 35, 2.8, { z: 3.6 }));
    }
    if (style === 'bun' && !hasHat) D.ell(H, 32, 4.8, 5.5, 5, { z: 2.9 });
    if (!hasHat) D.ell(H, 32, 16, 15, 11, { z: 3.3, clip: (x, y) => y < 18.5 });
    const g = D.g();
    const pts = [18, 14, 46, 14, 46.5, 20];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const x = 46 - i * (28 / n);
      pts.push(x, i % 2 ? 22 : 18);
    }
    pts.push(17.5, 20);
    D.poly(H, pts, { g, z: 3.4, bevel: 2 });
    D.sym((k) => D.cap(H, 32 + k * 13, 16, 2.8, 32 + k * 13, 25, 1.6, { g, z: 3.4 }));
    if (style === 'spiky') {
      const angs = hasHat ? [-170, -150, -30, -10] : [-165, -135, -105, -75, -45, -15];
      for (const a of angs) {
        const r = a * Math.PI / 180, ca = Math.cos(r), sa = Math.sin(r);
        const bx = 32 + ca * 11, by = 17 + sa * 10;
        D.poly(H, [bx - sa * 4, by + ca * 4, 32 + ca * 20, 17 + sa * 17, bx + sa * 4, by - ca * 4], { g, z: 3.35, bevel: 1.8 });
      }
    }
  }
  function drawHatFront(D, look) {
    const g = D.ell(C.hat, 32, 12.5, 14.8, 10, { z: 4, clip: (x, y) => y < 14.5 });
    D.paintEll(C.acc, 32, 8.5, 2.8, 2.6, { g });
    D.ell(C.hat, 32, 14.8, 16.5, 3.4, { z: 4.2, bias: -0.18, flat: 0.6 });
  }
  function genPortrait(look) {
    const ramps = portraitRamps(look);
    const B = makeBuf(64, 64);
    const D = createDrawer(B, { s: 1, ax: 32, ay: 32, ox: 32, oy: 32, clip: [1, 1, 62, 62] });
    const style = look.hairStyle || 'short';
    D.sym((k) => D.ell(C.shoe, 32 + k * 6, 59.3, 5, 2.8, { z: 0.5 }));
    D.sym((k) => D.cap(C.pants, 32 + k * 4.8, 47, 4.1, 32 + k * 5.4, 57.5, 3.7, { z: 0 }));
    const gt = D.ell(C.shirt, 32, 41, 11, 10.5, { z: 1 });
    D.paint(C.pants, (x, y) => y > 47.5, { g: gt });
    D.paint(C.acc, (x, y) => y > 31 && y < 36 && Math.abs(x - 32) < (36 - y) * 0.9, { g: gt });
    D.sym((k) => D.cap(C.shirt, 32 + k * 9.5, 34.5, 3.5, 32 + k * 13.3, 43.5, 3.2, { z: 1.5 }));
    D.sym((k) => D.ell(C.skin, 32 + k * 13.8, 46, 3.1, 3.1, { z: 1.6 }));
    D.sym((k) => D.ell(C.skin, 32 + k * 13.2, 22.5, 2.5, 3.2, { z: 2.5 }));
    D.ell(C.skin, 32, 20.5, 13.2, 12.3, { z: 3 });
    drawHairFront(D, look, style, !!look.hat);
    if (look.hat) drawHatFront(D, look);
    shadePass(B, ramps, { 7: 1 });
    innerLinePass(B, ramps);
    // 顔
    const put = (x, y, rgb) => setPx(B, y * 64 + x, rgb);
    const dark = [44, 34, 52], white = [252, 252, 252];
    for (const x0 of [26, 35]) {
      for (let v = 0; v < 5; v++) for (let u = 0; u < 3; u++) put(x0 + u, 22 + v, v >= 3 && u === 1 ? ramps[C.iris][3] : dark);
      put(x0, 22, white); put(x0 + 2, 26, ramps[C.hair][1]);
    }
    const hb = ramps[C.hair][1];
    for (const x0 of [25, 35]) { put(x0, 20, hb); put(x0 + 1, 20, hb); put(x0 + 2, 20, hb); put(x0 + 3, 20, hb); }
    put(31, 29, dark); put(32, 29, dark); put(30, 28, dark); put(33, 28, dark);
    for (const x0 of [23, 38]) for (let u = 0; u < 3; u++) blendPx(B, 28 * 64 + x0 + u, [248, 140, 160], 0.45);
    outlinePass(B, ramps);
    return bufToCanvas(B);
  }
  function genPlayerBack(look) {
    const ramps = portraitRamps(look);
    const B = makeBuf(64, 64);
    const D = createDrawer(B, { s: 1, ax: 32, ay: 32, ox: 32, oy: 32, clip: [1, 1, 62, 63] });
    const style = look.hairStyle || 'short';
    const gt = D.ell(C.shirt, 32, 60, 21, 17, { z: 0 });
    D.paint(null, (x, y) => Math.abs(x - 32) < 1 && y > 46, { g: gt, bias: -0.25 });
    D.sym((k) => D.cap(C.shirt, 32 + k * 17, 50, 6, 32 + k * 21, 66, 5.5, { z: 0.5 }));
    D.sym((k) => D.ell(C.skin, 32 + k * 16.5, 26, 3.2, 4.2, { z: 1 }));
    D.ell(C.skin, 32, 38, 5.5, 4, { z: 0.8 });
    const gh = D.ell(C.skin, 32, 24, 16.5, 15.5, { z: 2 });
    if (style !== 'bald') {
      const gH = D.ell(C.hair, 32, 23, 17.2, 16, { z: 3, clip: (x, y) => style === 'long' || y < 36 });
      D.paint(null, (x, y) => y > 33, { g: gH, bias: -0.18 });
      if (style === 'long') D.ell(C.hair, 32, 36, 16.5, 14, { z: 2.9 });
      if (style === 'bun' && !look.hat) D.ell(C.hair, 32, 7, 6.5, 6, { z: 3.2 });
      if (style === 'spiky') {
        const angs = look.hat ? [170, 150, 30, 10, 60, 120] : [180, 155, 130, 105, 75, 50, 25, 0, 60, 120];
        for (const a of angs) {
          const r = a * Math.PI / 180 * -1, ca = Math.cos(r), sa = Math.sin(r);
          const bx = 32 + ca * 13, by = 23 + sa * 12;
          D.poly(C.hair, [bx - sa * 5, by + ca * 5, 32 + ca * 23, 23 + sa * 21, bx + sa * 5, by - ca * 5], { z: 2.95, bevel: 2 });
        }
        for (const a of [100, 80, 60, 120]) {
          const r = a * Math.PI / 180, ca = Math.cos(r), sa = Math.sin(r);
          const bx = 32 + ca * 13, by = 23 + sa * 12;
          D.poly(C.hair, [bx - sa * 4, by + ca * 4, 32 + ca * 20, 23 + sa * 19, bx + sa * 4, by - ca * 4], { z: 3.1, bevel: 2 });
        }
      }
    } else {
      D.paintEll(null, 27, 16, 4, 3, { g: gh, bias: 0.2 });
    }
    if (look.hat) {
      const g = D.ell(C.hat, 32, 17, 17.8, 13, { z: 4, clip: (x, y) => y < 21 });
      D.paint(C.acc, (x, y) => y > 18.5 && Math.abs(x - 32) < 5, { g });
    }
    shadePass(B, ramps, { 7: 1 });
    innerLinePass(B, ramps);
    outlinePass(B, ramps);
    return bufToCanvas(B);
  }
  const portraitCache = new Map();
  function trainerPortrait(look) {
    look = normLook(look);
    const key = 'p|' + lookKey(look);
    let src = portraitCache.get(key);
    if (!src) {
      try { src = genPortrait(look).toDataURL('image/png'); } catch (e) { console.warn('[sprites] 立ち絵の生成に失敗', e); src = ''; }
      portraitCache.set(key, src);
    }
    return src;
  }
  function playerBack(look) {
    look = normLook(look);
    const key = 'b|' + lookKey(look);
    let src = portraitCache.get(key);
    if (!src) {
      try { src = genPlayerBack(look).toDataURL('image/png'); } catch (e) { console.warn('[sprites] 後ろ姿の生成に失敗', e); src = ''; }
      portraitCache.set(key, src);
    }
    return src;
  }

  // =================================================================== 吹き出し（16x16）
  const EMOTE_GLYPHS = {
    '!': { color: [224, 48, 48], rows: ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..', '..##..'] },
    '?': { color: [48, 88, 208], rows: ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..', '..##..'] },
    '♪': { color: [56, 48, 72], rows: ['...##.', '...#.#', '...#.#', '...#..', '.###..', '####..', '.##...', '......'] },
    '…': { color: [64, 64, 80], rows: ['......', '......', '......', '......', '......', '......', '#.#.#.', '#.#.#.'] },
    '♥': { color: [232, 72, 112], rows: ['......', '.##.##', '######', '######', '.####.', '..##..', '......', '......'] },
  };
  const emoteCache = new Map();
  function emoteCanvas(type) {
    const glyph = EMOTE_GLYPHS[type] ? type : '!';
    let cv = emoteCache.get(glyph);
    if (cv) return cv;
    const B = { w: 16, h: 16, n: 256, col: new Uint8ClampedArray(256 * 4) };
    const ol = [40, 36, 52], wh = [252, 252, 252], sh = [208, 216, 232];
    const bubble = [
      '..############..', '.#wwwwwwwwwwww#.', '#wwwwwwwwwwwwwws#'.slice(0, 16), '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws',
      '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws', '#wwwwwwwwwwwwwws', '.#sssssssssssss#'.slice(0, 16),
      '..#####ww######.', '......#ws#......', '.......##.......', '................',
    ];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = bubble[y][x];
        if (ch === '#') setPx(B, y * 16 + x, ol);
        else if (ch === 'w') setPx(B, y * 16 + x, wh);
        else if (ch === 's') setPx(B, y * 16 + x, (x === 15 || y === 11) ? ol : sh);
      }
    }
    const g = EMOTE_GLYPHS[glyph];
    const gx = glyph === '…' ? 4 : 5, gy = glyph === '…' ? 1 : 2;
    g.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') setPx(B, (gy + j) * 16 + gx + i, g.color); });
    if (glyph === '…') { for (let i = 0; i < 3; i++) { setPx(B, 8 * 16 + 4 + i * 3, g.color); setPx(B, 8 * 16 + 5 + i * 3, g.color); setPx(B, 9 * 16 + 4 + i * 3, g.color); setPx(B, 9 * 16 + 5 + i * 3, g.color); } }
    cv = bufToCanvas(B);
    emoteCache.set(glyph, cv);
    return cv;
  }
  function drawEmote(ctx, x, y, type) {
    ctx.drawImage(emoteCanvas(type), Math.round(x), Math.round(y));
  }

  // =================================================================== init
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    // 画像の事前読み込み（失敗を早めに検知して自動生成に切り替えるため）
    try {
      const G = GD();
      (Array.isArray(G.monsters) ? G.monsters : []).forEach((m) => {
        if (m && typeof m.image === 'string' && m.image.trim()) loadImage(m.image.trim());
        if (m && typeof m.backImage === 'string' && m.backImage.trim()) loadImage(m.backImage.trim());
      });
      Object.keys(G.trainers || {}).forEach((id) => { const t = G.trainers[id]; if (t && t.look && t.look.image) loadImage(t.look.image); });
      const pl = G.config && G.config.player && G.config.player.look;
      if (pl && pl.image) loadImage(pl.image);
      Object.keys(G.maps || {}).forEach((id) => { const m = G.maps[id]; (m && Array.isArray(m.npcs) ? m.npcs : []).forEach((n) => { if (n && n.look && n.look.image) loadImage(n.look.image); }); });
    } catch (e) {
      console.warn('[sprites] init 中の画像先読みで例外', e);
    }
  }
  function clearCache() {
    spriteCache.clear(); charCache.clear(); portraitCache.clear();
  }

  App.sprites = {
    init,
    monsterSprite,
    characterCanvas,
    drawCharacter,
    trainerPortrait,
    playerBack,
    drawEmote,
    loadImage,
    getImage,
    // 追加 API（契約外・任意利用）
    monsterCanvas,
    emoteCanvas,
    clearCache,
    SHAPES: SHAPES.slice(),
    _internal: { makeRamp, hashStr, mulberry32, makeRng, parseColor, mixHex, createDrawer, makeBuf, shadePass, innerLinePass, outlinePass, bufToCanvas, setPx },
  };
})();
