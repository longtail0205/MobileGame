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
// ■ 入れ替え・削除するとき
//   トレーナー（trainers.js）やマップの野生（maps.js）が その id を使っていないか 確認してください。
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
    category: 'ひだねモンスター',
    height: 0.4,
    weight: 5.2,
    desc: 'たてがみの ように はえた ほのおが げんきの しるし。うれしい ときほど おおきく もえあがる。',
  },

  // ─── No.002 ミズピョン ─────────────────────────── R / みず
  {
    id: 'mizupyon',
    no: 2,
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
    category: 'みずはねモンスター',
    height: 0.6,
    weight: 8.5,
    desc: 'ながい みみから みずを ふきだして とびはねる。あめの ひは うれしくて いつまでも おどる。',
  },

  // ─── No.003 ハッパマル ─────────────────────────── SR / くさ
  {
    id: 'happamaru',
    no: 3,
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

  // ─── No.004 チュンピ ───────────────────────────── N / ノーマル・ひこう
  {
    id: 'chunpi',
    no: 4,
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
    category: 'こすずめモンスター',
    height: 0.3,
    weight: 1.8,
    desc: 'あさ いちばんに なきだす げんきな ことり。むれで あつまって にぎやかに さえずる。',
  },

  // ─── No.005 ワタモチ ───────────────────────────── N / ノーマル
  {
    id: 'watamochi',
    no: 5,
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
    category: 'わたげモンスター',
    height: 0.4,
    weight: 3.0,
    desc: 'わたの ように ふわふわで もちの ように よく のびる。だきしめると ねむくなる。',
  },

  // ─── No.006 イモムン ───────────────────────────── N / むし
  {
    id: 'imomun',
    no: 6,
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
    category: 'いもむしモンスター',
    height: 0.3,
    weight: 2.9,
    desc: 'はっぱを たべて どんどん おおきくなる。あたまの ツノから くさい においを だして みを まもる。',
  },

  // ─── No.007 ヒラリン ───────────────────────────── N / むし・ひこう
  {
    id: 'hirarin',
    no: 7,
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
    category: 'ひらひらモンスター',
    height: 0.5,
    weight: 1.2,
    desc: 'はなばたけを ひらひら とびまわる。はねの りんぷんを あびると なぜか ねむくなる。',
  },

  // ─── No.008 ピリネズ ───────────────────────────── N / でんき
  {
    id: 'pirinezu',
    no: 8,
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
    category: 'ピリピリモンスター',
    height: 0.3,
    weight: 2.4,
    desc: 'ながい しっぽを アンテナの ように たてて でんきを あつめる。さわると ピリッと しびれる。',
  },

  // ─── No.009 ツボミン ───────────────────────────── N / くさ
  {
    id: 'tsubomin',
    no: 9,
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
    category: 'つぼみモンスター',
    height: 0.3,
    weight: 2.0,
    desc: 'あたまの つぼみは まだ ひらかない。ひなたで ひるねを すると すこしずつ ふくらんでいく。',
  },

  // ─── No.010 カサボウ ───────────────────────────── R / くさ・どく
  {
    id: 'kasabou',
    no: 10,
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
    category: 'きのこモンスター',
    height: 0.5,
    weight: 6.0,
    desc: 'かさの もようが こいほど どくが つよい。もりの おくで ほうしを まいて なかまを ふやす。',
  },

  // ─── No.011 メダッカ ───────────────────────────── N / みず
  {
    id: 'medakka',
    no: 11,
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
    category: 'こざかなモンスター',
    height: 0.2,
    weight: 0.6,
    desc: 'むれで くらす ちいさな さかな。きけんを かんじると いっせいに ちって すばやく にげる。',
  },

  // ─── No.012 ビリウナギ ─────────────────────────── R / でんき・みず
  {
    id: 'biriunagi',
    no: 12,
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
    category: 'ほうでんモンスター',
    height: 1.2,
    weight: 9.0,
    desc: 'くらい かわの そこに すむ。からだの もようを ひからせて えものを しびれさせる。',
  },

  // ─── No.013 ドクナメ ───────────────────────────── N / どく
  {
    id: 'dokuname',
    no: 13,
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
    category: 'どくなめくじモンスター',
    height: 0.4,
    weight: 4.5,
    desc: 'とおった あとには ぬるぬるの どくえきが のこる。しめった ばしょが だいすき。',
  },

  // ─── No.014 ハリバチ ───────────────────────────── R / どく・むし
  {
    id: 'haribachi',
    no: 14,
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

  // ─── No.015 ドロッチ ───────────────────────────── N / じめん
  {
    id: 'dorocchi',
    no: 15,
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
    category: 'どろんこモンスター',
    height: 0.5,
    weight: 14.0,
    desc: 'どろの なかで ころがるのが だいすき。からだが かわくと ひびわれて うごけなくなる。',
  },

  // ─── No.016 ヨロイダマ ─────────────────────────── R / じめん
  {
    id: 'yoroidama',
    no: 16,
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
    category: 'よろいだまモンスター',
    height: 0.8,
    weight: 32.0,
    desc: 'かたい こうらで おおわれている。おどろくと まるくなって さかみちを ころがって にげる。',
  },

  // ─── No.017 コイシン ───────────────────────────── N / いわ
  {
    id: 'koishin',
    no: 17,
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
    category: 'こいしモンスター',
    height: 0.3,
    weight: 20.0,
    desc: 'かわらの いしに まぎれて ねている。ふまれても へいきな かおで ねむりつづける。',
  },

  // ─── No.018 カマドン ───────────────────────────── R / ほのお・いわ
  {
    id: 'kamadon',
    no: 18,
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

  // ─── No.019 コブシン ───────────────────────────── N / かくとう
  {
    id: 'kobushin',
    no: 19,
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
    category: 'こぶしモンスター',
    height: 0.6,
    weight: 18.0,
    desc: 'まいにち いわを なぐって こぶしを きたえている。つよい あいてを みると むねが おどる。',
  },

  // ─── No.020 カマキリン ─────────────────────────── R / むし・かくとう
  {
    id: 'kamakirin',
    no: 20,
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
    category: 'かまけんぽうモンスター',
    height: 0.9,
    weight: 11.0,
    desc: 'りょううでの カマで かまえを とる。くさむらで じっと まち とおりかかった あいてに しょうぶを いどむ。',
  },

  // ─── No.021 カゲネコ ───────────────────────────── N / あく
  {
    id: 'kageneko',
    no: 21,
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
    category: 'かげねこモンスター',
    height: 0.4,
    weight: 4.0,
    desc: 'よるに なると かげから かげへ おとも なく わたりあるく。きんいろの めだけが やみに うかぶ。',
  },

  // ─── No.022 シノビン ───────────────────────────── R / あく
  {
    id: 'shinobin',
    no: 22,
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
    category: 'しのびモンスター',
    height: 1.0,
    weight: 26.0,
    desc: 'すなけむりに まぎれて すがたを けす。だれにも みられずに しごとを やりとげるのが ほこり。',
  },

  // ─── No.023 ユラリ ─────────────────────────────── N / ゴースト
  {
    id: 'yurari',
    no: 23,
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
    category: 'ゆらゆらモンスター',
    height: 0.5,
    weight: 0.1,
    desc: 'ゆうぐれに なると どこからともなく あらわれ ゆらゆら ただよう。さわろうと すると すりぬける。',
  },

  // ─── No.024 カラカサン ─────────────────────────── R / ゴースト・ひこう
  {
    id: 'karakasan',
    no: 24,
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

  // ─── No.025 カゼキリ ───────────────────────────── R / ひこう
  {
    id: 'kazekiri',
    no: 25,
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
    category: 'はやかぜモンスター',
    height: 0.8,
    weight: 7.5,
    desc: 'かぜを きりさく はやさで そらを とぶ。つばさの さきは はものの ように するどい。',
  },

  // ─── No.026 ミトオシ ───────────────────────────── R / エスパー・ひこう
  {
    id: 'mitooshi',
    no: 26,
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

  // ─── No.027 ブリキン ───────────────────────────── N / はがね
  {
    id: 'burikin',
    no: 27,
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
    category: 'ブリキモンスター',
    height: 0.5,
    weight: 12.0,
    desc: 'せなかの ねじを まくと げんきに うごきだす。ねじが ゆるむと その ばで ねむってしまう。',
  },

  // ─── No.028 ハガネムシ ─────────────────────────── R / はがね・むし
  {
    id: 'haganemushi',
    no: 28,
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
    category: 'こうちゅうモンスター',
    height: 0.7,
    weight: 40.0,
    desc: 'はがねの ように かたい はねを もつ むし。ツノで たいぼくを もちあげる ちからもちだ。',
  },

  // ─── No.029 ユキチドリ ─────────────────────────── N / こおり・ひこう
  {
    id: 'yukichidori',
    no: 29,
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
    category: 'ゆきどりモンスター',
    height: 0.3,
    weight: 1.5,
    desc: 'ゆきの ふる ひにだけ すがたを みせる ことり。はばたくと こまかい こおりの つぶが きらきら まう。',
  },

  // ─── No.030 ユキガスミ ─────────────────────────── R / こおり・ゴースト
  {
    id: 'yukigasumi',
    no: 30,
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

  // ─── No.031 ホシヨミ ───────────────────────────── SR / エスパー
  {
    id: 'hoshiyomi',
    no: 31,
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

  // ─── No.032 キツネビ ───────────────────────────── SR / ゴースト・ほのお
  {
    id: 'kitsunebi',
    no: 32,
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

  // ─── No.033 ライガロウ ─────────────────────────── SR / でんき・あく
  {
    id: 'raigarou',
    no: 33,
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

  // ─── No.034 ドクジャ ───────────────────────────── SR / どく・あく
  {
    id: 'dokuja',
    no: 34,
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

  // ─── No.035 スナクジラ ─────────────────────────── SR / じめん
  {
    id: 'sunakujira',
    no: 35,
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

  // ─── No.036 イワバサ ───────────────────────────── SR / いわ・ひこう
  {
    id: 'iwabasa',
    no: 36,
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

  // ─── No.037 ハガネブシ ─────────────────────────── SR / はがね・かくとう
  {
    id: 'haganebushi',
    no: 37,
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

  // ─── No.038 イッカクジラ ───────────────────────── SR / こおり・みず
  {
    id: 'ikkakujira',
    no: 38,
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

  // ─── No.039 タツマル ───────────────────────────── SR / ドラゴン
  {
    id: 'tatsumaru',
    no: 39,
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

  // ─── No.040 モリノヌシ ─────────────────────────── SSR / くさ・じめん
  {
    id: 'morinonushi',
    no: 40,
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

  // ─── No.041 ゴウテツ ───────────────────────────── SSR / はがね・じめん
  {
    id: 'goutetsu',
    no: 41,
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

  // ─── No.042 シオネ ─────────────────────────────── SSR / みず・エスパー
  {
    id: 'shione',
    no: 42,
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

  // ─── No.043 ヨイヤミ ───────────────────────────── SSR / ゴースト・あく
  {
    id: 'yoiyami',
    no: 43,
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

  // ─── No.044 ヒョウテイ ─────────────────────────── SSR / こおり・エスパー
  {
    id: 'hyoutei',
    no: 44,
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

  // ─── No.045 カエンリュウ ───────────────────────── SSR / ほのお・ドラゴン
  {
    id: 'kaenryu',
    no: 45,
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

  // ─── No.046 ヨシモト ───────────────────────── UR / でんき・ひこう
  {
    id: 'raimeiou',
    no: 46,
    name: 'ヨシモト',
    rarity: 'UR',
    types: ['grass', 'flying'],
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
    image: 'assets/monsters/ヨシモト.png',
    backImage: '',
    sprite: { shape: 'bird', colors: ['#f8d028', '#283870', '#f8f8f8'] },
    gacha: true,
    category: 'らいめいモンスター',
    height: 3.5,
    weight: 150.0,
    desc: 'くもの うえに すむ でんせつの モンスター。つばさを ひろげると そら いっぱいに いなずまが はしる。',
  },

  // ─── No.047 アクアロア ─────────────────────────── UR / みず・ドラゴン
  {
    id: 'aquaroa',
    no: 47,
    name: 'ノブナガ',
    rarity: 'UR',
    types: ['fire', 'dark'],
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
    image: 'assets/monsters/ノブナガ.png',
    backImage: '',
    sprite: { shape: 'serpent', colors: ['#1848a0', '#58d8e8', '#f8d860'] },
    gacha: true,
    category: 'うみのおうモンスター',
    height: 8.0,
    weight: 500.0,
    desc: 'うみの そこで ねむる でんせつの りゅう。めざめて ほえると うみが さけ おおきな うずしおが うまれる。',
  },

  // ─── No.048 コクヨウリュウ ─────────────────────── UR / あく・はがね
  {
    id: 'kokuyouryu',
    no: 48,
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
