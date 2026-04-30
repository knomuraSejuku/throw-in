import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TYPE_MAP: Record<string, string> = {
  article: 'url', video: 'video', image: 'image', document: 'pdf', note: 'diary',
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  const type = searchParams.get('type') ?? '';
  const tag = searchParams.get('tag')?.trim() ?? '';
  const userId = searchParams.get('userId') ?? '';
  const following = searchParams.get('following') === 'true';
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  let followingIds: string[] | null = null;
  if (following) {
    const cookieStore = await cookies();
    const authClient = createServerClient(
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
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) return NextResponse.json({ clips: [] });

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session.user.id);

    followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
    if (followingIds.length === 0) return NextResponse.json({ clips: [] });
  }

  let query = supabase
    .from('clips')
    .select(`
      id, title, summary, url, source_domain, preview_image_url,
      content_type, category, subcategory, created_at, user_id,
      clip_tags${tag ? '!inner' : ''} (name),
      users (display_name, avatar_emoji)
    `)
    .eq('is_global_search', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (followingIds !== null) {
    query = query.in('user_id', followingIds);
  } else if (userId) {
    query = query.eq('user_id', userId);
  }

  if (type && TYPE_MAP[type]) {
    const dbType = { url: 'article', video: 'video', image: 'image', pdf: 'document', diary: 'note' }[type as string];
    if (dbType) query = query.eq('content_type', dbType);
  }

  if (tag) {
    query = query.eq('clip_tags.name', tag);
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clips = (data ?? []).map(d => {
    const profile = Array.isArray(d.users) ? d.users[0] : d.users;
    return {
      id: d.id,
      title: d.title,
      summary: d.summary,
      url: d.url,
      domain: d.source_domain,
      thumbnail: d.preview_image_url,
      type: TYPE_MAP[d.content_type] ?? 'url',
      category: d.category,
      subcategory: d.subcategory,
      date: new Date(d.created_at).toLocaleDateString('ja-JP'),
      createdAt: d.created_at,
      tags: d.clip_tags?.map((t: any) => t.name) ?? [],
      userId: d.user_id,
      displayName: profile?.display_name ?? null,
      avatarEmoji: profile?.avatar_emoji ?? '🙂',
    };
  });

  return NextResponse.json({ clips });
}
