ここにタイル画像（16x16 PNG）を置き、data/tiles.js の該当記号に image: 'assets/tiles/ファイル名.png' を追加します。
例: 'T': { name: '木', draw: 'tree', walk: false, image: 'assets/tiles/tree.png' },
画像を指定したタイルは、自動生成のドット絵のかわりにその画像で描画されます（画像タイルはアニメーションしません）。
草むらなど overlay: true のタイルは、画像の下側 7 ドットがキャラクターの足元に重ねて描かれます。
画像が読み込めないときは draw の自動生成ドット絵で描画されます。
