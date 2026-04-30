'use client';

import { AdminTablePage } from '@/components/admin/AdminTablePage';

export default function AdminBillingPage() {
  return (
    <AdminTablePage
      title="課金管理"
      description="契約状態、請求間隔、プランを確認します。"
      endpoint="/api/admin/billing"
      dataKey="subscriptions"
      emptyText="契約情報はありません。"
      columns={[
        { key: 'users', label: 'User', render: row => row.users?.email ?? '-' },
        { key: 'billing_plans', label: 'Plan', render: row => row.billing_plans?.name ?? '-' },
        { key: 'billing_interval', label: 'Interval' },
        { key: 'status', label: 'Status' },
        { key: 'current_period_end', label: 'Period End', render: row => row.current_period_end ? new Date(row.current_period_end).toLocaleDateString('ja-JP') : '-' },
      ]}
    />
  );
}
