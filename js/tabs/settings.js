// =====================================================================
// App.settingsTab — 「その他」タブ
//   設定・セーブの書き出し/読み込み・プレイ記録・エディタ上書き・操作説明・デバッグ
// =====================================================================
(function () {
  'use strict';
  const App = window.App = window.App || {};

  let panel = null;
  let visible = false;
  const refs = {};

  const U = () => App.util;
  const S = () => App.state;
  const cfg = () => (App.data && App.data.config) || {};
  const sfx = (n) => { try { if (App.audio && App.audio.play) App.audio.play(n); } catch (e) { /* 無視 */ } };

  const SPEED_LABELS = [['slow', 'おそい'], ['normal', 'ふつう'], ['fast', 'はやい']];
  const STAT_ROWS = [
    ['battles', 'バトル回数', '回'], ['wins', 'しょうり', '回'], ['losses', 'はいぼく', '回'], ['runs', 'にげた', '回'],
    ['wildWins', 'やせい げきは', '体'], ['trainerWins', 'トレーナー げきは', '人'],
    ['pointsEarned', 'かくとく ポイント', 'pt'], ['pointsSpent', 'しよう ポイント', 'pt'],
    ['steps', 'あるいた ほすう', '歩'], ['loginDays', 'ログイン日数', '日'],
  ];

  function section(title, icon, ...children) {
    const el = U().el;
    return el('section', { class: 'panel settings-section' },
      el('h3', { class: 'section-title' }, el('span', { class: 'section-icon', text: icon }), title),
      children);
  }

  function row(label, control, desc, stack) {
    const el = U().el;
    return el('div', { class: ['setting-row', stack ? 'is-stack' : ''] },
      el('div', { class: 'setting-label' }, el('span', { text: label }), desc ? el('small', { text: desc }) : null),
      el('div', { class: 'setting-control' }, control));
  }

  // ---------------------------------------------------------------- 構築
  function build() {
    const el = U().el;
    panel.innerHTML = '';
    const grid = el('div', { class: 'settings-grid' });

    // プレイヤー・記録
    refs.playerName = el('b', { class: 'player-name' });
    refs.playerMeta = el('div', { class: 'player-meta' });
    refs.statsGrid = el('div', { class: 'stat-grid' });
    grid.appendChild(section('プレイヤー', '◆',
      el('div', { class: 'player-card' },
        el('div', { class: 'player-avatar', 'aria-hidden': 'true' }),
        el('div', { class: 'player-info' },
          el('div', { class: 'player-name-row' }, refs.playerName,
            U().el('button', { class: 'btn btn-sm', type: 'button', text: 'なまえを かえる', onclick: rename })),
          refs.playerMeta)),
      el('h4', { class: 'sub-title', text: 'プレイ記録' }),
      refs.statsGrid));

    // 設定
    refs.speedSeg = el('div', { class: 'segmented', role: 'radiogroup' },
      SPEED_LABELS.map(([key, label]) => el('button', {
        type: 'button', class: 'seg-btn', dataset: { value: key }, text: label,
        onclick: () => { S().setSetting('textSpeed', key); sfx('select'); refreshSettings(); playPreview(); },
      })));
    refs.preview = el('div', { class: 'speed-preview' }, el('span', { class: 'speed-preview-text' }));
    refs.soundToggle = el('button', {
      type: 'button', class: 'toggle', role: 'switch',
      onclick: () => { S().setSetting('sound', !S().setting('sound')); refreshSettings(); sfx('confirm'); },
    }, el('span', { class: 'toggle-knob' }));
    refs.volume = el('input', { type: 'range', class: 'range', min: '0', max: '100', step: '5' });
    refs.volumeVal = el('span', { class: 'range-value' });
    refs.volume.addEventListener('input', () => {
      refs.volumeVal.textContent = refs.volume.value + '%';
      S().setSetting('volume', Number(refs.volume.value) / 100);
    });
    refs.volume.addEventListener('change', () => sfx('coin'));
    grid.appendChild(section('せってい', '⚙',
      row('メッセージの はやさ', el('div', { class: 'speed-wrap' }, refs.speedSeg, refs.preview), null, true),
      row('サウンド', refs.soundToggle, 'こうかおん・BGM'),
      row('おんりょう', el('div', { class: 'range-wrap' }, refs.volume, refs.volumeVal))));

    // セーブデータ
    refs.fileInput = el('input', { type: 'file', accept: '.json,application/json,text/plain', hidden: true });
    refs.fileInput.addEventListener('change', onFilePicked);
    grid.appendChild(section('セーブデータ', '▣',
      el('p', { class: 'muted', text: 'セーブは じどうで ブラウザに ほぞんされます。べつの パソコンへ うつすときや バックアップに 書き出しを つかってください。' }),
      el('div', { class: 'btn-row' },
        App.ui.button('ファイルに 書き出す', { variant: 'primary', onClick: exportFile }),
        App.ui.button('テキストで コピー', { onClick: exportCopy })),
      el('div', { class: 'btn-row' },
        App.ui.button('ファイルから 読み込む', { onClick: () => refs.fileInput.click() }),
        App.ui.button('テキストを 貼り付けて 読み込む', { onClick: importPaste })),
      refs.fileInput,
      el('div', { class: 'danger-zone' },
        el('div', {}, el('b', { text: 'データリセット' }), el('small', { text: 'すべての しんこうを けして さいしょから はじめます。' })),
        App.ui.button('リセット', { variant: 'danger', onClick: resetData }))));

    // データエディタ
    refs.overrideBox = el('div', { class: 'override-box' });
    grid.appendChild(section('データエディタ', '✎',
      el('p', { class: 'muted', text: 'モンスターや わざ・マップ などの データを ブラウザ上で へんしゅう できます。へんしゅう内容は このブラウザにだけ ほぞんされ、data/*.js に 書き出すことも できます。' }),
      refs.overrideBox,
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn btn-gold', href: 'editor.html', target: '_blank', rel: 'noopener', text: 'エディタを ひらく ↗' }))));

    // 操作説明
    grid.appendChild(section('そうさ せつめい', '✚', buildHelp()));

    // デバッグ
    if (cfg().debug) grid.appendChild(buildDebug());

    // バージョン
    grid.appendChild(el('div', { class: 'about' },
      el('b', { text: (cfg().title || 'ガチャモン') + ' ' }), el('span', { text: 'ver ' + (cfg().version || '-') }),
      el('div', { class: 'muted', text: 'モンスター・マップ・キャラクター・きょく は すべて オリジナル です。' })));

    panel.appendChild(grid);
  }

  function buildHelp() {
    const el = U().el;
    const k = (...keys) => el('span', { class: 'keys' }, keys.map((x) => el('kbd', { text: x })));
    const rows = [
      ['いどう', k('↑', '↓', '←', '→'), 'WASD でも いどう できます'],
      ['A ボタン', k('Z', 'Enter', 'Space'), 'はなす・しらべる・けってい'],
      ['B ボタン', k('X', 'Esc', 'BS'), 'キャンセル・Bを おしながら いどうで はしる'],
      ['START', k('C'), 'メニュー'],
      ['タブ きりかえ', k('1', '2', '3', '4', '5'), 'ぼうけん / へんせい / ガチャ / ずかん / その他'],
      ['スマホ', el('span', { text: 'がめん下の パッド' }), 'じゅうじキーと A・B を タップ'],
    ];
    return el('table', { class: 'help-table' },
      el('tbody', {}, rows.map(([a, b, c]) => el('tr', {},
        el('th', { text: a }),
        el('td', {}, b, el('div', { class: 'help-desc', text: c }))))));
  }

  function buildDebug() {
    const el = U().el;
    const b = (label, fn, variant) => App.ui.button(label, { variant, size: 'sm', onClick: fn });
    return section('デバッグ', '！',
      el('p', { class: 'muted', text: 'config.debug = true のときだけ ひょうじ されます。' }),
      el('div', { class: 'btn-row wrap' },
        b('+1000 pt', () => { S().addPoints(1000, 'debug'); sfx('coin'); }, 'gold'),
        b('+10000 pt', () => { S().addPoints(10000, 'debug'); sfx('coin'); }, 'gold'),
        b('無料ガチャ +3', () => { S().addFreePulls(3); App.ui.toast('無料ガチャ +3', { type: 'success' }); }),
        b('全回復', () => { S().healAll(); App.ui.toast('ぜんいん げんきに なった！', { type: 'success' }); sfx('heal'); }),
        b('全モンスター入手', debugGetAll),
        b('パーティ Lv+5', debugLevelUp),
        b('トレーナー撃破リセット', () => { S().data.trainers = {}; S().save(); App.ui.toast('トレーナーの げきは記録を リセットしました'); }),
        b('落とし物リセット', () => { S().data.pickups = {}; S().save(); App.ui.toast('ひろったポイントを リセットしました'); }),
        b('ログボ日付リセット', () => { S().data.lastLogin = ''; S().saveNow(); App.ui.toast('再読み込みで ログインボーナスが もらえます'); }),
        b('データ検証レポート', showValidation, 'primary')));
  }

  // ---------------------------------------------------------------- 表示更新
  function refresh() {
    if (!panel) return;
    if (!visible) return;
    refreshPlayer();
    refreshSettings();
    refreshOverride();
  }

  function refreshPlayer() {
    const el = U().el;
    const d = S().data;
    const fmt = U().formatNumber;
    refs.playerName.textContent = d.player.name || '（未設定）';
    const dexTotal = App.data.monsters().length;
    const seen = App.data.monsters().filter((m) => d.dex.seen[m.id]).length;
    refs.playerMeta.innerHTML = '';
    refs.playerMeta.append(
      el('span', {}, 'はじめた日 ', el('b', { text: d.createdAt ? U().today(new Date(d.createdAt)) : '-' })),
      el('span', {}, 'しょじ ', el('b', { text: S().ownedCount() + ' / ' + dexTotal })),
      el('span', {}, 'みつけた ', el('b', { text: String(seen) })),
      el('span', {}, 'ガチャ ', el('b', { text: fmt(d.gacha.totalPulls) + '回' })));
    refs.statsGrid.innerHTML = '';
    for (const [key, label, unit] of STAT_ROWS) {
      refs.statsGrid.appendChild(el('div', { class: 'stat-tile' },
        el('span', { class: 'stat-label', text: label }),
        el('span', { class: 'stat-value' }, fmt(d.stats[key] || 0), el('small', { text: unit }))));
    }
  }

  function refreshSettings() {
    const speed = S().setting('textSpeed');
    refs.speedSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.value === speed);
      b.setAttribute('aria-checked', b.dataset.value === speed ? 'true' : 'false');
    });
    const on = !!S().setting('sound');
    refs.soundToggle.classList.toggle('is-on', on);
    refs.soundToggle.setAttribute('aria-checked', on ? 'true' : 'false');
    refs.soundToggle.title = on ? 'ON' : 'OFF';
    const vol = Math.round((Number(S().setting('volume')) || 0) * 100);
    if (document.activeElement !== refs.volume) refs.volume.value = String(vol);
    refs.volumeVal.textContent = vol + '%';
    refs.volume.disabled = !on;
  }

  function refreshOverride() {
    const el = U().el;
    const box = refs.overrideBox;
    box.innerHTML = '';
    const info = App.data.overrideInfo ? App.data.overrideInfo() : { active: App.data.hasOverrides(), keys: [] };
    if (App.data.hasOverrides()) {
      box.className = 'override-box is-active';
      box.append(
        el('div', { class: 'override-status' },
          el('span', { class: 'chip chip-warn', text: info.broken ? '上書きデータ（こわれています）' : 'エディタの上書きデータを使用中' }),
          info.savedAt ? el('small', { class: 'muted', text: 'ほぞん: ' + U().formatDateTime(info.savedAt) }) : null),
        info.keys && info.keys.length ? el('div', { class: 'muted small', text: '対象: ' + info.keys.join(', ') }) : null,
        App.ui.button('上書きを かいじょ して 標準データに もどす', { variant: 'danger', size: 'sm', onClick: clearOverride }));
    } else {
      box.className = 'override-box';
      box.append(el('span', { class: 'chip', text: '標準データ（data/*.js）を使用中' }));
    }
  }

  let previewTimer = null;
  function playPreview() {
    const span = refs.preview.querySelector('.speed-preview-text');
    const text = 'これが メッセージの はやさ です。';
    const table = cfg().textSpeed || { normal: 30 };
    const ms = table[S().setting('textSpeed')] || 30;
    clearTimeout(previewTimer);
    let n = 0;
    const chars = Array.from(text);
    const step = () => {
      n++;
      span.textContent = chars.slice(0, n).join('');
      if (n < chars.length) previewTimer = setTimeout(step, ms);
    };
    step();
  }

  // ---------------------------------------------------------------- 操作
  async function rename() {
    const v = await App.ui.prompt('あたらしい なまえを いれてね（8もじまで）', {
      title: 'なまえを かえる', value: S().data.player.name, maxLength: 8, placeholder: cfg().player && cfg().player.defaultName,
    });
    if (v === null) return;
    if (!v) { App.ui.toast('なまえを いれてください', { type: 'warn' }); return; }
    S().setPlayerName(v);
    App.ui.toast('なまえを「' + v + '」に かえました', { type: 'success' });
    refresh();
  }

  function exportFile() {
    const json = S().exportJSON();
    const d = new Date();
    const stamp = U().today(d).replace(/-/g, '') + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    U().downloadText('gachamon_save_' + stamp + '.json', json);
    App.ui.toast('セーブデータを 書き出しました', { type: 'success' });
  }

  async function exportCopy() {
    const json = S().exportJSON();
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(json); ok = true; }
    } catch (e) { ok = false; }
    if (ok) { App.ui.toast('クリップボードに コピーしました', { type: 'success' }); return; }
    const ta = U().el('textarea', { class: 'textarea mono', rows: 10, readonly: true });
    ta.value = json;
    App.ui.modal({
      title: 'セーブデータ（テキスト）',
      body: U().el('div', {}, U().el('p', { class: 'modal-text', text: '下の テキストを すべて コピーして ほぞんしてください。' }), ta),
      buttons: [{ label: 'とじる', value: true, primary: true }],
      onOpen: () => setTimeout(() => { ta.focus(); ta.select(); }, 50),
    });
  }

  function onFilePicked() {
    const f = refs.fileInput.files && refs.fileInput.files[0];
    refs.fileInput.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => doImport(String(reader.result || ''));
    reader.onerror = () => App.ui.toast('ファイルを 読み込めませんでした', { type: 'error' });
    reader.readAsText(f);
  }

  async function importPaste() {
    const ta = U().el('textarea', { class: 'textarea mono', rows: 10, placeholder: '{ "version": 1, ... }' });
    const v = await App.ui.modal({
      title: 'セーブデータを 貼り付け',
      body: U().el('div', {}, U().el('p', { class: 'modal-text', text: '書き出した セーブデータの テキストを 貼り付けてください。' }), ta),
      buttons: [{ label: 'キャンセル', value: null }, { label: '読み込む', primary: true, value: () => ta.value }],
    });
    if (v) doImport(v);
  }

  async function doImport(text) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== 'object' || !parsed.player) {
      App.ui.toast('セーブデータの けいしきが ただしくありません', { type: 'error' });
      sfx('error');
      return;
    }
    const name = parsed.player && parsed.player.name ? parsed.player.name : '（なまえなし）';
    const ok = await App.ui.confirm(`「${name}」の データを 読み込みます。\nいまの データは うわがき されます。よろしいですか？`, {
      title: 'セーブデータの 読み込み', okLabel: '読み込む', danger: true,
    });
    if (!ok) return;
    if (!S().importJSON(parsed)) {
      App.ui.toast('読み込みに しっぱいしました', { type: 'error' });
      return;
    }
    await App.ui.modal({ title: '読み込み かんりょう', body: 'データを 読み込みました。ゲームを さいきどう します。', buttons: [{ label: 'OK', value: true, primary: true }], closable: false });
    location.reload();
  }

  async function resetData() {
    const ok1 = await App.ui.confirm('すべての データを けして さいしょから はじめますか？\n（ポイント・モンスター・ずかん・きろく が きえます）', {
      title: 'データリセット', okLabel: 'けす', danger: true,
    });
    if (!ok1) return;
    const ok2 = await App.ui.confirm('ほんとうに よろしいですか？ この そうさは もとに もどせません。', {
      title: 'さいしゅう かくにん', okLabel: 'リセットする', danger: true,
    });
    if (!ok2) return;
    S().reset();
    location.reload();
  }

  async function clearOverride() {
    const ok = await App.ui.confirm('エディタの上書きデータを けして、data/*.js の 標準データに もどします。\n（エディタで 書き出していない へんしゅうは きえます）', {
      title: '上書きの かいじょ', okLabel: 'かいじょ する', danger: true,
    });
    if (!ok) return;
    App.data.clearOverrides();
    S().saveNow();
    location.reload();
  }

  function debugGetAll() {
    let n = 0;
    for (const m of App.data.monsters()) {
      if (!S().isOwned(m.id)) { S().addMonster(m.id); n++; }
    }
    App.ui.toast(n ? n + '体の モンスターを てにいれた！' : 'すでに ぜんぶ もっています', { type: 'success' });
  }

  function debugLevelUp() {
    const party = S().party();
    if (!party.length) { App.ui.toast('パーティに モンスターが いません', { type: 'warn' }); return; }
    const maxLv = cfg().maxLevel || 100;
    for (const inst of party) {
      const target = Math.min(maxLv, inst.level + 5);
      const def = App.data.monster(inst.speciesId);
      const need = App.monster.expForLevel(target, (def && def.expGroup) || 'medium_fast') - inst.exp;
      if (need > 0) App.monster.addExp(inst, need);
      App.events.emit('monster:updated', { speciesId: inst.speciesId });
    }
    S().save();
    sfx('levelup');
    App.ui.toast('パーティの レベルが 5 あがった！', { type: 'success' });
  }

  function showValidation() {
    const el = U().el;
    const rep = App.data.validate();
    const list = (items, cls) => el('ul', { class: 'report-list ' + cls }, items.map((t) => el('li', { text: t })));
    const body = el('div', { class: 'report' },
      el('div', { class: 'report-summary' },
        el('span', { class: 'chip ' + (rep.errors.length ? 'chip-danger' : 'chip-ok'), text: 'エラー ' + rep.errors.length }),
        el('span', { class: 'chip ' + (rep.warnings.length ? 'chip-warn' : 'chip-ok'), text: 'けいこく ' + rep.warnings.length }),
        el('span', { class: 'chip', text: 'モンスター ' + App.data.monsters().length }),
        el('span', { class: 'chip', text: 'わざ ' + Object.keys(GameData.moves || {}).length }),
        el('span', { class: 'chip', text: 'マップ ' + Object.keys(GameData.maps || {}).length })),
      rep.errors.length ? list(rep.errors, 'is-error') : null,
      rep.warnings.length ? list(rep.warnings, 'is-warn') : null,
      !rep.errors.length && !rep.warnings.length ? el('p', { class: 'modal-text', text: 'もんだいは 見つかりませんでした。' }) : null);
    App.ui.modal({ title: 'データ検証レポート', body, size: 'wide', buttons: [{ label: 'とじる', value: true, primary: true }] });
  }

  // ---------------------------------------------------------------- タブ IF
  function init(panelEl) {
    panel = panelEl;
    build();
    const mark = () => refresh();
    ['points:changed', 'freepulls:changed', 'collection:changed', 'dex:changed', 'settings:changed', 'state:loaded', 'battle:end', 'gacha:pulled', 'player:renamed']
      .forEach((ev) => App.events.on(ev, mark));
  }

  function onShow() {
    visible = true;
    refresh();
    const span = refs.preview && refs.preview.querySelector('.speed-preview-text');
    if (span && !span.textContent) playPreview();
  }

  function onHide() {
    visible = false;
    clearTimeout(previewTimer);
  }

  App.settingsTab = { init, onShow, onHide };
})();
