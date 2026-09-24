# ガチャモン 内部仕様書（開発者向けコントラクト）

この文書は全モジュール共通の **インターフェース契約** である。各モジュール担当はここに書かれた
ファイル構成・グローバル名・関数シグネチャ・データ構造を厳守すること。
契約を変更したくなった場合は勝手に変えず、最終報告に「契約変更の提案」として記載する。

---

## 1. 前提・技術方針

- 純粋な HTML / CSS / JavaScript。**ビルド不要・外部ライブラリ不使用**。
- `index.html` を **ダブルクリック（file://）で開いて動く** こと。そのため:
  - `fetch()` / XHR でローカルファイルを読まない（file:// では失敗する）。データはすべて JS ファイル。
  - ES Modules（`<script type="module">` / `import`）は使わない。**クラシック `<script>` + グローバル名前空間**。
  - ユーザーが置いた画像（file://）を canvas に描いた後 `getImageData` / `toDataURL` を呼ばない（tainted canvas 例外）。
    シルエット表示は CSS `filter: brightness(0)` で行う。自動生成スプライト（自前 canvas）は toDataURL してよい。
- 対象ブラウザ: 最新の Chrome / Edge（ES2020 まで自由に使用可）。
- グローバル名前空間:
  - `window.GameData` … 編集可能なゲームデータ（data/*.js が定義）
  - `window.App` … エンジン・UI モジュール（js/**/*.js が定義）
- JS ファイルは IIFE で包む: `(function () { 'use strict'; const App = window.App = window.App || {}; ... App.xxx = {...}; })();`
- データファイルの先頭: `window.GameData = window.GameData || {};`
- **ロード時に DOM を触らない**。DOM 構築は `init()` 内で行う（main.js が DOMContentLoaded 後に呼ぶ）。
- UI テキストは日本語。フィールド/バトルのメッセージはGBA風（ひらがな多め・文節ごとに半角/全角スペース）。
- **著作権配慮**: 実在のポケモンの名前・デザイン・地名・人物名・楽曲・ロゴは使わない。モンスター名・デザイン・マップ名・キャラ・BGMはすべてオリジナル。
  汎用的なバトル文言（「こうかは ばつぐんだ！」等の一般的な言い回し）は可。
- インデント 2 スペース、セミコロンあり、`const/let`。コメントは日本語で簡潔に。

## 2. ディレクトリ構成とファイル所有者

所有者以外はそのファイルを **編集しない**（読むのは自由）。

| パス | 所有者 | 内容 |
|---|---|---|
| `index.html` | core | 全 script / css タグ、タブパネル、#screen レイヤ |
| `css/base.css` | core | 全体レイアウト・トップバー・タブ・共通UI部品・#screen・dialog・パッド |
| `data/config.js` | (固定) | ゲーム全体設定 |
| `data/tiles.js` | (固定) | マップ記号の定義 |
| `data/types.js` | data | タイプ定義・相性表 |
| `data/moves.js` | data | わざ |
| `data/monsters.js` | data | モンスター |
| `data/gacha.js` | data | レアリティ定義・ガチャ設定・バナー |
| `data/maps.js` | field | マップ・開始位置 |
| `data/trainers.js` | field | トレーナー |
| `js/core/util.js` | core | 汎用関数 |
| `js/core/events.js` | core | pub/sub |
| `js/core/data.js` | core | GameData アクセサ・検証・エディタ上書き適用 |
| `js/core/monster.js` | core | 個体生成・能力値・経験値 |
| `js/core/state.js` | core | セーブデータ |
| `js/core/input.js` | core | キーボード/画面パッド入力 |
| `js/core/ui.js` | core | トースト・モーダル・共通コンポーネント |
| `js/core/dialog.js` | core | #screen 内メッセージウィンドウ |
| `js/core/audio.js` | audio | 効果音・BGM（WebAudio 自作チップチューン） |
| `js/gfx/sprites.js` | graphics | モンスター/キャラの自動生成ドット絵・画像管理 |
| `js/gfx/tiles.js` | graphics | タイル描画 |
| `js/field/field.js` + `css/field.css` | field | フィールド（冒険） |
| `js/battle/engine.js` | battle | バトルロジック（純粋ロジック） |
| `js/battle/battle.js` + `css/battle.css` | battle | バトルUI・進行 |
| `js/gacha/gacha.js` | gacha | ガチャ抽選ロジック (`App.gacha`) |
| `js/tabs/gacha.js` + `css/gacha.css` | gacha | ガチャ画面 (`App.gachaTab`) |
| `js/tabs/party.js` + `css/party.css` | party | 編成画面 (`App.partyTab`) |
| `js/tabs/dex.js` + `css/dex.css` | party | 図鑑画面 (`App.dexTab`) |
| `js/tabs/settings.js` | core | その他画面 (`App.settingsTab`) |
| `js/main.js` | core | 起動・タブ切替・トップバー・ログボ・ニューゲーム |
| `editor.html`, `js/editor/editor.js`, `css/editor.css` | editor | データエディタ |
| `README.md` | editor | 利用者向けドキュメント（遊び方・データ編集ガイド） |
| `assets/monsters/`, `assets/tiles/`, `assets/characters/` | - | ユーザーが画像を置く場所 |
| `tools/cdp.ps1` | (固定) | ヘッドレスChromeテストドライバ |
| `tools/steps/*.json`, `tools/*.html` | 各自 | テスト手順・開発用プレビュー（ファイル名に担当名を入れる） |
| `out/` | 各自 | テスト出力（スクショ等） |

