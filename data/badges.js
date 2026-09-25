// =====================================================================
// バッジの定義
//   ジムリーダー（data/trainers.js）の badge にここの id を書くと、勝利時に入手できます。
//   バッジの数で レベル上限（config.levelCaps）や 通れる道（requireBadges）が変わります。
//   order : 何番目のジムか（表示順）
//   type  : ジムの専門タイプ（表示用）
//   color : バッジの色
// =====================================================================
window.GameData = window.GameData || {};

GameData.badges = [
  { id: 'wind', order: 1, name: 'ウインドバッジ', type: 'flying', color: '#7fc8f8' },
  { id: 'wave', order: 2, name: 'ウェーブバッジ', type: 'water', color: '#3b82f6' },
  { id: 'iron', order: 3, name: 'アイアンバッジ', type: 'steel', color: '#a8b0c0' },
  { id: 'spark', order: 4, name: 'スパークバッジ', type: 'electric', color: '#f8d030' },
];
