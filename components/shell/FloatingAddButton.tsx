'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

export function FloatingAddButton() {
  return (
    <Link
      href="/add"
      className="fixed bottom-24 lg:bottom-8 right-6 lg:right-8 w-14 h-14 lg:w-16 lg:h-16 bg-primary rounded-full text-on-primary shadow-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      aria-label="新しいクリップを追加"
    >
      <Plus className="w-8 h-8" />
    </Link>
  );
}
