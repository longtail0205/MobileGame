// =====================================================================
// タイプ定義と相性表
// ---------------------------------------------------------------------
// ■ このファイルの編集方法
//
//   GameData.types     … タイプの一覧。キー（英小文字）がタイプID。
//     name  : 画面に表示する名前
//     color : タイプバッジやゲージの色（#RRGGBB）
//
//   GameData.typeChart … 「攻撃するわざのタイプ → 受けるモンスターのタイプ → 倍率」
//     2   = こうかは ばつぐん
//     0.5 = こうかは いまひとつ
//     0   = こうかが ない
//     書いていない組み合わせは すべて 1（ふつう）になります。
//     防御側が2タイプのときは 倍率を掛け算します（例: 2 × 2 = 4倍）。
//
// ■ 例: 「ほのお」わざを「こおり」タイプに 2倍にしたい
//     fire: { ..., ice: 2, ... }
//
// ■ 例: 新しいタイプ「ひかり」を追加したい
//   1. GameData.types に  light: { name: 'ひかり', color: '#F8E878' },  を追加
//   2. typeChart に 攻撃側として  light: { dark: 2, ghost: 2, light: 0.5 },  を追加
//   3. 他のタイプの行にも 防御側として light を書く（例 dark: { ..., light: 0.5 }）
//   4. moves.js / monsters.js で type: 'light' を使えるようになります
//
// ※ 初期データは GBA時代（第3世代）の相性表と同じです。
//    tools/datacheck.html を開くと 書き間違い（存在しないタイプ名など）をチェックできます。
// =====================================================================
window.GameData = window.GameData || {};

GameData.types = {
  normal:   { name: 'ノーマル', color: '#A8A878' },
  fire:     { name: 'ほのお',   color: '#F08030' },
  water:    { name: 'みず',     color: '#6890F0' },
  grass:    { name: 'くさ',     color: '#78C850' },
  electric: { name: 'でんき',   color: '#F0C020' },
  ice:      { name: 'こおり',   color: '#70C8D0' },
  fighting: { name: 'かくとう', color: '#C03028' },
  poison:   { name: 'どく',     color: '#A040A0' },
  ground:   { name: 'じめん',   color: '#D0A850' },
  flying:   { name: 'ひこう',   color: '#9880E8' },
  psychic:  { name: 'エスパー', color: '#F85888' },
  bug:      { name: 'むし',     color: '#A0B020' },
  rock:     { name: 'いわ',     color: '#B09838' },
  ghost:    { name: 'ゴースト', color: '#705898' },
  dragon:   { name: 'ドラゴン', color: '#7038F8' },
  dark:     { name: 'あく',     color: '#705848' },
  steel:    { name: 'はがね',   color: '#A0A0C0' },
};

GameData.typeChart = {
  // 攻撃側:   { 防御側: 倍率, ... }
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  dragon:   { dragon: 2, steel: 0.5 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 },
};
