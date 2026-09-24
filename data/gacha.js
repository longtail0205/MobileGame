// =====================================================================
// レア度・ガチャの設定
// ---------------------------------------------------------------------
// ■ このファイルの編集方法
//
// ◆ GameData.rarities … レア度の定義（キーがレア度ID）
//     name      : 表示名
//     color     : バッジ・カード枠の色
//     glow      : 光る演出の色（color より明るめ）
//     stars     : ★の数（演出用）
//     pointMult : 野生で倒したときにもらえるポイントの倍率
//     refund    : 凸（限界突破）が最大のときに 重複で引いたら返ってくるポイント
//     rainbow   : true にすると 虹色の特別演出
//
// ◆ GameData.rarityOrder … レア度を「低い → 高い」の順に並べた配列
//     新しいレア度を足すときは rarities と rarityOrder の両方に追加し、
//     各バナーの rates にも そのレア度の確率を書いてください。
//
// ◆ GameData.gacha … ガチャ全体の設定
//     singleCost     : 単発（1回）の消費ポイント
//     multiCost      : 10連の消費ポイント
//     multiCount     : 10連で引く回数
//     multiGuarantee : 10連の最後の1回は このレア度以上が確定（null で確定なし）
//     pityCount      : 天井。pityRarity 以上が出ないまま この回数引くと確定（0 で天井なし）
//     pityRarity     : 天井で確定するレア度
//     maxLimitBreak  : 同じモンスターを重ねて引いたときの 凸（限界突破）の上限
//     limitBreakBonus: 凸1つにつき 全能力が何倍アップするか（0.04 = +4%）
//     startLevel     : ガチャで入手したときのレベル
//
// ◆ banners … ガチャの種類（ガチャ画面に 上から順に並びます）
//     id         : 内部ID（英小文字・数字・_。ほかと重ならないこと）
//     name       : バナーの名前
//     desc       : 説明文
//     rates      : レア度ごとの出現率（%）。合計 100 にしてください
//     pool       : null = ガチャ対象（gacha: true）の全モンスター
//                  ['id', 'id', ...] = 書いたモンスターだけが出る
//     pickup     : ピックアップ（出やすくなる）モンスターのID
//     pickupRate : そのレア度が出たとき ピックアップ対象が選ばれる確率（0.5 = 50%）
//     colors     : バナー背景のグラデーション [左上の色, 右下の色]
//
// ■ 例: ほのおタイプだけが出る「ほのおガチャ」を追加する
//   {
//     id: 'fire_only', name: 'ほのお ガチャ', desc: 'ほのおタイプ だけが でる！',
//     rates: { N: 50, R: 30, SR: 14, SSR: 5, UR: 1 },
//     pool: ['hinokon', 'kamadon', 'kitsunebi', 'kaenryu'],
//     pickup: [], pickupRate: 0.5, colors: ['#7a1a08', '#f08030'],
//   },
//   ※ pool に含まれないレア度（この例では UR）の確率は 自動で ほかのレア度に振り分けられます。
// =====================================================================
window.GameData = window.GameData || {};

GameData.rarities = {
  N:   { name: 'ノーマル',           color: '#9aa3ad', glow: '#e5e7eb', stars: 1, pointMult: 1.0, refund: 10 },
  R:   { name: 'レア',               color: '#3b82f6', glow: '#93c5fd', stars: 2, pointMult: 1.3, refund: 30 },
  SR:  { name: 'スーパーレア',       color: '#a855f7', glow: '#d8b4fe', stars: 3, pointMult: 1.6, refund: 100 },
  SSR: { name: 'ダブルスーパーレア', color: '#f59e0b', glow: '#fde68a', stars: 4, pointMult: 2.0, refund: 300 },
  UR:  { name: 'ウルトラレア',       color: '#ec4899', glow: '#fbcfe8', stars: 5, pointMult: 3.0, refund: 1000, rainbow: true },
};

GameData.rarityOrder = ['N', 'R', 'SR', 'SSR', 'UR'];

GameData.gacha = {
  singleCost: 100,
  multiCost: 1000,
  multiCount: 10,
  multiGuarantee: 'SR',
  pityCount: 100,
  pityRarity: 'SSR',
  maxLimitBreak: 5,
  limitBreakBonus: 0.04,
  startLevel: 5,

  banners: [
    // ---- 常設 --------------------------------------------------------
    {
      id: 'standard',
      name: 'スタンダードガチャ',
      desc: 'すべての モンスターが とうじょう！ まずは ここから なかまを ふやそう。',
      rates: { N: 50, R: 30, SR: 14, SSR: 5, UR: 1 },
      pool: null,
      pickup: [],
      pickupRate: 0.5,
      colors: ['#1e3a8a', '#3b82f6'],
    },

    // ---- ピックアップ①: うみの でんせつ ------------------------------
    {
      id: 'pickup_sea',
      name: 'ピックアップ①',
      desc: 'UR ノブナガの出現率UP！',
      rates: { N: 49, R: 30, SR: 14, SSR: 5, UR: 2 },
      pool: null,
      pickup: ['aquaroa', 'shione', 'ikkakujira'],
      pickupRate: 0.5,
      colors: ['#082a5e', '#22c3e0'],
    },

    // ---- ピックアップ②: ほのおと いかずち ----------------------------
    {
      id: 'pickup_storm',
      name: 'ピックアップ②',
      desc: 'UR ヨシモトの出現率UP！',
      rates: { N: 49, R: 30, SR: 14, SSR: 5, UR: 2 },
      pool: null,
      pickup: ['raimeiou', 'kaenryu', 'raigarou'],
      pickupRate: 0.5,
      colors: ['#7a1208', '#f5b820'],
    },
  ],
};
