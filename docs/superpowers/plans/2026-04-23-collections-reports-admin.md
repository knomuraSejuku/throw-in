# Collections・Reports・Admin 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コレクション機能・レポート機能・管理ダッシュボードをモックから実データ連携に昇格させる

**Architecture:** 各機能は独立したフェーズとして順次実装する。コレクション機能は既存の `useCollectionStore`（`lib/store.ts` 実装済み）を `app/collections/page.tsx` に接続し新規作成ダイアログを追加。レポート機能は `useClipStore` のクリップを期間フィルタで絞り込み OpenAI gpt-4o-mini に投げて Markdown レポートを生成・表示する。アドミンダッシュボードは Supabase RPC で集計データを取得してハードコード値を置き換える。

**Tech Stack:** Next.js 15 App Router, Zustand (`useClipStore` / `useCollectionStore`), Supabase (PostgreSQL + RPC), OpenAI gpt-4o-mini, Tailwind CSS v4, lucide-react, react-markdown

---

## Phase 1: コレクション機能

### Task 1: collections ページをストアに接続・一覧表示

**Files:**
- Modify: `app/collections/page.tsx`

- [ ] `'use client'` の下に必要な import を追加

```tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollectionStore } from '@/lib/store';
import { Folder, Loader2, Plus } from 'lucide-react';
```

- [ ] コンポーネント内に state とデータ取得を追加

```tsx
const { collections, fetchCollections, isLoading } = useCollectionStore();
const [showDialog, setShowDialog] = useState(false);

useEffect(() => { fetchCollections(); }, [fetchCollections]);
```

- [ ] JSX を以下に差し替え（空状態のボタンは後続タスクで接続、今は `onClick={() => setShowDialog(true)}` を付ける）

```tsx
return (
  <AppShell>
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-on-surface">コレクション</h1>
        {collections.length > 0 && (
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-transform shadow-primary"
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-outline" />
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
            <Folder className="w-10 h-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold text-on-surface">コレクションはまだありません。</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              複数のクリップをまとめて整理したり、プロジェクトごとに分類するためのフォルダを作成できます。
            </p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="px-8 py-3 bg-primary text-white rounded-full font-bold shadow-primary hover:scale-105 active:scale-95 transition-all"
          >
            コレクションを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map(col => (
            <Link
              key={col.id}
              href={`/?collection=${col.id}`}
              className="bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient hover:shadow-card-hover hover:-translate-y-1 transition-all group"
            >
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                <Folder className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-bold text-on-surface text-lg">{col.name}</h3>
              {col.description && (
                <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{col.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  </AppShell>
);
```

- [ ] `npm run dev` で `/collections` を開き、ストアに接続されていることを確認（初回は空状態が表示される）

- [ ] commit

```bash
git add app/collections/page.tsx
git commit -m "feat: connect collections page to useCollectionStore"
```

---

### Task 2: コレクション作成ダイアログ

**Files:**
- Create: `components/collections/CreateCollectionDialog.tsx`
- Modify: `app/collections/page.tsx`

- [ ] `components/collections/CreateCollectionDialog.tsx` を新規作成

