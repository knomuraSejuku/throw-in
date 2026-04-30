'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'motion/react'

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
      <div className="relative flex-1 hidden lg:flex flex-col justify-center items-center bg-surface-container-low overflow-hidden">
        <div className="relative z-10 w-full max-w-2xl px-12 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/brand/throwin-symbol-source.png"
              alt=""
              width={160}
              height={160}
              className="mb-8 h-36 w-36 rounded-[32px] border border-outline-variant/60 bg-surface-container-lowest object-cover xl:h-40 xl:w-40"
              priority
            />
            <h1 className="text-[3.05rem] xl:text-[3.65rem] leading-[1.16] tracking-normal font-light text-on-surface mb-6">
              投げ入れるように、<br />
              “気になる”を整理しよう。
            </h1>
            
            <p className="text-xl text-on-surface-variant font-normal leading-relaxed max-w-lg">
              気になる記事・画像・動画を、あとで探せる形に。<br />
              Throw Inは、毎日のクリップを静かに整理します。
            </p>
          </motion.div>

          <div className="mt-[3.5rem] xl:mt-[4.5rem] relative h-40">
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
              className="absolute left-4 top-2 xl:left-8 bg-surface-container-lowest border border-outline-variant/70 text-on-surface px-6 py-4 rounded-[18px] shadow-ambient flex items-center gap-3"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface" />
              <span className="text-sm font-medium">自動要約</span>
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
              className="absolute left-[25%] xl:left-[30%] top-20 bg-primary text-on-primary px-6 py-4 rounded-[18px] shadow-primary flex items-center gap-3 z-10"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-on-primary" />
              <span className="text-sm font-medium">スマートタグ付け</span>
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
              className="absolute right-[8%] xl:right-[15%] top-8 bg-surface-container-lowest border border-outline-variant/70 text-on-surface px-6 py-4 rounded-[18px] shadow-ambient flex items-center gap-3"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface" />
              <span className="text-sm font-medium">データ抽出</span>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {/* Logo & Intro */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left mb-12">
            <Image
              src="/icons/app-icon-192.png"
              alt=""
              width={64}
              height={64}
              className="mb-6 h-16 w-16 rounded-[18px] border border-outline-variant/60 bg-surface-container-lowest object-cover"
              priority
            />
            <h2 className="text-4xl font-logo font-light tracking-normal text-on-surface mb-2">Throw In</h2>
            <p className="text-on-surface-variant font-normal">投げ入れるように、気になるを整理しよう。</p>
          </div>

          {/* Login Form / Buttons */}
          <div className="space-y-6">
            <div className="space-y-4">
              {/* Email/Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl">
                  <button type="button" onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${mode === 'login' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                    ログイン
                  </button>
                  <button type="button" onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${mode === 'signup' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
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
                  className="w-full py-[18px] bg-primary text-on-primary font-medium rounded-[20px] hover:-translate-y-[1px] active:translate-y-0 transition-all disabled:opacity-50 shadow-primary">
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
                className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface px-6 py-[18px] rounded-[20px] font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-outline-variant/60 hover:shadow-ambient hover:-translate-y-[1px]"
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
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium rounded-[20px] transition-all border border-outline-variant/60 disabled:opacity-50"
              >
                <span>デモログイン(認証スキップ)</span>
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
