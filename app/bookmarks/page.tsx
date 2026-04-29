'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Bookmark, FileText, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { useClipStore } from '@/lib/store';

export default function BookmarksPage() {
  const { clips, fetchClips, isLoading } = useClipStore();

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const bookmarked = clips.filter(c => c.isBookmarked);

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <h2 className="text-2xl font-bold text-on-surface mb-6">ブックマーク</h2>

        {isLoading ? (
          <div className="w-full py-20 flex flex-col items-center justify-center text-outline">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">読み込んでいます...</p>
          </div>
        ) : bookmarked.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
              <Bookmark className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-bold text-on-surface">ブックマークはまだありません</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                ライブラリで重要なクリップにブックマークを付けると、ここからすぐにアクセスできます。
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {bookmarked.map(clip => (
              <Link href={`/clip/${clip.id}`} key={clip.id} className={clsx(
                "group rounded-[32px] p-6 transition-all duration-300 flex flex-col h-full cursor-pointer",
                clip.isUnread
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
                  <Bookmark className="w-4 h-4 text-primary fill-primary" />
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

                <h3 className={clsx(
                  "text-lg font-bold mb-2 leading-tight line-clamp-2",
                  clip.isUnread ? "text-on-surface" : "text-on-surface-variant"
                )}>
                  {clip.title}
                </h3>

                {clip.summary && (
                  <p className="text-sm text-on-surface-variant mb-4 line-clamp-2">{clip.summary}</p>
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

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-outline-variant/10">
                  <span className="text-xs text-outline">{clip.date}</span>
                  <span className="text-xs text-outline truncate ml-2">{clip.domain}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
