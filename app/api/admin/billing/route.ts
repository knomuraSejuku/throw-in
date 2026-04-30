import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const { data, error } = await admin.service!
    .from('user_subscriptions')
    .select('id, status, billing_interval, current_period_start, current_period_end, users(email, display_name), billing_plans(name, monthly_price_yen, yearly_price_yen, weekly_ai_limit)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriptions: data ?? [] });
}
