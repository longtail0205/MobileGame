// =====================================================================
// トレーナーの定義（GameData.trainers）
//
// 【編集のしかた】
//   キー（例 route1_kenta）がトレーナーID。data/maps.js の npcs に
//   { id: 'xxx', x, y, dir, trainer: 'トレーナーID', sight: 視線マス数 } と書くと配置される。
//   ・name / className … 表示は「className の name」（例「わんぱくキッズの ケンタ」）
//   ・look             … フィールドでの見た目（自動生成ドット絵）
//                        skin=肌 hair=髪 hairStyle='short'|'long'|'spiky'|'bald'|'bun'
//                        shirt=服 pants=ズボン hat=帽子の色 or null accent=差し色 image=画像(16x24×3×4)
//   ・image            … バトルの立ち絵画像（空 = look から自動生成）
//   ・party            … 手持ち。{ species: モンスターID, level: レベル, moves: ['わざID', ...](省略可) }
//   ・reward           … 勝ったときにもらえるポイント（省略時 config.rewards.trainerDefault）
//   ・ai               … 'random'（てきとう）| 'smart'（相性を考える）
//   ・boss             … true でボス用BGM（ジムリーダー等）
//   ・rematch          … 'never'（1回だけ）| 'daily'（日付が変わると再戦できる）
//   ・intro / lose / win / after … セリフ。配列の1要素が1ページ。
//        intro: 目が合った・話しかけたとき / lose: プレイヤーが勝ったとき（バトル画面）
//        win: プレイヤーが負けたとき / after: 撃破後に話しかけたとき
//   セリフは ひらがな多め・文節ごとに スペースを入れると GBA らしくなる。{player} は主人公の名前。
// =====================================================================
window.GameData = window.GameData || {};

