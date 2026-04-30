import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeClipUrl } from '@/lib/url-normalize';

export const runtime = 'nodejs';

const MAX_BATCH_URLS = 200;

type BatchExtractResult = {
  url: string;
  normalizedUrl: string;
  status: 'created' | 'skipped' | 'failed';
  clipId?: string;
  title?: string;
  body?: string | null;
  error?: string;
  reason?: 'duplicate' | 'invalid_url';
};

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

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawUrls = Array.isArray(body?.urls) ? body.urls : [];
  if (rawUrls.length === 0) return NextResponse.json({ error: 'urls required' }, { status: 400 });

  const normalizedPairs: Array<{ url: string; normalizedUrl: string }> = [];
  const results: BatchExtractResult[] = [];
  const seen = new Set<string>();

  for (const value of rawUrls.slice(0, MAX_BATCH_URLS)) {
    const url = String(value || '').trim();
    if (!url) continue;

    try {
      const normalizedUrl = normalizeClipUrl(url);
      if (seen.has(normalizedUrl)) {
        results.push({ url, normalizedUrl, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seen.add(normalizedUrl);
      normalizedPairs.push({ url, normalizedUrl });
    } catch {
      results.push({ url, normalizedUrl: url, status: 'failed', reason: 'invalid_url', error: 'Invalid URL format' });
    }
  }

  const normalizedUrls = normalizedPairs.map(pair => pair.normalizedUrl);
  const existingUrls = new Set<string>();
  if (normalizedUrls.length > 0) {
    const { data: existing, error } = await supabase
      .from('clips')
      .select('url')
      .eq('user_id', user.id)
      .in('url', normalizedUrls);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    (existing ?? []).forEach(row => {
      if (row.url) existingUrls.add(row.url);
    });
  }

  for (const pair of normalizedPairs) {
    const { url, normalizedUrl } = pair;

    if (existingUrls.has(normalizedUrl)) {
      results.push({ url, normalizedUrl, status: 'skipped', reason: 'duplicate' });
      continue;
    }

    try {
      const saveRes = await fetch(`${req.nextUrl.origin}/api/clips/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const saved = await saveRes.json().catch(() => null);
      if (!saveRes.ok) throw new Error(saved?.error || 'URL save failed');

      results.push({
        url,
        normalizedUrl,
        status: saved.created ? 'created' : 'skipped',
        clipId: saved.clipId,
        title: saved.normalizedUrl,
        body: saved.body || null,
        reason: saved.created ? undefined : 'duplicate',
      });
    } catch (error) {
      results.push({
        url,
        normalizedUrl,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    userId: user.id,
    requested: rawUrls.length,
    total: results.length,
    created: results.filter(result => result.status === 'created').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'failed').length,
  };

  console.info('[batch-extract:completed]', summary);

  return NextResponse.json({
    requested: summary.requested,
    total: summary.total,
    created: summary.created,
    skipped: summary.skipped,
    failed: summary.failed,
    results,
  });
}
