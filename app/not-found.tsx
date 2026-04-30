import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/throwin-symbol-source.png" alt="" width={44} height={44} className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-1.5" />
          <span className="text-sm font-semibold text-on-surface">Throw In</span>
        </div>

        <section className="grid gap-10 py-14 md:grid-cols-[1fr_320px] md:items-end">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">404 / Not Found</p>
              <h1 className="max-w-2xl text-5xl font-semibold leading-[1.12] tracking-normal text-on-surface md:text-7xl">
                見つからないものは、いったん戻そう。
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-on-surface-variant">
                このページは削除されたか、URLが変わった可能性があります。ライブラリへ戻るか、公開クリップを検索してください。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="brand-button-primary">
                <ArrowLeft className="h-4 w-4" />
                ライブラリへ戻る
              </Link>
              <Link href="/search" className="brand-button-secondary">
                <Search className="h-4 w-4" />
                グローバルクリップを探す
              </Link>
            </div>
          </div>

          <div className="brand-panel-muted p-6">
            <div className="aspect-square rounded-[28px] border border-outline-variant/20 bg-surface-container-lowest p-8">
              <Image src="/brand/throwin-symbol-source.png" alt="" width={240} height={240} className="h-full w-full object-contain opacity-80" />
            </div>
          </div>
        </section>

        <p className="text-xs text-outline">Throw In / 投げ入れるように、気になるを整理しよう。</p>
      </div>
    </main>
  );
}
