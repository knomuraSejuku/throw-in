import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Abort before mutating data if service role is unavailable. This avoids
  // partial account deletion when auth user deletion cannot be completed.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: ownedClips } = await adminClient
    .from('clips')
    .select('id')
    .eq('user_id', userId);
  const clipIds = (ownedClips ?? []).map(c => c.id);

  const { data: ownedCollections } = await adminClient
    .from('collections')
    .select('id')
    .eq('user_id', userId);
  const collectionIds = (ownedCollections ?? []).map(c => c.id);

  const deletionSteps: Array<PromiseLike<{ error: { message: string } | null }>> = [
    adminClient.from('notifications').delete().eq('user_id', userId),
    adminClient.from('comment_likes').delete().eq('user_id', userId),
    adminClient.from('clip_comments').delete().eq('user_id', userId),
    adminClient.from('follows').delete().eq('follower_id', userId),
    adminClient.from('follows').delete().eq('following_id', userId),
    adminClient.from('history').delete().eq('user_id', userId),
    adminClient.from('clip_tags').delete().eq('user_id', userId),
  ];

  if (clipIds.length > 0) {
    deletionSteps.push(adminClient.from('clip_collections').delete().in('clip_id', clipIds));
  }
  if (collectionIds.length > 0) {
    deletionSteps.push(adminClient.from('clip_collections').delete().in('collection_id', collectionIds));
  }

  deletionSteps.push(
    adminClient.from('clips').delete().eq('user_id', userId),
    adminClient.from('collections').delete().eq('user_id', userId)
  );

  for (const step of deletionSteps) {
    const { error } = await step;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
