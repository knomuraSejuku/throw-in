import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

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
      { type: 'feat', label: '新機能', text: 'AI 要約 + タグ付け自動化（gpt-4o-mini）' },
      { type: 'feat', label: '新機能', text: 'セマンティック検索（pgvector + text-embedding-3-small）' },
      { type: 'feat', label: '新機能', text: 'PDF / 動画（YouTube）のクリップ保存対応' },
      { type: 'fix', label: '修正', text: 'タグ重複 insert バグを修正' },
    ],
  },
];

const TYPE_COLORS: Record<string, string> = {
  feat: 'bg-primary/10 text-primary',
  improve: 'bg-secondary/10 text-secondary',
  fix: 'bg-tertiary/10 text-tertiary',
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="w-full max-w-2xl mx-auto px-6 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-4 h-4" />
          ホームに戻る
        </Link>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-on-surface">更新情報</h1>
          <p className="text-sm text-on-surface-variant">Throw In の新機能・改善・バグ修正の記録</p>
        </div>

        <div className="space-y-10">
          {RELEASES.map(release => (
            <div key={release.version} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-on-surface">v{release.version}</span>
                <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{release.date}</span>
              </div>
              <ul className="space-y-2">
                {release.entries.map((entry, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex-shrink-0 text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_COLORS[entry.type] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {entry.label}
                    </span>
                    <span className="text-sm text-on-surface-variant leading-relaxed">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