## 3. index.html の読み込み順

CSS: `css/base.css, css/field.css, css/battle.css, css/gacha.css, css/party.css, css/dex.css`
フォント: Google Fonts `DotGothic16`（オフライン時は `'MS Gothic', monospace` にフォールバック）

Script（`</body>` 直前、この順番）:
```
data/config.js
data/tiles.js
data/types.js
data/moves.js
data/monsters.js
data/gacha.js
data/trainers.js
data/maps.js
js/core/util.js
js/core/events.js
js/core/data.js
js/core/monster.js
js/core/state.js
js/core/input.js
js/core/audio.js
js/core/ui.js
js/core/dialog.js
js/gfx/sprites.js
js/gfx/tiles.js
js/field/field.js
js/battle/engine.js
js/battle/battle.js
js/gacha/gacha.js
js/tabs/gacha.js
js/tabs/party.js
js/tabs/dex.js
js/tabs/settings.js
js/main.js
```
**main.js は、いずれかのモジュールが未定義（ファイル未作成・例外）でも起動を続行する**こと。
未定義のタブには「準備中」を表示。各 init() は try/catch で囲み、失敗はコンソールと開発パネルに表示。

## 4. 画面構成

### 4.1 タブ
| id | ラベル | モジュール | パネル要素 |
|---|---|---|---|
| `adventure` | ぼうけん | `App.field` | `#tab-adventure` |
| `party` | へんせい | `App.partyTab` | `#tab-party` |
| `gacha` | ガチャ | `App.gachaTab` | `#tab-gacha` |
| `dex` | ずかん | `App.dexTab` | `#tab-dex` |
| `settings` | その他 | `App.settingsTab` | `#tab-settings` |

タブモジュールは共通インターフェース `{ init(panelEl), onShow(), onHide() }` を持つ。
- `init(panelEl)` は起動時に1回。自分のパネル内の DOM を自由に構築してよい（`#tab-adventure` は例外: 4.2 の構造を core が用意済み）。
- `onShow()` / `onHide()` はタブ切替時。非表示中は描画ループ等を止める。
- バトル中は `App.main.setTabLock(true, 'バトル中は きりかえ できません')` によりタブ切替不可。

トップバー（main.js）: タイトル、所持ポイント `◆ 1,234 pt`、無料ガチャ残数、サウンドON/OFFボタン。
`points:changed` / `freepulls:changed` イベントで自動更新。

### 4.2 GBA画面（#tab-adventure 内。core が作成）
```html
<div id="gba">
  <div id="screen-wrap">
    <div id="screen">                       <!-- 720x480px 固定 (= 240x160 の3倍) -->
      <canvas id="field-canvas" width="240" height="160"></canvas>  <!-- CSSで720x480, pixelated -->
      <div id="field-layer"></div>          <!-- z-index:10 フィールド用オーバーレイ -->
      <div id="battle-layer" hidden></div>  <!-- z-index:20 バトルUIルート -->
      <div id="dialog-layer"></div>         <!-- z-index:30 App.dialog -->
      <div id="fx-layer"></div>             <!-- z-index:40 暗転/フラッシュ等 -->
    </div>
  </div>
  <div id="pad"> 十字キー / A / B ボタン（data-action="up|down|left|right|a|b"）</div>
</div>
```
- `App.SCREEN = { W: 240, H: 160, SCALE: 3, TILE: 16 }`（util.js で定義）。
- `#screen` 内の DOM は **実ピクセル（720x480 座標系）** で配置する。GBAの1ドット = 3px。
- 画面幅が狭い場合 main.js が `#screen` を CSS transform で縮小する（`--screen-scale`）。各モジュールは気にしなくてよい。
- 画像/canvas は `image-rendering: pixelated`。

## 5. データスキーマ

### 5.1 config.js（`GameData.config`）— data/config.js 参照（固定）

### 5.2 types.js
```js
GameData.types = {
  normal: { name: 'ノーマル', color: '#A8A878' },
  fire:   { name: 'ほのお',   color: '#F08030' },
  // ... 全17タイプ: normal fire water grass electric ice fighting poison ground flying psychic bug rock ghost dragon dark steel
};
GameData.typeChart = {
  // 攻撃側タイプ: { 防御側タイプ: 倍率 }  記載のない組み合わせは 1
  fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  // ...
};
```

