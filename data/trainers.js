// 仮データ（field 担当が本データに置き換える）
window.GameData = window.GameData || {};
GameData.trainers = {
  route1_kenta: {
    name: 'ケンタ', className: 'たんパンこぞう',
    look: { skin: '#f8d0a8', hair: '#202020', hairStyle: 'spiky', shirt: '#f0c030', pants: '#3060c0', hat: null },
    image: '', party: [{ species: 'hinokon', level: 4 }], reward: 150, ai: 'smart', boss: false, rematch: 'daily',
    intro: ['めが あったら しょうぶだ！'], lose: ['くっそー まけた！'], win: ['へへん ぼくの かちだね'], after: ['つぎは まけないからな！'],
  },
};
