// 仮データ（field 担当が本データに置き換える）
window.GameData = window.GameData || {};
GameData.worldStart = { map: 'town1', x: 5, y: 6, dir: 'down' };
GameData.maps = {
  town1: {
    name: 'はじまりのまち', bgm: 'town', border: 'T', indoor: false,
    tiles: [
      'TTTTT::TTTTT',
      'T....::....T',
      'T.hhh::ccc.T',
      'T.wDw::wDw.T',
      'T....::....T',
      'T.F..::..S.T',
      'T....::....T',
      'T.,,,::,,,.T',
      'TTTTTTTTTTTT',
    ],
    warps: [{ x: 5, y: 0, to: 'route1', tx: 5, ty: 8, dir: 'up', requireParty: true }, { x: 6, y: 0, to: 'route1', tx: 6, ty: 8, dir: 'up', requireParty: true }],
    npcs: [{ id: 'n1', x: 3, y: 5, dir: 'down', look: { skin: '#f8d0a8', hair: '#a05020', hairStyle: 'long', shirt: '#40a040', pants: '#604020', hat: null }, move: 'turn', dialog: ['ようこそ はじまりのまちへ！'] }],
    signs: [{ x: 9, y: 5, text: ['はじまりのまち'] }],
    pickups: [],
  },
  route1: {
    name: '1ばんどうろ', bgm: 'route', border: 'T', indoor: false,
    tiles: [
      'TTTTTTTTTTTT',
      'T,,,,::,,,,T',
      'T,,,,::,,,,T',
      'T....::....T',
      'T.o..::..o.T',
      'T,,,,::,,,,T',
      'T,,,,::,,,,T',
      'T....::....T',
      'TTTTT::TTTTT',
    ],
    encounters: { rate: 0.15, table: [{ species: 'hinokon', min: 2, max: 4, weight: 50 }, { species: 'mizupyon', min: 2, max: 4, weight: 30 }] },
    warps: [{ x: 5, y: 8, to: 'town1', tx: 5, ty: 1, dir: 'down' }, { x: 6, y: 8, to: 'town1', tx: 6, ty: 1, dir: 'down' }],
    npcs: [{ id: 't1', x: 8, y: 3, dir: 'left', trainer: 'route1_kenta', sight: 3 }],
    signs: [], pickups: [{ id: 'route1_p1', x: 1, y: 3, points: 50 }],
  },
};
