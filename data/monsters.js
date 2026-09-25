// =====================================================================
// モンスターの定義
// ---------------------------------------------------------------------
// ■ このファイルの編集方法
//
//   GameData.monsters = [ { ...1体目... }, { ...2体目... }, ... ]
//   1体 = 1ブロック（{ 〜 },）です。いちばん簡単な追加方法は
//   「似ているモンスターのブロックを まるごとコピーして 最後に貼り付け、値を書き換える」ことです。
//
//   id        : 内部ID。英小文字・数字・_ のみ。ほかと重ならないこと（例 'hinokon'）
//               ※ セーブデータ・トレーナー・マップが このIDで参照します。公開後に変えないでください
//   no        : 図鑑番号（ほかと重ならない整数）。図鑑はこの順に並びます
//   name      : 表示名（カタカナ推奨・全角5〜6文字くらいまで）
//   rarity    : レア度 'N' | 'R' | 'SR' | 'SSR' | 'UR'（gacha.js の rarities）
//   types     : タイプ 1〜2個（types.js のキー）例 ['fire'] / ['water', 'dragon']
//   baseStats : 種族値。hp=HP / atk=こうげき / def=ぼうぎょ / spa=とくこう / spd=とくぼう / spe=すばやさ
//               合計の目安: N 250〜330 / R 330〜400 / SR 400〜470 / SSR 470〜540 / UR 540〜610
//   learnset  : 覚えるわざ { lv: レベル, move: 'わざID' }（わざIDは moves.js のキー）
//               ※ lv: 1 の こうげきわざ を 必ず1つ以上 入れてください（ガチャで入手した直後に戦えるように）
//               ※ レベル順に並べると わかりやすいです
//   expGroup  : レベルアップの速さ 'fast'（はやい）| 'medium_fast' | 'medium_slow' | 'slow'（おそい）
//   baseExp   : 倒されたときに相手がもらう経験値の基準
//   image     : 正面画像のパス（空 '' なら自動生成ドット絵）例 'assets/monsters/hinokon.png'
//   backImage : 背面画像のパス（空 '' なら image を左右反転。image も空なら自動生成）
//   sprite    : 自動生成ドット絵の調整（image を指定したときは使われません）
//               shape : 体型 'blob'(まるい) | 'biped'(2足) | 'quadruped'(4足) | 'bird'(とり) | 'fish'(さかな)
//                       | 'serpent'(へび) | 'insect'(むし) | 'plant'(しょくぶつ) | 'ghost'(おばけ) | 'dragon'(りゅう)
//               colors: [メイン色, サブ色, アクセント色]（#RRGGBB）
//               seed  : （省略可）数字を変えると 同じ体型・色のまま 模様などが変わります
//   gacha     : false にすると ガチャに出なくなります（野生やトレーナー専用にしたいとき）
//   evolution : （省略可）レベルで しんかする ときの 進化先 { to: '進化先のid', level: しんかするレベル }
//               例 evolution: { to: 'hinojishi', level: 18 }  … Lv18 で ヒノジシ に しんか
//               ※ 1段階につき1つ（分岐なし）。2段階目は 進化後の種に もう一度 evolution を書きます
//               ※ 進化後の種は 進化前と同じ rarity・gacha: false（育成でのみ入手）にします
//               ※ 進化後の learnset には 進化前の わざを すべて入れ、新しい わざを たします
//               ※ 同じ進化系統は 1体あつかい（系統内の どれかを持っていると ガチャで引いても 凸になります）
//               種族値合計の目安: N進化1段 370〜440 / N進化2段 460〜500 / R進化 450〜490
//   category  : 図鑑の分類（〇〇モンスター）
//   height    : 高さ（m）  weight: 重さ（kg）
//   desc      : 図鑑の説明文（ひらがな多め・文節ごとにスペース・40〜70文字くらい）
//
// ■ 画像を使いたいとき
//   1. assets/monsters/ に PNG を置く（正方形・背景透過・64x64 など。ドット絵は拡大してもOK）
//   2. image: 'assets/monsters/ファイル名.png' と書く
//
// ■ 新しいモンスターを追加する手順（例）
//   1. 下のどれかのブロックをコピーして 配列の最後（ ]; の直前）に貼り付ける
//   2. id / no / name を ほかと重ならないように書き換える
//   3. rarity・types・baseStats・learnset などを好みに調整する
//   4. tools/datacheck.html をブラウザで開いて エラーが出ないか確認する
//   5. ガチャ（gacha.js の pool が null のバナー）には 自動で登場します
//
// ■ 進化を追加する手順（例）
//   1. 進化後のモンスターを 新しいブロックとして作る（rarity は進化前と同じ、gacha: false）
//      図鑑で となりに並ぶよう 進化前の すぐ後ろに置き、no を振り直すと 見やすくなります
//   2. 進化前のブロックに evolution: { to: '進化後のid', level: 20 }, を書き足す
//   3. tools/datacheck.html で 参照切れ・循環・レベル範囲などの エラーが出ないか確認する
//
// ■ 入れ替え・削除するとき
//   トレーナー（trainers.js）やマップの野生（maps.js）、ほかのモンスターの evolution.to が
//   その id を使っていないか 確認してください。
// =====================================================================
window.GameData = window.GameData || {};

