'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Bell, Loader2, MessageCircle, Heart, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: string;
  data: Record<string, string> | null;
  read: boolean;
  created_at: string;
  actorName?: string | null;
  actorEmoji?: string | null;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  comment_on_clip: <MessageCircle className="w-4 h-4 text-primary" />,
  comment_reply: <MessageCircle className="w-4 h-4 text-secondary" />,
  like: <Heart className="w-4 h-4 text-error" />,
  follow: <UserPlus className="w-4 h-4 text-tertiary" />,
};

const TYPE_LABEL: Record<string, string> = {
  comment_on_clip: 'があなたのクリップにコメントしました',
  comment_reply: 'があなたのコメントに返信しました',
  like: 'があなたのコメントにいいねしました',
  follow: 'があなたをフォローしました',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications?limit=50');
    if (!res.ok) { setLoading(false); return; }
    const { notifications: raw } = await res.json() as { notifications: Notification[] };

    // Enrich actor profiles in batch
    const actorIds = [...new Set((raw ?? []).map(n => n.data?.actor_id).filter(Boolean))] as string[];
    let profileMap: Record<string, { display_name: string | null; avatar_emoji: string | null }> = {};
    if (actorIds.length > 0) {
      const supabase = createClient();
      const { data } = await supabase.from('profiles').select('id, display_name, avatar_emoji').in('id', actorIds);
      (data ?? []).forEach(p => { profileMap[p.id] = p; });
    }

    setNotifications((raw ?? []).map(n => ({
      ...n,
      actorName: n.data?.actor_id ? profileMap[n.data.actor_id]?.display_name : null,
      actorEmoji: n.data?.actor_id ? profileMap[n.data.actor_id]?.avatar_emoji : null,
    })));
    setLoading(false);

    // Mark all as read
    if ((raw ?? []).some(n => !n.read)) {
      await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <AppShell>
      <div className="w-full max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-on-surface flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" />
            通知
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-outline" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant text-sm">通知はありません</div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  const relTime = new Date(n.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const icon = TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-on-surface-variant" />;
  const label = TYPE_LABEL[n.type] ?? n.type;
  const clipLink = n.data?.clip_id ? `/view/${n.data.clip_id}` : null;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
      n.read ? 'bg-surface-container-lowest border-outline-variant/10' : 'bg-primary/5 border-primary/20'
    }`}>
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface">
          <span className="font-bold">{n.actorEmoji ?? '🙂'} {n.actorName ?? '匿名'}</span>
          {label}
        </p>
        {clipLink && (
          <Link href={clipLink} className="text-xs text-primary hover:underline mt-0.5 block">
            クリップを見る
          </Link>
        )}
        <p className="text-[10px] text-on-surface-variant mt-1">{relTime}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
    </div>
  );
}
