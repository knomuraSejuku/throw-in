'use client';

import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, Database } from 'lucide-react';
import Link from 'next/link';

export default function AdminJobsPage() {
  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Link href="/admin" className="brand-button-secondary mb-8">
          <ArrowLeft className="w-5 h-5" />
          管理ダッシュボードに戻る
        </Link>
        <div className="flex items-center gap-4 mb-8">
          <Database className="w-8 h-8 text-primary" />
          <h1 className="brand-page-title">ジョブ管理</h1>
        </div>
        <div className="bg-surface-container-lowest rounded-[32px] p-12 text-center shadow-ambient border border-outline-variant/20">
          <p className="text-on-surface-variant">実装予定</p>
        </div>
      </div>
    </AppShell>
  );
}
