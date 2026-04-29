'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ArrowLeft, ExternalLink, Clock, Hash, Tag, Loader2, BookmarkPlus, Check, Heart, Trash2, MessageCircle, Send, Pencil, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { useAuthStore } from '@/lib/auth-store';
import { CATEGORY_TAXONOMY } from '@/lib/store';

const TYPE_LABELS: Record<string, string> = {
  url: '記事', video: '動画', image: '画像', pdf: 'ドキュメント', diary: '日記・メモ',
};

interface Comment {
  id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; avatar_emoji: string | null } | null;
  likeCount: number;
  likedByMe: boolean;
}

interface PublicClip {
  id: string;
  title: string;
  summary?: string | null;
  keyPoints?: string | null;
  url?: string | null;
  domain?: string | null;
  thumbnail?: string | null;
  type: string;
  category?: string | null;
  subcategory?: string | null;
  date: string;
  tags?: string[];
  userId: string;
  displayName?: string | null;
  avatarEmoji?: string | null;
}

export default function PublicClipViewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const user = useAuthStore(s => s.user);
  const [clip, setClip] = useState<PublicClip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editSubcategory, setEditSubcategory] = useState<string>('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    fetch(`/api/public-clip/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        setClip(data.clip);
        setEditCategory(data.clip.category ?? '');
        setEditSubcategory(data.clip.subcategory ?? '');
        setEditTags(data.clip.tags ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchComments = useCallback(() => {
    fetch(`/api/comments?clipId=${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setComments(data.comments ?? []))
      .catch(() => {});
  }, [id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-outline" />
        </div>
      </AppShell>
    );
  }

  if (notFound || !clip) {
    return (
      <AppShell>
        <div className="flex flex-col h-screen items-center justify-center gap-4">
          <p className="text-xl font-bold text-on-surface">クリップが見つかりません。</p>
          <button onClick={() => router.back()} className="text-primary hover:underline">戻る</button>
        </div>
      </AppShell>
    );
  }

  const typeLabel = TYPE_LABELS[clip.type] ?? clip.type;
  const canSave = user && user.id !== clip.userId;
  const isOwner = user?.id === clip.userId;

  async function handleSave() {
    if (!canSave || saving || saved) return;
    setSaving(true);
    const res = await fetch('/api/save-clip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId: id }),
    });
    setSaving(false);
    if (res.ok || res.status === 409) setSaved(true);
  }

  async function handlePostComment() {
    if (!user || !commentText.trim() || posting) return;
    setPosting(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'post', clipId: id, content: commentText.trim(), parentId: replyTo }),
    });
    setPosting(false);
    if (res.ok) {
      setCommentText('');
      setReplyTo(null);
      fetchComments();
    }
  }

  async function handleLike(commentId: string) {
    if (!user) return;
    setComments(prev => prev.map(c => c.id === commentId
      ? { ...c, likedByMe: !c.likedByMe, likeCount: c.likedByMe ? c.likeCount - 1 : c.likeCount + 1 }
      : c
    ));
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', commentId }),
    });
  }

  async function handleDeleteComment(commentId: string) {
    if (!user) return;
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', commentId }),
    });
    fetchComments();
  }

  async function handleSaveMeta() {
    if (!clip) return;
    setSavingMeta(true);
    const res = await fetch(`/api/clips/${clip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: editCategory || null, subcategory: editSubcategory || null, tags: editTags }),
    });
    setSavingMeta(false);
    if (res.ok) {
      setClip(prev => prev ? { ...prev, category: editCategory || null, subcategory: editSubcategory || null, tags: editTags } : prev);
      setEditingMeta(false);
    }
  }

  const topLevel = comments.filter(c => !c.parent_id);

  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 pb-32">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <div className="flex items-center gap-2">
            {canSave && (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  saved
                    ? "bg-primary/10 text-primary cursor-default"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <BookmarkPlus className="w-4 h-4" />
                )}
                {saved ? '保存済み' : '保存する'}
              </button>
            )}
            {clip.url && (
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                原典を開く
              </a>
            )}
          </div>
        </div>

        {clip.thumbnail && (
          <div className="w-full aspect-video md:aspect-[21/9] rounded-[32px] overflow-hidden relative mb-8 shadow-ambient border border-outline-variant/10">
            <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={clsx(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            clip.type === 'url' && "bg-tertiary/10 text-tertiary",
            clip.type === 'pdf' && "bg-primary/10 text-primary",
            clip.type === 'video' && "bg-secondary/10 text-secondary",
            (clip.type === 'diary' || clip.type === 'image') && "bg-surface-container-highest text-on-surface-variant",
          )}>{typeLabel}</span>
          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <Clock className="w-4 h-4" />
            {clip.date}
          </span>
          {clip.domain && (
            <span className="text-xs text-on-surface-variant">{clip.domain}</span>
          )}
          {clip.userId && (
            <Link
              href={`/user/${clip.userId}`}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="text-base leading-none">{clip.avatarEmoji ?? '🙂'}</span>
              <span>{clip.displayName ?? '匿名'}</span>
            </Link>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-snug mb-6">
          {clip.title}
        </h1>

        {/* Category / Tags — display or edit */}
        {isOwner && !editingMeta ? (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {clip.category && (
                <span className="flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-xs font-bold">
                  <Tag className="w-3 h-3" />
                  {clip.category}
                </span>
              )}
              {clip.subcategory && (
                <span className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/20 rounded-full text-xs font-medium">
                  {clip.subcategory}
                </span>
              )}
              {clip.tags?.map(t => (
                <span key={t} className="flex items-center gap-1 px-3 py-1 bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-full text-xs font-bold font-mono">
                  <Hash className="w-3 h-3 text-primary" />
                  {t}
                </span>
              ))}
              <button
                onClick={() => setEditingMeta(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs text-on-surface-variant hover:bg-surface-container transition-colors border border-outline-variant/20"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </div>
        ) : isOwner && editingMeta ? (
          <div className="mb-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-4">
            {/* Category select */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">カテゴリ</label>
                <select
                  value={editCategory}
                  onChange={e => { setEditCategory(e.target.value); setEditSubcategory(''); }}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">未分類</option>
                  {Object.keys(CATEGORY_TAXONOMY).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-on-surface-variant mb-1">サブカテゴリ</label>
                <select
                  value={editSubcategory}
                  onChange={e => setEditSubcategory(e.target.value)}
                  disabled={!editCategory}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                >
                  <option value="">なし</option>
                  {(CATEGORY_TAXONOMY[editCategory] ?? []).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">タグ</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-surface-container text-on-surface border border-outline-variant/30 rounded-full text-xs font-mono">
                    #{t}
                    <button onClick={() => setEditTags(prev => prev.filter(x => x !== t))} className="ml-0.5 hover:text-error">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={e => setEditTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && editTagInput.trim()) {
                      e.preventDefault();
                      const tag = editTagInput.trim().replace(/,/g, '');
                      if (tag && !editTags.includes(tag) && editTags.length < 10) {
                        setEditTags(prev => [...prev, tag]);
                      }
                      setEditTagInput('');
                    }
                  }}
                  placeholder="タグを入力してEnter"
                  className="flex-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEditingMeta(false); setEditCategory(clip.category ?? ''); setEditSubcategory(clip.subcategory ?? ''); setEditTags(clip.tags ?? []); }}
                className="px-4 py-1.5 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveMeta}
                disabled={savingMeta}
                className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingMeta ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {(clip.category || clip.subcategory) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {clip.category && (
                  <span className="flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-full text-xs font-bold">
                    <Tag className="w-3 h-3" />
                    {clip.category}
                  </span>
                )}
                {clip.subcategory && (
                  <span className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/20 rounded-full text-xs font-medium">
                    {clip.subcategory}
                  </span>
                )}
              </div>
            )}
            {clip.tags && clip.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {clip.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-3 py-1 bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-full text-xs font-bold font-mono">
                    <Hash className="w-3 h-3 text-primary" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {clip.summary && (
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl relative mb-6">
            <div className="absolute -top-3 left-6 bg-background px-2 text-[10px] font-bold text-primary tracking-widest uppercase">AI Summary</div>
            <p className="text-on-surface leading-relaxed text-sm md:text-base">{clip.summary}</p>
          </div>
        )}

        {clip.keyPoints && (
          <div className="p-6 bg-surface-container-low border border-outline-variant/30 rounded-2xl relative">
            <div className="absolute -top-3 left-6 bg-background px-2 text-[10px] font-bold text-secondary tracking-widest uppercase">Key Points</div>
            <div className="prose-body text-sm">
              <ReactMarkdown>{clip.keyPoints}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* コメントセクション */}
        <div className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
            <MessageCircle className="w-5 h-5 text-primary" />
            コメント {comments.length > 0 && <span className="text-on-surface-variant font-normal">({comments.length})</span>}
          </h2>

          {topLevel.map(c => (
            <div key={c.id} className="space-y-2">
              <CommentItem
                comment={c}
                userId={user?.id}
                onLike={handleLike}
                onDelete={handleDeleteComment}
                onReply={setReplyTo}
                isReplyTarget={replyTo === c.id}
              />
              {replies(c.id).map(r => (
                <div key={r.id} className="ml-8">
                  <CommentItem
                    comment={r}
                    userId={user?.id}
                    onLike={handleLike}
                    onDelete={handleDeleteComment}
                    onReply={() => {}}
                    isReplyTarget={false}
                  />
                </div>
              ))}
              {replyTo === c.id && user && (
                <div className="ml-8 flex gap-2 items-end">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="返信を入力..."
                    rows={2}
                    maxLength={1000}
                    className="flex-1 px-3 py-2 bg-surface-container rounded-xl text-sm text-on-surface border border-outline-variant/30 resize-none focus:outline-none focus:border-primary"
                  />
                  <button onClick={handlePostComment} disabled={posting || !commentText.trim()}
                    className="p-2 bg-primary text-on-primary rounded-xl disabled:opacity-50">
                    {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setReplyTo(null); setCommentText(''); }}
                    className="p-2 text-on-surface-variant hover:text-on-surface rounded-xl text-xs">
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          ))}

          {user && !replyTo && (
            <div className="flex gap-2 items-end pt-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="コメントを追加..."
                rows={2}
                maxLength={1000}
                className="flex-1 px-3 py-2 bg-surface-container rounded-xl text-sm text-on-surface border border-outline-variant/30 resize-none focus:outline-none focus:border-primary"
              />
              <button onClick={handlePostComment} disabled={posting || !commentText.trim()}
                className="p-2 bg-primary text-on-primary rounded-xl disabled:opacity-50">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}

          {!user && (
            <p className="text-sm text-on-surface-variant">
              <Link href="/login" className="text-primary hover:underline">ログイン</Link>するとコメントできます
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CommentItem({ comment, userId, onLike, onDelete, onReply, isReplyTarget }: {
  comment: Comment;
  userId: string | undefined;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  isReplyTarget: boolean;
}) {
  const isOwn = userId === comment.user_id;
  const relTime = new Date(comment.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={clsx(
      "p-4 bg-surface-container-lowest rounded-2xl shadow-ambient/50 border",
      isReplyTarget ? "border-primary/40" : "border-outline-variant/20"
    )}>
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5">{comment.profiles?.avatar_emoji ?? '🙂'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-on-surface truncate">{comment.profiles?.display_name ?? '匿名'}</span>
            <span className="text-[10px] text-on-surface-variant">{relTime}</span>
          </div>
          <p className="text-sm text-on-surface whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onLike(comment.id)}
              disabled={!userId}
              className={clsx("flex items-center gap-1 text-xs transition-colors disabled:opacity-40",
                comment.likedByMe ? "text-error" : "text-on-surface-variant hover:text-error"
              )}
            >
              <Heart className={clsx("w-3.5 h-3.5", comment.likedByMe && "fill-current")} />
              {comment.likeCount > 0 && comment.likeCount}
            </button>
            {userId && !comment.parent_id && (
              <button onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />
                返信
              </button>
            )}
            {isOwn && (
              <button onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors ml-auto">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