### 5.3 moves.js
```js
GameData.moves = {
  tackle: {
    name: 'たいあたり',
    type: 'normal',
    category: 'physical',   // 'physical' | 'special' | 'status'
    power: 40,              // status は 0
    accuracy: 100,          // 0 = 必中
    pp: 35,
    priority: 0,            // 省略可（-7〜+5）
    critStage: 0,           // 省略可。1 で急所率アップ
    effects: [],            // 省略可。下記参照
    desc: 'からだごと ぶつかって こうげきする。',
  },
};
```
effects の種類（配列で複数可）:
| kind | 項目 | 意味 |
|---|---|---|
| `stat` | `target:'self'|'foe'`, `stat:'atk'|'def'|'spa'|'spd'|'spe'|'acc'|'eva'`, `stages:±1〜3`, `chance:1〜100`(省略=100) | 能力ランク変化 |
| `status` | `status:'poison'|'burn'|'paralyze'|'sleep'|'freeze'`, `chance`(省略=100) | 状態異常付与（相手） |
| `heal` | `ratio:0.5` | 自分の最大HPの割合を回復 |
| `drain` | `ratio:0.5` | 与ダメージの割合を回復 |
| `recoil` | `ratio:0.25` | 与ダメージの割合を反動ダメージ |
| `flinch` | `chance` | ひるみ（先に行動したときのみ有効） |
| `multihit` | `min:2, max:5` | 連続攻撃 |

status技（category:'status'）は power 0。status技の `effects` の stat の target は通常 'foe'（なきごえ等）か 'self'（つるぎのまい等）。

### 5.4 monsters.js
```js
GameData.monsters = [
  {
    id: 'hinokon',           // 英小文字・数字・_ のみ。一意
    no: 1,                   // 図鑑番号（一意）
    name: 'ヒノコン',
    rarity: 'N',             // 'N' | 'R' | 'SR' | 'SSR' | 'UR'
    types: ['fire'],         // 1〜2個
    baseStats: { hp: 45, atk: 55, def: 40, spa: 60, spd: 45, spe: 60 },
    learnset: [ { lv: 1, move: 'tackle' }, { lv: 1, move: 'growl' }, { lv: 6, move: 'ember' } ],
    expGroup: 'medium_fast', // 'fast' | 'medium_fast' | 'medium_slow' | 'slow'（省略時 medium_fast）
    baseExp: 60,             // 倒されたときの基礎経験値
    image: '',               // 正面画像パス（空 = 自動生成ドット絵）例 'assets/monsters/hinokon.png'
    backImage: '',           // 背面画像パス（空 = image を左右反転。image も空なら自動生成の背面）
    sprite: { shape: 'quadruped', colors: ['#f08030', '#f8d030', '#603010'], seed: 0 }, // 自動生成の調整（省略可）
    gacha: true,             // false でガチャ対象外（省略時 true）
    category: 'ひだねモンスター', // 分類（省略可）
    height: 0.4, weight: 5.2,     // 省略可（m / kg）
    desc: '図鑑の説明文。',
  },
];
```
- `sprite.shape`: `'blob'|'biped'|'quadruped'|'bird'|'fish'|'serpent'|'insect'|'plant'|'ghost'|'dragon'`（省略時 seed から自動）
- `sprite.colors`: `[メイン, サブ, アクセント]`（省略時タイプ色から自動）
- 目安の種族値合計: N 250〜330 / R 330〜400 / SR 400〜470 / SSR 470〜540 / UR 540〜610
- learnset には **lv1 のわざを最低1つ** 含める。

### 5.5 gacha.js
```js
GameData.rarities = {
  N:   { name: 'ノーマル',      color: '#9aa3ad', glow: '#e5e7eb', stars: 1, pointMult: 1.0, refund: 10 },
  R:   { name: 'レア',          color: '#3b82f6', glow: '#93c5fd', stars: 2, pointMult: 1.3, refund: 30 },
  SR:  { name: 'スーパーレア',  color: '#a855f7', glow: '#d8b4fe', stars: 3, pointMult: 1.6, refund: 100 },
  SSR: { name: 'ダブルスーパーレア', color: '#f59e0b', glow: '#fde68a', stars: 4, pointMult: 2.0, refund: 300 },
  UR:  { name: 'ウルトラレア',  color: '#ec4899', glow: '#fbcfe8', stars: 5, pointMult: 3.0, refund: 1000, rainbow: true },
};
GameData.rarityOrder = ['N', 'R', 'SR', 'SSR', 'UR'];   // 低い順
GameData.gacha = {
  singleCost: 100,
  multiCost: 1000,
  multiCount: 10,
  multiGuarantee: 'SR',   // 10連の最後の1回は このレア度以上確定（null で無効）
  pityCount: 100,         // 天井: pityRarity以上が出ないままこの回数に達したら確定（0で無効）
  pityRarity: 'SSR',
  maxLimitBreak: 5,       // 重複入手時の限界突破（凸）上限
  limitBreakBonus: 0.04,  // 凸1につき全能力 +4%
  startLevel: 5,          // ガチャ入手時のレベル
  banners: [
    {
      id: 'standard',
      name: 'スタンダードガチャ',
      desc: 'すべてのモンスターが登場！',
      rates: { N: 50, R: 30, SR: 14, SSR: 5, UR: 1 },  // 合計100（%）
      pool: null,           // null = gacha !== false の全モンスター / ['id', ...] = 対象限定
      pickup: [],           // ピックアップ対象ID
      pickupRate: 0.5,      // そのレア度が出たとき、ピックアップ対象が選ばれる確率
      colors: ['#1e3a8a', '#3b82f6'],  // バナー背景グラデーション
    },
  ],
};
```
- あるレア度の対象モンスターが0体のバナーでは、そのレア度の確率を他レア度に按分する（App.gacha が処理）。

