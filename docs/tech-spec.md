# Throw In — 技術仕様

## スタック

| レイヤー | 技術 |
|--------|------|
| フロントエンド | Next.js 15 (App Router) + React 19 |
| スタイリング | Tailwind CSS v4 + CSS Variables (Material Design 3 カラーシステム) |
| 状態管理 | Zustand 5 + IndexedDB (idb-keyval) による永続化 |
| バックエンド | Supabase (PostgreSQL + Auth + Storage) |
| AI | OpenAI gpt-4o-mini (要約/タグ/カテゴリ) + text-embedding-3-small (ベクトル検索) |
| 言語 | TypeScript 5 (strict mode) |

## ディレクトリ構成

```
app/
  api/          # Route Handlers (extract, youtube, pdf, process-ai, etc.)
  (pages)/      # 各ページ (/, /search, /bookmarks, /settings, ...)
components/
  shell/        # AppShell, TopNavBar, SidebarNav, BottomNavBar
lib/
  store.ts      # Zustand ストア (useClipStore, useCollectionStore)
  supabase/     # client.ts / server.ts
middleware.ts   # 認証チェック・ルートガード
supabase/       # SQLマイグレーション
```

## データモデル

### clips (メインテーブル)

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | PK |
| user_id | uuid | 所有者 (RLS) |
| title | text | タイトル |
| url | text | 元URL |
| content_type | text | article / video / image / document / note |
| summary | text | AI生成要約 |
| extracted_content | text | 本文テキスト |
| key_points | text | AI生成キーポイント (Markdown) |
| category / subcategory | text | カテゴリ分類 |
| embedding | vector(1536) | セマンティック検索用ベクトル |
| is_bookmarked / is_read | bool | 状態フラグ |
| is_global_search | bool | 公開検索に表示するか |
| saved_from_clip_id | uuid | 他ユーザーのクリップを保存した場合の参照先 |

### その他テーブル

- `clip_tags` — クリップに紐づくタグ
- `clip_collections` / `collections` — コレクション
- `history` — 閲覧履歴
- `follows` — フォロー関係
- `clip_comments` / `comment_likes` — コメント・いいね
- `notifications` — 通知
- `insights` — AI生成インサイト記事

全テーブルに RLS 有効。`auth.uid() = user_id` で自分のデータのみ操作可能。

## API ルート一覧

| エンドポイント | メソッド | 役割 |
|--------------|--------|------|
| /api/extract | POST | URL → HTML取得・本文抽出 (SSRF対策あり) |
| /api/youtube | POST | YouTube字幕取得 |
| /api/pdf | POST | PDFテキスト抽出 |
| /api/process-ai | POST | AI要約・タグ・埋め込み生成 |
| /api/process-ai | PUT | セマンティック検索 |
| /api/process-ai | PATCH | テキスト翻訳 |
| /api/search | GET | グローバル検索 |
| /api/save-clip | POST | 他ユーザーのクリップを保存 |
| /api/follow | GET/POST/DELETE | フォロー操作 |
| /api/comments | GET/POST | コメント取得・投稿・いいね・削除 |
| /api/notifications | GET/POST | 通知取得・既読化 |
| /api/generate-insight | GET/POST | AIインサイト生成・取得 |
| /api/generate-report | POST | AIレポート生成 |
| /api/ocr-image | POST | 画像OCR |
| /api/delete-account | POST | アカウント削除 (サービスロール使用) |

## 認証

- Supabase Auth (Cookie ベース)
- `middleware.ts` で全ルートを保護、未ログイン → `/login` リダイレクト
- `demo_bypass=true` Cookie でバイパス可能
- パブリックルート: `/login`, `/search`, `/view`, `/user`, `/privacy`, `/changelog`

## AI パイプライン

```
コンテンツ取得 (extract/youtube/pdf)
  → OpenAI gpt-4o-mini で JSON 生成 (summary, tags, category, key_points)
  → text-embedding-3-small でベクトル生成 (1536次元)
  → Supabase に保存
```

- OpenAI キーはサーバー側 `OPENAI_API_KEY` のみを使用し、ブラウザ・`localStorage` には保存しない
- セマンティック検索: Supabase RPC `match_clips` (コサイン類似度 ≥ 0.5、上位20件)

## 状態管理

- `useClipStore` — クリップ CRUD + AI処理 + 楽観的更新
- `useCollectionStore` — コレクション CRUD
- IndexedDB に永続化 (ストレージキー: `throw-in-clip-storage`)
- Clip.status: `pending → extracting → enriching → ready / partial / failed`

## 環境変数

| 変数 | 用途 |
|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 匿名キー |
| SUPABASE_SERVICE_ROLE_KEY | アカウント削除用 (サーバーのみ) |
| OPENAI_API_KEY | AI処理用 (サーバーのみ) |
| TRENDING_BOT_SECRET | ニュースBot取り込みAPI保護用 (サーバーのみ) |
| TRENDING_BOT_USER_ID | ニュースBotとして保存する既存ユーザーID |
