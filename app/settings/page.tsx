'use client';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

import { AppShell } from '@/components/shell/AppShell';
import { User, CreditCard, HardDrive, Smartphone, LogOut, Trash2, RefreshCw, Globe, Bell, Twitter, CheckCircle, X as XIcon, Mail, KeyRound, Link as LinkIcon } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useClipStore } from '@/lib/store';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

type XImportDetail = {
  fileName: string;
  status: 'created' | 'skipped' | 'failed';
  clipId?: string;
  url?: string;
  body?: string;
  error?: string;
  reason?: 'duplicate' | 'missing_url' | 'unsupported_zip_entry';
};

const xImportReasonLabel: Record<string, string> = {
  duplicate: '重複',
  missing_url: 'URLなし',
  unsupported_zip_entry: 'ZIP未対応',
};

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
  const [isInstalled, setIsInstalled] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🙂');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const xImportRef = useRef<HTMLInputElement>(null);
  const [xImportFiles, setXImportFiles] = useState<File[]>([]);
  const [xImportProgress, setXImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [xImportAiProgress, setXImportAiProgress] = useState<{ done: number; total: number } | null>(null);
  const [xImportResults, setXImportResults] = useState<{ ok: number; skipped: number; fail: number } | null>(null);
  const [xImportDetails, setXImportDetails] = useState<XImportDetail[]>([]);
  const [isXImporting, setIsXImporting] = useState(false);

  const EMOJI_OPTIONS = ['🙂','😎','🤖','🦊','🐧','🐸','🦁','🐼','🌸','⚡','🎯','🚀','🎨','📚','🎵','🌍'];
  const hasGoogleIdentity = user?.identities?.some(identity => identity.provider === 'google') ?? false;

  useEffect(() => {
    const savedLang = localStorage.getItem('preferred_language');
    if (savedLang) setPreferredLang(savedLang);

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const syncPrompt = () => {
      if (window.__throwInInstallPrompt) {
        deferredPrompt.current = window.__throwInInstallPrompt;
        setCanInstall(true);
      }
    };
    const installPromptHandler = () => syncPrompt();
    const appInstalledHandler = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };
    syncPrompt();
    window.addEventListener('throwin:installprompt', installPromptHandler);
    window.addEventListener('throwin:appinstalled', appInstalledHandler);
    return () => {
      window.removeEventListener('throwin:installprompt', installPromptHandler);
      window.removeEventListener('throwin:appinstalled', appInstalledHandler);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const client = createClient();
    client.from('users').select('display_name, avatar_emoji, notification_prefs').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.avatar_emoji) setAvatarEmoji(data.avatar_emoji);
        if (data?.notification_prefs) setNotifPrefs(current => ({ ...current, ...data.notification_prefs }));
      });
  }, [user]);

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

  const handleChangeEmail = async () => {
    if (!user || isChangingEmail) return;
    const email = newEmail.trim();
    setAuthMessage(null);
    setAuthError(null);
    if (!email || email === user.email) {
      setAuthError('新しいメールアドレスを入力してください。');
      return;
    }
    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` }
      );
      if (error) throw error;
      setNewEmail('');
      setAuthMessage('確認メールを送信しました。メール内のリンクを開くと変更が完了します。');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'メールアドレスの変更に失敗しました。');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    setAuthMessage(null);
    setAuthError(null);
    if (newPassword.length < 6) {
      setAuthError('パスワードは6文字以上で入力してください。');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAuthError('確認用パスワードが一致しません。');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setNewPasswordConfirm('');
      setAuthMessage('パスワードを変更しました。');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'パスワードの変更に失敗しました。');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (hasGoogleIdentity || isLinkingGoogle) return;
    setAuthMessage(null);
    setAuthError(null);
    setIsLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setIsLinkingGoogle(false);
      setAuthError(error instanceof Error ? error.message : 'Googleログインの連携に失敗しました。');
    }
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
    if (!deferredPrompt.current) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator as Navigator & { platform?: string }).platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        alert('iOS Safariでは共有ボタンから「ホーム画面に追加」を選んでください。追加後はホーム画面のアイコンから起動できます。');
      } else {
        alert('ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。Chromeで条件を満たすと、このボタンから直接インストールできます。');
      }
      return;
    }
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
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

  const handleXImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => /\.(md|zip)$/i.test(f.name));
    setXImportFiles(files);
    setXImportResults(null);
    setXImportDetails([]);
    setXImportProgress(null);
    setXImportAiProgress(null);
  };

  const handleXImport = async () => {
    if (xImportFiles.length === 0 || !user) return;
    setIsXImporting(true);
    setXImportProgress({ done: 0, total: xImportFiles.length });
    setXImportAiProgress(null);
    setXImportDetails([]);

    try {
      const allResults: XImportDetail[] = [];

      let uploaded = 0;
      const fileChunks = xImportFiles.some(file => file.name.toLowerCase().endsWith('.zip'))
        ? xImportFiles.map(file => [file])
        : chunkArray(xImportFiles, 50);

      for (const files of fileChunks) {
        const form = new FormData();
        files.forEach(file => form.append('files', file));

        const res = await fetch('/api/import-x-bookmarks', {
          method: 'POST',
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `インポートに失敗しました (${res.status})`);
        allResults.push(...((data?.results ?? []) as XImportDetail[]));
        setXImportDetails([...allResults]);
        uploaded += files.length;
        setXImportProgress({ done: Math.min(uploaded, xImportFiles.length), total: xImportFiles.length });
        setXImportResults({
          ok: allResults.filter(result => result.status === 'created').length,
          skipped: allResults.filter(result => result.status === 'skipped').length,
          fail: allResults.filter(result => result.status === 'failed').length,
        });
      }

      await useClipStore.getState().fetchClips();
      setXImportResults({
        ok: allResults.filter(result => result.status === 'created').length,
        skipped: allResults.filter(result => result.status === 'skipped').length,
        fail: allResults.filter(result => result.status === 'failed').length,
      });

      let done = 0;
      const aiTargets = allResults
        .filter(result => result.status === 'created' && result.clipId)
        .map(result => result.clipId!);
      if (aiTargets.length > 0) {
        const queue = [...aiTargets];
        const attempts = new Map<string, number>();
        setXImportAiProgress({ done, total: aiTargets.length });
        while (queue.length > 0) {
          const chunk = queue.splice(0, 5);
          const res = await fetch('/api/batch-process-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIds: chunk }),
          });
          if (!res.ok) {
            console.warn('X import AI batch failed', await res.text().catch(() => ''));
            done += chunk.length;
          } else {
            const data = await res.json().catch(() => null);
            const deferredIds = ((data?.results ?? []) as Array<{ clipId: string; status: string }>)
              .filter(result => result.status === 'deferred')
              .map(result => result.clipId);
            const deferred = new Set(deferredIds);
            done += chunk.filter(clipId => !deferred.has(clipId)).length;
            for (const clipId of deferredIds) {
              const count = (attempts.get(clipId) ?? 0) + 1;
              attempts.set(clipId, count);
              if (count <= 2) queue.push(clipId);
              else done += 1;
            }
          }
          setXImportAiProgress({ done: Math.min(done, aiTargets.length), total: aiTargets.length });
        }
      }
      await useClipStore.getState().fetchClips();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'インポートに失敗しました。');
    } finally {
      setIsXImporting(false);
      setXImportProgress(null);
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
                  <Image src={user.user_metadata.avatar_url} alt="Avatar" width={80} height={80} unoptimized className="w-full h-full object-cover" />
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

          {/* Login Credentials */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-6">
            <div className="flex items-center gap-3 text-secondary">
              <KeyRound className="w-6 h-6" />
              <h3 className="font-bold text-lg">ログイン情報</h3>
            </div>

            {(authMessage || authError) && (
              <div
                className={clsx(
                  'rounded-2xl border px-4 py-3 text-sm',
                  authError
                    ? 'border-error/20 bg-error/5 text-error'
                    : 'border-success/20 bg-success/5 text-success'
                )}
              >
                {authError || authMessage}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <Mail className="h-4 w-4 text-on-surface-variant" />
                  メールアドレス変更
                </div>
                <p className="text-xs text-on-surface-variant">
                  現在: {user?.email ?? '未設定'}。新しいメールアドレス宛の確認リンクを開くと変更が完了します。
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="新しいメールアドレス"
                    className="min-w-0 flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    disabled={isChangingEmail}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isChangingEmail ? '送信中...' : '確認メールを送信'}
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-outline-variant/10 pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  <KeyRound className="h-4 w-4 text-on-surface-variant" />
                  パスワード変更
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="新しいパスワード"
                    minLength={6}
                    className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  />
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)}
                    placeholder="新しいパスワード（確認）"
                    minLength={6}
                    className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isChangingPassword ? '変更中...' : 'パスワードを変更'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-outline-variant/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <LinkIcon className="h-4 w-4 text-on-surface-variant" />
                    Googleログイン
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {hasGoogleIdentity
                      ? 'Googleアカウント連携済みです。次回からGoogleでログインできます。'
                      : 'メールアドレスで登録したアカウントにGoogleログインを追加します。'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={hasGoogleIdentity || isLinkingGoogle}
                  className={clsx(
                    'px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors border disabled:cursor-not-allowed',
                    hasGoogleIdentity
                      ? 'bg-surface-container text-on-surface-variant border-outline-variant/30 opacity-60'
                      : 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:bg-surface-container-low'
                  )}
                >
                  {hasGoogleIdentity ? '連携済み' : isLinkingGoogle ? 'Googleへ移動中...' : 'Googleを連携'}
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
              disabled={isInstalled}
              className={clsx(
                "px-6 py-2.5 text-sm font-bold rounded-full transition-colors disabled:cursor-not-allowed",
                isInstalled
                  ? "bg-surface-container text-on-surface-variant opacity-50"
                  : canInstall
                    ? "bg-primary text-on-primary hover:bg-primary-container"
                    : "bg-surface-container-low text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container-high"
              )}
            >
              {isInstalled ? 'インストール済み' : canInstall ? 'インストール' : '手順を見る'}
            </button>
          </section>

          {/* X Bookmark Import */}
          <section className="bg-surface-container-lowest rounded-[32px] p-6 md:p-8 shadow-ambient space-y-4">
            <div className="flex items-center gap-3 text-[#1DA1F2] mb-2">
              <Twitter className="w-6 h-6" />
              <h3 className="font-bold text-lg">Xブックマーク一括取り込み</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Xのブックマークエクスポート（MarkdownまたはZIP）を選択してインポートします。本文は原文として保存し、インポート後にAI整理を実行します。
            </p>
            <input
              ref={xImportRef}
              type="file"
              multiple
              accept=".md,.zip"
              className="hidden"
              onChange={handleXImportFileChange}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => xImportRef.current?.click()}
                disabled={isXImporting}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface text-sm font-bold rounded-full transition-colors disabled:opacity-50"
              >
                {xImportFiles.length > 0 ? `${xImportFiles.length}件選択中` : 'ファイルを選択'}
              </button>
              {xImportFiles.length > 0 && (
                <button
                  onClick={handleXImport}
                  disabled={isXImporting}
                  className="px-5 py-2.5 bg-[#1DA1F2] hover:bg-[#1a91da] text-white text-sm font-bold rounded-full transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isXImporting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isXImporting ? 'インポート中...' : `${xImportFiles.length}件をインポート`}
                </button>
              )}
            </div>
            {xImportProgress && (
              <div className="space-y-1">
                <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DA1F2] rounded-full transition-all"
                    style={{ width: `${(xImportProgress.done / xImportProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-on-surface-variant">{xImportProgress.done} / {xImportProgress.total}</p>
              </div>
            )}
            {xImportAiProgress && (
              <div className="space-y-1">
                <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all"
                    style={{ width: `${(xImportAiProgress.done / xImportAiProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-on-surface-variant">AI整理 {xImportAiProgress.done} / {xImportAiProgress.total}</p>
              </div>
            )}
            {xImportResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-on-surface font-bold">{xImportResults.ok}件保存</span>
                  {xImportResults.skipped > 0 && <span className="text-outline">{xImportResults.skipped}件スキップ</span>}
                  {xImportResults.fail > 0 && <span className="text-error">{xImportResults.fail}件失敗</span>}
                </div>
                {xImportDetails.some(result => result.status !== 'created') && (
                  <div className="max-h-44 overflow-y-auto rounded-2xl bg-surface-container-low p-3 space-y-1">
                    {xImportDetails.filter(result => result.status !== 'created').map((result, index) => (
                      <div key={`${result.fileName}-${index}`} className="flex items-start gap-2 text-xs">
                        {result.status === 'failed'
                          ? <XIcon className="mt-0.5 w-3.5 h-3.5 text-error shrink-0" />
                          : <div className="mt-1.5 w-2 h-2 rounded-full bg-outline shrink-0" />}
                        <div className="min-w-0">
                          <p className={clsx('truncate font-medium', result.status === 'failed' ? 'text-error' : 'text-on-surface-variant')}>
                            {result.fileName}
                          </p>
                          <p className="text-outline truncate">
                            {result.error || (result.reason ? xImportReasonLabel[result.reason] : 'スキップ')}
                            {result.url ? ` / ${result.url}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
