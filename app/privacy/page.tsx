import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'プライバシーポリシー | Throw In',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="w-full max-w-2xl mx-auto px-6 py-12 space-y-8">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-4 h-4" />
          ログインに戻る
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-on-surface">プライバシーポリシー</h1>
          <p className="text-sm text-on-surface-variant">最終更新: 2026年4月26日</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-on-surface">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">1. 収集する情報</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Throw In（以下「本サービス」）は、以下の情報を収集します。
            </p>
            <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
              <li>アカウント情報（メールアドレス、Googleアカウント情報）</li>
              <li>プロフィール情報（表示名、アバター絵文字）</li>
              <li>保存したクリップのコンテンツ（URL、タイトル、要約、タグ等）</li>
              <li>閲覧履歴およびブックマーク情報</li>
              <li>フォロー/フォロワー関係</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">2. 情報の利用目的</h2>
            <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
              <li>サービスの提供・運営・改善</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>AI による自動要約・タグ付け機能の提供</li>
              <li>公開設定されたクリップの他ユーザーへの表示</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">3. 情報の共有</h2>
            <p className="text-on-surface-variant leading-relaxed">
              本サービスは、以下の場合を除きユーザーの個人情報を第三者と共有しません。
            </p>
            <ul className="list-disc list-inside space-y-1 text-on-surface-variant">
              <li>ユーザーが公開設定としたクリップは、他のユーザーおよびサービス訪問者に表示されます</li>
              <li>法令に基づく開示が必要な場合</li>
              <li>サービス運営に必要なクラウドサービス（Supabase、Vercel）への提供</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">4. データの保管</h2>
            <p className="text-on-surface-variant leading-relaxed">
              データは Supabase（PostgreSQL）上に保管されます。OpenAI API キーはお客様のデバイスのローカルストレージにのみ保存され、サーバーには送信されません。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">5. データの削除</h2>
            <p className="text-on-surface-variant leading-relaxed">
              アカウントの削除をご希望の場合は、下記の連絡先までお問い合わせください。アカウントに紐づく全データを削除します。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">6. Cookie の利用</h2>
            <p className="text-on-surface-variant leading-relaxed">
              本サービスは認証セッションの維持にCookieを使用します。ブラウザの設定でCookieを無効にすると、サービスを正常に利用できない場合があります。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-on-surface">7. お問い合わせ</h2>
            <p className="text-on-surface-variant leading-relaxed">
              プライバシーに関するご質問は以下にお送りください。
            </p>
            <p className="text-on-surface-variant">
              メール:{' '}
              <a href="mailto:knomura@cyder.studio" className="text-primary hover:underline">
                knomura@cyder.studio
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
