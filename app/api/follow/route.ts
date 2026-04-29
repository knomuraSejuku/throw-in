import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getSession() {
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
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// GET /api/follow?userId=xxx — follower count + isFollowing for current user
export async function GET(req: NextRequest) {
  const targetId = req.nextUrl.searchParams.get('userId');
  if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    anonClient.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
    anonClient.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
  ]);

  const session = await getSession();
  let isFollowing = false;
  if (session) {
    const { data } = await anonClient
      .from('follows')
      .select('follower_id')
      .eq('follower_id', session.user.id)
      .eq('following_id', targetId)
      .maybeSingle();
    isFollowing = !!data;
  }

  return NextResponse.json({ followerCount: followerCount ?? 0, followingCount: followingCount ?? 0, isFollowing });
}

// POST /api/follow?userId=xxx — follow
export async function POST(req: NextRequest) {
  const targetId = req.nextUrl.searchParams.get('userId');
  if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.id === targetId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

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

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: session.user.id, following_id: targetId });

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/follow?userId=xxx — unfollow
export async function DELETE(req: NextRequest) {
  const targetId = req.nextUrl.searchParams.get('userId');
  if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', session.user.id)
    .eq('following_id', targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
