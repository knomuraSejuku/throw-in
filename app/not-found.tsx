import Link from 'next/link';
import { Library, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <div className="relative inline-block">
          <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center mb-6 mx-auto">
            <Library className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-error/10 rounded-full flex items-center justify-center border-2 border-background">
            <span className="text-error font-black text-xs">404</span>
          </div>
        </div>
        <h1 className="text-6xl font-black text-on-surface tracking-tight mb-2">404</h1>
        <h2 className="text-xl font-bold text-on-surface mb-3">ページが見つかりません</h2>
        <p className="text-on-surface-variant text-sm max-w-xs mx-auto leading-relaxed">
          このページは存在しないか、削除された可能性があります。
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm shadow-primary hover:scale-105 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          ライブラリへ戻る
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-2 px-6 py-3 bg-surface-container-low text-on-surface rounded-full font-bold text-sm hover:bg-surface-container transition-colors"
        >
          <Search className="w-4 h-4" />
          検索する
        </Link>
      </div>

      <div className="mt-16 flex items-center gap-3 opacity-30">
        <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
          <Library className="w-3.5 h-3.5 text-on-primary" />
        </div>
        <span className="text-xs font-logo text-on-surface">Throw In</span>
      </div>
    </div>
  );
}