GameData.monsters = [
  // ─── No.001 ヒノコン ───────────────────────────── N / ほのお
  {
    id: 'hinokon',
    no: 1,
    name: 'ヒノコン',
    rarity: 'N',
    types: ['fire'],
    baseStats: { hp: 44, atk: 58, def: 40, spa: 52, spd: 46, spe: 62 }, // 合計 302
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'ember' },         // ひのこ
      { lv: 10, move: 'flameclaw' },    // もえるツメ
      { lv: 15, move: 'hotbreath' },    // あついいき
      { lv: 21, move: 'quickhit' },     // はやわざ
      { lv: 28, move: 'flamebullet' },  // かえんだん
      { lv: 38, move: 'flarecharge' },  // ほのおのとっしん
    ],
    expGroup: 'medium_fast',
    baseExp: 62,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#f07830', '#f8d880', '#a02818'] },
    gacha: true,
    evolution: { to: 'hinojishi', level: 18 },
    category: 'ひだねモンスター',
    height: 0.4,
    weight: 5.2,
    desc: 'たてがみの ように はえた ほのおが げんきの しるし。うれしい ときほど おおきく もえあがる。',
  },

  // ─── No.002 ヒノジシ ───────────────────────────── N / ほのお
  {
    id: 'hinojishi',
    no: 2,
    name: 'ヒノジシ',
    rarity: 'N',
    types: ['fire'],
    baseStats: { hp: 60, atk: 80, def: 56, spa: 72, spd: 62, spe: 80 }, // 合計 410
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'ember' },         // ひのこ
      { lv: 10, move: 'flameclaw' },    // もえるツメ
      { lv: 15, move: 'hotbreath' },    // あついいき
      { lv: 18, move: 'scorchpunch' },  // しゃくねつパンチ
      { lv: 21, move: 'quickhit' },     // はやわざ
      { lv: 28, move: 'flamebullet' },  // かえんだん
      { lv: 33, move: 'crush' },        // おしつぶす
      { lv: 38, move: 'flarecharge' },  // ほのおのとっしん
      { lv: 48, move: 'infernoblast' }, // ごうえん
    ],
    expGroup: 'medium_fast',
    baseExp: 138,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#e06020', '#f8c860', '#801810'], seed: 11 },
    gacha: false,
    evolution: { to: 'goukajishi', level: 36 },
    category: 'ほのおじしモンスター',
    height: 1.0,
    weight: 32.0,
    desc: 'ヒノコンが せいちょうした すがた。たてがみの ほのおは ひとまわり おおきく なかまを まもる ときに もえさかる。',
  },

  // ─── No.003 ゴウカジシ ─────────────────────────── N / ほのお
  {
    id: 'goukajishi',
    no: 3,
    name: 'ゴウカジシ',
    rarity: 'N',
    types: ['fire'],
    baseStats: { hp: 74, atk: 98, def: 68, spa: 88, spd: 74, spe: 92 }, // 合計 494
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'ember' },         // ひのこ
      { lv: 10, move: 'flameclaw' },    // もえるツメ
      { lv: 15, move: 'hotbreath' },    // あついいき
      { lv: 18, move: 'scorchpunch' },  // しゃくねつパンチ
      { lv: 21, move: 'quickhit' },     // はやわざ
      { lv: 28, move: 'flamebullet' },  // かえんだん
      { lv: 33, move: 'crush' },        // おしつぶす
      { lv: 38, move: 'flarecharge' },  // ほのおのとっしん
      { lv: 44, move: 'powerup' },      // りきむ
      { lv: 48, move: 'infernoblast' }, // ごうえん
      { lv: 56, move: 'allout' },       // ぜんりょくタックル
    ],
    expGroup: 'medium_fast',
    baseExp: 200,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#c84818', '#f8b040', '#601008'], seed: 12 },
    gacha: false,
    category: 'ごうかモンスター',
    height: 1.7,
    weight: 98.0,
    desc: 'ヒノジシが さらに しんかした すがた。ほえると たてがみの ほのおが てんまで とどき よるの やまを あかく そめる。',
  },

  // ─── No.004 ミズピョン ─────────────────────────── R / みず
  {
    id: 'mizupyon',
    no: 4,
    name: 'ミズピョン',
    rarity: 'R',
    types: ['water'],
    baseStats: { hp: 58, atk: 55, def: 55, spa: 68, spd: 60, spe: 72 }, // 合計 368
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'watergun' },      // みずでっぽう
      { lv: 10, move: 'waterskip' },    // みずきり
      { lv: 15, move: 'watermembrane' }, // みずのまく
      { lv: 21, move: 'flowshot' },     // すいりゅうだん
      { lv: 29, move: 'coldbreath' },   // つめたいいき
      { lv: 38, move: 'torrent' },      // だいこうずい
    ],
    expGroup: 'medium_fast',
    baseExp: 88,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#58a8f0', '#e8f4ff', '#2858a8'] },
    gacha: true,
    evolution: { to: 'namihaneru', level: 30 },
    category: 'みずはねモンスター',
    height: 0.6,
    weight: 8.5,
    desc: 'ながい みみから みずを ふきだして とびはねる。あめの ひは うれしくて いつまでも おどる。',
  },

  // ─── No.005 ナミハネル ─────────────────────────── R / みず
  {
    id: 'namihaneru',
    no: 5,
    name: 'ナミハネル',
    rarity: 'R',
    types: ['water'],
    baseStats: { hp: 76, atk: 70, def: 72, spa: 90, spd: 78, spe: 94 }, // 合計 480
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'watergun' },      // みずでっぽう
      { lv: 10, move: 'waterskip' },    // みずきり
      { lv: 15, move: 'watermembrane' }, // みずのまく
      { lv: 21, move: 'flowshot' },     // すいりゅうだん
      { lv: 29, move: 'coldbreath' },   // つめたいいき
      { lv: 30, move: 'surge' },        // うちよせる
      { lv: 38, move: 'torrent' },      // だいこうずい
      { lv: 44, move: 'freezecannon' }, // ひょうけつほう
      { lv: 54, move: 'soulheal' },     // こころのいやし
    ],
    expGroup: 'medium_fast',
    baseExp: 160,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#3888e0', '#e0f0ff', '#1848a0'], seed: 171 },
    gacha: false,
    category: 'なみのりモンスター',
    height: 1.2,
    weight: 26.0,
    desc: 'ミズピョンが しんかした すがた。ながい みみで なみの おとを ききわけ おおなみの うえを かるがると はねる。',
  },

  // ─── No.006 ハッパマル ─────────────────────────── SR / くさ
  {
    id: 'happamaru',
    no: 6,
    name: 'ハッパマル',
    rarity: 'SR',
    types: ['grass'],
    baseStats: { hp: 72, atk: 66, def: 70, spa: 84, spd: 78, spe: 62 }, // 合計 432
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'leafcut' },       // はっぱぎり
      { lv: 5, move: 'growl' },         // なきごえ
      { lv: 9, move: 'sip' },           // すいあげ
      { lv: 14, move: 'sleepscent' },   // ねむりのかおり
      { lv: 19, move: 'thornlash' },    // いばらうち
      { lv: 25, move: 'forestbreath' }, // もりのいぶき
      { lv: 31, move: 'focusmind' },    // せいしんとういつ
      { lv: 40, move: 'sunbeam' },      // ひだまりほう
    ],
    expGroup: 'medium_slow',
    baseExp: 142,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#58b848', '#f0e070', '#2e6a2a'] },
    gacha: true,
    category: 'わかばモンスター',
    height: 0.7,
    weight: 12.0,
    desc: 'あたまの おおきな はっぱで ひかりを あつめる。はれた ひには はっぱが きんいろに かがやく。',
  },

  // ─── No.007 チュンピ ───────────────────────────── N / ノーマル・ひこう
  {
    id: 'chunpi',
    no: 7,
    name: 'チュンピ',
    rarity: 'N',
    types: ['normal', 'flying'],
    baseStats: { hp: 40, atk: 50, def: 38, spa: 32, spd: 36, spe: 64 }, // 合計 260
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 6, move: 'quickhit' },      // はやわざ
      { lv: 11, move: 'glare' },        // にらむ
      { lv: 17, move: 'soar' },         // まいあがる
      { lv: 24, move: 'nosedive' },     // きゅうこうか
      { lv: 34, move: 'skycharge' },    // てんくうとっしん
    ],
    expGroup: 'fast',
    baseExp: 52,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#b08858', '#f8e8c8', '#e85838'] },
    gacha: true,
    evolution: { to: 'suzutaka', level: 17 },
    category: 'こすずめモンスター',
    height: 0.3,
    weight: 1.8,
    desc: 'あさ いちばんに なきだす げんきな ことり。むれで あつまって にぎやかに さえずる。',
  },

  // ─── No.008 スズタカ ───────────────────────────── N / ノーマル・ひこう
  {
    id: 'suzutaka',
    no: 8,
    name: 'スズタカ',
    rarity: 'N',
    types: ['normal', 'flying'],
    baseStats: { hp: 62, atk: 72, def: 56, spa: 46, spd: 52, spe: 92 }, // 合計 380
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 6, move: 'quickhit' },      // はやわざ
      { lv: 11, move: 'glare' },        // にらむ
      { lv: 17, move: 'soar' },         // まいあがる
      { lv: 24, move: 'nosedive' },     // きゅうこうか
      { lv: 28, move: 'windblade' },    // かぜのやいば
      { lv: 34, move: 'skycharge' },    // てんくうとっしん
      { lv: 42, move: 'crush' },        // おしつぶす
    ],
    expGroup: 'fast',
    baseExp: 124,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#987040', '#f8e0b0', '#d84830'], seed: 21 },
    gacha: false,
    evolution: { to: 'ootakamaru', level: 34 },
    category: 'わかたかモンスター',
    height: 0.8,
    weight: 9.5,
    desc: 'チュンピが おおきく なった すがた。するどい ツメで えものを つかみ そらたかくから まちを みまもって いる。',
  },

  // ─── No.009 オオタカマル ───────────────────────── N / ノーマル・ひこう
  {
    id: 'ootakamaru',
    no: 9,
    name: 'オオタカマル',
    rarity: 'N',
    types: ['normal', 'flying'],
    baseStats: { hp: 80, atk: 98, def: 70, spa: 58, spd: 66, spe: 110 }, // 合計 482
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 6, move: 'quickhit' },      // はやわざ
      { lv: 11, move: 'glare' },        // にらむ
      { lv: 17, move: 'soar' },         // まいあがる
      { lv: 24, move: 'nosedive' },     // きゅうこうか
      { lv: 28, move: 'windblade' },    // かぜのやいば
      { lv: 34, move: 'skycharge' },    // てんくうとっしん
      { lv: 38, move: 'powerup' },      // りきむ
      { lv: 42, move: 'crush' },        // おしつぶす
      { lv: 52, move: 'bigstorm' },     // おおあらし
    ],
    expGroup: 'fast',
    baseExp: 186,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#7a5830', '#f0d8a0', '#c83828'], seed: 22 },
    gacha: false,
    category: 'おおたかモンスター',
    height: 1.5,
    weight: 28.0,
    desc: 'スズタカが しんかした そらの おうさま。おおきな つばさを ひとふり するだけで あらしの ような かぜが おこる。',
  },

  // ─── No.010 ワタモチ ───────────────────────────── N / ノーマル
  {
    id: 'watamochi',
    no: 10,
    name: 'ワタモチ',
    rarity: 'N',
    types: ['normal'],
    baseStats: { hp: 72, atk: 38, def: 52, spa: 36, spd: 58, spe: 30 }, // 合計 286
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'growl' },         // なきごえ
      { lv: 9, move: 'quickhit' },      // はやわざ
      { lv: 15, move: 'rest' },         // ひとやすみ
      { lv: 21, move: 'crush' },        // おしつぶす
      { lv: 30, move: 'bigvoice' },     // おおごえ
      { lv: 40, move: 'allout' },       // ぜんりょくタックル
    ],
    expGroup: 'fast',
    baseExp: 58,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#f8f0e8', '#f8c8d0', '#a08878'] },
    gacha: true,
    evolution: { to: 'fuwadaifuku', level: 20 },
    category: 'わたげモンスター',
    height: 0.4,
    weight: 3.0,
    desc: 'わたの ように ふわふわで もちの ように よく のびる。だきしめると ねむくなる。',
  },

  // ─── No.011 フワダイフク ───────────────────────── N / ノーマル
  {
    id: 'fuwadaifuku',
    no: 11,
    name: 'フワダイフク',
    rarity: 'N',
    types: ['normal'],
    baseStats: { hp: 105, atk: 54, def: 74, spa: 52, spd: 82, spe: 38 }, // 合計 405
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'growl' },         // なきごえ
      { lv: 9, move: 'quickhit' },      // はやわざ
      { lv: 15, move: 'rest' },         // ひとやすみ
      { lv: 20, move: 'powerup' },      // りきむ
      { lv: 21, move: 'crush' },        // おしつぶす
      { lv: 30, move: 'bigvoice' },     // おおごえ
      { lv: 34, move: 'soulheal' },     // こころのいやし
      { lv: 40, move: 'allout' },       // ぜんりょくタックル
      { lv: 48, move: 'dreamlure' },    // ゆめさそい
    ],
    expGroup: 'fast',
    baseExp: 130,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#f8e8e0', '#f8b0c0', '#907060'], seed: 31 },
    gacha: false,
    category: 'おおわたげモンスター',
    height: 0.9,
    weight: 12.0,
    desc: 'ワタモチが ふくらんで おおきく なった すがた。やわらかい からだに だきつくと だれでも すぐに ねむって しまう。',
  },

  // ─── No.012 イモムン ───────────────────────────── N / むし
  {
    id: 'imomun',
    no: 12,
    name: 'イモムン',
    rarity: 'N',
    types: ['bug'],
    baseStats: { hp: 50, atk: 42, def: 55, spa: 28, spd: 44, spe: 36 }, // 合計 255
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'spiderthread' },  // くものいと
      { lv: 6, move: 'gnaw' },          // かじる
      { lv: 12, move: 'needlerain' },   // はりのあめ
      { lv: 18, move: 'rockarmor' },    // いわのよろい
      { lv: 26, move: 'crush' },        // おしつぶす
      { lv: 38, move: 'hornupper' },    // ツノつきあげ
    ],
    expGroup: 'fast',
    baseExp: 50,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#88c040', '#f8e858', '#d04830'] },
    gacha: true,
    evolution: { to: 'mayukabuto', level: 16 },
    category: 'いもむしモンスター',
    height: 0.3,
    weight: 2.9,
    desc: 'はっぱを たべて どんどん おおきくなる。あたまの ツノから くさい においを だして みを まもる。',
  },

  // ─── No.013 マユカブト ─────────────────────────── N / むし
  {
    id: 'mayukabuto',
    no: 13,
    name: 'マユカブト',
    rarity: 'N',
    types: ['bug'],
    baseStats: { hp: 70, atk: 72, def: 82, spa: 40, spd: 60, spe: 52 }, // 合計 376
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'spiderthread' },  // くものいと
      { lv: 6, move: 'gnaw' },          // かじる
      { lv: 12, move: 'needlerain' },   // はりのあめ
      { lv: 18, move: 'rockarmor' },    // いわのよろい
      { lv: 22, move: 'mantisfist' },   // とうろうけん
      { lv: 26, move: 'crush' },        // おしつぶす
      { lv: 30, move: 'landslide' },    // がけくずし
      { lv: 38, move: 'hornupper' },    // ツノつきあげ
      { lv: 48, move: 'powerup' },      // りきむ
    ],
    expGroup: 'fast',
    baseExp: 120,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#6a9e30', '#f0d840', '#c03820'], seed: 41 },
    gacha: false,
    category: 'まゆかぶとモンスター',
    height: 0.7,
    weight: 18.0,
    desc: 'イモムンが かたい まゆの ヨロイを まとった すがた。つのを ふりまわして ちかづく てきを おいはらう。',
  },

  // ─── No.014 ヒラリン ───────────────────────────── N / むし・ひこう
  {
    id: 'hirarin',
    no: 14,
    name: 'ヒラリン',
    rarity: 'N',
    types: ['bug', 'flying'],
    baseStats: { hp: 42, atk: 30, def: 38, spa: 58, spd: 50, spe: 60 }, // 合計 278
    learnset: [
      { lv: 1, move: 'whirl' },         // つむじかぜ
      { lv: 5, move: 'sleepscent' },    // ねむりのかおり
      { lv: 10, move: 'sip' },          // すいあげ
      { lv: 17, move: 'scalestorm' },   // りんぷんあらし
      { lv: 25, move: 'windblade' },    // かぜのやいば
      { lv: 31, move: 'focusmind' },    // せいしんとういつ
      { lv: 40, move: 'bigstorm' },     // おおあらし
    ],
    expGroup: 'medium_fast',
    baseExp: 60,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#f8a8d0', '#fff0a0', '#7058b8'] },
    gacha: true,
    evolution: { to: 'hirahime', level: 20 },
    category: 'ひらひらモンスター',
    height: 0.5,
    weight: 1.2,
    desc: 'はなばたけを ひらひら とびまわる。はねの りんぷんを あびると なぜか ねむくなる。',
  },

  // ─── No.015 ヒラヒメ ───────────────────────────── N / むし・ひこう
  {
    id: 'hirahime',
    no: 15,
    name: 'ヒラヒメ',
    rarity: 'N',
    types: ['bug', 'flying'],
    baseStats: { hp: 60, atk: 42, def: 56, spa: 84, spd: 74, spe: 86 }, // 合計 402
    learnset: [
      { lv: 1, move: 'whirl' },         // つむじかぜ
      { lv: 5, move: 'sleepscent' },    // ねむりのかおり
      { lv: 10, move: 'sip' },          // すいあげ
      { lv: 17, move: 'scalestorm' },   // りんぷんあらし
      { lv: 22, move: 'psybullet' },    // ねんどうだん
      { lv: 25, move: 'windblade' },    // かぜのやいば
      { lv: 31, move: 'focusmind' },    // せいしんとういつ
      { lv: 35, move: 'forestbreath' }, // もりのいぶき
      { lv: 40, move: 'bigstorm' },     // おおあらし
      { lv: 48, move: 'mindburst' },    // マインドバースト
    ],
    expGroup: 'medium_fast',
    baseExp: 134,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#f088c0', '#fff080', '#5840a8'], seed: 51 },
    gacha: false,
    category: 'まいひめモンスター',
    height: 0.9,
    weight: 2.6,
    desc: 'ヒラリンが うつくしく しんかした すがた。はねを ひらく たびに ふしぎな ひかりの こなが まいおちる。',
  },

  // ─── No.016 ピリネズ ───────────────────────────── N / でんき
  {
    id: 'pirinezu',
    no: 16,
    name: 'ピリネズ',
    rarity: 'N',
    types: ['electric'],
    baseStats: { hp: 38, atk: 48, def: 34, spa: 56, spd: 40, spe: 80 }, // 合計 296
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'jolt' },          // でんげき
      { lv: 9, move: 'quickhit' },      // はやわざ
      { lv: 13, move: 'shockwave' },    // しびれでんぱ
      { lv: 18, move: 'elekick' },      // エレキック
      { lv: 26, move: 'boltarrow' },    // いかずちのや
      { lv: 38, move: 'thunderroar' },  // ごうらい
    ],
    expGroup: 'medium_fast',
    baseExp: 60,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#f8d030', '#fff4b0', '#503818'] },
    gacha: true,
    evolution: { to: 'bachinezu', level: 18 },
    category: 'ピリピリモンスター',
    height: 0.3,
    weight: 2.4,
    desc: 'ながい しっぽを アンテナの ように たてて でんきを あつめる。さわると ピリッと しびれる。',
  },

  // ─── No.017 バチネズ ───────────────────────────── N / でんき
  {
    id: 'bachinezu',
    no: 17,
    name: 'バチネズ',
    rarity: 'N',
    types: ['electric'],
    baseStats: { hp: 52, atk: 66, def: 48, spa: 78, spd: 56, spe: 106 }, // 合計 406
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'jolt' },          // でんげき
      { lv: 9, move: 'quickhit' },      // はやわざ
      { lv: 13, move: 'shockwave' },    // しびれでんぱ
      { lv: 18, move: 'elekick' },      // エレキック
      { lv: 22, move: 'sparkrush' },    // スパークラッシュ
      { lv: 26, move: 'boltarrow' },    // いかずちのや
      { lv: 32, move: 'crush' },        // おしつぶす
      { lv: 38, move: 'thunderroar' },  // ごうらい
      { lv: 46, move: 'powerup' },      // りきむ
    ],
    expGroup: 'medium_fast',
    baseExp: 136,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#f0c020', '#fff0a0', '#402810'], seed: 61 },
    gacha: false,
    evolution: { to: 'kaminarinezu', level: 34 },
    category: 'バチバチモンスター',
    height: 0.6,
    weight: 7.8,
    desc: 'ピリネズが せいちょうした すがた。ほっぺの でんきが つよく なり おこると まわりに ひばなが ちらばる。',
  },

  // ─── No.018 カミナリネズ ───────────────────────── N / でんき
  {
    id: 'kaminarinezu',
    no: 18,
    name: 'カミナリネズ',
    rarity: 'N',
    types: ['electric'],
    baseStats: { hp: 66, atk: 82, def: 60, spa: 98, spd: 70, spe: 120 }, // 合計 496
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'jolt' },          // でんげき
      { lv: 9, move: 'quickhit' },      // はやわざ
      { lv: 13, move: 'shockwave' },    // しびれでんぱ
      { lv: 18, move: 'elekick' },      // エレキック
      { lv: 22, move: 'sparkrush' },    // スパークラッシュ
      { lv: 26, move: 'boltarrow' },    // いかずちのや
      { lv: 32, move: 'crush' },        // おしつぶす
      { lv: 34, move: 'chomp' },        // がぶり
      { lv: 38, move: 'thunderroar' },  // ごうらい
      { lv: 46, move: 'powerup' },      // りきむ
      { lv: 52, move: 'allout' },       // ぜんりょくタックル
    ],
    expGroup: 'medium_fast',
    baseExp: 198,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#e8a818', '#ffe880', '#302008'], seed: 62 },
    gacha: false,
    category: 'らいじゅうモンスター',
    height: 1.1,
    weight: 24.0,
    desc: 'バチネズが さらに しんかした すがた。しっぽを てんに むけて カミナリを よびよせ その ちからを たくわえる。',
  },

  // ─── No.019 ツボミン ───────────────────────────── N / くさ
  {
    id: 'tsubomin',
    no: 19,
    name: 'ツボミン',
    rarity: 'N',
    types: ['grass'],
    baseStats: { hp: 50, atk: 36, def: 46, spa: 58, spd: 54, spe: 38 }, // 合計 282
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'sip' },           // すいあげ
      { lv: 10, move: 'sleepscent' },   // ねむりのかおり
      { lv: 14, move: 'leafcut' },      // はっぱぎり
      { lv: 21, move: 'forestbreath' }, // もりのいぶき
      { lv: 28, move: 'focusmind' },    // せいしんとういつ
      { lv: 38, move: 'sunbeam' },      // ひだまりほう
    ],
    expGroup: 'medium_fast',
    baseExp: 56,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#68c050', '#f890b0', '#386828'] },
    gacha: true,
    evolution: { to: 'hanasakin', level: 16 },
    category: 'つぼみモンスター',
    height: 0.3,
    weight: 2.0,
    desc: 'あたまの つぼみは まだ ひらかない。ひなたで ひるねを すると すこしずつ ふくらんでいく。',
  },

  // ─── No.020 ハナサキン ─────────────────────────── N / くさ
  {
    id: 'hanasakin',
    no: 20,
    name: 'ハナサキン',
    rarity: 'N',
    types: ['grass'],
    baseStats: { hp: 68, atk: 50, def: 64, spa: 82, spd: 76, spe: 52 }, // 合計 392
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'sip' },           // すいあげ
      { lv: 10, move: 'sleepscent' },   // ねむりのかおり
      { lv: 14, move: 'leafcut' },      // はっぱぎり
      { lv: 21, move: 'forestbreath' }, // もりのいぶき
      { lv: 24, move: 'thornlash' },    // いばらうち
      { lv: 28, move: 'focusmind' },    // せいしんとういつ
      { lv: 33, move: 'soulheal' },     // こころのいやし
      { lv: 38, move: 'sunbeam' },      // ひだまりほう
      { lv: 46, move: 'treefall' },     // たいぼくおとし
    ],
    expGroup: 'medium_fast',
    baseExp: 128,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#58b040', '#f878a0', '#2e5a20'], seed: 71 },
    gacha: false,
    evolution: { to: 'hanakanmuri', level: 32 },
    category: 'はなさきモンスター',
    height: 0.6,
    weight: 5.5,
    desc: 'ツボミンの つぼみが ひらいた すがた。はなの あまい かおりは つかれた なかまの こころを いやすと いう。',
  },

  // ─── No.021 ハナカンムリ ───────────────────────── N / くさ・エスパー
  {
    id: 'hanakanmuri',
    no: 21,
    name: 'ハナカンムリ',
    rarity: 'N',
    types: ['grass', 'psychic'],
    baseStats: { hp: 84, atk: 60, def: 80, spa: 104, spd: 96, spe: 62 }, // 合計 486
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'sip' },           // すいあげ
      { lv: 10, move: 'sleepscent' },   // ねむりのかおり
      { lv: 14, move: 'leafcut' },      // はっぱぎり
      { lv: 21, move: 'forestbreath' }, // もりのいぶき
      { lv: 24, move: 'thornlash' },    // いばらうち
      { lv: 28, move: 'focusmind' },    // せいしんとういつ
      { lv: 32, move: 'psybullet' },    // ねんどうだん
      { lv: 33, move: 'soulheal' },     // こころのいやし
      { lv: 38, move: 'sunbeam' },      // ひだまりほう
      { lv: 46, move: 'treefall' },     // たいぼくおとし
      { lv: 52, move: 'mindburst' },    // マインドバースト
    ],
    expGroup: 'medium_fast',
    baseExp: 190,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#48a038', '#f06090', '#244a18'], seed: 12 },
    gacha: false,
    category: 'はなかんむりモンスター',
    height: 1.0,
    weight: 14.0,
    desc: 'ハナサキンが しんかした すがた。あたまの はなの かんむりで ひとの こころを よみとる ふしぎな ちからを もつ。',
  },

  // ─── No.022 カサボウ ───────────────────────────── R / くさ・どく
  {
    id: 'kasabou',
    no: 22,
    name: 'カサボウ',
    rarity: 'R',
    types: ['grass', 'poison'],
    baseStats: { hp: 64, atk: 58, def: 62, spa: 64, spd: 64, spe: 30 }, // 合計 342
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sip' },           // すいあげ
      { lv: 6, move: 'sleepscent' },    // ねむりのかおり
      { lv: 10, move: 'poisonspray' },  // どくしぶき
      { lv: 18, move: 'forestbreath' }, // もりのいぶき
      { lv: 26, move: 'poisonvortex' }, // どくのうず
      { lv: 32, move: 'rest' },         // ひとやすみ
      { lv: 40, move: 'sunbeam' },      // ひだまりほう
    ],
    expGroup: 'medium_fast',
    baseExp: 90,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#d04848', '#f8f0d8', '#784830'] },
    gacha: true,
    evolution: { to: 'kasanoou', level: 30 },
    category: 'きのこモンスター',
    height: 0.5,
    weight: 6.0,
    desc: 'かさの もようが こいほど どくが つよい。もりの おくで ほうしを まいて なかまを ふやす。',
  },

  // ─── No.023 カサノオウ ─────────────────────────── R / くさ・どく
  {
    id: 'kasanoou',
    no: 23,
    name: 'カサノオウ',
    rarity: 'R',
    types: ['grass', 'poison'],
    baseStats: { hp: 90, atk: 78, def: 86, spa: 88, spd: 88, spe: 42 }, // 合計 472
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sip' },           // すいあげ
      { lv: 6, move: 'sleepscent' },    // ねむりのかおり
      { lv: 10, move: 'poisonspray' },  // どくしぶき
      { lv: 18, move: 'forestbreath' }, // もりのいぶき
      { lv: 26, move: 'poisonvortex' }, // どくのうず
      { lv: 30, move: 'thornlash' },    // いばらうち
      { lv: 32, move: 'rest' },         // ひとやすみ
      { lv: 36, move: 'toxicmist' },    // どくのきり
      { lv: 40, move: 'sunbeam' },      // ひだまりほう
      { lv: 48, move: 'venomburst' },   // ベノムバースト
      { lv: 56, move: 'treefall' },     // たいぼくおとし
    ],
    expGroup: 'medium_fast',
    baseExp: 162,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#b83838', '#f8e8c8', '#683820'], seed: 181 },
    gacha: false,
    category: 'だいきのこモンスター',
    height: 1.4,
    weight: 45.0,
    desc: 'カサボウが おおきく しんかした すがた。かさから まく ほうしを すった ものは ふらふらに なって しまう。',
  },

  // ─── No.024 メダッカ ───────────────────────────── N / みず
  {
    id: 'medakka',
    no: 24,
    name: 'メダッカ',
    rarity: 'N',
    types: ['water'],
    baseStats: { hp: 40, atk: 44, def: 38, spa: 42, spd: 38, spe: 76 }, // 合計 278
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 4, move: 'sandcloud' },     // すなけむり
      { lv: 8, move: 'waterskip' },     // みずきり
      { lv: 13, move: 'gnaw' },         // かじる
      { lv: 20, move: 'flowshot' },     // すいりゅうだん
      { lv: 27, move: 'surge' },        // うちよせる
      { lv: 38, move: 'torrent' },      // だいこうずい
    ],
    expGroup: 'fast',
    baseExp: 54,
    image: '',
    backImage: '',
    sprite: { shape: 'fish', colors: ['#80b8e8', '#f8f8f8', '#f89838'] },
    gacha: true,
    evolution: { to: 'hayaseuo', level: 20 },
    category: 'こざかなモンスター',
    height: 0.2,
    weight: 0.6,
    desc: 'むれで くらす ちいさな さかな。きけんを かんじると いっせいに ちって すばやく にげる。',
  },

  // ─── No.025 ハヤセウオ ─────────────────────────── N / みず
  {
    id: 'hayaseuo',
    no: 25,
    name: 'ハヤセウオ',
    rarity: 'N',
    types: ['water'],
    baseStats: { hp: 58, atk: 64, def: 54, spa: 60, spd: 54, spe: 104 }, // 合計 394
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 4, move: 'sandcloud' },     // すなけむり
      { lv: 8, move: 'waterskip' },     // みずきり
      { lv: 13, move: 'gnaw' },         // かじる
      { lv: 20, move: 'flowshot' },     // すいりゅうだん
      { lv: 20, move: 'chomp' },        // がぶり
      { lv: 27, move: 'surge' },        // うちよせる
      { lv: 32, move: 'coldbreath' },   // つめたいいき
      { lv: 38, move: 'torrent' },      // だいこうずい
      { lv: 46, move: 'iciclevolley' }, // つららうち
    ],
    expGroup: 'fast',
    baseExp: 124,
    image: '',
    backImage: '',
    sprite: { shape: 'fish', colors: ['#5898d8', '#f0f8ff', '#f08028'], seed: 81 },
    gacha: false,
    category: 'はやせモンスター',
    height: 0.7,
    weight: 4.2,
    desc: 'メダッカが おおきく なった すがた。はやい かわの ながれも へいきで さかのぼり むれの せんとうを およぐ。',
  },

  // ─── No.026 ビリウナギ ─────────────────────────── R / でんき・みず
  {
    id: 'biriunagi',
    no: 26,
    name: 'ビリウナギ',
    rarity: 'R',
    types: ['electric', 'water'],
    baseStats: { hp: 60, atk: 60, def: 50, spa: 75, spd: 55, spe: 58 }, // 合計 358
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 4, move: 'jolt' },          // でんげき
      { lv: 9, move: 'shockwave' },     // しびれでんぱ
      { lv: 16, move: 'flowshot' },     // すいりゅうだん
      { lv: 22, move: 'boltarrow' },    // いかずちのや
      { lv: 34, move: 'thunderroar' },  // ごうらい
      { lv: 42, move: 'torrent' },      // だいこうずい
    ],
    expGroup: 'medium_fast',
    baseExp: 95,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#3868a8', '#f8e050', '#b8e0f8'] },
    gacha: true,
    evolution: { to: 'raiutsubo', level: 32 },
    category: 'ほうでんモンスター',
    height: 1.2,
    weight: 9.0,
    desc: 'くらい かわの そこに すむ。からだの もようを ひからせて えものを しびれさせる。',
  },

  // ─── No.027 ライウツボ ─────────────────────────── R / でんき・みず
  {
    id: 'raiutsubo',
    no: 27,
    name: 'ライウツボ',
    rarity: 'R',
    types: ['electric', 'water'],
    baseStats: { hp: 82, atk: 78, def: 68, spa: 100, spd: 74, spe: 78 }, // 合計 480
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 4, move: 'jolt' },          // でんげき
      { lv: 9, move: 'shockwave' },     // しびれでんぱ
      { lv: 16, move: 'flowshot' },     // すいりゅうだん
      { lv: 22, move: 'boltarrow' },    // いかずちのや
      { lv: 32, move: 'sparkrush' },    // スパークラッシュ
      { lv: 34, move: 'thunderroar' },  // ごうらい
      { lv: 38, move: 'chomp' },        // がぶり
      { lv: 42, move: 'torrent' },      // だいこうずい
      { lv: 50, move: 'surge' },        // うちよせる
    ],
    expGroup: 'medium_fast',
    baseExp: 170,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#284e90', '#f8d030', '#98d0f8'], seed: 191 },
    gacha: false,
    category: 'らいでんモンスター',
    height: 2.8,
    weight: 52.0,
    desc: 'ビリウナギが しんかした すがた。うみの そこの いわあなに すみ ちかづく ものに つよい でんきを はなつ。',
  },

  // ─── No.028 ドクナメ ───────────────────────────── N / どく
  {
    id: 'dokuname',
    no: 28,
    name: 'ドクナメ',
    rarity: 'N',
    types: ['poison'],
    baseStats: { hp: 62, atk: 40, def: 58, spa: 50, spd: 60, spe: 20 }, // 合計 290
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'poisonspray' },   // どくしぶき
      { lv: 7, move: 'toxicmist' },     // どくのきり
      { lv: 13, move: 'watermembrane' }, // みずのまく
      { lv: 22, move: 'poisonvortex' }, // どくのうず
      { lv: 28, move: 'rest' },         // ひとやすみ
      { lv: 37, move: 'venomburst' },   // ベノムバースト
    ],
    expGroup: 'medium_fast',
    baseExp: 58,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#a058b0', '#d8f068', '#583068'] },
    gacha: true,
    evolution: { to: 'dokumaimai', level: 22 },
    category: 'どくなめくじモンスター',
    height: 0.4,
    weight: 4.5,
    desc: 'とおった あとには ぬるぬるの どくえきが のこる。しめった ばしょが だいすき。',
  },

  // ─── No.029 ドクマイマイ ───────────────────────── N / どく・みず
  {
    id: 'dokumaimai',
    no: 29,
    name: 'ドクマイマイ',
    rarity: 'N',
    types: ['poison', 'water'],
    baseStats: { hp: 88, atk: 56, def: 82, spa: 72, spd: 86, spe: 26 }, // 合計 410
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'poisonspray' },   // どくしぶき
      { lv: 7, move: 'toxicmist' },     // どくのきり
      { lv: 13, move: 'watermembrane' }, // みずのまく
      { lv: 22, move: 'poisonvortex' }, // どくのうず
      { lv: 22, move: 'flowshot' },     // すいりゅうだん
      { lv: 28, move: 'rest' },         // ひとやすみ
      { lv: 32, move: 'rockarmor' },    // いわのよろい
      { lv: 37, move: 'venomburst' },   // ベノムバースト
      { lv: 46, move: 'torrent' },      // だいこうずい
    ],
    expGroup: 'medium_fast',
    baseExp: 132,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#884098', '#c8e850', '#402050'], seed: 91 },
    gacha: false,
    category: 'どくまいまいモンスター',
    height: 0.8,
    weight: 16.0,
    desc: 'ドクナメが かたい カラを せおった すがた。あめの ひに でてきて どくの ある みずを ぴゅっと ふきかける。',
  },

  // ─── No.030 ハリバチ ───────────────────────────── R / どく・むし
  {
    id: 'haribachi',
    no: 30,
    name: 'ハリバチ',
    rarity: 'R',
    types: ['poison', 'bug'],
    baseStats: { hp: 55, atk: 80, def: 45, spa: 35, spd: 60, spe: 82 }, // 合計 357
    learnset: [
      { lv: 1, move: 'poisonthorn' },   // どくのトゲ
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'quickhit' },      // はやわざ
      { lv: 10, move: 'needlerain' },   // はりのあめ
      { lv: 16, move: 'powerup' },      // りきむ
      { lv: 22, move: 'poisonblade' },  // どくのやいば
      { lv: 29, move: 'mantisfist' },   // とうろうけん
      { lv: 38, move: 'skycharge' },    // てんくうとっしん
    ],
    expGroup: 'medium_fast',
    baseExp: 92,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#f8c828', '#383028', '#a048c0'] },
    gacha: true,
    category: 'どくばちモンスター',
    height: 0.6,
    weight: 3.4,
    desc: 'おしりの はりには つよい どくが ある。すを あらす ものには むれで おそいかかる。',
  },

  // ─── No.031 ドロッチ ───────────────────────────── N / じめん
  {
    id: 'dorocchi',
    no: 31,
    name: 'ドロッチ',
    rarity: 'N',
    types: ['ground'],
    baseStats: { hp: 60, atk: 62, def: 60, spa: 30, spd: 40, spe: 30 }, // 合計 282
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 11, move: 'powerup' },      // りきむ
      { lv: 15, move: 'pebbles' },      // いしなげ
      { lv: 23, move: 'earthsplit' },   // だいちわり
      { lv: 30, move: 'crush' },        // おしつぶす
      { lv: 40, move: 'crustquake' },   // ちかくへんどう
    ],
    expGroup: 'medium_fast',
    baseExp: 58,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#a07848', '#d8b888', '#503820'] },
    gacha: true,
    evolution: { to: 'numabouzu', level: 20 },
    category: 'どろんこモンスター',
    height: 0.5,
    weight: 14.0,
    desc: 'どろの なかで ころがるのが だいすき。からだが かわくと ひびわれて うごけなくなる。',
  },

  // ─── No.032 ヌマボウズ ─────────────────────────── N / じめん
  {
    id: 'numabouzu',
    no: 32,
    name: 'ヌマボウズ',
    rarity: 'N',
    types: ['ground'],
    baseStats: { hp: 86, atk: 88, def: 84, spa: 42, spd: 56, spe: 40 }, // 合計 396
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 11, move: 'powerup' },      // りきむ
      { lv: 15, move: 'pebbles' },      // いしなげ
      { lv: 23, move: 'earthsplit' },   // だいちわり
      { lv: 26, move: 'surge' },        // うちよせる
      { lv: 30, move: 'crush' },        // おしつぶす
      { lv: 34, move: 'sandcannon' },   // さじんほう
      { lv: 40, move: 'crustquake' },   // ちかくへんどう
      { lv: 48, move: 'rest' },         // ひとやすみ
    ],
    expGroup: 'medium_fast',
    baseExp: 130,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#8a6438', '#c8a070', '#402a18'], seed: 101 },
    gacha: false,
    category: 'ぬまぬしモンスター',
    height: 1.2,
    weight: 60.0,
    desc: 'ドロッチが ぬまの どろを たくさん すって おおきく なった すがた。ぬまの そこで じっと えものを まつ。',
  },

  // ─── No.033 ヨロイダマ ─────────────────────────── R / じめん
  {
    id: 'yoroidama',
    no: 33,
    name: 'ヨロイダマ',
    rarity: 'R',
    types: ['ground'],
    baseStats: { hp: 60, atk: 72, def: 88, spa: 30, spd: 48, spe: 42 }, // 合計 340
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 11, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'landslide' },    // がけくずし
      { lv: 24, move: 'earthsplit' },   // だいちわり
      { lv: 30, move: 'rest' },         // ひとやすみ
      { lv: 38, move: 'crustquake' },   // ちかくへんどう
    ],
    expGroup: 'medium_slow',
    baseExp: 94,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#c8a060', '#7a5a38', '#f0dca0'] },
    gacha: true,
    evolution: { to: 'ganyoroi', level: 30 },
    category: 'よろいだまモンスター',
    height: 0.8,
    weight: 32.0,
    desc: 'かたい こうらで おおわれている。おどろくと まるくなって さかみちを ころがって にげる。',
  },

  // ─── No.034 ガンヨロイ ─────────────────────────── R / じめん・いわ
  {
    id: 'ganyoroi',
    no: 34,
    name: 'ガンヨロイ',
    rarity: 'R',
    types: ['ground', 'rock'],
    baseStats: { hp: 84, atk: 98, def: 118, spa: 40, spd: 66, spe: 56 }, // 合計 462
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 11, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'landslide' },    // がけくずし
      { lv: 24, move: 'earthsplit' },   // だいちわり
      { lv: 30, move: 'rest' },         // ひとやすみ
      { lv: 30, move: 'crush' },        // おしつぶす
      { lv: 38, move: 'crustquake' },   // ちかくへんどう
      { lv: 44, move: 'boulderdrop' },  // きょがんおとし
      { lv: 54, move: 'powerup' },      // りきむ
    ],
    expGroup: 'medium_slow',
    baseExp: 166,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#b08848', '#644828', '#f0d080'], seed: 201 },
    gacha: false,
    category: 'がんくつモンスター',
    height: 1.6,
    weight: 180.0,
    desc: 'ヨロイダマが しんかした すがた。こうらは いわの ように かたく まるまると どんな こうげきも はねかえす。',
  },

  // ─── No.035 コイシン ───────────────────────────── N / いわ
  {
    id: 'koishin',
    no: 35,
    name: 'コイシン',
    rarity: 'N',
    types: ['rock'],
    baseStats: { hp: 45, atk: 60, def: 80, spa: 25, spd: 40, spe: 20 }, // 合計 270
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'sandcloud' },     // すなけむり
      { lv: 8, move: 'pebbles' },       // いしなげ
      { lv: 13, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'stomp' },        // ふみならし
      { lv: 25, move: 'landslide' },    // がけくずし
      { lv: 32, move: 'earthsplit' },   // だいちわり
      { lv: 40, move: 'boulderdrop' },  // きょがんおとし
    ],
    expGroup: 'medium_fast',
    baseExp: 55,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#a8a098', '#d8d0c0', '#605850'] },
    gacha: true,
    evolution: { to: 'gansekin', level: 18 },
    category: 'こいしモンスター',
    height: 0.3,
    weight: 20.0,
    desc: 'かわらの いしに まぎれて ねている。ふまれても へいきな かおで ねむりつづける。',
  },

  // ─── No.036 ガンセキン ─────────────────────────── N / いわ
  {
    id: 'gansekin',
    no: 36,
    name: 'ガンセキン',
    rarity: 'N',
    types: ['rock'],
    baseStats: { hp: 64, atk: 84, def: 110, spa: 36, spd: 56, spe: 28 }, // 合計 378
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'sandcloud' },     // すなけむり
      { lv: 8, move: 'pebbles' },       // いしなげ
      { lv: 13, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'stomp' },        // ふみならし
      { lv: 22, move: 'powerup' },      // りきむ
      { lv: 25, move: 'landslide' },    // がけくずし
      { lv: 32, move: 'earthsplit' },   // だいちわり
      { lv: 36, move: 'crush' },        // おしつぶす
      { lv: 40, move: 'boulderdrop' },  // きょがんおとし
      { lv: 48, move: 'rest' },         // ひとやすみ
    ],
    expGroup: 'medium_fast',
    baseExp: 128,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#908878', '#c8c0b0', '#504840'], seed: 111 },
    gacha: false,
    evolution: { to: 'iwayamao', level: 36 },
    category: 'がんせきモンスター',
    height: 0.8,
    weight: 85.0,
    desc: 'コイシンが いわを とりこんで おおきく なった すがた。さかみちを ころがって いどうし いわかべに ぶつかっても へいき。',
  },

  // ─── No.037 イワヤマオー ───────────────────────── N / いわ・じめん
  {
    id: 'iwayamao',
    no: 37,
    name: 'イワヤマオー',
    rarity: 'N',
    types: ['rock', 'ground'],
    baseStats: { hp: 82, atk: 108, def: 130, spa: 46, spd: 70, spe: 34 }, // 合計 470
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'sandcloud' },     // すなけむり
      { lv: 8, move: 'pebbles' },       // いしなげ
      { lv: 13, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'stomp' },        // ふみならし
      { lv: 22, move: 'powerup' },      // りきむ
      { lv: 25, move: 'landslide' },    // がけくずし
      { lv: 32, move: 'earthsplit' },   // だいちわり
      { lv: 36, move: 'crush' },        // おしつぶす
      { lv: 36, move: 'crustquake' },   // ちかくへんどう
      { lv: 40, move: 'boulderdrop' },  // きょがんおとし
      { lv: 48, move: 'rest' },         // ひとやすみ
      { lv: 54, move: 'sandcannon' },   // さじんほう
    ],
    expGroup: 'medium_fast',
    baseExp: 190,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#787060', '#b8b0a0', '#c05030'], seed: 112 },
    gacha: false,
    category: 'いわやまモンスター',
    height: 1.9,
    weight: 420.0,
    desc: 'ガンセキンが しんかした すがた。ねむって いると ちいさな やまと まちがえられ せなかに くさや きが はえる。',
  },

  // ─── No.038 カマドン ───────────────────────────── R / ほのお・いわ
  {
    id: 'kamadon',
    no: 38,
    name: 'カマドン',
    rarity: 'R',
    types: ['fire', 'rock'],
    baseStats: { hp: 66, atk: 45, def: 80, spa: 72, spd: 60, spe: 25 }, // 合計 348
    learnset: [
      { lv: 1, move: 'ember' },         // ひのこ
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 7, move: 'pebbles' },       // いしなげ
      { lv: 12, move: 'hotbreath' },    // あついいき
      { lv: 17, move: 'rockarmor' },    // いわのよろい
      { lv: 23, move: 'flamebullet' },  // かえんだん
      { lv: 30, move: 'gembeam' },      // ほうせきビーム
      { lv: 36, move: 'sandcannon' },   // さじんほう
      { lv: 43, move: 'infernoblast' }, // ごうえん
    ],
    expGroup: 'medium_slow',
    baseExp: 96,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#b86848', '#f8a030', '#4a3028'] },
    gacha: true,
    category: 'かまどモンスター',
    height: 0.9,
    weight: 88.0,
    desc: 'おなかの なかで いつも ひが もえている。むかしの ひとは この モンスターで ごはんを たいた。',
  },

  // ─── No.039 コブシン ───────────────────────────── N / かくとう
  {
    id: 'kobushin',
    no: 39,
    name: 'コブシン',
    rarity: 'N',
    types: ['fighting'],
    baseStats: { hp: 50, atk: 72, def: 42, spa: 28, spd: 38, spe: 58 }, // 合計 288
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'straightpunch' }, // せいけんづき
      { lv: 14, move: 'train' },        // きたえる
      { lv: 20, move: 'axekick' },      // かかとおとし
      { lv: 26, move: 'scorchpunch' },  // しゃくねつパンチ
      { lv: 36, move: 'furiousrush' },  // もうれつラッシュ
    ],
    expGroup: 'medium_fast',
    baseExp: 62,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#e8a070', '#f8f0e0', '#c03028'] },
    gacha: true,
    evolution: { to: 'genkotsun', level: 18 },
    category: 'こぶしモンスター',
    height: 0.6,
    weight: 18.0,
    desc: 'まいにち いわを なぐって こぶしを きたえている。つよい あいてを みると むねが おどる。',
  },

  // ─── No.040 ゲンコツン ─────────────────────────── N / かくとう
  {
    id: 'genkotsun',
    no: 40,
    name: 'ゲンコツン',
    rarity: 'N',
    types: ['fighting'],
    baseStats: { hp: 70, atk: 100, def: 60, spa: 38, spd: 54, spe: 78 }, // 合計 400
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'straightpunch' }, // せいけんづき
      { lv: 14, move: 'train' },        // きたえる
      { lv: 20, move: 'axekick' },      // かかとおとし
      { lv: 24, move: 'powerup' },      // りきむ
      { lv: 26, move: 'scorchpunch' },  // しゃくねつパンチ
      { lv: 30, move: 'crush' },        // おしつぶす
      { lv: 36, move: 'furiousrush' },  // もうれつラッシュ
      { lv: 44, move: 'qicannon' },     // きこうほう
    ],
    expGroup: 'medium_fast',
    baseExp: 136,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#d88858', '#f8e8d0', '#a82018'], seed: 121 },
    gacha: false,
    evolution: { to: 'tekkenou', level: 36 },
    category: 'げんこつモンスター',
    height: 1.1,
    weight: 42.0,
    desc: 'コブシンが きたえぬいて しんかした すがた。まいにち いわを なぐって こぶしを かたく きたえて いる。',
  },

  // ─── No.041 テッケンオウ ───────────────────────── N / かくとう
  {
    id: 'tekkenou',
    no: 41,
    name: 'テッケンオウ',
    rarity: 'N',
    types: ['fighting'],
    baseStats: { hp: 88, atk: 124, def: 76, spa: 46, spd: 66, spe: 92 }, // 合計 492
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'straightpunch' }, // せいけんづき
      { lv: 14, move: 'train' },        // きたえる
      { lv: 20, move: 'axekick' },      // かかとおとし
      { lv: 24, move: 'powerup' },      // りきむ
      { lv: 26, move: 'scorchpunch' },  // しゃくねつパンチ
      { lv: 30, move: 'crush' },        // おしつぶす
      { lv: 36, move: 'furiousrush' },  // もうれつラッシュ
      { lv: 40, move: 'steelknuckle' }, // スチールナックル
      { lv: 44, move: 'qicannon' },     // きこうほう
      { lv: 52, move: 'allout' },       // ぜんりょくタックル
    ],
    expGroup: 'medium_fast',
    baseExp: 200,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#c07048', '#f0e0c0', '#901810'], seed: 122 },
    gacha: false,
    category: 'てっけんモンスター',
    height: 1.8,
    weight: 105.0,
    desc: 'ゲンコツンが さらに しんかした すがた。その こぶしは てつの ように かたく ひとつきで おおいわを くだく。',
  },

  // ─── No.042 カマキリン ─────────────────────────── R / むし・かくとう
  {
    id: 'kamakirin',
    no: 42,
    name: 'カマキリン',
    rarity: 'R',
    types: ['bug', 'fighting'],
    baseStats: { hp: 55, atk: 86, def: 55, spa: 30, spd: 50, spe: 74 }, // 合計 350
    learnset: [
      { lv: 1, move: 'scratch' },       // ひっかく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'leafcut' },      // はっぱぎり
      { lv: 15, move: 'powerup' },      // りきむ
      { lv: 21, move: 'mantisfist' },   // とうろうけん
      { lv: 28, move: 'axekick' },      // かかとおとし
      { lv: 38, move: 'furiousrush' },  // もうれつラッシュ
    ],
    expGroup: 'medium_fast',
    baseExp: 94,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#88c858', '#e8f0a0', '#c83838'] },
    gacha: true,
    evolution: { to: 'kamakensei', level: 30 },
    category: 'かまけんぽうモンスター',
    height: 0.9,
    weight: 11.0,
    desc: 'りょううでの カマで かまえを とる。くさむらで じっと まち とおりかかった あいてに しょうぶを いどむ。',
  },

  // ─── No.043 カマケンセイ ───────────────────────── R / むし・かくとう
  {
    id: 'kamakensei',
    no: 43,
    name: 'カマケンセイ',
    rarity: 'R',
    types: ['bug', 'fighting'],
    baseStats: { hp: 72, atk: 114, def: 72, spa: 40, spd: 66, spe: 100 }, // 合計 464
    learnset: [
      { lv: 1, move: 'scratch' },       // ひっかく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'leafcut' },      // はっぱぎり
      { lv: 15, move: 'powerup' },      // りきむ
      { lv: 21, move: 'mantisfist' },   // とうろうけん
      { lv: 28, move: 'axekick' },      // かかとおとし
      { lv: 30, move: 'thornlash' },    // いばらうち
      { lv: 38, move: 'furiousrush' },  // もうれつラッシュ
      { lv: 44, move: 'hornupper' },    // ツノつきあげ
      { lv: 54, move: 'windblade' },    // かぜのやいば
    ],
    expGroup: 'medium_fast',
    baseExp: 168,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#70b040', '#e0e888', '#b02828'], seed: 211 },
    gacha: false,
    category: 'けんせいモンスター',
    height: 1.5,
    weight: 34.0,
    desc: 'カマキリンが しゅぎょうの すえに しんかした すがた。りょううでの カマで くうきさえも まっぷたつに する。',
  },

  // ─── No.044 カゲネコ ───────────────────────────── N / あく
  {
    id: 'kageneko',
    no: 44,
    name: 'カゲネコ',
    rarity: 'N',
    types: ['dark'],
    baseStats: { hp: 42, atk: 62, def: 38, spa: 40, spd: 38, spe: 76 }, // 合計 296
    learnset: [
      { lv: 1, move: 'scratch' },       // ひっかく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'chomp' },         // がぶり
      { lv: 10, move: 'quickhit' },     // はやわざ
      { lv: 16, move: 'exploit' },      // すきをつく
      { lv: 24, move: 'darkstrike' },   // やみうち
      { lv: 38, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'fast',
    baseExp: 60,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#403848', '#6a6078', '#f8d030'] },
    gacha: true,
    evolution: { to: 'kagehyou', level: 22 },
    category: 'かげねこモンスター',
    height: 0.4,
    weight: 4.0,
    desc: 'よるに なると かげから かげへ おとも なく わたりあるく。きんいろの めだけが やみに うかぶ。',
  },

  // ─── No.045 カゲヒョウ ─────────────────────────── N / あく
  {
    id: 'kagehyou',
    no: 45,
    name: 'カゲヒョウ',
    rarity: 'N',
    types: ['dark'],
    baseStats: { hp: 58, atk: 88, def: 54, spa: 56, spd: 54, spe: 104 }, // 合計 414
    learnset: [
      { lv: 1, move: 'scratch' },       // ひっかく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'chomp' },         // がぶり
      { lv: 10, move: 'quickhit' },     // はやわざ
      { lv: 16, move: 'exploit' },      // すきをつく
      { lv: 22, move: 'scheme' },       // たくらむ
      { lv: 24, move: 'darkstrike' },   // やみうち
      { lv: 30, move: 'ghostclaw' },    // ゆうれいのツメ
      { lv: 38, move: 'abyssdrop' },    // ならくおとし
      { lv: 48, move: 'powerup' },      // りきむ
    ],
    expGroup: 'fast',
    baseExp: 134,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#302838', '#5a5068', '#f8c020'], seed: 131 },
    gacha: false,
    category: 'かげひょうモンスター',
    height: 1.0,
    weight: 30.0,
    desc: 'カゲネコが せいちょうした すがた。よるの かげに とけこんで あしおとも たてずに えものに しのびよる。',
  },

  // ─── No.046 シノビン ───────────────────────────── R / あく
  {
    id: 'shinobin',
    no: 46,
    name: 'シノビン',
    rarity: 'R',
    types: ['dark'],
    baseStats: { hp: 52, atk: 76, def: 50, spa: 52, spd: 48, spe: 90 }, // 合計 368
    learnset: [
      { lv: 1, move: 'quickhit' },      // はやわざ
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'creepshadow' },   // しのびよるかげ
      { lv: 11, move: 'exploit' },      // すきをつく
      { lv: 16, move: 'powerup' },      // りきむ
      { lv: 22, move: 'darkstrike' },   // やみうち
      { lv: 29, move: 'axekick' },      // かかとおとし
      { lv: 38, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'medium_fast',
    baseExp: 98,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#383858', '#a0a8c0', '#d83838'] },
    gacha: true,
    evolution: { to: 'shinobigami', level: 32 },
    category: 'しのびモンスター',
    height: 1.0,
    weight: 26.0,
    desc: 'すなけむりに まぎれて すがたを けす。だれにも みられずに しごとを やりとげるのが ほこり。',
  },

  // ─── No.047 シノビガミ ─────────────────────────── R / あく
  {
    id: 'shinobigami',
    no: 47,
    name: 'シノビガミ',
    rarity: 'R',
    types: ['dark'],
    baseStats: { hp: 70, atk: 102, def: 66, spa: 70, spd: 64, spe: 116 }, // 合計 488
    learnset: [
      { lv: 1, move: 'quickhit' },      // はやわざ
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'creepshadow' },   // しのびよるかげ
      { lv: 11, move: 'exploit' },      // すきをつく
      { lv: 16, move: 'powerup' },      // りきむ
      { lv: 22, move: 'darkstrike' },   // やみうち
      { lv: 29, move: 'axekick' },      // かかとおとし
      { lv: 32, move: 'ghostclaw' },    // ゆうれいのツメ
      { lv: 38, move: 'abyssdrop' },    // ならくおとし
      { lv: 44, move: 'scheme' },       // たくらむ
      { lv: 52, move: 'blackorb' },     // しっこくのたま
    ],
    expGroup: 'medium_fast',
    baseExp: 172,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#282848', '#9098b0', '#c82828'], seed: 221 },
    gacha: false,
    category: 'かげがみモンスター',
    height: 1.7,
    weight: 48.0,
    desc: 'シノビンが しんかした すがた。かげから かげへ いっしゅんで うつり その すがたを みた ものは いない。',
  },

  // ─── No.048 ユラリ ─────────────────────────────── N / ゴースト
  {
    id: 'yurari',
    no: 48,
    name: 'ユラリ',
    rarity: 'N',
    types: ['ghost'],
    baseStats: { hp: 38, atk: 30, def: 42, spa: 66, spd: 58, spe: 56 }, // 合計 290
    learnset: [
      { lv: 1, move: 'wisp' },          // ひとだま
      { lv: 5, move: 'scarystory' },    // こわいはなし
      { lv: 10, move: 'dreamlure' },    // ゆめさそい
      { lv: 16, move: 'lifesip' },      // いのちすい
      { lv: 24, move: 'spiritbullet' }, // れいこんだん
      { lv: 38, move: 'underworldgate' }, // よみのとびら
    ],
    expGroup: 'medium_fast',
    baseExp: 62,
    image: '',
    backImage: '',
    sprite: { shape: 'ghost', colors: ['#b8a8e0', '#f0e8ff', '#6048a0'] },
    gacha: true,
    evolution: { to: 'oboron', level: 24 },
    category: 'ゆらゆらモンスター',
    height: 0.5,
    weight: 0.1,
    desc: 'ゆうぐれに なると どこからともなく あらわれ ゆらゆら ただよう。さわろうと すると すりぬける。',
  },

  // ─── No.049 オボロン ───────────────────────────── N / ゴースト
  {
    id: 'oboron',
    no: 49,
    name: 'オボロン',
    rarity: 'N',
    types: ['ghost'],
    baseStats: { hp: 56, atk: 42, def: 60, spa: 94, spd: 82, spe: 80 }, // 合計 414
    learnset: [
      { lv: 1, move: 'wisp' },          // ひとだま
      { lv: 5, move: 'scarystory' },    // こわいはなし
      { lv: 10, move: 'dreamlure' },    // ゆめさそい
      { lv: 16, move: 'lifesip' },      // いのちすい
      { lv: 24, move: 'spiritbullet' }, // れいこんだん
      { lv: 30, move: 'psybullet' },    // ねんどうだん
      { lv: 38, move: 'underworldgate' }, // よみのとびら
      { lv: 44, move: 'focusmind' },    // せいしんとういつ
      { lv: 52, move: 'mindburst' },    // マインドバースト
    ],
    expGroup: 'medium_fast',
    baseExp: 138,
    image: '',
    backImage: '',
    sprite: { shape: 'ghost', colors: ['#9888d0', '#e8e0ff', '#483088'], seed: 141 },
    gacha: false,
    category: 'おぼろモンスター',
    height: 1.0,
    weight: 0.3,
    desc: 'ユラリが しんかした すがた。きりの ふかい よるに あらわれ ぼんやりと した ひかりで ひとを まよわせる。',
  },

  // ─── No.050 カラカサン ─────────────────────────── R / ゴースト・ひこう
  {
    id: 'karakasan',
    no: 50,
    name: 'カラカサン',
    rarity: 'R',
    types: ['ghost', 'flying'],
    baseStats: { hp: 58, atk: 70, def: 60, spa: 58, spd: 62, spe: 52 }, // 合計 360
    learnset: [
      { lv: 1, move: 'creepshadow' },   // しのびよるかげ
      { lv: 1, move: 'scarystory' },    // こわいはなし
      { lv: 6, move: 'peck' },          // つつく
      { lv: 11, move: 'soar' },         // まいあがる
      { lv: 17, move: 'ghostclaw' },    // ゆうれいのツメ
      { lv: 23, move: 'nosedive' },     // きゅうこうか
      { lv: 29, move: 'spiritbullet' }, // れいこんだん
      { lv: 38, move: 'skycharge' },    // てんくうとっしん
    ],
    expGroup: 'medium_fast',
    baseExp: 96,
    image: '',
    backImage: '',
    sprite: { shape: 'ghost', colors: ['#d85848', '#f8e8c0', '#6a3828'] },
    gacha: true,
    category: 'からかさモンスター',
    height: 1.1,
    weight: 2.5,
    desc: 'すてられた かさに たましいが やどった。あめの ひに ひとりで ぴょんぴょん はねて あそぶ。',
  },

  // ─── No.051 カゼキリ ───────────────────────────── R / ひこう
  {
    id: 'kazekiri',
    no: 51,
    name: 'カゼキリ',
    rarity: 'R',
    types: ['flying'],
    baseStats: { hp: 52, atk: 78, def: 48, spa: 40, spd: 45, spe: 95 }, // 合計 358
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'quickhit' },      // はやわざ
      { lv: 12, move: 'soar' },         // まいあがる
      { lv: 19, move: 'nosedive' },     // きゅうこうか
      { lv: 25, move: 'powerup' },      // りきむ
      { lv: 38, move: 'skycharge' },    // てんくうとっしん
    ],
    expGroup: 'medium_fast',
    baseExp: 90,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#5878b8', '#f0f0f8', '#f8c030'] },
    gacha: true,
    evolution: { to: 'hayateou', level: 30 },
    category: 'はやかぜモンスター',
    height: 0.8,
    weight: 7.5,
    desc: 'かぜを きりさく はやさで そらを とぶ。つばさの さきは はものの ように するどい。',
  },

  // ─── No.052 ハヤテオウ ─────────────────────────── R / ひこう
  {
    id: 'hayateou',
    no: 52,
    name: 'ハヤテオウ',
    rarity: 'R',
    types: ['flying'],
    baseStats: { hp: 70, atk: 104, def: 64, spa: 54, spd: 60, spe: 124 }, // 合計 476
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'quickhit' },      // はやわざ
      { lv: 12, move: 'soar' },         // まいあがる
      { lv: 19, move: 'nosedive' },     // きゅうこうか
      { lv: 25, move: 'powerup' },      // りきむ
      { lv: 30, move: 'windblade' },    // かぜのやいば
      { lv: 38, move: 'skycharge' },    // てんくうとっしん
      { lv: 44, move: 'steellariat' },  // こうてつラリアット
      { lv: 54, move: 'bigstorm' },     // おおあらし
    ],
    expGroup: 'medium_fast',
    baseExp: 164,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#4060a8', '#e8e8f8', '#f8b020'], seed: 231 },
    gacha: false,
    category: 'しっぷうモンスター',
    height: 1.6,
    weight: 24.0,
    desc: 'カゼキリが しんかした すがた。おとよりも はやく とび すぎさった あとから かぜの おとが きこえて くる。',
  },

  // ─── No.053 ミトオシ ───────────────────────────── R / エスパー・ひこう
  {
    id: 'mitooshi',
    no: 53,
    name: 'ミトオシ',
    rarity: 'R',
    types: ['psychic', 'flying'],
    baseStats: { hp: 55, atk: 45, def: 50, spa: 80, spd: 62, spe: 70 }, // 合計 362
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'thoughtwave' },   // ねんぱ
      { lv: 5, move: 'glare' },         // にらむ
      { lv: 10, move: 'dreamlure' },    // ゆめさそい
      { lv: 18, move: 'psybullet' },    // ねんどうだん
      { lv: 24, move: 'focusmind' },    // せいしんとういつ
      { lv: 30, move: 'windblade' },    // かぜのやいば
      { lv: 40, move: 'mindburst' },    // マインドバースト
    ],
    expGroup: 'medium_slow',
    baseExp: 100,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#8868b0', '#f0d8a0', '#f8e040'] },
    gacha: true,
    category: 'みとおしモンスター',
    height: 0.7,
    weight: 6.0,
    desc: 'おおきな めで あしたの てんきを みとおす という。めを あわせると ふしぎと ねむくなる。',
  },

  // ─── No.054 ブリキン ───────────────────────────── N / はがね
  {
    id: 'burikin',
    no: 54,
    name: 'ブリキン',
    rarity: 'N',
    types: ['steel'],
    baseStats: { hp: 50, atk: 55, def: 75, spa: 35, spd: 50, spe: 35 }, // 合計 300
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 5, move: 'creak' },         // きしみおと
      { lv: 9, move: 'steelknuckle' },  // スチールナックル
      { lv: 14, move: 'train' },        // きたえる
      { lv: 19, move: 'quickhit' },     // はやわざ
      { lv: 25, move: 'steellariat' },  // こうてつラリアット
      { lv: 32, move: 'crush' },        // おしつぶす
      { lv: 40, move: 'ironhammer' },   // てっつい
    ],
    expGroup: 'medium_fast',
    baseExp: 64,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#a8b0c0', '#e04838', '#586070'] },
    gacha: true,
    evolution: { to: 'burikingu', level: 22 },
    category: 'ブリキモンスター',
    height: 0.5,
    weight: 12.0,
    desc: 'せなかの ねじを まくと げんきに うごきだす。ねじが ゆるむと その ばで ねむってしまう。',
  },

  // ─── No.055 ブリキング ─────────────────────────── N / はがね
  {
    id: 'burikingu',
    no: 55,
    name: 'ブリキング',
    rarity: 'N',
    types: ['steel'],
    baseStats: { hp: 70, atk: 78, def: 104, spa: 48, spd: 70, spe: 48 }, // 合計 418
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 5, move: 'creak' },         // きしみおと
      { lv: 9, move: 'steelknuckle' },  // スチールナックル
      { lv: 14, move: 'train' },        // きたえる
      { lv: 19, move: 'quickhit' },     // はやわざ
      { lv: 25, move: 'steellariat' },  // こうてつラリアット
      { lv: 28, move: 'silverbeam' },   // ぎんいろこうせん
      { lv: 32, move: 'crush' },        // おしつぶす
      { lv: 36, move: 'rockarmor' },    // いわのよろい
      { lv: 40, move: 'ironhammer' },   // てっつい
      { lv: 50, move: 'furiousrush' },  // もうれつラッシュ
    ],
    expGroup: 'medium_fast',
    baseExp: 140,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#9098b0', '#d83828', '#485060'], seed: 151 },
    gacha: false,
    category: 'ブリキおうモンスター',
    height: 1.3,
    weight: 88.0,
    desc: 'ブリキンが しんかした すがた。あたまの おうかんは じぶんで つくった もので こわれると すぐに なおす。',
  },

  // ─── No.056 ハガネムシ ─────────────────────────── R / はがね・むし
  {
    id: 'haganemushi',
    no: 56,
    name: 'ハガネムシ',
    rarity: 'R',
    types: ['steel', 'bug'],
    baseStats: { hp: 62, atk: 82, def: 90, spa: 30, spd: 60, spe: 40 }, // 合計 364
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'gnaw' },          // かじる
      { lv: 8, move: 'rockarmor' },     // いわのよろい
      { lv: 12, move: 'steelknuckle' }, // スチールナックル
      { lv: 18, move: 'powerup' },      // りきむ
      { lv: 24, move: 'steellariat' },  // こうてつラリアット
      { lv: 32, move: 'hornupper' },    // ツノつきあげ
      { lv: 42, move: 'ironhammer' },   // てっつい
    ],
    expGroup: 'medium_slow',
    baseExp: 100,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#6878a0', '#c8d0e0', '#e8b030'] },
    gacha: true,
    evolution: { to: 'haganekabuto', level: 32 },
    category: 'こうちゅうモンスター',
    height: 0.7,
    weight: 40.0,
    desc: 'はがねの ように かたい はねを もつ むし。ツノで たいぼくを もちあげる ちからもちだ。',
  },

  // ─── No.057 ハガネカブト ───────────────────────── R / はがね・むし
  {
    id: 'haganekabuto',
    no: 57,
    name: 'ハガネカブト',
    rarity: 'R',
    types: ['steel', 'bug'],
    baseStats: { hp: 80, atk: 108, def: 118, spa: 40, spd: 80, spe: 54 }, // 合計 480
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 4, move: 'gnaw' },          // かじる
      { lv: 8, move: 'rockarmor' },     // いわのよろい
      { lv: 12, move: 'steelknuckle' }, // スチールナックル
      { lv: 18, move: 'powerup' },      // りきむ
      { lv: 24, move: 'steellariat' },  // こうてつラリアット
      { lv: 32, move: 'hornupper' },    // ツノつきあげ
      { lv: 32, move: 'mantisfist' },   // とうろうけん
      { lv: 42, move: 'ironhammer' },   // てっつい
      { lv: 48, move: 'crush' },        // おしつぶす
      { lv: 56, move: 'furiousrush' },  // もうれつラッシュ
    ],
    expGroup: 'medium_slow',
    baseExp: 175,
    image: '',
    backImage: '',
    sprite: { shape: 'insect', colors: ['#506090', '#b8c0d8', '#e0a020'], seed: 241 },
    gacha: false,
    category: 'はがねかぶとモンスター',
    height: 1.4,
    weight: 95.0,
    desc: 'ハガネムシが しんかした すがた。はがねの つのは ダイヤモンドより かたく おおきな いわも もちあげる。',
  },

  // ─── No.058 ユキチドリ ─────────────────────────── N / こおり・ひこう
  {
    id: 'yukichidori',
    no: 58,
    name: 'ユキチドリ',
    rarity: 'N',
    types: ['ice', 'flying'],
    baseStats: { hp: 44, atk: 46, def: 40, spa: 58, spd: 46, spe: 66 }, // 合計 300
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'frost' },         // しもばしら
      { lv: 14, move: 'coldbreath' },   // つめたいいき
      { lv: 20, move: 'soar' },         // まいあがる
      { lv: 27, move: 'windblade' },    // かぜのやいば
      { lv: 34, move: 'freezecannon' }, // ひょうけつほう
      { lv: 44, move: 'heavysnow' },    // ごうせつ
    ],
    expGroup: 'medium_fast',
    baseExp: 64,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#e8f4ff', '#88c8e8', '#3868a8'] },
    gacha: true,
    evolution: { to: 'fubukidori', level: 24 },
    category: 'ゆきどりモンスター',
    height: 0.3,
    weight: 1.5,
    desc: 'ゆきの ふる ひにだけ すがたを みせる ことり。はばたくと こまかい こおりの つぶが きらきら まう。',
  },

  // ─── No.059 フブキドリ ─────────────────────────── N / こおり・ひこう
  {
    id: 'fubukidori',
    no: 59,
    name: 'フブキドリ',
    rarity: 'N',
    types: ['ice', 'flying'],
    baseStats: { hp: 62, atk: 64, def: 56, spa: 82, spd: 64, spe: 92 }, // 合計 420
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'growl' },         // なきごえ
      { lv: 5, move: 'frost' },         // しもばしら
      { lv: 14, move: 'coldbreath' },   // つめたいいき
      { lv: 20, move: 'soar' },         // まいあがる
      { lv: 24, move: 'iciclevolley' }, // つららうち
      { lv: 27, move: 'windblade' },    // かぜのやいば
      { lv: 34, move: 'freezecannon' }, // ひょうけつほう
      { lv: 38, move: 'nosedive' },     // きゅうこうか
      { lv: 44, move: 'heavysnow' },    // ごうせつ
      { lv: 50, move: 'bigstorm' },     // おおあらし
    ],
    expGroup: 'medium_fast',
    baseExp: 140,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#d8ecff', '#68b0e0', '#285898'], seed: 161 },
    gacha: false,
    category: 'ふぶきどりモンスター',
    height: 0.9,
    weight: 7.0,
    desc: 'ユキチドリが しんかした すがた。つばさを はばたかせると あたり いちめんに はげしい ふぶきが ふきあれる。',
  },

  // ─── No.060 ユキガスミ ─────────────────────────── R / こおり・ゴースト
  {
    id: 'yukigasumi',
    no: 60,
    name: 'ユキガスミ',
    rarity: 'R',
    types: ['ice', 'ghost'],
    baseStats: { hp: 52, atk: 50, def: 48, spa: 78, spd: 70, spe: 72 }, // 合計 370
    learnset: [
      { lv: 1, move: 'frost' },         // しもばしら
      { lv: 1, move: 'scarystory' },    // こわいはなし
      { lv: 6, move: 'wisp' },          // ひとだま
      { lv: 11, move: 'coldbreath' },   // つめたいいき
      { lv: 16, move: 'lifesip' },      // いのちすい
      { lv: 22, move: 'spiritbullet' }, // れいこんだん
      { lv: 29, move: 'freezecannon' }, // ひょうけつほう
      { lv: 39, move: 'heavysnow' },    // ごうせつ
    ],
    expGroup: 'medium_slow',
    baseExp: 104,
    image: '',
    backImage: '',
    sprite: { shape: 'ghost', colors: ['#d0e8f8', '#ffffff', '#7890d0'] },
    gacha: true,
    category: 'ふぶきモンスター',
    height: 1.2,
    weight: 0.8,
    desc: 'ふぶきの よるに あらわれる ゆきの せい。まよった たびびとを やさしい こえで よびよせる。',
  },

  // ─── No.061 ホシヨミ ───────────────────────────── SR / エスパー
  {
    id: 'hoshiyomi',
    no: 61,
    name: 'ホシヨミ',
    rarity: 'SR',
    types: ['psychic'],
    baseStats: { hp: 62, atk: 40, def: 60, spa: 102, spd: 88, spe: 80 }, // 合計 432
    learnset: [
      { lv: 1, move: 'thoughtwave' },   // ねんぱ
      { lv: 5, move: 'dreamlure' },     // ゆめさそい
      { lv: 10, move: 'soulheal' },     // こころのいやし
      { lv: 16, move: 'psybullet' },    // ねんどうだん
      { lv: 22, move: 'focusmind' },    // せいしんとういつ
      { lv: 28, move: 'silverbeam' },   // ぎんいろこうせん
      { lv: 40, move: 'mindburst' },    // マインドバースト
      { lv: 48, move: 'meteorfall' },   // いんせきおとし
    ],
    expGroup: 'medium_slow',
    baseExp: 145,
    image: '',
    backImage: '',
    sprite: { shape: 'blob', colors: ['#283878', '#f8e878', '#b8a0f0'] },
    gacha: true,
    category: 'ほしうらないモンスター',
    height: 0.6,
    weight: 3.3,
    desc: 'よぞらの ほしの ならびを よみ みらいを うらなう。ねがいごとを すると ながれぼしを よぶ という。',
  },

  // ─── No.062 キツネビ ───────────────────────────── SR / ゴースト・ほのお
  {
    id: 'kitsunebi',
    no: 62,
    name: 'キツネビ',
    rarity: 'SR',
    types: ['ghost', 'fire'],
    baseStats: { hp: 62, atk: 50, def: 58, spa: 96, spd: 84, spe: 90 }, // 合計 440
    learnset: [
      { lv: 1, move: 'ember' },         // ひのこ
      { lv: 1, move: 'scarystory' },    // こわいはなし
      { lv: 5, move: 'wisp' },          // ひとだま
      { lv: 10, move: 'hotbreath' },    // あついいき
      { lv: 15, move: 'dreamlure' },    // ゆめさそい
      { lv: 22, move: 'flamebullet' },  // かえんだん
      { lv: 29, move: 'spiritbullet' }, // れいこんだん
      { lv: 38, move: 'infernoblast' }, // ごうえん
      { lv: 46, move: 'underworldgate' }, // よみのとびら
    ],
    expGroup: 'medium_slow',
    baseExp: 150,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#f8f0e0', '#68d0f8', '#e84828'] },
    gacha: true,
    category: 'きつねびモンスター',
    height: 0.9,
    weight: 14.5,
    desc: 'しっぽの さきに あおい ひを ともし よみちを さまよう。ひを おいかけた ものは もりで まいごに なる。',
  },

  // ─── No.063 ライガロウ ─────────────────────────── SR / でんき・あく
  {
    id: 'raigarou',
    no: 63,
    name: 'ライガロウ',
    rarity: 'SR',
    types: ['electric', 'dark'],
    baseStats: { hp: 66, atk: 92, def: 60, spa: 76, spd: 58, spe: 94 }, // 合計 446
    learnset: [
      { lv: 1, move: 'chomp' },         // がぶり
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'shockwave' },     // しびれでんぱ
      { lv: 10, move: 'quickhit' },     // はやわざ
      { lv: 14, move: 'elekick' },      // エレキック
      { lv: 19, move: 'exploit' },      // すきをつく
      { lv: 25, move: 'sparkrush' },    // スパークラッシュ
      { lv: 31, move: 'darkstrike' },   // やみうち
      { lv: 40, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'medium_slow',
    baseExp: 150,
    image: '',
    backImage: '',
    sprite: { shape: 'quadruped', colors: ['#303858', '#f8d030', '#58c8f8'] },
    gacha: true,
    category: 'らいげきモンスター',
    height: 1.3,
    weight: 48.0,
    desc: 'かみなりの よるに とおぼえを する。からだの いなずまもようが ひかると だれも ちかよれない。',
  },

  // ─── No.064 ドクジャ ───────────────────────────── SR / どく・あく
  {
    id: 'dokuja',
    no: 64,
    name: 'ドクジャ',
    rarity: 'SR',
    types: ['poison', 'dark'],
    baseStats: { hp: 66, atk: 88, def: 60, spa: 70, spd: 62, spe: 84 }, // 合計 430
    learnset: [
      { lv: 1, move: 'chomp' },         // がぶり
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'toxicmist' },     // どくのきり
      { lv: 11, move: 'exploit' },      // すきをつく
      { lv: 17, move: 'poisonblade' },  // どくのやいば
      { lv: 23, move: 'darkstrike' },   // やみうち
      { lv: 30, move: 'powerup' },      // りきむ
      { lv: 38, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'medium_slow',
    baseExp: 140,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#583878', '#c8f048', '#201830'] },
    gacha: true,
    category: 'どくへびモンスター',
    height: 2.4,
    weight: 30.0,
    desc: 'しっぽの さきが やいばの ように するどい。めを あわせた あいては からだが すくんで うごけなくなる。',
  },

  // ─── No.065 スナクジラ ─────────────────────────── SR / じめん
  {
    id: 'sunakujira',
    no: 65,
    name: 'スナクジラ',
    rarity: 'SR',
    types: ['ground'],
    baseStats: { hp: 110, atk: 88, def: 76, spa: 50, spd: 62, spe: 40 }, // 合計 426
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 12, move: 'rest' },         // ひとやすみ
      { lv: 20, move: 'earthsplit' },   // だいちわり
      { lv: 27, move: 'surge' },        // うちよせる
      { lv: 33, move: 'crush' },        // おしつぶす
      { lv: 42, move: 'crustquake' },   // ちかくへんどう
    ],
    expGroup: 'medium_slow',
    baseExp: 145,
    image: '',
    backImage: '',
    sprite: { shape: 'fish', colors: ['#d8b070', '#f8e8c0', '#8a6038'] },
    gacha: true,
    category: 'さばくくじらモンスター',
    height: 4.5,
    weight: 350.0,
    desc: 'さばくの すなの なかを およぐ おおきな くじら。せなかから すなを ふきあげて いきを する。',
  },

  // ─── No.066 イワバサ ───────────────────────────── SR / いわ・ひこう
  {
    id: 'iwabasa',
    no: 66,
    name: 'イワバサ',
    rarity: 'SR',
    types: ['rock', 'flying'],
    baseStats: { hp: 70, atk: 92, def: 64, spa: 50, spd: 60, spe: 98 }, // 合計 434
    learnset: [
      { lv: 1, move: 'peck' },          // つつく
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 6, move: 'pebbles' },       // いしなげ
      { lv: 11, move: 'soar' },         // まいあがる
      { lv: 18, move: 'nosedive' },     // きゅうこうか
      { lv: 25, move: 'landslide' },    // がけくずし
      { lv: 31, move: 'powerup' },      // りきむ
      { lv: 37, move: 'skycharge' },    // てんくうとっしん
      { lv: 45, move: 'boulderdrop' },  // きょがんおとし
    ],
    expGroup: 'medium_slow',
    baseExp: 145,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#908070', '#d8c8a8', '#c85838'] },
    gacha: true,
    category: 'こだいよくモンスター',
    height: 1.6,
    weight: 45.0,
    desc: 'いわの なかから めざめた こだいの モンスター。いわの つばさで がけの あいだを すばやく とびまわる。',
  },

  // ─── No.067 ハガネブシ ─────────────────────────── SR / はがね・かくとう
  {
    id: 'haganebushi',
    no: 67,
    name: 'ハガネブシ',
    rarity: 'SR',
    types: ['steel', 'fighting'],
    baseStats: { hp: 64, atk: 100, def: 85, spa: 45, spd: 64, spe: 72 }, // 合計 430
    learnset: [
      { lv: 1, move: 'steelknuckle' },  // スチールナックル
      { lv: 1, move: 'glare' },         // にらむ
      { lv: 5, move: 'jab' },           // ジャブ
      { lv: 10, move: 'train' },        // きたえる
      { lv: 15, move: 'straightpunch' }, // せいけんづき
      { lv: 21, move: 'axekick' },      // かかとおとし
      { lv: 27, move: 'steellariat' },  // こうてつラリアット
      { lv: 35, move: 'ironhammer' },   // てっつい
      { lv: 45, move: 'furiousrush' },  // もうれつラッシュ
    ],
    expGroup: 'medium_slow',
    baseExp: 148,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#707888', '#c83030', '#e8d8a0'] },
    gacha: true,
    category: 'よろいむしゃモンスター',
    height: 1.5,
    weight: 90.0,
    desc: 'はがねの よろいを まとった ぶしの モンスター。ひきょうな ことを きらい しょうぶは いつも まっこうから。',
  },

  // ─── No.068 イッカクジラ ───────────────────────── SR / こおり・みず
  {
    id: 'ikkakujira',
    no: 68,
    name: 'イッカクジラ',
    rarity: 'SR',
    types: ['ice', 'water'],
    baseStats: { hp: 90, atk: 82, def: 70, spa: 76, spd: 70, spe: 52 }, // 合計 440
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 5, move: 'growl' },         // なきごえ
      { lv: 10, move: 'iciclevolley' }, // つららうち
      { lv: 16, move: 'watermembrane' }, // みずのまく
      { lv: 22, move: 'surge' },        // うちよせる
      { lv: 28, move: 'icebergcrash' }, // ひょうざんクラッシュ
      { lv: 35, move: 'rest' },         // ひとやすみ
      { lv: 44, move: 'heavysnow' },    // ごうせつ
    ],
    expGroup: 'medium_slow',
    baseExp: 150,
    image: '',
    backImage: '',
    sprite: { shape: 'fish', colors: ['#8ab0d8', '#f0f8ff', '#e8e0c0'] },
    gacha: true,
    category: 'いっかくモンスター',
    height: 3.8,
    weight: 210.0,
    desc: 'こおりの うみを むれで およぐ。ひたいの ながい ツノで ぶあつい こおりも かんたんに わってしまう。',
  },

  // ─── No.069 タツマル ───────────────────────────── SR / ドラゴン
  {
    id: 'tatsumaru',
    no: 69,
    name: 'タツマル',
    rarity: 'SR',
    types: ['dragon'],
    baseStats: { hp: 70, atk: 90, def: 68, spa: 70, spd: 62, spe: 76 }, // 合計 436
    learnset: [
      { lv: 1, move: 'tackle' },        // たいあたり
      { lv: 1, move: 'dragongrowl' },   // りゅうのうなり
      { lv: 5, move: 'glare' },         // にらむ
      { lv: 10, move: 'chomp' },        // がぶり
      { lv: 16, move: 'dragonroar' },   // りゅうのほうこう
      { lv: 22, move: 'dragonclaw' },   // りゅうそうげき
      { lv: 28, move: 'flameclaw' },    // もえるツメ
      { lv: 34, move: 'dragonwave' },   // りゅうおうは
      { lv: 44, move: 'skydragon' },    // てんりゅうげき
    ],
    expGroup: 'medium_slow',
    baseExp: 155,
    image: '',
    backImage: '',
    sprite: { shape: 'dragon', colors: ['#5878d8', '#f8e0a0', '#f8f8f8'] },
    gacha: true,
    category: 'こりゅうモンスター',
    height: 0.9,
    weight: 22.0,
    desc: 'ちいさいが れっきとした りゅうの こども。まだ とべないので まいにち がけから とびおりる れんしゅうを している。',
  },

  // ─── No.070 モリノヌシ ─────────────────────────── SSR / くさ・じめん
  {
    id: 'morinonushi',
    no: 70,
    name: 'モリノヌシ',
    rarity: 'SSR',
    types: ['grass', 'ground'],
    baseStats: { hp: 105, atk: 100, def: 95, spa: 70, spd: 90, spe: 45 }, // 合計 505
    learnset: [
      { lv: 1, move: 'leafcut' },       // はっぱぎり
      { lv: 1, move: 'stomp' },         // ふみならし
      { lv: 7, move: 'sleepscent' },    // ねむりのかおり
      { lv: 12, move: 'rest' },         // ひとやすみ
      { lv: 18, move: 'thornlash' },    // いばらうち
      { lv: 24, move: 'earthsplit' },   // だいちわり
      { lv: 30, move: 'forestbreath' }, // もりのいぶき
      { lv: 38, move: 'treefall' },     // たいぼくおとし
      { lv: 46, move: 'crustquake' },   // ちかくへんどう
    ],
    expGroup: 'slow',
    baseExp: 200,
    image: '',
    backImage: '',
    sprite: { shape: 'plant', colors: ['#4a8a38', '#8a6038', '#f8d860'] },
    gacha: true,
    category: 'もりのぬしモンスター',
    height: 5.0,
    weight: 800.0,
    desc: 'せんねん いきた たいぼくに やどる もりの ぬし。この モンスターが ねむる もりは けっして かれない。',
  },

  // ─── No.071 ゴウテツ ───────────────────────────── SSR / はがね・じめん
  {
    id: 'goutetsu',
    no: 71,
    name: 'ゴウテツ',
    rarity: 'SSR',
    types: ['steel', 'ground'],
    baseStats: { hp: 95, atk: 115, def: 118, spa: 45, spd: 75, spe: 40 }, // 合計 488
    learnset: [
      { lv: 1, move: 'steelknuckle' },  // スチールナックル
      { lv: 1, move: 'sandcloud' },     // すなけむり
      { lv: 6, move: 'stomp' },         // ふみならし
      { lv: 11, move: 'rockarmor' },    // いわのよろい
      { lv: 18, move: 'steellariat' },  // こうてつラリアット
      { lv: 24, move: 'earthsplit' },   // だいちわり
      { lv: 30, move: 'powerup' },      // りきむ
      { lv: 37, move: 'ironhammer' },   // てっつい
      { lv: 45, move: 'crustquake' },   // ちかくへんどう
    ],
    expGroup: 'medium_slow',
    baseExp: 195,
    image: '',
    backImage: '',
    sprite: { shape: 'biped', colors: ['#606878', '#c8a048', '#f84830'] },
    gacha: true,
    category: 'こうてつきょじんモンスター',
    height: 3.2,
    weight: 950.0,
    desc: 'やまの ふかくで こうせきを たべて おおきくなった。ひとたび あるきだせば だいちが ゆれ やまが かたちを かえる。',
  },

  // ─── No.072 シオネ ─────────────────────────────── SSR / みず・エスパー
  {
    id: 'shione',
    no: 72,
    name: 'シオネ',
    rarity: 'SSR',
    types: ['water', 'psychic'],
    baseStats: { hp: 84, atk: 55, def: 70, spa: 102, spd: 104, spe: 88 }, // 合計 503
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 1, move: 'thoughtwave' },   // ねんぱ
      { lv: 6, move: 'dreamlure' },     // ゆめさそい
      { lv: 11, move: 'watermembrane' }, // みずのまく
      { lv: 17, move: 'psybullet' },    // ねんどうだん
      { lv: 23, move: 'flowshot' },     // すいりゅうだん
      { lv: 29, move: 'soulheal' },     // こころのいやし
      { lv: 37, move: 'mindburst' },    // マインドバースト
      { lv: 45, move: 'torrent' },      // だいこうずい
    ],
    expGroup: 'medium_slow',
    baseExp: 200,
    image: '',
    backImage: '',
    sprite: { shape: 'fish', colors: ['#48a8d8', '#f8c8e0', '#f8f0a0'] },
    gacha: true,
    category: 'しおさいモンスター',
    height: 1.7,
    weight: 42.0,
    desc: 'つきよの うみで うたう すがたが みられる。その うたごえを きいた ものは あらそう こころを わすれる。',
  },

  // ─── No.073 ヨイヤミ ───────────────────────────── SSR / ゴースト・あく
  {
    id: 'yoiyami',
    no: 73,
    name: 'ヨイヤミ',
    rarity: 'SSR',
    types: ['ghost', 'dark'],
    baseStats: { hp: 70, atk: 88, def: 72, spa: 100, spd: 82, spe: 92 }, // 合計 504
    learnset: [
      { lv: 1, move: 'wisp' },          // ひとだま
      { lv: 1, move: 'scarystory' },    // こわいはなし
      { lv: 5, move: 'creepshadow' },   // しのびよるかげ
      { lv: 11, move: 'scheme' },       // たくらむ
      { lv: 17, move: 'lifesip' },      // いのちすい
      { lv: 23, move: 'blackorb' },     // しっこくのたま
      { lv: 30, move: 'spiritbullet' }, // れいこんだん
      { lv: 38, move: 'underworldgate' }, // よみのとびら
      { lv: 46, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'slow',
    baseExp: 205,
    image: '',
    backImage: '',
    sprite: { shape: 'ghost', colors: ['#302040', '#8858c8', '#f8d848'] },
    gacha: true,
    category: 'よいやみモンスター',
    height: 1.8,
    weight: 0.5,
    desc: 'ひが しずむと あらわれ よるの やみを つれてくる。この モンスターの かげに のまれた ものは あさまで めざめない。',
  },

  // ─── No.074 ヒョウテイ ─────────────────────────── SSR / こおり・エスパー
  {
    id: 'hyoutei',
    no: 74,
    name: 'ヒョウテイ',
    rarity: 'SSR',
    types: ['ice', 'psychic'],
    baseStats: { hp: 80, atk: 70, def: 76, spa: 108, spd: 90, spe: 92 }, // 合計 516
    learnset: [
      { lv: 1, move: 'frost' },         // しもばしら
      { lv: 1, move: 'thoughtwave' },   // ねんぱ
      { lv: 6, move: 'coldbreath' },    // つめたいいき
      { lv: 12, move: 'focusmind' },    // せいしんとういつ
      { lv: 18, move: 'psybullet' },    // ねんどうだん
      { lv: 25, move: 'freezecannon' }, // ひょうけつほう
      { lv: 32, move: 'qicannon' },     // きこうほう
      { lv: 39, move: 'mindburst' },    // マインドバースト
      { lv: 47, move: 'heavysnow' },    // ごうせつ
    ],
    expGroup: 'slow',
    baseExp: 210,
    image: '',
    backImage: '',
    sprite: { shape: 'dragon', colors: ['#a8d8f0', '#f8f8ff', '#6858c8'] },
    gacha: true,
    category: 'ひょうていモンスター',
    height: 2.6,
    weight: 180.0,
    desc: 'ひょうがの おくの こおりの しろに すむ という。ひとたび はばたけば あたり いちめんが ぎんせかいに かわる。',
  },

  // ─── No.075 カエンリュウ ───────────────────────── SSR / ほのお・ドラゴン
  {
    id: 'kaenryu',
    no: 75,
    name: 'カエンリュウ',
    rarity: 'SSR',
    types: ['fire', 'dragon'],
    baseStats: { hp: 78, atk: 96, def: 76, spa: 106, spd: 78, spe: 92 }, // 合計 526
    learnset: [
      { lv: 1, move: 'ember' },         // ひのこ
      { lv: 1, move: 'dragongrowl' },   // りゅうのうなり
      { lv: 6, move: 'flameclaw' },     // もえるツメ
      { lv: 12, move: 'dragonroar' },   // りゅうのほうこう
      { lv: 20, move: 'dragonclaw' },   // りゅうそうげき
      { lv: 27, move: 'flamebullet' },  // かえんだん
      { lv: 34, move: 'dragonwave' },   // りゅうおうは
      { lv: 42, move: 'infernoblast' }, // ごうえん
      { lv: 50, move: 'dragongod' },    // りゅうじんほう
    ],
    expGroup: 'slow',
    baseExp: 215,
    image: '',
    backImage: '',
    sprite: { shape: 'dragon', colors: ['#e04828', '#f8c040', '#502018'] },
    gacha: true,
    category: 'かえんりゅうモンスター',
    height: 2.2,
    weight: 120.0,
    desc: 'ほのおの つばさで そらを かける りゅう。はく ほのおは いわも とかし よぞらを まっかに そめる。',
  },

  // ─── No.076 ライメイオー ───────────────────────── UR / でんき・ひこう
  {
    id: 'raimeiou',
    no: 76,
    name: 'ライメイオー',
    rarity: 'UR',
    types: ['electric', 'flying'],
    baseStats: { hp: 88, atk: 92, def: 80, spa: 125, spd: 90, spe: 115 }, // 合計 590
    learnset: [
      { lv: 1, move: 'jolt' },          // でんげき
      { lv: 1, move: 'whirl' },         // つむじかぜ
      { lv: 7, move: 'shockwave' },     // しびれでんぱ
      { lv: 13, move: 'soar' },         // まいあがる
      { lv: 20, move: 'boltarrow' },    // いかずちのや
      { lv: 27, move: 'windblade' },    // かぜのやいば
      { lv: 34, move: 'focusmind' },    // せいしんとういつ
      { lv: 42, move: 'thunderroar' },  // ごうらい
      { lv: 50, move: 'bigstorm' },     // おおあらし
    ],
    expGroup: 'slow',
    baseExp: 280,
    image: '',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#f8d028', '#283870', '#f8f8f8'] },
    gacha: true,
    category: 'らいめいモンスター',
    height: 3.5,
    weight: 150.0,
    desc: 'くもの うえに すむ でんせつの モンスター。つばさを ひろげると そら いっぱいに いなずまが はしる。',
  },

  // ─── No.077 アクアロア ─────────────────────────── UR / みず・ドラゴン
  {
    id: 'aquaroa',
    no: 77,
    name: 'アクアロア',
    rarity: 'UR',
    types: ['water', 'dragon'],
    baseStats: { hp: 100, atk: 98, def: 92, spa: 120, spd: 108, spe: 82 }, // 合計 600
    learnset: [
      { lv: 1, move: 'watergun' },      // みずでっぽう
      { lv: 1, move: 'dragongrowl' },   // りゅうのうなり
      { lv: 7, move: 'watermembrane' }, // みずのまく
      { lv: 14, move: 'flowshot' },     // すいりゅうだん
      { lv: 22, move: 'dragonwave' },   // りゅうおうは
      { lv: 29, move: 'surge' },        // うちよせる
      { lv: 35, move: 'rest' },         // ひとやすみ
      { lv: 42, move: 'torrent' },      // だいこうずい
      { lv: 50, move: 'dragongod' },    // りゅうじんほう
    ],
    expGroup: 'slow',
    baseExp: 290,
    image: '',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#1848a0', '#58d8e8', '#f8d860'] },
    gacha: true,
    category: 'うみのおうモンスター',
    height: 8.0,
    weight: 500.0,
    desc: 'うみの そこで ねむる でんせつの りゅう。めざめて ほえると うみが さけ おおきな うずしおが うまれる。',
  },

  // ─── No.078 コクヨウリュウ ─────────────────────── UR / あく・はがね
  {
    id: 'kokuyouryu',
    no: 78,
    name: 'コクヨウリュウ',
    rarity: 'UR',
    types: ['dark', 'steel'],
    baseStats: { hp: 98, atk: 128, def: 110, spa: 80, spd: 84, spe: 90 }, // 合計 590
    learnset: [
      { lv: 1, move: 'chomp' },         // がぶり
      { lv: 1, move: 'steelknuckle' },  // スチールナックル
      { lv: 7, move: 'creak' },         // きしみおと
      { lv: 13, move: 'dragonroar' },   // りゅうのほうこう
      { lv: 20, move: 'darkstrike' },   // やみうち
      { lv: 27, move: 'steellariat' },  // こうてつラリアット
      { lv: 34, move: 'dragonclaw' },   // りゅうそうげき
      { lv: 42, move: 'ironhammer' },   // てっつい
      { lv: 50, move: 'abyssdrop' },    // ならくおとし
    ],
    expGroup: 'slow',
    baseExp: 285,
    image: '',
    backImage: '',
    sprite: { shape: 'dragon', colors: ['#201c28', '#8890a8', '#e83040'] },
    gacha: true,
    category: 'こくようモンスター',
    height: 4.2,
    weight: 680.0,
    desc: 'くろく かがやく こくようせきの うろこを もつ りゅう。その うろこは どんな こうげきも はじきかえす。',
  },
];
