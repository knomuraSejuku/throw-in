'use client';

import { AppShell } from '@/components/shell/AppShell';
import { Share2, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SharePage() {
  const router = useRouter();

  return (
    <AppShell>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-on-surface/20 backdrop-blur-sm">
        <div className="bg-surface-container-lowest w-full max-w-lg rounded-[32px] shadow-2xl p-8 md:p-12 text-center space-y-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-2">
            <Share2 className="w-8 h-8" />
          </div>
          
          <h1 className="brand-page-title">共有から保存</h1>
          <p className="text-on-surface-variant text-sm">
            アプリやブラウザから連携された情報をクリップとして保存します。
          </p>

          <div className="bg-surface-container-low p-4 rounded-2xl text-left border border-outline-variant/20">
            <p className="font-bold text-on-surface truncate">React 19 RC Overview</p>
            <p className="text-xs text-outline truncate">https://react.dev/blog/2024/04/25/react-19</p>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold hover:scale-105 active:scale-95 transition-all shadow-primary"
            >
              <Check className="w-5 h-5" />
              この内容を保存する
            </button>
            <button 
              onClick={() => router.push('/add')}
              className="w-full py-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors"
            >
              手動で入力する
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