### 5.6 tiles.js — data/tiles.js 参照（固定）
`GameData.tiles['記号'] = { name, draw, walk, encounter?, overlay?, counter?, image? }`
`draw` は `js/gfx/tiles.js` の描画関数名。`image`（16x16 PNG パス）を指定すると画像で描画。

### 5.7 look（キャラクター外見。自動生成スプライト用）
```js
{ skin: '#f8d0a8', hair: '#503020', hairStyle: 'short', shirt: '#3070d0', pants: '#304060', hat: '#e03030', accent: '#ffffff', image: '' }
```
- `hairStyle`: `'short'|'long'|'spiky'|'bald'|'bun'`、`hat`: 色 or null。
- `image` を指定した場合はスプライトシート画像を使用（形式は sprites.js / README に記載: 16x24 を 3フレーム×4方向）。

### 5.8 trainers.js
```js
GameData.trainers = {
  route1_kenta: {
    name: 'ケンタ',
    className: 'たんパンこぞう',        // 表示: 「たんパンこぞうの ケンタ」
    look: { ... },                      // 5.7
    image: '',                          // バトル立ち絵（空=自動生成）
    party: [ { species: 'hinokon', level: 4 }, { species: 'xxx', level: 5, moves: ['tackle'] } ],
    reward: 150,                        // 勝利ポイント（省略時 config.rewards.trainerDefault）
    ai: 'smart',                        // 'random' | 'smart'
    boss: false,                        // true: ボスBGM
    rematch: 'never',                   // 'never' | 'daily'（日付が変わると再戦可）
    intro: ['めが あったら しょうぶだ！'], // フィールドで話しかけ/視線で発見時
    lose: ['くっそー まけた！'],          // プレイヤー勝利時（バトル画面で表示）
    win: ['へへん ぼくの かちだね'],      // プレイヤー敗北時
    after: ['つぎは まけないからな！'],   // 撃破後に話しかけたとき
  },
};
```

### 5.9 maps.js
```js
GameData.worldStart = { map: 'town1', x: 5, y: 6, dir: 'down' };
GameData.maps = {
  town1: {
    name: 'はじまりのまち',
    bgm: 'town',              // App.audio の BGM 名
    border: 'T',              // マップ外に描画するタイル記号
    indoor: false,
    tiles: [                  // 全行同じ長さ。記号は tiles.js
      'TTTTTTTTTT',
      'T........T',
    ],
    encounters: {             // 省略可（encounter:true のタイルで判定）
      rate: 0.12,             // 1歩あたりの確率（省略時 config.encounterRate）
      table: [ { species: 'xxx', min: 2, max: 4, weight: 40 } ],
    },
    warps: [ { x: 5, y: 0, to: 'route1', tx: 5, ty: 18, dir: 'up', requireParty: true } ],
    npcs: [
      { id: 'n1', x: 3, y: 4, dir: 'down', look: {...}, move: 'still', dialog: ['こんにちは！'] },
      { id: 'nurse', x: 7, y: 2, dir: 'down', look: {...}, heal: true },             // 回復
      { id: 'clerk', x: 4, y: 2, dir: 'down', look: {...}, action: 'gacha' },        // ガチャタブへ誘導
      { id: 't1', x: 8, y: 9, dir: 'left', trainer: 'route1_kenta', sight: 4 },      // トレーナー（look は trainers 側）
    ],
    signs: [ { x: 4, y: 7, text: ['はじまりのまち', 'ここから ぼうけんが はじまる'] } ],
    pickups: [ { id: 'town1_p1', x: 2, y: 3, points: 50 } ],  // 一度だけ拾えるポイント
  },
};
```
- `move`: `'still'|'turn'|'wander'`。`requireParty: true` のワープはモンスター未所持だと通れない（「モンスターを もっていないと あぶないよ！」）。
- warp は「そのタイルに乗った瞬間」に発動。ドア `D` やマット `m`、マップ端に置く。

