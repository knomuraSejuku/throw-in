import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

function monthKey(date: string) {
  return new Date(date).toISOString().slice(0, 7);
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });
  }

  const service = admin.service!;
  const [
    users,
    clips,
    saves,
    aiEvents,
    subscriptions,
    plans,
  ] = await Promise.all([
    service.from('users').select('id, created_at, email'),
    service.from('clips').select('id, content_type, created_at, is_global_search'),
    service.from('clip_saves').select('id, created_at'),
    service.from('ai_usage_events').select('id, created_at, action, model, user_id'),
    service.from('user_subscriptions').select('id, status, billing_interval, billing_plans(code, name, monthly_price_yen, yearly_price_yen)'),
    service.from('billing_plans').select('*').order('sort_order', { ascending: true }),
  ]);

  const errors = [users.error, clips.error, saves.error, aiEvents.error, subscriptions.error, plans.error].filter(Boolean);
  if (errors.length > 0) return NextResponse.json({ error: errors[0]?.message }, { status: 500 });

  const clipsByType: Record<string, number> = {};
  for (const clip of clips.data ?? []) {
    clipsByType[clip.content_type] = (clipsByType[clip.content_type] ?? 0) + 1;
  }

  const aiByMonth: Record<string, number> = {};
  for (const event of aiEvents.data ?? []) {
    const key = monthKey(event.created_at);
    aiByMonth[key] = (aiByMonth[key] ?? 0) + 1;
  }

  let monthlyRevenueYen = 0;
  let yearlyRevenueYen = 0;
  const subscriptionsByPlan: Record<string, number> = {};
  for (const sub of subscriptions.data ?? []) {
    if (sub.status !== 'active' && sub.status !== 'trialing') continue;
    const plan = Array.isArray(sub.billing_plans) ? sub.billing_plans[0] : sub.billing_plans;
    if (!plan) continue;
    subscriptionsByPlan[plan.name] = (subscriptionsByPlan[plan.name] ?? 0) + 1;
    if (sub.billing_interval === 'yearly') yearlyRevenueYen += plan.yearly_price_yen ?? 0;
    else monthlyRevenueYen += plan.monthly_price_yen ?? 0;
  }

  return NextResponse.json({
    totals: {
      users: users.data?.length ?? 0,
      clips: clips.data?.length ?? 0,
      saves: saves.data?.length ?? 0,
      globalClips: (clips.data ?? []).filter(c => c.is_global_search).length,
      aiEvents: aiEvents.data?.length ?? 0,
      subscriptions: subscriptions.data?.length ?? 0,
      monthlyRevenueYen,
      yearlyRevenueYen,
    },
    clipsByType,
    aiByMonth: Object.entries(aiByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    subscriptionsByPlan,
    plans: plans.data ?? [],
  });
}
