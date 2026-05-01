import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeClipUrl } from '@/lib/url-normalize';
import { getOpenAIOutputText, OPENAI_METADATA_MODEL, OPENAI_REASONING } from '@/lib/openai-config';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function getSharedUrl(urlValue: string, textValue: string): string | null {
  const direct = urlValue.trim();
  if (direct) return direct;
  const match = textValue.match(/https?:\/\/[^\s"',)]+/);
  return match?.[0] ?? null;
}

async function extractImageText(file: File): Promise<string | null> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return null;

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_METADATA_MODEL,
      reasoning: OPENAI_REASONING.medium,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extract all readable text from this shared image. Preserve natural reading order, headings/lists when visible, names, numbers, URLs, and Japanese text exactly. If no meaningful text is visible, return an empty string. Output only the extracted text.' },
            { type: 'input_image', image_url: `data:${file.type};base64,${base64}` },
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
  return getOpenAIOutputText(data) || null;
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
      const { error: saveError } = await supabase.from('clip_saves').insert({
        user_id: user.id,
        clip_id: inserted.id,
        my_note: sharedText && sharedText !== sharedUrl ? sharedText : '',
      });
      if (saveError) throw new Error(saveError.message);

      return redirectWithStatus(req, 'saved', undefined, inserted.id);
    }

    if (sharedUrl) {
      const normalizedUrl = normalizeClipUrl(sharedUrl);
      const note = sharedText.replace(sharedUrl, '').trim();
      const saveRes = await fetch(`${req.nextUrl.origin}/api/clips/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ url: normalizedUrl, title: sharedTitle, note }),
      });
      const saved = await saveRes.json().catch(() => null);
      if (!saveRes.ok) throw new Error(saved?.error || '保存に失敗しました。');

      return redirectWithStatus(req, saved.created ? 'saved' : 'duplicate', undefined, saved.clipId);
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
      const { error: saveError } = await supabase.from('clip_saves').insert({
        user_id: user.id,
        clip_id: inserted.id,
        my_note: sharedText,
      });
      if (saveError) throw new Error(saveError.message);

      return redirectWithStatus(req, 'saved', undefined, inserted.id);
    }

    return redirectWithStatus(req, 'error', '共有された内容を読み取れませんでした。');
  } catch (error) {
    console.error('[share-target:failed]', error);
    return redirectWithStatus(req, 'error', error instanceof Error ? error.message : '保存に失敗しました。');
  }
}
