import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const selectFields =
    'id, code, name, description, monthly_price_yen, yearly_price_yen, weekly_ai_limit, sort_order';
  const fetchPlans = (withVisibility: boolean) => {
    let query = supabase
      .from('billing_plans')
      .select(selectFields)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (withVisibility) {
      query = query.eq('is_visible', true);
    }

    return query;
  };

  let { data, error } = await fetchPlans(true);

  if (
    error &&
    (error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message.toLowerCase().includes('is_visible'))
  ) {
    const fallback = await fetchPlans(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}
