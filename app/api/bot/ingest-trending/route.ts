import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchQiitaTrending, type TrendingItem } from '@/lib/trending-sources/qiita';

export const runtime = 'nodejs';

function isAuthorized(req: NextRequest) {
  const secret = process.env.TRENDING_BOT_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization') || '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  const querySecret = req.nextUrl.searchParams.get('secret') || '';
  return authHeader === `Bearer ${secret}` || cronHeader === secret || querySecret === secret;
}

function normalizeUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
}

async function ingest(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botUserId = process.env.TRENDING_BOT_USER_ID;
  if (!serviceKey || !botUserId) {
    return NextResponse.json({ error: 'TRENDING_BOT_USER_ID or SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 500 });
  }

  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 10, 30));
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: botUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', botUserId)
    .maybeSingle();

  if (!botUser) {
    return NextResponse.json({ error: 'Bot user does not exist in public.users' }, { status: 500 });
  }

  const items = await fetchQiitaTrending(limit);
  const normalizedItems = items.map(item => ({ ...item, url: normalizeUrl(item.url) }));
  const urls = normalizedItems.map(item => item.url);
  const { data: existing } = await supabase
    .from('clips')
    .select('url')
    .in('url', urls);

  const existingUrls = new Set((existing ?? []).map(row => row.url).filter(Boolean));
  const created: Array<{ id: string; url: string; source: TrendingItem['source'] }> = [];
  const skipped: Array<{ url: string; reason: string }> = [];

  for (const item of normalizedItems) {
    if (existingUrls.has(item.url)) {
      skipped.push({ url: item.url, reason: 'duplicate' });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('clips')
      .insert({
        user_id: botUserId,
        title: item.title,
        url: item.url,
        content_type: 'article',
        preview_image_url: item.thumbnail,
        extracted_content: item.body,
        my_note: `trending:${item.source}; score:${item.score}; source_created_at:${item.sourceCreatedAt ?? 'unknown'}`,
        is_read: false,
        is_global_search: true,
        source_domain: item.source === 'qiita' ? 'qiita.com' : item.source,
      })
      .select('id, url')
      .single();

    if (error) {
      skipped.push({ url: item.url, reason: error.message });
      continue;
    }

    created.push({ id: inserted.id, url: inserted.url, source: item.source });
    existingUrls.add(item.url);
  }

  console.info('[bot:ingest-trending:completed]', {
    source: 'qiita',
    requested: limit,
    fetched: items.length,
    created: created.length,
    skipped: skipped.length,
  });

  return NextResponse.json({
    source: 'qiita',
    requested: limit,
    fetched: items.length,
    created,
    skipped,
  });
}

export async function GET(req: NextRequest) {
  return ingest(req);
}

export async function POST(req: NextRequest) {
  return ingest(req);
}
