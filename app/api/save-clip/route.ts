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

// POST /api/save-clip — save a public clip into the authenticated user's library without copying the clip body.
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
    .eq('is_hidden', false)
    .single();

  if (srcErr || !src) return NextResponse.json({ error: 'Clip not found or not public' }, { status: 404 });
  if (src.user_id === user.id) return NextResponse.json({ error: 'Already yours' }, { status: 409 });

  const targetClipId = src.normalized_url
    ? (await anonClient
        .from('clips')
        .select('id')
        .eq('normalized_url', src.normalized_url)
        .in('content_type', ['article', 'video'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()).data?.id ?? clipId
    : clipId;

  // Check for duplicate save.
  const { data: existing } = await supabase
    .from('clip_saves')
    .select('id')
    .eq('user_id', user.id)
    .eq('clip_id', targetClipId)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Already saved' }, { status: 409 });

  const { error: insertErr } = await supabase.from('clip_saves').insert({
    user_id: user.id,
    clip_id: targetClipId,
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
