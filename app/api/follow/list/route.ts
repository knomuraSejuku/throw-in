import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/follow/list?userId=xxx&type=followers|following
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId');
  const type = searchParams.get('type'); // 'followers' or 'following'

  if (!userId || (type !== 'followers' && type !== 'following')) {
    return NextResponse.json({ error: 'userId and type required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const idField = type === 'followers' ? 'follower_id' : 'following_id';
  const filterField = type === 'followers' ? 'following_id' : 'follower_id';

  const { data: follows, error } = await supabase
    .from('follows')
    .select(idField)
    .eq(filterField, userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!follows || follows.length === 0) return NextResponse.json({ users: [] });

  const ids = follows.map((f: Record<string, string>) => f[idField]);

  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('id, display_name, avatar_emoji')
    .in('id', ids);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const users = (profiles ?? []).map((p: { id: string; display_name: string | null; avatar_emoji: string | null }) => ({
    id: p.id,
    displayName: p.display_name ?? '匿名',
    avatarEmoji: p.avatar_emoji ?? '🙂',
  }));

  return NextResponse.json({ users });
}