```tsx
'use client';
import { useState } from 'react';
import { useCollectionStore } from '@/lib/store';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function CreateCollectionDialog({ onClose }: Props) {
  const { createCollection } = useCollectionStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    await createCollection(name.trim(), description.trim() || undefined);
    setIsSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="bg-surface rounded-[32px] p-8 w-full max-w-md shadow-2xl space-y-6"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">コレクションを作成</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="コレクション名"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <textarea
            placeholder="説明（任意）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || isSaving}
          className="w-full py-3 bg-primary text-white rounded-full font-bold disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          {isSaving ? '作成中...' : '作成する'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] `app/collections/page.tsx` に import を追加

```tsx
import { CreateCollectionDialog } from '@/components/collections/CreateCollectionDialog';
```

- [ ] `return` の JSX の末尾（`</AppShell>` の直前）にダイアログを追加

```tsx
{showDialog && <CreateCollectionDialog onClose={() => setShowDialog(false)} />}
```

- [ ] 動作確認: 「コレクションを作成」ボタン押下 → ダイアログ表示 → 名前入力 → 保存 → 一覧に追加されることを確認

- [ ] commit

```bash
git add components/collections/CreateCollectionDialog.tsx app/collections/page.tsx
git commit -m "feat: add create collection dialog"
```

---

### Task 3: ライブラリのコレクションフィルター名表示を修正

ライブラリページの `getPageTitle()` が `?collection=<id>` パラメータを処理しているが、IDをそのまま表示してしまう問題を修正する。

**Files:**
- Modify: `app/page.tsx`

- [ ] `LibraryContent` コンポーネント内の import に `useCollectionStore` を追加

```tsx
import { useClipStore, useCollectionStore } from '@/lib/store';
```

- [ ] コンポーネント内に store を追加

```tsx
const { collections } = useCollectionStore();
```

- [ ] `getPageTitle()` 関数の先頭に collection ケースを追加

```tsx
if (currentCollection) {
  const col = collections.find(c => c.id === currentCollection);
  return col ? col.name : 'コレクション';
}
```

- [ ] 動作確認: `/collections` でコレクションカードをクリック → ライブラリのタイトルにコレクション名が表示されることを確認

- [ ] commit

```bash
git add app/page.tsx
git commit -m "feat: show collection name in library header when filtering by collection"
```

---

## Phase 2: レポート機能

### Task 4: レポート生成ロジックの実装

**Files:**
- Modify: `app/reports/page.tsx`

- [ ] ファイル冒頭の import を以下に差し替え

```tsx
'use client';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { FileBarChart2, Loader2 } from 'lucide-react';
import { useClipStore } from '@/lib/store';
import ReactMarkdown from 'react-markdown';
```

- [ ] コンポーネント内に state とデータ取得を追加

```tsx
const { clips, fetchClips } = useClipStore();
const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
const [report, setReport] = useState<string | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => { fetchClips(); }, [fetchClips]);
```

- [ ] 期間フィルター関数を追加

```tsx
const getPeriodClips = () => {
  const now = Date.now();
  const ms: Record<string, number> = {
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
    year: 31_536_000_000,
  };
  return clips.filter(c => now - c.timestamp < ms[selectedPeriod]);
};
```

- [ ] レポート生成関数を追加

```tsx
const handleGenerate = async () => {
  const openAiKey = localStorage.getItem('openai_api_key');
  if (!openAiKey) {
    setError('OpenAI APIキーが設定されていません。設定画面から登録してください。');
    return;
  }
  const periodClips = getPeriodClips();
  if (periodClips.length === 0) {
    setError('この期間に保存されたクリップがありません。');
    return;
  }
  setIsGenerating(true);
  setError(null);
  setReport(null);

  const periodLabel: Record<string, string> = { day: '今日', week: '今週', month: '今月', year: '今年' };
  const label = periodLabel[selectedPeriod];
  const clipSummaries = periodClips
    .map(c =>
      `【${c.typeLabel}】${c.title}` +
      (c.summary ? `\n要約: ${c.summary}` : '') +
      (c.tags?.length ? `\nタグ: ${c.tags.join(', ')}` : '')
    )
    .join('\n\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `あなたはユーザーの知的活動をサポートするキュレーターアシスタントです。ユーザーが${label}保存したコンテンツの一覧を受け取り、以下の構成でMarkdown形式のレポートを生成してください。\n\n## レポート構成\n1. **概要サマリー** — ${label}の保存傾向を2〜3文で\n2. **主要テーマ** — 繰り返し現れるトピックやキーワード\n3. **注目コンテンツ** — 特に重要そうな記事・動画を2〜3件ピックアップして理由とともに紹介\n4. **学びのポイント** — この期間から得られる洞察や次のアクション提案\n\n日本語で記述してください。`,
          },
          {
            role: 'user',
            content: `${label}のクリップ一覧（${periodClips.length}件）:\n\n${clipSummaries}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    setReport(data.choices[0].message.content);
  } catch (err: any) {
    setError(`生成に失敗しました: ${err.message}`);
  } finally {
    setIsGenerating(false);
  }
};
```

- [ ] JSX を差し替え（既存の UI 構造を維持しつつ state を接続する）

```tsx
const periods = [
  { key: 'day', label: '日報' },
  { key: 'week', label: '週報' },
  { key: 'month', label: '月報' },
  { key: 'year', label: '年報' },
] as const;

return (
  <AppShell>
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">

      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
          <FileBarChart2 className="w-10 h-10" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="text-3xl font-bold text-on-surface">レポート</h1>
          <p className="text-on-surface-variant leading-relaxed text-sm">
            一定期間に保存した情報を振り返るためのサマリーを作成します。日報、週報、月報を生成して、学びを定着させましょう。
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient max-w-lg w-full mx-auto space-y-6">
        <div className="flex gap-2">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setSelectedPeriod(key); setReport(null); setError(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-colors ${
                selectedPeriod === key
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-4 text-white bg-primary rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
          ) : '生成する'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto bg-error/10 text-error p-4 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="max-w-2xl mx-auto bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient prose prose-sm max-w-none text-on-surface">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      )}

    </div>
  </AppShell>
);
```

- [ ] 動作確認: OpenAI キー設定済みの状態で「生成する」を押し、Markdown レポートが表示されることを確認

- [ ] commit

```bash
git add app/reports/page.tsx
git commit -m "feat: implement report generation with OpenAI API"
```

---

## Phase 3: アドミンダッシュボード

### Task 5: Supabase 集計 RPC の追加

**Files:**
- Create: `supabase/02_admin_stats.sql`

- [ ] ファイルを作成

```sql
-- ユーザー別統計取得用 RPC
create or replace function get_user_stats(p_user_id uuid)
returns json
language sql
security definer
as $$
  select json_build_object(
    'total_clips',          (select count(*) from clips where user_id = p_user_id),
    'unread_clips',         (select count(*) from clips where user_id = p_user_id and is_read = false),
    'bookmarked_clips',     (select count(*) from clips where user_id = p_user_id and is_bookmarked = true),
    'clips_without_summary',(select count(*) from clips where user_id = p_user_id and summary is null),
    'recent_clips_7d',      (select count(*) from clips where user_id = p_user_id and created_at > now() - interval '7 days'),
    'total_tags',           (select count(*) from clip_tags where user_id = p_user_id),
    'total_collections',    (select count(*) from collections where user_id = p_user_id),
    'clips_by_type', (
      select coalesce(json_object_agg(content_type, cnt), '{}'::json)
      from (
        select content_type, count(*) as cnt
        from clips
        where user_id = p_user_id
        group by content_type
      ) t
    )
  );
$$;
```

- [ ] Supabase ダッシュボード → SQL Editor でこの SQL を実行する

- [ ] commit

```bash
git add supabase/02_admin_stats.sql
git commit -m "feat: add get_user_stats RPC for admin dashboard"
```

---

### Task 6: アドミンページをリアルデータに接続

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] import を差し替え

```tsx
'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Activity, Database, LayoutTemplate, ShieldAlert, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useClipStore } from '@/lib/store';
```

- [ ] 型定義と state をコンポーネントに追加

```tsx
interface UserStats {
  total_clips: number;
  unread_clips: number;
  bookmarked_clips: number;
  clips_without_summary: number;
  recent_clips_7d: number;
  total_tags: number;
  total_collections: number;
  clips_by_type: Record<string, number>;
}

const [stats, setStats] = useState<UserStats | null>(null);
const [isLoading, setIsLoading] = useState(true);
const { processingJobs } = useClipStore();

useEffect(() => {
  const load = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsLoading(false); return; }
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: session.user.id });
    if (!error && data) setStats(data as UserStats);
    setIsLoading(false);
  };
  load();
}, []);

const failedJobs = Object.values(processingJobs).filter(s => s === 'failed').length;
const activeJobs = Object.values(processingJobs).filter(s => s === 'enriching' || s === 'extracting').length;
```

- [ ] メトリクスカード4枚の数値をリアルデータに差し替え

```tsx
{/* カード1: 処理中ジョブ */}
<div className="bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient">
  <div className="text-outline text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
    処理中ジョブ
    <Activity className="w-4 h-4 text-primary" />
  </div>
  <div className="text-4xl font-bold text-on-surface">
    {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : activeJobs}
  </div>
  <div className="text-xs text-on-surface-variant font-medium mt-2">現セッション</div>
</div>

{/* カード2: AI未処理クリップ */}
<div className="bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient">
  <div className="text-outline text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
    AI未処理
    <LayoutTemplate className="w-4 h-4 text-tertiary" />
  </div>
  <div className="text-4xl font-bold text-on-surface">
    {isLoading ? '...' : (stats?.clips_without_summary ?? 0)}
  </div>
  <div className="text-xs text-on-surface-variant font-medium mt-2">要約なしのクリップ</div>
</div>

{/* カード3: 処理失敗 */}
<div className="bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient">
  <div className="text-outline text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
    処理失敗
    <ShieldAlert className="w-4 h-4 text-error" />
  </div>
  <div className="text-4xl font-bold text-on-surface">
    {isLoading ? '...' : failedJobs}
  </div>
  <div className="text-xs text-on-surface-variant font-medium mt-2">現セッション</div>
</div>

{/* カード4: 直近7日 */}
<div className="bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient">
  <div className="text-outline text-xs font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
    直近7日間
    <Database className="w-4 h-4 text-secondary" />
  </div>
  <div className="text-4xl font-bold text-on-surface">
    {isLoading ? '...' : (stats?.recent_clips_7d ?? 0)}
  </div>
  <div className="text-xs text-on-surface-variant font-medium mt-2">新規保存クリップ</div>
</div>
```

- [ ] 既存の3カードナビゲーション下に統計パネルを追加

```tsx
{stats && (
  <div className="bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient">
    <h3 className="text-lg font-bold text-on-surface mb-6">クリップ内訳</h3>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {[
        { key: 'article',  label: '記事',    color: 'text-tertiary  bg-tertiary/10' },
        { key: 'video',    label: '動画',    color: 'text-secondary bg-secondary/10' },
        { key: 'image',    label: '画像',    color: 'text-primary   bg-primary/10' },
        { key: 'document', label: 'PDF',     color: 'text-error     bg-error/10' },
        { key: 'note',     label: 'メモ',    color: 'text-outline   bg-surface-container-high' },
      ].map(({ key, label, color }) => (
        <div key={key} className={`p-4 rounded-2xl ${color} text-center`}>
          <div className="text-2xl font-bold">{stats.clips_by_type?.[key] ?? 0}</div>
          <div className="text-xs font-bold mt-1">{label}</div>
        </div>
      ))}
    </div>
    <div className="pt-6 border-t border-outline-variant/20 grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="text-2xl font-bold text-on-surface">{stats.total_clips}</div>
        <div className="text-xs text-on-surface-variant mt-1">総クリップ数</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-on-surface">{stats.total_tags}</div>
        <div className="text-xs text-on-surface-variant mt-1">総タグ数</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-on-surface">{stats.total_collections}</div>
        <div className="text-xs text-on-surface-variant mt-1">コレクション数</div>
      </div>
    </div>
  </div>
)}
```

- [ ] 動作確認: `/admin` でリアルな数値が表示されることを確認

- [ ] commit

```bash
git add app/admin/page.tsx
git commit -m "feat: connect admin dashboard to real Supabase stats via RPC"
```
