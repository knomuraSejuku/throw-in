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
      id, title, title_en, summary, summary_en, key_points, key_points_en, url, source_domain, preview_image_url,
      content_type, category, category_en, subcategory, subcategory_en, tags_en, created_at, user_id,
      clip_tags (name),
      users (display_name, avatar_emoji)
    `)
    .eq('id', id)
    .eq('is_global_search', true)
    .eq('is_hidden', false)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const profile = Array.isArray(data.users) ? data.users[0] : data.users;
  const clip = {
    id: data.id,
    title: data.title,
    titleEn: data.title_en ?? null,
    summary: data.summary,
    summaryEn: data.summary_en ?? null,
    keyPoints: data.key_points ?? null,
    keyPointsEn: data.key_points_en ?? null,
    url: data.url,
    domain: data.source_domain,
    thumbnail: data.preview_image_url,
    type: TYPE_MAP[data.content_type] ?? 'url',
    category: data.category,
    categoryEn: data.category_en,
    subcategory: data.subcategory,
    subcategoryEn: data.subcategory_en,
    date: new Date(data.created_at).toLocaleDateString('ja-JP'),
    tags: (data.clip_tags as { name: string }[])?.map(t => t.name) ?? [],
    tagsEn: Array.isArray(data.tags_en) ? data.tags_en : [],
    userId: data.user_id,
    displayName: profile?.display_name ?? null,
    avatarEmoji: profile?.avatar_emoji ?? '🙂',
  };

  return NextResponse.json({ clip });
}
