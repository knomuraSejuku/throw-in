import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
          role: 'system',
          content: `あなたはユーザーの知的活動をサポートするキュレーターアシスタントです。ユーザーが${jpLabel}保存したコンテンツの一覧を受け取り、以下の構成でMarkdown形式のレポートを生成してください。\n\n## レポート構成\n1. **概要サマリー** — ${jpLabel}の保存傾向を2〜3文で\n2. **主要テーマ** — 繰り返し現れるトピックやキーワード\n3. **注目コンテンツ** — 特に重要そうな記事・動画を2〜3件ピックアップして理由とともに紹介\n4. **学びのポイント** — この期間から得られる洞察や次のアクション提案\n\n日本語で記述してください。`,
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
  const report = data.choices?.[0]?.message?.content ?? '';
  if (!report) return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 502 });

  return NextResponse.json({ report });
}
