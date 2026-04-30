'use client';

import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, Eye, EyeOff, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type AdminClip = {
  id: string;
  title: string;
  url?: string | null;
  content_type: string;
  is_global_search: boolean;
  is_hidden: boolean;
  summary?: string | null;
  category?: string | null;
  subcategory?: string | null;
  created_at: string;
  users?: { email?: string | null; display_name?: string | null } | { email?: string | null; display_name?: string | null }[] | null;
};

type Draft = Pick<AdminClip, 'title' | 'summary' | 'category' | 'subcategory' | 'is_global_search' | 'is_hidden'>;

function ownerLabel(clip: AdminClip) {
  const user = Array.isArray(clip.users) ? clip.users[0] : clip.users;
  return user?.display_name || user?.email || '不明';
}

export default function AdminClipsPage() {
  const [clips, setClips] = useState<AdminClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadClips = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/clips');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'クリップを取得できません。');
      setClips(data?.clips ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'クリップを取得できません。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClips();
  }, []);

  const startEdit = (clip: AdminClip) => {
    setEditingId(clip.id);
    setDraft({
      title: clip.title,
      summary: clip.summary ?? '',
      category: clip.category ?? '',
      subcategory: clip.subcategory ?? '',
      is_global_search: clip.is_global_search,
      is_hidden: clip.is_hidden,
    });
  };

  const patchClip = async (id: string, updates: Partial<Draft>) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/admin/clips', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '保存に失敗しました。');
      setClips(prev => prev.map(clip => clip.id === id ? { ...clip, ...data.clip } : clip));
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSavingId(null);
    }
  };

  const deleteClip = async (clip: AdminClip) => {
    if (deletingId) return;
    if (!window.confirm(`「${clip.title}」を完全削除しますか？保存状態、タグ、コメント、通報も削除されます。`)) return;

    setDeletingId(clip.id);
    try {
      const res = await fetch(`/api/admin/clips?id=${encodeURIComponent(clip.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '削除に失敗しました。');
      setClips(prev => prev.filter(item => item.id !== clip.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <Link href="/admin" className="brand-button-secondary">
          <ArrowLeft className="w-5 h-5" />
          管理ダッシュボードに戻る
        </Link>

        <div>
          <h1 className="brand-page-title">クリップ管理</h1>
          <p className="brand-page-kicker">公開状態、非表示、タイトル、要約を管理します。</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-outline" /></div>
        ) : error ? (
          <div className="brand-panel p-8 text-error">{error}</div>
        ) : clips.length === 0 ? (
          <div className="brand-panel p-8 text-on-surface-variant">クリップはありません。</div>
        ) : (
          <div className="space-y-3">
            {clips.map(clip => {
              const isEditing = editingId === clip.id && draft;
              const visible = clip.is_global_search && !clip.is_hidden;
              return (
                <section key={clip.id} className="brand-panel p-4 md:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      {isEditing ? (
                        <div className="grid gap-3">
                          <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                            タイトル
                            <input className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                            要約
                            <textarea className="min-h-24 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary" value={draft.summary ?? ''} onChange={e => setDraft({ ...draft, summary: e.target.value })} />
                          </label>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                              カテゴリ
                              <input className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary" value={draft.category ?? ''} onChange={e => setDraft({ ...draft, category: e.target.value })} />
                            </label>
                            <label className="grid gap-1 text-xs font-semibold text-on-surface-variant">
                              サブカテゴリ
                              <input className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary" value={draft.subcategory ?? ''} onChange={e => setDraft({ ...draft, subcategory: e.target.value })} />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm font-semibold text-on-surface">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={draft.is_global_search} onChange={e => setDraft({ ...draft, is_global_search: e.target.checked })} />
                              グローバルクリップとして公開
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={draft.is_hidden} onChange={e => setDraft({ ...draft, is_hidden: e.target.checked })} />
                              admin判断で非表示
                            </label>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="brand-chip">{clip.content_type}</span>
                            <span className={`brand-chip ${visible ? 'bg-success-container text-success' : 'bg-surface-container text-on-surface-variant'}`}>
                              {visible ? '公開表示中' : clip.is_hidden ? '非表示' : '非公開'}
                            </span>
                            <span className="text-xs text-on-surface-variant">{new Date(clip.created_at).toLocaleString('ja-JP')}</span>
                          </div>
                          <div>
                            <h2 className="brand-title-wrap text-base font-bold leading-snug text-on-surface">{clip.title}</h2>
                            <p className="mt-1 text-xs text-on-surface-variant">所有者: {ownerLabel(clip)}</p>
                            {clip.url && <p className="mt-1 truncate text-xs text-on-surface-variant">{clip.url}</p>}
                          </div>
                          <p className="line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{clip.summary || 'AI要約なし'}</p>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-72 lg:justify-end">
                      {isEditing ? (
                        <>
                          <button onClick={() => patchClip(clip.id, draft)} disabled={savingId === clip.id} className="brand-button-primary">
                            {savingId === clip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            保存
                          </button>
                          <button onClick={() => { setEditingId(null); setDraft(null); }} className="brand-button-secondary">
                            <X className="h-4 w-4" />
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => patchClip(clip.id, { is_hidden: !clip.is_hidden })} disabled={savingId === clip.id} className="brand-button-secondary">
                            {clip.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            {clip.is_hidden ? '表示' : '非表示'}
                          </button>
                          <button onClick={() => startEdit(clip)} className="brand-button-secondary">
                            <Pencil className="h-4 w-4" />
                            編集
                          </button>
                          <button onClick={() => deleteClip(clip)} disabled={deletingId === clip.id} className="brand-button-muted text-error hover:bg-error-container hover:text-error">
                            {deletingId === clip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            完全削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
