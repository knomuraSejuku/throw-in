import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const CATEGORY_TAXONOMY: Record<string, string[]> = {
  'Technology':  ['AI/ML', 'Web開発', 'セキュリティ', 'ハードウェア', 'モバイル', 'データサイエンス', 'クラウド'],
  'Business':    ['スタートアップ', 'マーケティング', '経営戦略', '金融・投資', 'キャリア'],
  'Design':      ['UI/UX', 'グラフィック', 'プロダクト', 'ブランディング'],
  'Science':     ['物理・数学', '生物・医学', '宇宙', '環境・気候'],
  'Culture':     ['映画・TV', '音楽', '文学', 'アート', 'ゲーム'],
  'Health':      ['フィットネス', '栄養', 'メンタルヘルス', '医療'],
  'Politics':    ['政治', '国際関係', '法律・制度', '社会問題'],
  'Education':   ['学習・研究', '哲学', '歴史'],
  'Other':       ['その他'],
};

const MAX_AI_TAGS = 20;

async function getOpenAIError(response: Response) {
  const text = await response.text().catch(() => '');
  return {
    status: response.status,
    statusText: response.statusText,
    body: text.slice(0, 1000),
  };
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = String(tag ?? '').trim().replace(/^#/, '').replace(/\s+/g, ' ');
    if (!value || value.length > 50) continue;

    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(value);
    if (normalized.length >= MAX_AI_TAGS) break;
  }

  return normalized;
}

