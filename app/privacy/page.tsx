import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = {
  title: 'プライバシーポリシー | Throw In',
};

const SECTIONS = [
  {
    title: '1. 収集する情報',
    body: 'Throw Inは、アカウント情報、プロフィール情報、保存したクリップ、閲覧履歴、ブックマーク、フォロー関係など、サービス提供に必要な情報を収集します。',
  },
  {
    title: '2. 情報の利用目的',
    body: '収集した情報は、サービスの提供・運営・改善、ユーザー認証、アカウント管理、AIによる要約・タグ付け、公開設定されたクリップの表示に利用します。',
  },
  {
    title: '3. 情報の共有',
    body: 'ユーザーが公開設定にしたクリップは、他のユーザーおよびサービス訪問者に表示されます。それ以外の個人情報は、法令に基づく場合またはサービス運営に必要な外部サービスへの提供を除き、第三者と共有しません。',
  },
  {
    title: '4. データの保管',
    body: 'データはSupabaseおよび関連するクラウドサービス上に保管されます。認証セッションの維持やサービス運営に必要な範囲でCookieを利用します。',
  },
  {
    title: '5. データの削除',
    body: 'アカウント削除を希望する場合は、設定画面または下記連絡先からお問い合わせください。必要な確認後、アカウントに紐づくデータを削除します。',
  },
  {
    title: '6. 改定',
    body: '本ポリシーは、機能追加や法令変更に応じて改定されることがあります。重要な変更がある場合は、サービス上で通知します。',
  },
];

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-8">
          <Link href="/login" className="brand-button-secondary">
            <ArrowLeft className="h-4 w-4" />
            ログインに戻る
          </Link>
        </div>

        <header className="mb-10 border-b border-outline-variant/20 pb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-outline">Privacy Policy</p>
          <h1 className="brand-page-title">プライバシーポリシー</h1>
          <p className="brand-page-kicker mt-3">最終更新: 2026年4月26日</p>
        </header>

        <div className="grid gap-4">
          {SECTIONS.map(section => (
            <section key={section.title} className="brand-panel p-5 md:p-6">
              <h2 className="text-base font-semibold text-on-surface">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{section.body}</p>
            </section>
          ))}

          <section className="brand-panel-muted p-5 md:p-6">
            <h2 className="text-base font-semibold text-on-surface">お問い合わせ</h2>
            <a href="mailto:knomura@cyder.studio" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-on-surface hover:text-primary">
              <Mail className="h-4 w-4" />
              knomura@cyder.studio
            </a>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
