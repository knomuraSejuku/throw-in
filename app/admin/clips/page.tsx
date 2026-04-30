'use client';

import { AdminTablePage } from '@/components/admin/AdminTablePage';

export default function AdminClipsPage() {
  return (
    <AdminTablePage
      title="クリップ管理"
      description="新規作成されたクリップ、公開状態、AI整理状態を確認します。"
      endpoint="/api/admin/clips"
      dataKey="clips"
      emptyText="クリップはありません。"
      columns={[
        { key: 'title', label: 'Title', render: row => <span className="font-bold text-on-surface line-clamp-2">{row.title}</span> },
        { key: 'content_type', label: 'Type' },
        { key: 'is_global_search', label: 'Global', render: row => row.is_global_search ? '公開' : '非公開' },
        { key: 'summary', label: 'AI', render: row => row.summary ? '整理済み' : '未整理' },
        { key: 'created_at', label: 'Created', render: row => new Date(row.created_at).toLocaleDateString('ja-JP') },
      ]}
    />
  );
}
