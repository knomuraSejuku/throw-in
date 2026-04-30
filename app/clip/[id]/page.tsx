'use client';

import { use, useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { useClipStore, useCollectionStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, ExternalLink, Hash, Loader2, Bookmark, CheckCircle2, BookmarkCheck, Trash2, Archive, ArchiveRestore, FileText, Image as ImageIcon, Video, Book, FolderPlus, Languages, AlertTriangle, RefreshCw, Tag, Pencil, Plus, Check, X, Globe } from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { createClient } from '@/lib/supabase/client';
import { CelebrationEffect } from '@/components/effects/CelebrationEffect';
import { aiJustCompleted } from '@/lib/store';
import { CommentSection } from '@/components/comments/CommentSection';

function formatPlainArticleText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (/\n/.test(trimmed)) {
    return trimmed
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  return trimmed
    .replace(/([。！？!?])\s*/g, '$1\n\n')
    .replace(/\. (?=[A-Z])/g, '.\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

export default function ClipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const { clips, fetchClips, toggleRead, toggleBookmark, deleteClip, archiveClip, translateClip, updateClip, isLoading, processingJobs, processClipAI } = useClipStore();
  const { collections, fetchCollections, addClipToCollection, removeClipFromCollection } = useCollectionStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [readEffect, setReadEffect] = useState<{ origin: { x: number; y: number } } | null>(null);
  const [showAiEffect, setShowAiEffect] = useState(false);
  const prevIsUnreadRef = useRef<boolean | undefined>(undefined);
  const readButtonOriginRef = useRef<{ x: number; y: number } | null>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const recordedHistory = useRef(false);

  useEffect(() => {
    if (clips.length === 0) {
      fetchClips();
    }
  }, [clips.length, fetchClips]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const clip = clips.find(c => c.id === id);
  const clipId = clip?.id;
  const clipIsUnread = clip?.isUnread;

  // Record history when clip is loaded
  useEffect(() => {
    if (clip && !recordedHistory.current) {
      recordedHistory.current = true;
      const recordView = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('history').insert({
            user_id: session.user.id,
            clip_id: clip.id
          });
        }
      };
      recordView();
    }
  }, [clip]);

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

  const clipProcessingJob = clip ? (processingJobs[clip.id] ?? null) : null;

  // AI処理完了検知: processingJobs[id] が 'done' になったタイミングで消費
  useEffect(() => {
    if (!clipId) return;
    if (clipProcessingJob === 'done' && aiJustCompleted.has(clipId)) {
      aiJustCompleted.delete(clipId);
      setShowAiEffect(true);
    }
  }, [clipId, clipProcessingJob]);

  // 既読切り替え検知 (ボタン押下 / auto-read 両対応)
  useEffect(() => {
    if (clipIsUnread === undefined) return;
    const prev = prevIsUnreadRef.current;
    if (prev === true && clipIsUnread === false) {
      const origin = readButtonOriginRef.current
        ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
      readButtonOriginRef.current = null;
      setReadEffect({ origin });
    }
    prevIsUnreadRef.current = clipIsUnread;
  }, [clipIsUnread]);

  // Auto-mark as read after 5 seconds if unread
  useEffect(() => {
    if (!clipId || !clipIsUnread) return;
    const timer = setTimeout(() => toggleRead(clipId), 5000);
    return () => clearTimeout(timer);
  }, [clipId, clipIsUnread, toggleRead]);

  if (isLoading && !clip) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-outline" />
        </div>
      </AppShell>
    );
  }

  if (!clip) {
    return (
      <AppShell>
        <div className="flex flex-col h-screen items-center justify-center gap-4">
          <div className="text-xl font-bold text-on-surface">クリップが見つかりません。</div>
          <button onClick={() => router.back()} className="text-primary hover:underline">戻る</button>
        </div>
      </AppShell>
    );
  }

  const handleTitleSave = async () => {
    if (!clip || titleDraft.trim() === clip.title) { setEditingTitle(false); return; }
    if (titleDraft.trim()) await updateClip(clip.id, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const handleNoteSave = async () => {
    if (!clip) { setEditingNote(false); return; }
    await updateClip(clip.id, { userNote: noteDraft });
    setEditingNote(false);
  };

  const handleDelete = async () => {
    if (window.confirm('このクリップを削除しますか？')) {
      setIsDeleting(true);
      await deleteClip(clip.id);
      setIsDeleting(false);
      router.push('/');
    }
  };

  const handleArchive = async () => {
    const next = !clip.isArchived;
    if (next && !window.confirm('このクリップをアーカイブしますか？（ライブラリから非表示になります）')) return;
    await archiveClip(clip.id, next);
    if (next) router.push('/');
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    setTranslatedText(null);
    const lang = (typeof window !== 'undefined' && localStorage.getItem('preferred_language')) || '日本語';
    const result = await translateClip(clip!.id, lang);
    setTranslatedText(result);
    setIsTranslating(false);
  };

  const handleToggleCollection = async (collectionId: string) => {
     if (clip.collections?.includes(collectionId)) {
        const success = await removeClipFromCollection(clip.id, collectionId);
        if (success) fetchClips(); // refresh simply
     } else {
        const success = await addClipToCollection(clip.id, collectionId);
        if (success) fetchClips(); // refresh simply
     }
  };

  return (
    <AppShell>
      {/* Sticky sub-header */}
      <div
        className={clsx(
          'fixed top-[64px] lg:top-[64px] left-0 right-0 lg:left-72 z-20 transition-all duration-200',
          showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        )}
      >
        <div className="bg-background/90 backdrop-blur-xl border-b border-outline-variant/15 px-4 md:px-8 pt-4 pb-3 md:py-3 max-w-4xl mx-auto lg:max-w-none lg:mx-0 lg:px-8">
          {/* Row 1: back + type + date + category + subcategory + buttons */}
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
                clip.type === 'diary' && 'bg-surface-container-highest text-on-surface-variant',
                clip.type === 'image' && 'bg-surface-container-highest text-on-surface-variant',
              )}>
                {clip.typeLabel}
              </span>
              <span className="text-[11px] text-on-surface-variant shrink-0">{clip.date}</span>
              {clip.category && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold shrink-0">
                  <Tag className="w-2.5 h-2.5" />
                  {clip.category}
                </span>
              )}
              {clip.subcategory && (
                <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-[10px] hidden sm:inline-block shrink-0">
                  {clip.subcategory}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  if (clip.isUnread) {
                    const r = e.currentTarget.getBoundingClientRect();
                    readButtonOriginRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                  }
                  toggleRead(clip.id);
                }}
                className={clsx('p-1.5 rounded-full transition-colors', !clip.isUnread ? 'bg-success/10 text-success' : 'bg-surface-container-high text-on-surface')}
                title={!clip.isUnread ? '未読に戻す' : '既読にする'}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => toggleBookmark(clip.id)} className={clsx('p-1.5 rounded-full transition-colors', clip.isBookmarked ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface')} title={clip.isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}>
                {clip.isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <button onClick={handleArchive} className={clsx("p-1.5 rounded-full transition-colors", clip.isArchived ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest")} title={clip.isArchived ? "アーカイブ解除" : "アーカイブ"}>
                {clip.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="p-1.5 rounded-full bg-surface-container-high text-error hover:bg-error/10 transition-colors disabled:opacity-50" title="削除">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {/* Row 2: title */}
          <p className="text-sm font-bold text-on-surface truncate mt-1 pr-4">{clip.title}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-medium">
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button 
                onClick={() => setShowCollectionMenu(!showCollectionMenu)}
                className={clsx(
                  "p-2 rounded-full transition-colors",
                  clip.collections && clip.collections.length > 0 ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                )}
                title="コレクションに追加"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
              
              {showCollectionMenu && collections.length > 0 && (
                <div className="absolute top-12 right-0 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-ambient z-50 py-2">
                  <div className="px-4 py-2 border-b border-outline-variant/10">
                    <span className="text-xs font-bold text-outline uppercase">コレクションに追加</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {collections.map(col => {
                      const isAdded = clip.collections?.includes(col.id);
                      return (
                        <button 
                          key={col.id} 
                          onClick={() => handleToggleCollection(col.id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors text-sm flex items-center justify-between"
                        >
                          <span className={clsx("truncate pr-2", isAdded ? "font-bold text-primary" : "text-on-surface")}>{col.name}</span>
                          {isAdded && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                if (clip.isUnread) {
                  const r = e.currentTarget.getBoundingClientRect();
                  readButtonOriginRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                }
                toggleRead(clip.id);
              }}
              className={clsx(
                "p-2 rounded-full transition-colors",
                !clip.isUnread ? "bg-success/10 text-success hover:bg-success/20" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              )}
              title={!clip.isUnread ? "未読に戻す" : "既読にする"}
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => toggleBookmark(clip.id)} 
              className={clsx(
                "p-2 rounded-full transition-colors",
                clip.isBookmarked ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              )}
              title={clip.isBookmarked ? "ブックマーク解除" : "ブックマーク"}
            >
              {clip.isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>
            <button
              onClick={handleArchive}
              className={clsx("p-2 rounded-full transition-colors", clip.isArchived ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest")}
              title={clip.isArchived ? "アーカイブ解除" : "アーカイブ"}
            >
              {clip.isArchived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-full bg-surface-container-high text-error hover:bg-error/10 transition-colors disabled:opacity-50"
              title="削除"
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Metadata Header */}
        <div ref={metaRef} className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
             <span className={clsx(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                clip.type === 'pdf' && "bg-primary/10 text-primary",
                clip.type === 'video' && "bg-secondary/10 text-secondary",
                clip.type === 'diary' && "bg-surface-container-highest text-on-surface-variant",
                clip.type === 'image' && "bg-surface-container-highest text-on-surface-variant"
              )}>
                {clip.typeLabel}
             </span>
             <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
               <Clock className="w-4 h-4" />
               {clip.date}
             </span>
             {clip.domain && (
               <a href={clip.type === 'url' ? (clip.url ?? undefined) : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary">
                 <ExternalLink className="w-4 h-4" />
                 {clip.domain}
               </a>
             )}
          </div>
          
          {editingTitle ? (
            <div className="flex items-start gap-2 mb-6">
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="flex-1 text-3xl md:text-4xl font-bold text-on-surface bg-surface-container-low rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={handleTitleSave} className="mt-2 p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20"><Check className="w-5 h-5" /></button>
              <button onClick={() => setEditingTitle(false)} className="mt-2 p-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <h1
              className="group text-3xl md:text-5xl font-bold text-on-surface tracking-tight leading-snug mb-6 cursor-pointer flex items-start gap-3"
              onClick={() => { setTitleDraft(clip.title); setEditingTitle(true); }}
            >
              <span>{clip.title}</span>
              <Pencil className="w-5 h-5 mt-2 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
            </h1>
          )}

          {(clip.category || clip.subcategory) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {clip.category && (
                <span className="flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-xs font-bold">
                  <Tag className="w-3 h-3" />
                  {clip.category}
                </span>
              )}
              {clip.subcategory && (
                <span className="flex items-center gap-1 px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/20 rounded-full text-xs font-medium">
                  {clip.subcategory}
                </span>
              )}
            </div>
          )}

          {clip.tags && clip.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
               {(isTagsExpanded ? clip.tags : clip.tags.slice(0, 5)).map(t => (
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
               {clip.tags.length > 5 && (
                 <button
                   onClick={() => setIsTagsExpanded(v => !v)}
                   className="px-3 py-1 rounded-full text-xs font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                 >
                   {isTagsExpanded ? '閉じる' : `+${clip.tags.length - 5}`}
                 </button>
               )}
            </div>
          )}
        </div>

        {/* Hero Media */}
        {(() => {
          const ytMatch = clip.type === 'video' && clip.url
            ? clip.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
            : null;
          const ytId = ytMatch?.[1];

          if (ytId) {
            return (
              <div className="w-full aspect-video rounded-[32px] overflow-hidden mb-12 shadow-ambient border border-outline-variant/10">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title={clip.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            );
          }

          if (clip.type === 'video' && clip.url) {
            return (
              <div className="w-full aspect-video rounded-[32px] overflow-hidden mb-12 shadow-ambient border border-outline-variant/10">
                <video src={clip.url} controls className="w-full h-full object-cover" />
              </div>
            );
          }

          if (clip.type === 'image' && clip.url) {
            return (
              <div className="w-full rounded-[32px] overflow-hidden mb-12 shadow-ambient border border-outline-variant/10 flex items-center justify-center bg-surface-container-low">
                <Image src={clip.url} alt={clip.title} width={1200} height={800} unoptimized className="max-w-full max-h-[70vh] object-contain" />
              </div>
            );
          }

          if (clip.type === 'pdf' && clip.url) {
            return (
              <div className="w-full h-[70vh] rounded-[32px] overflow-hidden mb-12 shadow-ambient border border-outline-variant/10">
                <iframe src={clip.url} title={clip.title} className="w-full h-full" />
              </div>
            );
          }

          if (clip.thumbnail) {
            return (
              <div className="w-full aspect-video md:aspect-[21/9] rounded-[32px] overflow-hidden relative mb-12 shadow-ambient border border-outline-variant/10">
                <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover" />
              </div>
            );
          }

          return null;
        })()}

        {/* Processing Status Banner */}
        {(processingJobs[clip.id] === 'failed' || (!clip.stage2 && processingJobs[clip.id] !== 'enriching')) && (
          <div className={clsx(
            "mb-6 px-5 py-4 rounded-2xl border flex items-center justify-between gap-4",
            processingJobs[clip.id] === 'failed'
              ? "bg-error/5 border-error/20 text-error"
              : "bg-surface-container border-outline-variant/20 text-on-surface-variant"
          )}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">
                {processingJobs[clip.id] === 'failed'
                  ? "AI処理に失敗しました。再処理をお試しください。"
                  : "このクリップはまだAIに整理されていません。"}
              </p>
            </div>
            <button
              onClick={() => processClipAI(clip.id, clip.body || clip.userNote || '')}
              disabled={processingJobs[clip.id] === 'enriching'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-colors shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", processingJobs[clip.id] === 'enriching' && "animate-spin")} />
              再処理
            </button>
          </div>
        )}

        {/* Content Section */}
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[32px] shadow-ambient p-6 md:p-12">
          
          {/* Summary / AI Note */}
          {clip.summary && (
            <div className="mb-8 p-6 md:p-7 bg-primary/5 border border-primary/20 rounded-2xl relative">
               <div className="absolute -top-4 left-6 bg-surface px-2 text-xs md:text-sm font-extrabold text-primary tracking-widest uppercase">AI Summary</div>
               <p className="text-on-surface leading-relaxed text-sm md:text-base">
                 {clip.summary.trim()}
               </p>
            </div>
          )}

          {/* Key Points */}
          {clip.keyPoints && (
            <div className="mb-12 p-5 md:p-6 bg-surface-container-low border border-outline-variant/30 rounded-2xl relative">
              <div className="absolute -top-4 left-6 bg-surface px-2 text-xs md:text-sm font-extrabold text-secondary tracking-widest uppercase">Key Points</div>
              <div className="prose-body prose-compact text-sm pt-1">
                <ReactMarkdown>{clip.keyPoints.trim()}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* User Note */}
          <div className="mb-12">
            {editingNote ? (
              <div className="p-6 bg-tertiary/5 border border-tertiary/20 rounded-2xl relative">
                <div className="absolute -top-3 left-6 bg-surface px-2 text-[10px] font-bold text-tertiary tracking-widest uppercase">My Note</div>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  rows={5}
                  className="w-full bg-transparent text-on-surface text-sm md:text-base leading-relaxed resize-none focus:outline-none"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditingNote(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest"><X className="w-3.5 h-3.5" />キャンセル</button>
                  <button onClick={handleNoteSave} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-primary bg-primary/10 hover:bg-primary/20 font-bold"><Check className="w-3.5 h-3.5" />保存</button>
                </div>
              </div>
            ) : clip.userNote ? (
              <div
                className="group p-6 bg-tertiary/5 border border-tertiary/20 rounded-2xl relative cursor-pointer hover:border-tertiary/40 transition-colors"
                onClick={() => { setNoteDraft(clip.userNote ?? ''); setEditingNote(true); }}
              >
                <div className="absolute -top-3 left-6 bg-surface px-2 text-[10px] font-bold text-tertiary tracking-widest uppercase">My Note</div>
                <Pencil className="absolute top-4 right-4 w-4 h-4 text-tertiary opacity-0 group-hover:opacity-40 transition-opacity" />
                <p className="text-on-surface leading-relaxed text-sm md:text-base whitespace-pre-wrap">{clip.userNote}</p>
              </div>
            ) : (
              <button
                onClick={() => { setNoteDraft(''); setEditingNote(true); }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-tertiary/30 text-tertiary/60 hover:border-tertiary/50 hover:text-tertiary/80 transition-colors text-sm font-medium w-full justify-center"
              >
                <Plus className="w-4 h-4" />
                メモを追加
              </button>
            )}
          </div>

          {/* Translation */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <Languages className={clsx("w-4 h-4", isTranslating && "animate-pulse")} />
                {isTranslating ? '翻訳中...' : '翻訳'}
              </button>
              <span className="text-xs text-on-surface-variant">
                → {(typeof window !== 'undefined' && localStorage.getItem('preferred_language')) || '日本語'}
                <a href="/settings" className="ml-2 text-primary hover:underline">変更</a>
              </span>
            </div>

            {translatedText && (
              <div className="p-6 bg-secondary/5 border border-secondary/20 rounded-2xl relative">
                <div className="absolute -top-3 left-6 bg-surface px-2 text-[10px] font-bold text-secondary tracking-widest uppercase">Translation</div>
                <p className="text-on-surface leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                  {translatedText}
                </p>
              </div>
            )}
          </div>

          {/* Main Body */}
          {clip.body ? (
            <div>
              <div className="relative">
                <div
                  className={clsx(
                    'prose-body prose-readable prose-compact overflow-hidden transition-all duration-300',
                    !isBodyExpanded && 'max-h-[9rem]'
                  )}
                >
                  {/<[a-z][\s\S]*>/i.test(clip.body)
                    ? <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{clip.body}</ReactMarkdown>
                    : <div className="whitespace-pre-wrap text-base md:text-[1.0625rem] text-on-surface leading-[2]">{formatPlainArticleText(clip.body)}</div>
                  }
                </div>
                {!isBodyExpanded && (
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                )}
              </div>
              <button
                onClick={() => setIsBodyExpanded(v => !v)}
                className="mt-2 text-xs font-medium text-primary hover:opacity-70 transition-opacity"
              >
                {isBodyExpanded ? '閉じる ↑' : 'もっと見る ↓'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-outline border-2 border-dashed border-outline-variant/30 rounded-2xl">
              {clip.type === 'url' ? <Book className="w-12 h-12 mb-4 opacity-50" /> : <FileText className="w-12 h-12 mb-4 opacity-50" />}
              <p>本文データがありません。</p>
            </div>
          )}

          {/* Re-run AI + Global toggle */}
          <div className="mt-10 pt-6 border-t border-outline-variant/20 flex items-center justify-between gap-4 flex-wrap">
            <button
              onClick={() => updateClip(clip.id, { isGlobalSearch: !clip.isGlobalSearch })}
              className="flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className={clsx(
                "inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
                clip.isGlobalSearch ? "bg-primary" : "bg-outline-variant/40"
              )}>
                <span className={clsx(
                  "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  clip.isGlobalSearch ? "translate-x-[1.375rem]" : "translate-x-0.5"
                )} />
              </span>
              <Globe className="w-3.5 h-3.5" />
              グローバル検索に公開
            </button>
            <button
              onClick={() => processClipAI(clip.id, clip.body || clip.userNote || '')}
              disabled={processingJobs[clip.id] === 'enriching'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-on-surface-variant text-xs font-medium hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", processingJobs[clip.id] === 'enriching' && "animate-spin")} />
              {processingJobs[clip.id] === 'enriching' ? 'AI整理中...' : 'このクリップを再度AI整理する'}
            </button>
          </div>

          {/* コメントセクション（公開クリップのみ） */}
          {clip.isGlobalSearch && <CommentSection clipId={id} />}

          {!clip.isGlobalSearch && (
            <p className="mt-6 text-xs text-on-surface-variant">
              グローバル検索に公開するとコメントを受け付けられます。
            </p>
          )}
        </div>
      </div>
      {readEffect && (
        <CelebrationEffect type="read" origin={readEffect.origin} onDone={() => setReadEffect(null)} />
      )}
      {showAiEffect && (
        <CelebrationEffect type="ai" onDone={() => setShowAiEffect(false)} />
      )}
    </AppShell>
  );
}
