import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const MAX_AI_BATCH = 10;

type BatchAiResult = {
  clipId: string;
  status: 'processed' | 'skipped' | 'failed';
  error?: string;
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

async function readApiError(response: Response) {
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

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clipIds = Array.isArray(body?.clipIds) ? body.clipIds.map(String).slice(0, MAX_AI_BATCH) : [];
  if (clipIds.length === 0) return NextResponse.json({ error: 'clipIds required' }, { status: 400 });

  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select('id, title, extracted_content, my_note, summary, user_id')
    .eq('user_id', user.id)
    .in('id', clipIds);

  if (clipsError) return NextResponse.json({ error: clipsError.message }, { status: 500 });

  const { data: tagRows } = await supabase
    .from('clip_tags')
    .select('name')
    .eq('user_id', user.id)
    .limit(200);
  const existingTags = Array.from(new Set((tagRows ?? []).map(row => row.name).filter(Boolean))).slice(0, 200);

  const found = new Map((clips ?? []).map(clip => [clip.id, clip]));
  const results: BatchAiResult[] = [];

  for (const clipId of clipIds) {
    const clip = found.get(clipId);
    if (!clip) {
      results.push({ clipId, status: 'failed', error: 'Clip not found' });
      continue;
    }

    const content = clip.extracted_content || clip.my_note || clip.summary || clip.title || '';
    if (!content.trim() || content.trim().length <= 10) {
      results.push({ clipId, status: 'skipped', error: 'No content for AI processing' });
      continue;
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
          existingTags,
          clipTitle: clip.title || '',
        }),
      });

      if (!response.ok) {
        results.push({ clipId, status: 'failed', error: await readApiError(response) });
        continue;
      }

      results.push({ clipId, status: 'processed' });
    } catch (error) {
      results.push({ clipId, status: 'failed', error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({
    total: results.length,
    processed: results.filter(result => result.status === 'processed').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'failed').length,
    results,
  });
}
