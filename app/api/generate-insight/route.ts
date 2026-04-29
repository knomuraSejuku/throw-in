import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/generate-insight
// Body: { type: 'column'|'weekly'|'category', category?: string }
export async function POST(req: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'AI processing unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const { type = 'column', category } = body ?? {};

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Fetch recent public clips (original only, global search enabled)
  let clipsQuery = supabase
    .from('clips')
    .select('title, summary, category, subcategory, clip_tags(name)')
    .eq('is_global_search', true)
    .not('summary', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40);

  if (type === 'category' && category) {
    clipsQuery = clipsQuery.eq('category', category);
  }

  const { data: clips, error: clipsErr } = await clipsQuery;
  if (clipsErr) return NextResponse.json({ error: clipsErr.message }, { status: 500 });
  if (!clips || clips.length === 0) return NextResponse.json({ error: 'No public clips available' }, { status: 404 });

  const clipList = clips
    .map(c => {
      const tags = (c.clip_tags as { name: string }[] | null)?.map(t => t.name).join(', ');
      return `・${c.title}${c.summary ? `\n  要約: ${c.summary}` : ''}${tags ? `\n  タグ: ${tags}` : ''}`;
    })
    .join('\n\n');

  const systemPrompts: Record<string, string> = {
    column: 'あなたは知的好奇心を刺激するメディアのコラムニストです。提供されたクリップ（記事・動画・メモ）の一覧をもとに、読者にとって示唆に富む日本語コラムを書いてください。タイトルを1行目に書き、その後Markdown形式で本文を展開してください（600〜900字程度）。',
    weekly: 'あなたはキュレーターです。今週注目のグローバルクリップをもとに「今週の注目トピック」という形式の週次ダイジェストを日本語Markdownで書いてください（タイトル1行目 + 600〜900字）。',
    category: `あなたはカテゴリ「${category ?? ''}」の専門キュレーターです。提供されたクリップをもとに、このカテゴリの最新動向をまとめた日本語コラムを書いてください（タイトル1行目 + 600〜900字）。`,
  };

  const prompt = systemPrompts[type] ?? systemPrompts.column;

  const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `以下のクリップ一覧（${clips.length}件）をもとにコラムを生成してください:\n\n${clipList}` },
      ],
    }),
  });

  if (!oaiRes.ok) {
    const errText = await oaiRes.text();
    return NextResponse.json({ error: `OpenAI error: ${oaiRes.status} ${errText}` }, { status: 502 });
  }

  const oaiData = await oaiRes.json();
  const content: string = oaiData.choices?.[0]?.message?.content ?? '';
  if (!content) return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 502 });

  // Extract title from first line
  const lines = content.split('\n').filter(l => l.trim());
  const title = lines[0].replace(/^#+\s*/, '').trim();
  const bodyText = lines.slice(1).join('\n').trim();

  const { data: inserted, error: insertErr } = await supabase
    .from('insights')
    .insert({ title, body: bodyText, type, category: category ?? null })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: inserted.id, title, body: bodyText });
}

// GET /api/generate-insight — fetch existing insights
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from('insights')
    .select('id, title, body, type, category, generated_at')
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ insights: data ?? [] });
}
