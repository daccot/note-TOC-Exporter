# note TOC Exporter

`note.com` の公開記事ページと `editor.note.com` の編集画面から目次を取得して、Markdown 形式の TOC を生成する Chrome 拡張です。

## できること

- 拡張アイコンを押した時だけスクリプトを注入
- 公開画面と編集画面の両方に対応
- リンク付き / リンクなしを切り替え
- Markdown / HTML / プレーンテキストの出力切り替え
- 箇条書き / 番号付きリストを切り替え
- 最小見出しレベル (`H2` から `H6`) を切り替え
- インデントを半角スペース / 全角スペースで切り替え
- タイトル / URL / 公開日 / 見出し統計を出力に含められる
- 除外キーワードで特定見出しを弾ける
- プレビューから見出し位置へジャンプできる
- 生成結果をファイル保存できる
- 診断ログで TOC 抽出状況を確認できる
- ショートカット (`Ctrl+Shift+Y`) で起動できる
- 自動実行を保存設定として持てる
- popup から即実行 / Options移動 / 保存済み既定値の確認ができる
- popup から quick settings、単発 format 実行、Copy as、履歴再コピーができる
- 出力テンプレート、プロファイル、履歴保存に対応
- 著者・概要・タグ・アイキャッチURLも取得できる範囲で拾う
- 安全なファイル名で保存する
- Playwright の E2E テスト土台あり
- 設定を `chrome.storage.local` に保存

## セットアップ

1. `npm install`
2. `npm run build`
3. Chrome で `chrome://extensions` を開く
4. デベロッパーモードを ON
5. `Load unpacked` で `dist/` フォルダを選ぶ

## 開発コマンド

- `npm run build`: `dist/` に拡張用JSを出力
- `npm run typecheck`: TypeScript の型検査
- `npm test`: Vitest でテスト実行
- `npm run e2e`: Playwright のE2Eテスト

## 対応ページ

- `https://note.com/<user>/n/<note-id>`
- `https://editor.note.com/notes/<note-id>/edit`

## 使い方メモ

- 拡張アイコンか `Ctrl+Shift+Y` で起動
- 拡張アイコンを押すと popup が開いて、そこから即実行もできる
- popup で `Copy as ...` と単発 format 実行ができる
- Options ではテンプレ編集、プロファイル保存/適用/削除、履歴確認と再コピーができる
- モーダル右側のプレビューから該当見出しへ移動
- `保存` ボタンで現在の出力形式のままファイル保存
- `自動実行` を ON にすると、次回以降そのページ種別で自動起動

## 既知の制限

- note 側の DOM 構造が大きく変わると取得ロジックの調整が必要です
- 公開画面で TOC 側にアンカーが無い場合は、見出しテキストとレベルから推定して紐付けます
- クリップボード書き込みに失敗した場合はモーダルから手動コピーしてください
