'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { BarChart2, Loader2, Newspaper, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useClipStore } from '@/lib/store';
import ReactMarkdown from 'react-markdown';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';

type InsightItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  category: string | null;
  generated_at: string;
};

const INSIGHT_TYPES = [
  { key: 'column', label: 'コラム' },
  { key: 'weekly', label: '週次ダイジェスト' },
  { key: 'category', label: 'カテゴリ特集' },
] as const;

const PERIODS = [
  { key: 'day',   label: '日報', ms: 86_400_000,      jpLabel: '今日' },
  { key: 'week',  label: '週報', ms: 604_800_000,     jpLabel: '今週' },
  { key: 'month', label: '月報', ms: 2_592_000_000,   jpLabel: '今月' },
  { key: 'year',  label: '年報', ms: 31_536_000_000,  jpLabel: '今年' },
] as const;

type PeriodKey = typeof PERIODS[number]['key'];

const TYPE_LABELS: Record<string, string> = {
  url: '記事', video: '動画', image: '画像', pdf: 'ドキュメント', diary: '日記・メモ',
};

const chartTooltipStyle = {
  background: 'var(--color-surface-container-lowest)',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-ambient)',
  color: 'var(--color-on-surface)',
  fontSize: 12,
};

function getLast8Weeks(clips: { timestamp: number }[]) {
  const weeks: { label: string; count: number }[] = [];
  const now = Date.now();
  for (let i = 7; i >= 0; i--) {
    const weekStart = now - (i + 1) * 7 * 86_400_000;
    const weekEnd   = now - i * 7 * 86_400_000;
    const count = clips.filter(c => c.timestamp >= weekStart && c.timestamp < weekEnd).length;
    const d = new Date(weekEnd);
    weeks.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count });
  }
  return weeks;
}

