// =====================================================================
// App.audio — 効果音・BGM（WebAudio 自作チップチューン音源）
//
//   GBA風の音源構成:
//     矩形波 sq12 / sq25 / sq50 / sq75（デューティ比 12.5% / 25% / 50% / 75%）
//     tri   … 4bit 階段状の三角波（ベース向け）
//     noise … LFSR ノイズ（ドラム・効果音）
//   外部の音声ファイルは一切使わない。
//
// ---------------------------------------------------------------------
// ■ 曲データの書き方（BGM）
//   BGM.曲名 = {
//     tempo: 124,          // 4分音符 / 分
//     beats: 4,            // 1小節の拍数（省略時 4）
//     loopBar: 0,          // ループの戻り先の小節（0 始まり。イントロ付きの曲は 2 など）
//     defs: { Am: '(A4 C5 E5)' },   // マクロ（ノート列の中で $Am と書くと置き換わる）
//     tracks: {
//       lead: { wave: 'sq25', vol: 0.15, notes: 'A4 8, D5, F#5 4 | ...' },
//       ...
//     },
//   }
//
//   ノート列（notes）の記法:
//     C5 8        … 音名+オクターブ と 長さ（1=全 2=2分 4=4分 8=8分 16 32 64）
//     C#5 / Db5   … シャープ / フラット
//     4. / 8t     … 付点 / 3連符。  4+16 … タイ（足し算）
//     長さを省略すると直前の長さを引き継ぐ（'C5 8, D5, E5' は全部 8分）
//     r 4         … 休符
//     (C4 E4 G4) 4… 和音を高速アルペジオで鳴らす（チップチューン定番）
//     k s h o c tl th cl … ドラム（wave:'noise' のトラックのみ）
//                   キック/スネア/ハイハット/オープンハット/クラッシュ/タム低/タム高/クラップ
//                   k+c のように + で同時に鳴らせる
//     |           … 小節線（長さが拍数と合わないと validate() がエラーを出す）
//     [ ... ]x4   … 繰り返し（入れ子可）
//     , や改行    … 区切り。 // 以降は行末までコメント
//
//   トラックのオプション（省略可）:
//     vol 0..1 / env [attack秒, decay秒, sustain 0..1, release秒] / gate 0..1（音の長さの割合）
//     pan -1..1 / vib { depth: セント, rate: Hz, delay: 秒 } / echo { delay: '8.', vol: 0.3 }
//     arpSpeed 秒（アルペジオ1音の長さ） / detune セント
//
// ■ 効果音（SFX）の書き方
//   SFX.名前 = { duck: 秒（BGMを一時的に下げる）, vol: 1, parts: [ パート, ... ] }
//   パートは3種類（at: 開始秒, repeat: 回数, every: 繰り返し間隔秒, crescendo: [最初倍率, 最後倍率]）:
//     { wave: 'sq25', notes: 'C6 16, E6', tempo: 150, vol }       … ノート列（BGMと同じ記法）
//     { wave: 'sq50', freq: [800, 200], dur: 0.1, vol, curve }     … ピッチスイープ（curve: 'exp'|'lin'）
//     { wave: 'noise', dur: 0.1, vol, filter: 'highpass', freq: [f0, f1], q, buf: 'white'|'metal', shape: 'decay'|'swell'|'hold' }
//
// ■ 拡張: window.GameData.bgm / GameData.sfx に同じ形式で定義すると、同名の組み込みを上書き・追加できる。
// ■ 検証: App.audio.validate() → { ok, errors, warnings, bgm:{...}, sfx:{...} }
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  // ------------------------------------------------------------------
  // 定数
  // ------------------------------------------------------------------
  const TPQ = 48;                 // 4分音符 = 48 tick（全音符 192）
  const LOOKAHEAD = 0.15;         // 何秒先まで予約するか
  const TIMER_MS = 25;            // スケジューラの周期
  const FADE_OUT = 0.45;          // 曲切替時のフェードアウト秒
  const MIDI_MIN = 24;            // C1
  const MIDI_MAX = 108;           // C8
  const MASTER_SCALE = 1.0;
  const BGM_LEVEL = 0.8;           // 効果音に対する BGM の音量比
  const WAVES = ['sq12', 'sq25', 'sq50', 'sq75', 'tri', 'noise'];
  const DRUMS = { k: 'キック', s: 'スネア', h: 'ハイハット', o: 'オープンハット', c: 'クラッシュ', tl: 'タム低', th: 'タム高', cl: 'クラップ' };
  const DUR_BASE = { 1: 192, 2: 96, 4: 48, 8: 24, 16: 12, 32: 6, 64: 3 };
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const SFX_NAMES = ['select', 'confirm', 'cancel', 'bump', 'door', 'encounter', 'hit', 'hitSuper', 'hitWeak', 'miss',
    'faint', 'levelup', 'heal', 'statUp', 'statDown', 'win', 'lose', 'run', 'coin', 'error', 'trainerSpot',
    'gachaRoll', 'gachaN', 'gachaR', 'gachaSR', 'gachaSSR', 'gachaUR'];
  const BGM_NAMES = ['title', 'town', 'route', 'forest', 'cave', 'gym', 'battleWild', 'battleTrainer', 'battleBoss', 'victory', 'gacha'];

  const TRACK_DEFAULTS = {
    sq: { vol: 0.14, env: [0.004, 0.25, 0.65, 0.05], gate: 0.9, arpSpeed: 0.035 },
    tri: { vol: 0.30, env: [0.002, 0.05, 0.9, 0.03], gate: 0.9, arpSpeed: 0.035 },
    noise: { vol: 0.40, env: [0.001, 0, 1, 0.02], gate: 1, arpSpeed: 0.035 },
  };

  // ==================================================================
  // BGM（すべてオリジナル曲）
  // ==================================================================
  const BGM = {
    // ---- タイトル: 希望に満ちた（D dur） ----------------------------
    title: {
      tempo: 124,
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 14, rate: 5.5, delay: 0.2 }, echo: { delay: '8', vol: 0.2 },
          notes: `
            A4 8, D5, F#5 4, E5 8, D5, A5 4 | G5 4., F#5 8, E5 2 | F#5 8, D5, B4 4, C#5 8, D5, F#5 4 | E5 2, D5 8, E5, F#5, G5 |
            A5 4., F#5 8, D6 4, A5 | C#6 8, B5, A5, G5, F#5 4, E5 | D5 8, E5, F#5, G5, B5 4, A5 8, G5 | A5 2., r 4 |
            B4 8, D5, G5 4., F#5 8, E5 4 | C#5 8, E5, A5 4., G5 8, F#5 4 | F#5 8, A5, C#6 4, B5 8, A5, F#5 4 | B5 2, A5 4, F#5 |
            G5 4., F#5 8, E5 4, B4 | C#5 4, E5, A5, C#6 | D6 4., C#6 8, A5 4, F#5 | E5 2, r 8, A4, C#5, E5 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.065, gate: 0.7, pan: -0.3, env: [0.003, 0.12, 0.5, 0.04],
          notes: `
            [D4 8, A4, F#4, A4]x2 | [C#4 8, A4, E4, A4]x2 | [B3 8, F#4, D4, F#4]x2 | [B3 8, G4, D4, G4]x2 |
            [D4 8, A4, F#4, A4]x2 | [C#4 8, A4, E4, A4]x2 | [B3 8, G4, D4, G4]x2 | [C#4 8, A4, E4, A4]x2 |
            [B3 8, G4, D4, G4]x2 | [C#4 8, A4, E4, A4]x2 | [C#4 8, A4, F#4, A4]x2 | [D4 8, B4, F#4, B4]x2 |
            [E4 8, B4, G4, B4]x2 | [E4 8, C#5, A4, C#5]x2 | [F#4 8, D5, A4, D5]x2 | [E4 8, C#5, G4, C#5]x2 |`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.8,
          notes: `
            [D3 8, D4]x4 | [C#3 8, C#4]x4 | [B2 8, B3]x4 | [G2 8, G3]x4 |
            [D3 8, D4]x4 | [A2 8, A3]x4 | [G2 8, G3]x4 | [A2 8, A3]x3, A2 8, C#3 |
            [G2 8, G3]x4 | [A2 8, A3]x4 | [F#2 8, F#3]x4 | [B2 8, B3]x4 |
            [E2 8, E3]x4 | [A2 8, A3]x4 | [D3 8, D4]x4 | A2 8, A3, A2, A3, G2, G3, E2, C#3 |`,
        },
        drum: {
          wave: 'noise', vol: 0.36,
          notes: `
            [ k+c 8, h, s, h, k, k, s, h |
              [k 8, h, s, h, k, k, s, h |]x6
              k 8, h, s, h, s 16, s, s, s, th, th, tl, tl | ]x2`,
        },
      },
    },

    // ---- まち: のどか（F dur） --------------------------------------
    town: {
      tempo: 100,
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.14, env: [0.01, 0.3, 0.6, 0.08], vib: { depth: 10, rate: 5, delay: 0.25 }, echo: { delay: '8', vol: 0.18 },
          notes: `
            C5 4, F5, A5 4., G5 8 | G5 4, E5, C5 2 | D5 4, F5 8, A5, D6 4, C6 | Bb5 2., A5 8, G5 |
            A5 4., F5 8, C5 4, F5 | G5 4, Bb5, A5 8, G5, F5 4 | E5 4., F5 8, G5 4, C6 | Bb5 2, A5 4, G5 |
            F5 4, Bb5 8, A5, Bb5 4, D6 | C6 4., Bb5 8, A5 4, G5 | A5 4, E5 8, G5, A5 4, C6 | F5 2, D5 4, F5 |
            Bb5 4., A5 8, G5 4, D5 | E5 4, G5, C6, Bb5 | A5 2., G5 8, F5 | F5 2, r 2 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.07, gate: 0.95, pan: 0.3, env: [0.005, 0.5, 0.25, 0.1],
          notes: `
            A4 2, C5 | G4 2, E4 | F4 2, A4 | F4 2, D4 |
            C5 2, A4 | Bb4 2, F4 | G4 2, E4 | G4 2, Bb4 |
            D5 2, F4 | E4 2, G4 | E4 2, C5 | A4 2, F4 |
            D5 2, Bb4 | G4 2, E4 | C5 2, A4 | F4 2, E4 4, G4 |`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.75,
          notes: `
            F2 4, C3, F3, C3 | E2 4, G2, C3, G2 | D2 4, A2, D3, A2 | Bb1 4, F2, Bb2, F2 |
            F2 4, C3, F3, C3 | G2 4, D3, F3, D3 | C3 4, G2, E2, G2 | C3 4, Bb2, G2, E2 |
            Bb1 4, F2, D3, F2 | C2 4, G2, E3, G2 | A1 4, E2, A2, E2 | D2 4, A2, F3, A2 |
            G2 4, D3, Bb2, D3 | C3 4, G2, E2, C2 | F2 4, C3, A2, C3 | F2 4, C3, F2 8, G2, A2, E2 |`,
        },
        drum: {
          wave: 'noise', vol: 0.26,
          notes: `
            [ [k 4, h 8, h, s 4, h 8, h |]x7
              k 4, h 8, h, s 8, s 16, s, th 8, tl | ]x2`,
        },
      },
    },

    // ---- 道路: 冒険的（G dur / ミクソリディアン風） -----------------
    route: {
      tempo: 140,
      defs: {
        G: '(B4 D5 G5)', F: '(A4 C5 F5)', C: '(G4 C5 E5)', Em: '(G4 B4 E5)',
        D: '(A4 D5 F#5)', Bm: '(B4 D5 F#5)', Am: '(A4 C5 E5)',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 12, rate: 6, delay: 0.18 }, echo: { delay: '16', vol: 0.18 },
          notes: `
            G4 8, B4, D5 4, G5 4., A5 8 | A5 4, F5 8, C5, F5 4, A5 | G5 4., E5 8, C5 4, E5 8, G5 | D5 2., r 8, D5 16, E5 |
            G5 4, F#5 8, E5, B4 4, E5 8, F#5 | G5 4, A5 8, G5, E5 4, C5 | F#5 8, G5, A5, B5, C6 4, B5 8, A5 | A5 2, F#5 4, D5 |
            E5 8, G5, C6 4, B5 8, C6, D6 4 | C6 8, B5, A5 4, F#5, D5 | D5 8, F#5, B5 4, A5 8, B5, D6 4 | B5 2., r 8, B5 16, C6 |
            C6 4., B5 8, A5 4, E5 | G5 4., F#5 8, E5 4, G5 | F#5 8, E5, F#5, G5, A5, B5, C6, D6 | D6 4, r 8, A5 16, B5, C6 4, B5 8, A5 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.07, gate: 0.5, pan: -0.3, arpSpeed: 0.03,
          notes: `
            [r 8, $G 8]x4 | [r 8, $F 8]x4 | [r 8, $C 8]x4 | [r 8, $G 8]x4 |
            [r 8, $Em 8]x4 | [r 8, $C 8]x4 | [r 8, $D 8]x4 | [r 8, $D 8]x4 |
            [r 8, $C 8]x4 | [r 8, $D 8]x4 | [r 8, $Bm 8]x4 | [r 8, $Em 8]x4 |
            [r 8, $Am 8]x4 | [r 8, $C 8]x4 | [r 8, $D 8]x4 | [r 8, $D 8]x4 |`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.7,
          notes: `
            [G2 8, G2, G3, G2]x2 | [F2 8, F2, F3, F2]x2 | [C3 8, C3, C4, C3]x2 | [G2 8, G2, G3, G2]x2 |
            [E2 8, E2, E3, E2]x2 | [C3 8, C3, C4, C3]x2 | [D3 8, D3, D4, D3]x2 | D3 8, D3, D4, D3, A2, A2, B2, B2 |
            [C3 8, C3, C4, C3]x2 | [D3 8, D3, D4, D3]x2 | [B2 8, B2, B3, B2]x2 | [E2 8, E2, E3, E2]x2 |
            [A2 8, A2, A3, A2]x2 | [C3 8, C3, C4, C3]x2 | [D3 8, D3, D4, D3]x2 | D3 8, D3, D4, D3, D3, C3, B2, A2 |`,
        },
        drum: {
          wave: 'noise', vol: 0.36,
          notes: `
            [ k+c 8, h, s, h, k 16, k, h 8, s, h |
              [k 8, h, s, h, k 16, k, h 8, s, h |]x6
              k 8, h, s, h, s 16, s, s, s, th, th, tl, tl | ]x2`,
        },
      },
    },

    // ---- 森: 神秘的（A ドリア風、16分アルペジオ＋エコー） -----------
    forest: {
      tempo: 92,
      defs: {
        Am: '[A3 16, E4, B4, C5]x4', G: '[G3 16, D4, A4, B4]x4', FM7: '[F3 16, C4, E4, A4]x4',
        Em: '[E3 16, B3, D4, G4]x4', E: '[E3 16, B3, E4, G#4]x4', Dm: '[D3 16, A3, E4, F4]x4', D: '[D3 16, A3, E4, F#4]x4',
      },
      tracks: {
        lead: {
          wave: 'sq50', vol: 0.11, env: [0.05, 0.4, 0.7, 0.2], vib: { depth: 16, rate: 4.5, delay: 0.3 }, echo: { delay: '8.', vol: 0.3 },
          notes: `
            r 2, E5 4, A5 | B5 2., A5 8, G5 | A5 2, E5 | G5 4., F#5 8, E5 2 |
            r 4, C6, B5, A5 | D6 2, B5 4, G5 | A5 4., G5 8, F5 4, E5 | G#5 1 |
            F5 4., E5 8, D5 4, A5 | E5 2., r 4 | C6 4., B5 8, A5 4, G5 | B5 2, D6 4, B5 |
            C6 2., B5 8, C6 | B5 4., A5 8, F#5 2 | E5 4, F5, A5, C6 | B5 2., G#5 4 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.06, gate: 0.6, pan: -0.35, env: [0.002, 0.1, 0.4, 0.05], echo: { delay: '8.', vol: 0.4 },
          notes: `
            $Am | $G | $FM7 | $Em | $Am | $G | $FM7 | $E |
            $Dm | $Am | $FM7 | $G | $Am | $D | $FM7 | $E |`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.95, env: [0.01, 0.3, 0.8, 0.1],
          notes: `
            A2 2, E2 | G2 2, D2 | F2 2, C3 | E2 2, B2 |
            A2 2, E2 | G2 2, D3 | F2 2, C3 | E2 1 |
            D2 2, A2 | A2 2, E2 | F2 2, C3 | G2 2, D3 |
            A2 2, E3 | D2 2, A2 | F2 2, C3 | E2 2, B1 |`,
        },
        drum: {
          wave: 'noise', vol: 0.2,
          notes: `
            [ tl 4, h 8, r, r 4, h 8, h 16, h |
              [r 4, h 8, r, r 4, h 8, h 16, h |]x3 ]x4`,
        },
      },
    },

    // ---- 洞窟: 緊張感（D moll、半音のオスティナート） ---------------
    cave: {
      tempo: 80,
      defs: {
        bD: 'D2 8, A2, D3, A2, Eb3, D3, A2, D2 |',
        bC: 'C2 8, G2, C3, G2, Db3, C3, G2, C2 |',
        bBb: 'Bb1 8, F2, Bb2, F2, B2, Bb2, F2, Bb1 |',
        bA: 'A1 8, E2, A2, E2, Bb2, A2, E2, A1 |',
        bEb: 'Eb2 8, Bb2, Eb3, Bb2, E3, Eb3, Bb2, Eb2 |',
      },
      tracks: {
        lead: {
          wave: 'sq12', vol: 0.09, gate: 0.8, env: [0.002, 0.2, 0.3, 0.1], echo: { delay: '8.', vol: 0.45 },
          notes: `
            r 2, D6 16, r, A5 8, r 4 | r 1 | r 2, E6 16, r, G5 8, r 4 | r 4., F5 16, Bb5, D6 4, r |
            r 2, A5 16, r, D6 8, r 4 | r 2, G#5 8, A5, F5 4 | E5 2., r 4 | r 2, C#6 16, r, E6 8, r 4 |
            r 2, G5 8, Bb5, Eb6 4 | D6 2, r | r 2, E6 16, r, C#6 8, r 4 | A5 8, r, Bb5, r, B5, r, C#6, r |`,
        },
        harm: {
          wave: 'sq50', vol: 0.06, gate: 0.97, pan: 0.25, env: [0.6, 0.8, 0.7, 0.4], vib: { depth: 18, rate: 3, delay: 0.5 },
          notes: `
            F4 1 | E4 1 | E4 1 | D4 1 | F4 1 | G#4 1 | G4 1 | C#4 1 |
            G4 1 | F4 1 | E4 1 | C#5 2, E5 2 |`,
        },
        bass: {
          wave: 'tri', vol: 0.32, gate: 0.7,
          notes: `
            $bD $bD $bC $bBb
            $bD $bD $bC $bA
            $bEb $bBb $bA A1 8, A2, A1, A2, A1 16, A2, A1, A2, C#3 8, E3 |`,
        },
        drum: {
          wave: 'noise', vol: 0.3,
          notes: `
            [ k 8, k 16, r, r 4, h 8, r, r 4 |
              k 8, k 16, r, r 4, r 2 | ]x5
            k 8, k 16, r, r 4, h 8, r, r 4 |
            k 8, k 16, r, th 16, th, tl, tl, s 8, s, s, s |`,
        },
      },
    },

    // ---- ジム: 力強い（E moll、パワーコード） -----------------------
    gym: {
      tempo: 144,
      defs: {
        Em: '(E4 B4 E5)', C: '(C4 G4 C5)', D: '(D4 A4 D5)', B: '(B3 F#4 B4)', Am: '(A3 E4 A4)', Bm: '(B3 F#4 B4)',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 14, rate: 6, delay: 0.2 }, echo: { delay: '16', vol: 0.15 },
          notes: `
            E5 4, B4 8, E5, r, G5, F#5 4 | E5 4., G5 8, C6 4, B5 | A5 4, F#5 8, D5, r, A5, G5, F#5 | F#5 2., D#5 4 |
            E5 4, B4 8, E5, r, G5, B5 4 | C6 4., B5 8, G5 4, E5 | A5 8, B5, C6, A5, E6 4, D6 8, C6 | B5 2., r 4 |
            G5 8, G5 16, G5, G5 8, A5, B5 4, C6 | A5 8, A5 16, A5, A5 8, B5, C6 4, D6 | F#6 4., E6 8, D6 4, B5 | E6 2., r 4 |
            E6 4., D6 8, C6 4, G5 | F#5 4., G5 8, A5 4, D6 | D#6 4., C#6 8, B5 4, F#5 | A5 4, F#5, D#5, B4 |`,
        },
        harm: {
          wave: 'sq50', vol: 0.06, gate: 0.6, pan: -0.25, arpSpeed: 0.028,
          notes: `
            $Em 8, $Em, r, $Em, r, $Em, $Em 4 | $C 8, $C, r, $C, r, $C, $C 4 | $D 8, $D, r, $D, r, $D, $D 4 | $B 8, $B, r, $B, r, $B, $B 4 |
            $Em 8, $Em, r, $Em, r, $Em, $Em 4 | $C 8, $C, r, $C, r, $C, $C 4 | $Am 8, $Am, r, $Am, r, $Am, $Am 4 | $B 8, $B, r, $B, r, $B, $B 4 |
            $C 8, $C, r, $C, r, $C, $C 4 | $D 8, $D, r, $D, r, $D, $D 4 | $Bm 8, $Bm, r, $Bm, r, $Bm, $Bm 4 | $Em 8, $Em, r, $Em, r, $Em, $Em 4 |
            $C 8, $C, r, $C, r, $C, $C 4 | $D 8, $D, r, $D, r, $D, $D 4 | $B 8, $B, r, $B, r, $B, $B 4 | [$B 8]x8 |`,
        },
        bass: {
          wave: 'tri', vol: 0.32, gate: 0.7,
          notes: `
            [E2 8, E2, E3, E2]x2 | [C2 8, C2, C3, C2]x2 | [D2 8, D2, D3, D2]x2 | [B1 8, B1, B2, B1]x2 |
            [E2 8, E2, E3, E2]x2 | [C2 8, C2, C3, C2]x2 | [A1 8, A1, A2, A1]x2 | [B1 8, B1, B2, B1]x2 |
            [C2 8, C2, C3, C2]x2 | [D2 8, D2, D3, D2]x2 | [B1 8, B1, B2, B1]x2 | [E2 8, E2, E3, E2]x2 |
            [C2 8, C2, C3, C2]x2 | [D2 8, D2, D3, D2]x2 | [B1 8, B1, B2, B1]x2 | B1 8, B2, A2, B2, F#2, B2, D#2, F#2 |`,
        },
        drum: {
          wave: 'noise', vol: 0.4,
          notes: `
            [ k+c 8, h, s, k, k, h, s, h |
              [k 8, h, s, k, k, h, s, h |]x6
              k 8, h, s, k, s 16, s, s, s, tl 8, tl | ]x2`,
        },
      },
    },

    // ---- 野生バトル: 速いテンポ（A moll、イントロ2小節） ------------
    battleWild: {
      tempo: 168,
      loopBar: 2,
      defs: {
        Am: '(A4 C5 E5)', F: '(A4 C5 F5)', G: '(B4 D5 G5)', E: '(G#4 B4 E5)', Dm: '(A4 D5 F5)', Em: '(G4 B4 E5)',
        gAm: '[$Am 8, $Am 16, $Am]x4 |', gF: '[$F 8, $F 16, $F]x4 |', gG: '[$G 8, $G 16, $G]x4 |',
        gE: '[$E 8, $E 16, $E]x4 |', gDm: '[$Dm 8, $Dm 16, $Dm]x4 |', gEm: '[$Em 8, $Em 16, $Em]x4 |',
        bA: '[A2 8, A3]x4 |', bF: '[F2 8, F3]x4 |', bG: '[G2 8, G3]x4 |', bE: '[E2 8, E3]x4 |', bD: '[D2 8, D3]x4 |',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 12, rate: 7, delay: 0.15 },
          notes: `
            // イントロ（減七の上昇アルペジオ）
            A4 16, C5, D#5, F#5, A5, C6, D#6, F#6, A6 8, r, A6, r |
            E6 8, r, E5, r, E5 16, F5, E5, D#5, E5 8, B4 |
            // ループ
            A4 8, C5, E5, A5, G5 4, E5 8, C5 | D5 8, E5, C5 4, A4, r 8, A4 16, B4 |
            C5 8, F5, A5, C6, B5 4, A5 8, F5 | G5 4., D5 8, B4 4, D5 |
            A5 8, A5 16, B5, C6 8, B5, A5, G5, E5, G5 | A5 4, E5 8, C5, E5 4, A5 |
            F5 8, G5, A5, C6, F6 4, E6 8, C6 | B5 4., G#5 8, E5 4, B4 |
            D5 8, F5, A5, D6, C6 4, A5 | B5 8, G5, E5, G5, B5 4, E6 |
            C6 8, A5, F5, A5, C6 4, F6 | D6 8, B5, G5, B5, D6 4, G6 |
            F6 4., E6 8, D6 4, A5 | G#5 4., A5 8, B5 4, E6 |
            C6 8, B5, A5, E5, C5 4, E5 8, A5 | G#5 8, B5, E6, B5, G#5 16, A5, B5, C6, D6 8, E6 |`,
        },
        harm: {
          wave: 'sq50', vol: 0.055, gate: 0.55, pan: -0.25, arpSpeed: 0.025,
          notes: `
            r 16, A4, C5, D#5, F#5, A5, C6, D#6, E6 8, r, E6, r |
            B5 8, r, B4, r, B4 16, C5, B4, A#4, B4 8, G#4 |
            $gAm $gAm $gF $gG $gAm $gAm $gF $gE
            $gDm $gEm $gF $gG $gDm $gE $gAm $gE`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.75,
          notes: `
            A2 8, r, A2, r, A2, r, A2, r | E2 8, r, E2, r, E2 16, E2, E2, E2, E2 8, E2 |
            $bA $bA $bF $bG $bA $bA $bF $bE
            $bD $bE $bF $bG $bD $bE $bA $bE`,
        },
        drum: {
          wave: 'noise', vol: 0.38,
          notes: `
            k 8, r, k, r, k, r, k, r | k 8, r, k, r, s 16, s, s, s, s, s, s, s |
            [ k+c 8, h, s, k 16, k, k 8, h, s, h |
              [k 8, h, s, k 16, k, k 8, h, s, h |]x2
              k 8, h, s, h, s 16, s, s, s, th 8, tl | ]x4`,
        },
      },
    },

    // ---- トレーナーバトル: さらに熱い（C moll、イントロ2小節） ------
    battleTrainer: {
      tempo: 180,
      loopBar: 2,
      defs: {
        hCm: '[C4 16, G4, Eb5, G4]x4 |', hBb: '[Bb3 16, F4, D5, F4]x4 |', hAb: '[Ab3 16, Eb4, C5, Eb4]x4 |',
        hG: '[G3 16, D4, B4, D4]x4 |', hFm: '[F3 16, C4, Ab4, C4]x4 |', hG7: '[G3 16, F4, B4, F4]x4 |',
        bC: '[C2 8, C3]x4 |', bBb: '[Bb1 8, Bb2]x4 |', bAb: '[Ab1 8, Ab2]x4 |', bG: '[G1 8, G2]x4 |', bF: '[F2 8, F3]x4 |',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 12, rate: 7, delay: 0.15 }, echo: { delay: '16', vol: 0.15 },
          notes: `
            G5 16, G5, r 8, G5 16, G5, r 8, Ab5 16, Ab5, r 8, Bb5 16, B5, r 8 |
            C5 16, D5, Eb5, F5, G5, Ab5, B5, C6, D6 8, Eb6, F6, G6 |
            C5 8, Eb5, G5, C6, Bb5, G5, Eb5 4 | D5 8, F5, Bb5 4, A5 8, Bb5, D6 4 |
            C6 4., Bb5 8, Ab5, G5, F5, Eb5 | D5 8, D5 16, D5, G5 8, F5, D5 4, B4 |
            G5 8, G5 16, Ab5, G5 8, F5, Eb5 4, C5 | F5 8, F5 16, G5, F5 8, Eb5, D5 4, Bb4 |
            Eb5 8, F5, G5, Ab5, C6 4, Eb6 | D6 2., r 8, B5 |
            C6 4., Ab5 8, F5 4, C6 | Eb6 4., D6 8, C6 4, G5 |
            Ab5 8, C6, F6, Eb6, D6 4, C6 | G5 2., r 4 |
            Ab5 8, Bb5, C6, Eb6, Ab6 4, G6 8, F6 | F6 4., Eb6 8, D6 4, Bb5 |
            B5 8, D6, G6, D6, B5, G5, F5, D5 | B4 16, C5, D5, Eb5, F5, G5, Ab5, B5, D6 4, B5 8, G5 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.06, gate: 0.7, pan: -0.3, env: [0.002, 0.08, 0.5, 0.03],
          notes: `
            Eb5 16, Eb5, r 8, Eb5 16, Eb5, r 8, F5 16, F5, r 8, G5 16, G5, r 8 |
            C4 8, r, C4, r, C4 16, C4, C4, C4, B3, B3, B3, B3 |
            $hCm $hBb $hAb $hG $hCm $hBb $hAb $hG
            $hFm $hCm $hFm $hCm $hAb $hBb $hG $hG7`,
        },
        bass: {
          wave: 'tri', vol: 0.32, gate: 0.75,
          notes: `
            C2 16, C2, r 8, C2 16, C2, r 8, Db2 16, Db2, r 8, D2 16, Eb2, r 8 |
            G2 8, r, G2, r, G2 16, G2, G2, G2, G2, F2, Eb2, D2 |
            $bC $bBb $bAb $bG $bC $bBb $bAb $bG
            $bF $bC $bF $bC $bAb $bBb $bG $bG`,
        },
        drum: {
          wave: 'noise', vol: 0.4,
          notes: `
            k 16, k, r 8, k 16, k, r 8, k 16, k, r 8, s 16, s, r 8 |
            k 8, r, k, r, s 16, s, s, s, s, s, s, s |
            [ k+c 8, h 16, h, s 8, h 16, k, k 8, h 16, h, s 8, h |
              [k 8, h 16, h, s 8, h 16, k, k 8, h 16, h, s 8, h |]x2
              k 8, h 16, h, s 8, s 16, s, s, s, s, s, th, th, tl, tl | ]x4`,
        },
      },
    },

    // ---- ボスバトル: 重厚（D moll + フリギア的な Eb、イントロ2小節） -
    battleBoss: {
      tempo: 152,
      loopBar: 2,
      defs: {
        Dm: '(D4 F4 A4)', Eb: '(Eb4 G4 Bb4)', C: '(C4 E4 G4)', Bb: '(D4 F4 Bb4)', A: '(C#4 E4 A4)', Gm: '(D4 G4 Bb4)',
        bDm: 'D2 8, D2, D3, D2, D2 16, D2, D2 8, D3, D2 |',
        bEb: 'Eb2 8, Eb2, Eb3, Eb2, Eb2 16, Eb2, Eb2 8, Eb3, Eb2 |',
        bC: 'C2 8, C2, C3, C2, C2 16, C2, C2 8, C3, C2 |',
        bBb: 'Bb1 8, Bb1, Bb2, Bb1, Bb1 16, Bb1, Bb1 8, Bb2, Bb1 |',
        bA: 'A1 8, A1, A2, A1, A1 16, A1, A1 8, A2, A1 |',
        bGm: 'G1 8, G1, G2, G1, G1 16, G1, G1 8, G2, G1 |',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, env: [0.006, 0.4, 0.75, 0.08], vib: { depth: 16, rate: 5.5, delay: 0.2 }, echo: { delay: '8', vol: 0.18 },
          notes: `
            D5 8, r, D5, r, Eb5, r, Eb5, r | D5 16, Eb5, D5, C#5, D5, Eb5, E5, F5, F#5 8, G5, G#5, A5 |
            D5 4., F5 8, A5 2 | G5 4., F5 8, Eb5 4, Bb4 | D5 4, F5, A5, D6 | C6 4., Bb5 8, G5 2 |
            F5 4., G5 8, Bb5 4, D6 | E6 4., D6 8, C6 4, G5 | A5 4., F5 8, D5 4, F5 | E5 2, C#5 4, E5 |
            D6 4., C6 8, Bb5 4, G5 | G5 4., Bb5 8, Eb6 4, D6 | F6 2, D6 4, Bb5 | C#6 2., E6 4 |
            D6 8, C6, Bb5, A5, G5 4, Bb5 | A5 8, G5, F5, E5, C#5 4, E5 | D5 8, F5, Bb5, D6, F6 4, E6 8, D6 | C#6 4., A5 8, G5 4, E5 |`,
        },
        harm: {
          wave: 'sq50', vol: 0.055, gate: 0.7, pan: 0.25, arpSpeed: 0.03,
          notes: `
            A4 8, r, A4, r, Bb4, r, Bb4, r | A4 2, A4 16, Bb4, B4, C5, C#5 4 |
            [$Dm 8]x8 | [$Eb 8]x8 | [$Dm 8]x8 | [$C 8]x8 | [$Bb 8]x8 | [$C 8]x8 | [$Dm 8]x8 | [$A 8]x8 |
            [$Gm 8]x8 | [$Eb 8]x8 | [$Bb 8]x8 | [$A 8]x8 | [$Gm 8]x8 | [$A 8]x8 | [$Bb 8]x8 | [$A 8]x8 |`,
        },
        bass: {
          wave: 'tri', vol: 0.34, gate: 0.75,
          notes: `
            D2 8, r, D2, r, Eb2, r, Eb2, r | D2 16, D2, D2, D2, D2, D2, D2, D2, A2 8, A2, A2, A2 |
            $bDm $bEb $bDm $bC $bBb $bC $bDm $bA
            $bGm $bEb $bBb $bA $bGm $bA $bBb $bA`,
        },
        drum: {
          wave: 'noise', vol: 0.42,
          notes: `
            k+c 8, r, k, r, k+c 8, r, k, r | k 16, s, s, s, k, s, s, s, s, s, s, s, s, s, s, s |
            [ k+c 8, k, h, h, s 4, h 8, k |
              [k 8, k, h, h, s 4, h 8, k |]x2
              k 8, k, s 16, s, s, s, tl 8, tl, tl 16, tl, s 8 | ]x4`,
        },
      },
    },

    // ---- 勝利: ファンファーレ（4小節）→ ループ（8小節） --------------
    victory: {
      tempo: 128,
      loopBar: 4,
      defs: { C: '(E4 G4 C5)', Am: '(E4 A4 C5)', F: '(F4 A4 C5)', G: '(D4 G4 B4)', Dm: '(D4 F4 A4)' },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, vib: { depth: 12, rate: 5.5, delay: 0.2 }, echo: { delay: '16', vol: 0.18 },
          notes: `
            G4 16, C5, E5, G5, C6 4, G5 8, C6, E6 4 | D6 8., C6 16, D6 8, E6, D6 2 | C6 8, A5, C6, F6, G6 4., F6 8 | E6 2., r 4 |
            E5 8, G5, C6 4, B5 8, C6, D6 4 | C6 4., A5 8, E5 2 | F5 8, A5, C6 4, Bb5 8, A5, G5 4 | A5 8, G5, F5, E5, D5 2 |
            E5 8, G5, C6 4, D6 8, E6, G6 4 | E6 4., D6 8, C6 4, A5 | F5 8, A5, D6 4, B5 8, G5, F5 4 | C6 2, G5 8, E5, D5 4 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.065, gate: 0.6, pan: -0.3, arpSpeed: 0.03,
          notes: `
            E4 16, G4, C5, E5, G5 4, E5 8, G5, C6 4 | B5 8., A5 16, B5 8, C6, B5 2 | A5 8, F5, A5, C6, D6 4., B5 8 | C6 2., r 4 |
            [r 8, $C 8]x4 | [r 8, $Am 8]x4 | [r 8, $F 8]x4 | [r 8, $G 8]x4 |
            [r 8, $C 8]x4 | [r 8, $Am 8]x4 | [r 8, $Dm 8]x2, [r 8, $G 8]x2 | [r 8, $C 8]x4 |`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.75,
          notes: `
            C3 8, r, C3, r, C3 4, C2 | G2 8, r, G2, r, G2 4, G1 | F2 4, F3, G2, G3 | C3 8, G2, E2, G2, C2 4, r |
            C3 4, G2 8, C3, E3 4, G2 | A2 4, E2 8, A2, C3 4, E2 | F2 4, C3 8, F2, F3 4, C3 | G2 4, D3 8, G2, B2 4, D3 |
            C3 4, G2 8, C3, E3 4, G2 | A2 4, E2 8, A2, C3 4, E2 | D3 4, A2, G2, B2 | C3 4, G2, C3 8, D3, E3, G2 |`,
        },
        drum: {
          wave: 'noise', vol: 0.34,
          notes: `
            k+c 4, r 8, k, s 4, r | k 4, r 8, k, s 4, s 8, s | k 8, s, k, s, s 16, s, s, s, th, th, tl, tl | k+c 4, r, r 2 |
            [k 8, h, s, h, k, h, s, h |]x7
            k 8, h, s, h, s 16, s, s, s, th 8, tl |`,
        },
      },
    },

    // ---- ガチャ: ワクワク（A dur、跳ねるリズム） ---------------------
    gacha: {
      tempo: 136,
      defs: {
        A: '(A4 C#5 E5)', E: '(G#4 B4 E5)', 'F#m': '(A4 C#5 F#5)', D: '(A4 D5 F#5)', Bm: '(B4 D5 F#5)', E7: '(G#4 D5 E5)',
        pA: '[$A 8, r 16, $A, r 8, $A]x2 |', pE: '[$E 8, r 16, $E, r 8, $E]x2 |', 'pF#m': '[$F#m 8, r 16, $F#m, r 8, $F#m]x2 |',
        pD: '[$D 8, r 16, $D, r 8, $D]x2 |', pBm: '[$Bm 8, r 16, $Bm, r 8, $Bm]x2 |', pE7: '[$E7 8, r 16, $E7, r 8, $E7]x2 |',
        bA: '[A2 8, A3]x4 |', bE: '[E2 8, E3]x4 |', 'bF#m': '[F#2 8, F#3]x4 |', bD: '[D2 8, D3]x4 |', bBm: '[B1 8, B2]x4 |',
      },
      tracks: {
        lead: {
          wave: 'sq25', vol: 0.15, gate: 0.8, vib: { depth: 10, rate: 6, delay: 0.2 }, echo: { delay: '16', vol: 0.2 },
          notes: `
            E5 8, A5, C#6, A5, B5 16, C#6, B5 8, A5, E5 | G#5 8, B5, E6 4, D#6 8, E6, B5 4 |
            A5 8, C#6, F#6 4, E6 8, C#6, A5, F#5 | A5 4, F#5 8, A5, D6 4, r 8, E6 16, F#6 |
            E6 8, C#6, A5, C#6, E6 16, F#6, E6 8, C#6, A5 | B5 8, G#5, E5, G#5, B5 4, E6 |
            F#6 8, E6, D6, C#6, D6 4, A5 | B5 8, C#6, D6, E6, G#6 4, r 8, E5 16, G#5 |
            A5 8, A5 16, A5, C#6 8, A5, F#5 4, C#6 | D6 8, D6 16, D6, F#6 8, D6, A5 4, F#6 |
            E6 8, C#6, A5, C#6, E6 4, A6 | G#6 4., F#6 8, E6 4, B5 |
            C#6 8, F#6, E6, C#6, A5 4, C#6 | D6 8, F#6, E6, D6, A5 4, F#5 |
            B5 8, D6, F#6, D6, B5 16, C#6, D6 8, E6, F#6 | G#6 8, F#6, E6, D6, B5 16, C#6, D6, E6, E5 8, G#5 |`,
        },
        harm: {
          wave: 'sq12', vol: 0.065, gate: 0.5, pan: 0.3, arpSpeed: 0.028,
          notes: `
            $pA $pE $pF#m $pD $pA $pE $pD $pE
            $pF#m $pD $pA $pE $pF#m $pD $pBm $pE7`,
        },
        bass: {
          wave: 'tri', vol: 0.3, gate: 0.7,
          notes: `
            $bA $bE $bF#m $bD $bA $bE $bD $bE
            $bF#m $bD $bA $bE $bF#m $bD $bBm $bE`,
        },
        drum: {
          wave: 'noise', vol: 0.36,
          notes: `
            [ k+c 8, h 16, h, s 8, h, k 16, k, h 8, s, h 16, h |
              [k 8, h 16, h, s 8, h, k 16, k, h 8, s, h 16, h |]x6
              k 8, h 16, h, s 8, h, s 16, s, s, s, cl 8, cl | ]x2`,
        },
      },
    },
  };

  // ==================================================================
  // 効果音
  // ==================================================================
  const SFX = {
    select: { parts: [{ wave: 'sq25', notes: 'E6 64', tempo: 120, vol: 0.26, gate: 1, env: [0.001, 0.02, 0.6, 0.01] }] },
    confirm: { parts: [{ wave: 'sq25', notes: 'B5 64, E6 32', tempo: 120, vol: 0.26, gate: 0.95, env: [0.001, 0.05, 0.7, 0.02] }] },
    cancel: { parts: [{ wave: 'sq50', notes: 'E5 64, A4 32', tempo: 120, vol: 0.24, gate: 0.95, env: [0.001, 0.05, 0.7, 0.02] }] },
    bump: {
      parts: [
        { wave: 'sq50', freq: [150, 60], dur: 0.08, vol: 0.26 },
        { wave: 'noise', dur: 0.06, vol: 0.25, filter: 'lowpass', freq: 500 },
      ],
    },
    door: {
      parts: [
        { wave: 'noise', dur: 0.08, vol: 0.28, filter: 'bandpass', freq: [700, 2200], q: 1.5 },
        { wave: 'noise', at: 0.1, dur: 0.2, vol: 0.3, filter: 'lowpass', freq: [2500, 250] },
        { wave: 'sq50', at: 0.1, freq: [220, 110], dur: 0.1, vol: 0.12 },
      ],
    },
    encounter: {
      parts: [
        { wave: 'sq25', freq: [196, 1568], dur: 0.2, vol: 0.18 },
        { wave: 'sq12', freq: [294, 2349], dur: 0.2, vol: 0.09 },
        { wave: 'noise', dur: 0.3, vol: 0.14, filter: 'highpass', freq: [800, 8000], shape: 'swell' },
        { wave: 'sq25', at: 0.22, notes: 'A6 64, r, A6, r, A6 32', tempo: 110, vol: 0.16 },
      ],
    },
    hit: {
      parts: [
        { wave: 'noise', dur: 0.14, vol: 0.5, filter: 'lowpass', freq: [7000, 300] },
        { wave: 'sq50', freq: [420, 60], dur: 0.1, vol: 0.26 },
      ],
    },
    hitSuper: {
      parts: [
        { wave: 'noise', dur: 0.22, vol: 0.55, filter: 'lowpass', freq: [10000, 250] },
        { wave: 'sq50', freq: [700, 50], dur: 0.18, vol: 0.28 },
        { wave: 'sq25', freq: [1400, 180], dur: 0.12, vol: 0.14 },
        { wave: 'noise', at: 0.07, dur: 0.14, vol: 0.32, filter: 'highpass', freq: 2500 },
        { wave: 'tri', freq: [160, 40], dur: 0.25, vol: 0.4 },
      ],
    },
    hitWeak: {
      parts: [
        { wave: 'noise', dur: 0.07, vol: 0.3, filter: 'lowpass', freq: [2500, 400] },
        { wave: 'sq50', freq: [260, 140], dur: 0.06, vol: 0.14 },
      ],
    },
    miss: {
      parts: [
        { wave: 'noise', dur: 0.24, vol: 0.5, filter: 'bandpass', freq: [5000, 500], q: 2.5, shape: 'swell' },
      ],
    },
    faint: {
      parts: [
        { wave: 'sq50', freq: [880, 110], dur: 0.6, vol: 0.22, vib: { depth: 80, rate: 14, delay: 0 } },
        { wave: 'tri', freq: [220, 40], dur: 0.7, vol: 0.3 },
      ],
    },
    levelup: {
      duck: 1.2,
      parts: [
        { wave: 'sq25', notes: 'C6 16, E6, G6, C7 8, r 16, B6, C7 4', tempo: 160, vol: 0.18, echo: { delay: '32', vol: 0.3 } },
        { wave: 'sq12', notes: 'E5 16, G5, C6, E6 8, r 16, D6, E6 4', tempo: 160, vol: 0.1 },
        { wave: 'tri', notes: 'C4 8, G3 16, C4 8, r 16, G3 16, C3 4', tempo: 160, vol: 0.3 },
      ],
    },
    heal: {
      duck: 1.8,
      parts: [
        { wave: 'sq25', notes: 'E6 16, G6, C7, G6, F6, A6, D7, A6, G6 4, E7 4', tempo: 150, vol: 0.14, env: [0.003, 0.2, 0.5, 0.1], echo: { delay: '16', vol: 0.35 } },
        { wave: 'tri', notes: 'C4 4, F3 4, G3 4, C4 4', tempo: 150, vol: 0.28 },
        { wave: 'sq12', notes: 'r 2, B5 4, (C6 E6 G6) 4', tempo: 150, vol: 0.07, arpSpeed: 0.03 },
      ],
    },
    statUp: {
      parts: [
        { wave: 'sq25', freq: [330, 1320], dur: 0.12, vol: 0.16, repeat: 3, every: 0.1 },
        { wave: 'sq12', at: 0.05, freq: [660, 2640], dur: 0.12, vol: 0.07, repeat: 3, every: 0.1 },
      ],
    },
    statDown: {
      parts: [
        { wave: 'sq25', freq: [1320, 330], dur: 0.12, vol: 0.16, repeat: 3, every: 0.1 },
        { wave: 'sq12', at: 0.05, freq: [990, 247], dur: 0.12, vol: 0.07, repeat: 3, every: 0.1 },
      ],
    },
    win: {
      duck: 2.0,
      parts: [
        { wave: 'sq25', notes: 'G5 16, A5, B5 8, D6 8, B5 16, D6 16, G6 4.', tempo: 150, vol: 0.18, vib: { depth: 15, rate: 6, delay: 0.25 } },
        { wave: 'sq12', notes: 'D5 16, F#5, G5 8, B5 8, G5 16, B5 16, D6 4.', tempo: 150, vol: 0.1 },
        { wave: 'tri', notes: 'G3 8, D3, G3, D3, G2 4.', tempo: 150, vol: 0.3 },
        { wave: 'noise', notes: 'k 8, s, k, s 16, s, k+c 4.', tempo: 150, vol: 0.35 },
      ],
    },
    lose: {
      duck: 2.0,
      parts: [
        { wave: 'sq50', notes: 'E5 8, D#5, D5, C#5 4.', tempo: 100, vol: 0.16, vib: { depth: 20, rate: 5, delay: 0.3 } },
        { wave: 'tri', notes: 'A3 8, G#3, G3, F#3 4.', tempo: 100, vol: 0.28 },
      ],
    },
    run: {
      parts: [
        { wave: 'noise', dur: 0.05, vol: 0.22, filter: 'bandpass', freq: 2500, q: 1, repeat: 4, every: 0.075 },
        { wave: 'sq50', at: 0.02, freq: [600, 150], dur: 0.28, vol: 0.09 },
      ],
    },
    coin: {
      parts: [
        { wave: 'sq12', notes: 'E6 64, A6 64, E7 16', tempo: 150, vol: 0.24, env: [0.001, 0.15, 0.5, 0.08], echo: { delay: '32', vol: 0.35 } },
        { wave: 'noise', buf: 'metal', at: 0.04, dur: 0.18, vol: 0.09, filter: 'highpass', freq: 7000 },
      ],
    },
    error: {
      parts: [
        { wave: 'sq50', notes: 'D#3 16, r 32, D#3 8', tempo: 150, vol: 0.22 },
        { wave: 'sq25', notes: 'E3 16, r 32, E3 8', tempo: 150, vol: 0.13 },
      ],
    },
    trainerSpot: {
      parts: [
        { wave: 'sq25', notes: 'E6 64, G#6, B6, E7 16', tempo: 140, vol: 0.18 },
        { wave: 'noise', dur: 0.1, vol: 0.14, filter: 'highpass', freq: 4000 },
        { wave: 'tri', notes: 'E4 32', tempo: 140, vol: 0.3 },
      ],
    },
    gachaRoll: {
      parts: [
        { wave: 'noise', dur: 0.03, vol: 0.18, filter: 'bandpass', freq: [1500, 3000], q: 2, repeat: 18, every: 0.065, crescendo: [0.5, 1.4] },
        { wave: 'sq12', freq: [130, 1046], dur: 1.2, vol: 0.09, vib: { depth: 40, rate: 11, delay: 0 } },
        { wave: 'tri', freq: [65, 262], dur: 1.2, vol: 0.2 },
        { wave: 'noise', at: 1.18, dur: 0.18, vol: 0.25, filter: 'highpass', freq: 1500 },
      ],
    },
    gachaN: {
      parts: [{ wave: 'sq25', notes: 'E5 32, A5 16', tempo: 120, vol: 0.22, env: [0.002, 0.15, 0.4, 0.08] }],
    },
    gachaR: {
      parts: [
        { wave: 'sq25', notes: 'A5 32, C#6, E6 8', tempo: 130, vol: 0.18, echo: { delay: '16', vol: 0.35 } },
        { wave: 'tri', notes: 'A3 8.', tempo: 130, vol: 0.25 },
      ],
    },
    gachaSR: {
      parts: [
        { wave: 'sq25', notes: 'E5 64, G#5, B5, E6, G#6, B6 8', tempo: 120, vol: 0.18, echo: { delay: '32', vol: 0.4 } },
        { wave: 'sq12', at: 0.15, notes: '(E6 G#6 B6) 4', tempo: 120, vol: 0.07, arpSpeed: 0.03 },
        { wave: 'tri', notes: 'E3 16, B3 8.', tempo: 120, vol: 0.28 },
        { wave: 'noise', buf: 'metal', at: 0.15, dur: 0.4, vol: 0.07, filter: 'highpass', freq: 8000 },
      ],
    },
    gachaSSR: {
      duck: 1.8,
      parts: [
        { wave: 'sq25', notes: 'G5 16, C6, E6 8, G6 8, E6 16, G6 16, C7 4.', tempo: 150, vol: 0.18, echo: { delay: '16', vol: 0.3 } },
        { wave: 'sq12', notes: 'E5 16, G5, C6 8, E6 8, C6 16, E6 16, G6 4.', tempo: 150, vol: 0.1 },
        { wave: 'tri', notes: 'C3 8, r 16, C3 16, C3 8, G2 8, C3 4.', tempo: 150, vol: 0.3 },
        { wave: 'noise', notes: 'k+c 8, s 16, s, k 8, s, k+c 4.', tempo: 150, vol: 0.35 },
        { wave: 'noise', buf: 'metal', at: 0.45, dur: 0.7, vol: 0.07, filter: 'highpass', freq: 8000 },
      ],
    },
    gachaUR: {
      duck: 3.0,
      parts: [
        { wave: 'sq25', freq: [220, 1760], dur: 0.5, vol: 0.15 },
        { wave: 'sq12', freq: [330, 2637], dur: 0.5, vol: 0.08 },
        { wave: 'noise', dur: 0.5, vol: 0.12, filter: 'highpass', freq: [600, 9000], shape: 'swell' },
        { wave: 'sq25', at: 0.52, notes: 'E6 16, F6, G6 8, C7 8, B6 16, C7 16, (C7 E7 G7) 2', tempo: 140, vol: 0.18, arpSpeed: 0.03, echo: { delay: '16', vol: 0.3 }, vib: { depth: 12, rate: 6, delay: 0.3 } },
        { wave: 'sq50', at: 0.52, notes: 'G5 16, A5, B5 8, E6 8, D6 16, E6 16, (E6 G6 C7) 2', tempo: 140, vol: 0.09, arpSpeed: 0.04 },
        { wave: 'tri', at: 0.52, notes: 'C3 8, G3, C4, G3 16, C4 16, C3 2', tempo: 140, vol: 0.3 },
        { wave: 'noise', at: 0.52, notes: 'k+c 8, s 16, s, k 8, s 16, s, k+c 2', tempo: 140, vol: 0.38 },
        { wave: 'noise', buf: 'metal', at: 1.0, dur: 0.08, vol: 0.08, filter: 'highpass', freq: 9000, repeat: 10, every: 0.12 },
      ],
    },
  };

  // ==================================================================
  // 小物
  // ==================================================================
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v, def) { const n = Number(v); return (v === undefined || v === null || v === '' || !isFinite(n)) ? def : n; }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function midiName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  function waveClass(w) { return w === 'tri' ? 'tri' : (w === 'noise' ? 'noise' : 'sq'); }
  const warned = {};
  function warnOnce(key, ...args) {
    if (warned[key]) return;
    warned[key] = true;
    try { console.warn('[audio]', ...args); } catch (e) { /* 無視 */ }
  }

  // ==================================================================
  // パーサ
  // ==================================================================

  // 長さ記法 → tick（不正なら NaN）
  function parseDur(str) {
    if (typeof str === 'number') return (str > 0 && Number.isInteger(str)) ? str : NaN;
    const parts = String(str).split('+');
    let total = 0;
    for (const p of parts) {
      const m = /^(\d+)(\.{0,2})(t?)$/.exec(p.trim());
      if (!m || !DUR_BASE[m[1]]) return NaN;
      let t = DUR_BASE[m[1]];
      if (m[2] === '.') t *= 1.5;
      else if (m[2] === '..') t *= 1.75;
      if (m[3]) t = t * 2 / 3;
      if (!Number.isInteger(t)) return NaN;
      total += t;
    }
    return total;
  }

  // 'C#5' → MIDI 番号（不正なら NaN）
  function parsePitch(s) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(s);
    if (!m) return NaN;
    let n = 12 * (Number(m[3]) + 1) + SEMI[m[1]];
    if (m[2] === '#') n += 1;
    else if (m[2] === 'b') n -= 1;
    return n;
  }

  // マクロ（$名前）の展開
  function expandMacros(src, defs, errs, where) {
    let out = src;
    for (let depth = 0; depth < 6; depth++) {
      let changed = false;
      out = out.replace(/\$([A-Za-z_][A-Za-z0-9_#]*)/g, (m, k) => {
        if (defs && Object.prototype.hasOwnProperty.call(defs, k)) { changed = true; return ' ' + String(defs[k]) + ' '; }
        errs.push(where + ': 未定義のマクロ $' + k);
        return ' ';
      });
      if (!changed) break;
    }
    if (out.indexOf('$') >= 0) errs.push(where + ': マクロの入れ子が深すぎます');
    return out;
  }

  // 文字列 → トークン列
  function tokenize(src, errs, where) {
    const out = [];
    let buf = '';
    const flush = () => { const t = buf.trim(); if (t) out.push({ type: 'ev', text: t }); buf = ''; };
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === ',' || ch === '\n' || ch === '\r' || ch === ';') { flush(); continue; }
      if (ch === '|') { flush(); out.push({ type: 'bar' }); continue; }
      if (ch === '[') { flush(); out.push({ type: 'open' }); continue; }
      if (ch === ']') {
        flush();
        const m = /^\s*x\s*(\d+)/.exec(src.slice(i + 1));
        if (m) { i += m[0].length; out.push({ type: 'close', n: Number(m[1]) }); }
        else { errs.push(where + ': ] の後に繰り返し回数（x2 など）がありません'); out.push({ type: 'close', n: 1 }); }
        continue;
      }
      if (ch === '(') {
        const k = src.indexOf(')', i);
        if (k < 0) { errs.push(where + ': ( が閉じていません'); buf += src.slice(i); break; }
        buf += src.slice(i, k + 1);
        i = k;
        continue;
      }
      buf += ch;
    }
    flush();
    return out;
  }

  // 1イベントの解釈（長さの引き継ぎは state.dur）
  function parseEvent(text, isDrum, state, errs, where) {
    let head, durStr;
    const am = /^\(([^)]*)\)\s*(\S*)\s*$/.exec(text);
    let ev;
    if (am) {
      durStr = am[2];
      const names = am[1].trim().split(/\s+/).filter(Boolean);
      if (isDrum) { errs.push(where + ': ドラムトラックに和音 "' + text + '" は使えません'); return null; }
      if (names.length < 2 || names.length > 6) { errs.push(where + ': 和音 "' + text + '" は 2〜6 音で書いてください'); return null; }
      const ms = names.map(parsePitch);
      if (ms.some((m) => !isFinite(m))) { errs.push(where + ': 和音 "' + text + '" に不正な音名があります'); return null; }
      const out = ms.find((m) => m < MIDI_MIN || m > MIDI_MAX);
      if (out !== undefined) errs.push(where + ': 音域外の音 ' + midiName(out) + '（' + midiName(MIDI_MIN) + '〜' + midiName(MIDI_MAX) + '）');
      ev = { kind: 'arp', ms };
    } else {
      const parts = text.split(/\s+/);
      if (parts.length > 2) { errs.push(where + ': "' + text + '" を解釈できません（区切りの , が抜けていませんか）'); return null; }
      head = parts[0];
      durStr = parts[1] || '';
      if (head === 'r') ev = { kind: 'rest' };
      else if (isDrum) {
        const names = head.split('+');
        const bad = names.filter((n) => !DRUMS[n]);
        if (bad.length) { errs.push(where + ': 不明なドラム "' + bad.join('+') + '"（使えるのは ' + Object.keys(DRUMS).join(' ') + '）'); return null; }
        ev = { kind: 'drum', dr: names };
      } else {
        const m = parsePitch(head);
        if (!isFinite(m)) { errs.push(where + ': 不正な音名 "' + head + '"'); return null; }
        if (m < MIDI_MIN || m > MIDI_MAX) errs.push(where + ': 音域外の音 ' + head + '（' + midiName(MIDI_MIN) + '〜' + midiName(MIDI_MAX) + '）');
        ev = { kind: 'note', m };
      }
    }
    if (durStr) {
      const d = parseDur(durStr);
      if (!isFinite(d)) { errs.push(where + ': 不正な長さ "' + durStr + '"（' + text + '）'); return null; }
      state.dur = d;
    }
    ev.d = state.dur;
    return ev;
  }

  // ノート列 → { events:[{t,d,m|ms|dr}], ticks, bars }
  function parseNotes(src, opts, errs, warns, where) {
    const isDrum = !!opts.drum;
    const barTicks = opts.barTicks || 0;
    let text = String(src == null ? '' : src).replace(/\/\/[^\n]*/g, '');
    text = expandMacros(text, opts.defs, errs, where);
    const tokens = tokenize(text, errs, where);

    // 長さの引き継ぎは「書いた順」で解決してから、繰り返しを展開する
    const state = { dur: TPQ };
    const root = [];
    const stack = [{ list: root, node: null }];
    for (const tok of tokens) {
      const top = stack[stack.length - 1];
      if (tok.type === 'ev') {
        const ev = parseEvent(tok.text, isDrum, state, errs, where);
        if (ev) top.list.push(ev);
      } else if (tok.type === 'bar') {
        top.list.push({ kind: 'bar' });
      } else if (tok.type === 'open') {
        const node = { kind: 'rep', n: 1, children: [] };
        top.list.push(node);
        stack.push({ list: node.children, node });
      } else if (tok.type === 'close') {
        if (stack.length === 1) { errs.push(where + ': 対応する [ がない ] があります'); continue; }
        const n = tok.n;
        if (!(n >= 1 && n <= 64)) errs.push(where + ': 繰り返し回数 x' + n + ' は 1〜64 にしてください');
        stack.pop().node.n = clamp(n || 1, 1, 64);
      }
    }
    if (stack.length > 1) errs.push(where + ': [ が閉じていません');

    const flat = [];
    let overflow = false;
    (function expand(list) {
      for (const node of list) {
        if (flat.length > 20000) { overflow = true; return; }
        if (node.kind === 'rep') { for (let i = 0; i < node.n; i++) expand(node.children); }
        else flat.push(node);
      }
    })(root);
    if (overflow) errs.push(where + ': ノート数が多すぎます（繰り返しの回数を確認してください）');

    const events = [];
    let tick = 0, lastBar = 0, barNo = 1, hadBar = false;
    for (const it of flat) {
      if (it.kind === 'bar') {
        const seg = tick - lastBar;
        if (barTicks && seg !== barTicks) {
          errs.push(where + ': ' + barNo + '小節目の長さが ' + (seg / TPQ) + '拍です（' + (barTicks / TPQ) + '拍のはず）');
        }
        hadBar = true;
        lastBar = tick;
        barNo++;
        continue;
      }
      if (it.kind !== 'rest') {
        const e = { t: tick, d: it.d };
        if (it.kind === 'note') e.m = it.m;
        else if (it.kind === 'arp') e.ms = it.ms;
        else if (it.kind === 'drum') e.dr = it.dr;
        events.push(e);
      }
      tick += it.d;
    }
    if (barTicks && hadBar && tick > lastBar && tick - lastBar !== barTicks) {
      errs.push(where + ': 最後の小節（' + barNo + '小節目）の長さが ' + ((tick - lastBar) / TPQ) + '拍です');
    }
    if (barTicks && !hadBar && tick % barTicks !== 0) {
      warns.push(where + ': 全体の長さが小節の整数倍ではありません');
    }
    return { events, ticks: tick, bars: barTicks ? tick / barTicks : 0 };
  }

  // トラック定義 → 再生用トラック
  function compileTrack(name, tdef, songOpts, errs, warns, where) {
    if (!isObj(tdef)) { errs.push(where + ': トラック定義がオブジェクトではありません'); return null; }
    const wave = tdef.wave || 'sq50';
    if (WAVES.indexOf(wave) < 0) { errs.push(where + ': 不明な波形 "' + wave + '"（' + WAVES.join(' ') + '）'); return null; }
    const base = TRACK_DEFAULTS[waveClass(wave)];
    const vol = num(tdef.vol, base.vol);
    if (!(vol >= 0 && vol <= 1)) errs.push(where + ': vol は 0〜1 にしてください（' + tdef.vol + '）');
    const gate = num(tdef.gate, base.gate);
    if (!(gate > 0 && gate <= 1)) errs.push(where + ': gate は 0〜1 にしてください');
    let env = base.env;
    if (tdef.env !== undefined) {
      if (!Array.isArray(tdef.env) || tdef.env.length !== 4 || tdef.env.some((v) => !isFinite(Number(v)) || Number(v) < 0)) {
        errs.push(where + ': env は [attack, decay, sustain, release] の 0 以上の数値4つです');
      } else {
        env = tdef.env.map(Number);
        if (env[2] > 1) errs.push(where + ': env の sustain は 0〜1 です');
        if (env[0] > 3 || env[1] > 5 || env[3] > 5) warns.push(where + ': env の値が大きすぎます');
      }
    }
    const pan = clamp(num(tdef.pan, 0), -1, 1);
    const arpSpeed = num(tdef.arpSpeed, base.arpSpeed);
    if (!(arpSpeed >= 0.01 && arpSpeed <= 0.5)) errs.push(where + ': arpSpeed は 0.01〜0.5 秒にしてください');
    const detune = num(tdef.detune, 0);
    let vib = null;
    if (tdef.vib) {
      if (!isObj(tdef.vib)) errs.push(where + ': vib は { depth, rate, delay } です');
      else {
        vib = { depth: num(tdef.vib.depth, 0), rate: num(tdef.vib.rate, 5), delay: num(tdef.vib.delay, 0) };
        if (!(vib.depth >= 0 && vib.depth <= 1200)) errs.push(where + ': vib.depth（セント）は 0〜1200');
        if (!(vib.rate > 0 && vib.rate <= 40)) errs.push(where + ': vib.rate（Hz）は 0〜40');
      }
    }
    let echoTicks = 0, echoVol = 0;
    if (tdef.echo) {
      if (!isObj(tdef.echo)) errs.push(where + ': echo は { delay: \'8\', vol: 0.3 } です');
      else {
        echoTicks = parseDur(tdef.echo.delay === undefined ? '8' : tdef.echo.delay);
        echoVol = num(tdef.echo.vol, 0.3);
        if (!isFinite(echoTicks)) { errs.push(where + ': echo.delay "' + tdef.echo.delay + '" が不正です'); echoTicks = 0; }
        if (!(echoVol >= 0 && echoVol <= 1)) errs.push(where + ': echo.vol は 0〜1');
      }
    }
    if (typeof tdef.notes !== 'string') { errs.push(where + ': notes（ノート列の文字列）がありません'); return null; }

    const isDrum = wave === 'noise';
    const res = parseNotes(tdef.notes, { drum: isDrum, barTicks: songOpts.barTicks, defs: songOpts.defs }, errs, warns, where);
    let lo = Infinity, hi = -Infinity, count = 0;
    for (const e of res.events) {
      count++;
      const ms = e.ms || (e.m !== undefined ? [e.m] : null);
      if (!ms) continue;
      for (const m of ms) {
        if (m < lo) lo = m;
        if (m > hi) hi = m;
      }
    }
    if (wave === 'tri' && hi > 96) warns.push(where + ': 三角波で ' + midiName(hi) + ' は高すぎるかもしれません');
    if (!res.events.length) warns.push(where + ': 音が1つもありません');
    return {
      name, wave, vol, gate, env, pan, arpSpeed, detune, vib, echoTicks, echoVol, isDrum,
      events: res.events, ticks: res.ticks, bars: res.bars, loopIdx: 0,
      count, range: isFinite(lo) ? [lo, hi] : null,
    };
  }

  // 曲定義 → 再生用データ
  function compileSong(name, def) {
    const errors = [], warnings = [];
    const where = 'BGM ' + name;
    const song = { name, errors, warnings, tracks: [], ok: false };
    if (!isObj(def)) { errors.push(where + ': 定義がオブジェクトではありません'); return song; }
    const tempo = num(def.tempo, 120);
    if (!(tempo >= 40 && tempo <= 300)) errors.push(where + ': tempo は 40〜300 にしてください（' + def.tempo + '）');
    const beats = num(def.beats, 4);
    if (!(Number.isInteger(beats) && beats >= 1 && beats <= 12)) errors.push(where + ': beats は 1〜12 の整数です');
    const barTicks = clamp(Math.round(beats), 1, 12) * TPQ;
    const defs = isObj(def.defs) ? def.defs : null;
    if (!isObj(def.tracks) || !Object.keys(def.tracks).length) { errors.push(where + ': tracks がありません'); return song; }
    for (const tn of Object.keys(def.tracks)) {
      const tr = compileTrack(tn, def.tracks[tn], { barTicks, defs }, errors, warnings, where + ' / ' + tn);
      if (tr) song.tracks.push(tr);
    }
    let total = 0;
    for (const tr of song.tracks) total = Math.max(total, tr.ticks);
    for (const tr of song.tracks) {
      if (tr.ticks !== total) {
        errors.push(where + ' / ' + tr.name + ': 長さ ' + (tr.ticks / barTicks) + '小節 が他のトラック（' + (total / barTicks) + '小節）と違います');
      }
    }
    const bars = total / barTicks;
    const loopBar = num(def.loopBar, 0);
    if (!(Number.isInteger(loopBar) && loopBar >= 0 && loopBar < Math.max(1, bars))) {
      errors.push(where + ': loopBar ' + def.loopBar + ' が範囲外です（0〜' + (Math.ceil(bars) - 1) + '）');
    }
    const loopTick = clamp(Math.round(loopBar), 0, Math.max(0, Math.ceil(bars) - 1)) * barTicks;
    for (const tr of song.tracks) {
      let idx = tr.events.findIndex((e) => e.t >= loopTick);
      if (idx < 0) idx = tr.events.length;
      tr.loopIdx = idx;
      const cross = tr.events.find((e) => e.t < loopTick && e.t + e.d > loopTick);
      if (cross) warnings.push(where + ' / ' + tr.name + ': ループ位置をまたぐ音があります');
    }
    const loopBars = bars - loopTick / barTicks;
    if (total > 0 && (loopBars < 8 || loopBars > 16)) warnings.push(where + ': ループ部が ' + loopBars + '小節です（目安 8〜16）');
    Object.assign(song, {
      tempo, beats, barTicks, spt: 60 / tempo / TPQ, totalTicks: total, loopTick, bars, loopBar,
      loopBars, seconds: total * 60 / tempo / TPQ, loop: def.loop !== false,
      ok: errors.length === 0 && total > 0,
    });
    return song;
  }

  // 効果音定義 → 再生用データ
  function compileSfx(name, def) {
    const errors = [], warnings = [];
    const where = 'SFX ' + name;
    const sfx = { name, errors, warnings, parts: [], length: 0, duck: 0, vol: 1, ok: false };
    const list = Array.isArray(def) ? def : (isObj(def) ? def.parts : null);
    if (!Array.isArray(list) || !list.length) { errors.push(where + ': parts がありません'); return sfx; }
    sfx.duck = clamp(num(def.duck, 0), 0, 10);
    sfx.vol = num(def.vol, 1);
    if (!(sfx.vol >= 0 && sfx.vol <= 2)) errors.push(where + ': vol は 0〜2 です');
    const defs = isObj(def.defs) ? def.defs : null;
    list.forEach((p, i) => {
      const pw = where + ' #' + (i + 1);
      if (!isObj(p)) { errors.push(pw + ': パートがオブジェクトではありません'); return; }
      const wave = p.wave || 'sq50';
      if (WAVES.indexOf(wave) < 0) { errors.push(pw + ': 不明な波形 "' + wave + '"'); return; }
      const at = num(p.at, 0);
      const repeat = Math.round(num(p.repeat, 1));
      const every = num(p.every, 0);
      if (!(at >= 0 && at <= 10)) errors.push(pw + ': at は 0〜10 秒');
      if (!(repeat >= 1 && repeat <= 64)) errors.push(pw + ': repeat は 1〜64');
      if (repeat > 1 && !(every > 0)) errors.push(pw + ': repeat を使うときは every（秒）が必要です');
      let cres = null;
      if (p.crescendo !== undefined) {
        if (!Array.isArray(p.crescendo) || p.crescendo.length !== 2 || p.crescendo.some((v) => !(Number(v) >= 0 && Number(v) <= 4))) {
          errors.push(pw + ': crescendo は [最初の倍率, 最後の倍率]（0〜4）です');
        } else cres = p.crescendo.map(Number);
      }
      const common = { wave, at, repeat: clamp(repeat, 1, 64), every: Math.max(0, every), cres };
      let partLen = 0;
      if (p.notes !== undefined) {
        const tempo = num(p.tempo, 150);
        if (!(tempo >= 30 && tempo <= 600)) errors.push(pw + ': tempo は 30〜600');
        const tr = compileTrack('#' + (i + 1), p, { barTicks: 0, defs }, errors, warnings, pw);
        if (!tr) return;
        const spt = 60 / clamp(tempo, 30, 600) / TPQ;
        partLen = tr.ticks * spt + tr.echoTicks * spt + tr.env[3];
        sfx.parts.push(Object.assign(common, { type: 'seq', tr, spt }));
      } else {
        const dur = num(p.dur, 0.1);
        if (!(dur >= 0.005 && dur <= 5)) errors.push(pw + ': dur は 0.005〜5 秒');
        const vol = num(p.vol, 0.2);
        if (!(vol >= 0 && vol <= 1)) errors.push(pw + ': vol は 0〜1');
        const fr = Array.isArray(p.freq) ? p.freq.map(Number) : (p.freq !== undefined ? [Number(p.freq)] : []);
        if (wave === 'noise') {
          const filter = p.filter || null;
          if (filter && ['lowpass', 'highpass', 'bandpass'].indexOf(filter) < 0) errors.push(pw + ': filter は lowpass / highpass / bandpass');
          if (filter && (!fr.length || fr.some((f) => !(f >= 20 && f <= 20000)))) errors.push(pw + ': filter の freq は 20〜20000');
          const buf = p.buf || 'white';
          if (buf !== 'white' && buf !== 'metal') errors.push(pw + ': buf は white / metal');
          const shape = p.shape || 'decay';
          if (['decay', 'swell', 'hold'].indexOf(shape) < 0) errors.push(pw + ': shape は decay / swell / hold');
          sfx.parts.push(Object.assign(common, {
            type: 'noise', dur, vol, filter, f0: fr[0], f1: fr.length > 1 ? fr[1] : fr[0], q: num(p.q, 1), buf, shape, rate: num(p.rate, 1),
          }));
        } else {
          if (!fr.length || fr.some((f) => !(f >= 20 && f <= 12000))) errors.push(pw + ': freq は 20〜12000 Hz（[開始, 終了] も可）');
          let env = [0.002, 0, 1, 0.02];
          if (p.env !== undefined) {
            if (!Array.isArray(p.env) || p.env.length !== 4 || p.env.some((v) => !(Number(v) >= 0))) errors.push(pw + ': env は数値4つ');
            else env = p.env.map(Number);
          }
          let vib = null;
          if (p.vib) vib = { depth: num(p.vib.depth, 0), rate: num(p.vib.rate, 5), delay: num(p.vib.delay, 0) };
          const curve = p.curve || 'exp';
          if (curve !== 'exp' && curve !== 'lin') errors.push(pw + ': curve は exp / lin');
          sfx.parts.push(Object.assign(common, {
            type: 'sweep', dur, vol, f0: fr[0], f1: fr.length > 1 ? fr[1] : fr[0], env, vib, curve,
          }));
        }
        partLen = dur + 0.05;
      }
      sfx.length = Math.max(sfx.length, at + (common.repeat - 1) * common.every + partLen);
    });
    if (sfx.length > 4) warnings.push(where + ': 長さ ' + sfx.length.toFixed(2) + '秒 は効果音としては長すぎます');
    sfx.ok = errors.length === 0;
    return sfx;
  }

  // ---- 定義の取得（GameData.bgm / GameData.sfx で上書き可） -----------
  function bgmDefs() {
    const gd = window.GameData;
    return (gd && isObj(gd.bgm)) ? Object.assign({}, BGM, gd.bgm) : BGM;
  }
  function sfxDefs() {
    const gd = window.GameData;
    return (gd && isObj(gd.sfx)) ? Object.assign({}, SFX, gd.sfx) : SFX;
  }
  const songCache = new Map();
  const sfxCache = new Map();
  function getSong(name) {
    const def = bgmDefs()[name];
    if (!def) return null;
    const c = songCache.get(name);
    if (c && c.def === def) return c.song;
    const song = compileSong(name, def);
    if (!song.ok) warnOnce('bgm:' + name, 'BGM "' + name + '" にエラーがあるため再生できません', song.errors);
    songCache.set(name, { def, song });
    return song;
  }
  function getSfx(name) {
    const def = sfxDefs()[name];
    if (!def) return null;
    const c = sfxCache.get(name);
    if (c && c.def === def) return c.sfx;
    const sfx = compileSfx(name, def);
    if (!sfx.ok) warnOnce('sfx:' + name, '効果音 "' + name + '" にエラーがあります', sfx.errors);
    sfxCache.set(name, { def, sfx });
    return sfx;
  }

  // ==================================================================
  // 音源（波形・ノイズ）
  // ==================================================================
  const banks = new WeakMap();

  // デューティ比 d の矩形波
  function pulseWave(c, duty) {
    const N = 96;
    const real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
    }
    return c.createPeriodicWave(real, imag);
  }

  // GBA の波形メモリ風: 32段・4bit の階段状三角波（階段の荒さも倍音として再現）
  function steppedTriangle(c) {
    const STEPS = 32, N = 80;
    const v = [];
    for (let k = 0; k < STEPS; k++) v.push((k < STEPS / 2 ? k : STEPS - 1 - k) - 7.5);
    const real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      let a = 0, b = 0;
      for (let k = 0; k < STEPS; k++) {
        const t0 = 2 * Math.PI * n * k / STEPS, t1 = 2 * Math.PI * n * (k + 1) / STEPS;
        a += v[k] * (Math.sin(t1) - Math.sin(t0));
        b += v[k] * (Math.cos(t0) - Math.cos(t1));
      }
      real[n] = a / (Math.PI * n);
      imag[n] = b / (Math.PI * n);
    }
    return c.createPeriodicWave(real, imag);
  }

  // LFSR ノイズ（short=true で 7bit 周期ノイズ = 金属的な音）
  function noiseBuffer(c, short, hold) {
    const len = Math.max(1024, Math.floor(c.sampleRate));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let lfsr = 0x7fff, v = 1;
    for (let i = 0; i < len; i++) {
      if (i % hold === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        if (short) lfsr = (lfsr & ~0x40) | (bit << 6);
        v = (lfsr & 1) ? 0.8 : -0.8;
      }
      d[i] = v;
    }
    return buf;
  }

  function bankFor(c) {
    let b = banks.get(c);
    if (b) return b;
    b = { waves: {}, noise: {} };
    try {
      b.waves.sq12 = pulseWave(c, 0.125);
      b.waves.sq25 = pulseWave(c, 0.25);
      b.waves.sq50 = pulseWave(c, 0.5);
      b.waves.sq75 = pulseWave(c, 0.75);
      b.waves.tri = steppedTriangle(c);
      b.noise.white = noiseBuffer(c, false, 1);
      b.noise.metal = noiseBuffer(c, true, 2);
    } catch (e) {
      warnOnce('bank', '音源の初期化に失敗しました', e);
    }
    banks.set(c, b);
    return b;
  }

  function makeOsc(c, wave) {
    const osc = c.createOscillator();
    const pw = bankFor(c).waves[wave];
    if (pw) osc.setPeriodicWave(pw);
    else osc.type = wave === 'tri' ? 'triangle' : 'square';
    return osc;
  }

  function cleanup(src, ...nodes) {
    src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* 無視 */ } } };
  }

  // ADSR（gate 秒で release 開始）。戻り値は停止時刻
  function applyEnv(param, t0, gate, vol, env) {
    const a = Math.max(0.001, env[0]), d = Math.max(0, env[1]), s = clamp(env[2], 0, 1), r = Math.max(0.005, env[3]);
    const tEnd = t0 + Math.max(0.005, gate);
    param.setValueAtTime(0, t0);
    const ta = Math.min(t0 + a, tEnd);
    param.linearRampToValueAtTime(vol, ta);
    if (d > 0 && s < 1 && ta < tEnd) param.setTargetAtTime(vol * s, ta, d / 3);
    param.setTargetAtTime(0, tEnd, r / 4);
    return tEnd + r * 1.5 + 0.01;
  }

  // 1音（和音ならアルペジオ）を鳴らす
  function playTone(c, dest, o) {
    const osc = makeOsc(c, o.wave);
    const g = c.createGain();
    const t0 = o.t;
    const f = o.freqs;
    if (f.length > 1) {
      const step = Math.max(0.01, o.arpSpeed || 0.035);
      const n = Math.min(512, Math.max(1, Math.ceil(o.gate / step)));
      for (let i = 0; i < n; i++) osc.frequency.setValueAtTime(f[i % f.length], t0 + i * step);
    } else {
      osc.frequency.setValueAtTime(f[0], t0);
      if (o.f1 && o.f1 !== f[0]) {
        if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t0 + o.gate);
        else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.gate);
      }
    }
    if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
    const stopAt = applyEnv(g.gain, t0, o.gate, o.vol, o.env);
    let lfo = null, lg = null;
    if (o.vib && o.vib.depth > 0 && o.gate > o.vib.delay + 0.04) {
      lfo = c.createOscillator();
      lfo.frequency.setValueAtTime(o.vib.rate, t0);
      lg = c.createGain();
      const vd = t0 + o.vib.delay;
      lg.gain.setValueAtTime(0, t0);
      lg.gain.setValueAtTime(0, vd);
      lg.gain.linearRampToValueAtTime(o.vib.depth, vd + 0.12);
      lfo.connect(lg);
      lg.connect(osc.detune);
      lfo.start(t0);
      lfo.stop(stopAt);
      cleanup(lfo, lg);
    }
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(stopAt);
    cleanup(osc, g);
  }

  // ノイズの一発
  function burst(c, dest, t, o) {
    const bank = bankFor(c);
    const buffer = bank.noise[o.buf || 'white'] || bank.noise.white;
    if (!buffer) return;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    if (o.rate && o.rate !== 1) src.playbackRate.setValueAtTime(o.rate, t);
    let node = src;
    let filt = null;
    if (o.filter) {
      filt = c.createBiquadFilter();
      filt.type = o.filter;
      filt.frequency.setValueAtTime(o.f0, t);
      if (o.f1 && o.f1 !== o.f0) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      filt.Q.setValueAtTime(o.q || 1, t);
      src.connect(filt);
      node = filt;
    }
    const g = c.createGain();
    const vol = Math.max(0.0001, o.vol);
    if (o.shape === 'swell') {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + o.dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    } else if (o.shape === 'hold') {
      g.gain.setValueAtTime(vol, t);
      g.gain.setValueAtTime(vol, t + o.dur * 0.8);
      g.gain.linearRampToValueAtTime(0, t + o.dur);
    } else {
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + o.dur);
    }
    node.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.8);
    src.stop(t + o.dur + 0.02);
    cleanup(src, g, filt);
  }

  // ピッチが下がる打撃音（キック・タム）
  function thump(c, dest, t, f0, f1, dur, vol) {
    const osc = makeOsc(c, 'tri');
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    cleanup(osc, g);
  }

  function playDrum(c, dest, name, t, vol) {
    switch (name) {
      case 'k':
        thump(c, dest, t, 170, 45, 0.14, vol * 1.3);
        burst(c, dest, t, { dur: 0.02, vol: vol * 0.25, filter: 'lowpass', f0: 1500 });
        break;
      case 's':
        burst(c, dest, t, { dur: 0.13, vol: vol * 0.5, filter: 'highpass', f0: 1200 });
        thump(c, dest, t, 230, 160, 0.06, vol * 0.4);
        break;
      case 'h':
        burst(c, dest, t, { dur: 0.035, vol: vol * 0.28, filter: 'highpass', f0: 7000 });
        break;
      case 'o':
        burst(c, dest, t, { dur: 0.2, vol: vol * 0.24, filter: 'highpass', f0: 6000 });
        break;
      case 'c':
        burst(c, dest, t, { dur: 0.9, vol: vol * 0.28, filter: 'highpass', f0: 3000 });
        burst(c, dest, t, { dur: 0.5, vol: vol * 0.1, filter: 'highpass', f0: 5000, buf: 'metal' });
        break;
      case 'tl':
        thump(c, dest, t, 200, 90, 0.18, vol * 0.8);
        break;
      case 'th':
        thump(c, dest, t, 300, 150, 0.14, vol * 0.7);
        break;
      case 'cl':
        for (let i = 0; i < 3; i++) {
          burst(c, dest, t + i * 0.011, { dur: i < 2 ? 0.012 : 0.1, vol: vol * 0.45, filter: 'bandpass', f0: 1500, q: 1.2 });
        }
        break;
      default:
        break;
    }
  }

  // シーケンサの1イベントを鳴らす
  function scheduleEvent(c, dest, tr, ev, time, spt, mul) {
    const k = mul === undefined ? 1 : mul;
    if (ev.dr) {
      for (const d of ev.dr) playDrum(c, dest, d, time, tr.vol * k);
      return;
    }
    const freqs = ev.ms ? ev.ms.map(mtof) : [mtof(ev.m)];
    const gate = Math.max(0.01, ev.d * spt * tr.gate);
    const o = {
      wave: tr.wave, freqs, t: time, gate, vol: tr.vol * k, env: tr.env,
      vib: tr.vib, arpSpeed: tr.arpSpeed, detune: tr.detune,
    };
    playTone(c, dest, o);
    if (tr.echoTicks && tr.echoVol > 0) {
      playTone(c, dest, Object.assign({}, o, { t: time + tr.echoTicks * spt, vol: tr.vol * tr.echoVol * k, vib: null }));
    }
  }

  function scheduleSfx(c, dest, sfx, t0) {
    let out = dest;
    if (sfx.vol !== 1) {
      out = c.createGain();
      out.gain.setValueAtTime(sfx.vol, t0);
      out.connect(dest);
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* 無視 */ } }, (sfx.length + 1) * 1000);
    }
    for (const p of sfx.parts) {
      for (let r = 0; r < p.repeat; r++) {
        const t = t0 + p.at + r * p.every;
        const k = p.cres ? p.cres[0] + (p.cres[1] - p.cres[0]) * (p.repeat > 1 ? r / (p.repeat - 1) : 1) : 1;
        if (p.type === 'seq') {
          for (const ev of p.tr.events) scheduleEvent(c, out, p.tr, ev, t + ev.t * p.spt, p.spt, k);
        } else if (p.type === 'sweep') {
          playTone(c, out, {
            wave: p.wave, freqs: [p.f0], f1: p.f1, curve: p.curve, t, gate: p.dur, vol: p.vol * k, env: p.env, vib: p.vib,
          });
        } else if (p.type === 'noise') {
          burst(c, out, t, {
            dur: p.dur, vol: p.vol * k, filter: p.filter, f0: p.f0, f1: p.f1, q: p.q, buf: p.buf, shape: p.shape, rate: p.rate,
          });
        }
      }
    }
  }

  // ==================================================================
  // シーケンサ（ルックアヘッド方式）
  // ==================================================================
  function createPlayer(c, song, dest, t0) {
    const out = c.createGain();
    out.connect(dest);
    const tracks = song.tracks.filter((tr) => tr.events.length).map((tr) => {
      let node = out;
      if (tr.pan && typeof c.createStereoPanner === 'function') {
        const p = c.createStereoPanner();
        p.pan.setValueAtTime(tr.pan, 0);
        p.connect(out);
        node = p;
      }
      return { tr, node, idx: 0, pass: 0, done: false };
    });
    const spt = song.spt, total = song.totalTicks, loopTick = song.loopTick;
    const loop = song.loop && loopTick < total;
    const passStart = (p) => (p === 0 ? t0 : t0 + total * spt + (p - 1) * (total - loopTick) * spt);
    return {
      name: song.name,
      out,
      t0,
      stopAt: 0,
      // until 秒より前の音をすべて予約する（minTime より古い音は捨てる）
      pump(until, minTime) {
        for (const st of tracks) {
          let guard = 0;
          while (!st.done && guard++ < 2000) {
            let ev = st.tr.events[st.idx];
            if (!ev) {
              if (!loop) { st.done = true; break; }
              st.pass++;
              st.idx = st.tr.loopIdx;
              ev = st.tr.events[st.idx];
              if (!ev) { st.done = true; break; }
            }
            const time = passStart(st.pass) + (ev.t - (st.pass ? loopTick : 0)) * spt;
            if (time >= until) break;
            if (time >= minTime) scheduleEvent(c, st.node, st.tr, ev, time, spt);
            st.idx++;
          }
        }
      },
    };
  }

  // ==================================================================
  // 実行時の状態
  // ==================================================================
  const S = {
    ctx: null, ctxFailed: false, master: null, bgmBus: null, sfxBus: null,
    unlocked: false, muted: false, volume: 0.6,
    want: null,        // 再生したい曲（解禁前は予約）
    player: null,      // 再生中の曲
    fading: [],        // フェードアウト中の曲
    timer: 0,
    lastSfx: {},
    duckUntil: 0,
    booted: false, subscribed: false,
  };
  const GESTURES = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'keydown', 'click'];

  function volumeGain() { return S.muted ? 0 : Math.pow(clamp(S.volume, 0, 1), 1.5) * MASTER_SCALE; }

  function applyGain() {
    if (!S.ctx || !S.master) return;
    try {
      const g = S.master.gain, now = S.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(volumeGain(), now, 0.03);
    } catch (e) { /* 無視 */ }
  }

  function ensureContext() {
    if (S.ctx) return S.ctx;
    if (S.ctxFailed) return null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (typeof AC !== 'function') { S.ctxFailed = true; return null; }
      const c = new AC({ latencyHint: 'interactive' });
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      const master = c.createGain();
      master.gain.value = volumeGain();
      master.connect(limiter);
      limiter.connect(c.destination);
      const bgmBus = c.createGain();
      bgmBus.gain.value = BGM_LEVEL;
      bgmBus.connect(master);
      const sfxBus = c.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      S.ctx = c;
      S.master = master;
      S.bgmBus = bgmBus;
      S.sfxBus = sfxBus;
      bankFor(c);
      c.onstatechange = () => { if (c.state === 'running') removeGestureListeners(); };
      return c;
    } catch (e) {
      S.ctxFailed = true;
      warnOnce('ctx', 'AudioContext を作成できません（無音で続行します）', e);
      return null;
    }
  }

  function onGesture() { unlock(); }

  function addGestureListeners() {
    for (const n of GESTURES) window.addEventListener(n, onGesture, { capture: true, passive: true });
  }
  function removeGestureListeners() {
    for (const n of GESTURES) window.removeEventListener(n, onGesture, { capture: true, passive: true });
  }

  function onVisibility() {
    try {
      const c = S.ctx;
      if (!c || !S.unlocked) return;
      if (document.hidden) { if (c.state === 'running') c.suspend().catch(() => {}); }
      else if (c.state === 'suspended') c.resume().catch(() => {});
    } catch (e) { /* 無視 */ }
  }

  function readSettings() {
    try {
      const st = App.state;
      if (!st || typeof st.setting !== 'function') return;
      const snd = st.setting('sound');
      if (typeof snd === 'boolean') S.muted = !snd;
      const vol = Number(st.setting('volume'));
      if (st.setting('volume') !== undefined && isFinite(vol)) S.volume = clamp(vol, 0, 1);
      applyGain();
    } catch (e) { /* state 未ロード等は既定値のまま */ }
  }

  function subscribe() {
    if (S.subscribed) return;
    const ev = App.events;
    if (!ev || typeof ev.on !== 'function') return;
    S.subscribed = true;
    ev.on('settings:changed', (p) => {
      if (!p || p.key === 'sound' || p.key === 'volume' || p.key === undefined) readSettings();
    });
    ev.on('state:loaded', readSettings);
    ev.on('state:reset', readSettings);
  }

  // 初回呼び出し時の準備（何度呼んでもよい）
  function bootstrap() {
    subscribe();
    if (S.booted) return;
    S.booted = true;
    try {
      addGestureListeners();
      document.addEventListener('visibilitychange', onVisibility);
    } catch (e) { /* 無視 */ }
    readSettings();
  }

  function ensureTimer() {
    if (!S.timer) S.timer = setInterval(tick, TIMER_MS);
  }

  function tick() {
    try {
      const c = S.ctx;
      if (!c) return;
      const now = c.currentTime;
      const minTime = now - 0.05;
      S.fading = S.fading.filter((p) => {
        if (now >= p.stopAt) { try { p.out.disconnect(); } catch (e) { /* 無視 */ } return false; }
        p.pump(Math.min(now + LOOKAHEAD, p.stopAt), minTime);
        return true;
      });
      if (S.player) S.player.pump(now + LOOKAHEAD, minTime);
      if (!S.player && !S.fading.length) { clearInterval(S.timer); S.timer = 0; }
    } catch (e) {
      warnOnce('tick', 'スケジューラで例外が発生しました', e);
    }
  }

  function fadeOut(p, dur) {
    const c = S.ctx;
    const now = c.currentTime;
    const g = p.out.gain;
    const cur = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    g.linearRampToValueAtTime(0, now + Math.max(0.01, dur));
    p.stopAt = now + Math.max(0.01, dur) + 0.05;
    S.fading.push(p);
  }

  function startSong(name, opts) {
    const c = S.ctx;
    if (!c) return;
    const song = getSong(name);
    if (!song || !song.ok) return;
    const now = c.currentTime;
    const fade = clamp(num(opts && opts.fade, FADE_OUT), 0, 5);
    let startAt = now + 0.06;
    if (S.player) {
      fadeOut(S.player, fade);
      startAt = now + Math.max(0.06, fade * 0.6);
      S.player = null;
    }
    const p = createPlayer(c, song, S.bgmBus, startAt);
    S.player = p;
    ensureTimer();
    p.pump(c.currentTime + LOOKAHEAD, c.currentTime - 0.05);
  }

  function duck(sec) {
    try {
      const c = S.ctx;
      const now = c.currentTime;
      const until = Math.max(S.duckUntil, now + sec);
      S.duckUntil = until;
      const g = S.bgmBus.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(BGM_LEVEL * 0.18, now, 0.03);
      g.setTargetAtTime(BGM_LEVEL, until, 0.2);
    } catch (e) { /* 無視 */ }
  }

  // ==================================================================
  // 公開 API
  // ==================================================================
  function init() {
    try {
      bootstrap();
      const gd = window.GameData;
      if (gd && gd.config && gd.config.debug) {
        const v = validate();
        if (v.errors.length) console.warn('[audio] 曲・効果音データにエラーがあります', v.errors);
      }
    } catch (e) {
      warnOnce('init', '初期化に失敗しました', e);
    }
  }

  // 自動再生制限の解除（ユーザー操作のハンドラから呼ぶ）。戻り値: 音が出せる状態か
  function unlock() {
    try {
      bootstrap();
      const c = ensureContext();
      if (!c) return false;
      if (c.state === 'suspended' && !document.hidden) {
        const pr = c.resume();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      }
      if (c.state === 'running') removeGestureListeners();
      if (!S.unlocked) {
        S.unlocked = true;
        if (S.want && !S.player) startSong(S.want);
      }
      return true;
    } catch (e) {
      warnOnce('unlock', '音声の有効化に失敗しました', e);
      return false;
    }
  }

  function play(name) {
    try {
      bootstrap();
      if (S.muted || !name) return;
      const sfx = getSfx(String(name));
      if (!sfx) { warnOnce('unknown-sfx:' + name, '未知の効果音 "' + name + '" は無視します'); return; }
      if (!sfx.ok) return;
      const c = S.ctx;
      if (!c || !S.unlocked) return;
      if (c.state !== 'running' && document.hidden) return;
      const now = c.currentTime;
      const last = S.lastSfx[name];
      if (last !== undefined && now - last < 0.03 && now >= last) return;
      S.lastSfx[name] = now;
      scheduleSfx(c, S.sfxBus, sfx, now + 0.005);
      if (sfx.duck > 0 && S.player) duck(sfx.duck);
    } catch (e) {
      warnOnce('play:' + name, '効果音 "' + name + '" の再生に失敗しました', e);
    }
  }

  // opts（省略可・拡張）: { fade: 前の曲のフェードアウト秒, restart: true で同じ曲でも最初から }
  function playBgm(name, opts) {
    try {
      bootstrap();
      if (!name) { stopBgm(); return; }
      name = String(name);
      if (!bgmDefs()[name]) { warnOnce('unknown-bgm:' + name, '未知のBGM "' + name + '" は無視します'); return; }
      if (S.want === name && !(opts && opts.restart)) return;
      S.want = name;
      if (!S.unlocked || !S.ctx) return;   // 解禁後に開始（予約）
      startSong(name, opts);
    } catch (e) {
      warnOnce('bgm:' + name, 'BGM "' + name + '" の再生に失敗しました', e);
    }
  }

  function stopBgm(fadeSec) {
    try {
      S.want = null;
      if (S.player && S.ctx) {
        fadeOut(S.player, clamp(num(fadeSec, 0.6), 0, 5));
        S.player = null;
        ensureTimer();
      }
    } catch (e) { /* 無視 */ }
  }

  function syncSetting(key, value) {
    try {
      const st = App.state;
      if (st && typeof st.setSetting === 'function' && typeof st.setting === 'function') {
        if (st.setting(key) !== value) st.setSetting(key, value);   // settings:changed は state が emit
        return;
      }
      if (App.events && typeof App.events.emit === 'function') App.events.emit('settings:changed', { key, value });
    } catch (e) { /* state 未ロード */ }
  }

  function setMuted(b) {
    try {
      S.muted = !!b;
      applyGain();
      syncSetting('sound', !S.muted);
    } catch (e) { /* 無視 */ }
  }

  function isMuted() { return S.muted; }

  function setVolume(v) {
    try {
      const n = Number(v);
      if (!isFinite(n)) return;
      S.volume = clamp(n, 0, 1);
      applyGain();
      syncSetting('volume', S.volume);
    } catch (e) { /* 無視 */ }
  }

  function getVolume() { return S.volume; }

  function currentBgm() { return S.want; }

  function status() {
    return {
      supported: !!(window.AudioContext || window.webkitAudioContext) && !S.ctxFailed,
      unlocked: S.unlocked,
      ctxState: S.ctx ? S.ctx.state : null,
      muted: S.muted,
      volume: S.volume,
      bgm: S.want,
      playing: S.player ? S.player.name : null,
      startedAt: S.player ? Math.round(S.player.t0 * 1000) / 1000 : null,
      time: S.ctx ? Math.round(S.ctx.currentTime * 1000) / 1000 : null,
      fading: S.fading.length,
      timer: !!S.timer,
    };
  }

  function list() {
    return { sfx: Object.keys(sfxDefs()), bgm: Object.keys(bgmDefs()) };
  }

  // 曲・効果音データの検証
  function validate() {
    const errors = [], warnings = [], bgm = {}, sfx = {};
    const bd = bgmDefs(), sd = sfxDefs();
    for (const n of BGM_NAMES) if (!bd[n]) errors.push('BGM "' + n + '" が定義されていません');
    for (const n of SFX_NAMES) if (!sd[n]) errors.push('効果音 "' + n + '" が定義されていません');
    for (const n of Object.keys(bd)) {
      const s = compileSong(n, bd[n]);
      errors.push(...s.errors);
      warnings.push(...s.warnings);
      const tracks = {};
      for (const tr of s.tracks) {
        tracks[tr.name] = { wave: tr.wave, notes: tr.count, range: tr.range ? midiName(tr.range[0]) + '-' + midiName(tr.range[1]) : null };
      }
      bgm[n] = {
        ok: s.ok, tempo: s.tempo, bars: s.bars, loopBar: s.loopBar, loopBars: s.loopBars,
        seconds: s.seconds ? Math.round(s.seconds * 10) / 10 : 0, tracks,
      };
    }
    for (const n of Object.keys(sd)) {
      const x = compileSfx(n, sd[n]);
      errors.push(...x.errors);
      warnings.push(...x.warnings);
      sfx[n] = { ok: x.ok, parts: x.parts.length, seconds: Math.round(x.length * 100) / 100, duck: x.duck };
    }
    const uniq = (a) => Array.from(new Set(a));
    const e = uniq(errors), w = uniq(warnings);
    return { ok: e.length === 0, errors: e, warnings: w, bgm, sfx };
  }

  // 解析用: コンパイル済みの曲データ（プレビューのピアノロール等で使う）
  function inspect(name) {
    const s = getSong(name);
    if (!s) return null;
    return {
      name: s.name, ok: s.ok, tempo: s.tempo, beats: s.beats, barTicks: s.barTicks, totalTicks: s.totalTicks,
      loopTick: s.loopTick, bars: s.bars, seconds: s.seconds, tpq: TPQ, errors: s.errors.slice(), warnings: s.warnings.slice(),
      tracks: s.tracks.map((tr) => ({
        name: tr.name, wave: tr.wave, vol: tr.vol, isDrum: tr.isDrum, range: tr.range,
        events: tr.events.map((e) => Object.assign({}, e)),
      })),
    };
  }

  // テスト用: OfflineAudioContext で実際に波形を合成し、音量などを測る
  //   kind: 'bgm' | 'sfx'。 opts.keepBuffer で AudioBuffer も返す
  function renderOffline(kind, name, seconds, opts) {
    return new Promise((resolve) => {
      try {
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (typeof OAC !== 'function') { resolve({ ok: false, error: 'OfflineAudioContext なし' }); return; }
        const sr = (opts && opts.sampleRate) || 22050;
        let dur = num(seconds, 0);
        let target = null;
        if (kind === 'bgm') {
          target = getSong(name);
          if (!target || !target.ok) { resolve({ ok: false, error: 'BGM "' + name + '" が無いかエラーあり' }); return; }
          if (!dur) dur = Math.min(target.seconds, 8);
        } else {
          target = getSfx(name);
          if (!target || !target.ok) { resolve({ ok: false, error: '効果音 "' + name + '" が無いかエラーあり' }); return; }
          if (!dur) dur = target.length + 0.3;
        }
        const c = new OAC(2, Math.max(1, Math.ceil(sr * dur)), sr);
        const dest = c.createGain();
        dest.connect(c.destination);
        if (kind === 'bgm') createPlayer(c, target, dest, 0.01).pump(dur, -Infinity);
        else scheduleSfx(c, dest, target, 0.01);
        c.startRendering().then((buf) => {
          let peak = 0, sum = 0, nan = 0, n = 0;
          const win = Math.max(1, Math.floor(sr * 0.05));
          let winSum = 0, winN = 0, active = 0, wins = 0;
          const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
          for (let i = 0; i < L.length; i++) {
            const v = (L[i] + R[i]) / 2;
            if (!isFinite(L[i]) || !isFinite(R[i])) { nan++; continue; }
            const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
            if (a > peak) peak = a;
            sum += v * v; n++;
            winSum += v * v; winN++;
            if (winN >= win) { wins++; if (Math.sqrt(winSum / winN) > 0.003) active++; winSum = 0; winN = 0; }
          }
          const res = {
            ok: nan === 0, kind, name, seconds: dur, peak: Math.round(peak * 1000) / 1000,
            rms: Math.round(Math.sqrt(sum / Math.max(1, n)) * 1000) / 1000, nan,
            activeRatio: wins ? Math.round(active / wins * 100) / 100 : 0,
          };
          if (opts && opts.keepBuffer) res.buffer = buf;
          resolve(res);
        }).catch((e) => resolve({ ok: false, error: String(e) }));
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }

  App.audio = {
    init, play, playBgm, stopBgm, setMuted, isMuted, setVolume,
    // 以下は拡張（SPEC 外・任意で使用）
    getVolume, unlock, currentBgm, status, list, validate, inspect, renderOffline,
    parseNotes(src, opts) {
      const errors = [], warnings = [];
      const r = parseNotes(src, Object.assign({ barTicks: 4 * TPQ }, opts || {}), errors, warnings, 'notes');
      return Object.assign(r, { errors, warnings });
    },
    SFX_NAMES: SFX_NAMES.slice(),
    BGM_NAMES: BGM_NAMES.slice(),
    TPQ,
  };
})();
