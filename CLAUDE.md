# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## アプリ概要

**Throw In** — ウェブ記事・PDF・動画・メモを一元管理するデジタルキュレーターアプリ。Next.js 15 (App Router) + Supabase + Zustand。

## コマンド

```bash
npm run dev        # 開発サーバー起動
npm run build      # プロダクションビルド
npm run lint       # ESLint 実行
npm run clean      # Next.js キャッシュ削除
npm run typecheck  # TypeScript 型チェック (tsc --noEmit)
npm run schema:check # Supabase/コードの既知不整合チェック
npm run pwa:check  # PWA manifest / SW / install UI の静的確認
npm run check      # typecheck + lint + schema:check + pwa:check
```

### PR 作成・マージ前の必須確認

```bash
npm run check   # TypeScript / lint / schema / PWA 静的確認
npm run build   # ビルド通過確認
```

これらが通れば実行時クラッシュの大半を事前検出できる。DB スキーマとの整合性は `scripts/check-schema-consistency.mjs` に既知の事故パターンを追加していく。

## 環境変数

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `OPENAI_API_KEY` | AI処理用（サーバーのみ。Vercel Environment Variablesに設定） |
| `SUPABASE_SERVICE_ROLE_KEY` | アカウント削除用（サーバーのみ。Vercel Environment Variablesに設定） |

ローカルの `.env.local` には原則として公開Supabase値だけを置く。本番の `OPENAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` はローカルファイルに置かず、VercelのEnvironment Variablesで管理する。コーディングエージェントは `.env*` の中身を表示しない。

## アーキテクチャ

### データフロー

```
UI コンポーネント
  ↓ useClipStore / useCollectionStore (Zustand + IndexedDB persist)
  ↓ Supabase クライアント (lib/supabase/client.ts)
  ↓ Supabase PostgreSQL (RLS 有効)
```

- **楽観的更新**: `toggleRead` / `toggleBookmark` / `updateClip` はまず Zustand ストアを即時更新し、Supabase 書き込み失敗時にロールバック
- **オフラインキャッシュ**: Zustand の `persist` ミドルウェアで IndexedDB（`idb-keyval`）にクリップとコレクションを保存（ストレージキー: `throw-in-clip-storage`）

### Supabase テーブル構成

`clips` — メインデータ（`content_type`: `article | video | image | document | note`）
`clip_tags` — クリップに紐づくタグ（M:N ではなく clip_id + name で管理）
`clip_collections` — クリップ↔コレクション中間テーブル
`collections` — コレクション
`history` — 閲覧履歴

全テーブルに RLS 有効。`auth.uid() = user_id` で自分のデータのみ操作可能。

pgvector 有効化済み（`supabase/01_pgvector.sql`）。クリップの `embedding` カラムに `text-embedding-3-small` のベクトルを格納。セマンティック検索は Supabase RPC `match_clips` を呼ぶ。

### 認証

`middleware.ts` — 全ルートで Supabase セッション検証。未ログイン → `/login` リダイレクト。Cookie `demo_bypass=true` でバイパス可能。

`components/auth-provider.tsx` — `useAuthStore`（Zustand）へユーザー状態を同期。`app/layout.tsx` でラップ。

`app/auth/callback/route.ts` — OAuth コールバック処理。

### AI 処理パイプライン

`lib/store.ts` の `processClipAI()`:
1. `POST /api/process-ai` を呼ぶ
2. サーバー側 `OPENAI_API_KEY` で要約・タグ・カテゴリ・key_points を JSON 生成
3. `text-embedding-3-small` でベクトル生成
4. Supabase に summary・embedding・clip_tags を書き込み

API ルート（サーバーサイド）:
- `POST /api/extract` — URL から HTML 取得 → 軽量メタ/本文抽出（SSRF 対策: DNS 解決とリダイレクト先検証）
- `POST /api/youtube` — YouTube 字幕取得（`youtube-transcript`）
- `POST /api/pdf` — PDF テキスト抽出（`pdf-parse`）
- `POST /api/ocr-image` — 画像OCR
- `POST /api/generate-report` — レポート生成

### 状態管理

`lib/store.ts` に `useClipStore`（クリップ CRUD + AI 処理）と `useCollectionStore`（コレクション CRUD）を集約。

`Clip` 型の `status` フィールド: `pending | extracting | enriching | ready | partial | failed`

DB の `content_type` と内部 `ClipType` のマッピング:
```
article → url,  video → video,  image → image,  document → pdf,  note → diary
```

### UI レイアウト

`components/shell/AppShell.tsx` がレイアウトを制御:
- モバイル: `BottomNavBar`（画面下部）
- PC/タブレット: `SidebarNav`（左固定サイドバー）
- `FloatingAddButton` — 右下の追加ボタン
- `TopNavBar` — モバイル上部バー

デザイン基準: Tailwind CSS v4、`rounded-[32px]` 等の大きな角丸、`backdrop-blur` による透明感、CSS Variables でカラーパレット定義（`app/globals.css`）。

## 未実装・注意点

- `addClip` はローカル Zustand のみ更新（Supabase への書き込みなし）— `/app/add/page.tsx` 側で別途 Supabase insert が必要
- CSV一括取り込みは `/api/batch-extract` で保存まで行い、成功分のAI整理は `/api/batch-process-ai` でチャンク処理する
- Xブックマーク取り込みは `.md` / `.zip` を `/api/import-x-bookmarks` で保存し、成功分のAI整理は `/api/batch-process-ai` でチャンク処理する
