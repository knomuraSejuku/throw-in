'use client';

import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  saveCount: number;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  planName: string | null;
  weeklyAiLimit: number | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'ユーザーを取得できません。');
        setUsers(data.users ?? []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'ユーザーを取得できません。'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <Link href="/admin" className="brand-button-secondary">
          <ArrowLeft className="w-5 h-5" />
          管理ダッシュボードに戻る
        </Link>
        <div className="flex items-center gap-4">
          <ShieldAlert className="w-8 h-8 text-primary" />
          <div>
            <h1 className="brand-page-title">ユーザー管理</h1>
            <p className="brand-page-kicker">ユーザー、保存数、契約プランの確認</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-outline" /></div>
        ) : error ? (
          <div className="brand-panel p-8 text-error">{error}</div>
        ) : (
          <div className="brand-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-outline">
                  <tr>
                    <th className="px-5 py-4">User</th>
                    <th className="px-5 py-4">Plan</th>
                    <th className="px-5 py-4">AI/week</th>
                    <th className="px-5 py-4">Saves</th>
                    <th className="px-5 py-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-surface-container-low">
                      <td className="px-5 py-4">
                        <p className="font-bold text-on-surface">{user.displayName || '匿名'}</p>
                        <p className="text-xs text-on-surface-variant">{user.email}</p>
                      </td>
                      <td className="px-5 py-4 text-on-surface">{user.planName ?? '-'}</td>
                      <td className="px-5 py-4 text-on-surface-variant">{user.weeklyAiLimit ?? '-'}</td>
                      <td className="px-5 py-4 text-on-surface-variant">{user.saveCount}</td>
                      <td className="px-5 py-4 text-on-surface-variant">{new Date(user.createdAt).toLocaleDateString('ja-JP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
