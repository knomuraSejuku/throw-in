'use client';

import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type AdminTablePageProps = {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  emptyText: string;
};

export function AdminTablePage({ title, description, endpoint, dataKey, columns, emptyText }: AdminTablePageProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(endpoint)
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'データを取得できません。');
        setRows(data?.[dataKey] ?? []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'データを取得できません。'))
      .finally(() => setLoading(false));
  }, [dataKey, endpoint]);

  return (
    <AppShell>
      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <Link href="/admin" className="brand-button-secondary">
          <ArrowLeft className="w-5 h-5" />
          管理ダッシュボードに戻る
        </Link>

        <div>
          <h1 className="brand-page-title">{title}</h1>
          <p className="brand-page-kicker">{description}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-outline" /></div>
        ) : error ? (
          <div className="brand-panel p-8 text-error">{error}</div>
        ) : rows.length === 0 ? (
          <div className="brand-panel p-8 text-on-surface-variant">{emptyText}</div>
        ) : (
          <div className="brand-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-outline">
                  <tr>
                    {columns.map(column => (
                      <th key={column.key} className="px-5 py-4">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {rows.map((row, index) => (
                    <tr key={row.id ?? index} className="hover:bg-surface-container-low">
                      {columns.map(column => (
                        <td key={column.key} className="px-5 py-4 text-on-surface-variant">
                          {column.render ? column.render(row) : String(row[column.key] ?? '')}
                        </td>
                      ))}
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
