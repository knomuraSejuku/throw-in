import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { getOpenAIOutputText, OPENAI_EMBEDDING_MODEL, OPENAI_METADATA_MODEL } from '@/lib/openai-config';

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
const GENERIC_CLIP_TITLES = new Set([
  'x post',
  'x article',
  'twitter post',
  'twitter article',
  '無題の記事',
  'new file',
  '新しいファイル',
  '共有ファイル',
]);

function normalizeTitle(title: unknown): string | null {
  const value = String(title ?? '').trim().replace(/\s+/g, ' ');
  if (!value || value.length > 120) return null;
  return value;
}

function isGenericTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_CLIP_TITLES.has(normalized)) return true;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
  } catch {
    // Not a URL.
  }
  if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(normalized)) return true;
  if (/^x\s+(post|article)(\s*[:\-–—]\s*)?$/i.test(title)) return true;
  if (/^twitter\s+(post|article)(\s*[:\-–—]\s*)?$/i.test(title)) return true;
  if (/^image\.(jpe?g|png|webp|gif|heic)$/i.test(title)) return true;
  if (/^document\.pdf$/i.test(title)) return true;
  return false;
}

function isUploadedFileClip(clip: { content_type?: string | null; source_domain?: string | null; url?: string | null }) {
  if (clip.content_type === 'image' || clip.content_type === 'document') return true;
  if (clip.content_type === 'video' && clip.url?.includes('/storage/v1/object/public/clip-attachments/')) return true;
  const source = clip.source_domain ?? '';
  return /\.(jpe?g|png|webp|gif|heic|pdf|mp4)$/i.test(source);
}

async function getOpenAIError(response: Response) {
  const text = await response.text().catch(() => '');
  return {
    status: response.status,
    statusText: response.statusText,
    body: text.slice(0, 1000),
  };
}

async function checkAiQuota(userId: string, clipId: string) {
  const service = getMetadataClient();
  if (!service) return { ok: true, remaining: null };

  try {
    const { data: adminUser } = await service
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (adminUser) return { ok: true, remaining: null, admin: true };

    const { data: subscription } = await service
      .from('user_subscriptions')
      .select('billing_plans(weekly_ai_limit, name)')
      .eq('user_id', userId)
      .maybeSingle();
    const plan = Array.isArray(subscription?.billing_plans) ? subscription?.billing_plans[0] : subscription?.billing_plans;
    if (!plan) return { ok: true, remaining: null };

    const limit = Number(plan.weekly_ai_limit ?? 0);
    if (limit <= 0) return { ok: false, remaining: 0, limit, used: 0 };

    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    const { count, error } = await service
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .gte('created_at', weekStart.toISOString());

    if (error) return { ok: true, remaining: null };
    const used = count ?? 0;
    return {
      ok: used < limit,
      remaining: Math.max(0, limit - used),
      limit,
      used,
    };
  } catch (error) {
    console.warn('[ai_quota:skipped]', { clipId, error: error instanceof Error ? error.message : String(error) });
    return { ok: true, remaining: null };
  }
}

function getMetadataClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function recordAiEvent(params: {
  userId: string;
  clipId: string;
  action: string;
  status: 'succeeded' | 'failed' | 'skipped';
  model?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const service = getMetadataClient();
  if (!service) return null;

  const { data, error } = await service
    .from('ai_usage_events')
    .insert({
      user_id: params.userId,
      clip_id: params.clipId,
      action: params.action,
      model: params.model ?? null,
      status: params.status,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ai_usage_event:failed]', { clipId: params.clipId, action: params.action, error: error.message });
    return null;
  }

  return data.id as string;
}

function hashVersionSource(content: string, title: string) {
  return createHash('sha256')
    .update(`${content.trim()}\n---\n${title.trim()}`)
    .digest('hex');
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

  // Verify the clip is saved by this user. URL clips can be shared across users,
  // so ownership by clips.user_id is no longer a valid access check.
  const { data: savedClip } = await supabase
    .from('clip_saves')
    .select(`
      clip_id,
      clips (
        user_id,
        title,
        content_type,
        source_domain,
        url
      )
    `)
    .eq('user_id', user.id)
    .eq('clip_id', clipId)
    .maybeSingle();
  const clip = Array.isArray(savedClip?.clips) ? savedClip?.clips[0] : savedClip?.clips;
  if (!clip) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const currentTitle = String(clip.title || clipTitle || '').trim();
  const shouldImproveTitle = isUploadedFileClip(clip) || isGenericTitle(currentTitle);

  const quota = await checkAiQuota(user.id, clipId);
  if (!quota.ok) {
    return NextResponse.json({
      error: 'AI weekly limit reached',
      detail: `週間AI処理回数の上限に達しました。プランを変更するか、次週までお待ちください。`,
      quota,
    }, { status: 429 });
  }

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

タイトル生成ルール:
- generated_titleには、一覧で一目で内容が分かる短いタイトルを必ず返す
- URL、ドメイン名、ファイル名、"X Post"、"X Article"、"Twitter Post"、"無題の記事" のような汎用名をそのまま使わない
- 20〜45文字程度を目安に、主題・固有名詞・資料種別が分かる自然なタイトルにする
- クリックを煽る表現や説明文ではなく、保存物の名前として使える表現にする

出力フォーマット:
{"generated_title": "内容が一目で分かる短いタイトル", "summary": "3〜4文程度の要約（コンテンツの言語に合わせる）", "tags": ["タグ1", "タグ2", ...], "category": "カテゴリ名", "subcategory": "サブカテゴリ名", "key_points": "## ポイント1\\n\\n- 説明（Markdown形式。h2/h3と箇条書きで階層を表現。コンテンツの言語に合わせる）"}`;

  // AI summary/tags/category
  let aiSummary: string | null = null;
  let newTags: string[] = [];
  let aiCategory: string | null = null;
  let aiSubcategory: string | null = null;
  let aiKeyPoints: string | null = null;
  let aiGeneratedTitle: string | null = null;

  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: OPENAI_METADATA_MODEL,
        text: { format: { type: 'json_object' } },
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              `現在のタイトル: ${currentTitle || '（なし）'}`,
              `コンテンツ種別: ${clip.content_type || 'unknown'}`,
              `保存元/ファイル名: ${clip.source_domain || '（なし）'}`,
              '',
              content.substring(0, 20000),
            ].join('\n'),
          },
        ],
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const outputText = getOpenAIOutputText(aiData);
      try {
        const parsed = JSON.parse(outputText);
        aiGeneratedTitle = normalizeTitle(parsed.generated_title);
        aiSummary = parsed.summary || null;
        newTags = normalizeTags(parsed.tags);
        aiCategory = parsed.category || null;
        aiSubcategory = parsed.subcategory || null;
        aiKeyPoints = typeof parsed.key_points === 'string' ? parsed.key_points.trim() : null;
      } catch { /* parse error, retry */ }
      if (aiGeneratedTitle || aiSummary || newTags.length > 0 || aiCategory || aiKeyPoints) {
        break;
      }

      console.error('OpenAI response did not contain parseable metadata', { outputText: outputText.slice(0, 500) });
      if (attempt >= MAX_RETRIES) {
        await recordAiEvent({
          userId: user.id,
          clipId,
          action: 'clip_version',
          status: 'failed',
          model: OPENAI_METADATA_MODEL,
          metadata: {
            stage: 'metadata_parse',
            output_sample: outputText.slice(0, 1000),
            content_length: content.length,
          },
        });
        return NextResponse.json({ error: 'AI response was not parseable' }, { status: 502 });
      }
    } else if (attempt >= MAX_RETRIES) {
      const errorInfo = await getOpenAIError(aiRes);
      console.error('OpenAI metadata request failed', errorInfo);
      await recordAiEvent({
        userId: user.id,
        clipId,
        action: 'clip_version',
        status: 'failed',
        model: OPENAI_METADATA_MODEL,
        metadata: {
          stage: 'openai_metadata',
          error: errorInfo,
          content_length: content.length,
        },
      });
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
      body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: embedInput }),
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
  const nextTitle = shouldImproveTitle && aiGeneratedTitle && aiGeneratedTitle !== currentTitle
    ? aiGeneratedTitle
    : null;

  // Persist to DB and keep a version history. The latest successful AI organization
  // becomes the current canonical version for this shared clip.
  const dbUpdate: Record<string, unknown> = { summary: aiSummary };
  if (nextTitle) dbUpdate.title = nextTitle;
  if (embeddingVector) dbUpdate.embedding = embeddingVector;
  if (aiCategory) dbUpdate.category = aiCategory;
  if (aiSubcategory) dbUpdate.subcategory = aiSubcategory;
  if (aiKeyPoints) dbUpdate.key_points = aiKeyPoints;
  const metadataClient = getMetadataClient() ?? supabase;

  let usageEventId: string | null = null;

  const sourceHash = hashVersionSource(content, nextTitle || currentTitle || clipTitle || '');
  const { data: latestVersion, error: latestVersionError } = await metadataClient
    .from('clip_versions')
    .select('version_number, source_hash')
    .eq('clip_id', clipId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentVersionId: string | null = null;
  const canPersistVersion = !latestVersionError;
  if (!canPersistVersion) {
    console.error('Failed to load latest clip version; continuing without version history', latestVersionError);
  } else if (latestVersion?.source_hash === sourceHash) {
    await metadataClient
      .from('clips')
      .update({ last_refreshed_at: new Date().toISOString() })
      .eq('id', clipId);
  } else if (canPersistVersion) {
    const { data: version, error: versionError } = await metadataClient
      .from('clip_versions')
      .insert({
        clip_id: clipId,
        version_number: (latestVersion?.version_number ?? 0) + 1,
        source_url: clip.url || null,
        source_hash: sourceHash,
        title: nextTitle || currentTitle || clipTitle || '無題のクリップ',
        summary: aiSummary,
        extracted_content: content,
        tags: mergedTags,
        category: aiCategory,
        subcategory: aiSubcategory,
        key_points: aiKeyPoints,
        created_by: user.id,
        created_reason: latestVersion ? 'refresh' : 'initial',
        ai_model: OPENAI_METADATA_MODEL,
        ai_usage_event_id: usageEventId,
      })
      .select('id')
      .single();

    if (versionError) {
      console.error('Failed to persist clip version', versionError);
      dbUpdate.last_refreshed_at = new Date().toISOString();
    } else {
      currentVersionId = version.id;
      dbUpdate.current_version_id = currentVersionId;
      dbUpdate.last_refreshed_at = new Date().toISOString();
    }
  }

  const { error: updateError } = await metadataClient.from('clips').update(dbUpdate).eq('id', clipId);
  if (updateError) {
    console.error('Failed to persist AI metadata', updateError);
    await recordAiEvent({
      userId: user.id,
      clipId,
      action: 'clip_version',
      status: 'failed',
      model: OPENAI_METADATA_MODEL,
      metadata: {
        stage: 'persist_metadata',
        error: updateError.message,
        code: updateError.code,
      },
    });
    return NextResponse.json({ error: 'Failed to persist AI metadata', detail: updateError.message }, { status: 500 });
  }

  if (mergedTags.length > 0) {
    const tagOwnerId = clip.user_id || user.id;
    await metadataClient.from('clip_tags').delete().eq('clip_id', clipId);
    const { error: tagError } = await metadataClient.from('clip_tags').insert(mergedTags.map(t => ({ clip_id: clipId, name: t, user_id: tagOwnerId })));
    if (tagError) {
      console.error('Failed to persist AI tags', tagError);
    }
  }

  usageEventId = await recordAiEvent({
    userId: user.id,
    clipId,
    action: 'clip_version',
    status: 'succeeded',
    model: OPENAI_METADATA_MODEL,
    metadata: {
      embedding_model: embeddingVector ? OPENAI_EMBEDDING_MODEL : null,
      title_updated: Boolean(nextTitle),
      tags_count: mergedTags.length,
      summary_present: Boolean(aiSummary),
      key_points_present: Boolean(aiKeyPoints),
      content_length: content.length,
      version_id: currentVersionId,
    },
  });

  if (usageEventId && currentVersionId) {
    await metadataClient
      .from('clip_versions')
      .update({ ai_usage_event_id: usageEventId })
      .eq('id', currentVersionId);
  }

  return NextResponse.json({ title: nextTitle, summary: aiSummary, tags: mergedTags, category: aiCategory, subcategory: aiSubcategory, keyPoints: aiKeyPoints });
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
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: query }),
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
      model: OPENAI_METADATA_MODEL,
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
