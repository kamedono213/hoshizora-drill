# ほしぞらドリル(天文宇宙検定4級 対策・非公式)

天文宇宙検定4級(星博士ジュニア)の範囲を、くり返し学べるスマホ向けWebアプリ(PWA)。

## 試験の形式(2026年10月時点の公式案内 https://www.astro-test.org/guide)
- 4択・マークシート、40問・50分、100点満点で60点以上が合格
- 範囲は公式テキスト《4級 星博士ジュニア》2025〜2026年版(0〜6章)。第22回は2026年11月15日

## 中身
- 問題: 299問(手で書いた254問+図の問題45問)。すべてオリジナル(過去問の転載なし)
  - `data/questions.js` … 章・問題文・選択肢(先頭が正解)・解説
  - 図の問題(星座の形・大三角・1等星の位置・月の形)は `tools/build-data.js` が星図データから自動生成
- 学習の仕組み
  - 今日のミッション10問: 復習の時期が来た問題+苦手な章の新しい問題
  - 間隔をあけたくり返し: 正解すると箱が上がり、次に出るまで 1→2→4→7→15日 とのびる。まちがえると1に戻る。箱3以上を「覚えた」とする
  - まちがえた問題は、その回の最後にもう一度出す(この2回目は記録に入れない)
  - 章ごとの星座: 覚えた割合だけ星が光る。称号は全体の覚えた割合で変わる
  - 模擬試験: 本番と同じ40問・50分、章ごとの配分 3・6・6・7・9・5・4
- 記録はその端末のブラウザ(localStorage)に保存

## データの出典
- 星座の線・星の位置: d3-celestial 0.7.35 のデータ(BSD-3-Clause)。`research/` に元データ
- 数値は国立天文台・理科年表などで一般に使われる値を「約」で表記

## 作り方
- `node tools/build-data.js` … `app/data/questions.json` と `app/data/sky.json` を作る
- `node tools/make-icons.js` … アイコン
- `node tools/build-pages.js` … `docs/` にPWA版(GitHub Pages用)
- `node serve.js docs` … http://localhost:5391 で確認

## 公開
- PWA版(GitHub Pages): https://kamedono213.github.io/hoshizora-drill/ … `node tools/build-pages.js` で docs/ を作り直して push すると更新される
- Artifact版: https://claude.ai/artifact/SzMAu9gSff8kcPydpxKoCA