## 6. セーブデータ（`App.state.data`, localStorage `config.saveKey`）
```js
{
  version: 1,
  createdAt: 0,                                  // ms
  player: { name: 'ユウ', map: 'town1', x: 5, y: 6, dir: 'down' },
  respawn: { map: 'town1', x: 5, y: 6, dir: 'down' },  // 全滅時の復帰地点（最後に回復した場所）
  points: 0,
  freePulls: 3,
  collection: { /* speciesId: MonsterInstance */ },     // 所持モンスター（1種1体。重複は凸）
  party: [ /* speciesId, 最大 config.partyMax */ ],
  dex: { seen: { /* id: true */ }, owned: { /* id: true */ } },
  trainers: { /* trainerId: 'YYYY-MM-DD'（撃破日） */ },
  pickups: { /* pickupId: true */ },
  flags: {},
  gacha: { history: [ /* 最新200件 {speciesId, rarity, bannerId, at, isNew, limitBreak, refund} */ ], pity: 0, totalPulls: 0 },
  stats: { battles: 0, wins: 0, losses: 0, runs: 0, wildWins: 0, trainerWins: 0, pointsEarned: 0, pointsSpent: 0, steps: 0 },
  lastLogin: '',                                 // 'YYYY-MM-DD'
  settings: { textSpeed: 'normal', sound: true, volume: 0.6 },
}
```
MonsterInstance（所持・野生・トレーナー共通の形）:
```js
{
  speciesId: 'hinokon',
  nickname: '',
  level: 5,
  exp: 125,                  // 累計経験値
  limitBreak: 0,             // 凸数
  hp: 20,                    // 現在HP（0 = ひんし）
  status: null,              // null | 'poison' | 'burn' | 'paralyze' | 'sleep' | 'freeze'
  statusTurns: 0,            // ねむり残りターン等
  moves: [ { id: 'tackle', pp: 35 } ],   // 最大4
  obtainedAt: 0,
}
```

## 7. モジュール API

### 7.1 App.util（core）
```
App.SCREEN = { W:240, H:160, SCALE:3, TILE:16 }
el(tag, attrs?, ...children) → HTMLElement
    attrs: { class, id, text, html, style:{...}|string, dataset:{...}, onclick..., その他は setAttribute }
    children: Node | string | 配列 | null
clamp(v, min, max) / randInt(min, max) 両端含む / rand() / chance(p 0..1) / pick(arr) / shuffle(arr) 新配列
weightedPick(items, weightFn) → item
sleep(ms) → Promise
nextFrame() → Promise
hashString(str) → uint32 / mulberry32(seed) → () => [0,1)
deepClone(obj) / formatNumber(n) '1,234' / today() 'YYYY-MM-DD' / escapeHtml(s)
format(text, vars) → '{player}' 等を置換
```

### 7.2 App.events（core）
```
on(name, fn) → off関数 / off(name, fn) / once(name, fn) / emit(name, payload)
```
イベント一覧:
| 名前 | payload |
|---|---|
| `points:changed` | `{ points, delta, reason }` |
| `freepulls:changed` | `{ freePulls }` |
| `party:changed` | `{ party }` |
| `collection:changed` | `{ speciesId, isNew, limitBreak, refund }` |
| `monster:updated` | `{ speciesId }`（レベル・HP・わざ等の変化） |
| `dex:changed` | `{ speciesId, seen, owned }` |
| `battle:start` | `{ kind: 'wild'|'trainer', trainerId? }` |
| `battle:end` | `{ kind, result: 'win'|'lose'|'run' }` |
| `tab:changed` | `{ id, prev }` |
| `state:loaded` / `state:reset` / `state:saved` | `{}` |
| `settings:changed` | `{ key, value }` |
| `gacha:pulled` | `{ bannerId, results }` |

### 7.3 App.data（core）
```
config                       // = GameData.config
monster(id) → def|null / monsters() → def[]（no順） / move(id) / type(id) / types() → id[]
rarity(id) / rarityOrder() → ['N',...] / rarityRank(id) → 0..4
trainer(id) / map(id) / tile(ch) → 定義（未知記号は {walk:false, draw:'void'}）
typeEffect(moveType, defTypes[]) → 倍率（積）
encounterLocations(speciesId) → [{ mapId, mapName, min, max }]
validate() → { errors: string[], warnings: string[] }   // 参照切れ・重複ID・行長不一致等
applyOverrides()             // localStorage[config.overrideKey] のJSONで GameData を上書き（エディタ用）
hasOverrides() / clearOverrides()
```
**上書きデータの形式**（エディタが書き、data.js が読む）: localStorage[`GameData.config.overrideKey`] に JSON 文字列。
トップレベルのキーは GameData のプロパティ名（`monsters, moves, types, typeChart, rarities, rarityOrder, gacha, trainers, maps, worldStart, tiles`）。
存在するキーだけ `GameData[key]` を **丸ごと置き換える**（マージしない）。`config` は上書き対象外。付加情報として `_savedAt`（ms）を含めてよい（無視される）。

