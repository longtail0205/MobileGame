// =====================================================================
// マップの定義（GameData.maps）と ゲーム開始位置（GameData.worldStart）
//
// 【編集のしかた】
//   ・tiles … 1文字 = 1マス（16x16ドット）。記号の意味は data/tiles.js を参照。
//             全行を同じ長さにすること。左上が (x:0, y:0)。
//   ・bgm   … 'title' 'town' 'route' 'forest' 'cave' 'gym' 'gacha' など（js/core/audio.js の曲名）
//   ・border… マップの外側に描くタイル記号（屋外は 'T'、室内・洞窟は 'V' や 'r'）
//   ・indoor… true = 室内（マップ名を表示しない）
//   ・encounters … 野生モンスター。encounter:true のタイル（草むら ,  洞窟の床 u）を歩くと出現。
//        rate: 1歩あたりの確率（省略時 config.encounterRate）
//        table: [{ species: モンスターID, min: 最低Lv, max: 最高Lv, weight: 出やすさ }]
//   ・warps … そのマスに乗った瞬間に (to マップの tx, ty) へ移動。dir は移動後の向き。
//        requireParty: true … モンスターを持っていないと通れない
//        ドア D の先は 室内の出口マット m の「1マス上」に、マット m の先は ドアの「1マス下」にすると自然。
//   ・npcs  … { id, x, y, dir:'up'|'down'|'left'|'right', look:{見た目}, move:'still'|'turn'|'wander', dialog:['セリフ', ...] }
//        heal: true        … 回復してくれる（回復した場所が 全滅時の もどり先になる）
//        action: 'gacha'   … ガチャ画面へ案内する
//        trainer: 'ID'     … data/trainers.js のトレーナー（look は トレーナー側）。sight = 視線のマス数（省略時 3）
//        hideAfter: 'ID'   … その トレーナーを 倒すと いなくなる（通せんぼ用）
//        カウンター = の むこうの NPC にも 話しかけられる。
//   ・signs … { x, y, text: ['1ページめ', '2ページめ'] }（看板 S の位置に置く）
//   ・pickups … { id: 一意なID, x, y, points } 一度だけ拾えるポイント（キラキラ光る）
//   セリフの {player} は主人公の名前に置き換わる。'\n' で改行。
//
// 【建物の作り方（見栄えのコツ）】
//   家: hhhh / hhhh / wnDw   センター: ccccc / ccccc / wnDnw   ショップ: ggggg / ggggg / wnDnw
//   ジム: jjjjjj ×3行 / nwwwwn / wwwDww   ドアの前には 道 : を1マス置く。建物どうしは1マス以上はなす。
//   室内: 上の壁 # は2行。出口は ####mm#### のように下の壁に置く。
// =====================================================================
window.GameData = window.GameData || {};

// ゲーム開始位置（主人公の家の 2かい…ではなく 自分の へや）
GameData.worldStart = { map: 'town1_house', x: 7, y: 3, dir: 'down' };

