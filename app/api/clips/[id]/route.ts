import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (toSet) => { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { category?: string | null; subcategory?: string | null; tags?: string[] };

  // Verify ownership
  const { data: clip } = await supabase.from('clips').select('user_id').eq('id', id).single();
  if (!clip || clip.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Update category/subcategory
  const updates: Record<string, string | null> = {};
  if ('category' in body) updates.category = body.category ?? null;
  if ('subcategory' in body) updates.subcategory = body.subcategory ?? null;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('clips').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update tags
  if (Array.isArray(body.tags)) {
    await supabase.from('clip_tags').delete().eq('clip_id', id);
    if (body.tags.length > 0) {
      const rows = body.tags.map(name => ({ clip_id: id, name }));
      const { error } = await supabase.from('clip_tags').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
