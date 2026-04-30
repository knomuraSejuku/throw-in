'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Activity, CreditCard, Database, Flag, LayoutTemplate, Loader2, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price_yen: number;
  yearly_price_yen: number;
  weekly_ai_limit: number;
  is_active: boolean;
  sort_order: number;
};

type Overview = {
  totals: {
    users: number;
    clips: number;
    saves: number;
    globalClips: number;
    aiEvents: number;
    subscriptions: number;
    monthlyRevenueYen: number;
    yearlyRevenueYen: number;
  };
  clipsByType: Record<string, number>;
  aiByMonth: { month: string; count: number }[];
  subscriptionsByPlan: Record<string, number>;
  plans: Plan[];
};

const blankPlan: Omit<Plan, 'id'> = {
  code: '',
  name: '',
  description: '',
  monthly_price_yen: 0,
  yearly_price_yen: 0,
  weekly_ai_limit: 0,
  is_active: true,
  sort_order: 100,
};

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<Omit<Plan, 'id'> | Plan>(blankPlan);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewRes, plansRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/plans'),
      ]);
      const overviewData = await overviewRes.json().catch(() => null);
      const plansData = await plansRes.json().catch(() => null);
      if (!overviewRes.ok) throw new Error(overviewData?.error || '管理情報を取得できません。');
      if (!plansRes.ok) throw new Error(plansData?.error || 'プラン情報を取得できません。');
      setOverview(overviewData);
      setPlans(plansData.plans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '管理情報を取得できません。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maxAiCount = useMemo(
    () => Math.max(1, ...(overview?.aiByMonth ?? []).map(item => item.count)),
    [overview?.aiByMonth]
  );

  const startNewPlan = () => {
    setEditingPlan(null);
    setDraft(blankPlan);
  };

  const startEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setDraft(plan);
  };

  const savePlan = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: editingPlan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan ? { ...draft, id: editingPlan.id } : draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'プラン保存に失敗しました。');
      await load();
      startNewPlan();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'プラン保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
        <div>
          <h1 className="brand-page-title">管理ダッシュボード</h1>
          <p className="brand-page-kicker">プラン、課金状況、利用状況の確認</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-outline" /></div>
        ) : error ? (
          <div className="brand-panel p-8 text-error">{error}</div>
        ) : overview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'ユーザー', value: overview.totals.users, icon: Users },
                { label: '総クリップ', value: overview.totals.clips, icon: Database },
                { label: '保存数', value: overview.totals.saves, icon: LayoutTemplate },
                { label: 'AI処理', value: overview.totals.aiEvents, icon: Activity },
                { label: '月額MRR', value: `¥${overview.totals.monthlyRevenueYen.toLocaleString('ja-JP')}`, icon: CreditCard },
                { label: '年額ARR', value: `¥${overview.totals.yearlyRevenueYen.toLocaleString('ja-JP')}`, icon: CreditCard },
                { label: '契約数', value: overview.totals.subscriptions, icon: ShieldAlert },
                { label: 'グローバル', value: overview.totals.globalClips, icon: Database },
              ].map(item => (
                <div key={item.label} className="brand-panel p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-outline uppercase tracking-widest">
                    {item.label}
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4 text-3xl font-bold text-on-surface">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="brand-panel p-6 space-y-4">
                <h2 className="brand-section-title">月別AI処理</h2>
                <div className="space-y-3">
                  {overview.aiByMonth.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">まだAI処理履歴がありません。</p>
                  ) : overview.aiByMonth.map(item => (
                    <div key={item.month} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="text-on-surface-variant">{item.month}</span>
                      <div className="h-3 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxAiCount) * 100}%` }} />
                      </div>
                      <span className="text-right font-bold text-on-surface">{item.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="brand-panel p-6 space-y-4">
                <h2 className="brand-section-title">契約プラン分布</h2>
                <div className="space-y-3">
                  {Object.keys(overview.subscriptionsByPlan).length === 0 ? (
                    <p className="text-sm text-on-surface-variant">契約情報はまだありません。</p>
                  ) : Object.entries(overview.subscriptionsByPlan).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3">
                      <span className="font-semibold text-on-surface">{name}</span>
                      <span className="text-sm font-bold text-on-surface-variant">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="brand-panel p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="brand-section-title">プラン設定</h2>
                <button onClick={startNewPlan} className="brand-button-secondary">新規プラン</button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {plans.map(plan => (
                  <button key={plan.id} onClick={() => startEditPlan(plan)} className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-4 text-left hover:bg-surface-container transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-on-surface">{plan.name}</p>
                      <span className="text-[10px] text-on-surface-variant">{plan.is_active ? '有効' : '停止'}</span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{plan.description}</p>
                    <p className="mt-3 text-sm font-bold text-on-surface">週 {plan.weekly_ai_limit} AI</p>
                    <p className="text-xs text-on-surface-variant">月額 ¥{plan.monthly_price_yen.toLocaleString('ja-JP')} / 年額 ¥{plan.yearly_price_yen.toLocaleString('ja-JP')}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl bg-surface-container-low p-4 space-y-3">
                <p className="text-sm font-bold text-on-surface">{editingPlan ? `${editingPlan.name}を編集` : '新規プラン作成'}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ['code', 'コード'],
                    ['name', '名称'],
                    ['description', '説明'],
                  ].map(([key, label]) => (
                    <input key={key} value={String((draft as any)[key] ?? '')} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} placeholder={label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm outline-none focus:border-primary" />
                  ))}
                  {[
                    ['monthly_price_yen', '月額料金'],
                    ['yearly_price_yen', '年額料金'],
                    ['weekly_ai_limit', '週間AI上限'],
                    ['sort_order', '表示順'],
                  ].map(([key, label]) => (
                    <input key={key} type="number" value={Number((draft as any)[key] ?? 0)} onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))} placeholder={label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm outline-none focus:border-primary" />
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input type="checkbox" checked={Boolean((draft as any).is_active)} onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))} />
                  有効
                </label>
                <button onClick={savePlan} disabled={isSaving} className="brand-button-primary">
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/admin/billing" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <CreditCard className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">課金管理</h3>
                <p className="text-sm text-on-surface-variant">契約、請求間隔、プラン状態を確認します。</p>
              </Link>
              <Link href="/admin/clips" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <Database className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">クリップ管理</h3>
                <p className="text-sm text-on-surface-variant">公開状態、AI整理状態、作成状況を確認します。</p>
              </Link>
              <Link href="/admin/reports" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <Flag className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">通報管理</h3>
                <p className="text-sm text-on-surface-variant">通報内容と対応ステータスを確認します。</p>
              </Link>
              <Link href="/admin/jobs" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <Database className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">ジョブ管理</h3>
                <p className="text-sm text-on-surface-variant">バックグラウンドジョブを確認します。</p>
              </Link>
              <Link href="/admin/cards" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <LayoutTemplate className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">公開カードレビュー</h3>
                <p className="text-sm text-on-surface-variant">公開カード候補を確認します。</p>
              </Link>
              <Link href="/admin/users" className="brand-panel p-8 hover:shadow-card-hover transition-all block">
                <ShieldAlert className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-bold text-on-surface mb-2">ユーザー管理</h3>
                <p className="text-sm text-on-surface-variant">ユーザー状況を確認します。</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
