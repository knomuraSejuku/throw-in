'use client';
import { useState } from 'react';
import { useCollectionStore } from '@/lib/store';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function CreateCollectionDialog({ onClose }: Props) {
  const { createCollection } = useCollectionStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    await createCollection(name.trim(), description.trim() || undefined);
    setIsSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="bg-surface rounded-[32px] p-8 w-full max-w-md shadow-2xl space-y-6"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">コレクションを作成</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="コレクション名"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <textarea
            placeholder="説明（任意）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || isSaving}
          className="w-full py-3 bg-primary text-white rounded-full font-bold disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          {isSaving ? '作成中...' : '作成する'}
        </button>
      </form>
    </div>
  );
}
