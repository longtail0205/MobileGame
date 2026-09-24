// =====================================================================
// マップ記号（タイル）の定義
//   maps.js の tiles 配列の1文字 = 1マス(16x16ドット)
//   draw    : js/gfx/tiles.js の描画関数名（自動生成ドット絵）
//   image   : 16x16 の画像パスを指定すると、その画像で描画（例 'assets/tiles/grass.png'）
//   walk    : 歩けるか
//   encounter: 野生モンスターが出るか（マップに encounters がある場合）
//   overlay : キャラの下半身を隠す（草むら）
//   counter : カウンター越しに話しかけられる
// =====================================================================
window.GameData = window.GameData || {};

GameData.tiles = {
  // ---- 屋外 ----
  '.': { name: '草地', draw: 'grass', walk: true },
  ',': { name: '草むら', draw: 'tallgrass', walk: true, encounter: true, overlay: true },
  ':': { name: '土の道', draw: 'path', walk: true },
  's': { name: '砂地', draw: 'sand', walk: true },
  'F': { name: '花畑', draw: 'flower', walk: true },
  'T': { name: '木', draw: 'tree', walk: false },
  'W': { name: '水', draw: 'water', walk: false },
  'B': { name: '橋', draw: 'bridge', walk: true },
  'f': { name: '柵', draw: 'fence', walk: false },
  'o': { name: '岩', draw: 'rock', walk: false },
  'S': { name: '看板', draw: 'sign', walk: false },
  'M': { name: '崖', draw: 'cliff', walk: false },

  // ---- 建物（屋外） ----
  'h': { name: '家の屋根', draw: 'roofHouse', walk: false },
  'c': { name: 'センターの屋根', draw: 'roofCenter', walk: false },
  'g': { name: 'ガチャショップの屋根', draw: 'roofShop', walk: false },
  'j': { name: 'ジムの屋根', draw: 'roofGym', walk: false },
  'w': { name: '建物の壁', draw: 'wall', walk: false },
  'n': { name: '窓', draw: 'window', walk: false },
  'D': { name: 'ドア', draw: 'door', walk: true },

  // ---- 室内 ----
  '_': { name: '床', draw: 'floor', walk: true },
  'K': { name: 'じゅうたん', draw: 'rug', walk: true },
  '#': { name: '室内の壁', draw: 'wallIn', walk: false },
  '=': { name: 'カウンター', draw: 'counter', walk: false, counter: true },
  't': { name: 'テーブル', draw: 'table', walk: false },
  'b': { name: '本棚', draw: 'bookshelf', walk: false },
  'p': { name: '観葉植物', draw: 'plant', walk: false },
  'k': { name: 'ベッド', draw: 'bed', walk: false },
  'm': { name: '出口マット', draw: 'mat', walk: true },
  'G': { name: 'ガチャマシン', draw: 'gachaMachine', walk: false },
  'H': { name: '回復マシン', draw: 'healMachine', walk: false },

  // ---- 洞窟 ----
  'u': { name: '洞窟の床', draw: 'caveFloor', walk: true, encounter: true },
  'q': { name: '洞窟の床（安全）', draw: 'caveFloorSafe', walk: true },
  'r': { name: '洞窟の壁', draw: 'caveWall', walk: false },

  // ---- その他 ----
  'V': { name: '暗闇', draw: 'void', walk: false },
};
