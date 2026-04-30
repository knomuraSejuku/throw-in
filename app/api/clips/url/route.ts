import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { normalizeClipUrl } from '@/lib/url-normalize';

export const runtime = 'nodejs';

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function deriveReadableTitle(rawTitle: string | undefined | null, extractedBody: string | undefined | null, fallback: string) {
  const generic = new Set(['x post', 'x article', 'twitter post', '無題の記事']);
  const candidate = (rawTitle ?? '').trim();
  if (candidate && !generic.has(candidate.toLowerCase())) return candidate;

  const firstLine = (extractedBody ?? '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('投稿内リンク:') && !/^https?:\/\//.test(line));

  if (!firstLine) return fallback;
  return firstLine.length > 80 ? `${firstLine.slice(0, 79).trim()}...` : firstLine;
}

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

function getLookupClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceKey ? { auth: { autoRefreshToken: false, persistSession: false } } : undefined
  );
}

async function fetchJsonWithRetry(origin: string, pathname: string, url: string) {
  const res = await fetch(`${origin}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return await res.json();
}

async function extractUrl(origin: string, normalizedUrl: string) {
  let extractedData: {
    title?: string | null;
    body?: string | null;
    description?: string | null;
    thumbnail?: string | null;
    domain?: string | null;
  } | null = null;

  if (isYouTubeUrl(normalizedUrl)) {
    try {
      extractedData = await fetchJsonWithRetry(origin, '/api/youtube', normalizedUrl);
    } catch {
      extractedData = null;
    }

    try {
      const ogData = await fetchJsonWithRetry(origin, '/api/extract', normalizedUrl);
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
    extractedData = await fetchJsonWithRetry(origin, '/api/extract', normalizedUrl);
  }

  return extractedData;
}

async function processCreatedClip(req: NextRequest, clipId: string, content: string, clipTitle: string) {
  if (!content.trim() || content.trim().length <= 10) {
    return { processed: false, error: 'No content for AI processing' };
  }

  try {
    const response = await fetch(`${req.nextUrl.origin}/api/process-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        clipId,
        content,
        existingTags: [],
        clipTitle,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn('[clips:url:ai_failed]', { clipId, status: response.status, detail: detail.slice(0, 500) });
      return { processed: false, error: detail.slice(0, 200) || response.statusText };
    }

    return { processed: true, error: null };
  } catch (error) {
    console.warn('[clips:url:ai_failed]', { clipId, error: error instanceof Error ? error.message : String(error) });
    return { processed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawUrl = String(body?.url ?? '').trim();
  if (!rawUrl) return NextResponse.json({ error: 'url required' }, { status: 400 });

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeClipUrl(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const titleOverride = String(body?.title ?? '').trim();
  const note = String(body?.note ?? '');
  const tags = Array.isArray(body?.tags) ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : [];
  const lookup = getLookupClient();

  let clipId: string | null = null;
  let created = false;
  let bodyForAi = '';
  let aiProcessed = false;
  let aiError: string | null = null;
  let savedTitle = titleOverride;

  const { data: existing } = await lookup
    .from('clips')
    .select('id, summary')
    .eq('normalized_url', normalizedUrl)
    .in('content_type', ['article', 'video'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    clipId = existing.id;
  } else {
    let extractedData: Awaited<ReturnType<typeof extractUrl>> = null;
    try {
      extractedData = await extractUrl(req.nextUrl.origin, normalizedUrl);
    } catch (error) {
      console.warn('[clips:url:extract_failed]', error);
    }

    const parsedUrl = new URL(normalizedUrl);
    const extractedBody = extractedData?.body || extractedData?.description || null;
    const title = titleOverride || deriveReadableTitle(extractedData?.title, extractedBody, normalizedUrl);
    savedTitle = title;
    bodyForAi = extractedBody || note;

    const { data: inserted, error: insertError } = await supabase
      .from('clips')
      .insert({
        user_id: user.id,
        title,
        url: normalizedUrl,
        normalized_url: normalizedUrl,
        content_type: isYouTubeUrl(normalizedUrl) ? 'video' : 'article',
        is_read: false,
        source_domain: extractedData?.domain || parsedUrl.hostname,
        preview_image_url: extractedData?.thumbnail || null,
        extracted_content: extractedBody,
        is_global_search: true,
      })
      .select('id')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    clipId = inserted.id;
    created = true;
  }

  const { error: saveError } = await supabase
    .from('clip_saves')
    .upsert({
      user_id: user.id,
      clip_id: clipId,
      my_note: note,
    }, { onConflict: 'user_id,clip_id', ignoreDuplicates: true });

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  if (tags.length > 0) {
    await supabase.from('clip_tags').insert(tags.map((tag: string) => ({
      user_id: user.id,
      clip_id: clipId,
      name: tag,
    })));
  }

  if (created && clipId) {
    const ai = await processCreatedClip(req, clipId, bodyForAi, savedTitle);
    aiProcessed = ai.processed;
    aiError = ai.error;
  }

  return NextResponse.json({ clipId, created, normalizedUrl, body: aiProcessed ? null : bodyForAi || null, aiProcessed, aiError });
}
