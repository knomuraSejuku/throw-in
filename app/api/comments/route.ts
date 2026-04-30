import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type CommentRow = {
  id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  user_id: string;
};

type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_emoji: string | null;
};

// GET /api/comments?clipId=xxx — list comments with like counts + current user's likes
export async function GET(req: NextRequest) {
  const clipId = req.nextUrl.searchParams.get('clipId');
  if (!clipId) return NextResponse.json({ error: 'clipId required' }, { status: 400 });

  // Verify clip is public
  const { data: clip } = await anonClient.from('clips').select('id').eq('id', clipId).eq('is_global_search', true).single();
  if (!clip) return NextResponse.json({ error: 'Clip not found or not public' }, { status: 404 });

  // Fetch comments
  const { data: comments, error } = await anonClient
    .from('clip_comments')
    .select('id, content, parent_id, created_at, user_id')
    .eq('clip_id', clipId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (comments ?? []) as CommentRow[];
  const userIds = [...new Set(rows.map(c => c.user_id))];
  const profilesByUserId: Record<string, UserProfile> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await anonClient
      .from('users')
      .select('id, display_name, avatar_emoji')
      .in('id', userIds);

    ((profiles ?? []) as UserProfile[]).forEach(profile => {
      profilesByUserId[profile.id] = profile;
    });
  }

  // Fetch like counts
  const commentIds = rows.map(c => c.id);
  let likesByComment: Record<string, number> = {};
  let likedByMe: Set<string> = new Set();

  if (commentIds.length > 0) {
    const { data: likes } = await anonClient
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', commentIds);

    (likes ?? []).forEach(l => {
      likesByComment[l.comment_id] = (likesByComment[l.comment_id] ?? 0) + 1;
    });

    // Check current user's likes
    const { user } = await getAuthedSupabase();
    if (user) {
      const { data: myLikes } = await anonClient
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds);
      (myLikes ?? []).forEach(l => likedByMe.add(l.comment_id));
    }
  }

  const enriched = rows.map(c => ({
    ...c,
    profiles: profilesByUserId[c.user_id] ? {
      display_name: profilesByUserId[c.user_id].display_name,
      avatar_emoji: profilesByUserId[c.user_id].avatar_emoji,
    } : null,
    likeCount: likesByComment[c.id] ?? 0,
    likedByMe: likedByMe.has(c.id),
  }));

  return NextResponse.json({ comments: enriched });
}

// POST /api/comments — create comment or toggle like or delete comment
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { action, clipId, content, parentId, commentId } = body ?? {};

  // --- POST comment ---
  if (action === 'post') {
    if (!clipId || !content?.trim()) return NextResponse.json({ error: 'clipId and content required' }, { status: 400 });

    // Verify clip is public
    const { data: clip } = await anonClient.from('clips').select('user_id').eq('id', clipId).eq('is_global_search', true).single();
    if (!clip) return NextResponse.json({ error: 'Clip not found or not public' }, { status: 404 });

    let parentCommentUserId: string | null = null;
    if (parentId) {
      const { data: parentComment, error: parentError } = await anonClient
        .from('clip_comments')
        .select('id, clip_id, user_id, parent_id')
        .eq('id', parentId)
        .maybeSingle();

      if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
      if (!parentComment || parentComment.clip_id !== clipId) {
        return NextResponse.json({ error: 'Parent comment not found for this clip' }, { status: 400 });
      }
      if (parentComment.parent_id) {
        return NextResponse.json({ error: 'Nested replies are not supported' }, { status: 400 });
      }
      parentCommentUserId = parentComment.user_id;
    }

    const { data: comment, error } = await supabase
      .from('clip_comments')
      .insert({ clip_id: clipId, user_id: user.id, content: content.trim(), parent_id: parentId ?? null })
      .select('id, content, parent_id, created_at, user_id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: profile } = await anonClient
      .from('users')
      .select('display_name, avatar_emoji')
      .eq('id', user.id)
      .maybeSingle();

    // Notify clip owner or parent commenter (skip if self)
    const notifyUserId = parentCommentUserId ?? clip.user_id;

    if (notifyUserId && notifyUserId !== user.id) {
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        type: parentId ? 'comment_reply' : 'comment_on_clip',
        data: { comment_id: comment.id, actor_id: user.id, clip_id: clipId },
      });
    }

    return NextResponse.json({
      comment: {
        ...comment,
        profiles: profile ? {
          display_name: profile.display_name,
          avatar_emoji: profile.avatar_emoji,
        } : null,
        likeCount: 0,
        likedByMe: false,
      },
    });
  }

  // --- Toggle like ---
  if (action === 'like') {
    if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });

    const { data: existing } = await supabase
      .from('comment_likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
      .maybeSingle();

    if (existing) {
      await supabase.from('comment_likes').delete().eq('user_id', user.id).eq('comment_id', commentId);
      return NextResponse.json({ liked: false });
    } else {
      await supabase.from('comment_likes').insert({ user_id: user.id, comment_id: commentId });
      return NextResponse.json({ liked: true });
    }
  }

  // --- Delete comment ---
  if (action === 'delete') {
    if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });

    const { error } = await supabase
      .from('clip_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