GameData.trainers = {
  // ---------------------------------------------------------------- 1ばんどうろ
  route1_kenta: {
    name: 'ケンタ',
    className: 'わんぱくキッズ',
    look: { skin: '#f8d0a8', hair: '#202020', hairStyle: 'spiky', shirt: '#f0c030', pants: '#3060c0', hat: null, accent: '#ffffff' },
    image: '',
    party: [{ species: 'imomun', level: 3 }, { species: 'chunpi', level: 4 }],
    reward: 120,
    ai: 'random',
    boss: false,
    rematch: 'daily',
    intro: ['あっ！ めが あったな！', 'ぼくの モンスターと しょうぶだ！'],
    lose: ['うわー！ まけちゃった…'],
    win: ['へへん！ ぼくの かちー！'],
    after: ['ガチャで つよい モンスターが でると いいなあ。', 'あしたも しょうぶ しようね！'],
  },
  route1_yui: {
    name: 'ユイ',
    className: 'おさんぽガール',
    look: { skin: '#f8d8b8', hair: '#a05028', hairStyle: 'long', shirt: '#f080b0', pants: '#f8f8f8', hat: null, accent: '#ffffff' },
    image: '',
    party: [{ species: 'watamochi', level: 4 }, { species: 'tsubomin', level: 5 }],
    reward: 150,
    ai: 'random',
    boss: false,
    rematch: 'never',
    intro: ['おさんぽの とちゅうで バトル！', 'これが いちばん たのしいのよね！'],
    lose: ['あらら… まけちゃった。'],
    win: ['ふふっ わたしの かちね！'],
    after: ['くさむらを あるくと やせいの モンスターに よく であうわ。', 'かつと ポイントも もらえるのよ！'],
  },

  // ---------------------------------------------------------------- ささやきのもり
  forest_shun: {
    name: 'シュン',
    className: 'もりのたんけんか',
    look: { skin: '#e8b890', hair: '#603818', hairStyle: 'short', shirt: '#98a050', pants: '#605030', hat: '#507838', accent: '#f0e0a0' },
    image: '',
    party: [{ species: 'imomun', level: 6 }, { species: 'hirarin', level: 7 }],
    reward: 200,
    ai: 'random',
    boss: false,
    rematch: 'never',
    intro: ['もりの おくには めずらしい モンスターが いるんだ！', 'その まえに ぼくと しょうぶだ！'],
    lose: ['まいった！ きみ なかなか やるね。'],
    win: ['もりでは ゆだんが きんもつ だよ！'],
    after: ['むしタイプは ほのおや ひこうの わざに よわいんだ。'],
  },
  forest_nana: {
    name: 'ナナ',
    className: 'はなつみガール',
    look: { skin: '#f8d8c0', hair: '#f0c040', hairStyle: 'bun', shirt: '#80c8f0', pants: '#f8f0f8', hat: null, accent: '#f06080' },
    image: '',
    party: [{ species: 'tsubomin', level: 7 }, { species: 'kasabou', level: 8 }],
    reward: 220,
    ai: 'smart',
    boss: false,
    rematch: 'never',
    intro: ['おはなばたけを あらしに きたの？', 'ゆるさないんだから！'],
    lose: ['きゃっ！ おはなが ちっちゃう…'],
    win: ['おはなの ちからを おもいしった？'],
    after: ['くさタイプの わざは みずや じめんの モンスターに よく きくの。'],
  },

  // ---------------------------------------------------------------- 2ばんどうろ
  route2_takumi: {
    name: 'タクミ',
    className: 'かくとうか',
    look: { skin: '#d8a070', hair: '#181818', hairStyle: 'spiky', shirt: '#f8f8f8', pants: '#f0f0f0', hat: null, accent: '#202020' },
    image: '',
    party: [{ species: 'kobushin', level: 9 }, { species: 'kamakirin', level: 10 }],
    reward: 250,
    ai: 'smart',
    boss: false,
    rematch: 'never',
    intro: ['はっ！ せいっ！', 'しゅぎょうの あいてを さがして いたぞ！'],
    lose: ['くっ… しゅぎょうが たりなかったか！'],
    win: ['おす！ よい しょうぶ だった！'],
    after: ['かくとうタイプは ノーマルや いわに つよいが ひこうに よわい。'],
  },
  route2_rin: {
    name: 'リン',
    className: 'サイクリスト',
    look: { skin: '#f0c8a0', hair: '#303060', hairStyle: 'long', shirt: '#30b0a0', pants: '#303030', hat: '#f05030', accent: '#f8f040' },
    image: '',
    party: [{ species: 'pirinezu', level: 10 }, { species: 'biriunagi', level: 11 }],
    reward: 260,
    ai: 'smart',
    boss: false,
    rematch: 'never',
    intro: ['かぜを きって はしるのって きもちいい！', 'バトルも スピード しょうぶよ！'],
    lose: ['ブレーキが まにあわなかった！'],
    win: ['わたしの ほうが はやかったね！'],
    after: ['でんきタイプは みずや ひこうに つよいの。', 'カザミジムの たいさくに ぴったりよ！'],
  },
  route2_daichi: {
    name: 'ダイチ',
    className: 'いしあつめマニア',
    look: { skin: '#e0b088', hair: '#705030', hairStyle: 'short', shirt: '#b07840', pants: '#505060', hat: '#e0c040', accent: '#ffffff' },
    image: '',
    party: [{ species: 'koishin', level: 9 }, { species: 'dorocchi', level: 10 }, { species: 'yoroidama', level: 11 }],
    reward: 280,
    ai: 'smart',
    boss: false,
    rematch: 'daily',
    intro: ['この いしの つやを みてくれ！', 'おっと その まえに しょうぶだ！'],
    lose: ['ぼくの コレクションが…！'],
    win: ['いしのように かたい まもりだろう？'],
    after: ['いわタイプは ひこうタイプに つよいんだ。', 'また あした いしを みせあおう！'],
  },

  // ---------------------------------------------------------------- カザミジム
  gym_sora: {
    name: 'ソラ',
    className: 'スカイダンサー',
    look: { skin: '#f8d8c0', hair: '#80c0f0', hairStyle: 'long', shirt: '#f8f8f8', pants: '#70a8e0', hat: null, accent: '#f8e080' },
    image: '',
    party: [{ species: 'chunpi', level: 11 }, { species: 'hirarin', level: 12 }],
    reward: 300,
    ai: 'smart',
    boss: false,
    rematch: 'never',
    intro: ['フウカさまに あう まえに', 'わたしの まいを みていきなさい！'],
    lose: ['ステップを まちがえちゃった…'],
    win: ['かぜに のって おどりましょ♪'],
    after: ['フウカさまの モンスターは みんな そらを とぶの。', 'でんきや いわの わざを よういしてね。'],
  },
  gym_hayate: {
    name: 'ハヤテ',
    className: 'とりつかい',
    look: { skin: '#e8b890', hair: '#404040', hairStyle: 'spiky', shirt: '#3858a8', pants: '#e8e0c8', hat: null, accent: '#f8f8f8' },
    image: '',
    party: [{ species: 'yukichidori', level: 12 }, { species: 'kazekiri', level: 13 }],
    reward: 320,
    ai: 'smart',
    boss: false,
    rematch: 'never',
    intro: ['ここまで きたか！', 'だが リーダーの まえに おれが いる！'],
    lose: ['はねが… おれの はねが…！'],
    win: ['そらの おうじゃに かなうものか！'],
    after: ['リーダーの さいごの いっぴきは いわも もっている。', 'みず や こおり の わざが きくぞ。'],
  },
  kazami_leader: {
    name: 'フウカ',
    className: 'ジムリーダー',
    look: { skin: '#f8d8c0', hair: '#40a0a0', hairStyle: 'long', shirt: '#f8f8f8', pants: '#2890a0', hat: '#f8f8f8', accent: '#f8c030' },
    image: '',
    party: [{ species: 'kazekiri', level: 12 }, { species: 'karakasan', level: 13 }, { species: 'iwabasa', level: 15 }],
    reward: 1500,
    ai: 'smart',
    boss: true,
    rematch: 'never',
    intro: ['ようこそ カザミジムへ！', 'わたしは ジムリーダーの フウカ。', 'かぜを あやつる ひこうタイプの つよさ…', 'その からだで かんじなさい！'],
    lose: ['…みごとな かぜ だったわ。', 'あなたの ちから みとめるしか ないわね！'],
    win: ['まだまだ そよかぜね。', 'もっと つよく なって いらっしゃい！'],
    after: ['ジムを こえた あなたなら ほしくずのどうくつにも いけるわ。', 'おくには めったに みられない モンスターが いるそうよ。'],
  },

  // ---------------------------------------------------------------- ほしくずのどうくつ（クリア後）
  cave_ren: {
    name: 'レン',
    className: 'てんもんがくしゃ',
    look: { skin: '#f0c8a0', hair: '#302848', hairStyle: 'long', shirt: '#382868', pants: '#282030', hat: null, accent: '#f8e070' },
    image: '',
    party: [{ species: 'mitooshi', level: 27 }, { species: 'yukigasumi', level: 28 }, { species: 'hoshiyomi', level: 30 }],
    reward: 400,
    ai: 'smart',
    boss: false,
    rematch: 'daily',
    intro: ['この どうくつの てんじょうは ほしぞら みたい だろう？', 'ほしが きみとの しょうぶを のぞんで いる！'],
    lose: ['ほしの よみが はずれた…'],
    win: ['ほしの みちびき どおりだ。'],
    after: ['きょうの ほしうらない… また あした きてごらん。', 'ほしの めぐりが かわれば また しょうぶ できるよ。'],
  },
  cave_gou: {
    name: 'ゴウ',
    className: 'ベテランたんけんか',
    look: { skin: '#c89068', hair: '#e0e0e0', hairStyle: 'bald', shirt: '#886040', pants: '#484848', hat: '#c8a060', accent: '#f8f8f8' },
    image: '',
    party: [{ species: 'haganemushi', level: 29 }, { species: 'sunakujira', level: 31 }, { species: 'haganebushi', level: 32 }],
    reward: 400,
    ai: 'smart',
    boss: false,
    rematch: 'daily',
    intro: ['わしは この どうくつを 40ねん あるいて おる。', 'わかいの… ちからを みせて みなさい！'],
    lose: ['ほっほっ… みごとじゃ！'],
    win: ['まだまだ しゅぎょうが たりんのう。'],
    after: ['この どうくつの おくには まぼろしの モンスターが でるという。', 'わしは まいにち ここに おる。 また きなされ。'],
  },
};