### 7.4 App.monster（core・純粋関数）
```
create(speciesId, level, opts?) → MonsterInstance
    opts: { moves?: [id], limitBreak?: n } 省略時 わざ=習得済みの最後の4つ
stats(inst) → { hp, atk, def, spa, spd, spe }   // 最大値
    HP  = floor((2*B + iv) * L / 100) + L + 10
    他  = floor((2*B + iv) * L / 100) + 5
    その後 × (1 + limitBreakBonus * limitBreak) を floor（iv = config.iv）
expForLevel(level, group) → 累計経験値（Lv1=0。fast=0.8n^3, medium_fast=n^3, medium_slow=1.2n^3-15n^2+100n-140（最低0）, slow=1.25n^3）
expProgress(inst) → 0..1（現レベル内の進捗） / expToNext(inst) → 残り
addExp(inst, amount) → { oldLevel, newLevel, levelsGained, learned: [moveId], pending: [moveId], statsBefore, statsAfter }
    レベルアップ時 最大HP増加分だけ現在HPも増やす（ひんしは除く）。maxLevel で頭打ち。
    新わざ: 空き枠があれば自動習得(learned)、4つ埋まっていれば pending（編成画面で入れ替え可能）
learnableMoves(inst) → [moveId]（lv ≤ 現レベル、重複除去、習得順）
setMoves(inst, moveIds) → bool（1〜4個、learnable のみ。既存わざの PP は維持、新規は最大PP）
heal(inst)（HP全快・状態異常解除・PP全快） / isFainted(inst) / maxPP(moveId)
displayName(inst) → nickname || 種族名
expYield(inst, isTrainer) → floor(baseExp * level / 7 * (isTrainer ? 1.5 : 1) * config.expMultiplier)
wildPoints(inst) → round((rewards.wildBase + rewards.wildPerLevel * level) * rarities[r].pointMult)
```

### 7.5 App.state（core）
```
data                                  // 生のセーブデータ（6章）
load() → bool（既存データあり） / save() デバウンス / saveNow() / reset()（初期データに戻す）
isNewGame() → bool（player.name 未設定 = ニューゲーム未完了）
points() / addPoints(n, reason) / spendPoints(n, reason) → bool
freePulls() / useFreePull() → bool
owned(id) → inst|null / ownedList() → inst[]（入手順） / ownedCount()
addMonster(speciesId, opts?) → { inst, isNew, limitBreak, refund, joinedParty }
    未所持: gacha.startLevel で生成・所持・dex.owned・パーティに空きがあれば自動加入
    所持済み & 凸 < max: limitBreak+1（最大HPの増加分だけ現在HPも増加）
    凸 max: rarities[r].refund ポイント返還
party() → inst[] / partyIds() / setParty(ids) / addToParty(id) → bool / removeFromParty(id) / moveInParty(from, to)
firstHealthy() → inst|null / hasHealthy() → bool
healAll()                              // 所持全モンスター全快
markSeen(id) / isSeen(id) / isOwned(id)
flag(key) / setFlag(key, value)
isTrainerDefeated(id) → bool（rematch:'daily' は撃破日 !== 今日 なら false） / setTrainerDefeated(id)
isPickupTaken(id) / takePickup(id)
setPlayerPos(map, x, y, dir) / setRespawn(map, x, y, dir)
setting(key) / setSetting(key, value)
recordGacha(entries) / incStat(key, n=1)
exportJSON() → string / importJSON(str) → bool
```
すべての変更系メソッドは内部で `save()`（デバウンス）と該当イベント emit を行う。
インスタンスを直接書き換えた場合（バトル中のHP等）は `App.state.save()` と `monster:updated` を呼び出し側が行う。

### 7.6 App.input（core）
```
init() / setActive(bool)            // ぼうけんタブ表示中のみ true（main が制御）
push(handler) → pop関数             // handler: { onPress(action, info), onRelease?(action) }。最上位のみ受信
pop(handler)
isDown(action) → bool               // 押しっぱなし判定（移動用）
heldDir() → 'up'|'down'|'left'|'right'|null   // 最後に押された・まだ押されている方向
```
- action: `'up'|'down'|'left'|'right'|'a'|'b'|'start'`
- キー: 矢印/WASD=方向、Z/Enter/Space=a、X/Esc/Backspace=b、C=start
- `info = { repeat: bool }`（キーリピート）。input/textarea にフォーカス中は無視。
- `#pad [data-action]` の pointerdown/up も同様に扱う。`#dialog-layer` のクリックは a として扱わない（dialog が独自処理）。

