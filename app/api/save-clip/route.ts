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

// POST /api/save-clip — copy a public clip into the authenticated user's library
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clipId = body?.clipId as string | undefined;
  if (!clipId) return NextResponse.json({ error: 'clipId required' }, { status: 400 });

  // Fetch source clip via anon client (must be public)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: src, error: srcErr } = await anonClient
    .from('clips')
    .select('*')
    .eq('id', clipId)
    .eq('is_global_search', true)
    .single();

  if (srcErr || !src) return NextResponse.json({ error: 'Clip not found or not public' }, { status: 404 });
  if (src.user_id === user.id) return NextResponse.json({ error: 'Already yours' }, { status: 409 });

  // Check for duplicate save
  const { data: existing } = await supabase
    .from('clips')
    .select('id')
    .eq('user_id', user.id)
    .eq('saved_from_clip_id', clipId)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Already saved' }, { status: 409 });

  const { error: insertErr } = await supabase.from('clips').insert({
    user_id: user.id,
    title: src.title,
    url: src.url,
    source_domain: src.source_domain,
    preview_image_url: src.preview_image_url,
    content_type: src.content_type,
    summary: src.summary,
    extracted_content: src.extracted_content,
    my_note: null,
    key_points: src.key_points,
    embedding: src.embedding,
    category: src.category,
    subcategory: src.subcategory,
    is_global_search: false,
    saved_from_clip_id: clipId,
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
