'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Settings, LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { createClient } from '@/lib/supabase/client';

const PAGE_TITLES: Record<string, string> = {
  '/': 'すべてのクリップ',
  '/search': 'グローバルクリップ',
  '/following': 'フォロー中',
  '/history': '閲覧履歴',
  '/notifications': '通知',
  '/insights': 'インサイト',
  '/changelog': '更新情報',
  '/bookmarks': 'ブックマーク',
  '/settings': '設定',
  '/collections': 'コレクション',
};

function resolvePageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/clip/')) return 'クリップ詳細';
  if (pathname.startsWith('/view/')) return 'グローバルクリップ';
  if (pathname.startsWith('/user/')) return 'プロフィール';
  if (pathname.startsWith('/admin/')) return '管理';
  return '';
}

export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = resolvePageTitle(pathname);
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ displayName: string | null; avatarEmoji: string }>({ displayName: null, avatarEmoji: '🙂' });
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('users').select('display_name, avatar_emoji').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile({ displayName: data.display_name ?? null, avatarEmoji: data.avatar_emoji ?? '🙂' });
    });
  }, [user]);

  const fetchUnread = useCallback(() => {
    if (!user) return;
    fetch('/api/notifications?limit=1').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setUnreadCount(d.unreadCount ?? 0);
    });
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    document.cookie = 'demo_bypass=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=None; Secure';
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 w-full z-30 flex h-14 items-center justify-between px-4 md:px-6 lg:pl-80 bg-surface/88 backdrop-blur-xl border-b border-outline-variant/60">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <Image
          src="/icons/app-icon-192.png"
          alt=""
          width={32}
          height={32}
          className="h-7 w-7 rounded-lg border border-outline-variant/50 bg-surface-container-lowest object-cover"
        />
        <span className="truncate text-sm font-semibold tracking-normal text-on-surface">{title || 'Throw In'}</span>
      </div>
      <div className="hidden lg:flex items-center gap-4">
        {title && <span className="text-sm font-semibold tracking-normal text-on-surface-variant">{title}</span>}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <Link href="/notifications" onClick={() => setUnreadCount(0)}
            className="relative p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-lg border-2 border-surface hover:border-primary/30 transition-colors"
            aria-label="ユーザーメニュー"
          >
            {profile.avatarEmoji}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-outline-variant/10">
                <p className="text-sm font-bold text-on-surface truncate">{profile.displayName ?? '匿名ユーザー'}</p>
                <p className="text-xs text-on-surface-variant truncate">{user?.email ?? ''}</p>
              </div>
              <div className="py-1">
                {user && (
                  <Link
                    href={`/user/${user.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <User className="w-4 h-4 text-on-surface-variant" />
                    プロフィールを見る
                  </Link>
                )}
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <Settings className="w-4 h-4 text-on-surface-variant" />
                  設定
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
