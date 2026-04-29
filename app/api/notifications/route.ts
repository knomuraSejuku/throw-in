import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// GET /api/notifications?limit=20 — list own notifications
export async function GET(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '50'), 100);

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, data, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unreadCount = (notifications ?? []).filter(n => !n.read).length;
  return NextResponse.json({ notifications: notifications ?? [], unreadCount });
}

// POST /api/notifications — mark notifications as read
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids } = body; // array of ids, or omit to mark all

  let query = supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
  if (ids?.length) query = query.in('id', ids);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
