import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getOpenAIOutputText, OPENAI_METADATA_MODEL, OPENAI_REASONING } from '@/lib/openai-config';

export const runtime = 'nodejs';

const PERIOD_LABELS: Record<string, string> = {
  day: '今日',
  week: '今週',
  month: '今月',
  year: '今年',
};

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

  const { periodKey, clipSummaries, clipCount } = await req.json().catch(() => ({})) as {
    periodKey?: string;
    clipSummaries?: string;
    clipCount?: number;
  };
  const jpLabel = PERIOD_LABELS[periodKey ?? ''] ?? '指定期間';

  if (!clipSummaries?.trim() || !clipCount) {
    return NextResponse.json({ error: 'clipSummaries required' }, { status: 400 });
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_METADATA_MODEL,
      reasoning: OPENAI_REASONING.high,
      input: [
        {
          role: 'system',
          content: `あなたはThrow Inのキュレーション編集者です。ユーザーが${jpLabel}保存したクリップ一覧だけを根拠に、読み返す価値のあるMarkdownレポートを作成してください。

<priority>
精度を最優先、次に読みやすさと生成速度、最後にコストを考慮します。入力にない事実や外部知識は足さないでください。
</priority>

<structure>
## 概要サマリー
${jpLabel}の保存傾向を2〜3文で説明する。

## 主要テーマ
繰り返し現れるトピックやキーワードを3〜5件に整理する。

## 注目コンテンツ
重要そうな記事・動画を2〜3件選び、選定理由を短く書く。

## 学びのポイント
この期間から得られる洞察や次のアクションを3件以内で提案する。
</structure>

<style>
- 日本語で書く
- 見出しは上記の4つだけを使う
- 1段落は120字以内を目安にする
- 過度な断定、装飾目的の絵文字、HTMLは使わない
</style>`,
        },
        {
          role: 'user',
          content: `${jpLabel}のクリップ一覧（${clipCount}件）:\n\n${clipSummaries.slice(0, 20000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('OpenAI report request failed', { status: res.status, body: detail.slice(0, 500) });
    return NextResponse.json({ error: 'Report generation failed' }, { status: 502 });
  }

  const data = await res.json();
  const report = getOpenAIOutputText(data);
  if (!report) return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 502 });

  return NextResponse.json({ report });
}
