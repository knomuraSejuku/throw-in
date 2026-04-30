'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/auth-store';

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

export function CommentSection({ clipId, enabled = true, className }: {
  clipId: string;
  enabled?: boolean;
  className?: string;
}) {
  const user = useAuthStore(s => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(() => {
    if (!enabled) return;

    fetch(`/api/comments?clipId=${clipId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setComments(data.comments ?? []);
        setCommentError(null);
      })
      .catch(() => setCommentError('コメントの取得に失敗しました。'));
  }, [clipId, enabled]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handlePostComment() {
    if (!user || !commentText.trim() || posting) return;
    setPosting(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'post', clipId, content: commentText.trim(), parentId: replyTo }),
    });
    setPosting(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.comment) {
        setComments(prev => [...prev.filter(c => c.id !== data.comment.id), data.comment]);
      }
      setCommentText('');
      setReplyTo(null);
      setCommentError(null);
      fetchComments();
    } else {
      const data = await res.json().catch(() => null);
      setCommentError(data?.error ?? 'コメントの投稿に失敗しました。');
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

  const topLevel = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  if (!enabled) return null;

  return (
    <div className={clsx('mt-10 space-y-4', className)}>
      <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
        <MessageCircle className="w-5 h-5 text-primary" />
        コメント {comments.length > 0 && <span className="text-on-surface-variant font-normal">({comments.length})</span>}
      </h2>

      {commentError && (
        <p className="rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
          {commentError}
        </p>
      )}

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
      'p-4 bg-surface-container-lowest rounded-2xl shadow-ambient/50 border',
      isReplyTarget ? 'border-primary/40' : 'border-outline-variant/20'
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
              className={clsx('flex items-center gap-1 text-xs transition-colors disabled:opacity-40',
                comment.likedByMe ? 'text-error' : 'text-on-surface-variant hover:text-error'
              )}
            >
              <Heart className={clsx('w-3.5 h-3.5', comment.likedByMe && 'fill-current')} />
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
