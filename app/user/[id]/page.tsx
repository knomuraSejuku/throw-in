'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Globe, FileText, Loader2, UserPlus, UserCheck, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/auth-store';

const TYPE_LABELS: Record<string, string> = {
  url: '記事', video: '動画', image: '画像', pdf: 'ドキュメント', diary: '日記・メモ',
};

interface PublicClip {
  id: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  domain?: string | null;
  thumbnail?: string | null;
  type: string;
  typeLabel: string;
  date: string;
  tags?: string[];
  fileName?: string | null;
}

interface UserProfile {
  display_name: string | null;
  avatar_emoji: string | null;
}

export default function UserPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clips, setClips] = useState<PublicClip[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followInitialized, setFollowInitialized] = useState(false);

  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<{ id: string; displayName: string; avatarEmoji: string }[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const isOwnPage = !authLoading && user?.id === id;
  const isAuthenticated = !authLoading && user !== null;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?userId=${id}&limit=100`);
        const data = await res.json();
        const mapped: PublicClip[] = (data.clips ?? []).map((c: any) => ({
          ...c,
          typeLabel: TYPE_LABELS[c.type] ?? c.type,
        }));
        setClips(mapped);
        if (data.clips?.[0]) {
          setProfile({
            display_name: data.clips[0].displayName ?? null,
            avatar_emoji: data.clips[0].avatarEmoji ?? '🙂',
          });
        } else if (data.profile) {
          setProfile(data.profile);
        }
      } catch {
        setClips([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const loadFollowStatus = useCallback(async () => {
    const res = await fetch(`/api/follow?userId=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setFollowerCount(data.followerCount ?? 0);
    setFollowingCount(data.followingCount ?? 0);
    setIsFollowing(data.isFollowing ?? false);
    setFollowInitialized(true);
  }, [id]);

  useEffect(() => {
    if (!authLoading) loadFollowStatus();
  }, [authLoading, loadFollowStatus]);

  const openList = async (type: 'followers' | 'following') => {
    setListModal(type);
    setListLoading(true);
    try {
      const res = await fetch(`/api/follow/list?userId=${id}&type=${type}`);
      const data = await res.json();
      setListUsers(data.users ?? []);
    } catch {
      setListUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated || followLoading) return;
    setFollowLoading(true);
    const method = isFollowing ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`/api/follow?userId=${id}`, { method });
      if (res.ok) {
        setIsFollowing(f => !f);
        setFollowerCount(n => isFollowing ? n - 1 : n + 1);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">

        <Link href="/search" className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-4 h-4" />
          検索に戻る
        </Link>

        {/* Profile header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-4xl border-2 border-outline-variant/20">
              {profile?.avatar_emoji ?? '🙂'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">
                {profile?.display_name ?? '匿名ユーザー'}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Globe className="w-3.5 h-3.5" />
                  公開クリップ {loading ? '...' : `${clips.length}件`}
                </div>
                {followInitialized && (
                  <>
                    <button
                      onClick={() => openList('following')}
                      className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                    >
                      フォロー中 <span className="font-bold">{followingCount}</span>人
                    </button>
                    <button
                      onClick={() => openList('followers')}
                      className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                    >
                      フォロワー <span className="font-bold">{followerCount}</span>人
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Follow button — only show for other users */}
          {!isOwnPage && isAuthenticated && followInitialized && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all",
                followLoading && "opacity-50 cursor-not-allowed",
                isFollowing
                  ? "bg-surface-container-high text-on-surface border border-outline-variant/30 hover:bg-error/10 hover:text-error hover:border-error/30"
                  : "bg-primary text-white hover:opacity-90 shadow-sm"
              )}
            >
              {followLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isFollowing ? (
                <UserCheck className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {isFollowing ? 'フォロー中' : 'フォロー'}
            </button>
          )}
        </div>

        {/* Followers / Following modal */}
        {listModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setListModal(null)}
          >
            <div
              className="bg-surface-container-lowest rounded-[32px] w-full max-w-sm p-6 space-y-4 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">
                  {listModal === 'followers' ? 'フォロワー' : 'フォロー中'}
                </h2>
                <button onClick={() => setListModal(null)} className="text-outline hover:text-on-surface transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {listLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-outline" />
                </div>
              ) : listUsers.length === 0 ? (
                <p className="text-center text-sm text-on-surface-variant py-8">まだいません</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {listUsers.map(u => (
                    <li key={u.id}>
                      <Link
                        href={`/user/${u.id}`}
                        onClick={() => setListModal(null)}
                        className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-container-high transition-colors"
                      >
                        <span className="text-2xl leading-none">{u.avatarEmoji}</span>
                        <span className="text-sm font-medium text-on-surface">{u.displayName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Clips grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-outline" />
          </div>
        ) : clips.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant text-sm">
            公開クリップがありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clips.map(clip => (
              <a
                key={clip.id}
                href={`/view/${clip.id}`}
                className="group bg-surface-container-lowest rounded-[32px] overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {clip.thumbnail ? (
                  <div className="aspect-video relative overflow-hidden bg-surface-container-high">
                    <Image src={clip.thumbnail} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute top-4 left-4">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-white",
                        clip.type === 'url' ? "bg-tertiary" : clip.type === 'video' ? "bg-secondary" : "bg-primary"
                      )}>{clip.typeLabel}</span>
                    </div>
                  </div>
                ) : clip.type === 'pdf' && clip.fileName ? (
                  <div className="p-4 bg-surface-container-high/50 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                    <div className="text-xs font-bold text-on-surface truncate">{clip.fileName}</div>
                  </div>
                ) : null}

                <div className="p-6 flex-1 flex flex-col space-y-2">
                  {!clip.thumbnail && (
                    <span className={clsx(
                      "self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      clip.type === 'url' && "bg-tertiary/10 text-tertiary",
                      clip.type === 'pdf' && "bg-primary/10 text-primary",
                      clip.type === 'video' && "bg-secondary/10 text-secondary",
                      clip.type === 'diary' && "bg-outline/10 text-outline"
                    )}>{clip.typeLabel}</span>
                  )}
                  <h3 className="text-base font-bold text-on-surface line-clamp-2 leading-snug">{clip.title}</h3>
                  {clip.summary && (
                    <p className="text-on-surface-variant text-sm line-clamp-2 leading-relaxed">{clip.summary}</p>
                  )}
                  <div className="flex-1" />
                  {clip.tags && clip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {clip.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                      {clip.tags.length > 5 && (
                        <span className="text-[10px] text-outline px-1 py-0.5">+{clip.tags.length - 5}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                    <span className="text-xs text-outline">{clip.date}</span>
                    <span className="text-xs text-outline truncate ml-2">{clip.domain}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
