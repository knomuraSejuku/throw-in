'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Users, FileText, Loader2, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/auth-store';
import { createClient } from '@/lib/supabase/client';

const PAGE_SIZE = 12;

const TYPE_LABELS: Record<string, string> = {
  url: '記事', video: '動画', image: '画像', pdf: 'ドキュメント', diary: '日記・メモ',
};

interface DisplayClip {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  domain?: string | null;
  thumbnail?: string | null;
  type: string;
  typeLabel: string;
  date: string;
  createdAt: string;
  tags?: string[];
  category?: string | null;
  subcategory?: string | null;
  userId?: string | null;
  displayName?: string | null;
  avatarEmoji?: string | null;
}

export default function FollowingPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [clips, setClips] = useState<DisplayClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [followCount, setFollowCount] = useState<number | null>(null);

  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);

    if (user) {
      createClient()
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', user.id)
        .then(({ count }) => setFollowCount(count ?? 0));
    }

    fetch('/api/search?following=true&limit=200')
      .then(r => r.json())
      .then(data => {
        setClips((data.clips ?? []).map((c: any) => ({
          ...c,
          typeLabel: TYPE_LABELS[c.type] ?? c.type,
          createdAt: c.createdAt ?? '',
        })));
      })
      .catch(() => setClips([]))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const followedUsers = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; emoji: string }>();
    clips.forEach(c => {
      if (c.userId && !seen.has(c.userId))
        seen.set(c.userId, { id: c.userId, name: c.displayName ?? '匿名', emoji: c.avatarEmoji ?? '🙂' });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [clips]);

  const categories = useMemo(
    () => [...new Set(clips.map(c => c.category).filter(Boolean))].sort() as string[],
    [clips]
  );
  const subcategories = useMemo(() => {
    const base = filterCategory ? clips.filter(c => c.category === filterCategory) : clips;
    return [...new Set(base.map(c => c.subcategory).filter(Boolean))].sort() as string[];
  }, [clips, filterCategory]);

  const filteredClips = useMemo(() => {
    let r = clips;
    if (filterUser) r = r.filter(c => c.userId === filterUser);
    if (filterCategory) r = r.filter(c => c.category === filterCategory);
    if (filterSubcategory) r = r.filter(c => c.subcategory === filterSubcategory);
    if (filterTag) {
      const t = filterTag.toLowerCase();
      r = r.filter(c => c.tags?.some(tag => tag.toLowerCase().includes(t)));
    }
    if (filterQ) {
      const q = filterQ.toLowerCase();
      r = r.filter(c => c.title.toLowerCase().includes(q) || (c.summary ?? '').toLowerCase().includes(q));
    }
    if (filterFrom) r = r.filter(c => c.createdAt >= filterFrom);
    if (filterTo) r = r.filter(c => c.createdAt <= filterTo + 'T23:59:59');
    return r;
  }, [clips, filterUser, filterCategory, filterSubcategory, filterTag, filterQ, filterFrom, filterTo]);

  const hasFilter = !!(filterUser || filterCategory || filterSubcategory || filterTag || filterQ || filterFrom || filterTo);

  const clearFilters = () => {
    setFilterUser(''); setFilterCategory(''); setFilterSubcategory('');
    setFilterTag(''); setFilterQ(''); setFilterFrom(''); setFilterTo('');
  };

  useEffect(() => { setPage(1); }, [filterUser, filterCategory, filterSubcategory, filterTag, filterQ, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil(filteredClips.length / PAGE_SIZE));
  const paged = filteredClips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 pb-20 space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-on-secondary" />
          </div>
          <div>
            <h1 className="brand-page-title">フォロー中</h1>
            <p className="brand-page-kicker !text-xs">
              {followCount !== null ? `${followCount}人をフォロー中` : 'フォロー中のユーザーの公開クリップ'}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-surface-container-low rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* ユーザー名 */}
            <select
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); setFilterCategory(''); setFilterSubcategory(''); }}
              className="flex-1 min-w-[140px] text-sm bg-surface-container rounded-xl px-3 py-2 text-on-surface border-0 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">すべてのユーザー</option>
              {followedUsers.map(u => (
                <option key={u.id} value={u.id}>{u.emoji} {u.name}</option>
              ))}
            </select>

            {/* カテゴリ */}
            <select
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setFilterSubcategory(''); }}
              className="flex-1 min-w-[120px] text-sm bg-surface-container rounded-xl px-3 py-2 text-on-surface border-0 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">すべてのカテゴリ</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* サブカテゴリ */}
            {subcategories.length > 0 && (
              <select
                value={filterSubcategory}
                onChange={e => setFilterSubcategory(e.target.value)}
                className="flex-1 min-w-[120px] text-sm bg-surface-container rounded-xl px-3 py-2 text-on-surface border-0 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">すべてのサブカテゴリ</option>
                {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* フリーワード */}
            <div className="flex-1 min-w-[160px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
              <input
                type="text"
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
                placeholder="タイトル・要約を検索"
                className="w-full text-sm bg-surface-container rounded-xl pl-8 pr-3 py-2 text-on-surface placeholder:text-outline border-0 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* タグ */}
            <div className="flex-1 min-w-[120px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-outline">#</span>
              <input
                type="text"
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                placeholder="タグで絞り込み"
                className="w-full text-sm bg-surface-container rounded-xl pl-6 pr-3 py-2 text-on-surface placeholder:text-outline border-0 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 日付範囲 */}
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="text-sm bg-surface-container rounded-xl px-3 py-2 text-on-surface border-0 outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="text-sm bg-surface-container rounded-xl px-3 py-2 text-on-surface border-0 outline-none focus:ring-1 focus:ring-primary"
            />

            {hasFilter && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-outline hover:text-on-surface px-3 py-2 bg-surface-container rounded-xl transition-colors"
              >
                <X className="w-3 h-3" />
                クリア
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-outline" />
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-on-surface-variant text-sm">
              {hasFilter ? '条件に合うクリップが見つかりませんでした。' : 'フォロー中のユーザーの公開クリップはありません。'}
            </p>
            {!hasFilter && (
              <Link href="/search" className="text-primary text-sm hover:underline">
                ユーザーを探す →
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">
              {filteredClips.length}件{hasFilter && clips.length !== filteredClips.length && ` / ${clips.length}件中`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paged.map(clip => {
                const isOwnClip = user?.id === clip.userId;
                const href = isOwnClip ? `/clip/${clip.id}` : `/view/${clip.id}`;
                return (
                  <Link
                    href={href}
                    key={clip.id}
                    className="group bg-surface-container-lowest rounded-[32px] overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    {clip.thumbnail ? (
                      <div className="aspect-video relative overflow-hidden bg-surface-container-high">
                        <Image src={clip.thumbnail} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute top-4 left-4">
                          <span className={clsx(
                            "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-white",
                            clip.type === 'url' ? "bg-tertiary" : clip.type === 'video' ? "bg-secondary" : "bg-primary"
                          )}>{clip.typeLabel}</span>
                        </div>
                      </div>
                    ) : clip.type === 'pdf' ? (
                      <div className="p-4 bg-surface-container-high/50 flex items-center gap-3">
                        <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                        <div className="text-xs font-bold text-on-surface truncate">{clip.title}</div>
                      </div>
                    ) : null}

                    <div className="p-5 flex-1 flex flex-col space-y-2">
                      {!clip.thumbnail && (
                        <span className={clsx(
                          "self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                          clip.type === 'pdf' && "bg-primary/10 text-primary",
                          clip.type === 'video' && "bg-secondary/10 text-secondary",
                          clip.type === 'diary' && "bg-outline/10 text-outline"
                        )}>{clip.typeLabel}</span>
                      )}
                      <h3 className="text-sm font-bold text-on-surface line-clamp-2 leading-snug">{clip.title}</h3>
                      {clip.summary && (
                        <p className="text-on-surface-variant text-xs line-clamp-2 leading-relaxed">{clip.summary}</p>
                      )}
                      {(clip.category || clip.subcategory) && (
                        <div className="flex items-center gap-1 text-[10px] text-outline">
                          {clip.category && <span>{clip.category}</span>}
                          {clip.category && clip.subcategory && <span>›</span>}
                          {clip.subcategory && <span>{clip.subcategory}</span>}
                        </div>
                      )}
                      <div className="flex-1" />
                      {clip.tags && clip.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {clip.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                        <span className="text-[10px] text-outline">{clip.date}</span>
                        {clip.userId && (
                          <Link
                            href={`/user/${clip.userId}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                          >
                            <span className="text-sm leading-none">{clip.avatarEmoji ?? '🙂'}</span>
                            <span className="text-[10px] text-outline truncate max-w-[60px]">{clip.displayName ?? '匿名'}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, page - 3), Math.min(totalPages, page + 2)
                ).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
                      n === page ? "bg-primary text-white" : "bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
