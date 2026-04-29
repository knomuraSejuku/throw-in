import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TYPE_MAP: Record<string, string> = {
  article: 'url', video: 'video', image: 'image', document: 'pdf', note: 'diary',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from('clips')
    .select(`
      id, title, summary, key_points, url, source_domain, preview_image_url,
      content_type, category, subcategory, created_at, user_id,
      clip_tags (name),
      users (display_name, avatar_emoji)
    `)
    .eq('id', id)
    .eq('is_global_search', true)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const profile = Array.isArray(data.users) ? data.users[0] : data.users;
  const clip = {
    id: data.id,
    title: data.title,
    summary: data.summary,
    keyPoints: data.key_points ?? null,
    url: data.url,
    domain: data.source_domain,
    thumbnail: data.preview_image_url,
    type: TYPE_MAP[data.content_type] ?? 'url',
    category: data.category,
    subcategory: data.subcategory,
    date: new Date(data.created_at).toLocaleDateString('ja-JP'),
    tags: (data.clip_tags as { name: string }[])?.map(t => t.name) ?? [],
    userId: data.user_id,
    displayName: profile?.display_name ?? null,
    avatarEmoji: profile?.avatar_emoji ?? '🙂',
  };

  return NextResponse.json({ clip });
}
