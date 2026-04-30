import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const { data, error } = await admin.service!
    .from('clips')
    .select('id, title, url, content_type, is_global_search, is_hidden, summary, category, subcategory, created_at, users(email, display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clips: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if ('title' in (body ?? {})) updates.title = String(body.title ?? '').trim() || '無題のクリップ';
  if ('summary' in (body ?? {})) updates.summary = body.summary ? String(body.summary) : null;
  if ('category' in (body ?? {})) updates.category = body.category ? String(body.category) : null;
  if ('subcategory' in (body ?? {})) updates.subcategory = body.subcategory ? String(body.subcategory) : null;
  if ('is_global_search' in (body ?? {})) updates.is_global_search = Boolean(body.is_global_search);
  if ('is_hidden' in (body ?? {})) updates.is_hidden = Boolean(body.is_hidden);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates supplied' }, { status: 400 });
  }

  const { data, error } = await admin.service!
    .from('clips')
    .update(updates)
    .eq('id', id)
    .select('id, title, url, content_type, is_global_search, is_hidden, summary, category, subcategory, created_at, users(email, display_name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clip: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: clip } = await admin.service!
    .from('clips')
    .select('url')
    .eq('id', id)
    .maybeSingle();

  const storagePath = typeof clip?.url === 'string'
    ? clip.url.match(/\/storage\/v1\/object\/public\/clip-attachments\/(.+)$/)?.[1]
    : null;
  if (storagePath) {
    await admin.service!.storage
      .from('clip-attachments')
      .remove([decodeURIComponent(storagePath)])
      .catch(error => console.warn('[admin:clip_delete:storage_failed]', error));
  }

  const { error } = await admin.service!
    .from('clips')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