### 7.7 App.dialog（core）— #dialog-layer
```
say(textOrLines, opts?) → Promise<void>
    textOrLines: string | string[]（1要素=1ページ、'\n' で改行、{player} 置換）
    opts: { style: 'field'|'battle', speed: ms/文字, auto: ms（入力待ちせず自動送り）, keepOpen: bool }
    A/B/クリックで送り。文字送り中の A は全文表示。
ask(text, choices = ['はい','いいえ'], opts?) → Promise<index>   // B で最後の選択肢
isOpen() / close()
```
style 'field' = 白地に角丸枠（R/S風）、'battle' = バトル用の枠。いずれも #screen 下部 144px（GBA 48dot）。

### 7.8 App.ui（core）— タブ画面等の DOM 用
```
toast(msg, { type: 'info'|'success'|'warn'|'error', duration })
modal({ title, body: string|Node, buttons: [{ label, value, primary?, danger? }], closable? }) → Promise<value|null>
confirm(msg, opts?) → Promise<bool>
prompt(msg, { value, maxLength, placeholder }) → Promise<string|null>
rarityBadge(rarityId) → HTMLElement      // .rarity-badge.rarity-XX（色は GameData.rarities から動的生成）
typeBadge(typeId) → HTMLElement          // .type-badge.type-xxx（色は GameData.types から動的生成）
stars(n, max) → HTMLElement              // 凸数表示 ★★☆☆☆
hpBar(cur, max) → HTMLElement            // 緑/黄/赤
monsterCard(instOrSpeciesId, opts?) → HTMLElement
    opts: { size: 's'|'m'|'l', showLevel, showHp, silhouette, unknown, selected, onClick, badge: 'NEW' }
devPanel(messages)                       // 検証エラー等を画面右下に表示
```
ui.init() は GameData.rarities / types から `.rarity-XX { --rarity-color; --rarity-glow }`、`.type-xxx { --type-color }` の CSS を生成して注入する。

### 7.9 App.audio（audio）
```
init() / play(sfxName) / playBgm(name) / stopBgm() / setMuted(bool) / isMuted() / setVolume(0..1)
```
- SFX: `select confirm cancel bump door encounter hit hitSuper hitWeak miss faint levelup heal statUp statDown win lose run coin error trainerSpot gachaRoll gachaN gachaR gachaSR gachaSSR gachaUR`
- BGM: `title town route forest cave gym battleWild battleTrainer battleBoss victory gacha`
- 未知の名前は無視（エラーにしない）。初回ユーザー操作で AudioContext を resume。
- 設定は `App.state.setting('sound')` / `setting('volume')`。`settings:changed` を購読。
- 曲はすべてオリジナル（既存曲のメロディを使わない）。

### 7.10 App.sprites（graphics）
```
init()
monsterSprite(speciesOrId, view = 'front') → { src: string, flip: boolean }   // 同期
    image があればそれ。背面: backImage → image(flip) → 自動生成背面。自動生成は 64x64 を dataURL キャッシュ。
characterCanvas(look, dir, frame) → HTMLCanvasElement   // 16x24。frame: 0=立ち 1,2=歩き
drawCharacter(ctx, x, y, dir, frame, look)               // (x,y)=キャラが立つタイルの左上。頭はタイルより上にはみ出す
trainerPortrait(look) → src                              // 64x64 バトル立ち絵（正面）
playerBack(look) → src                                   // 64x64 主人公の後ろ姿（バトル開始演出用）
drawEmote(ctx, x, y, type)                               // '!' 等の吹き出し（16x16）
loadImage(src) → Promise<HTMLImageElement>（キャッシュ） / getImage(src) → 読み込み済みなら img、未完了なら null
```
自動生成モンスターはシード固定で毎回同じ見た目。レア度が高いほど装飾（模様・角・翼・オーラ）が豪華。

### 7.11 App.tiles（graphics）
```
draw(ctx, ch, px, py, t, at)          // 16x16 タイルを描画。t=経過ms（アニメ用）、at(dx,dy)→周囲の記号（境界処理用）
drawOverlay(ctx, ch, px, py, t)       // overlay:true のタイル（草むら）をキャラの下半身に重ねる
isAnimated(ch) → bool                 // water/flower 等
```

### 7.12 App.field（field）— タブモジュール
```
init(panelEl) / onShow() / onHide()
warpTo(mapId, x, y, dir) → Promise     // 暗転してマップ移動
isBusy() → bool                        // 会話/バトル/ワープ中
```
- 1マス単位の移動（歩き約220ms/マス、B押しながらで走る）。向きだけ変えるタップ操作。
- 草むらでエンカウント → フラッシュ演出 → `await App.battle.startWild(id, lv)`。
- トレーナーの視線（sight マス、遮蔽あり）に入ると「！」→ 近づいて会話 → `await App.battle.startTrainer(id)`。
- 回復NPC、ガチャ誘導NPC、看板、ワープ、ポイント拾い、マップ名表示、BGM切替。
- `'lose'` のとき: 「めのまえが まっくらに なった！」→ respawn へワープ → healAll。
- 戦えるモンスターがいない（hasHealthy() false）ときはエンカウントもトレーナー戦も発生しない。
- 初回表示時は #screen にタイトル画面（PRESS A）を表示してもよい。