export async function POST(req: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'AI processing unavailable' }, { status: 503 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (toSet) => { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { clipId, content, existingTags = [], clipTitle = '' } = await req.json() as {
    clipId: string;
    content: string;
    existingTags?: string[];
    clipTitle?: string;
  };

  if (!clipId || !content) return NextResponse.json({ error: 'Missing clipId or content' }, { status: 400 });

  // Verify ownership
  const { data: clip } = await supabase.from('clips').select('user_id').eq('id', clipId).single();
  if (!clip || clip.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const systemPrompt = `あなたはプロの編集者です。ユーザーが保存するコンテンツのメタデータを抽出します。提供されたテキストを読み、以下のJSONフォーマットで要約・タグ・カテゴリを返してください。

カテゴリは以下の固定リストから必ず1つ選んでください:
${JSON.stringify(CATEGORY_TAXONOMY)}

【既存タグ（できる限りここから再利用すること）】
${existingTags.length > 0 ? existingTags.join(', ') : '（なし）'}

タグ付けルール:
- tagsは最大20件。必ず原典本文・タイトル・要約への関連度が高い順に並べる
- 上位20件に入らない周辺語・一般語・重複語・広すぎるタグは出力しない
- 原典の主要概念、固有名詞、技術名、人物名、プロダクト名、テーマに強く関係するタグだけを選ぶ
- 既存タグに合致するものがあれば完全一致で再利用する
- 新しい概念には新規タグを追加してよい
- タグは短く具体的に（1〜4語程度）

出力フォーマット:
{"summary": "3〜4文程度の要約（コンテンツの言語に合わせる）", "tags": ["タグ1", "タグ2", ...], "category": "カテゴリ名", "subcategory": "サブカテゴリ名", "key_points": "## ポイント1\\n\\n- 説明（Markdown形式。h2/h3と箇条書きで階層を表現。コンテンツの言語に合わせる）"}`;

  // AI summary/tags/category
  let aiSummary: string | null = null;
  let newTags: string[] = [];
  let aiCategory: string | null = null;
  let aiSubcategory: string | null = null;
  let aiKeyPoints: string | null = null;

  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-nano',
        text: { format: { type: 'json_object' } },
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content.substring(0, 20000) },
        ],
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const outputText = aiData.output?.find((o: { type: string }) => o.type === 'message')
        ?.content?.find((c: { type: string }) => c.type === 'output_text')?.text ?? '';
      try {
        const parsed = JSON.parse(outputText);
        aiSummary = parsed.summary || null;
        newTags = normalizeTags(parsed.tags);
        aiCategory = parsed.category || null;
        aiSubcategory = parsed.subcategory || null;
        aiKeyPoints = typeof parsed.key_points === 'string' ? parsed.key_points.trim() : null;
      } catch { /* parse error, retry */ }
      if (aiSummary || newTags.length > 0 || aiCategory || aiKeyPoints) {
        break;
      }

      console.error('OpenAI response did not contain parseable metadata', { outputText: outputText.slice(0, 500) });
      if (attempt >= MAX_RETRIES) {
        return NextResponse.json({ error: 'AI response was not parseable' }, { status: 502 });
      }
    } else if (attempt >= MAX_RETRIES) {
      const errorInfo = await getOpenAIError(aiRes);
      console.error('OpenAI metadata request failed', errorInfo);
      return NextResponse.json({ error: 'AI request failed', detail: errorInfo.statusText || String(errorInfo.status) }, { status: 502 });
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Embeddings
  let embeddingVector: number[] | null = null;
  try {
    const embedInput = `タイトル: ${clipTitle}\n要約: ${aiSummary || ''}\n\n${content}`.substring(0, 8000);
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: embedInput }),
    });
    if (embedRes.ok) {
      const embedData = await embedRes.json();
      embeddingVector = embedData.data[0].embedding;
    } else {
      console.error('OpenAI embedding request failed', await getOpenAIError(embedRes));
    }
  } catch (err) {
    console.error('Embedding generation threw', err);
  }

  const mergedTags = normalizeTags(newTags.length > 0 ? newTags : existingTags);

  // Persist to DB
  const dbUpdate: Record<string, unknown> = { summary: aiSummary };
  if (embeddingVector) dbUpdate.embedding = embeddingVector;
  if (aiCategory) dbUpdate.category = aiCategory;
  if (aiSubcategory) dbUpdate.subcategory = aiSubcategory;
  if (aiKeyPoints) dbUpdate.key_points = aiKeyPoints;
  const { error: updateError } = await supabase.from('clips').update(dbUpdate).eq('id', clipId);
  if (updateError) {
    console.error('Failed to persist AI metadata', updateError);
    return NextResponse.json({ error: 'Failed to persist AI metadata', detail: updateError.message }, { status: 500 });
  }

  if (mergedTags.length > 0) {
    await supabase.from('clip_tags').delete().eq('clip_id', clipId);
    const { error: tagError } = await supabase.from('clip_tags').insert(mergedTags.map(t => ({ clip_id: clipId, name: t, user_id: user.id })));
    if (tagError) {
      console.error('Failed to persist AI tags', tagError);
      return NextResponse.json({ error: 'Failed to persist AI tags', detail: tagError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ summary: aiSummary, tags: mergedTags, category: aiCategory, subcategory: aiSubcategory, keyPoints: aiKeyPoints });
}

export async function PUT(req: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'AI processing unavailable' }, { status: 503 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (toSet) => { try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { query } = await req.json() as { query: string };
  if (!query?.trim()) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: query }),
  });

  if (!embedRes.ok) {
    console.error('OpenAI search embedding request failed', await getOpenAIError(embedRes));
    return NextResponse.json({ error: 'Embedding failed' }, { status: 502 });
  }
  const embedData = await embedRes.json();
  const queryEmbedding = embedData.data[0].embedding;

  const { data: results } = await supabase.rpc('match_clips', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 20,
    p_user_id: user.id,
  });

  return NextResponse.json({ ids: (results ?? []).map((r: { id: string }) => r.id) });
}

export async function PATCH(req: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'AI processing unavailable' }, { status: 503 });

  const { text, targetLang } = await req.json() as { text: string; targetLang: string };
  if (!text || !targetLang) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
    body: JSON.stringify({
      model: 'gpt-5.4-nano',
      input: [
        { role: 'system', content: `Translate the following text to ${targetLang}. Return only the translated text, no explanation.` },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!res.ok) {
    console.error('OpenAI translation request failed', await getOpenAIError(res));
    return NextResponse.json({ error: 'Translation failed' }, { status: 502 });
  }
  const data = await res.json();
  const translated = data.output?.find((o: { type: string }) => o.type === 'message')
    ?.content?.find((c: { type: string }) => c.type === 'output_text')?.text ?? null;

  return NextResponse.json({ translated });
}
