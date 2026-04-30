import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const service = admin.service!;
  const { data, error } = await service
    .from('clip_reports')
    .select('id, clip_id, reason, detail, status, created_at, users(email, display_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ reports: [], tableMissing: true });
  }

  return NextResponse.json({ reports: data ?? [], tableMissing: false });
}
