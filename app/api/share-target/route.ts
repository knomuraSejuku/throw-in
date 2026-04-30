import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const GENERIC_CLIP_TITLES = new Set(['x post', 'x article', 'twitter post', '無題の記事']);

type ExtractedData = {
  title?: string | null;
  body?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  domain?: string | null;
};

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
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

  if (host === 'twitter.com' || host === 'x.com') {
    return `https://x.com${parsed.pathname}`.replace(/\/$/, '');
  }

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

  const normalizedPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${parsed.protocol}//${host}${normalizedPath}`;
}

function getSharedUrl(urlValue: string, textValue: string): string | null {
  const direct = urlValue.trim();
  if (direct) return direct;
  const match = textValue.match(/https?:\/\/[^\s"',)]+/);
  return match?.[0] ?? null;
}

function deriveReadableTitle(rawTitle: string | undefined | null, extractedBody: string | undefined | null, fallback: string) {
  const candidate = (rawTitle ?? '').trim();
  if (candidate && !GENERIC_CLIP_TITLES.has(candidate.toLowerCase())) return candidate;

  const firstLine = (extractedBody ?? '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('投稿内リンク:') && !/^https?:\/\//.test(line));

  if (!firstLine) return fallback;
  return firstLine.length > 80 ? `${firstLine.slice(0, 79).trim()}...` : firstLine;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    return String(data?.error || data?.detail || response.statusText || response.status);
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

async function fetchExtractor(origin: string, pathname: string, url: string): Promise<ExtractedData> {
  const res = await fetch(`${origin}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return await res.json();
}

async function extractUrl(origin: string, url: string): Promise<ExtractedData | null> {
  if (isYouTubeUrl(url)) {
    let extracted: ExtractedData | null = null;
    try {
      extracted = await fetchExtractor(origin, '/api/youtube', url);
    } catch {
      extracted = null;
    }

    try {
      const ogData = await fetchExtractor(origin, '/api/extract', url);
      return {
        ...extracted,
        title: ogData.title || extracted?.title,
        thumbnail: ogData.thumbnail || extracted?.thumbnail,
        domain: ogData.domain || extracted?.domain,
        body: extracted?.body || ogData.body,
      };
    } catch {
      return extracted;
    }
  }

  return await fetchExtractor(origin, '/api/extract', url);
}

async function extractImageText(file: File): Promise<string | null> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return null;

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the text from this document or image. Output only the extracted text.' },
            { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error('[share-target:ocr_failed]', { status: res.status, detail: (await res.text().catch(() => '')).slice(0, 500) });
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function extractPdfText(file: File): Promise<string | null> {
  try {
    // @ts-ignore
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    return parsed.text || null;
  } catch (error) {
    console.error('[share-target:pdf_failed]', error);
    return null;
  }
}

function redirectWithStatus(req: NextRequest, status: 'saved' | 'duplicate' | 'error', message?: string, clipId?: string) {
  const url = new URL('/', req.nextUrl.origin);
  url.searchParams.set('share', status);
  if (message) url.searchParams.set('message', message.slice(0, 120));
  if (clipId) url.searchParams.set('process', clipId);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('next', '/add');
    return NextResponse.redirect(loginUrl, 303);
  }

  try {
    const form = await req.formData();
    const sharedTitle = String(form.get('title') ?? '').trim();
    const sharedText = String(form.get('text') ?? '').trim();
    const sharedUrl = getSharedUrl(String(form.get('url') ?? ''), sharedText);
    const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
    const file = files[0] ?? null;

    if (file) {
      if (file.size > MAX_FILE_SIZE) return redirectWithStatus(req, 'error', 'ファイルサイズは10MB以下にしてください。');
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && file.type !== 'video/mp4') {
        return redirectWithStatus(req, 'error', '対応していないファイル形式です。');
      }

      const fileExt = file.name.split('.').pop() || 'tmp';
      const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('clip-attachments').upload(filePath, file);
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from('clip-attachments').getPublicUrl(filePath);
      const extractedText = file.type === 'application/pdf'
        ? await extractPdfText(file)
        : file.type.startsWith('image/')
          ? await extractImageText(file)
          : null;
      const contentType = file.type.startsWith('image/') ? 'image' : file.type === 'video/mp4' ? 'video' : 'document';

      const { data: inserted, error } = await supabase.from('clips').insert({
        user_id: user.id,
        title: sharedTitle || file.name || '共有ファイル',
        url: publicUrl,
        content_type: contentType,
        my_note: sharedText && sharedText !== sharedUrl ? sharedText : '',
        is_read: false,
        source_domain: file.name,
        extracted_content: extractedText,
        is_global_search: false,
      }).select('id').single();
      if (error) throw new Error(error.message);

      return redirectWithStatus(req, 'saved', undefined, inserted.id);
    }

    if (sharedUrl) {
      const normalizedUrl = normalizeUrl(sharedUrl);
      const { data: existing, error: existingError } = await supabase
        .from('clips')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', normalizedUrl)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing) return redirectWithStatus(req, 'duplicate');

      let extractedData: ExtractedData | null = null;
      try {
        extractedData = await extractUrl(req.nextUrl.origin, normalizedUrl);
      } catch (error) {
        console.warn('[share-target:extract_failed]', error);
      }

      const parsedUrl = new URL(normalizedUrl);
      const body = extractedData?.body || extractedData?.description || null;
      const title = sharedTitle || deriveReadableTitle(extractedData?.title, body, normalizedUrl);
      const note = sharedText.replace(sharedUrl, '').trim();

      const { data: inserted, error } = await supabase.from('clips').insert({
        user_id: user.id,
        title,
        url: normalizedUrl,
        content_type: isYouTubeUrl(normalizedUrl) ? 'video' : 'article',
        my_note: note,
        is_read: false,
        source_domain: extractedData?.domain || parsedUrl.hostname,
        preview_image_url: extractedData?.thumbnail || null,
        extracted_content: body,
        is_global_search: true,
      }).select('id').single();
      if (error) throw new Error(error.message);

      return redirectWithStatus(req, 'saved', undefined, inserted.id);
    }

    if (sharedText) {
      const { data: inserted, error } = await supabase.from('clips').insert({
        user_id: user.id,
        title: sharedTitle || `メモ (${new Date().toLocaleDateString('ja-JP')})`,
        url: '',
        content_type: 'note',
        my_note: sharedText,
        extracted_content: sharedText,
        is_read: false,
        is_global_search: false,
      }).select('id').single();
      if (error) throw new Error(error.message);

      return redirectWithStatus(req, 'saved', undefined, inserted.id);
    }

    return redirectWithStatus(req, 'error', '共有された内容を読み取れませんでした。');
  } catch (error) {
    console.error('[share-target:failed]', error);
    return redirectWithStatus(req, 'error', error instanceof Error ? error.message : '保存に失敗しました。');
  }
}
