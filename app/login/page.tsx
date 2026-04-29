'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Layers, Combine } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

const ChimpHoopIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* バスケットボール */}
    <circle cx="12" cy="16.5" r="5.5" />
    <path d="M6.5 16.5 h11" />
    <path d="M12 11 v11" />
    <path d="M9 12 a4 4 0 0 0 0 9" />
    <path d="M15 12 a4 4 0 0 1 0 9" />

    {/* サルの耳 */}
    <path d="M5.5 8 a2.5 2.5 0 0 0 -1 4.5" />
    <path d="M18.5 8 a2.5 2.5 0 0 1 1 4.5" />

    {/* サルの輪郭 */}
    <path d="M5.5 11.5 C 5.5 4 8 2 12 2 C 16 2 18.5 4 18.5 11.5" />
    
    {/* 顔のパーツ (デフォルメ) */}
    <circle cx="9" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M10 9 c 1 1 3 1 4 0" />

    {/* 手(ボールを掴む) */}
    <path d="M6 12.5 C 3 13 4 15.5 5.5 15.5" />
    <path d="M18 12.5 C 21 13 20 15.5 18.5 15.5" />
  </svg>
)

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google') => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'ログイン中にエラーが発生しました')
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('確認メールを送信しました。メールを確認してください。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/'
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row overflow-hidden relative">
      {/* 
        =============================================================================
        LEFT PANE: Atmospheric / SaaS Split Layout Visuals
        =============================================================================
      */}
      <div className="relative flex-1 hidden lg:flex flex-col justify-center items-center bg-surface-container-low overflow-hidden">
        {/* レイヤー化された環境グラデーション (Atmospheric) */}
        <div className="absolute top-[10%] left-[20%] w-[35rem] h-[35rem] bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply" />
        <div className="absolute bottom-[10%] right-[10%] w-[40rem] h-[40rem] bg-tertiary/10 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
        
        <div className="relative z-10 w-full max-w-2xl px-12 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* ブランド用特大見出し (Massive Headline) */}
            <h1 className="text-[4rem] xl:text-[6rem] leading-[1.1] tracking-tight font-bold text-on-surface mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-tertiary">
                投げ入れて
              </span>
            </h1>
            
            <p className="text-xl text-on-surface-variant font-medium leading-relaxed max-w-lg">
              情報のノイズから離れ、本質を探求する。<br />
              あなたの思考を加速させるデジタルキュレーター。
            </p>
          </motion.div>

          {/* フローティングバブル (Floating Feature Bubbles) - SaaS Landing Style */}
          <div className="mt-[4rem] xl:mt-[6rem] relative h-40">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 0, rotate: -3 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: [0, -10, 0],
                rotate: [-3, -5, -2, -3]
              }}
              transition={{ 
                opacity: { duration: 0.8 },
                scale: { duration: 0.8, type: 'spring' },
                y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' }
              }}
              className="absolute left-4 top-2 xl:left-8 bg-surface/60 backdrop-blur-xl border border-outline/10 text-on-surface px-6 py-4 rounded-full shadow-ambient flex items-center gap-3"
            >
              <Zap className="w-5 h-5 text-tertiary" />
              <span className="text-sm font-bold tracking-wide">自動要約</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 0, rotate: 2 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: [0, 12, 0], 
                rotate: [2, -1, 4, 2] 
              }}
              transition={{ 
                opacity: { delay: 0.2, duration: 0.8 },
                scale: { delay: 0.2, duration: 0.8, type: 'spring' },
                y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 },
                rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }
              }}
              className="absolute left-[25%] xl:left-[30%] top-20 bg-primary text-on-primary px-6 py-4 rounded-full shadow-primary flex items-center gap-3 z-10"
            >
              <Layers className="w-5 h-5 opacity-90" />
              <span className="text-sm font-bold tracking-wide">スマートタグ付け</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 0, rotate: 6 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: [0, -15, 0],
                rotate: [6, 9, 3, 6] 
              }}
              transition={{ 
                opacity: { delay: 0.4, duration: 0.8 },
                scale: { delay: 0.4, duration: 0.8, type: 'spring' },
                y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
                rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }
              }}
              className="absolute right-[8%] xl:right-[15%] top-8 bg-surface-container-highest/80 backdrop-blur-xl border border-outline/10 text-on-surface px-6 py-4 rounded-full shadow-ambient flex items-center gap-3"
            >
              <Combine className="w-5 h-5 text-secondary" />
              <span className="text-sm font-bold tracking-wide">データ抽出</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* 
        =============================================================================
        RIGHT PANE: Minimal & Clean Authentication
        =============================================================================
      */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-12 relative z-10">
        
        {/* モバイル表示用の装飾背景 */}
        <div className="absolute top-[-10%] right-[-10%] w-[25rem] h-[25rem] bg-primary/10 rounded-full blur-[60px] pointer-events-none lg:hidden" />

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {/* Logo & Intro */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left mb-12">
            <div className="w-14 h-14 bg-gradient-to-tr from-primary to-secondary rounded-[16px] flex items-center justify-center shadow-lg mb-6">
              <ChimpHoopIcon className="w-7 h-7 text-on-primary" />
            </div>
            <h2 className="text-4xl font-logo tracking-normal text-on-surface mb-2 mt-2">Throw In</h2>
            <p className="text-on-surface-variant font-medium">おかえりなさい。</p>
          </div>

          {/* Login Form / Buttons */}
          <div className="space-y-6">
            <div className="space-y-4">
              {/* Email/Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl">
                  <button type="button" onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${mode === 'login' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                    ログイン
                  </button>
                  <button type="button" onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${mode === 'signup' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                    新規登録
                  </button>
                </div>
                <input
                  type="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-5 py-4 bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/50 transition-colors text-sm"
                />
                <input
                  type="password"
                  placeholder="パスワード（6文字以上）"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-5 py-4 bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/50 transition-colors text-sm"
                />
                <button type="submit" disabled={loading}
                  className="w-full py-[18px] bg-primary text-on-primary font-bold rounded-[24px] hover:-translate-y-[1px] active:translate-y-0 transition-all disabled:opacity-50 shadow-lg shadow-primary/20">
                  {loading ? <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin mx-auto" /> : (mode === 'signup' ? 'アカウントを作成' : 'ログイン')}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline-variant/30" />
                <span className="text-xs text-on-surface-variant/50 font-medium">または</span>
                <div className="flex-1 h-px bg-outline-variant/30" />
              </div>

              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface px-6 py-[18px] rounded-[24px] font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-outline-variant/30 hover:shadow-ambient hover:-translate-y-[1px]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Google で続ける</span>
              </button>

              <button
                onClick={() => {
                  document.cookie = "demo_bypass=true; path=/; max-age=86400; SameSite=None; Secure";
                  window.location.href = "/";
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold rounded-[24px] transition-all border border-outline-variant/30 disabled:opacity-50"
              >
                <span>開発者用デモログイン (未認証スキップ)</span>
              </button>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-[20px] text-primary text-sm font-medium">
                    {message}
                  </div>
                </motion.div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-error-container/50 border border-error/20 rounded-[20px] text-on-error-container text-sm font-medium">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8 text-center lg:text-left">
              <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                ログインすることで、Throw Inの利用規約および
                <a href="/privacy" className="underline hover:text-on-surface-variant transition-colors">プライバシーポリシー</a>
                に同意したものとみなされます。
              </p>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
