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

## 対応機能

- JSON 貼り付け入力
- JSON ファイル読み込み（`.json` / `application/json`）
- `zod` によるスキーマ検証
- エラー表示（不正JSON・スキーマ不一致）
- レース情報 2 行表示
- 診断結果テーブル表示（`reason` 改行維持、`A(86)` 表示）
- 表示クリア
