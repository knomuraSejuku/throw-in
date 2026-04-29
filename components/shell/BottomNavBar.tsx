'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Library, Folder, Bookmark, History, Search } from 'lucide-react';
import clsx from 'clsx';

export function BottomNavBar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'ライブラリ', href: '/', icon: Library },
    { label: 'コレクション', href: '/collections', icon: Folder },
    { label: '保存済み', href: '/bookmarks', icon: Bookmark },
    { label: '履歴', href: '/history', icon: History },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl flex justify-around items-center py-3 px-2 z-50 border-t border-outline-variant/10 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-col items-center justify-center w-16 gap-1 rounded-xl transition-colors",
              isActive ? "text-primary" : "text-outline"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className={clsx("text-[10px]", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
