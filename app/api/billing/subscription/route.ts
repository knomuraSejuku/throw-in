import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAuthedUser } from '@/lib/admin';

export async function GET() {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ subscription: null });

  const { data, error } = await service
    .from('user_subscriptions')
    .select('id, billing_interval, status, current_period_start, current_period_end, billing_plans(*)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const planId = String(body?.planId ?? '');
  const billingInterval = body?.billingInterval === 'yearly' ? 'yearly' : 'monthly';
  if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (billingInterval === 'yearly' ? 12 : 1));

  const { data, error } = await service
    .from('user_subscriptions')
    .upsert({
      user_id: user.id,
      plan_id: planId,
      billing_interval: billingInterval,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
    }, { onConflict: 'user_id' })
    .select('id, billing_interval, status, current_period_start, current_period_end, billing_plans(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}
