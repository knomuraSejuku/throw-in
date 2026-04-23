'use client';

import { AppShell } from '@/components/shell/AppShell';
import { Clock, FileText, Image as ImageIcon, File, PenLine, Settings, CheckCircle2, AlertCircle, Loader2, LayoutGrid, List, BookOpen, Filter, Search } from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';
import Link from 'next/link';
import { useClipStore, useCollectionStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

function LibraryContent() {
  const router = useRouter();
  const { clips, fetchClips, isLoading, processingJobs, semanticSearch } = useClipStore();
  const { collections } = useCollectionStore();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('filter');
  const currentType = searchParams.get('type');
  const currentTag = searchParams.get('tag');
  const currentCollection = searchParams.get('collection');

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  // Local View States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSourcebookMode, setIsSourcebookMode] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Semantic Search States
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [semanticClipIds, setSemanticClipIds] = useState<string[] | null>(null);

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setSemanticClipIds(null);
      return;
    }
    setIsSearchingAI(true);
    const resultIds = await semanticSearch(searchQuery);
    if (resultIds) {
      setSemanticClipIds(resultIds);
    } else {
      // Fallback or handle error (for now, just clear to show no results or normal search)
      setSemanticClipIds([]);
    }
    setIsSearchingAI(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSemanticClipIds(null);
  };

  // Pagination State
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, currentType, currentTag, currentCollection, searchQuery, semanticClipIds, showUnreadOnly, isSourcebookMode]);

  let filteredClips = clips.filter(clip => {
    let match = true;
    if (showUnreadOnly && !clip.isUnread) match = false;
    if (currentFilter === 'unread' && !clip.isUnread) match = false; // keep legacy filter param working
    if (currentFilter === 'bookmarked' && !clip.isBookmarked) match = false;
    if (currentType && clip.type !== currentType) match = false;
    if (currentTag && !clip.tags?.includes(currentTag)) match = false;
    if (currentCollection && !clip.collections?.includes(currentCollection)) match = false;
    
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

  // If semantic search is active, sort by the score/order returned from the RPC
  if (semanticClipIds !== null && semanticClipIds.length > 0) {
    filteredClips = filteredClips.sort((a, b) => {
      const idxA = semanticClipIds.indexOf(a.id);
      const idxB = semanticClipIds.indexOf(b.id);
      return idxA - idxB;
    });
  }

  const totalPages = Math.max(1, Math.ceil(filteredClips.length / PAGE_SIZE));
  const paginatedClips = filteredClips.slice(0, currentPage * PAGE_SIZE); // Simple "Load More" style pagination for continuous scrolling UX

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
    return 'すべてのクリップ';
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
      
      {/* Filters / Metadata Header */}
      <div className="sticky top-[72px] z-20 py-4 bg-background/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <h2 className="text-2xl font-bold text-on-surface">{getPageTitle()}</h2>
        
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
          
          <button className="p-2 rounded-full bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full py-20 flex flex-col items-center justify-center text-outline">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm font-medium">クリップを読み込んでいます...</p>
        </div>
      ) : (
        <>
          {/* Content Area */}
          <div className={clsx(
            "gap-6",
            viewMode === 'grid' && !isSourcebookMode ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col"
          )}>

        {/* Featured Hero Card (Show only on absolute root page in Grid view) */}
        {!currentFilter && !currentType && !currentTag && !searchQuery && viewMode === 'grid' && !isSourcebookMode && filteredClips.length > 0 && (
          <div className="md:col-span-2 lg:col-span-2 bg-primary-container text-on-primary-container rounded-[32px] p-8 relative overflow-hidden flex flex-col justify-end min-h-[320px]">
            {filteredClips[0].thumbnail && (
              <Image 
                src={filteredClips[0].thumbnail} 
                alt="Featured" 
                fill 
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40" 
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase">Latest Collection</span>
                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight leading-snug line-clamp-2">
                {filteredClips[0].title}
              </h2>
              <div className="flex items-center gap-4">
                <Link href={`/clip/${filteredClips[0].id}`} className="bg-white text-primary px-6 py-2.5 rounded-full text-sm font-bold shadow-xl hover:scale-105 transition-transform">
                  今すぐ読む
                </Link>
                <span className="text-sm font-medium text-white/80">{filteredClips[0].domain || filteredClips[0].date}</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredClips.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 py-12 text-center text-on-surface-variant">
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
                          {clip.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">#{tag}</span>
                          ))}
                          {clip.tags && clip.tags.length > 2 && <span className="text-[10px] text-outline">+{clip.tags.length - 2}</span>}
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
                 {/* Thumbnail */}
                 <div className="hidden sm:block w-32 aspect-video bg-surface-container-highest rounded-lg overflow-hidden relative flex-shrink-0">
                    {clip.thumbnail ? (
                      <Image src={clip.thumbnail} alt="" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline-variant">
                         <FileText className="w-6 h-6" />
                      </div>
                    )}
                 </div>
                 
                 {/* Content */}
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

        {/* Grid View (Original) */}
        {!isSourcebookMode && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 pb-20">
            {paginatedClips.map(clip => (
                <Link href={`/clip/${clip.id}`} key={clip.id} className={clsx(
                  "group rounded-[32px] p-6 transition-all duration-300 flex flex-col h-full cursor-pointer",
                  clip.isUnread ? "bg-surface-container-lowest shadow-ambient hover:shadow-card-hover hover:-translate-y-1" : "bg-surface-container-low opacity-90 hover:opacity-100"
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
                      {clip.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {clip.duration}
                        </span>
                      )}
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
                      {clip.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-outline-variant/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-outline">{clip.date}</span>
                    </div>
                    
                    {processingJobs[clip.id] === 'enriching' ? (
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-md flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/>AI処理中</span>
                    ) : processingJobs[clip.id] === 'failed' ? (
                      <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-1 rounded-md">処理失敗</span>
                    ) : clip.status === 'ready' && clip.stage2 ? (
                      <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded-md">詳細整理済</span>
                    ) : clip.status === 'enriching' ? (
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-1 rounded-md">要約作成中</span>
                    ) : clip.status === 'extracting' ? (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">OCR処理中</span>
                    ) : clip.isArchived ? (
                      <span className="text-[10px] font-bold text-outline bg-surface-container-high px-2 py-1 rounded-md">アーカイブ</span>
                    ) : null}
                  </div>
                </Link>
            ))}
          </div>
        )}
        
        {currentPage < totalPages && (
          <div className="flex justify-center mt-8 pb-12">
            <button 
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-6 py-3 bg-surface-container-low hover:bg-surface-container-high text-on-surface font-bold rounded-full transition-colors border border-outline-variant/30 shadow-sm flex items-center gap-2"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
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
