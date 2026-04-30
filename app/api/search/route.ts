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
  const ai = searchParams.get('ai') === 'true';
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

  let semanticIds: string[] | null = null;
  let semanticScores = new Map<string, number>();
  let aiFallback = false;

  if (ai && q && !following && !userId) {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: q }),
        });

        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const { data: matches, error: matchError } = await supabase.rpc('match_public_clips', {
            query_embedding: embedData.data[0].embedding,
            match_threshold: 0.35,
            match_count: limit,
          });

          if (!matchError) {
            semanticIds = (matches ?? []).map((row: { id: string; similarity: number }) => {
              semanticScores.set(row.id, row.similarity);
              return row.id;
            });
            if ((semanticIds ?? []).length === 0) return NextResponse.json({ clips: [], ai: true });
          } else {
            aiFallback = true;
            console.warn('[search:semantic_rpc_failed]', { error: matchError.message });
          }
        } else {
          aiFallback = true;
          console.warn('[search:embedding_failed]', { status: embedRes.status, statusText: embedRes.statusText });
        }
      } catch (error) {
        aiFallback = true;
        console.warn('[search:semantic_failed]', { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      aiFallback = true;
    }
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

  if (semanticIds) {
    query = query.in('id', semanticIds);
  }

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

  if (q && !semanticIds) {
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sortedData = semanticIds
    ? [...(data ?? [])].sort((a, b) => (semanticIds ?? []).indexOf(a.id) - (semanticIds ?? []).indexOf(b.id))
    : (data ?? []);

  const clips = sortedData.map(d => {
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
      similarity: semanticScores.get(d.id) ?? null,
    };
  });

  return NextResponse.json({ clips, ai: ai && q ? !aiFallback : false, aiFallback });
}
