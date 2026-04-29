'use client';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

import { AppShell } from '@/components/shell/AppShell';
import { User, CreditCard, HardDrive, Smartphone, LogOut, Trash2, RefreshCw, Globe, Bell } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useClipStore } from '@/lib/store';
import { useState, useEffect, useRef } from 'react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { reprocessExistingClips, reclassifyOtherClips } = useClipStore();
  const [preferredLang, setPreferredLang] = useState('日本語');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState<{ done: number; total: number } | null>(null);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [reclassifyProgress, setReclassifyProgress] = useState<{ done: number; total: number } | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({ follow: true, comment_reply: true, like: true, announcement: true });
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🙂');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJI_OPTIONS = ['🙂','😎','🤖','🦊','🐧','🐸','🦁','🐼','🌸','⚡','🎯','🚀','🎨','📚','🎵','🌍'];

  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_language');
    if (savedLang) setPreferredLang(savedLang);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('display_name, avatar_emoji, notification_prefs').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.avatar_emoji) setAvatarEmoji(data.avatar_emoji);
        if (data?.notification_prefs) setNotifPrefs({ ...notifPrefs, ...data.notification_prefs });
      });
  }, [user?.id]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    await supabase.from('users').update({ display_name: displayName || null, avatar_emoji: avatarEmoji }).eq('id', user.id);
    setIsSavingProfile(false);
  };

  const handleSaveNotif = async () => {
    if (!user) return;
    setIsSavingNotif(true);
    await supabase.from('users').update({ notification_prefs: notifPrefs }).eq('id', user.id);
    setIsSavingNotif(false);
  };

  const handleSignOut = async () => {
    // デモログインのクッキーを削除
    document.cookie = "demo_bypass=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=None; Secure";
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    setReprocessProgress({ done: 0, total: 0 });
    await reprocessExistingClips((done, total) => setReprocessProgress({ done, total }));
    setIsReprocessing(false);
    setReprocessProgress(null);
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    setReclassifyProgress({ done: 0, total: 0 });
    await reclassifyOtherClips((done, total) => setReclassifyProgress({ done, total }));
    setIsReclassifying(false);
    setReclassifyProgress(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt.current = null;
      setCanInstall(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('本当にアカウントとすべてのデータを削除しますか？この操作は取り消せません。')) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json();
        alert(`削除に失敗しました: ${error}`);
        return;
      }
      document.cookie = "demo_bypass=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=None; Secure";
      window.location.href = '/login';
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">設定</h1>
          <p className="text-on-surface-variant font-medium text-sm">アカウントとアプリケーションの管理</p>
        </div>

        <div className="space-y-6">
          
          {/* Profile Section */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="w-20 h-20 bg-surface-container-high rounded-full overflow-hidden border-4 border-surface shrink-0">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1 text-center md:text-left space-y-1">
                <h2 className="text-xl font-bold text-on-surface">{user?.user_metadata?.full_name || 'ユーザー'}</h2>
                <p className="text-sm text-outline font-medium">{user?.email || 'ログインしていません'}</p>
              </div>
            </div>

            {/* Public Profile (for global search) */}
            <div className="border-t border-outline-variant/20 pt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-on-surface mb-0.5">グローバル検索プロフィール</p>
                <p className="text-xs text-on-surface-variant">実名は使用しないでください。グローバル検索で他のユーザーに表示されます。</p>
              </div>

              {/* Emoji avatar picker */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className="w-14 h-14 rounded-full bg-surface-container-high text-3xl flex items-center justify-center hover:bg-surface-container transition-colors border border-outline-variant/30"
                  >
                    {avatarEmoji}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-16 left-0 z-10 bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/20 p-3 grid grid-cols-4 gap-1.5 min-w-[12rem]">
                      {EMOJI_OPTIONS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => { setAvatarEmoji(e); setShowEmojiPicker(false); }}
                          className="w-9 h-9 text-xl rounded-xl hover:bg-surface-container transition-colors flex items-center justify-center"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">表示名（ニックネーム）</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="未設定（匿名）"
                    maxLength={30}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSavingProfile ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </section>

          {/* AI Reprocess */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4">
            <div className="flex items-center gap-3 text-secondary mb-2">
              <RefreshCw className="w-6 h-6" />
              <h3 className="font-bold text-lg">AI 一括処理</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">既存クリップを一括AI処理</p>
                <p className="text-xs text-on-surface-variant mt-0.5">未処理クリップに要約・タグ・カテゴリを付与します</p>
                {reprocessProgress && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    {reprocessProgress.done} / {reprocessProgress.total} 処理中...
                  </p>
                )}
              </div>
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface text-sm font-medium rounded-xl transition-all hover:bg-surface-container-high disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                {isReprocessing ? '処理中' : '実行'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
              <div>
                <p className="text-sm font-medium text-on-surface">「その他」クリップを再分類</p>
                <p className="text-xs text-on-surface-variant mt-0.5">カテゴリ未分類・その他のクリップを適切なカテゴリに振り直します</p>
                {reclassifyProgress && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    {reclassifyProgress.done} / {reclassifyProgress.total} 処理中...
                  </p>
                )}
              </div>
              <button
                onClick={handleReclassify}
                disabled={isReclassifying}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface text-sm font-medium rounded-xl transition-all hover:bg-surface-container-high disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isReclassifying ? 'animate-spin' : ''}`} />
                {isReclassifying ? '処理中' : '実行'}
              </button>
            </div>
          </section>

          {/* Notification Preferences */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4">
            <div className="flex items-center gap-3 text-secondary mb-2">
              <Bell className="w-6 h-6" />
              <h3 className="font-bold text-lg">通知設定</h3>
            </div>
            <div className="space-y-3">
              {([
                { key: 'follow', label: 'フォロー通知', desc: '誰かがあなたをフォローしたとき' },
                { key: 'comment_reply', label: 'コメントリプライ通知', desc: 'あなたのコメントに返信されたとき' },
                { key: 'like', label: 'いいね通知', desc: 'クリップにいいねされたとき' },
                { key: 'announcement', label: 'お知らせ通知', desc: '開発者からのアップデート情報' },
              ] as { key: keyof typeof notifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-on-surface">{label}</p>
                    <p className="text-xs text-on-surface-variant">{desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifPrefs[key] ? 'bg-primary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-outline-variant/10">
              <button
                onClick={handleSaveNotif}
                disabled={isSavingNotif}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSavingNotif ? '保存中...' : '保存'}
              </button>
            </div>
          </section>

          {/* Language Preference */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4">
            <div className="flex items-center gap-3 text-secondary mb-2">
              <Globe className="w-6 h-6" />
              <h3 className="font-bold text-lg">翻訳言語設定</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              翻訳機能で使用するデフォルト言語を設定します。
            </p>
            <div className="pt-2">
              <label className="block text-sm font-medium text-on-surface mb-2">翻訳先言語</label>
              <select
                value={preferredLang}
                onChange={e => {
                  setPreferredLang(e.target.value);
                  localStorage.setItem('preferred_language', e.target.value);
                }}
                className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="日本語">日本語</option>
                <option value="English">English</option>
                <option value="中文">中文</option>
                <option value="한국어">한국어</option>
                <option value="Español">Español</option>
                <option value="Français">Français</option>
                <option value="Deutsch">Deutsch</option>
              </select>
            </div>
          </section>

          {/* Plan & Quota */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4">
            <div className="flex items-center gap-3 text-tertiary mb-2">
              <CreditCard className="w-6 h-6" />
              <h3 className="font-bold text-lg">プラン</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-on-surface">PREVIEW</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              現在はプレビュー利用です。正式リリース後のプランについては後日アナウンスされます。
            </p>
          </section>

          {/* PWA & Install */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 text-primary mb-2">
                <Smartphone className="w-6 h-6" />
                <h3 className="font-bold text-lg">アプリとしてインストール</h3>
              </div>
              <p className="text-sm text-on-surface-variant">ホーム画面に追加して素早くアクセスできます。</p>
            </div>
            <button
              onClick={handleInstall}
              disabled={!canInstall}
              className="px-6 py-2.5 bg-surface-container-low hover:bg-surface-container-high text-primary text-sm font-bold rounded-full transition-colors hidden md:block disabled:opacity-40 disabled:cursor-not-allowed"
            >
              インストール
            </button>
          </section>

          {/* Destructive / Sign Out */}
          <section className="pt-6 space-y-2">
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full p-4 rounded-2xl text-on-surface hover:bg-surface-container-highest transition-colors font-medium border border-outline-variant/20"
            >
              <LogOut className="w-5 h-5 text-on-surface-variant" />
              <span>ログアウト</span>
            </button>
            <button 
              onClick={handleDeleteAccount}
              className="flex items-center gap-3 w-full p-4 rounded-2xl text-error hover:bg-error/5 transition-colors font-medium"
            >
              <Trash2 className="w-5 h-5" />
              <span>アカウントと全てのデータを削除</span>
            </button>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
