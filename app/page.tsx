'use client';

import { AppShell } from '@/components/shell/AppShell';
import { Clock, FileText, Image as ImageIcon, File, PenLine, Settings, CheckCircle2, AlertCircle, Loader2, LayoutGrid, List, BookOpen, Filter, Search, Bookmark, ArrowDownUp } from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { useClipStore, useCollectionStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useRef, useLayoutEffect } from 'react';
import confetti from 'canvas-confetti';

function LibraryContent() {
  const router = useRouter();
  const { clips, fetchClips, isLoading, processingJobs, semanticSearch } = useClipStore();
  const { collections } = useCollectionStore();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('filter');
  const currentType = searchParams.get('type');
  const currentTag = searchParams.get('tag');
  const currentCollection = searchParams.get('collection');
  const currentCategory = searchParams.get('category');
  const currentSubcategory = searchParams.get('subcategory');

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Local View States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSourcebookMode, setIsSourcebookMode] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  
  const [currentSort, setCurrentSort] = useState<'date' | 'saves'>('date');
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  const setTypeFilter = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type === 'all') params.delete('type');
    else params.set('type', type);
    router.push(`/?${params.toString()}`);
  };

  // Semantic Search States
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [semanticClipIds, setSemanticClipIds] = useState<string[] | null>(null);
  const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setSemanticClipIds(null);
      return;
    }
    setIsSearchingAI(true);
    setSemanticSearchError(null);
    try {
      const resultIds = await semanticSearch(searchQuery);
      setSemanticClipIds(resultIds ?? []);
    } catch (err: any) {
      setSemanticSearchError(err?.message || 'AI検索に失敗しました');
      setSemanticClipIds(null);
    }
    setIsSearchingAI(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSemanticClipIds(null);
    setSemanticSearchError(null);
  };

  // Pagination State
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRestoreRef = useRef<number | null>(null);
  const heroClipsRef = useRef<typeof clips>([]);

  useLayoutEffect(() => {
    if (scrollRestoreRef.current !== null) {
      window.scrollTo(0, scrollRestoreRef.current);
      scrollRestoreRef.current = null;
    }
  });

  // Detect stage2 transition (false→true) and fire confetti
  const prevStage2Ref = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const prev = prevStage2Ref.current;
    for (const clip of clips) {
      if (prev[clip.id] === false && clip.stage2 === true) {
        const card = document.querySelector(`[data-clip-id="${clip.id}"]`);
        if (card) {
          const rect = card.getBoundingClientRect();
          const x = (rect.left + rect.width / 2) / window.innerWidth;
          const y = (rect.top + rect.height / 3) / window.innerHeight;
          confetti({ particleCount: 55, spread: 55, origin: { x, y }, colors: ['#004ac6', '#6a1edb', '#505f76', '#93c5fd', '#ffffff'], scalar: 0.75, ticks: 90, gravity: 0.8 });
        }
      }
    }
    const next: Record<string, boolean> = {};
    for (const clip of clips) { next[clip.id] = clip.stage2; }
    prevStage2Ref.current = next;
  }, [clips]);

  // Reset page and hero index when filters change
  useEffect(() => {
    setCurrentPage(1);
    setHeroIndex(0);
  }, [currentFilter, currentType, currentTag, currentCollection, currentCategory, currentSubcategory, searchQuery, semanticClipIds, showUnreadOnly, isSourcebookMode]);

  // Cycle hero every 3s (reads from ref to avoid recreating interval)
  useEffect(() => {
    const timer = setInterval(() => {
      const len = heroClipsRef.current.length;
      if (len > 1) setHeroIndex(i => (i + 1) % len);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  let filteredClips = clips.filter(clip => {
    let match = true;
    // Hide archived clips unless explicitly viewing archived
    if (currentFilter === 'archived') { if (!clip.isArchived) match = false; }
    else { if (clip.isArchived) match = false; }
    if (showUnreadOnly && !clip.isUnread) match = false;
    if (currentFilter === 'unread' && !clip.isUnread) match = false; // keep legacy filter param working
    if (currentFilter === 'bookmarked' && !clip.isBookmarked) match = false;
    if (currentType && clip.type !== currentType) match = false;
    if (currentTag && !clip.tags?.includes(currentTag)) match = false;
    if (currentCollection && !clip.collections?.includes(currentCollection)) match = false;
    if (currentCategory && clip.category !== currentCategory) match = false;
    if (currentSubcategory && clip.subcategory !== currentSubcategory) match = false;
    
    // If semanticClipIds is active, only show those exact IDs
    if (semanticClipIds !== null) {
      if (!semanticClipIds.includes(clip.id)) match = false;
    } else {
      // Standard local text search
      if (searchQuery) {
        const qs = searchQuery.toLowerCase();
        const inTitle = clip.title.toLowerCase().includes(qs);
        const inSummary = clip.summary?.toLowerCase().includes(qs);
        const inTags = clip.tags?.some(t => t.toLowerCase().includes(qs));
        if (!inTitle && !inSummary && !inTags) match = false;
      }
    }
    return match;
  });

  if (semanticClipIds !== null && semanticClipIds.length > 0) {
    filteredClips = filteredClips.sort((a, b) => {
      const idxA = semanticClipIds.indexOf(a.id);
      const idxB = semanticClipIds.indexOf(b.id);
      return idxA - idxB;
    });
  } else if (currentSort === 'saves') {
    filteredClips = [...filteredClips].sort((a, b) => (b.saveCount ?? 0) - (a.saveCount ?? 0));
  }

  const totalPages = Math.max(1, Math.ceil(filteredClips.length / PAGE_SIZE));
  const paginatedClips = filteredClips.slice(0, currentPage * PAGE_SIZE); // Simple "Load More" style pagination for continuous scrolling UX

  const heroClips = filteredClips.filter(c => c.isUnread);
  heroClipsRef.current = heroClips;
  const heroClip = heroClips.length > 0 ? heroClips[heroIndex % heroClips.length] : null;

  const getPageTitle = () => {
    if (currentCollection) {
      const col = collections.find(c => c.id === currentCollection);
      return col ? col.name : 'コレクション';
    }
    if (currentFilter === 'unread') return '未読のクリップ';
    if (currentFilter === 'bookmarked') return 'ブックマーク';
    if (currentType === 'url') return '記事';
    if (currentType === 'video') return '動画';
    if (currentType === 'image') return '画像';
    if (currentType === 'pdf') return 'ドキュメント';
    if (currentType === 'diary') return '日記・メモ';
    if (currentTag) return `#${currentTag}`;
    if (currentSubcategory) return currentSubcategory;
    if (currentCategory) return currentCategory;
    return 'すべてのクリップ';
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
      
      {/* Filters / Metadata Header */}
      <div className="sticky top-[72px] z-20 py-4 bg-background/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-bold text-on-surface">{getPageTitle()}</h2>
          <span className="text-xs text-outline/60 tabular-nums font-medium">
            {filteredClips.filter(c => c.isUnread).length}/{filteredClips.length}
          </span>
        </div>
        
        {/* Modern Controls */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto pb-1 sm:pb-0">
          
          <div className="relative group flex items-center h-9">
            <div className="relative flex items-center h-full">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder={semanticClipIds !== null ? "AI検索結果..." : "検索..."}
                value={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSemanticSearch();
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (semanticClipIds !== null) setSemanticClipIds(null); // Clear semantic if typing again
                }}
                className={clsx(
                  "pl-9 pr-14 py-2 h-full rounded-full text-sm outline-none transition-all w-32 md:w-48 lg:focus:w-64",
                  semanticClipIds !== null 
                    ? "bg-tertiary/10 border-tertiary/50 text-tertiary focus:ring-1 focus:ring-tertiary"
                    : "bg-surface-container-low border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary text-on-surface placeholder:text-outline"
                )}
              />
              {isSearchingAI ? (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                   <Loader2 className="w-4 h-4 text-tertiary animate-spin" />
                </div>
              ) : semanticClipIds !== null ? (
                <button 
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-container-high rounded-full text-outline hover:text-on-surface transition-colors"
                  title="クリア"
                >
                  {/* Reuse Search icon as a filler or a clear X, wait let's use an X icon if possible, but we don't have X imported here so text 'x' is fine, or just rely on clear */}
                  <span className="text-xs font-bold px-1">×</span>
                </button>
              ) : (
                <button 
                   onClick={handleSemanticSearch}
                   disabled={!searchQuery.trim()}
                   className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-container text-[10px] font-bold text-tertiary rounded-full hover:bg-tertiary/10 transition-colors border border-tertiary/20 disabled:opacity-50"
                   title="AIセマンティック検索"
                >
                  AI
                </button>
              )}
            </div>
          </div>

          <button 
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center whitespace-nowrap border cursor-pointer",
              showUnreadOnly 
                ? "bg-primary text-on-primary border-primary" 
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
            )}
          >
            未読のみ
          </button>

          <button 
            onClick={() => setIsSourcebookMode(!isSourcebookMode)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap border cursor-pointer",
              isSourcebookMode 
                ? "bg-secondary text-on-secondary border-secondary" 
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
            )}
          >
            <BookOpen className="w-4 h-4" />
            原典モード
          </button>

          <div className="flex items-center bg-surface-container-low rounded-full p-1 border border-outline-variant/30">
            <button 
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-1.5 rounded-full transition-colors",
                viewMode === 'grid' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-1.5 rounded-full transition-colors",
                viewMode === 'list' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={() => setCurrentSort(s => s === 'date' ? 'saves' : 'date')}
            className={clsx(
              "p-2 rounded-full border transition-colors flex items-center gap-1.5",
              currentSort === 'saves'
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
            )}
            title={currentSort === 'saves' ? '保存数順（タップで日付順）' : '日付順（タップで保存数順）'}
          >
            <ArrowDownUp className="w-4 h-4" />
            {currentSort === 'saves' && <span className="text-[10px] font-bold pr-0.5">保存数</span>}
          </button>

          <button
            onClick={() => setShowTypeFilter(v => !v)}
            className={clsx(
              "p-2 rounded-full border transition-colors",
              showTypeFilter || currentType
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
            )}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showTypeFilter && (
        <div className="flex flex-wrap gap-2 py-2 -mt-2 mb-2">
          {[
            { key: 'all', label: 'すべて' },
            { key: 'url', label: '記事' },
            { key: 'video', label: '動画' },
            { key: 'image', label: '画像' },
            { key: 'pdf', label: 'ドキュメント' },
            { key: 'diary', label: '日記・メモ' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                (f.key === 'all' ? !currentType : currentType === f.key)
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {semanticSearchError && (
        <div className="mx-4 md:mx-8 mt-2 mb-0 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-sm border border-amber-500/20">
          AI検索エラー: {semanticSearchError}
        </div>
      )}

      {isLoading ? (
        <div className="w-full py-20 flex flex-col items-center justify-center text-outline">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm font-medium">クリップを読み込んでいます...</p>
        </div>
      ) : (
        <>
          {/* Empty State */}
          {filteredClips.length === 0 && (
            <div className="py-12 text-center text-on-surface-variant">
              一致するクリップがありません。
            </div>
          )}

          {/* Sourcebook Mode */}
          {isSourcebookMode && paginatedClips.length > 0 && (
            <div className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-3xl overflow-hidden shadow-ambient">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-outline border-b border-outline-variant/20">
                    <tr>
                      <th className="px-6 py-4">Title / Source</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Tags</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredClips.map(clip => (
                      <tr key={clip.id} className="hover:bg-surface-container-low cursor-pointer transition-colors" onClick={() => router.push(`/clip/${clip.id}`)}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-on-surface mb-1">{clip.title}</div>
                          <div className="text-xs text-on-surface-variant flex items-center gap-2">
                            <span className={clsx("w-2 h-2 rounded-full", clip.isUnread ? "bg-primary" : "bg-outline-variant")}></span>
                            {clip.domain || clip.fileName || 'ノート'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                            clip.type === 'pdf' && "bg-primary/10 text-primary",
                            clip.type === 'video' && "bg-secondary/10 text-secondary"
                          )}>
                            {clip.typeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {clip.tags?.slice(0, 5).map(tag => (
                              <span key={tag} className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">#{tag}</span>
                            ))}
                            {clip.tags && clip.tags.length > 5 && <span className="text-[10px] text-outline">+{clip.tags.length - 5}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant text-xs">{clip.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* List View */}
          {!isSourcebookMode && viewMode === 'list' && paginatedClips.length > 0 && (
            <div className="flex flex-col gap-3">
              {paginatedClips.map(clip => (
                <Link href={`/clip/${clip.id}`} key={clip.id} className={clsx(
                  "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border border-outline-variant/10",
                  clip.isUnread ? "bg-surface-container-lowest shadow-ambient hover:shadow-card-hover hover:-translate-y-0.5" : "bg-surface-container-low hover:bg-surface-container-high"
                )}>
                  <div className="hidden sm:block w-32 aspect-video bg-surface-container-highest rounded-lg overflow-hidden relative flex-shrink-0">
                    {clip.thumbnail ? (
                      <Image src={clip.thumbnail} alt="" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline-variant">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      {clip.isUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>}
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0",
                        clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                        clip.type === 'pdf' && "bg-primary/10 text-primary",
                        clip.type === 'video' && "bg-secondary/10 text-secondary"
                      )}>
                        {clip.typeLabel}
                      </span>
                      <span className="text-xs text-outline truncate">{clip.domain || clip.date}</span>
                    </div>
                    <h3 className={clsx("text-base font-bold leading-tight truncate", clip.isUnread ? "text-on-surface" : "text-on-surface-variant")}>
                      {clip.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Grid View */}
          {!isSourcebookMode && viewMode === 'grid' && filteredClips.length > 0 && (
            <>
              {/* Featured Hero Card */}
              <div className="bg-primary/25 border border-primary/30 rounded-[32px] p-8 relative overflow-hidden flex flex-col justify-end min-h-[320px] mb-6">
                {heroClip?.thumbnail && (
                  <Image
                    src={heroClip.thumbnail}
                    alt="Featured"
                    fill
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/50 to-transparent" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest">気になるクリップ</span>
                    {heroClip && <span className="h-2 w-2 rounded-full bg-white animate-pulse" />}
                    {heroClips.length > 1 && (
                      <span className="text-[10px] text-white/70 font-medium">{(heroIndex % heroClips.length) + 1} / {heroClips.length}</span>
                    )}
                  </div>
                  <div key={heroIndex} className="animate-hero-slide-in">
                    {heroClip ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase">{heroClip.typeLabel}</span>
                          <span className="text-[10px] text-white/70">{new Date(heroClip.timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {heroClip.category && <span className="text-[10px] text-white/70">{heroClip.category}{heroClip.subcategory && ` › ${heroClip.subcategory}`}</span>}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight leading-snug line-clamp-2 text-white">
                          {heroClip.title}
                        </h2>
                        {heroClip.tags && heroClip.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {heroClip.tags.slice(0, 5).map(tag => (
                              <span key={tag} className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-medium text-white/90">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <Link href={`/clip/${heroClip.id}`} className="bg-white text-primary px-6 py-2.5 rounded-full text-sm font-bold shadow-sm hover:scale-105 transition-transform">
                            今すぐ読む
                          </Link>
                          <span className="text-sm font-medium text-white/70">{heroClip.domain}</span>
                        </div>
                      </>
                    ) : (
                      <div className="py-4">
                        <p className="text-2xl font-bold mb-1 text-white">🎉 すべて読了！</p>
                        <p className="text-sm text-white/70">未読クリップはありません。積ん読ゼロ、お見事です。</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-20">
                {paginatedClips.map(clip => (
                  <Link href={`/clip/${clip.id}`} key={clip.id} data-clip-id={clip.id} className={clsx(
                    "group rounded-[32px] p-6 transition-all duration-500 flex flex-col h-full cursor-pointer",
                    !clip.stage2
                      ? "bg-[#f3f4f6] hover:shadow-ambient hover:-translate-y-1"
                      : clip.isUnread
                        ? "bg-surface-container-lowest shadow-ambient hover:shadow-card-hover hover:-translate-y-1"
                        : "bg-surface-container-low opacity-90 hover:opacity-100"
                  )}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                        clip.type === 'pdf' && "bg-primary/10 text-primary",
                        clip.type === 'video' && "bg-secondary/10 text-secondary"
                      )}>
                        {clip.typeLabel}
                      </span>
                      {clip.isUnread ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary"></span>
                          <span className="text-xs text-primary font-bold">未読</span>
                        </div>
                      ) : (
                        <span className="text-xs text-outline font-medium italic">既読</span>
                      )}
                    </div>

                    {clip.thumbnail && (
                      <div className="aspect-video bg-surface-container-high rounded-xl mb-4 relative overflow-hidden">
                        <Image src={clip.thumbnail} alt="" fill className="object-cover" />
                      </div>
                    )}

                    {clip.type === 'pdf' && clip.fileName && (
                      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-container-high/50 rounded-xl">
                        <FileText className="w-6 h-6 text-primary" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-on-surface truncate">{clip.fileName}</div>
                          <div className="text-[10px] text-on-surface-variant">{clip.fileSize}</div>
                        </div>
                      </div>
                    )}

                    <h3 className={clsx("text-lg font-bold mb-2 leading-tight line-clamp-2", clip.isUnread ? "text-on-surface" : "text-on-surface-variant")}>
                      {clip.title}
                    </h3>

                    {clip.summary && (
                      <p className="text-sm text-on-surface-variant mb-6 line-clamp-2">
                        {clip.summary}
                      </p>
                    )}

                    <div className="flex-1" />

                    {clip.tags && clip.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4 mt-4">
                        {clip.tags.slice(0, 5).map(tag => (
                          <span key={tag} className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-medium">
                            #{tag}
                          </span>
                        ))}
                        {clip.tags.length > 5 && (
                          <span className="text-[10px] text-outline px-1 py-0.5">+{clip.tags.length - 5}</span>
                        )}
                      </div>
                    )}

                    {(clip.category || clip.subcategory) && (
                      <div className="flex items-center gap-1 mt-3 text-[10px] text-outline-variant truncate">
                        {clip.category && <span className="truncate">{clip.category}</span>}
                        {clip.category && clip.subcategory && <span className="flex-shrink-0">›</span>}
                        {clip.subcategory && <span className="truncate">{clip.subcategory}</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-outline-variant/10">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-outline">{clip.date}</span>
                        {(clip.saveCount ?? 0) > 0 && (
                          <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Bookmark className="w-2.5 h-2.5" />{clip.saveCount}
                          </span>
                        )}
                      </div>
                      {processingJobs[clip.id] === 'enriching' ? (
                        <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-md flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/>AI処理中</span>
                      ) : processingJobs[clip.id] === 'failed' ? (
                        <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-1 rounded-md">処理失敗</span>
                      ) : clip.stage2 ? (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md flex items-center gap-1">AI<CheckCircle2 className="w-3 h-3" /></span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {currentPage < totalPages && (
            <div className="flex justify-center mt-8 pb-12">
              <button
                onClick={() => {
                  scrollRestoreRef.current = window.scrollY;
                  setCurrentPage(p => p + 1);
                }}
              className="px-6 py-3 bg-surface-container-low hover:bg-surface-container-high text-on-surface font-bold rounded-full transition-colors border border-outline-variant/30 shadow-sm flex items-center gap-2"
            >
              もっと見る
            </button>
          </div>
        )}
      </>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center">読み込み中...</div>}>
        <LibraryContent />
      </Suspense>
    </AppShell>
  );
}
