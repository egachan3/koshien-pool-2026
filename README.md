# 甲子園 個人成績板（自動更新版）

10人 × 持ち校4校を事前登録した、毎晩21:00自動更新の勝ち数トラッカーです。
費用は0円（GitHub Actions + GitHub Pages の無料枠のみ）。

## 仕組み
- `scripts/fetch-results.mjs` … 毎晩GitHub Actions#��実行し、結果を取得して `data/matches.json` を更新
- `.github/workflows/update.yml` … 毎日 21:00 JST（UTC 12:00）に自動実行するcron設定
- `index.html` … 誰でも見られる公開ページ。`data/matches.json` を読んで表示するだけ

## デプロイ手順（あなたが行う必要がある部分・所要5〜10分）

1. GitHubで新しいリポジトリを作成する（Public推奨。Privateだと自動更新後の反映に一手間増えます）
   - 例: `koshien-pool-2026`
2. このフォルダの中身（`index.html`, `data/`, `scripts/`, `.github/`, `README.md`）を丸ごとアップロードする
   - GitHubの「Add file → Upload files」でドラッグ＆ドロップでOK
3. リポジトリの Settings → Actions → General → Workflow permissions を
   **「Read and write permissions」** に変更して Save
   （これをやらないと、自動更新スクリプトが結果をコミットできません）
4. リポジトリの Settings → Pages → Branch を `main` / `/ (root)` にして Save
   → 数分後に `https://ユーザー名.github.io/koshien-pool-2026/` が有効になります
5. 最初の動作確認として、Actions タブ → 「Koshien Daily Update」→ 「Run workflow」で
   手動実行してみてください（cronの21:00を待たなくだよ、その場でテストできます）

## 大会開始後にやること（重要）

`scripts/fetch-results.mjs` の `SOURCE_URL` と抽出ロジックは、
実際の試合結果ページの構造を見ながら精度を上げる必要があります。
8/7の開幕後、実際のページを見せてもらえれば、こちらで選定・調整します。

## データを手動で直したいとき

`data/matches.json` をGitHub上で直接編集して保存すれば、
Pagesの表示に自動で反映されます（コマンドやアプリは不要）。
