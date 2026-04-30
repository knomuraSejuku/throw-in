import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const { data, error } = await admin.service!
    .from('clips')
    .select('id, title, url, content_type, is_global_search, summary, created_at, users(email, display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clips: data ?? [] });
}
