# evaluation-viewer

診断テーブル共有 JSON（`diagnosis-table-share/v1`）を読み込んで表示する、React + Electron の表示専用ビューアです。

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

- Vite 開発サーバーを起動し、Electron ウィンドウを自動で開きます。

## ビルド

```bash
npm run build
```

- これは Web アセット（`dist/`）のみを生成します。

## 配布用アプリ生成（macOS）

```bash
npm run dist
```

- 配布物は `release/` に生成されます（例: `.dmg`, `.zip`）。
- Apple Silicon 向けのみ作る場合は `npm run dist:arm64`、Intel 向けは `npm run dist:x64` を使えます。
- インストーラではなく `.app` フォルダが必要な場合は以下を実行してください。

```bash
npm run dist:dir
```

- `release/mac-arm64/Diagnosis Share Viewer.app` が生成されます（`dist:x64` 時は `mac` か `mac-x64` 側）。

## Google Drive で配布する流れ

1. `npm run dist` を実行して `release/*.dmg` を作る
2. 生成された `.dmg` を Google Drive にアップロード
3. 共有リンクをユーザーに案内
4. ユーザーは `.dmg` を開いて `Applications` にドラッグしてインストール

## 署名なしアプリの初回起動（macOS）

- Apple Developer 署名なしの場合、初回は警告が出ます。
- ユーザー側で `control + クリック -> 開く` を 1 回行うと起動できます。

## 対応機能

- JSON 貼り付け入力
- JSON ファイル読み込み（`.json` / `application/json`）
- `zod` によるスキーマ検証
- エラー表示（不正JSON・スキーマ不一致）
- レース情報 2 行表示
- 診断結果テーブル表示（`reason` 改行維持、`A(86)` 表示）
- 表示クリア
