// =====================================================================
// わざ（技）の定義
// ---------------------------------------------------------------------
// ■ このファイルの編集方法
//
//   GameData.moves = { わざID: { ...設定... }, ... }
//   わざID は 英小文字・数字・_ だけで付けてください（monsters.js の learnset から参照します）。
//
//   name      : 表示名
//   type      : タイプID（types.js のキー。例 'fire'）
//   category  : 'physical'（ぶつり: こうげき/ぼうぎょ で計算）
//               'special' （とくしゅ: とくこう/とくぼう で計算）
//               'status'  （へんか: ダメージなし。power は 0）
//   power     : いりょく（へんかわざは 0）
//   accuracy  : めいちゅう（1〜100 の %）。0 にすると かならず あたる
//   pp        : つかえる回数
//   priority  : （省略可）ゆうせんど。1 以上だと すばやさに関係なく先に動ける。-1 以下で後攻
//   critStage : （省略可）1 で きゅうしょに あたりやすい（2, 3 でさらに上がる）
//   effects   : （省略可）追加効果の配列。複数書けます
//   desc      : 説明文（ひらがな多め・文節ごとにスペース）
//
// ■ effects に書けるもの
//   { kind: 'stat', target: 'foe', stat: 'atk', stages: -1 }             相手の こうげき を 1段階さげる
//   { kind: 'stat', target: 'self', stat: 'spe', stages: 2 }             自分の すばやさ を 2段階あげる
//   { kind: 'stat', target: 'foe', stat: 'def', stages: -1, chance: 20 } 20% の確率で 相手の ぼうぎょ をさげる
//       stat: 'atk' こうげき / 'def' ぼうぎょ / 'spa' とくこう / 'spd' とくぼう / 'spe' すばやさ
//             'acc' めいちゅう / 'eva' かいひ     stages: -3〜+3（0以外）
//   { kind: 'status', status: 'burn', chance: 10 }   10% で やけど（chance を省略すると 100%）
//       status: 'poison' どく / 'burn' やけど / 'paralyze' まひ / 'sleep' ねむり / 'freeze' こおり
//   { kind: 'heal', ratio: 0.5 }       自分の最大HPの 50% を回復
//   { kind: 'drain', ratio: 0.5 }      あたえたダメージの 50% を回復
//   { kind: 'recoil', ratio: 0.33 }    あたえたダメージの 33% を 自分もうける（はんどう）
//   { kind: 'flinch', chance: 30 }     30% で 相手を ひるませる（先に動いたときだけ）
//   { kind: 'multihit', min: 2, max: 5 }  2〜5回 連続で攻撃
//
// ■ 追加の例（コピーして書き換えてください）
//   kaminari_kick: {
//     name: 'かみなりキック', type: 'electric', category: 'physical',
//     power: 85, accuracy: 95, pp: 10,
//     effects: [{ kind: 'status', status: 'paralyze', chance: 20 }],
//     desc: 'でんきを まとった けりで こうげき。まひさせる ことがある。',
//   },
//   追加したら monsters.js の learnset に { lv: 30, move: 'kaminari_kick' } のように書くと覚えます。
//
// ■ いりょくの目安: 序盤 35〜50 / 中盤 60〜80 / 終盤 90〜120
// =====================================================================
window.GameData = window.GameData || {};

