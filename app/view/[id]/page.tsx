'use client';

import { use, useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, ExternalLink, Clock, Hash, Tag, Loader2, BookmarkPlus, Check, Pencil, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { useAuthStore } from '@/lib/auth-store';
import { CATEGORY_TAXONOMY } from '@/lib/store';
import { CommentSection } from '@/components/comments/CommentSection';

const TYPE_LABELS: Record<string, string> = {
  url: '記事', video: '動画', image: '画像', pdf: 'ドキュメント', diary: '日記・メモ',
};

interface PublicClip {
  id: string;
  title: string;
  summary?: string | null;
  keyPoints?: string | null;
  url?: string | null;
  domain?: string | null;
  thumbnail?: string | null;
  type: string;
  category?: string | null;
  subcategory?: string | null;
  date: string;
  tags?: string[];
  userId: string;
  displayName?: string | null;
  avatarEmoji?: string | null;
}

export default function PublicClipViewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const user = useAuthStore(s => s.user);
  const [clip, setClip] = useState<PublicClip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const metaRef = useRef<HTMLDivElement>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editSubcategory, setEditSubcategory] = useState<string>('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    fetch(`/api/public-clip/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        setClip(data.clip);
        setEditCategory(data.clip.category ?? '');
        setEditSubcategory(data.clip.subcategory ?? '');
        setEditTags(data.clip.tags ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const el = metaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyHeader(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [clip?.id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-outline" />
        </div>
      </AppShell>
    );
  }

  if (notFound || !clip) {
    return (
      <AppShell>
        <div className="flex flex-col h-screen items-center justify-center gap-4">
          <p className="text-xl font-bold text-on-surface">クリップが見つかりません。</p>
          <button onClick={() => router.back()} className="text-primary hover:underline">戻る</button>
        </div>
      </AppShell>
    );
  }

  const typeLabel = TYPE_LABELS[clip.type] ?? clip.type;
  const canSave = user && user.id !== clip.userId;
  const isOwner = user?.id === clip.userId;

  async function handleSave() {
    if (!canSave || saving || saved) return;
    setSaving(true);
    const res = await fetch('/api/save-clip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId: id }),
    });
    setSaving(false);
    if (res.ok || res.status === 409) setSaved(true);
  }

  async function handleSaveMeta() {
    if (!clip) return;
    setSavingMeta(true);
    const res = await fetch(`/api/clips/${clip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: editCategory || null, subcategory: editSubcategory || null, tags: editTags }),
    });
    setSavingMeta(false);
    if (res.ok) {
      setClip(prev => prev ? { ...prev, category: editCategory || null, subcategory: editSubcategory || null, tags: editTags } : prev);
      setEditingMeta(false);
    }
  }

  return (
    <AppShell>
      {/* Sticky sub-header */}
      <div
        className={clsx(
          'fixed top-14 left-0 right-0 lg:left-72 z-20 transition-all duration-200',
          showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
      >
        <div className="bg-background/90 backdrop-blur-xl border-b border-outline-variant/15 px-4 md:px-8 pt-4 pb-3 md:py-3 max-w-3xl mx-auto lg:max-w-none lg:mx-0 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <button
                onClick={() => router.back()}
                className="p-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                title="戻る"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0',
                clip.type === 'url' && 'bg-tertiary/10 text-tertiary',
                clip.type === 'pdf' && 'bg-primary/10 text-primary',
                clip.type === 'video' && 'bg-secondary/10 text-secondary',
                (clip.type === 'diary' || clip.type === 'image') && 'bg-surface-container-highest text-on-surface-variant',
              )}>
                {typeLabel}
              </span>
              <span className="text-[11px] text-on-surface-variant shrink-0">{clip.date}</span>
              {clip.category && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold shrink-0">
                  <Tag className="w-2.5 h-2.5" />
                  {clip.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canSave && (
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={clsx(
                    'p-1.5 rounded-full transition-colors',
                    saved ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  )}
                  title={saved ? '保存済み' : '保存する'}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                </button>
              )}
              {clip.url && (
                <a href={clip.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors" title="原典を開く">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          <p className="text-sm font-bold text-on-surface truncate mt-1 pr-4">{clip.title}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <div className="flex items-center gap-2">
            {canSave && (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  saved
                    ? "bg-primary/10 text-primary cursor-default"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <BookmarkPlus className="w-4 h-4" />
                )}
                {saved ? '保存済み' : '保存する'}
              </button>
            )}
            {clip.url && (
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                原典を開く
              </a>
            )}
          </div>
        </div>

        {clip.thumbnail && (
          <div className="w-full aspect-video md:aspect-[21/9] rounded-[32px] overflow-hidden relative mb-8 shadow-ambient border border-outline-variant/10">
            <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover" />
          </div>
        )}

        <div ref={metaRef} className="flex flex-wrap items-center gap-3 mb-4">
          <span className={clsx(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            clip.type === 'url' && "bg-tertiary/10 text-tertiary",
            clip.type === 'pdf' && "bg-primary/10 text-primary",
            clip.type === 'video' && "bg-secondary/10 text-secondary",
            (clip.type === 'diary' || clip.type === 'image') && "bg-surface-container-highest text-on-surface-variant",
          )}>{typeLabel}</span>
          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <Clock className="w-4 h-4" />
            {clip.date}
          </span>
          {clip.domain && (
            <span className="text-xs text-on-surface-variant">{clip.domain}</span>
          )}
          {clip.userId && (
            <Link
              href={`/user/${clip.userId}`}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="text-base leading-none">{clip.avatarEmoji ?? '🙂'}</span>
              <span>{clip.displayName ?? '匿名'}</span>
            </Link>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-snug mb-6">
          {clip.title}
        </h1>

        {/* Category / Tags — display or edit */}
        {isOwner && !editingMeta ? (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {clip.category && (
                <span className="flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-xs font-bold">
                  <Tag className="w-3 h-3" />
                  {clip.category}
                </span>
              )}
              {clip.subcategory && (
                <span className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/20 rounded-full text-xs font-medium">
                  {clip.subcategory}
                </span>
              )}
              {clip.tags?.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => router.push(`/?tag=${encodeURIComponent(t)}`)}
                  className="flex items-center gap-1 px-3 py-1 bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-full text-xs font-bold font-mono hover:bg-surface-container-high transition-colors"
                >
                  <Hash className="w-3 h-3 text-primary" />
                  {t}
                </button>
              ))}
              <button
                onClick={() => setEditingMeta(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs text-on-surface-variant hover:bg-surface-container transition-colors border border-outline-variant/20"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </div>
        ) : isOwner && editingMeta ? (
          <div className="mb-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-4">
            {/* Category select */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">カテゴリ</label>
                <select
                  value={editCategory}
                  onChange={e => { setEditCategory(e.target.value); setEditSubcategory(''); }}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">未分類</option>
                  {Object.keys(CATEGORY_TAXONOMY).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">サブカテゴリ</label>
                <select
                  value={editSubcategory}
                  onChange={e => setEditSubcategory(e.target.value)}
                  disabled={!editCategory}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  <option value="">なし</option>
                  {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">タグ</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-surface-container text-on-surface border border-outline-variant/30 rounded-full text-xs font-mono">
                    #{t}
                    <button onClick={() => setEditTags(prev => prev.filter(x => x !== t))} className="ml-0.5 hover:text-error">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={e => setEditTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && editTagInput.trim()) {
                      e.preventDefault();
                      const tag = editTagInput.trim().replace(/,/g, '');
                      if (tag && !editTags.includes(tag) && editTags.length < 10) {
                        setEditTags(prev => [...prev, tag]);
                      }
                      setEditTagInput('');
                    }
                  }}
                  placeholder="タグを入力してEnter"
                  className="flex-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditingMeta(false); setEditCategory(clip.category ?? ''); setEditSubcategory(clip.subcategory ?? ''); setEditTags(clip.tags ?? []); }}
                className="px-4 py-1.5 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveMeta}
                disabled={savingMeta}
                className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingMeta ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {(clip.category || clip.subcategory) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {clip.category && (
                  <span className="flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-xs font-bold">
                    <Tag className="w-3 h-3" />
                    {clip.category}
                  </span>
                )}
                {clip.subcategory && (
                  <span className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/20 rounded-full text-xs font-medium">
                    {clip.subcategory}
                  </span>
                )}
              </div>
            )}
            {clip.tags && clip.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {clip.tags.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => router.push(`/?tag=${encodeURIComponent(t)}`)}
                    className="flex items-center gap-1 px-3 py-1 bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-full text-xs font-bold font-mono hover:bg-surface-container-high transition-colors"
                  >
                    <Hash className="w-3 h-3 text-primary" />
                    {t}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {clip.summary && (
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl relative mb-6">
            <div className="absolute -top-3 left-6 bg-background px-2 text-[10px] font-bold text-primary tracking-widest uppercase">AI Summary</div>
            <p className="text-on-surface leading-relaxed text-sm md:text-base">{clip.summary}</p>
          </div>
        )}

        {clip.keyPoints && (
          <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-2xl relative">
            <div className="absolute -top-3 left-6 bg-background px-2 text-[10px] font-bold text-secondary tracking-widest uppercase">Key Points</div>
            <div className="prose-body text-sm">
              <ReactMarkdown>{clip.keyPoints}</ReactMarkdown>
            </div>
          </div>
        )}

        <CommentSection clipId={id} />
      </div>
    </AppShell>
  );
}
