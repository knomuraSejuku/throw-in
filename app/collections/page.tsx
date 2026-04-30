'use client';

import { useState, useEffect } from 'react';
import type React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { useCollectionStore } from '@/lib/store';
import { Folder, Loader2, Plus, Trash2 } from 'lucide-react';
import { CreateCollectionDialog } from '@/components/collections/CreateCollectionDialog';

export default function CollectionsPage() {
  const { collections, fetchCollections, deleteCollection, isLoading } = useCollectionStore();
  const [showDialog, setShowDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const handleDelete = async (event: React.MouseEvent, id: string, name: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (deletingId) return;
    if (!window.confirm(`「${name}」を削除しますか？クリップ自体は削除されません。`)) return;

    setDeletingId(id);
    try {
      await deleteCollection(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="brand-page-title">コレクション</h1>
          {collections.length > 0 && (
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-transform shadow-primary"
            >
              <Plus className="w-4 h-4" />
              新規作成
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-outline" />
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
              <Folder className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-bold text-on-surface">コレクションはまだありません。</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                複数のクリップをまとめて整理したり、プロジェクトごとに分類するためのフォルダを作成できます。
              </p>
            </div>
            <button
              onClick={() => setShowDialog(true)}
              className="px-8 py-3 bg-primary text-white rounded-full font-bold shadow-primary hover:scale-105 active:scale-95 transition-all"
            >
              コレクションを作成
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map(col => (
              <Link
                key={col.id}
                href={`/?collection=${col.id}`}
                className="group relative bg-surface-container-lowest p-6 rounded-[32px] shadow-ambient hover:shadow-card-hover hover:-translate-y-1 transition-all"
              >
                <button
                  type="button"
                  onClick={(event) => handleDelete(event, col.id, col.name)}
                  disabled={deletingId === col.id}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/25 bg-surface-container-lowest text-on-surface-variant opacity-100 transition-all hover:bg-error-container hover:text-error focus:opacity-100 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                  title="コレクションを削除"
                >
                  {deletingId === col.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                  <Folder className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="font-bold text-on-surface text-lg">{col.name}</h3>
                {col.description && (
                  <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{col.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {showDialog && <CreateCollectionDialog onClose={() => setShowDialog(false)} />}
      </div>
    </AppShell>
  );
}
