## I1: URLクリップのreadability原文保存先 + クライアントサイド化検討（2026-04-30）

### 調査結果

**現状のフロー:**
1. `POST /api/extract` — カスタム `extractMainText()` でHTML→テキスト変換（最大30,000文字）
2. `app/add/page.tsx:305` — `extracted_content: extractedData?.body` としてSupabaseに保存
3. `lib/store.ts:282` — Zustandで `body: d.extracted_content` にマップ
4. 詳細画面で `clip.body` として表示

**原文保存先:** `clips.extracted_content` カラム（既に永続化済み）

**注意:** `@mozilla/readability` はインストール済みだが未使用。現状は独自のシンプルな実装。

### クライアントサイド化の評価

| | サーバーサイド（現状） | クライアントサイド |
|---|---|---|
| CORS | ✅ サーバーがプロキシ | ❌ 大半のサイトでブロック |
| SSRF対策 | 既実装（DNS検証） | N/A |
| 抽出精度 | 低（独自実装） | 高（Readability） |
| レイテンシ | サーバーRTT有り | — |

**結論:** クライアントサイド化はCORSにより実用不可。サーバーサイドのままにする。

### 推奨アクション（ユーザー確認待ち）

現状の `extractMainText()` を `@mozilla/readability` + `jsdom` に差し替えることで抽出精度を向上できる。
- 対象ファイル: `app/api/extract/route.ts`
- `@mozilla/readability` と `jsdom` は両方インストール済み
- 変更スコープは `/api/extract` 内のみ、他ファイル変更なし

**実装してよいか確認してください。**
