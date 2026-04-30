'use client';

import { AppShell } from '@/components/shell/AppShell';
import { History, FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import Image from 'next/image';

interface HistoryRecord {
  id: string;
  viewed_at: string;
  clip: {
    id: string;
    title: string;
    content_type: string;
    source_domain: string | null;
    created_at: string;
    preview_image_url: string | null;
  };
}

export default function HistoryPage() {
  const [histories, setHistories] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('history')
        .select(`
          id,
          viewed_at,
          clip:clips (
            id, title, content_type, source_domain, created_at, preview_image_url
          )
        `)
        .order('viewed_at', { ascending: false })
        .limit(50);
        
      if (!error && data) {
        setHistories(data as unknown as HistoryRecord[]);
      }
      setIsLoading(false);
    }
    
    fetchHistory();
  }, []);

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8 flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <h1 className="brand-page-title">閲覧履歴</h1>
        </div>

        {isLoading ? (
          <div className="w-full py-20 flex flex-col items-center justify-center text-outline">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">履歴を読み込んでいます...</p>
          </div>
        ) : histories.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
              <History className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-bold text-on-surface">閲覧履歴はまだありません。</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                クリップを開くと、最近チェックした情報をここからすばやく見返すことができます。
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
             {histories.map(record => {
               if(!record.clip) return null; // Defensive check for deleted clips
               return (
               <Link href={`/clip/${record.clip.id}`} key={record.id} className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border border-outline-variant/10 bg-surface-container-lowest hover:shadow-ambient hover:-translate-y-0.5">
                 
                 {/* Thumbnail */}
                 <div className="hidden sm:block w-24 aspect-video bg-surface-container-highest rounded-lg overflow-hidden relative flex-shrink-0">
                    {record.clip.preview_image_url ? (
                      <Image src={record.clip.preview_image_url} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline-variant">
                         <FileText className="w-6 h-6" />
                      </div>
                    )}
                 </div>
                 
                 {/* Content */}
                 <div className="flex-1 min-w-0 flex flex-col justify-center">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-outline font-medium tracking-tight">
                        {new Date(record.viewed_at).toLocaleString('ja-JP')} に閲覧
                      </span>
                   </div>
                   <h3 className="brand-title-wrap line-clamp-2 text-base font-bold leading-tight text-on-surface">
                    {record.clip.title}
                   </h3>
                   <span className="text-xs text-outline truncate mt-1">{record.clip.source_domain || new Date(record.clip.created_at).toLocaleDateString('ja-JP')}</span>
                 </div>
               </Link>
             )})}
          </div>
        )}
      </div>
    </AppShell>
  );
}