GameData.maps = {
  // ================================================================== コモレビタウン
  town1: {
    name: 'コモレビタウン',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTT::TTTTTTTTTTT',
      'TT.F.......::.......F.TT',
      'T..........::..........T',
      'T..hhhh....::..ccccc...T',
      'T..hhhh....::..ccccc...T',
      'T..wnDw....::..wnDnw...T',
      'Tfff.:...S.::....:.....T',
      'T..::::::::::::::::::..T',
      'T..::::::::::::::::::..T',
      'T..........::..........T',
      'T..........::.FWWWWWWF.T',
      'T..ggggg...::.FWWWWWWF.T',
      'T..ggggg...::..WWWWWW..T',
      'T..wnDnw...::..WWWWWW..T',
      'T....:..S..::..........T',
      'T..::::::::::::::::::..T',
      'T..FFF.............FFF.T',
      'TT....................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 11, y: 0, to: 'route1', tx: 11, ty: 28, dir: 'up', requireParty: true },
      { x: 12, y: 0, to: 'route1', tx: 12, ty: 28, dir: 'up', requireParty: true },
      { x: 5, y: 5, to: 'town1_house', tx: 5, ty: 6, dir: 'up' },
      { x: 17, y: 5, to: 'town1_center', tx: 5, ty: 7, dir: 'up' },
      { x: 5, y: 13, to: 'town1_shop', tx: 5, ty: 7, dir: 'up' },
    ],
    npcs: [
      {
        id: 'boy', x: 13, y: 2, dir: 'down', move: 'turn',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'spiky', shirt: '#40b060', pants: '#604020', hat: null },
        dialog: ['この さきは 1ばんどうろ だよ。', 'くさむらには やせいの モンスターが いるから', 'モンスターを もたずに いくのは あぶないよ！'],
      },
      {
        id: 'girl', x: 8, y: 9, dir: 'down', move: 'wander',
        look: { skin: '#f8d8b8', hair: '#c06030', hairStyle: 'long', shirt: '#40a0e0', pants: '#f0f0f0', hat: null },
        dialog: ['ガチャで てにいれた モンスターは', '「へんせい」タブで パーティに いれられるの。', 'パーティの せんとうの こが さいしょに たたかうのよ！'],
      },
      {
        id: 'oldman', x: 22, y: 12, dir: 'left', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#d8d8d8', hairStyle: 'bald', shirt: '#806040', pants: '#404040', hat: null },
        dialog: ['おなじ モンスターが ガチャで かさなると', '「とつ」が ふえて のうりょくが あがるんじゃ。', 'さいだい 5とつ まで つよく なるぞい！'],
      },
    ],
    signs: [
      { x: 9, y: 6, text: ['コモレビタウン', 'こもれびが やさしく ふりそそぐ まち'] },
      { x: 8, y: 14, text: ['ガチャショップ', 'ガチャで あたらしい なかまを てにいれよう！'] },
    ],
    pickups: [
      { id: 'town1_p1', x: 21, y: 17, points: 50 },
    ],
  },

  // ---------------------------------------------------------------- 主人公の家
  town1_house: {
    name: 'じぶんの いえ',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '##########',
      '##########',
      '#bb___p_k#',
      '#_______k#',
      '#__tt____#',
      '#__tt__KK#',
      '#p_____KK#',
      '####mm####',
    ],
    warps: [
      { x: 4, y: 7, to: 'town1', tx: 5, ty: 6, dir: 'down' },
      { x: 5, y: 7, to: 'town1', tx: 5, ty: 6, dir: 'down' },
    ],
    npcs: [
      {
        id: 'mom', x: 5, y: 4, dir: 'left', move: 'turn',
        look: { skin: '#f8d8b8', hair: '#804020', hairStyle: 'bun', shirt: '#e87858', pants: '#586878', hat: null, accent: '#ffffff' },
        dialog: ['おはよう {player}！', 'モンスターが いないと まちの そとには でられないわよ。', 'まずは ガチャショップで ガチャを まわして みたら？', 'つかれたら モンスターセンターで やすませて あげてね。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- コモレビタウン モンスターセンター
  town1_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town1', tx: 17, ty: 6, dir: 'down' },
      { x: 6, y: 8, to: 'town1', tx: 17, ty: 6, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['ガチャの あんないがかり です！', 'モンスターは ガチャで てに いれるのが きほん。', 'ポイントを ためて どんどん まわそう！'],
      },
      {
        id: 'visitor', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#5a3a20', hairStyle: 'short', shirt: '#d05050', pants: '#384058', hat: '#3050a0' },
        dialog: ['たおれた モンスターは ここで かいふく できるよ。', 'ぜんめつ すると さいごに かいふくした ばしょに もどされるんだ。', 'こまめに よると あんしん だね！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- ガチャショップ
  town1_shop: {
    name: 'ガチャショップ',
    bgm: 'gacha',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#G_G____G_G#',
      '#___====___#',
      '#__________#',
      '#__KKKKKK__#',
      '#p_KKKKKK_p#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town1', tx: 5, ty: 14, dir: 'down' },
      { x: 6, y: 8, to: 'town1', tx: 5, ty: 14, dir: 'down' },
    ],
    npcs: [
      {
        id: 'clerk', x: 5, y: 2, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#303030', hairStyle: 'short', shirt: '#8040c0', pants: '#302050', hat: '#f8c030', accent: '#f8f8f8' },
        dialog: ['いらっしゃいませ！ ガチャショップへ ようこそ！'],
      },
      {
        id: 'fan1', x: 1, y: 3, dir: 'up', move: 'still',
        look: { skin: '#f8d8b8', hair: '#e06080', hairStyle: 'bun', shirt: '#f8f0a0', pants: '#6080c0', hat: null },
        dialog: ['10れんガチャは さいごの 1かいが', 'SR いじょう かくてい なんだって！', 'ポイントを ためて いっきに まわすのも アリね。'],
      },
      {
        id: 'fan2', x: 8, y: 5, dir: 'left', move: 'wander',
        look: { skin: '#e8b890', hair: '#3a2a60', hairStyle: 'spiky', shirt: '#303030', pants: '#707070', hat: null, accent: '#f8c030' },
        dialog: ['ガチャを 100かい まわしても SSR が でないと', 'つぎは SSR いじょうが かくていで でるらしいよ！', 'いわゆる 「てんじょう」って やつさ。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ================================================================== 1ばんどうろ
  route1: {
    name: '1ばんどうろ',
    bgm: 'route',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTT::TTTTTTTTTT',
      'TTTTTTTTT.::.TTTTTTTTT',
      'TTT,,,,...::....FF.TTT',
      'TT.,,,,,..::.........T',
      'TT.,,,,,..::S...o....T',
      'TT..,,,...::.........T',
      'TTT.......:::::::....T',
      'TTTT......:::::::....T',
      'TTTTTT.........::....T',
      'T...ff.......,,::,,..T',
      'T....f.......,,::,,,.T',
      'T.o..f.......,,::,,,.T',
      'T........TT..,,::,,..T',
      'TMMMMMMMMMMMMM.::.MMMT',
      'T..............::....T',
      'T..,,,,,,......::....T',
      'T..,,,,,,..::::::....T',
      'T..,,,,,,..::::::.F..T',
      'T..,,,,,,..::....FFF.T',
      'T..........::.....F..T',
      'TWWWW......::........T',
      'TWWWW....S.::..,,,,..T',
      'TWWWW......::..,,,,..T',
      'TWWWW......::..,,,,..T',
      'T..........::........T',
      'TT..ffff...::...ffff.T',
      'TTT........::.......TT',
      'TTTT.......::......TTT',
      'TTTTTTTTTT.::.TTTTTTTT',
      'TTTTTTTTTTT::TTTTTTTTT',
    ],
    encounters: {
      rate: 0.12,
      table: [
        { species: 'chunpi', min: 2, max: 5, weight: 30 },
        { species: 'watamochi', min: 2, max: 5, weight: 25 },
        { species: 'imomun', min: 2, max: 4, weight: 20 },
        { species: 'tsubomin', min: 3, max: 6, weight: 12 },
        { species: 'pirinezu', min: 3, max: 6, weight: 8 },
        { species: 'kasabou', min: 4, max: 6, weight: 5 },
      ],
    },
    warps: [
      { x: 10, y: 0, to: 'forest', tx: 6, ty: 24, dir: 'up' },
      { x: 11, y: 0, to: 'forest', tx: 7, ty: 24, dir: 'up' },
      { x: 11, y: 29, to: 'town1', tx: 11, ty: 1, dir: 'down' },
      { x: 12, y: 29, to: 'town1', tx: 12, ty: 1, dir: 'down' },
    ],
    npcs: [
      { id: 't_kenta', x: 15, y: 19, dir: 'left', trainer: 'route1_kenta', sight: 4, move: 'still' },
      { id: 't_yui', x: 20, y: 10, dir: 'left', trainer: 'route1_yui', sight: 5, move: 'turn' },
      { id: 't_souta', x: 13, y: 14, dir: 'right', trainer: 'route1_souta', sight: 2, move: 'turn' },
      { id: 't_mio', x: 8, y: 3, dir: 'right', trainer: 'route1_mio', sight: 2, move: 'still' },
      {
        id: 'walker', x: 14, y: 24, dir: 'down', move: 'wander',
        look: { skin: '#f0c8a0', hair: '#886040', hairStyle: 'short', shirt: '#e0a040', pants: '#405080', hat: '#40a060' },
        dialog: ['くさむらに はいると やせいの モンスターが とびだして くるよ！', 'かつと ポイントが もらえるんだ。', 'ポイントを ためて ガチャを まわそう！'],
      },
    ],
    signs: [
      { x: 12, y: 4, text: ['1ばんどうろ', '↑ ささやきのもり   ↓ コモレビタウン'] },
      { x: 9, y: 21, text: ['1ばんどうろ', 'くさむらでは やせいの モンスターに ちゅうい！'] },
    ],
    pickups: [
      { id: 'route1_p1', x: 2, y: 10, points: 100 },
      { id: 'route1_p2', x: 20, y: 5, points: 50 },
    ],
  },

  // ================================================================== ささやきのもり
  forest: {
    name: 'ささやきのもり',
    bgm: 'forest',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTT::TTTTT',
      'TTTTTTTTTTTTTTTTTTTT.::.TTTT',
      'TTTT..FF...TTTT,,,,,.::..TTT',
      'TTT........TTTT,,,,,.::...TT',
      'TTT...::::::::::::::::::..TT',
      'TT....::::::::::::::::::..TT',
      'TT.,,,::.TTTTTTTTTTTTTTT.TTT',
      'TT.,,,::.TTTTTTTTTTTTTTTTTTT',
      'TT.,,,::..TTTTT.....TTTTTTTT',
      'TTT...::...TTT..WWW..TTTTTTT',
      'TTTT..::....TT..WWW...TTTTTT',
      'TTTT..::::::::::::::::..TTTT',
      'TTTT..::::::::::::::::..TTTT',
      'TTTTTT,,,,,,TTTTTTTT::,,TTTT',
      'TTTTT,,,,,,,,TTTTTTT::,,,TTT',
      'TTTT,,,,,,,,,,.TTTTT::,,,,TT',
      'TTTT,,,,,,,,,,..TTTT::,,,,TT',
      'TTTTT,,,,,,,,...TTTT::..TTTT',
      'TTTTTT..........TTTT::..TTTT',
      'TTTT..::::::::::::::::..TTTT',
      'TTTT..::::::::::::::::..TTTT',
      'TTTT..::..TTTTTTTTTTTTTTTTTT',
      'TTTT..::S,,,TTTTTTTTTTTTTTTT',
      'TTTT.F::.,,,,TTTTTTTTTTTTTTT',
      'TTTTT.::.,,,TTTTTTTTTTTTTTTT',
      'TTTTTT::TTTTTTTTTTTTTTTTTTTT',
    ],
    encounters: {
      rate: 0.14,
      table: [
        { species: 'imomun', min: 5, max: 8, weight: 20 },
        { species: 'hirarin', min: 6, max: 9, weight: 18 },
        { species: 'tsubomin', min: 5, max: 8, weight: 15 },
        { species: 'yurari', min: 6, max: 9, weight: 10 },
        { species: 'kageneko', min: 6, max: 9, weight: 10 },
        { species: 'kasabou', min: 6, max: 9, weight: 10 },
        { species: 'haribachi', min: 7, max: 10, weight: 8 },
        { species: 'kamakirin', min: 8, max: 10, weight: 5 },
        { species: 'dokuname', min: 5, max: 8, weight: 4 },
      ],
    },
    warps: [
      { x: 6, y: 25, to: 'route1', tx: 10, ty: 1, dir: 'down' },
      { x: 7, y: 25, to: 'route1', tx: 11, ty: 1, dir: 'down' },
      { x: 21, y: 0, to: 'route2', tx: 4, ty: 18, dir: 'up' },
      { x: 22, y: 0, to: 'route2', tx: 5, ty: 18, dir: 'up' },
    ],
    npcs: [
      { id: 't_shun', x: 14, y: 18, dir: 'down', trainer: 'forest_shun', sight: 2, move: 'still' },
      { id: 't_nana', x: 4, y: 5, dir: 'right', trainer: 'forest_nana', sight: 5, move: 'still' },
      { id: 't_kota', x: 22, y: 17, dir: 'left', trainer: 'forest_kota', sight: 2, move: 'turn' },
      { id: 't_kei', x: 24, y: 3, dir: 'left', trainer: 'forest_kei', sight: 2, move: 'still' },
      {
        id: 'runner', x: 9, y: 8, dir: 'left', move: 'turn',
        look: { skin: '#f8d0a8', hair: '#e05030', hairStyle: 'spiky', shirt: '#f8f8f8', pants: '#3060c0', hat: null, accent: '#e03030' },
        dialog: ['Bボタンを おしながら あるくと はしれるんだ。', 'ひろい もりも あっというま だよ！'],
      },
    ],
    signs: [
      { x: 8, y: 22, text: ['ささやきのもり', 'こえの する ほうへ すすめば でぐちに つく…'] },
    ],
    pickups: [
      { id: 'forest_p1', x: 15, y: 8, points: 100 },
      { id: 'forest_p2', x: 24, y: 6, points: 150 },
    ],
  },

  // ================================================================== 2ばんどうろ
  route2: {
    name: '2ばんどうろ',
    bgm: 'route',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTWWWTTTTTTTTTTTTTTT',
      'TTT.....,,,,.sWWWs..,,,,,,,,..TT',
      'TT......,,,,.sWWWs..,,,,,,,,..TT',
      'TT.o.........sWWWs..MMMMMMMMMMTT',
      'TT...F.......sWWWs..MMMMMMMMMMTT',
      'TT..FFF......sWWWs.............T',
      'TT...F.......sWWWs...,,,,,,....T',
      'TT...........sWWWs...,,,,,,....T',
      'TT...........sWWWs...,,,,,,....T',
      'TT..::::::::::BBB:::::::::::::::',
      'TT..::::::::::WWW:::::::::::::::',
      'TT.S::.......sWWWs.............T',
      'TT..::.,,,,,.sWWWs..,,,,,,,,...T',
      'TT..::.,,,,,.sWWWs..,,,,,,,,...T',
      'TT..::.,,,,,.sWWWs..,,,,,,,,.o.T',
      'TT..::.,,,,,.sWWWs.............T',
      'TT..::.......sWWWsffffff.......T',
      'TTT.::......TsWWWsTTTTTTTTTTTTTT',
      'TTTT::TTTTTTTTWWWTTTTTTTTTTTTTTT',
      'TTTT::TTTTTTTTWWWTTTTTTTTTTTTTTT',
    ],
    encounters: {
      rate: 0.13,
      table: [
        { species: 'dorocchi', min: 10, max: 13, weight: 14 },
        { species: 'koishin', min: 10, max: 13, weight: 14 },
        { species: 'kobushin', min: 11, max: 14, weight: 12 },
        { species: 'dokuname', min: 10, max: 13, weight: 10 },
        { species: 'burikin', min: 11, max: 14, weight: 10 },
        { species: 'medakka', min: 10, max: 13, weight: 8 },
        { species: 'yoroidama', min: 12, max: 15, weight: 8 },
        { species: 'kamadon', min: 12, max: 15, weight: 6 },
        { species: 'kazekiri', min: 12, max: 15, weight: 6 },
        { species: 'shinobin', min: 13, max: 16, weight: 5 },
        { species: 'biriunagi', min: 13, max: 16, weight: 4 },
        { species: 'mayukabuto', min: 16, max: 16, weight: 2 },     // 進化後（イモムン Lv16）
        { species: 'hanasakin', min: 16, max: 16, weight: 2 },      // 進化後（ツボミン Lv16）
        { species: 'raigarou', min: 14, max: 16, weight: 1.5 },
        { species: 'tatsumaru', min: 14, max: 16, weight: 1.5 },
      ],
    },
    warps: [
      { x: 4, y: 19, to: 'forest', tx: 21, ty: 1, dir: 'down' },
      { x: 5, y: 19, to: 'forest', tx: 22, ty: 1, dir: 'down' },
      { x: 31, y: 9, to: 'town2', tx: 1, ty: 11, dir: 'right' },
      { x: 31, y: 10, to: 'town2', tx: 1, ty: 12, dir: 'right' },
    ],
    npcs: [
      { id: 't_takumi', x: 8, y: 11, dir: 'up', trainer: 'route2_takumi', sight: 2, move: 'still' },
      { id: 't_rin', x: 24, y: 11, dir: 'up', trainer: 'route2_rin', sight: 2, move: 'turn' },
      { id: 't_daichi', x: 27, y: 6, dir: 'down', trainer: 'route2_daichi', sight: 3, move: 'still' },
      { id: 't_misaki', x: 11, y: 8, dir: 'down', trainer: 'route2_misaki', sight: 1, move: 'turn' },
      { id: 't_shinobu', x: 19, y: 11, dir: 'up', trainer: 'route2_shinobu', sight: 1, move: 'still' },
      {
        id: 'hiker', x: 19, y: 7, dir: 'down', move: 'turn',
        look: { skin: '#d8a070', hair: '#403020', hairStyle: 'short', shirt: '#c04030', pants: '#605040', hat: '#e0b040' },
        dialog: ['この さきの カザミタウンには ジムが あるんだ。', 'ジムリーダーは ひこうタイプの つかいて。', 'でんき・いわ・こおりタイプの わざが こうかばつぐん だよ！'],
      },
    ],
    signs: [
      { x: 3, y: 11, text: ['2ばんどうろ', '→ カザミタウン   ↓ ささやきのもり'] },
    ],
    pickups: [
      { id: 'route2_p1', x: 28, y: 1, points: 150 },
      { id: 'route2_p2', x: 30, y: 14, points: 100 },
    ],
  },

  // ================================================================== カザミタウン
  town2: {
    name: 'カザミタウン',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTT:TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTT:TTTT',
      'TT.....................::.TT',
      'TT.....................::S.T',
      'TT.............F.F.....::..T',
      'TT.............jjjjjj..::..T',
      'TT.............jjjjjj..::..T',
      'TT..ccccc......jjjjjj..::..T',
      'TT..ccccc......nwwwwn..::..T',
      'TT..wnDnw..S...wwwDww..::..T',
      'TT....:...........:..S.::..T',
      '::::::::::::::::::::::::::.T',
      '::::::::::::::::::::::::::.T',
      'T..........::..............T',
      'T..hhhh....::....FFF.......T',
      'T..hhhh....::...WWWWWW.....T',
      'T..wnDw....::...WWWWWW..F..T',
      'T....:.....::...WWWWWW.....T',
      'T..:::::::::::....FF..ffff.T',
      'T..:::::::::::.............T',
      'TTT.....................TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, y: 11, to: 'route2', tx: 30, ty: 9, dir: 'left' },
      { x: 0, y: 12, to: 'route2', tx: 30, ty: 10, dir: 'left' },
      { x: 6, y: 9, to: 'town2_center', tx: 5, ty: 7, dir: 'up' },
      { x: 18, y: 9, to: 'gym', tx: 5, ty: 14, dir: 'up' },
      { x: 5, y: 16, to: 'town2_house', tx: 5, ty: 6, dir: 'up' },
      { x: 23, y: 0, to: 'route3', tx: 12, ty: 28, dir: 'up', requireBadges: 1 },
    ],
    npcs: [
      {
        id: 'guard', x: 23, y: 2, dir: 'down', move: 'still', requireBadges: 1,
        look: { skin: '#d8a070', hair: '#303030', hairStyle: 'short', shirt: '#607040', pants: '#403828', hat: '#c8a060' },
        dialog: ['この さきは 3ばんどうろ。 みなとまちへ つづく みちだ。', 'やせいの モンスターが ぐっと つよく なる。', 'このさきは ジムバッジを 1つ もってから！'],
      },
      {
        id: 'lady', x: 9, y: 13, dir: 'down', move: 'wander',
        look: { skin: '#f8d8c0', hair: '#402818', hairStyle: 'long', shirt: '#f0a040', pants: '#fff0d0', hat: null },
        dialog: ['ジムリーダーの フウカさんは ひこうタイプの つかいて。', 'でんき・いわ・こおりの わざが よく きくわよ！'],
      },
      {
        id: 'fisher', x: 23, y: 16, dir: 'left', move: 'turn',
        look: { skin: '#e0b088', hair: '#707070', hairStyle: 'short', shirt: '#3070a0', pants: '#304050', hat: '#f0f0f0' },
        dialog: ['ガチャで おなじ モンスターが でると 「とつ」が ふえるんだ。', 'とつが ふえると のうりょくが アップ！', 'さいだいまで とつると ポイントが もどって くるよ。'],
      },
      {
        id: 'kid', x: 15, y: 19, dir: 'up', move: 'wander',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'spiky', shirt: '#e04070', pants: '#304880', hat: null },
        dialog: ['ポイントは やせいの モンスターや トレーナーに かつと もらえるよ。', 'みちに おちてる ことも あるんだって！'],
      },
    ],
    signs: [
      { x: 11, y: 9, text: ['カザミタウン', 'かぜの ふきぬける おかの まち'] },
      { x: 21, y: 10, text: ['カザミジム', 'ジムリーダー フウカ', '「そらを かける かぜの つかいて」'] },
      { x: 25, y: 3, text: ['↑ 3ばんどうろ ・ シオサイタウン', 'ジムバッジを 1つ もっていないと とおれません'] },
    ],
    pickups: [
      { id: 'town2_p1', x: 3, y: 20, points: 100 },
    ],
  },

  // ---------------------------------------------------------------- カザミタウン モンスターセンター
  town2_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town2', tx: 6, ty: 10, dir: 'down' },
      { x: 6, y: 8, to: 'town2', tx: 6, ty: 10, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['ジムに いどむ なら なかまを ふやして おこう！', 'タイプの ちがう モンスターが いると こころづよいよ。'],
      },
      {
        id: 'trainer_fan', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f8d8b8', hair: '#206080', hairStyle: 'long', shirt: '#f8f8f8', pants: '#d04060', hat: null },
        dialog: ['ジムに いどむ まえに モンスターを かいふく しておこう。', 'ここで かいふく すると まけても ここに もどって これるよ。', 'それと… バッジを あつめると レベルの じょうげんが あがるんだ。', 'バッジ 0こ なら Lv20、 1こ で Lv30 まで そだつよ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- カザミタウンの民家
  town2_house: {
    name: 'カザミタウンの いえ',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '##########',
      '##########',
      '#bb___p_k#',
      '#_______k#',
      '#__tt____#',
      '#__tt__KK#',
      '#p_____KK#',
      '####mm####',
    ],
    warps: [
      { x: 4, y: 7, to: 'town2', tx: 5, ty: 17, dir: 'down' },
      { x: 5, y: 7, to: 'town2', tx: 5, ty: 17, dir: 'down' },
    ],
    npcs: [
      {
        id: 'granny', x: 5, y: 4, dir: 'down', move: 'still',
        look: { skin: '#f0c8a0', hair: '#e8e8e8', hairStyle: 'bun', shirt: '#a060a0', pants: '#605060', hat: null },
        dialog: ['あら いらっしゃい。', 'モンスターには それぞれ タイプが あるの。', 'タイプの あいしょうを かんがえて たたかうと', 'ぐっと らくに なるわよ。'],
      },
      {
        id: 'grandson', x: 3, y: 6, dir: 'up', move: 'turn',
        look: { skin: '#f8d0a8', hair: '#502810', hairStyle: 'short', shirt: '#50a0f0', pants: '#e0e0e0', hat: null },
        dialog: ['ぼく しょうらい ジムリーダーに なるんだ！', 'レアどの たかい モンスターほど のうりょくが たかいんだよ。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- カザミジム
  gym: {
    name: 'カザミジム',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p___KK___p#',
      '#____KK____#',
      '#pp__KK__pp#',
      '#____KK____#',
      '#pppp__pppp#',
      '#__________#',
      '#__________#',
      '#_pppppppp_#',
      '#__________#',
      '#__________#',
      '#pppp__pppp#',
      '#____KK____#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 15, to: 'town2', tx: 18, ty: 10, dir: 'down' },
      { x: 6, y: 15, to: 'town2', tx: 18, ty: 10, dir: 'down' },
    ],
    npcs: [
      { id: 't_leader', x: 5, y: 2, dir: 'down', trainer: 'kazami_leader', sight: 0, move: 'still' },
      { id: 't_hayate', x: 2, y: 7, dir: 'right', trainer: 'gym_hayate', sight: 4, move: 'still' },
      { id: 't_sora', x: 9, y: 10, dir: 'left', trainer: 'gym_sora', sight: 4, move: 'still' },
      {
        id: 'gym_guide', x: 8, y: 14, dir: 'left', move: 'still',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#f8f8f8', pants: '#3050a0', hat: '#3050a0', accent: '#f8c030' },
        dialog: ['よう！ しょうらいの チャンピオン！', 'ここ カザミジムの リーダーは ひこうタイプの つかいてだ。', 'でんき・いわ・こおりの わざで せめるんだぞ！', 'まけたら センターで かいふく してから また こい！', 'リーダーに かって バッジを もらうと レベルの じょうげんが あがるぞ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ================================================================== 3ばんどうろ（カザミタウン → シオサイタウン）
  route3: {
    name: '3ばんどうろ',
    bgm: 'route',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTWWWWWWW',
      'TTT....,,,,,,...TTsssWWWWW',
      'TT.....,,,,,,....sssssWWWW',
      'TT..o..,,,,,,.....sssssWWW',
      'TT...................ssssT',
      'TT....::::::::::::::::::::',
      'TT....::::::::::::::::::::',
      'TT....::....FF.....sssssTT',
      'TTT...::..,,,,,,...sWWWsTT',
      'TTTT..::..,,,,,,...sWWWsTT',
      'TT....::..,,,,,,...sWWWsTT',
      'TT..S.::............sssTTT',
      'TT....::::::::::::::::..TT',
      'TT....::::::::::::::::..TT',
      'TTTT..........,,,,,::,,.TT',
      'TT..,,,,,.....,,,,,::,,.TT',
      'TT..,,,,,.....,,,,,::,,.TT',
      'TT..,,,,,..o.......::...TT',
      'TT.................::.F.TT',
      'TTffffff....:::::::::..TTT',
      'TT..........:::::::::...TT',
      'TT..,,,,,,..::......,,,.TT',
      'TT..,,,,,,..::..WWW.,,,.TT',
      'TT..,,,,,,..::..WWW.,,,.TT',
      'TT..........::..........TT',
      'TTT...FF....::....FF...TTT',
      'TTTT........::........TTTT',
      'TTTTTTTTTTT.::.TTTTTTTTTTT',
      'TTTTTTTTTTTT::TTTTTTTTTTTT',
      'TTTTTTTTTTTT::TTTTTTTTTTTT',
    ],
    encounters: {
      rate: 0.13,
      table: [
        { species: 'suzutaka', min: 18, max: 23, weight: 10 },    // 進化後（チュンピ Lv17）
        { species: 'medakka', min: 18, max: 19, weight: 8 },
        { species: 'hayaseuo', min: 20, max: 24, weight: 8 },     // 進化後（メダッカ Lv20）
        { species: 'dokuname', min: 18, max: 21, weight: 6 },
        { species: 'dokumaimai', min: 22, max: 25, weight: 5 },   // 進化後（ドクナメ Lv22）
        { species: 'yukichidori', min: 19, max: 23, weight: 7 },
        { species: 'kazekiri', min: 19, max: 24, weight: 7 },
        { species: 'bachinezu', min: 19, max: 23, weight: 7 },    // 進化後（ピリネズ Lv18）
        { species: 'biriunagi', min: 19, max: 23, weight: 6 },
        { species: 'numabouzu', min: 20, max: 24, weight: 7 },    // 進化後（ドロッチ Lv20）
        { species: 'genkotsun', min: 19, max: 23, weight: 6 },    // 進化後（コブシン Lv18）
        { species: 'gansekin', min: 19, max: 23, weight: 6 },     // 進化後（コイシン Lv18）
        { species: 'fuwadaifuku', min: 20, max: 24, weight: 5 },  // 進化後（ワタモチ Lv20）
        { species: 'burikingu', min: 22, max: 25, weight: 4 },    // 進化後（ブリキン Lv22）
        { species: 'haribachi', min: 20, max: 24, weight: 4 },
        { species: 'mizupyon', min: 18, max: 22, weight: 2 },
        { species: 'ikkakujira', min: 22, max: 26, weight: 1.5 },
        { species: 'sunakujira', min: 22, max: 26, weight: 1.5 },
        { species: 'kitsunebi', min: 23, max: 26, weight: 1 },
      ],
    },
    warps: [
      { x: 12, y: 29, to: 'town2', tx: 23, ty: 1, dir: 'down' },
      { x: 13, y: 29, to: 'town2', tx: 23, ty: 1, dir: 'down' },
      { x: 25, y: 5, to: 'town3', tx: 1, ty: 8, dir: 'right' },
      { x: 25, y: 6, to: 'town3', tx: 1, ty: 9, dir: 'right' },
    ],
    npcs: [
      { id: 't_genzou', x: 15, y: 7, dir: 'up', trainer: 'route3_genzou', sight: 1, move: 'turn' },
      { id: 't_nagi', x: 22, y: 13, dir: 'left', trainer: 'route3_nagi', sight: 2, move: 'still' },
      { id: 't_tsubasa', x: 8, y: 20, dir: 'right', trainer: 'route3_tsubasa', sight: 4, move: 'still' },
      {
        id: 'traveler', x: 15, y: 24, dir: 'down', move: 'wander',
        look: { skin: '#f0c8a0', hair: '#604020', hairStyle: 'short', shirt: '#4080c0', pants: '#584838', hat: '#c07030', accent: '#ffffff' },
        dialog: ['レベルが じょうげんまで そだった モンスターは', 'けいけんちを もらっても レベルが あがらない。', 'でも あふれた けいけんちは ポイントに なるんだ！', 'ガチャを まわす たしに なるぞ。'],
      },
    ],
    signs: [
      { x: 4, y: 11, text: ['3ばんどうろ', '→ シオサイタウン   ↓ カザミタウン'] },
    ],
    pickups: [
      { id: 'route3_p1', x: 3, y: 1, points: 200 },
      { id: 'route3_p2', x: 23, y: 18, points: 250 },
    ],
  },

  // ================================================================== シオサイタウン（みなとまち）
  town3: {
    name: 'シオサイタウン',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTT:TTTTTTTTTTTTT',
      'TTTTTTTTTTTTTT:TTTTTTTTTTTTT',
      'TT..........S::..........TTT',
      'TT..ccccc....::..jjjjjj..TTT',
      'TT..ccccc....::..jjjjjj..TTT',
      'TT..wnDnw....::..jjjjjj..sWW',
      'TT....:......::..nwwwwn..sWW',
      'TT....:......::..wwwDww.SsWW',
      '::::::::::::::::::::::::.sWW',
      '::::::::::::::::::::::::ssWW',
      'T..........::...........sWWW',
      'T..hhhh....::....S....ssWWWW',
      'T..hhhh....::........sssWWWW',
      'T..wnDw....::.......sssBBBBW',
      'T....:.....::......ssssWWWWW',
      'T..:::::::::::....sssssWWWWW',
      'T..FF.............ssssWWWWWW',
      'TT...........F...sssWWWWWWWW',
      'TTTTTTTTTTTTTTTTTWWWWWWWWWWW',
    ],
    warps: [
      { x: 0, y: 8, to: 'route3', tx: 24, ty: 5, dir: 'left' },
      { x: 0, y: 9, to: 'route3', tx: 24, ty: 6, dir: 'left' },
      { x: 6, y: 5, to: 'town3_center', tx: 5, ty: 7, dir: 'up' },
      { x: 20, y: 7, to: 'gym2', tx: 5, ty: 14, dir: 'up' },
      { x: 5, y: 13, to: 'town3_house', tx: 5, ty: 6, dir: 'up' },
      { x: 14, y: 0, to: 'cave', tx: 14, ty: 22, dir: 'up', requireBadges: 2 },
    ],
    npcs: [
      {
        id: 'guard', x: 14, y: 2, dir: 'down', move: 'still', requireBadges: 2,
        look: { skin: '#c89068', hair: '#303030', hairStyle: 'short', shirt: '#283870', pants: '#303040', hat: '#283870', accent: '#f8c030' },
        dialog: ['この さきは ほしくずのどうくつ。', 'しんかした つよい モンスターが うようよ いる。', 'このさきは ジムバッジを 2つ もってから！'],
      },
      {
        id: 'sailor', x: 8, y: 10, dir: 'down', move: 'wander',
        look: { skin: '#d8a070', hair: '#202020', hairStyle: 'short', shirt: '#f8f8f8', pants: '#283870', hat: '#f8f8f8', accent: '#3050a0' },
        dialog: ['ようこそ みなとまち シオサイタウンへ！', 'ジムリーダーの ミナモさんは みずタイプの つかいてさ。', 'でんきや くさの わざが よく きくぜ！'],
      },
      {
        id: 'fisher', x: 26, y: 13, dir: 'left', move: 'turn',
        look: { skin: '#e0b088', hair: '#808080', hairStyle: 'short', shirt: '#607048', pants: '#403828', hat: '#e0c060' },
        dialog: ['この さんばしは つりの めいしょ なんじゃ。', 'わしの モンスターは とっくに じょうげんの Lv まで そだっとる。', 'たたかっても あふれた けいけんちが ポイントに なるだけじゃ… ほっほっ。'],
      },
      {
        id: 'girl', x: 16, y: 15, dir: 'up', move: 'wander',
        look: { skin: '#f8d8c0', hair: '#f08040', hairStyle: 'bun', shirt: '#80d0f0', pants: '#f8f8f8', hat: null, accent: '#f06080' },
        dialog: ['バッジが 1こ だと モンスターは Lv30 まで。', 'ミナモさんに かって 2こ めの バッジを もらえば Lv35 まで そだつのよ！'],
      },
    ],
    signs: [
      { x: 12, y: 2, text: ['↑ ほしくずのどうくつ ・ カナトコタウン', 'ジムバッジを 2つ もっていないと とおれません'] },
      { x: 24, y: 7, text: ['シオサイジム', 'ジムリーダー ミナモ', '「しずかな うみの あらなみ」'] },
      { x: 17, y: 11, text: ['シオサイタウン', 'しおさいの きこえる みなとまち'] },
    ],
    pickups: [
      { id: 'town3_p1', x: 2, y: 16, points: 200 },
    ],
  },

  // ---------------------------------------------------------------- シオサイタウン モンスターセンター
  town3_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town3', tx: 6, ty: 6, dir: 'down' },
      { x: 6, y: 8, to: 'town3', tx: 6, ty: 6, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['みずタイプの ジムに いどむ なら', 'でんきや くさの モンスターを ガチャで さがして みよう！'],
      },
      {
        id: 'visitor', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#304860', hairStyle: 'long', shirt: '#e0a0c0', pants: '#405070', hat: null },
        dialog: ['じょうげんより ずっと ひくい モンスターは', 'けいけんちを おおめに もらえるんだって。', 'あたらしい なかまも すぐに おいつけるわね！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- シオサイタウンの民家
  town3_house: {
    name: 'シオサイタウンの いえ',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '##########',
      '##########',
      '#bb___p_k#',
      '#_______k#',
      '#__tt____#',
      '#__tt__KK#',
      '#p_____KK#',
      '####mm####',
    ],
    warps: [
      { x: 4, y: 7, to: 'town3', tx: 5, ty: 14, dir: 'down' },
      { x: 5, y: 7, to: 'town3', tx: 5, ty: 14, dir: 'down' },
    ],
    npcs: [
      {
        id: 'captain', x: 5, y: 4, dir: 'down', move: 'still',
        look: { skin: '#c89068', hair: '#e8e8e8', hairStyle: 'bald', shirt: '#283870', pants: '#283048', hat: '#f8f8f8', accent: '#f8c030' },
        dialog: ['わしは むかし ふねの せんちょう だったんじゃ。', 'しんかした モンスターは のうりょくが ぐっと あがる。', 'レベルの じょうげんが あがったら どんどん そだてるんじゃぞ。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- シオサイジム（みず）
  gym2: {
    name: 'シオサイジム',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#WW__KK__WW#',
      '#WW__KK__WW#',
      '#____KK____#',
      '#WWWW__WWWW#',
      '#__________#',
      '#_WWW__WWW_#',
      '#__________#',
      '#WWWW__WWWW#',
      '#__________#',
      '#__________#',
      '#pp__KK__pp#',
      '#____KK____#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 15, to: 'town3', tx: 20, ty: 8, dir: 'down' },
      { x: 6, y: 15, to: 'town3', tx: 20, ty: 8, dir: 'down' },
    ],
    npcs: [
      { id: 't_leader', x: 5, y: 2, dir: 'down', trainer: 'shiosai_leader', sight: 0, move: 'still' },
      { id: 't_umi', x: 2, y: 6, dir: 'right', trainer: 'gym2_umi', sight: 4, move: 'still' },
      { id: 't_marin', x: 9, y: 10, dir: 'left', trainer: 'gym2_marin', sight: 4, move: 'still' },
      {
        id: 'gym_guide', x: 8, y: 14, dir: 'left', move: 'still',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#f8f8f8', pants: '#3050a0', hat: '#3050a0', accent: '#f8c030' },
        dialog: ['よう！ しょうらいの チャンピオン！', 'ここ シオサイジムの リーダーは みずタイプの つかいてだ。', 'でんき・くさの わざで せめるんだぞ！', 'ただし リーダーは こおりや じめんの わざも つかって くる。 きを つけろ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ================================================================== ほしくずのどうくつ（シオサイタウン → カナトコタウン）
  cave: {
    name: 'ほしくずのどうくつ',
    bgm: 'cave',
    border: 'r',
    indoor: false,
    tiles: [
      'rrrrrrrrrrrrrrrrrrrrrrrrqqrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrqqrrrr',
      'rrqqqqqqrrrrrrrrrrrrrrqqqqqqrr',
      'rrqqqqqquuuuuuuuuuuuurqqqqqqrr',
      'rrqqqqqquuuuuuuuuuuuuuqqqqqqrr',
      'rrqqqqqquuuuuuuuuuuuurqqqqqqrr',
      'rruuuuqqrrruurrrrrrrrruuuuurrr',
      'rruuuurrrrruurrrrrrrrruuuuurrr',
      'rruuuurruuuuuuuuuuuurruuuuurrr',
      'rruuuurruuuuWWWWWuuurruuuuurrr',
      'rruuuurruuuuWWWWWuuuuuuuuuurrr',
      'rruuuuuuuuuuWWWWWuuurruuuuurrr',
      'rruuuurruuuuuuuuuuuurruuuuurrr',
      'rruuuurrrrrrruuurrrrrruuuuurrr',
      'rruuuurrrrrrruuurrrrrruuuuurrr',
      'rruuuurrrrqqqqqqqqqqrruuuuurrr',
      'rruuuurrrrqqqqqqqqqqrruuuuurrr',
      'rruuuuuuuuqqqqqqqqqquuuuuuurrr',
      'rruuuuuuuuqqqqqqqqqquuuuuuurrr',
      'rrrrrrrrrrqqqqqqqqqqrrrrrrrrrr',
      'rrrrrrrrrrrrrrqqrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrqqrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrqqrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrqrrrrrrrrrrrrrrr',
    ],
    encounters: {
      rate: 0.1,
      table: [
        { species: 'gansekin', min: 26, max: 30, weight: 8 },      // 進化後（コイシン Lv18）
        { species: 'burikingu', min: 26, max: 30, weight: 8 },     // 進化後（ブリキン Lv22）
        { species: 'oboron', min: 26, max: 30, weight: 7 },        // 進化後（ユラリ Lv24）
        { species: 'fubukidori', min: 26, max: 30, weight: 6 },    // 進化後（ユキチドリ Lv24）
        { species: 'kagehyou', min: 26, max: 30, weight: 6 },      // 進化後（カゲネコ Lv22）
        { species: 'genkotsun', min: 26, max: 30, weight: 5 },     // 進化後（コブシン Lv18）
        { species: 'bachinezu', min: 26, max: 30, weight: 5 },     // 進化後（ピリネズ Lv18）
        { species: 'yoroidama', min: 26, max: 29, weight: 6 },
        { species: 'haganemushi', min: 26, max: 31, weight: 7 },
        { species: 'yukigasumi', min: 26, max: 30, weight: 6 },
        { species: 'karakasan', min: 26, max: 30, weight: 5 },
        { species: 'mitooshi', min: 26, max: 30, weight: 5 },
        { species: 'shinobin', min: 26, max: 31, weight: 4 },
        { species: 'ganyoroi', min: 30, max: 33, weight: 3 },      // 進化後（ヨロイダマ Lv30）
        { species: 'hayateou', min: 30, max: 33, weight: 2 },      // 進化後（カゼキリ Lv30）
        { species: 'kamakensei', min: 30, max: 33, weight: 2 },    // 進化後（カマキリン Lv30）
        { species: 'haganekabuto', min: 32, max: 33, weight: 1.5 },// 進化後（ハガネムシ Lv32）
        { species: 'shinobigami', min: 32, max: 33, weight: 1 },   // 進化後（シノビン Lv32）
        { species: 'sunakujira', min: 27, max: 32, weight: 2.5 },
        { species: 'iwabasa', min: 27, max: 32, weight: 2.5 },
        { species: 'haganebushi', min: 28, max: 33, weight: 2 },
        { species: 'dokuja', min: 28, max: 33, weight: 2 },
        { species: 'kitsunebi', min: 28, max: 33, weight: 2 },
        { species: 'hoshiyomi', min: 29, max: 33, weight: 1.5 },
        { species: 'ikkakujira', min: 28, max: 33, weight: 1.5 },
        { species: 'tatsumaru', min: 29, max: 33, weight: 1 },
        { species: 'goutetsu', min: 30, max: 33, weight: 0.5 },
        { species: 'yoiyami', min: 30, max: 33, weight: 0.4 },
        { species: 'hyoutei', min: 30, max: 33, weight: 0.4 },
        { species: 'kokuyouryu', min: 32, max: 33, weight: 0.2 },
        { species: 'aquaroa', min: 32, max: 33, weight: 0.15 },
      ],
    },
    warps: [
      { x: 14, y: 23, to: 'town3', tx: 14, ty: 1, dir: 'down' },
      { x: 24, y: 0, to: 'town4', tx: 12, ty: 18, dir: 'up' },
      { x: 25, y: 0, to: 'town4', tx: 13, ty: 18, dir: 'up' },
    ],
    npcs: [
      { id: 't_ren', x: 26, y: 4, dir: 'left', trainer: 'cave_ren', sight: 4, move: 'still' },
      { id: 't_gou', x: 5, y: 14, dir: 'left', trainer: 'cave_gou', sight: 3, move: 'turn' },
      {
        id: 'explorer', x: 11, y: 16, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#a06030', hairStyle: 'short', shirt: '#e0c040', pants: '#6a5030', hat: '#f0f0f0', accent: '#e03030' },
        dialog: ['この どうくつでは ごく まれに', 'SSR や UR の モンスターが あらわれるらしい…', 'あしもとの いわの ゆかを たくさん あるいて みよう。', 'でぐちは みぎうえ。 ぬけると カナトコタウンだ。'],
      },
      { id: 't_gantetsu', x: 22, y: 9, dir: 'right', trainer: 'cave_gantetsu', sight: 4, move: 'still' },
      { id: 't_sayo', x: 14, y: 13, dir: 'down', trainer: 'cave_sayo', sight: 2, move: 'turn' },
    ],
    signs: [],
    pickups: [
      { id: 'cave_p1', x: 2, y: 2, points: 300 },
      { id: 'cave_p2', x: 27, y: 2, points: 500 },
      { id: 'cave_p3', x: 19, y: 9, points: 200 },
    ],
  },

  // ================================================================== カナトコタウン（はがねの まち）
  town4: {
    name: 'カナトコタウン',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TMMMMMMMMMMMMMMMMMMMMMMMMMMT',
      'T.o......................o.T',
      'T..jjjjjj.......ccccc......T',
      'T..jjjjjj.......ccccc......T',
      'T..jjjjjj.......wnDnw......T',
      'T..nwwwwn.........:........T',
      'T..wwwDww...S.....:.....ooff',
      'T.....:...........:.....offf',
      'T:::::::::::::::::::::::::::',
      'T::::::::::::::::::::::offff',
      'T...........::.........oTTTT',
      'T..hhhh.....::..ffffff.....T',
      'T..hhhh.....::..F....F..o..T',
      'T..wnDw.....::..F.o..F.....T',
      'T....:......::..ffffff.....T',
      'T..:::::::::::.............T',
      'T...........::.........o...T',
      'TT..........::.............T',
      'TTTTTTTTTTTT::TTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 12, y: 19, to: 'cave', tx: 24, ty: 1, dir: 'down' },
      { x: 13, y: 19, to: 'cave', tx: 25, ty: 1, dir: 'down' },
      { x: 18, y: 5, to: 'town4_center', tx: 5, ty: 7, dir: 'up' },
      { x: 6, y: 7, to: 'gym3', tx: 5, ty: 14, dir: 'up' },
      { x: 5, y: 14, to: 'town4_house', tx: 5, ty: 6, dir: 'up' },
      { x: 27, y: 9, to: 'route4', tx: 1, ty: 9, dir: 'right' },   // 4ばんどうろ（通せんぼ guard の先）
    ],
    npcs: [
      {
        id: 'guard', x: 25, y: 9, dir: 'left', move: 'still', requireBadges: 3,
        look: { skin: '#d8a070', hair: '#303030', hairStyle: 'short', shirt: '#f0a020', pants: '#404850', hat: '#f8d030', accent: '#303030' },
        dialog: ['この さきは さいごの ジムへ つづく みちだ。', 'かみなりの ように はやい モンスターが でるぞ。', 'このさきは ジムバッジを 3つ もってから！'],
      },
      {
        id: 'smith', x: 9, y: 11, dir: 'down', move: 'turn',
        look: { skin: '#c89068', hair: '#202020', hairStyle: 'spiky', shirt: '#586068', pants: '#303840', hat: null, accent: '#f0a020' },
        dialog: ['ここは てつの まち カナトコタウン。', 'ジムリーダーの ゲンテツさんは はがねタイプの つかいてだ。', 'ほのお・かくとう・じめんの わざが よく きくぞ！'],
      },
      {
        id: 'kid', x: 20, y: 17, dir: 'up', move: 'wander',
        look: { skin: '#f8d0a8', hair: '#a05028', hairStyle: 'spiky', shirt: '#40a0e0', pants: '#404040', hat: '#f0a020' },
        dialog: ['バッジを あつめると レベルの じょうげんが あがるんだ。', '3こ で Lv40、 4こ そろえると Lv50 だって！'],
      },
    ],
    signs: [
      { x: 12, y: 7, text: ['カナトコタウン', 'てつを うつ おとが ひびく まち', '→ さいごの ジム（ジムバッジ 3つ いじょう）'] },
    ],
    pickups: [
      { id: 'town4_p1', x: 18, y: 13, points: 300 },
    ],
  },

  // ---------------------------------------------------------------- カナトコタウン モンスターセンター
  town4_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town4', tx: 18, ty: 6, dir: 'down' },
      { x: 6, y: 8, to: 'town4', tx: 18, ty: 6, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['はがねタイプの ジムに いどむ なら', 'ほのお・かくとう・じめんの モンスターが たよりに なるよ！'],
      },
      {
        id: 'visitor', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#503020', hairStyle: 'short', shirt: '#60a060', pants: '#404040', hat: '#806040' },
        dialog: ['じょうげんまで そだった モンスターの けいけんちは ポイントに なる。', 'ただし 1にちに もらえる ぶんには かぎりが あるんだって。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- カナトコタウンの民家
  town4_house: {
    name: 'カナトコタウンの いえ',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '##########',
      '##########',
      '#bb___p_k#',
      '#_______k#',
      '#__tt____#',
      '#__tt__KK#',
      '#p_____KK#',
      '####mm####',
    ],
    warps: [
      { x: 4, y: 7, to: 'town4', tx: 5, ty: 15, dir: 'down' },
      { x: 5, y: 7, to: 'town4', tx: 5, ty: 15, dir: 'down' },
    ],
    npcs: [
      {
        id: 'grandma', x: 5, y: 4, dir: 'down', move: 'still',
        look: { skin: '#f0c8a0', hair: '#e8e8e8', hairStyle: 'bun', shirt: '#c07040', pants: '#605040', hat: null },
        dialog: ['この まちの かじやは みんな はたらきもの。', 'うちの まごも ゲンテツさんの ジムで しゅぎょう しとるよ。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- カナトコジム（はがね）
  gym3: {
    name: 'カナトコジム',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#o___KK___o#',
      '#____KK____#',
      '#oo__KK__oo#',
      '#____KK____#',
      '#oooo__oooo#',
      '#__________#',
      '#__________#',
      '#_oooooooo_#',
      '#__________#',
      '#__________#',
      '#oooo__oooo#',
      '#____KK____#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 15, to: 'town4', tx: 6, ty: 8, dir: 'down' },
      { x: 6, y: 15, to: 'town4', tx: 6, ty: 8, dir: 'down' },
    ],
    npcs: [
      { id: 't_leader', x: 5, y: 2, dir: 'down', trainer: 'kanatoko_leader', sight: 0, move: 'still' },
      { id: 't_tetsuo', x: 2, y: 7, dir: 'right', trainer: 'gym3_tetsuo', sight: 4, move: 'still' },
      { id: 't_riko', x: 9, y: 10, dir: 'left', trainer: 'gym3_riko', sight: 4, move: 'still' },
      {
        id: 'gym_guide', x: 8, y: 14, dir: 'left', move: 'still',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#f8f8f8', pants: '#3050a0', hat: '#3050a0', accent: '#f8c030' },
        dialog: ['よう！ しょうらいの チャンピオン！', 'ここ カナトコジムの リーダーは はがねタイプの つかいてだ。', 'ほのお・かくとう・じめんの わざで せめるんだぞ！', 'リーダーの エースは じめんタイプも もっている。 みずの わざも ためして みろ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ================================================================== 4ばんどうろ（カナトコタウン → イカズチタウン）
  route4: {
    name: '4ばんどうろ',
    bgm: 'route',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTT,,,,,,..TTTTTTTTT..,,,,,,,TTT',
      'TT.,,,,,,.........o...,,,,,,,.TT',
      'TT.,,,,,,...........F.,,,,,,,.TT',
      'TT......::::::::::::::::......TT',
      'TT......::::::::::::::::.,,,,.TT',
      'TT..o...::.....S......::.,,,,.TT',
      'TTT.....::...........,::.,,,,.TT',
      'T.......::..,,,,,,..,,::......TT',
      '::::::::::..,,,,,,..,,::...o..TT',
      '::::::::::..,,,,,,....::......TT',
      'T.......F...,,,,,,....::..,,,,TT',
      'TT..,,,,..............::..,,,,.T',
      'TT..,,,,..ffff........::::::::::',
      'TT..,,,,..............::::::::::',
      'TT.....FF.....o...,,,,,,....F..T',
      'TTT...........TTT.,,,,,,.....TTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    encounters: {
      rate: 0.13,
      table: [
        { species: 'kaminarinezu', min: 34, max: 38, weight: 8 },  // 進化後（バチネズ Lv34）
        { species: 'raiutsubo', min: 33, max: 37, weight: 7 },     // 進化後（ビリウナギ Lv32）
        { species: 'hayateou', min: 33, max: 37, weight: 6 },      // 進化後（カゼキリ Lv30）
        { species: 'ootakamaru', min: 34, max: 38, weight: 6 },    // 進化後（スズタカ Lv34）
        { species: 'kagehyou', min: 33, max: 37, weight: 6 },      // 進化後（カゲネコ Lv22）
        { species: 'kamakensei', min: 33, max: 37, weight: 5 },    // 進化後（カマキリン Lv30）
        { species: 'hanakanmuri', min: 33, max: 37, weight: 5 },   // 進化後（ハナサキン Lv32）
        { species: 'kasanoou', min: 33, max: 37, weight: 5 },      // 進化後（カサボウ Lv30）
        { species: 'fubukidori', min: 33, max: 37, weight: 5 },    // 進化後（ユキチドリ Lv24）
        { species: 'ganyoroi', min: 33, max: 37, weight: 5 },      // 進化後（ヨロイダマ Lv30）
        { species: 'numabouzu', min: 33, max: 36, weight: 5 },     // 進化後（ドロッチ Lv20）
        { species: 'fuwadaifuku', min: 33, max: 36, weight: 5 },   // 進化後（ワタモチ Lv20）
        { species: 'hirahime', min: 33, max: 36, weight: 5 },      // 進化後（ヒラリン Lv20）
        { species: 'oboron', min: 33, max: 36, weight: 4 },        // 進化後（ユラリ Lv24）
        { species: 'haganekabuto', min: 33, max: 37, weight: 4 },  // 進化後（ハガネムシ Lv32）
        { species: 'raigarou', min: 34, max: 38, weight: 2 },
        { species: 'sunakujira', min: 34, max: 38, weight: 2 },
        { species: 'iwabasa', min: 34, max: 38, weight: 2 },
        { species: 'ikkakujira', min: 34, max: 38, weight: 1.5 },
        { species: 'tatsumaru', min: 35, max: 38, weight: 0.8 },
        { species: 'raimeiou', min: 36, max: 38, weight: 0.1 },
      ],
    },
    warps: [
      { x: 0, y: 9, to: 'town4', tx: 26, ty: 9, dir: 'left' },
      { x: 0, y: 10, to: 'town4', tx: 26, ty: 9, dir: 'left' },
      { x: 31, y: 13, to: 'town5', tx: 1, ty: 9, dir: 'right' },
      { x: 31, y: 14, to: 'town5', tx: 1, ty: 10, dir: 'right' },
    ],
    npcs: [
      { id: 't_hayato', x: 14, y: 3, dir: 'down', trainer: 'route4_hayato', sight: 3, move: 'still' },
      { id: 't_saki', x: 24, y: 9, dir: 'left', trainer: 'route4_saki', sight: 2, move: 'turn' },
      { id: 't_daigoro', x: 26, y: 15, dir: 'up', trainer: 'route4_daigoro', sight: 2, move: 'still' },
      {
        id: 'hiker', x: 5, y: 11, dir: 'right', move: 'wander',
        look: { skin: '#e0b088', hair: '#403020', hairStyle: 'short', shirt: '#c05030', pants: '#505060', hat: '#806040', accent: '#f0d040' },
        dialog: ['この さきの イカズチタウンには さいごの ジムが ある。', 'でんきタイプには じめんの わざが よく きくんだ。', 'でも そらを とぶ モンスターには じめんが あたらないから きをつけて！'],
      },
    ],
    signs: [
      { x: 15, y: 6, text: ['4ばんどうろ', '← カナトコタウン   → イカズチタウン'] },
    ],
    pickups: [
      { id: 'route4_p1', x: 3, y: 2, points: 300 },
      { id: 'route4_p2', x: 29, y: 5, points: 350 },
      { id: 'route4_p3', x: 20, y: 16, points: 300 },
    ],
  },

  // ================================================================== イカズチタウン（かみなりの まち）
  town5: {
    name: 'イカズチタウン',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTT:TTTTTTTTTTTTTT',
      'TMMMMMMMMMMMM:MMMMMMMMMMMMMT',
      'T..........F.::.F..........T',
      'T..jjjjjj....::....ccccc...T',
      'T..jjjjjj....::....ccccc...T',
      'T..jjjjjj....::....wnDnw...T',
      'T..nwwwwn....::......:.....T',
      'T..wwwDww....::......:.....T',
      'T.....:......::......:.....T',
      '::::::::::::::::::::::.....T',
      '::::::::::::::::::::::..S..T',
      'T............::............T',
      'T..hhhh......::...ffffff...T',
      'T..hhhh......::...F....F...T',
      'T..wnDw......::...F.o..F...T',
      'T....:......:::...ffffff...T',
      'T..::::::::::::............T',
      'T.....FF.....::.....o......T',
      'TT...........::...........TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, y: 9, to: 'route4', tx: 30, ty: 13, dir: 'left' },
      { x: 0, y: 10, to: 'route4', tx: 30, ty: 14, dir: 'left' },
      { x: 13, y: 0, to: 'road', tx: 14, ty: 22, dir: 'up' },
      { x: 21, y: 5, to: 'town5_center', tx: 5, ty: 7, dir: 'up' },
      { x: 6, y: 7, to: 'gym4', tx: 5, ty: 14, dir: 'up' },
      { x: 5, y: 14, to: 'town5_house', tx: 5, ty: 6, dir: 'up' },
    ],
    npcs: [
      {
        id: 'guard', x: 13, y: 2, dir: 'down', move: 'still', requireBadges: 4,
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['この さきは チャンピオンロード。', 'ガチャモンリーグへ つづく けわしい みちだ。', 'ジムバッジを 4つ そろえた トレーナーしか とおせないぞ！'],
      },
      {
        id: 'engineer', x: 10, y: 11, dir: 'down', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#f0c040', hairStyle: 'spiky', shirt: '#f8d030', pants: '#404040', hat: null, accent: '#303030' },
        dialog: ['ここは でんきの まち イカズチタウン。', 'ジムリーダーの ライカさんは でんきタイプの つかいて。', 'じめんタイプなら でんきの わざが きかないぞ！'],
      },
      {
        id: 'girl', x: 22, y: 17, dir: 'up', move: 'wander',
        look: { skin: '#f8d8b8', hair: '#8040c0', hairStyle: 'long', shirt: '#f8f8f8', pants: '#40a0e0', hat: null },
        dialog: ['バッジを 4つ そろえると レベルの じょうげんが 50に なるんだって。', 'きたの みちの さきに ガチャモンリーグが あるのよ！'],
      },
    ],
    signs: [
      { x: 24, y: 10, text: ['イカズチタウン', 'いなずまが とどろく まち', '↑ チャンピオンロード（ジムバッジ 4つ いじょう）'] },
    ],
    pickups: [
      { id: 'town5_p1', x: 13, y: 18, points: 400 },
    ],
  },

  // ---------------------------------------------------------------- イカズチタウン モンスターセンター
  town5_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'town5', tx: 21, ty: 6, dir: 'down' },
      { x: 6, y: 8, to: 'town5', tx: 21, ty: 6, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['でんきタイプの ジムに いどむ なら', 'じめんタイプの モンスターが たよりに なるよ！'],
      },
      {
        id: 'visitor', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#503020', hairStyle: 'short', shirt: '#c04040', pants: '#404040', hat: null },
        dialog: ['ガチャモンリーグでは してんのう 4にんと チャンピオンに', 'かいふく なしで つづけて かたないと いけないらしい。', 'かいふくの わざを もった モンスターが いると あんしんだね。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- イカズチタウンの民家
  town5_house: {
    name: 'イカズチタウンの いえ',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '##########',
      '##########',
      '#bb___p_k#',
      '#_______k#',
      '#__tt____#',
      '#__tt__KK#',
      '#p_____KK#',
      '####mm####',
    ],
    warps: [
      { x: 4, y: 7, to: 'town5', tx: 5, ty: 15, dir: 'down' },
      { x: 5, y: 7, to: 'town5', tx: 5, ty: 15, dir: 'down' },
    ],
    npcs: [
      {
        id: 'grandpa', x: 5, y: 4, dir: 'down', move: 'still',
        look: { skin: '#f0c8a0', hair: '#e8e8e8', hairStyle: 'bald', shirt: '#607080', pants: '#404040', hat: null },
        dialog: ['わしも むかしは ガチャモンリーグに いどんだ ものじゃ。', 'してんのうは ゴースト・かくとう・こおり・あくの つかいて。', 'さいごに まつ チャンピオンは ドラゴンの つかいてじゃよ。'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- イカズチジム（でんき）
  gym4: {
    name: 'イカズチジム',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p___KK___p#',
      '#____KK____#',
      '#tttt__tttt#',
      '#__________#',
      '#__tttttttt#',
      '#__________#',
      '#tttttttt__#',
      '#__________#',
      '#__tttttttt#',
      '#__________#',
      '#tttt__tttt#',
      '#____KK____#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 15, to: 'town5', tx: 6, ty: 8, dir: 'down' },
      { x: 6, y: 15, to: 'town5', tx: 6, ty: 8, dir: 'down' },
    ],
    npcs: [
      { id: 't_leader', x: 5, y: 2, dir: 'down', trainer: 'ikazuchi_leader', sight: 0, move: 'still' },
      { id: 't_denji', x: 10, y: 11, dir: 'left', trainer: 'gym4_denji', sight: 4, move: 'still' },
      { id: 't_hikari', x: 1, y: 7, dir: 'right', trainer: 'gym4_hikari', sight: 4, move: 'still' },
      {
        id: 'gym_guide', x: 8, y: 14, dir: 'left', move: 'still',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#f8f8f8', pants: '#3050a0', hat: '#3050a0', accent: '#f8c030' },
        dialog: ['よう！ しょうらいの チャンピオン！', 'ここ イカズチジムの リーダーは でんきタイプの つかいてだ。', 'じめんの わざで せめるんだぞ！', 'ただし リーダーの エースは そらを とぶ。 じめんの わざは あたらない！', 'こおりや いわの わざも よういして おけ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ================================================================== チャンピオンロード（イカズチタウン → ガチャモンリーグ）
  road: {
    name: 'チャンピオンロード',
    bgm: 'cave',
    border: 'r',
    indoor: false,
    tiles: [
      'rrrrrrrrrrrrrrrrrrrrrrqqrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrqqrrrrrr',
      'rrqqqqqqrrrrrrrrrrrrrqqqqrrrrr',
      'rrqquuuuuuuuuuuuuuuuuuuuuuurrr',
      'rrqquuuuuuuuuuuuuuuuuuuuuuurrr',
      'rruuuurrrrrrrrrrrrrrrrrruuuurr',
      'rruuuurrrrrrrrrrrrrrrrrruuuurr',
      'rruuuurruuuuuuuuuuuuuurruuuurr',
      'rruuuurruuuWWWWWWWWuuurruuuurr',
      'rruuuuuuuuuWWWWWWWWuuuuuuuuurr',
      'rruuuurruuuWWWWWWWWuuurruuuurr',
      'rruuuurruuuuuuuuuuuuuurruuuurr',
      'rruuuurrrrrrruuuurrrrrrruuuurr',
      'rruuuurrrrrrruuuurrrrrrruuuurr',
      'rruuuurrqqqqqqqqqqqqqqrruuuurr',
      'rruuuurrqqqqqqqqqqqqqqrruuuurr',
      'rruuuurrrrrrrqqqqrrrrrrruuuurr',
      'rruuuurrrrrrruuuurrrrrrruuuurr',
      'rruuuuuuuuuuuuuuuuuuuuuuuuuurr',
      'rruuuuuuuuuuuuuuuuuuuuuuuuuurr',
      'rrrrrrrrrrrruuuuuurrrrrrrrrrrr',
      'rrrrrrrrrrrrqqqqqqrrrrrrrrrrrr',
      'rrrrrrrrrrrrrqqqqrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrqrrrrrrrrrrrrrrr',
    ],
    encounters: {
      rate: 0.1,
      table: [
        { species: 'iwayamao', min: 40, max: 45, weight: 6 },      // 進化後（ガンセキン Lv36）
        { species: 'ganyoroi', min: 40, max: 45, weight: 6 },      // 進化後（ヨロイダマ Lv30）
        { species: 'goukajishi', min: 40, max: 45, weight: 5 },    // 進化後（ヒノジシ Lv36）
        { species: 'tekkenou', min: 40, max: 45, weight: 5 },      // 進化後（ゲンコツン Lv36）
        { species: 'kaminarinezu', min: 40, max: 45, weight: 5 },  // 進化後（バチネズ Lv34）
        { species: 'ootakamaru', min: 40, max: 45, weight: 5 },    // 進化後（スズタカ Lv34）
        { species: 'haganekabuto', min: 40, max: 45, weight: 5 },  // 進化後（ハガネムシ Lv32）
        { species: 'shinobigami', min: 40, max: 45, weight: 4 },   // 進化後（シノビン Lv32）
        { species: 'kamakensei', min: 40, max: 45, weight: 4 },    // 進化後（カマキリン Lv30）
        { species: 'hayateou', min: 40, max: 45, weight: 4 },      // 進化後（カゼキリ Lv30）
        { species: 'hanakanmuri', min: 40, max: 44, weight: 4 },   // 進化後（ハナサキン Lv32）
        { species: 'namihaneru', min: 40, max: 44, weight: 4 },    // 進化後（ミズピョン Lv30）
        { species: 'kasanoou', min: 40, max: 44, weight: 4 },      // 進化後（カサボウ Lv30）
        { species: 'fubukidori', min: 40, max: 45, weight: 4 },    // 進化後（ユキチドリ Lv24）
        { species: 'raiutsubo', min: 40, max: 44, weight: 4 },     // 進化後（ビリウナギ Lv32）
        { species: 'yukigasumi', min: 40, max: 44, weight: 3 },
        { species: 'haganebushi', min: 41, max: 46, weight: 2.5 },
        { species: 'iwabasa', min: 41, max: 46, weight: 2.5 },
        { species: 'dokuja', min: 41, max: 46, weight: 2 },
        { species: 'tatsumaru', min: 42, max: 46, weight: 2 },
        { species: 'yoiyami', min: 43, max: 46, weight: 0.5 },
        { species: 'hyoutei', min: 43, max: 46, weight: 0.5 },
        { species: 'kaenryu', min: 44, max: 46, weight: 0.3 },
        { species: 'morinonushi', min: 44, max: 46, weight: 0.3 },
        { species: 'kokuyouryu', min: 45, max: 46, weight: 0.1 },
        { species: 'aquaroa', min: 45, max: 46, weight: 0.1 },
        { species: 'raimeiou', min: 45, max: 46, weight: 0.1 },
      ],
    },
    warps: [
      { x: 14, y: 23, to: 'town5', tx: 13, ty: 1, dir: 'down' },
      { x: 22, y: 0, to: 'league_gate', tx: 12, ty: 16, dir: 'up' },
      { x: 23, y: 0, to: 'league_gate', tx: 13, ty: 16, dir: 'up' },
    ],
    npcs: [
      { id: 't_kaito', x: 2, y: 12, dir: 'right', trainer: 'road_kaito', sight: 3, move: 'still' },
      { id: 't_misaki', x: 27, y: 11, dir: 'left', trainer: 'road_misaki', sight: 3, move: 'still' },
      { id: 't_ryuji', x: 12, y: 3, dir: 'down', trainer: 'road_ryuji', sight: 1, move: 'turn' },
      {
        id: 'veteran', x: 14, y: 15, dir: 'down', move: 'turn',
        look: { skin: '#d8a070', hair: '#e8e8e8', hairStyle: 'short', shirt: '#586068', pants: '#404850', hat: '#c04040', accent: '#f8d030' },
        dialog: ['ここは チャンピオンロード。', 'リーグに いどむ トレーナーが さいごに きたえる ばしょだ。', 'でぐちは みぎうえ。 リーグの まえには センターが あるぞ。'],
      },
    ],
    signs: [],
    pickups: [
      { id: 'road_p1', x: 3, y: 2, points: 600 },
      { id: 'road_p2', x: 9, y: 8, points: 500 },
      { id: 'road_p3', x: 20, y: 14, points: 500 },
    ],
  },

  // ================================================================== ガチャモンリーグ（入口）
  league_gate: {
    name: 'ガチャモンリーグ',
    bgm: 'town',
    border: 'T',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.....F..........F.....TT',
      'TT......jjjjjjjjjjj.....TT',
      'TT......jjjjjjjjjjj.....TT',
      'TT......jjjjjjjjjjj.....TT',
      'TT......nwwwwwwwwwn.....TT',
      'TT......wwwwwDwwwww.....TT',
      'TT.F.........:.......F..TT',
      'TT....::::::::::::::::..TT',
      'TT.........S::....ccccc.TT',
      'TT..........::....ccccc.TT',
      'TT..........::....wnDnw.TT',
      'TT..........::......:...TT',
      'TT..........:::::::::...TT',
      'TT.F........::.......F..TT',
      'TT..........::..........TT',
      'TTTTT.......::.......TTTTT',
      'TTTTTTTTTTTT::TTTTTTTTTTTT',
    ],
    warps: [
      { x: 12, y: 17, to: 'road', tx: 22, ty: 1, dir: 'down' },
      { x: 13, y: 17, to: 'road', tx: 23, ty: 1, dir: 'down' },
      { x: 20, y: 11, to: 'league_center', tx: 5, ty: 7, dir: 'up' },
      { x: 13, y: 6, to: 'league1', tx: 5, ty: 10, dir: 'up' },
    ],
    npcs: [
      {
        id: 'gatekeeper', x: 15, y: 7, dir: 'down', move: 'still',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['ようこそ ガチャモンリーグへ！', 'なかでは してんのう 4にんと チャンピオンが まっている。', 'いちど はいったら かいふくも できず もどる ことも できない。', 'まけたら してんのうの 1にんめから やりなおしだ。 じゅんびは いいか？'],
      },
    ],
    signs: [
      { x: 11, y: 9, text: ['ガチャモンリーグ', 'してんのうと チャンピオンが まつ さいごの ぶたい'] },
    ],
    pickups: [],
  },

  // ---------------------------------------------------------------- ガチャモンリーグ モンスターセンター（全滅時のもどり先）
  league_center: {
    name: 'モンスターセンター',
    bgm: 'town',
    border: 'V',
    indoor: true,
    tiles: [
      '############',
      '############',
      '#p__H____Gp#',
      '#__====____#',
      '#__________#',
      '#bb__KK___t#',
      '#____KK___t#',
      '#__________#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'league_gate', tx: 20, ty: 12, dir: 'down' },
      { x: 6, y: 8, to: 'league_gate', tx: 20, ty: 12, dir: 'down' },
    ],
    npcs: [
      {
        id: 'nurse', x: 5, y: 2, dir: 'down', move: 'still', heal: true,
        look: { skin: '#f8d8c0', hair: '#f090b0', hairStyle: 'bun', shirt: '#f8f8f8', pants: '#f8a0c0', hat: '#f8f8f8', accent: '#f06080' },
        dialog: ['ガチャモンリーグの モンスターセンターへ ようこそ！'],
      },
      {
        id: 'guide', x: 9, y: 3, dir: 'down', move: 'still', action: 'gacha',
        look: { skin: '#f8d0a8', hair: '#f0c040', hairStyle: 'short', shirt: '#f8c030', pants: '#8040c0', hat: null, accent: '#ffffff' },
        dialog: ['してんのうは ゴースト・かくとう・こおり・あく。', 'チャンピオンは ドラゴンの つかいてだよ。', 'ガチャで あいしょうの いい なかまを そろえよう！'],
      },
      {
        id: 'visitor', x: 2, y: 6, dir: 'right', move: 'turn',
        look: { skin: '#f0c8a0', hair: '#503020', hairStyle: 'spiky', shirt: '#60a060', pants: '#404040', hat: '#806040' },
        dialog: ['リーグの なかで まけると ここに もどされるんだ。', 'してんのうとの しょうぶも さいしょから やりなおし…', 'でも レベルは 50まで あげられる。 あきらめずに きたえよう！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- してんのう 1: ゴースト（ヨミ）
  //   リーグの部屋は 回復NPCなし。奥の出口は requireTrainer でその部屋のトレーナーを倒すまで通れない。
  //   うしろの出口は チャンピオンを倒すまで 番人（hideAfter）がふさぐ（一方通行）。全滅時は respawn へ。
  league1: {
    name: 'れいかいの ま',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '#####mm#####',
      '#p___KK___p#',
      '#____KK____#',
      '#_V__KK__V_#',
      '#_VV_KK_VV_#',
      '#____KK____#',
      '#_VV_KK_VV_#',
      '#_V__KK__V_#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 1, to: 'league2', tx: 5, ty: 10, dir: 'up', requireTrainer: 'league_yomi' },
      { x: 6, y: 1, to: 'league2', tx: 6, ty: 10, dir: 'up', requireTrainer: 'league_yomi' },
      { x: 5, y: 12, to: 'league_gate', tx: 13, ty: 7, dir: 'down' },
      { x: 6, y: 12, to: 'league_gate', tx: 13, ty: 7, dir: 'down' },
    ],
    npcs: [
      { id: 't_league', x: 5, y: 3, dir: 'down', trainer: 'league_yomi', sight: 0, move: 'still' },
      {
        id: 'doorman1', x: 5, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['リーグの きまりで いちど はいったら もどれないんだ。', 'さあ すすめ！ チャンピオンを めざして！'],
      },
      {
        id: 'doorman2', x: 6, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['ここから さきは かいふく できない。', 'てもちの モンスターの ちからを しんじるんだ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- してんのう 2: かくとう（ゴウリキ）
  league2: {
    name: 'とうきの ま',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '#####mm#####',
      '#o___KK___o#',
      '#____KK____#',
      '#_oo_KK_oo_#',
      '#____KK____#',
      '#o___KK___o#',
      '#____KK____#',
      '#_oo_KK_oo_#',
      '#____KK____#',
      '#o___KK___o#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 1, to: 'league3', tx: 5, ty: 10, dir: 'up', requireTrainer: 'league_goriki' },
      { x: 6, y: 1, to: 'league3', tx: 6, ty: 10, dir: 'up', requireTrainer: 'league_goriki' },
      { x: 5, y: 12, to: 'league1', tx: 5, ty: 2, dir: 'down' },
      { x: 6, y: 12, to: 'league1', tx: 6, ty: 2, dir: 'down' },
    ],
    npcs: [
      { id: 't_league', x: 5, y: 3, dir: 'down', trainer: 'league_goriki', sight: 0, move: 'still' },
      {
        id: 'doorman1', x: 5, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['うしろの とびらは チャンピオンが みとめるまで ひらかない。'],
      },
      {
        id: 'doorman2', x: 6, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['まえへ すすむ しか ないぞ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- してんのう 3: こおり（ヒサメ）
  league3: {
    name: 'ひょうけつの ま',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '#####mm#####',
      '#p___KK___p#',
      '#____KK____#',
      '#WWW_KK_WWW#',
      '#WWW_KK_WWW#',
      '#____KK____#',
      '#_WW_KK_WW_#',
      '#_WW_KK_WW_#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 1, to: 'league4', tx: 5, ty: 10, dir: 'up', requireTrainer: 'league_hisame' },
      { x: 6, y: 1, to: 'league4', tx: 6, ty: 10, dir: 'up', requireTrainer: 'league_hisame' },
      { x: 5, y: 12, to: 'league2', tx: 5, ty: 2, dir: 'down' },
      { x: 6, y: 12, to: 'league2', tx: 6, ty: 2, dir: 'down' },
    ],
    npcs: [
      { id: 't_league', x: 5, y: 3, dir: 'down', trainer: 'league_hisame', sight: 0, move: 'still' },
      {
        id: 'doorman1', x: 5, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['あと ふたり… いや チャンピオンを いれて あと 3にんだ！'],
      },
      {
        id: 'doorman2', x: 6, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['まえへ すすむ しか ないぞ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- してんのう 4: あく（クロバネ）
  league4: {
    name: 'しっこくの ま',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '#####mm#####',
      '#bb__KK__bb#',
      '#____KK____#',
      '#VV__KK__VV#',
      '#VV__KK__VV#',
      '#____KK____#',
      '#_VV_KK_VV_#',
      '#____KK____#',
      '#VV__KK__VV#',
      '#____KK____#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 1, to: 'league5', tx: 5, ty: 10, dir: 'up', requireTrainer: 'league_kurobane' },
      { x: 6, y: 1, to: 'league5', tx: 6, ty: 10, dir: 'up', requireTrainer: 'league_kurobane' },
      { x: 5, y: 12, to: 'league3', tx: 5, ty: 2, dir: 'down' },
      { x: 6, y: 12, to: 'league3', tx: 6, ty: 2, dir: 'down' },
    ],
    npcs: [
      { id: 't_league', x: 5, y: 3, dir: 'down', trainer: 'league_kurobane', sight: 0, move: 'still' },
      {
        id: 'doorman1', x: 5, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['この おくに チャンピオンが まっている…！'],
      },
      {
        id: 'doorman2', x: 6, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['まえへ すすむ しか ないぞ！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- チャンピオンの へや（タツキ）
  league5: {
    name: 'チャンピオンの ま',
    bgm: 'gym',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '#####mm#####',
      '#p___KK___p#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#p___KK___p#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 1, to: 'hall', tx: 5, ty: 7, dir: 'up', requireTrainer: 'league_champion' },
      { x: 6, y: 1, to: 'hall', tx: 6, ty: 7, dir: 'up', requireTrainer: 'league_champion' },
      { x: 5, y: 12, to: 'league4', tx: 5, ty: 2, dir: 'down' },
      { x: 6, y: 12, to: 'league4', tx: 6, ty: 2, dir: 'down' },
    ],
    npcs: [
      { id: 't_league', x: 5, y: 3, dir: 'down', trainer: 'league_champion', sight: 0, move: 'still' },
      {
        id: 'doorman1', x: 5, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['いよいよ チャンピオンとの しょうぶだ！'],
      },
      {
        id: 'doorman2', x: 6, y: 11, dir: 'up', move: 'still', hideAfter: 'league_champion',
        look: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', shirt: '#3050a0', pants: '#303040', hat: '#f8d030', accent: '#f8f8f8' },
        dialog: ['がんばれ！ {player}！'],
      },
    ],
    signs: [],
    pickups: [],
  },

  // ---------------------------------------------------------------- でんどういりの へや（トレーナーなし）
  hall: {
    name: 'でんどういりの ま',
    bgm: 'town',
    border: 'V',
    indoor: true,
    respawn: { map: 'league_center', x: 5, y: 4, dir: 'up' },
    tiles: [
      '############',
      '############',
      '#pb__tt__bp#',
      '#____KK____#',
      '#_t__KK__t_#',
      '#____KK____#',
      '#_t__KK__t_#',
      '#____KK____#',
      '#####mm#####',
    ],
    warps: [
      { x: 5, y: 8, to: 'league5', tx: 5, ty: 2, dir: 'down' },
      { x: 6, y: 8, to: 'league5', tx: 6, ty: 2, dir: 'down' },
    ],
    npcs: [
      {
        id: 'recorder', x: 4, y: 2, dir: 'down', move: 'still',
        look: { skin: '#f0c8a0', hair: '#e8e8e8', hairStyle: 'short', shirt: '#f8f8f8', pants: '#3050a0', hat: null, accent: '#f8d030' },
        dialog: ['ここは でんどういりの ま。', 'チャンピオンに かった トレーナーと モンスターの なまえが', 'えいえんに きろく される ばしょじゃ。', 'おめでとう {player}！ これからも ガチャと ぼうけんを たのしんで おくれ。', 'かえりは うしろの とびらから。 リーグの いりぐちまで もどれるぞ。'],
      },
    ],
    signs: [],
    pickups: [],
  },
};
