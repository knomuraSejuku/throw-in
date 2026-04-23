'use client';
import { useState, useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { FileBarChart2, Loader2 } from 'lucide-react';
import { useClipStore } from '@/lib/store';
import ReactMarkdown from 'react-markdown';

const PERIODS = [
  { key: 'day',   label: '日報', ms: 86_400_000,      jpLabel: '今日' },
  { key: 'week',  label: '週報', ms: 604_800_000,     jpLabel: '今週' },
  { key: 'month', label: '月報', ms: 2_592_000_000,   jpLabel: '今月' },
  { key: 'year',  label: '年報', ms: 31_536_000_000,  jpLabel: '今年' },
] as const;

type PeriodKey = typeof PERIODS[number]['key'];

export default function ReportsPage() {
  const { clips, fetchClips } = useClipStore();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month');
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const getPeriodClips = (periodKey: PeriodKey) => {
    const period = PERIODS.find(p => p.key === periodKey)!;
    const cutoff = Date.now() - period.ms;
    return clips.filter(c => c.timestamp > cutoff);
  };

  const handleGenerate = async () => {
    const openAiKey = localStorage.getItem('openai_api_key');
    if (!openAiKey) {
      setError('OpenAI APIキーが設定されていません。設定画面から登録してください。');
      return;
    }
    const periodClips = getPeriodClips(selectedPeriod);
    if (periodClips.length === 0) {
      setError('この期間に保存されたクリップがありません。');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setReport(null);

    const period = PERIODS.find(p => p.key === selectedPeriod)!;
    const clipSummaries = periodClips
      .map(c =>
        `【${c.typeLabel}】${c.title}` +
        (c.summary ? `\n要約: ${c.summary}` : '') +
        (c.tags?.length ? `\nタグ: ${c.tags.join(', ')}` : '')
      )
      .join('\n\n');

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `あなたはユーザーの知的活動をサポートするキュレーターアシスタントです。ユーザーが${period.jpLabel}保存したコンテンツの一覧を受け取り、以下の構成でMarkdown形式のレポートを生成してください。\n\n## レポート構成\n1. **概要サマリー** — ${period.jpLabel}の保存傾向を2〜3文で\n2. **主要テーマ** — 繰り返し現れるトピックやキーワード\n3. **注目コンテンツ** — 特に重要そうな記事・動画を2〜3件ピックアップして理由とともに紹介\n4. **学びのポイント** — この期間から得られる洞察や次のアクション提案\n\n日本語で記述してください。`,
            },
            {
              role: 'user',
              content: `${period.jpLabel}のクリップ一覧（${periodClips.length}件）:\n\n${clipSummaries}`,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setReport(data.choices[0].message.content);
    } catch (err: unknown) {
      setError(`生成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-outline">
            <FileBarChart2 className="w-10 h-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h1 className="text-3xl font-bold text-on-surface">レポート</h1>
            <p className="text-on-surface-variant leading-relaxed text-sm">
              一定期間に保存した情報を振り返るためのサマリーを作成します。日報、週報、月報を生成して、学びを定着させましょう。
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient max-w-lg w-full mx-auto space-y-6">
          <div className="flex gap-2">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setSelectedPeriod(key); setReport(null); setError(null); }}
                className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-colors ${
                  selectedPeriod === key
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 text-white bg-primary rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
            ) : '生成する'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto bg-error/10 text-error p-4 rounded-2xl text-sm">
            {error}
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="max-w-2xl mx-auto bg-surface-container-lowest p-8 rounded-[32px] shadow-ambient prose prose-sm max-w-none text-on-surface">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        )}

      </div>
    </AppShell>
  );
}
