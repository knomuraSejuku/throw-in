'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Search as SearchIcon, FileText, Loader2, Globe, ArrowDownUp, Clock, Tag, X, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { useClipStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';

const TYPE_FILTERS = [
  { key: 'all',      label: 'すべて' },
  { key: 'url',      label: '記事' },
  { key: 'video',    label: '動画' },
  { key: 'image',    label: '画像' },
  { key: 'pdf',      label: 'ドキュメント' },
  { key: 'diary',    label: '日記・メモ' },
  { key: 'bookmark', label: 'ブックマーク' },
] as const;

const PERIOD_FILTERS = [
  { key: 'all',   label: '全期間',    ms: 0 },
  { key: 'day',   label: '24時間以内', ms: 86_400_000 },
  { key: 'week',  label: '今週',      ms: 604_800_000 },
  { key: 'month', label: '今月',      ms: 2_592_000_000 },
] as const;

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
  createdAt?: string;
  tags?: string[];
  fileName?: string | null;
  fileSize?: string | null;
  userId?: string | null;
  displayName?: string | null;
  avatarEmoji?: string | null;
}

export default function SearchPage() {
  const { clips, fetchClips, isLoading: clipsLoading } = useClipStore();
  const { user, isLoading: authLoading } = useAuthStore();
  const isAuthenticated = !authLoading && user !== null;

  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedTag, setSelectedTag] = useState('');
  const [aiSearch, setAiSearch] = useState(false);
  const [aiFallback, setAiFallback] = useState(false);
  const [page, setPage] = useState(1);

  const [globalClips, setGlobalClips] = useState<DisplayClip[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) fetchClips();
  }, [isAuthenticated, fetchClips]);

  useEffect(() => {
    if (authLoading) return;

    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (typeFilter !== 'all' && typeFilter !== 'bookmark') params.set('type', typeFilter);
    if (selectedTag) params.set('tag', selectedTag);
    if (aiSearch && query && !selectedTag) params.set('ai', 'true');

    setGlobalLoading(true);
    fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(data => {
        const clips: DisplayClip[] = (data.clips ?? []).map((c: any) => ({
          ...c,
          typeLabel: TYPE_LABELS[c.type] ?? c.type,
        }));
        setGlobalClips(clips);
        setAiFallback(Boolean(data.aiFallback));
      })
      .catch(() => {
        setGlobalClips([]);
        setAiFallback(false);
      })
      .finally(() => setGlobalLoading(false));
  }, [authLoading, query, typeFilter, selectedTag, aiSearch]);

  const isLoading = authLoading || globalLoading;

  const popularTags = useMemo(() => {
    const source = globalClips;
    const counts: Record<string, number> = {};
    source.forEach(c => c.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [globalClips]);

  const personalResults = useMemo((): DisplayClip[] => {
    if (!isAuthenticated) return [];
    const now = Date.now();
    const period = PERIOD_FILTERS.find(p => p.key === periodFilter)!;
    let filtered = clips.filter(c => {
      if (typeFilter === 'bookmark') return c.isBookmarked;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (period.ms > 0 && c.timestamp < now - period.ms) return false;
      if (query) {
        const q = query.toLowerCase();
        const hit = c.title.toLowerCase().includes(q)
          || c.summary?.toLowerCase().includes(q)
          || c.tags?.some(t => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    filtered.sort((a, b) => sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    return filtered.map(c => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      url: c.url,
      domain: c.domain,
      thumbnail: c.thumbnail,
      type: c.type,
      typeLabel: c.typeLabel,
      date: c.date,
      tags: c.tags,
      fileName: c.fileName,
      fileSize: c.fileSize,
    }));
  }, [isAuthenticated, clips, query, typeFilter, periodFilter, sortOrder]);

  const results = useMemo(() => {
    const now = Date.now();
    const period = PERIOD_FILTERS.find(p => p.key === periodFilter)!;
    return [...globalClips]
      .filter(c => {
        if (period.ms === 0 || !c.createdAt) return true;
        return new Date(c.createdAt).getTime() >= now - period.ms;
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
      });
  }, [globalClips, periodFilter, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paged = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = () => { setQuery(inputValue); setPage(1); };
  const clearSelectedTag = () => {
    setSelectedTag('');
    setPage(1);
  };

  const visibleTypeFilters = TYPE_FILTERS.filter(f => f.key !== 'bookmark');

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col gap-10 pt-8 pb-20">

        {/* Hero */}
        <section className="flex flex-col items-center space-y-6">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Globe className="w-3.5 h-3.5" />
            みんなのクリップを検索
          </div>

          <h1 className="brand-page-title text-center">グローバルクリップ</h1>

          <div className="w-full max-w-3xl relative group">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <SearchIcon className="text-outline w-6 h-6 group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full bg-surface-container-low border-none rounded-full py-5 md:py-6 pl-16 pr-36 text-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-high transition-all outline-none placeholder:text-outline"
              placeholder="キーワード、タグ、要約で検索..."
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button
                onClick={handleSearch}
                className="bg-gradient-to-br from-primary to-primary-container text-white px-6 md:px-8 h-full rounded-full font-bold shadow-primary hover:scale-105 active:scale-95 transition-all"
              >
                検索
              </button>
            </div>
          </div>

          <button
            onClick={() => { setAiSearch(v => !v); setPage(1); }}
            className={clsx(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors",
              aiSearch
                ? "bg-secondary text-on-secondary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            <Sparkles className="w-4 h-4" />
            AI検索
          </button>

          {/* Type filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {visibleTypeFilters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTypeFilter(key); setPage(1); }}
                className={clsx(
                  "px-5 py-2 rounded-full text-sm font-semibold transition-colors",
                  typeFilter === key
                    ? "bg-primary text-white"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Results layout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="bg-surface-container-lowest p-5 rounded-[24px] space-y-6 shadow-ambient lg:sticky lg:top-24">
              <div>
                <div className="flex items-center gap-2 text-outline mb-4">
                  <Tag className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">人気タグ</h3>
                </div>
                {popularTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => { setSelectedTag(tag); setPage(1); }}
                        className={clsx(
                          "px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                          selectedTag === tag
                            ? "bg-primary text-white"
                            : "bg-secondary-container text-on-secondary-container hover:bg-secondary/20"
                        )}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-outline/70 leading-relaxed">
                    検索結果にタグがあると、ここからワンクリックで絞り込めます。
                  </p>
                )}
                {selectedTag && (
                  <button
                    onClick={clearSelectedTag}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                    #{selectedTag} を解除
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-outline mb-3">
                  <Clock className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">期間</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PERIOD_FILTERS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setPeriodFilter(key); setPage(1); }}
                      className={clsx(
                        "px-3 py-2 rounded-2xl text-xs font-bold transition-colors",
                        periodFilter === key
                          ? "bg-primary text-white"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-outline mb-3">
                  <ArrowDownUp className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">並び順</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'newest', label: '新しい順' },
                    { key: 'oldest', label: '古い順' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setSortOrder(key as 'newest' | 'oldest'); setPage(1); }}
                      className={clsx(
                        "px-3 py-2 rounded-2xl text-xs font-bold transition-colors",
                        sortOrder === key
                          ? "bg-primary text-white"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="lg:col-span-9 space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold text-on-surface">
                {isLoading ? '検索中...' : `${results.length}件`}
              </h2>
              {aiSearch && query && (
                <span className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                  aiFallback ? "bg-outline-variant/20 text-outline" : "bg-secondary-container text-on-secondary-container"
                )}>
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiFallback ? '通常検索' : 'AI検索'}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20 text-outline">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : paged.length === 0 ? (
              <div className="py-20 text-center text-on-surface-variant">
                <p className="text-sm">該当するクリップが見つかりません。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paged.map(clip => {
                  const isOwnClip = isAuthenticated && clip.userId === user?.id;
                  const href = isOwnClip ? `/clip/${clip.id}` : `/view/${clip.id}`;
                  return (
                    <Link
                      href={href}
                      key={clip.id}
                      className={clsx(
                        "group bg-surface-container-lowest rounded-[32px] overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 flex flex-col",
                        isOwnClip && "ring-2 ring-primary/40"
                      )}
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
                      ) : clip.type === 'pdf' && clip.fileName ? (
                        <div className="p-4 bg-surface-container-high/50 flex items-center gap-3">
                          <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-on-surface truncate">{clip.fileName}</div>
                            <div className="text-[10px] text-on-surface-variant">{clip.fileSize}</div>
                          </div>
                        </div>
                      ) : null}

                      <div className="p-6 flex-1 flex flex-col space-y-2">
                        {!clip.thumbnail && (
                          <span className={clsx(
                            "self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                            clip.type === 'pdf' && "bg-primary/10 text-primary",
                            clip.type === 'video' && "bg-secondary/10 text-secondary",
                            clip.type === 'diary' && "bg-outline/10 text-outline"
                          )}>{clip.typeLabel}</span>
                        )}
                        <h3 className="text-base font-bold text-on-surface line-clamp-2 leading-snug">{clip.title}</h3>
                        {clip.summary && (
                          <p className="text-on-surface-variant text-sm line-clamp-2 leading-relaxed">{clip.summary}</p>
                        )}
                        <div className="flex-1" />
                        {clip.tags && clip.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2">
                            {clip.tags.slice(0, 5).map(tag => (
                              <span key={tag} className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">#{tag}</span>
                            ))}
                            {clip.tags.length > 5 && (
                              <span className="text-[10px] text-outline px-1 py-0.5">+{clip.tags.length - 5}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                          <span className="text-xs text-outline">{clip.date}</span>
                          <div className="flex items-center gap-1.5 ml-2 min-w-0">
                            {isOwnClip ? (
                              <span className="px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded-full">自分</span>
                            ) : clip.userId ? (
                              <Link
                                href={`/user/${clip.userId}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity min-w-0"
                              >
                                <span className="text-base leading-none">{clip.avatarEmoji ?? '🙂'}</span>
                                <span className="text-xs text-outline truncate max-w-[80px]">
                                  {clip.displayName ?? '匿名'}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-xs text-outline truncate">{clip.domain}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
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
          </div>
        </section>
      </div>
    </AppShell>
  );
}
