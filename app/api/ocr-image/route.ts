import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getOpenAIOutputText, OPENAI_METADATA_MODEL } from '@/lib/openai-config';

export const runtime = 'nodejs';

async function getAuthedUser() {
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
  return user;
}

export async function POST(req: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'AI processing unavailable' }, { status: 503 });

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mimeType, base64 } = await req.json().catch(() => ({})) as { mimeType?: string; base64?: string };
  if (!mimeType?.startsWith('image/') || !base64) {
    return NextResponse.json({ error: 'mimeType and base64 image are required' }, { status: 400 });
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_METADATA_MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extract the text from this document or image. Output only the extracted text.' },
            { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('OpenAI OCR request failed', { status: res.status, body: detail.slice(0, 500) });
    return NextResponse.json({ error: 'OCR failed' }, { status: 502 });
  }

  const data = await res.json();
  const text = getOpenAIOutputText(data);
  return NextResponse.json({ text });
}
