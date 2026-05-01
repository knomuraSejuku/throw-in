import Link from 'next/link';
import { ArrowLeft, CircleDot } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = {
  title: '更新情報 | Throw In',
};

const RELEASES = [
  {
    version: '0.9.0',
    date: '2026-04-26',
    entries: [
      { type: 'feat', label: '新機能', text: 'フォロー中フィード — フォロー中のユーザーの公開クリップを一覧表示' },
      { type: 'feat', label: '新機能', text: 'フォロー/フォロワー一覧モーダル — プロフィールページからフォロー関係を確認可能に' },
      { type: 'feat', label: '新機能', text: 'Google Docs / Slides / Sheets の公開ドキュメントをクリップとして保存可能に' },
      { type: 'feat', label: '新機能', text: 'プライバシーポリシーページ追加' },
      { type: 'improve', label: '改善', text: 'トップナビゲーションのアバターアイコンをドロップダウンメニューに変更（設定・ログアウト・プロフィールへのアクセス）' },
      { type: 'improve', label: '改善', text: 'PWA インストール対応 — アプリアイコンを最適化し Chrome のインストールプロンプトが発火するように' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-04-25',
    entries: [
      { type: 'feat', label: '新機能', text: 'グローバルサーチ — 他のユーザーの公開クリップを検索可能に' },
      { type: 'feat', label: '新機能', text: 'フォロー機能 — ユーザーをフォローして公開クリップを追跡' },
      { type: 'feat', label: '新機能', text: 'ユーザープロフィールページ' },
      { type: 'improve', label: '改善', text: 'クリップカードにカテゴリ/サブカテゴリを表示' },
      { type: 'fix', label: '修正', text: '設定画面サイドバーのフォント色バグを修正' },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-04-20',
    entries: [
      { type: 'feat', label: '新機能', text: '重複クリップ検出 + AI 再整理ボタン' },
      { type: 'feat', label: '新機能', text: 'AI 整理完了時のアニメーション（グレー→青遷移 + 紙吹雪）' },
      { type: 'feat', label: '新機能', text: 'サイドバー・クリップ一覧に未読数/総クリップ数を表示' },
      { type: 'improve', label: '改善', text: 'LATEST COLLECTION を現在の絞り込み条件内の未読クリップローテーション表示に変更' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-04-15',
    entries: [
      { type: 'feat', label: '新機能', text: 'AI 要約 + タグ付け自動化（gpt-5-nano）' },
      { type: 'feat', label: '新機能', text: 'セマンティック検索（pgvector + text-embedding-3-small）' },
      { type: 'feat', label: '新機能', text: 'PDF / 動画（YouTube）のクリップ保存対応' },
      { type: 'fix', label: '修正', text: 'タグ重複 insert バグを修正' },
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  feat: 'bg-primary text-on-primary',
  improve: 'bg-surface-container-high text-on-surface',
  fix: 'bg-success-container text-success',
};

export default function ChangelogPage() {
  return (
    <AppShell>
      <div className="w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="brand-button-secondary">
            <ArrowLeft className="w-4 h-4" />
            ライブラリへ
          </Link>
          <span className="brand-chip">Release Notes</span>
        </div>

        <header className="border-b border-outline-variant/20 pb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-outline">Changelog</p>
          <h1 className="brand-page-title">更新情報</h1>
          <p className="brand-page-kicker mt-3">Throw In の変更を、必要な粒度で記録します。</p>
        </header>

        <div className="space-y-5">
          {RELEASES.map(release => (
            <section key={release.version} className="brand-panel p-5 md:p-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CircleDot className="h-4 w-4 text-on-surface" />
                  <h2 className="text-lg font-semibold text-on-surface">v{release.version}</h2>
                </div>
                <time className="text-xs font-semibold text-on-surface-variant">{release.date}</time>
              </div>
              <ul className="divide-y divide-outline-variant/15">
                {release.entries.map((entry, i) => (
                  <li key={i} className="grid gap-2 py-3 sm:grid-cols-[88px_1fr] sm:items-start">
                    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${TYPE_COLORS[entry.type] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {entry.label}
                    </span>
                    <span className="text-sm text-on-surface-variant leading-relaxed">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