GameData.moves = {
  // -------------------------------------------------------------------
  // ノーマル
  // -------------------------------------------------------------------
  tackle: {
    name: 'たいあたり', type: 'normal', category: 'physical',
    power: 40, accuracy: 100, pp: 35,
    desc: 'からだごと あいてに ぶつかって こうげきする。',
  },
  scratch: {
    name: 'ひっかく', type: 'normal', category: 'physical',
    power: 35, accuracy: 100, pp: 35,
    critStage: 1,
    desc: 'するどい ツメで ひっかく。きゅうしょに あたりやすい。',
  },
  growl: {
    name: 'なきごえ', type: 'normal', category: 'status',
    power: 0, accuracy: 100, pp: 40,
    effects: [{ kind: 'stat', target: 'foe', stat: 'atk', stages: -1 }],
    desc: 'かわいい なきごえで あいての こうげきを さげる。',
  },
  glare: {
    name: 'にらむ', type: 'normal', category: 'status',
    power: 0, accuracy: 100, pp: 30,
    effects: [{ kind: 'stat', target: 'foe', stat: 'def', stages: -1 }],
    desc: 'するどい めつきで にらみ あいての ぼうぎょを さげる。',
  },
  quickhit: {
    name: 'はやわざ', type: 'normal', category: 'physical',
    power: 40, accuracy: 100, pp: 30,
    priority: 1,
    desc: 'めにも とまらぬ はやさで こうげき。かならず せんせいできる。',
  },
  crush: {
    name: 'おしつぶす', type: 'normal', category: 'physical',
    power: 80, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'paralyze', chance: 30 }],
    desc: 'からだの おもさで おしつぶす。まひさせる ことがある。',
  },
  bigvoice: {
    name: 'おおごえ', type: 'normal', category: 'special',
    power: 90, accuracy: 100, pp: 10,
    desc: 'ものすごい おおごえを ぶつけて こうげきする。',
  },
  allout: {
    name: 'ぜんりょくタックル', type: 'normal', category: 'physical',
    power: 120, accuracy: 100, pp: 15,
    effects: [{ kind: 'recoil', ratio: 0.33 }],
    desc: 'いのちがけで ぶつかる。じぶんも おおきな ダメージを うける。',
  },
  rest: {
    name: 'ひとやすみ', type: 'normal', category: 'status',
    power: 0, accuracy: 0, pp: 10,
    effects: [{ kind: 'heal', ratio: 0.5 }],
    desc: 'ひとやすみ して さいだいHPの はんぶんを かいふくする。',
  },
  powerup: {
    name: 'りきむ', type: 'normal', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [{ kind: 'stat', target: 'self', stat: 'atk', stages: 2 }],
    desc: 'ぐっと ちからを こめて こうげきを ぐーんと あげる。',
  },

  // -------------------------------------------------------------------
  // ほのお
  // -------------------------------------------------------------------
  ember: {
    name: 'ひのこ', type: 'fire', category: 'special',
    power: 40, accuracy: 100, pp: 25,
    effects: [{ kind: 'status', status: 'burn', chance: 10 }],
    desc: 'ちいさな ほのおを とばす。やけどに させる ことがある。',
  },
  flameclaw: {
    name: 'もえるツメ', type: 'fire', category: 'physical',
    power: 50, accuracy: 100, pp: 25,
    effects: [{ kind: 'status', status: 'burn', chance: 10 }],
    desc: 'ほのおを まとった ツメで ひっかく。やけどに させる ことがある。',
  },
  scorchpunch: {
    name: 'しゃくねつパンチ', type: 'fire', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'burn', chance: 10 }],
    desc: 'まっかに もえる こぶしで なぐる。やけどに させる ことがある。',
  },
  flamebullet: {
    name: 'かえんだん', type: 'fire', category: 'special',
    power: 80, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'burn', chance: 10 }],
    desc: 'ほのおの かたまりを うちだす。やけどに させる ことがある。',
  },
  infernoblast: {
    name: 'ごうえん', type: 'fire', category: 'special',
    power: 110, accuracy: 85, pp: 5,
    effects: [{ kind: 'status', status: 'burn', chance: 30 }],
    desc: 'すべてを やきつくす ほのおで こうげき。やけどに させやすい。',
  },
  flarecharge: {
    name: 'ほのおのとっしん', type: 'fire', category: 'physical',
    power: 120, accuracy: 100, pp: 15,
    effects: [{ kind: 'recoil', ratio: 0.33 }, { kind: 'status', status: 'burn', chance: 10 }],
    desc: 'ほのおを まとって とっしんする。じぶんも ダメージを うける。',
  },
  hotbreath: {
    name: 'あついいき', type: 'fire', category: 'status',
    power: 0, accuracy: 85, pp: 15,
    effects: [{ kind: 'status', status: 'burn' }],
    desc: 'あつい いきを ふきかけて あいてを やけどに させる。',
  },

  // -------------------------------------------------------------------
  // みず
  // -------------------------------------------------------------------
  watergun: {
    name: 'みずでっぽう', type: 'water', category: 'special',
    power: 40, accuracy: 100, pp: 25,
    desc: 'みずを いきおいよく ふきつけて こうげきする。',
  },
  waterskip: {
    name: 'みずきり', type: 'water', category: 'physical',
    power: 40, accuracy: 100, pp: 20,
    priority: 1,
    desc: 'みずを きるように すばやく ぶつかる。かならず せんせいできる。',
  },
  flowshot: {
    name: 'すいりゅうだん', type: 'water', category: 'special',
    power: 70, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'acc', stages: -1, chance: 20 }],
    desc: 'うずまく みずの たまを うつ。めいちゅうりつを さげる ことがある。',
  },
  surge: {
    name: 'うちよせる', type: 'water', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'flinch', chance: 20 }],
    desc: 'おおなみの ように おしよせて ぶつかる。ひるませる ことがある。',
  },
  torrent: {
    name: 'だいこうずい', type: 'water', category: 'special',
    power: 110, accuracy: 80, pp: 5,
    desc: 'あたり いちめんを のみこむ ほどの みずで こうげきする。',
  },
  watermembrane: {
    name: 'みずのまく', type: 'water', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [{ kind: 'stat', target: 'self', stat: 'spd', stages: 2 }],
    desc: 'みずの まくで からだを つつみ とくぼうを ぐーんと あげる。',
  },

  // -------------------------------------------------------------------
  // くさ
  // -------------------------------------------------------------------
  leafcut: {
    name: 'はっぱぎり', type: 'grass', category: 'physical',
    power: 45, accuracy: 95, pp: 25,
    critStage: 1,
    desc: 'するどい はっぱで きりつける。きゅうしょに あたりやすい。',
  },
  sip: {
    name: 'すいあげ', type: 'grass', category: 'special',
    power: 40, accuracy: 100, pp: 20,
    effects: [{ kind: 'drain', ratio: 0.5 }],
    desc: 'あいての えいようを すいあげ あたえた ダメージの はんぶん かいふくする。',
  },
  sleepscent: {
    name: 'ねむりのかおり', type: 'grass', category: 'status',
    power: 0, accuracy: 75, pp: 15,
    effects: [{ kind: 'status', status: 'sleep' }],
    desc: 'あまい かおりを ただよわせて あいてを ねむらせる。',
  },
  thornlash: {
    name: 'いばらうち', type: 'grass', category: 'physical',
    power: 70, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'def', stages: -1, chance: 20 }],
    desc: 'とげだらけの つるで うちつける。ぼうぎょを さげる ことがある。',
  },
  forestbreath: {
    name: 'もりのいぶき', type: 'grass', category: 'special',
    power: 65, accuracy: 100, pp: 10,
    effects: [{ kind: 'drain', ratio: 0.5 }],
    desc: 'もりの ちからで たいりょくを うばい はんぶんを かいふくする。',
  },
  sunbeam: {
    name: 'ひだまりほう', type: 'grass', category: 'special',
    power: 100, accuracy: 95, pp: 10,
    desc: 'からだに あつめた ひかりを いっきに はなつ。',
  },
  treefall: {
    name: 'たいぼくおとし', type: 'grass', category: 'physical',
    power: 110, accuracy: 90, pp: 10,
    desc: 'たいぼくの ように おもい いちげきを たたきつける。',
  },

  // -------------------------------------------------------------------
  // でんき
  // -------------------------------------------------------------------
  jolt: {
    name: 'でんげき', type: 'electric', category: 'special',
    power: 40, accuracy: 100, pp: 30,
    effects: [{ kind: 'status', status: 'paralyze', chance: 10 }],
    desc: 'でんきを あびせて こうげきする。まひさせる ことがある。',
  },
  elekick: {
    name: 'エレキック', type: 'electric', category: 'physical',
    power: 50, accuracy: 100, pp: 25,
    effects: [{ kind: 'status', status: 'paralyze', chance: 10 }],
    desc: 'でんきを おびた けりで こうげき。まひさせる ことがある。',
  },
  shockwave: {
    name: 'しびれでんぱ', type: 'electric', category: 'status',
    power: 0, accuracy: 90, pp: 20,
    effects: [{ kind: 'status', status: 'paralyze' }],
    desc: 'しびれる でんぱを とばして あいてを まひさせる。',
  },
  boltarrow: {
    name: 'いかずちのや', type: 'electric', category: 'special',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'paralyze', chance: 10 }],
    desc: 'いなずまの やを はなつ。まひさせる ことがある。',
  },
  sparkrush: {
    name: 'スパークラッシュ', type: 'electric', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'paralyze', chance: 10 }],
    desc: 'ひばなを ちらしながら とつげきする。まひさせる ことがある。',
  },
  thunderroar: {
    name: 'ごうらい', type: 'electric', category: 'special',
    power: 110, accuracy: 75, pp: 10,
    effects: [{ kind: 'status', status: 'paralyze', chance: 30 }],
    desc: 'てんを さく かみなりを おとす。まひさせやすいが はずれやすい。',
  },

  // -------------------------------------------------------------------
  // こおり
  // -------------------------------------------------------------------
  frost: {
    name: 'しもばしら', type: 'ice', category: 'special',
    power: 40, accuracy: 100, pp: 25,
    effects: [{ kind: 'status', status: 'freeze', chance: 10 }],
    desc: 'つめたい しもを たてて こうげき。こおらせる ことがある。',
  },
  iciclevolley: {
    name: 'つららうち', type: 'ice', category: 'physical',
    power: 25, accuracy: 100, pp: 30,
    effects: [{ kind: 'multihit', min: 2, max: 5 }],
    desc: 'つららを 2〜5かい れんぞくで うちだす。',
  },
  coldbreath: {
    name: 'つめたいいき', type: 'ice', category: 'special',
    power: 55, accuracy: 95, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spe', stages: -1 }],
    desc: 'こごえる いきを ふきかけ あいての すばやさを さげる。',
  },
  icebergcrash: {
    name: 'ひょうざんクラッシュ', type: 'ice', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'freeze', chance: 10 }],
    desc: 'ひょうざんの ように かたい からだで ぶつかる。こおらせる ことがある。',
  },
  freezecannon: {
    name: 'ひょうけつほう', type: 'ice', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    effects: [{ kind: 'status', status: 'freeze', chance: 10 }],
    desc: 'すべてを こおらせる れいきを うちだす。こおらせる ことがある。',
  },
  heavysnow: {
    name: 'ごうせつ', type: 'ice', category: 'special',
    power: 110, accuracy: 80, pp: 5,
    effects: [{ kind: 'status', status: 'freeze', chance: 20 }],
    desc: 'はげしい ゆきを ふらせて こうげき。こおらせる ことがある。',
  },

  // -------------------------------------------------------------------
  // かくとう
  // -------------------------------------------------------------------
  jab: {
    name: 'ジャブ', type: 'fighting', category: 'physical',
    power: 40, accuracy: 100, pp: 30,
    priority: 1,
    desc: 'すばやい ジャブで こうげき。かならず せんせいできる。',
  },
  straightpunch: {
    name: 'せいけんづき', type: 'fighting', category: 'physical',
    power: 50, accuracy: 100, pp: 25,
    desc: 'こしを いれた まっすぐな つきで こうげきする。',
  },
  axekick: {
    name: 'かかとおとし', type: 'fighting', category: 'physical',
    power: 75, accuracy: 90, pp: 10,
    effects: [{ kind: 'flinch', chance: 20 }],
    desc: 'たかく あげた かかとを ふりおろす。ひるませる ことがある。',
  },
  furiousrush: {
    name: 'もうれつラッシュ', type: 'fighting', category: 'physical',
    power: 120, accuracy: 100, pp: 5,
    effects: [
      { kind: 'stat', target: 'self', stat: 'def', stages: -1 },
      { kind: 'stat', target: 'self', stat: 'spd', stages: -1 },
    ],
    desc: 'もうれつな れんぞく こうげき。じぶんの ぼうぎょと とくぼうが さがる。',
  },
  qicannon: {
    name: 'きこうほう', type: 'fighting', category: 'special',
    power: 110, accuracy: 80, pp: 5,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 10 }],
    desc: 'ためた きを いっきに はなつ。とくぼうを さげる ことがある。',
  },
  train: {
    name: 'きたえる', type: 'fighting', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [
      { kind: 'stat', target: 'self', stat: 'atk', stages: 1 },
      { kind: 'stat', target: 'self', stat: 'def', stages: 1 },
    ],
    desc: 'からだを きたえて こうげきと ぼうぎょを あげる。',
  },

  // -------------------------------------------------------------------
  // どく
  // -------------------------------------------------------------------
  poisonthorn: {
    name: 'どくのトゲ', type: 'poison', category: 'physical',
    power: 40, accuracy: 100, pp: 35,
    effects: [{ kind: 'status', status: 'poison', chance: 30 }],
    desc: 'どくの ある トゲで さす。どくに させる ことがある。',
  },
  poisonspray: {
    name: 'どくしぶき', type: 'poison', category: 'special',
    power: 45, accuracy: 100, pp: 30,
    effects: [{ kind: 'status', status: 'poison', chance: 20 }],
    desc: 'どくえきを ふきかける。どくに させる ことがある。',
  },
  toxicmist: {
    name: 'どくのきり', type: 'poison', category: 'status',
    power: 0, accuracy: 90, pp: 20,
    effects: [{ kind: 'status', status: 'poison' }],
    desc: 'どくの きりで あいてを つつみ どくに させる。',
  },
  poisonblade: {
    name: 'どくのやいば', type: 'poison', category: 'physical',
    power: 70, accuracy: 100, pp: 15,
    effects: [{ kind: 'status', status: 'poison', chance: 30 }],
    desc: 'どくを ぬった やいばで きりつける。どくに させる ことがある。',
  },
  poisonvortex: {
    name: 'どくのうず', type: 'poison', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    effects: [{ kind: 'status', status: 'poison', chance: 30 }],
    desc: 'どくの うずに まきこむ。どくに させる ことがある。',
  },
  venomburst: {
    name: 'ベノムバースト', type: 'poison', category: 'special',
    power: 100, accuracy: 90, pp: 5,
    effects: [{ kind: 'status', status: 'poison', chance: 30 }],
    desc: 'もうどくを ばくはつさせる。どくに させる ことがある。',
  },

  // -------------------------------------------------------------------
  // じめん
  // -------------------------------------------------------------------
  sandcloud: {
    name: 'すなけむり', type: 'ground', category: 'status',
    power: 0, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'acc', stages: -1 }],
    desc: 'すなけむりを まきあげて あいての めいちゅうりつを さげる。',
  },
  stomp: {
    name: 'ふみならし', type: 'ground', category: 'physical',
    power: 45, accuracy: 100, pp: 20,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 30 }],
    desc: 'じめんを ふみならして こうげき。すばやさを さげる ことがある。',
  },
  earthsplit: {
    name: 'だいちわり', type: 'ground', category: 'physical',
    power: 80, accuracy: 100, pp: 10,
    desc: 'だいちを たたきわる いちげきで こうげきする。',
  },
  sandcannon: {
    name: 'さじんほう', type: 'ground', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 10 }],
    desc: 'すなの たいほうを うちだす。とくぼうを さげる ことがある。',
  },
  crustquake: {
    name: 'ちかくへんどう', type: 'ground', category: 'physical',
    power: 110, accuracy: 90, pp: 10,
    desc: 'だいちを ゆるがす ちからで あいてを おそう。',
  },

  // -------------------------------------------------------------------
  // ひこう
  // -------------------------------------------------------------------
  peck: {
    name: 'つつく', type: 'flying', category: 'physical',
    power: 35, accuracy: 100, pp: 35,
    desc: 'するどい くちばしで つついて こうげきする。',
  },
  whirl: {
    name: 'つむじかぜ', type: 'flying', category: 'special',
    power: 40, accuracy: 100, pp: 35,
    desc: 'ちいさな つむじかぜを おこして こうげきする。',
  },
  soar: {
    name: 'まいあがる', type: 'flying', category: 'status',
    power: 0, accuracy: 0, pp: 30,
    effects: [{ kind: 'stat', target: 'self', stat: 'spe', stages: 2 }],
    desc: 'そらたかく まいあがり すばやさを ぐーんと あげる。',
  },
  nosedive: {
    name: 'きゅうこうか', type: 'flying', category: 'physical',
    power: 75, accuracy: 95, pp: 15,
    critStage: 1,
    desc: 'そらから いっきに きゅうこうかする。きゅうしょに あたりやすい。',
  },
  windblade: {
    name: 'かぜのやいば', type: 'flying', category: 'special',
    power: 75, accuracy: 95, pp: 15,
    effects: [{ kind: 'flinch', chance: 30 }],
    desc: 'かぜの やいばで きりさく。ひるませる ことがある。',
  },
  skycharge: {
    name: 'てんくうとっしん', type: 'flying', category: 'physical',
    power: 120, accuracy: 100, pp: 15,
    effects: [{ kind: 'recoil', ratio: 0.33 }],
    desc: 'そらの たかみから とっしんする。じぶんも ダメージを うける。',
  },
  bigstorm: {
    name: 'おおあらし', type: 'flying', category: 'special',
    power: 110, accuracy: 80, pp: 10,
    desc: 'はげしい あらしを まきおこして こうげきする。',
  },

  // -------------------------------------------------------------------
  // エスパー
  // -------------------------------------------------------------------
  thoughtwave: {
    name: 'ねんぱ', type: 'psychic', category: 'special',
    power: 40, accuracy: 100, pp: 25,
    desc: 'ふしぎな ねんぱを おくって こうげきする。',
  },
  dreamlure: {
    name: 'ゆめさそい', type: 'psychic', category: 'status',
    power: 0, accuracy: 70, pp: 15,
    effects: [{ kind: 'status', status: 'sleep' }],
    desc: 'ふしぎな ちからで あいてを ゆめの せかいへ さそう。',
  },
  focusmind: {
    name: 'せいしんとういつ', type: 'psychic', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [
      { kind: 'stat', target: 'self', stat: 'spa', stages: 1 },
      { kind: 'stat', target: 'self', stat: 'spd', stages: 1 },
    ],
    desc: 'こころを しずめて とくこうと とくぼうを あげる。',
  },
  psybullet: {
    name: 'ねんどうだん', type: 'psychic', category: 'special',
    power: 75, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 10 }],
    desc: 'ねんりょくの たまを ぶつける。とくぼうを さげる ことがある。',
  },
  mindburst: {
    name: 'マインドバースト', type: 'psychic', category: 'special',
    power: 100, accuracy: 100, pp: 10,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 10 }],
    desc: 'つよい ねんりょくを ばくはつさせる。とくぼうを さげる ことがある。',
  },
  soulheal: {
    name: 'こころのいやし', type: 'psychic', category: 'status',
    power: 0, accuracy: 0, pp: 10,
    effects: [{ kind: 'heal', ratio: 0.5 }],
    desc: 'こころを いやして さいだいHPの はんぶんを かいふくする。',
  },

  // -------------------------------------------------------------------
  // むし
  // -------------------------------------------------------------------
  gnaw: {
    name: 'かじる', type: 'bug', category: 'physical',
    power: 40, accuracy: 100, pp: 30,
    effects: [{ kind: 'flinch', chance: 10 }],
    desc: 'ちいさな あごで かじりつく。ひるませる ことがある。',
  },
  spiderthread: {
    name: 'くものいと', type: 'bug', category: 'status',
    power: 0, accuracy: 95, pp: 40,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spe', stages: -2 }],
    desc: 'ねばねばの いとを からめて すばやさを がくっと さげる。',
  },
  needlerain: {
    name: 'はりのあめ', type: 'bug', category: 'physical',
    power: 20, accuracy: 95, pp: 20,
    effects: [{ kind: 'multihit', min: 2, max: 5 }],
    desc: 'ほそい はりを 2〜5かい れんぞくで とばす。',
  },
  scalestorm: {
    name: 'りんぷんあらし', type: 'bug', category: 'special',
    power: 70, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spa', stages: -1, chance: 20 }],
    desc: 'りんぷんを まきちらして こうげき。とくこうを さげる ことがある。',
  },
  mantisfist: {
    name: 'とうろうけん', type: 'bug', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    critStage: 1,
    desc: 'カマを かまえる ような けんぽうで きりつける。きゅうしょに あたりやすい。',
  },
  hornupper: {
    name: 'ツノつきあげ', type: 'bug', category: 'physical',
    power: 110, accuracy: 85, pp: 10,
    desc: 'りっぱな ツノで おもいきり つきあげる。',
  },

  // -------------------------------------------------------------------
  // いわ
  // -------------------------------------------------------------------
  pebbles: {
    name: 'いしなげ', type: 'rock', category: 'physical',
    power: 50, accuracy: 90, pp: 15,
    desc: 'てごろな いしを いきおいよく なげつける。',
  },
  landslide: {
    name: 'がけくずし', type: 'rock', category: 'physical',
    power: 75, accuracy: 90, pp: 10,
    effects: [{ kind: 'flinch', chance: 30 }],
    desc: 'くずれた いわを おとして こうげき。ひるませる ことがある。',
  },
  gembeam: {
    name: 'ほうせきビーム', type: 'rock', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    desc: 'ほうせきの ように かがやく ひかりを はなつ。',
  },
  rockarmor: {
    name: 'いわのよろい', type: 'rock', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [
      { kind: 'stat', target: 'self', stat: 'def', stages: 1 },
      { kind: 'stat', target: 'self', stat: 'spd', stages: 1 },
    ],
    desc: 'いわの よろいを まとい ぼうぎょと とくぼうを あげる。',
  },
  boulderdrop: {
    name: 'きょがんおとし', type: 'rock', category: 'physical',
    power: 110, accuracy: 85, pp: 5,
    desc: 'きょだいな いわを あいての うえに おとす。',
  },
  meteorfall: {
    name: 'いんせきおとし', type: 'rock', category: 'special',
    power: 100, accuracy: 90, pp: 5,
    desc: 'そらから いんせきを よびよせて こうげきする。',
  },

  // -------------------------------------------------------------------
  // ゴースト
  // -------------------------------------------------------------------
  wisp: {
    name: 'ひとだま', type: 'ghost', category: 'special',
    power: 40, accuracy: 100, pp: 25,
    effects: [{ kind: 'status', status: 'burn', chance: 10 }],
    desc: 'あやしく もえる ひとだまを ぶつける。やけどに させる ことがある。',
  },
  creepshadow: {
    name: 'しのびよるかげ', type: 'ghost', category: 'physical',
    power: 40, accuracy: 100, pp: 30,
    priority: 1,
    desc: 'かげから しのびよって こうげき。かならず せんせいできる。',
  },
  scarystory: {
    name: 'こわいはなし', type: 'ghost', category: 'status',
    power: 0, accuracy: 100, pp: 20,
    effects: [
      { kind: 'stat', target: 'foe', stat: 'atk', stages: -1 },
      { kind: 'stat', target: 'foe', stat: 'spa', stages: -1 },
    ],
    desc: 'こわい はなしを きかせて こうげきと とくこうを さげる。',
  },
  spiritbullet: {
    name: 'れいこんだん', type: 'ghost', category: 'special',
    power: 80, accuracy: 100, pp: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 20 }],
    desc: 'たましいの たまを ぶつける。とくぼうを さげる ことがある。',
  },
  ghostclaw: {
    name: 'ゆうれいのツメ', type: 'ghost', category: 'physical',
    power: 70, accuracy: 100, pp: 15,
    critStage: 1,
    desc: 'すきとおった ツメで きりさく。きゅうしょに あたりやすい。',
  },
  underworldgate: {
    name: 'よみのとびら', type: 'ghost', category: 'special',
    power: 110, accuracy: 85, pp: 5,
    desc: 'よみの とびらを ひらき あいてを のみこむ。',
  },
  lifesip: {
    name: 'いのちすい', type: 'ghost', category: 'special',
    power: 60, accuracy: 100, pp: 15,
    effects: [{ kind: 'drain', ratio: 0.5 }],
    desc: 'あいての いのちを すいとり あたえた ダメージの はんぶん かいふくする。',
  },

  // -------------------------------------------------------------------
  // ドラゴン
  // -------------------------------------------------------------------
  dragongrowl: {
    name: 'りゅうのうなり', type: 'dragon', category: 'special',
    power: 40, accuracy: 100, pp: 20,
    effects: [{ kind: 'stat', target: 'foe', stat: 'atk', stages: -1, chance: 20 }],
    desc: 'ひくい うなりごえを ぶつける。こうげきを さげる ことがある。',
  },
  dragonclaw: {
    name: 'りゅうそうげき', type: 'dragon', category: 'physical',
    power: 80, accuracy: 100, pp: 15,
    desc: 'りゅうの ツメで はげしく きりさく。',
  },
  dragonroar: {
    name: 'りゅうのほうこう', type: 'dragon', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [
      { kind: 'stat', target: 'self', stat: 'atk', stages: 1 },
      { kind: 'stat', target: 'self', stat: 'spe', stages: 1 },
    ],
    desc: 'ほえて ちからを ときはなち こうげきと すばやさを あげる。',
  },
  dragonwave: {
    name: 'りゅうおうは', type: 'dragon', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    desc: 'りゅうの ちからを なみに して はなつ。',
  },
  skydragon: {
    name: 'てんりゅうげき', type: 'dragon', category: 'physical',
    power: 120, accuracy: 90, pp: 10,
    effects: [{ kind: 'recoil', ratio: 0.25 }],
    desc: 'てんに のぼる りゅうの ような いちげき。じぶんも ダメージを うける。',
  },
  dragongod: {
    name: 'りゅうじんほう', type: 'dragon', category: 'special',
    power: 120, accuracy: 90, pp: 5,
    effects: [{ kind: 'stat', target: 'self', stat: 'spa', stages: -2 }],
    desc: 'りゅうじんの ちからを はなつ。つかうと とくこうが がくっと さがる。',
  },

  // -------------------------------------------------------------------
  // あく
  // -------------------------------------------------------------------
  chomp: {
    name: 'がぶり', type: 'dark', category: 'physical',
    power: 50, accuracy: 100, pp: 25,
    effects: [{ kind: 'flinch', chance: 20 }],
    desc: 'するどい キバで がぶりと かみつく。ひるませる ことがある。',
  },
  exploit: {
    name: 'すきをつく', type: 'dark', category: 'physical',
    power: 60, accuracy: 0, pp: 20,
    desc: 'あいての すきを ついて こうげき。かならず めいちゅうする。',
  },
  scheme: {
    name: 'たくらむ', type: 'dark', category: 'status',
    power: 0, accuracy: 0, pp: 20,
    effects: [{ kind: 'stat', target: 'self', stat: 'spa', stages: 2 }],
    desc: 'わるい ことを たくらみ とくこうを ぐーんと あげる。',
  },
  darkstrike: {
    name: 'やみうち', type: 'dark', category: 'physical',
    power: 75, accuracy: 100, pp: 15,
    critStage: 1,
    desc: 'くらやみに まぎれて きりつける。きゅうしょに あたりやすい。',
  },
  blackorb: {
    name: 'しっこくのたま', type: 'dark', category: 'special',
    power: 80, accuracy: 100, pp: 15,
    effects: [{ kind: 'flinch', chance: 20 }],
    desc: 'まっくろな たまを ぶつける。ひるませる ことがある。',
  },
  abyssdrop: {
    name: 'ならくおとし', type: 'dark', category: 'physical',
    power: 110, accuracy: 90, pp: 10,
    desc: 'あいてを ならくの そこへ たたきおとす。',
  },

  // -------------------------------------------------------------------
  // はがね
  // -------------------------------------------------------------------
  steelknuckle: {
    name: 'スチールナックル', type: 'steel', category: 'physical',
    power: 50, accuracy: 100, pp: 25,
    effects: [{ kind: 'stat', target: 'self', stat: 'def', stages: 1, chance: 20 }],
    desc: 'はがねの こぶしで なぐる。ぼうぎょが あがる ことがある。',
  },
  creak: {
    name: 'きしみおと', type: 'steel', category: 'status',
    power: 0, accuracy: 85, pp: 40,
    effects: [{ kind: 'stat', target: 'foe', stat: 'def', stages: -2 }],
    desc: 'いやな きしみおとを たてて ぼうぎょを がくっと さげる。',
  },
  steellariat: {
    name: 'こうてつラリアット', type: 'steel', category: 'physical',
    power: 80, accuracy: 100, pp: 15,
    effects: [{ kind: 'flinch', chance: 10 }],
    desc: 'はがねの うでを ふりまわして なぎたおす。ひるませる ことがある。',
  },
  silverbeam: {
    name: 'ぎんいろこうせん', type: 'steel', category: 'special',
    power: 80, accuracy: 100, pp: 10,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 10 }],
    desc: 'ぎんいろに かがやく こうせんを はなつ。とくぼうを さげる ことがある。',
  },
  ironhammer: {
    name: 'てっつい', type: 'steel', category: 'physical',
    power: 110, accuracy: 90, pp: 10,
    desc: 'はがねの ように かたい いちげきを ふりおろす。',
  },
};
