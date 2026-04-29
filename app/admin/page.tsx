'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Activity, Database, LayoutTemplate, ShieldAlert, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useClipStore } from '@/lib/store';

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

export default function AdminPage() {
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

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">管理ダッシュボード</h1>
          <p className="text-on-surface-variant text-sm font-medium">システム監視と運用ポリシーの管理</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/jobs" className="bg-surface-container-lowest p-8 border border-outline-variant/20 rounded-[32px] hover:shadow-card-hover transition-all cursor-pointer block">
            <Database className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-bold text-on-surface mb-2">ジョブ管理</h3>
            <p className="text-sm text-on-surface-variant">待機中、実行中、失敗したバックグラウンドジョブを確認し、再試行します。</p>
          </Link>

          <Link href="/admin/cards" className="bg-surface-container-lowest p-8 border border-outline-variant/20 rounded-[32px] hover:shadow-card-hover transition-all cursor-pointer block">
            <LayoutTemplate className="w-8 h-8 text-tertiary mb-4" />
            <h3 className="text-lg font-bold text-on-surface mb-2">公開カードレビュー</h3>
            <p className="text-sm text-on-surface-variant">生成された公開カード候補の審査、承認、抑制を行います。</p>
          </Link>

          <Link href="/admin/users" className="bg-surface-container-lowest p-8 border border-outline-variant/20 rounded-[32px] hover:shadow-card-hover transition-all cursor-pointer block">
            <ShieldAlert className="w-8 h-8 text-secondary mb-4" />
            <h3 className="text-lg font-bold text-on-surface mb-2">ユーザー管理</h3>
            <p className="text-sm text-on-surface-variant">PRO権限の付与、クオータ調整、アカウントの可視性を管理します。</p>
          </Link>
        </div>

        {/* Stats Breakdown */}
        {stats && (
          <div className="bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient">
            <h3 className="text-lg font-bold text-on-surface mb-6">クリップ内訳</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { key: 'article',  label: '記事',  color: 'text-tertiary  bg-tertiary/10' },
                { key: 'video',    label: '動画',  color: 'text-secondary bg-secondary/10' },
                { key: 'image',    label: '画像',  color: 'text-primary   bg-primary/10' },
                { key: 'document', label: 'PDF',   color: 'text-error     bg-error/10' },
                { key: 'note',     label: 'メモ',  color: 'text-outline   bg-surface-container-high' },
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

      </div>
    </AppShell>
  );
}
