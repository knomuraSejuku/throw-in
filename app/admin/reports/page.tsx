'use client';

import { AdminTablePage } from '@/components/admin/AdminTablePage';

export default function AdminReportsPage() {
  return (
    <AdminTablePage
      title="通報管理"
      description="ユーザーからの通報と対応状況を確認します。"
      endpoint="/api/admin/reports"
      dataKey="reports"
      emptyText="通報はありません。"
      columns={[
        { key: 'reason', label: 'Reason', render: row => <span className="font-bold text-on-surface">{row.reason}</span> },
        { key: 'detail', label: 'Detail' },
        { key: 'status', label: 'Status' },
        { key: 'created_at', label: 'Created', render: row => new Date(row.created_at).toLocaleDateString('ja-JP') },
      ]}
    />
  );
}