### 7.13 App.battle（battle）
```
init()
startWild(speciesId, level) → Promise<'win'|'lose'|'run'>
startTrainer(trainerId) → Promise<'win'|'lose'>
isActive() → bool
```
- 開始時 `App.main.setTabLock(true, ...)`、`#battle-layer` 表示、`battle:start`。終了時に逆。
- 報酬（ポイント・経験値）、図鑑 seen、統計、撃破フラグ(setTrainerDefeated)、セーブまでバトル側で処理。
- フィールド側は結果に応じて全滅処理のみ行う。

### 7.14 App.gacha（gacha・ロジック）
```
banners() → banner[] / banner(id)
rates(bannerId) → { N: %, ... }（空レア度の按分後）
pool(bannerId, rarity) → speciesId[]
canPull(bannerId, count, { free }) → bool
pull(bannerId, count, { free }) → results[] | null（ポイント不足など）
    results: [{ speciesId, rarity, isNew, limitBreak, refund, pickup, joinedParty }]
    無料: count=1 のみ、freePulls を1消費
pityRemaining() → n
```

### 7.15 App.main（core）
```
switchTab(id) / currentTab() / setTabLock(locked, reason) / isTabLocked() / setTabBadge(id, text|null)
```
**テスト用URLパラメータ**（main.js が対応）:
- `index.html?autostart=1` … ニューゲーム未完了ならモーダルを出さずデフォルト名で即完了（ログボモーダルも出さない）。
- `index.html?tab=gacha` … 起動時に開くタブ。
- 組み合わせ可: `index.html?autostart=1&tab=party`
- `window.App.ready` … 起動処理完了で true（テストの waitFor に使う）。

## 8. ゲームルール

- **ニューゲーム**: 名前入力モーダル → 「無料ガチャ3回プレゼント！」→ ガチャタブへ。所持0体では町から出られない。
- **ログインボーナス**: 起動時 lastLogin !== 今日 なら `config.loginBonus` pt 付与＆モーダル表示（ニューゲーム当日は付与しない）。
- **ポイント獲得**: 野生に勝利 `App.monster.wildPoints(enemy)`、トレーナーに勝利 `trainer.reward`、落ちているポイント、重複最大凸の返還。
- **ダメージ計算**（Gen3風）:
  `base = floor(floor(floor(2*L/5 + 2) * power * A / D) / 50) + 2`
  × 急所(config.critMultiplier) × 乱数(0.85〜1.00) × タイプ一致(config.stab) × 相性 × やけど物理0.5、最低1（相性0は0）
  - A/D は物理=atk/def、特殊=spa/spd。ランク補正 (2+n)/2 または 2/(2-n)。急所時は不利なランクを無視。
  - 命中: accuracy × 命中ランク (3+n)/3 ÷ 回避ランク。accuracy 0 は必中。
  - 急所率: critStage 0 = config.critChance, 1 = 1/8, 2 = 1/4, 3+ = 1/2。
- **状態異常**: どく 毎ターン最大HPの1/8 / やけど 1/8 + 物理半減 / まひ すばやさ1/4・25%で行動不能 / ねむり 1〜3ターン行動不能 / こおり 毎ターン20%で解凍。タイプ免疫: ほのお→やけど、どく・はがね→どく、こおり→こおり、でんき→まひ。
- **行動順**: priority → すばやさ（ランク・まひ考慮）→ 同速ランダム。
- **PP切れ**: 全わざPP0のとき「わるあがき」（タイプなし威力50、与ダメの1/4反動）。
- **逃走**: 野生のみ。自分のすばやさ ≥ 相手なら必ず成功、そうでなければ `(自spe*128/相手spe + 30*試行回数) / 256` の確率。
- **経験値**: 倒したモンスターの `expYield` を場に出たモンスターで等分。場に出ていないパーティメンバー（ひんし除く）も `expShareRatio` 倍を獲得。
- **全滅**: `blackoutPointLoss` 割合のポイントを失い、respawn に戻って全回復。
- **ガチャ**: 単発 singleCost、10連 multiCost（最後の1回は multiGuarantee 以上確定）、天井 pityCount、重複は凸（最大 maxLimitBreak、以降は refund pt 返還）。無料ガチャは単発のみ。

## 9. テスト

- `powershell -ExecutionPolicy Bypass -File tools\cdp.ps1 -Steps tools\steps\xxx.json -OutDir out\xxx`
  （手順の書式は cdp.ps1 冒頭コメント参照。コンソールエラー・例外があれば exit 1）
- スクリーンショットは Read ツールで画像として確認できる。
- テスト用にセーブを消すには `{"clearStorage": true}` → `{"goto": "index.html"}`。
- `GameData.config.debug = true` のとき、その他タブにデバッグ機能（ポイント付与等）がある。
