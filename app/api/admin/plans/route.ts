import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const { data, error } = await admin.service!
    .from('billing_plans')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const body = await req.json().catch(() => null);
  const payload = {
    code: String(body?.code ?? '').trim(),
    name: String(body?.name ?? '').trim(),
    description: String(body?.description ?? '').trim() || null,
    monthly_price_yen: Number(body?.monthly_price_yen ?? 0),
    yearly_price_yen: Number(body?.yearly_price_yen ?? 0),
    weekly_ai_limit: Number(body?.weekly_ai_limit ?? 0),
    is_active: body?.is_active !== false,
    sort_order: Number(body?.sort_order ?? 100),
  };

  if (!payload.code || !payload.name) return NextResponse.json({ error: 'code and name required' }, { status: 400 });

  const { data, error } = await admin.service!
    .from('billing_plans')
    .insert(payload)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ['code', 'name', 'description']) {
    if (key in (body ?? {})) updates[key] = String(body[key] ?? '').trim() || null;
  }
  for (const key of ['monthly_price_yen', 'yearly_price_yen', 'weekly_ai_limit', 'sort_order']) {
    if (key in (body ?? {})) updates[key] = Number(body[key] ?? 0);
  }
  if ('is_active' in (body ?? {})) updates.is_active = Boolean(body.is_active);

  const { data, error } = await admin.service!
    .from('billing_plans')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
