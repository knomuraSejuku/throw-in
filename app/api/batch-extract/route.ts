import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const MAX_BATCH_URLS = 200;
const MAX_RETRIES = 2;

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

function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://${parsed.hostname}/watch?v=${videoId}` : parsed.origin + parsed.pathname;
    }
    return parsed.origin + parsed.pathname;
  }

  if (host === 'youtu.be') {
    return `https://youtu.be${parsed.pathname}`;
  }

  return parsed.origin + parsed.pathname;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

async function readApiError(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.clone().json();
      return String(data?.error || data?.detail || response.statusText || response.status);
    }
    const text = await response.text();
    return text.slice(0, 300) || response.statusText || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function fetchJsonWithRetry(origin: string, pathname: string, url: string) {
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${origin}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.ok) return await res.json();

      lastError = await readApiError(res);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    }
  }

  throw new Error(lastError || 'Extraction failed');
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
      const normalizedUrl = normalizeUrl(url);
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
      let extractedData: {
        title?: string | null;
        body?: string | null;
        thumbnail?: string | null;
        domain?: string | null;
      } | null = null;

      if (isYouTubeUrl(normalizedUrl)) {
        try {
          extractedData = await fetchJsonWithRetry(req.nextUrl.origin, '/api/youtube', normalizedUrl);
        } catch {
          extractedData = null;
        }

        try {
          const ogData = await fetchJsonWithRetry(req.nextUrl.origin, '/api/extract', normalizedUrl);
          extractedData = {
            ...extractedData,
            title: ogData.title || extractedData?.title,
            thumbnail: ogData.thumbnail || extractedData?.thumbnail,
            domain: ogData.domain || extractedData?.domain,
            body: extractedData?.body || ogData.body,
          };
        } catch {
          // Keep transcript-only data when available.
        }
      } else {
        extractedData = await fetchJsonWithRetry(req.nextUrl.origin, '/api/extract', normalizedUrl);
      }

      const parsedUrl = new URL(normalizedUrl);
      const title = extractedData?.title || normalizedUrl;
      const sourceDomain = extractedData?.domain || parsedUrl.hostname;
      const contentType = isYouTubeUrl(normalizedUrl) ? 'video' : 'article';

      const { data: inserted, error: insertError } = await supabase
        .from('clips')
        .insert({
          user_id: user.id,
          title,
          url: normalizedUrl,
          content_type: contentType,
          is_read: false,
          source_domain: sourceDomain,
          preview_image_url: extractedData?.thumbnail || null,
          extracted_content: extractedData?.body || null,
          is_global_search: false,
        })
        .select('id, title')
        .single();

      if (insertError) throw new Error(insertError.message);

      results.push({
        url,
        normalizedUrl,
        status: 'created',
        clipId: inserted.id,
        title: inserted.title,
        body: extractedData?.body || null,
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

  return NextResponse.json({
    total: results.length,
    created: results.filter(result => result.status === 'created').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'failed').length,
    results,
  });
}
