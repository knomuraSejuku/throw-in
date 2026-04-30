# Throw In - 未実装・未完了の要件

> 最終更新: 2026-04-30  
> 実装済み機能の詳細は `docs/tech-spec.md` / `CLAUDE.md` を参照。  
> タスク管理は `docs/BACKLOG.md` を唯一の正とする。

---

## 実装済み（参考）

以下はすでに本番稼働中。このファイルから削除した項目。

| 要件 | 実装場所 |
|------|---------|
| Web記事スクレイピング | `/api/extract` |
| PDF テキスト抽出 | `/api/pdf` |
| 画像 OCR | `/api/ocr-image` |
| YouTube 字幕取得 | `/api/youtube` |
| AI 要約・タグ・カテゴリ・key_points | `/api/process-ai` (OPENAI_API_KEY) |
| セマンティック検索 (pgvector) | `/api/process-ai` PUT + Supabase RPC `match_clips` |
| Supabase PostgreSQL 永続化 | `lib/store.ts` + RLS |
| コレクション管理 | `useCollectionStore` |
| 閲覧履歴 | `history` テーブル |
| Supabase Storage（画像・PDF） | `11_storage_schema.sql` |
| Google OAuth / メール認証 | Supabase Auth + `middleware.ts` |
| アカウント削除 | `/api/delete-account` |
| レポート / インサイト生成 | `/api/generate-report`, `/api/generate-insight` |
| ページネーション | `app/page.tsx` |
| RLS・SSRF 対策 | `supabase/*.sql`, `/api/extract` |
| サーバー側 API キー管理 | Vercel Environment Variables |

---

## 未実装・不完全な項目

### 高度な検索

- **本文全文検索**: `extracted_content` カラムへの全文検索は未対応。現状は `title.ilike` + `summary.ilike` のみ。PostgreSQL `tsvector` か Algolia 連携が必要。
  → BACKLOG: **K5**（AI検索との統合で検討）

### クリップ取得・抽出

- **X.com 投稿内リンク展開**: X.com の投稿本文中に含まれる URL の先を AI 整理に含める機能未実装。→ BACKLOG: **X2**
- **X.com 記事 URL 取得**: X.com の paywalled 記事 URL からコンテンツを取得する方法は未調査。→ BACKLOG: **X3**
- **URLクリップ詳細の原文保存**: Readability で抽出した原文の保存先・クライアントサイド化は未検討。→ BACKLOG: **I1**

### PWA

- **Web Share Target（iOS/Android）**: `manifest.json` に `share_target` 設定あり。スマホ Chrome での PWA インストールボタンが表示されない問題が未解決。→ BACKLOG: **K16**

### 外部サービス連携

- **Qiita / Zenn / YouTube 急上昇 Bot**: 外部サービスから定期的にコンテンツを自動クリップする Bot は未実装。→ BACKLOG: **K1**

### オフラインサポート

- **バックグラウンド同期**: IndexedDB キャッシュ（閲覧）は実装済みだが、オフライン中のメモ作成をオンライン復帰時に同期する Service Worker ロジックは未実装。

### アドミン機能

- **管理画面**: `02_admin_stats.sql` の RPC と `/api/health` エンドポイントのみ存在。ユーザー管理 UI や詳細な統計ダッシュボードは未実装。

### パフォーマンス

- **ジョブキュースケーラビリティ**: 現状は Zustand のインメモリ `processingJobs`。大量同時処理には Vercel Queues / Upstash 等の外部キューが必要（未実装）。