export default function InsightsPage() {
  const { clips, fetchClips } = useClipStore();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month');
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Columns state
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightType, setInsightType] = useState<'column' | 'weekly' | 'category'>('column');
  const [insightCategory, setInsightCategory] = useState('');
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    const res = await fetch('/api/generate-insight?limit=10');
    if (res.ok) {
      const data = await res.json();
      setInsights(data.insights ?? []);
    }
    setInsightsLoading(false);
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  const handleGenerateInsight = async () => {
    setIsGeneratingInsight(true);
    setInsightError(null);
    try {
      const res = await fetch('/api/generate-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: insightType, category: insightCategory || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      await loadInsights();
      setExpandedId(data.id);
    } catch (err: unknown) {
      setInsightError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const stats = useMemo(() => {
    const total = clips.length;
    const unread = clips.filter(c => c.isUnread).length;

    const byType = Object.entries(TYPE_LABELS).map(([key, label]) => ({
      name: label,
      count: clips.filter(c => c.type === key).length,
    })).filter(d => d.count > 0);

    const byCat: Record<string, number> = {};
    clips.forEach(c => { if (c.category) byCat[c.category] = (byCat[c.category] ?? 0) + 1; });
    const byCategory = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const tagFreq: Record<string, number> = {};
    clips.forEach(c => (c.tags ?? []).forEach(t => { tagFreq[t] = (tagFreq[t] ?? 0) + 1; }));
    const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const weeklyTrend = getLast8Weeks(clips);

    return { total, unread, byType, byCategory, topTags, weeklyTrend };
  }, [clips]);

  const getPeriodClips = (periodKey: PeriodKey) => {
    const period = PERIODS.find(p => p.key === periodKey)!;
    const cutoff = Date.now() - period.ms;
    return clips.filter(c => c.timestamp > cutoff);
  };

  const handleGenerate = async () => {
    const periodClips = getPeriodClips(selectedPeriod);
    if (periodClips.length === 0) {
      setError('この期間に保存されたクリップがありません。');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setReport(null);

    const clipSummaries = periodClips
      .map(c =>
        `【${c.typeLabel}】${c.title}` +
        (c.summary ? `\n要約: ${c.summary}` : '') +
        (c.tags?.length ? `\nタグ: ${c.tags.join(', ')}` : '')
      )
      .join('\n\n');

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodKey: selectedPeriod,
          clipSummaries,
          clipCount: periodClips.length,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setReport(data.report);
    } catch (err: unknown) {
      setError(`生成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-10">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="brand-page-title">インサイト</h1>
          <p className="brand-page-kicker">保存した情報の傾向と振り返り</p>
        </div>

        {/* AI Columns Section */}
        <div className="space-y-4">
          <h2 className="brand-section-title">
            <Newspaper className="w-5 h-5 text-primary" />
            AIコラム
          </h2>

          {/* Generator card */}
          <div className="brand-panel p-5 md:p-6 space-y-4 max-w-lg">
            <div className="flex gap-2 flex-wrap">
              {INSIGHT_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setInsightType(key)}
                  className={`${
                    insightType === key
                      ? 'brand-segment brand-segment-active'
                      : 'brand-segment'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {insightType === 'category' && (
              <input
                type="text"
                placeholder="カテゴリ名（例: テクノロジー）"
                value={insightCategory}
                onChange={e => setInsightCategory(e.target.value)}
                className="w-full rounded-full border border-outline-variant/45 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
              />
            )}
            <button
              onClick={handleGenerateInsight}
              disabled={isGeneratingInsight || (insightType === 'category' && !insightCategory.trim())}
              className="brand-button-primary w-full"
            >
              {isGeneratingInsight
                ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                : <><Sparkles className="w-4 h-4" />コラムを生成</>}
            </button>
            {insightError && <p className="text-sm text-error">{insightError}</p>}
          </div>

          {/* Columns list */}
          {insightsLoading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4">
              <Loader2 className="w-4 h-4 animate-spin" />読み込み中...
            </div>
          ) : insights.length === 0 ? (
            <p className="text-sm text-on-surface-variant">まだコラムがありません。上のボタンで生成してみてください。</p>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {insights.map(item => (
                <div key={item.id} className="brand-panel overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="w-full flex items-start justify-between gap-3 p-5 text-left hover:bg-surface-container-low transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="brand-chip">
                          {INSIGHT_TYPES.find(t => t.key === item.type)?.label ?? item.type}
                        </span>
                        {item.category && (
                          <span className="text-[10px] text-outline">{item.category}</span>
                        )}
                        <span className="text-[10px] text-outline">
                          {new Date(item.generated_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      <p className="font-bold text-on-surface text-sm leading-snug">{item.title}</p>
                    </div>
                    {expandedId === item.id
                      ? <ChevronUp className="w-4 h-4 text-outline flex-shrink-0 mt-1" />
                      : <ChevronDown className="w-4 h-4 text-outline flex-shrink-0 mt-1" />}
                  </button>
                  {expandedId === item.id && (
                    <div className="px-5 pb-6 ai-column-body border-t border-outline-variant/10 pt-4">
                      <ReactMarkdown>{item.body}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '総クリップ数', value: stats.total },
            { label: '未読', value: stats.unread },
            { label: '既読', value: stats.total - stats.unread },
            { label: '未読率', value: stats.total > 0 ? `${Math.round(stats.unread / stats.total * 100)}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="brand-panel p-4 space-y-1">
              <p className="text-xs text-on-surface-variant">{label}</p>
              <p className="text-2xl font-bold text-on-surface">{value}</p>
            </div>
          ))}
        </div>

        {/* 未読/既読 progress */}
        {stats.total > 0 && (
          <div className="brand-chart-card space-y-3">
            <p className="brand-chart-title">未読 / 既読</p>
            <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.round((stats.total - stats.unread) / stats.total * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span>既読 {stats.total - stats.unread}件</span>
              <span>未読 {stats.unread}件</span>
            </div>
          </div>
        )}

        {/* 週次推移 */}
        {stats.total > 0 && (
          <div className="brand-chart-card space-y-4">
            <p className="brand-chart-title">過去8週の保存推移</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" strokeOpacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* コンテンツタイプ別 */}
        {stats.byType.length > 0 && (
          <div className="brand-chart-card space-y-4">
            <p className="brand-chart-title">コンテンツタイプ別</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.byType} layout="vertical">
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} width={72} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* カテゴリ別 */}
        {stats.byCategory.length > 0 && (
          <div className="brand-chart-card space-y-4">
            <p className="brand-chart-title">カテゴリ別</p>
            <ResponsiveContainer width="100%" height={Math.max(140, stats.byCategory.length * 36)}>
              <BarChart data={stats.byCategory} layout="vertical">
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} width={120} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 頻出タグ TOP10 */}
        {stats.topTags.length > 0 && (
          <div className="brand-chart-card space-y-4">
            <p className="brand-chart-title">頻出タグ TOP{stats.topTags.length}</p>
            <div className="space-y-2">
              {stats.topTags.map(([tag, count], i) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="text-xs text-on-surface-variant w-4 text-right">{i + 1}</span>
                  <div className="flex-1 h-6 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full"
                      style={{ width: `${Math.round(count / stats.topTags[0][1] * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-on-surface-variant min-w-[80px] truncate">#{tag}</span>
                  <span className="text-xs text-on-surface-variant w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AIレポートセクション */}
        <div className="space-y-4">
          <h2 className="brand-section-title">
            <BarChart2 className="w-5 h-5 text-primary" />
            AIレポート
          </h2>

          <div className="brand-panel p-5 md:p-6 space-y-5 max-w-lg">
            <div className="flex gap-2">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setSelectedPeriod(key); setReport(null); setError(null); }}
                  className={`flex-1 ${
                    selectedPeriod === key
                      ? 'brand-segment brand-segment-active'
                      : 'brand-segment'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="brand-button-primary w-full py-4"
            >
              {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />生成中...</> : '生成する'}
            </button>
          </div>

          {error && (
            <div className="max-w-2xl bg-error/10 text-error p-4 rounded-2xl text-sm">{error}</div>
          )}
          {report && (
            <div className="max-w-2xl brand-panel p-6 md:p-8 ai-column-body">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
