import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return NextResponse.json({ error: admin.error }, { status: admin.error === 'Forbidden' ? 403 : 401 });

  const service = admin.service!;
  const { data, error } = await service
    .from('users')
    .select(`
      id,
      email,
      created_at,
      display_name,
      clip_saves(id),
      user_subscriptions(status, billing_interval, billing_plans(name, weekly_ai_limit))
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: (data ?? []).map((user: any) => {
      const sub = Array.isArray(user.user_subscriptions) ? user.user_subscriptions[0] : user.user_subscriptions;
      const plan = Array.isArray(sub?.billing_plans) ? sub?.billing_plans[0] : sub?.billing_plans;
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
        saveCount: user.clip_saves?.length ?? 0,
        subscriptionStatus: sub?.status ?? null,
        billingInterval: sub?.billing_interval ?? null,
        planName: plan?.name ?? null,
        weeklyAiLimit: plan?.weekly_ai_limit ?? null,
      };
    }),
  });
}
