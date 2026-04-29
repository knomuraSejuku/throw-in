'use client';

import { AppShell } from '@/components/shell/AppShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Link as LinkIcon, Upload, Edit3, Tag as TagIcon, Plus, Loader2, CheckCircle, Globe } from 'lucide-react';
import { useState, useRef, useEffect, Suspense } from 'react';
import { CelebrationEffect } from '@/components/effects/CelebrationEffect';
import clsx from 'clsx';
import { useClipStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    let result = reader.result as string;
    result = result.split(',')[1];
    resolve(result);
  };
  reader.onerror = error => reject(error);
});

const readApiError = async (response: Response): Promise<string> => {
  try {
    const data = await response.clone().json();
    if (data?.error) return String(data.error);
    if (data?.detail) return String(data.detail);
  } catch {
    // Fall back to text below.
  }

  try {
    const text = await response.text();
    if (text) return text.slice(0, 300);
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || `HTTP ${response.status}`;
};

function AddClipForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'url' | 'upload' | 'diary'>('url');
  
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  useEffect(() => {
    const sharedUrl = searchParams.get('url') || searchParams.get('text');
    const sharedTitle = searchParams.get('title');
    
    if (sharedUrl && sharedUrl.startsWith('http')) {
      setUrl(sharedUrl);
      setMode('url');
    } else if (sharedUrl) {
      setNote(sharedUrl);
      setMode('diary');
    }
    
    if (sharedTitle) {
      setTitle(sharedTitle);
    }
  }, [searchParams]);

  const [isGlobalSearch, setIsGlobalSearch] = useState(true);

  useEffect(() => { setIsGlobalSearch(mode === 'url'); }, [mode]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveOrigin, setSaveOrigin] = useState<{ x: number; y: number } | undefined>();
  const [errorMsg, setErrorMsg] = useState('');
  const [warnMsg, setWarnMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMsg('ファイルサイズは10MB以下にしてください。');
      return;
    }
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
    if (!validTypes.includes(selected.type)) {
      setErrorMsg('JPEG, PNG, WebP, PDF, MP4のいずれかの形式を選択してください。');
      return;
    }
    
    setFile(selected);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setWarnMsg('');
    const supabase = createClient();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // デモモードでのアクセスかどうかをチェック
        const isDemo = document.cookie.includes('demo_bypass=true');
        if (isDemo) {
          throw new Error("デモモード（未認証）のため、データの保存はできません。");
        }
        throw new Error("ログイン状態を確認できません");
      }

      // ── URL normalization (strip tracking params / hash) ────────────
      let finalUrl = url.trim();
      if (mode === 'url' && finalUrl) {
        try {
          const u = new URL(finalUrl);
          const host = u.hostname.replace(/^(www\.|m\.)/, '');
          if (host === 'youtube.com' || host === 'music.youtube.com') {
            if (u.pathname === '/watch') {
              const v = u.searchParams.get('v');
              finalUrl = v ? `https://${u.hostname}/watch?v=${v}` : u.origin + u.pathname;
            } else {
              finalUrl = u.origin + u.pathname;
            }
          } else if (host === 'youtu.be') {
            finalUrl = `https://youtu.be${u.pathname}`;
          } else {
            finalUrl = u.origin + u.pathname;
          }
          if (finalUrl !== url) setUrl(finalUrl);
        } catch { /* invalid URL — validation catches it later */ }
      }
      // ─────────────────────────────────────────────────────────────────

      // ── Duplicate detection ──────────────────────────────────────────
      const existingClips = useClipStore.getState().clips;
      let inheritedClip: (typeof existingClips)[0] | null = null;
      if (mode === 'url' && finalUrl) {
        inheritedClip = existingClips.find(c => c.url === finalUrl) ?? null;
      } else if (mode === 'upload' && file) {
        inheritedClip = existingClips.find(c => c.domain === file.name) ?? null;
      }

      let fileUrl = '';
      let sourceType = mode;
      let domain = null;
      let extractedData: any = null;

      // 1. File Upload Processing
      if (mode === 'upload') {
        if (!file) throw new Error("ファイルを選択してください");
        
        const fileExt = file.name.split('.').pop() || 'tmp';
        const filePath = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('clip-attachments')
          .upload(filePath, file);

        if (uploadError) {
           console.error("Storage Error:", uploadError);
           throw new Error(`アップロードに失敗しました。事前に 'clip-attachments' バケットが作成されているか確認してください。(${uploadError.message})`);
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('clip-attachments')
          .getPublicUrl(filePath);
          
        fileUrl = publicUrl;
        
        // determine actual content_type for db
        if (file.type.startsWith('image/')) sourceType = 'image' as any;
        else if (file.type === 'application/pdf') sourceType = 'document' as any;
        else if (file.type.startsWith('video/')) sourceType = 'video' as any;

        // Perform OCR/Extraction using OpenAI API or PDF parser
        try {
          if (file.type === 'application/pdf') {
            const formData = new FormData();
            formData.append('file', file);
            const pdfRes = await fetch('/api/pdf', {
              method: 'POST',
              body: formData
            });
            if (pdfRes.ok) {
              const pdfData = await pdfRes.json();
              extractedData = { body: pdfData.text };
            } else {
              setWarnMsg('PDFのテキスト抽出に失敗しました。クリップは保存されますが、AI処理の精度が下がる場合があります。');
            }
          } else if (file.type.startsWith('image/')) {
            const openAiKey = localStorage.getItem('openai_api_key');
            if (openAiKey) {
              const base64Data = await toBase64(file);
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openAiKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-4o', // Assuming GPT-4o for vision tasks, as GPT-5.4-nano is a placeholder
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: 'Extract the text from this document or image. Output ONLY the extracted text with no other commentary.' },
                        { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } }
                      ]
                    }
                  ]
                })
              });
              if (response.ok) {
                 const data = await response.json();
                 extractedData = { body: data.choices[0].message.content };
              } else {
                setWarnMsg('画像のOCR処理に失敗しました。クリップは保存されますが、テキスト抽出ができませんでした。');
              }
            } else {
              setWarnMsg('OpenAI APIキーが設定されていないため、画像のOCR処理をスキップしました。設定画面からAPIキーを登録できます。');
            }
          }
        } catch(e) {
          setWarnMsg('ファイルの読み取り中にエラーが発生しました。クリップは保存されますが、テキスト抽出ができませんでした。');
        }
      } else if (mode === 'url') {
        if (!finalUrl) throw new Error("URLを入力してください");
      }

      const isYouTubeUrl = mode === 'url' && (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be'));
      const contentType = mode === 'diary' ? 'note' : mode === 'url' ? (isYouTubeUrl ? 'video' : 'article') : (sourceType === 'upload' ? 'document' : sourceType);

      if (mode === 'url') {
        if (!finalUrl) throw new Error("URLを入力してください");
        try {
          domain = new URL(finalUrl).hostname;
          if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
             const ytRes = await fetch('/api/youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: finalUrl })
              });
             if(ytRes.ok) {
                 const ytData = await ytRes.json();
                 extractedData = ytData; // body will contain transcript

                 // Optionally get title and thumbnail from base extractor
                 try {
                   const extRes = await fetch('/api/extract', {
                     method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: finalUrl })
                   });
                   if(extRes.ok) {
                      const ogData = await extRes.json();
                      extractedData.title = ogData.title || extractedData.title;
                      extractedData.thumbnail = ogData.thumbnail;
                      extractedData.domain = ogData.domain;
                   }
                 } catch(e) {}
             } else {
                 const message = await readApiError(ytRes);
                 console.warn("YouTube transcript fetch failed", message);
                 setWarnMsg(`YouTube字幕の取得に失敗しました。タイトル取得だけで保存します。(${message})`);
             }
          } else {
            const extRes = await fetch('/api/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: finalUrl })
            });
            if (extRes.ok) {
              extractedData = await extRes.json();
            } else {
               const message = await readApiError(extRes);
               console.warn("Extraction failed", message);
               setWarnMsg(`URLの本文抽出に失敗しました。タイトル未取得のまま保存します。(${message})`);
            }
          }
        } catch(e) {
          console.warn("Extraction failed", e);
          const message = e instanceof Error ? e.message : '不明なエラー';
          setWarnMsg(`URLの本文抽出に失敗しました。タイトル未取得のまま保存します。(${message})`);
        }
      }

      const finalTitle = title || (
        (mode === 'url' && extractedData?.title) ? extractedData.title :
        mode === 'url' ? '無題の記事' :
        mode === 'diary' ? `日記 (${new Date().toLocaleDateString('ja-JP')})` :
        file?.name || '新しいファイル'
      );

      const finalDomain = (mode === 'url' && extractedData?.domain) ? extractedData.domain : domain;

      // ====== DB Insertion ======
      const { data: clipData, error: clipError } = await supabase.from('clips').insert({
        user_id: session.user.id,
        title: finalTitle,
        url: mode === 'url' ? finalUrl : fileUrl,
        content_type: contentType,
        my_note: note,
        is_read: false,
        source_domain: mode === 'url' ? finalDomain : (file ? file.name : null),
        preview_image_url: extractedData?.thumbnail || inheritedClip?.thumbnail || null,
        extracted_content: extractedData?.body || null,
        summary: inheritedClip?.summary || null,
        category: inheritedClip?.category || null,
        subcategory: inheritedClip?.subcategory || null,
        key_points: inheritedClip?.keyPoints || null,
        is_global_search: isGlobalSearch,
      }).select().single();

      if (clipError) throw new Error(`クリップ保存失敗: ${clipError.message}`);
      
      const clipId = clipData.id;

      // Insert tags — merge user tags with inherited tags from duplicate
      const allTags = [...new Set([...tags, ...(inheritedClip?.tags ?? [])])];
      if (allTags.length > 0) {
        const tagsToInsert = allTags.map(tag => ({
          user_id: session.user.id,
          clip_id: clipId,
          name: tag
        }));
        await supabase.from('clip_tags').insert(tagsToInsert);
      }

      await useClipStore.getState().fetchClips();

      // ====== Async AI Processing ======
      const contentForAi = extractedData?.body || note || "";
      if (!inheritedClip && contentForAi && contentForAi.trim().length > 10) {
         useClipStore.getState().processClipAI(clipId, contentForAi);
      } else {
         useClipStore.getState().updateProcessingJob(clipId, 'done');
      }

      setIsSaved(true);
      setTimeout(() => router.push('/'), 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "エラーが発生しました");
      setIsSaving(false); // Reset saving state on error
    }
  };

  return (
    <AppShell>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-on-surface/20 backdrop-blur-sm">
        <div className="bg-surface-container-lowest w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row relative max-h-full">
          
          <button 
            onClick={() => router.back()}
            disabled={isSaving}
            className="absolute top-4 md:top-6 right-4 md:right-6 p-2 rounded-full hover:bg-surface-container-low transition-colors z-20"
          >
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>

          {/* Left Rail */}
          <div className="w-full md:w-64 bg-surface-container-low p-6 md:p-8 flex flex-col gap-6 md:gap-8 flex-shrink-0">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-on-surface">新規追加</h2>
              <p className="text-sm text-on-surface-variant font-medium">クリップを作成</p>
            </div>
            
            <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
              <button 
                onClick={() => setMode('url')}
                disabled={isSaving}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 min-w-max transition-all font-semibold text-sm",
                  mode === 'url' ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high outline-none disabled:opacity-50"
                )}
              >
                <LinkIcon className="w-5 h-5" />
                <span>URL保存</span>
              </button>
              <button 
                onClick={() => setMode('upload')}
                disabled={isSaving}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 min-w-max transition-all font-semibold text-sm",
                  mode === 'upload' ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high outline-none disabled:opacity-50"
                )}
              >
                <Upload className="w-5 h-5" />
                <span>アップロード</span>
              </button>
              <button 
                onClick={() => setMode('diary')}
                disabled={isSaving}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 min-w-max transition-all font-semibold text-sm",
                  mode === 'diary' ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high outline-none disabled:opacity-50"
                )}
              >
                <Edit3 className="w-5 h-5" />
                <span>日記作成</span>
              </button>
            </div>

            <div className="mt-auto hidden md:block">
              <div className="p-4 bg-primary/5 rounded-2xl">
                <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Tips</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">URLを貼り付けるだけで、自動的にタイトルとアイキャッチを取得します。（※プレビュー版では一部機能制限あり）</p>
              </div>
            </div>
          </div>

          {/* Form Area */}
          <div className="flex-1 p-6 md:p-10 lg:p-12 space-y-8 overflow-y-auto">
            
            {isSaved && (
              <div className="bg-success/10 text-success px-4 py-3 rounded-xl text-sm font-bold border border-success/20 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                保存しました。AIが整理中です
              </div>
            )}

            {warnMsg && (
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-3 rounded-xl text-sm font-medium border border-amber-500/20">
                {warnMsg}
              </div>
            )}

            {errorMsg && (
              <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-bold border border-error/20">
                {errorMsg}
              </div>
            )}

            <div className="space-y-6">
              {mode === 'url' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">ソースURL <span className="text-error">*</span></label>
                  <input 
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isSaving}
                    className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                    placeholder="https://example.com/article"
                  />
                </div>
              )}

              {mode === 'upload' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">ファイル <span className="text-error">*</span></label>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                    disabled={isSaving}
                  />
                  <div 
                    onClick={() => !isSaving && fileInputRef.current?.click()}
                    className={clsx(
                      "w-full border-2 border-dashed rounded-2xl px-4 py-12 flex flex-col items-center justify-center gap-2 transition-colors text-center",
                      file ? "bg-surface-container border-primary/40" : "bg-surface-container-low border-outline-variant/30",
                      !isSaving && "cursor-pointer hover:bg-surface-container-high",
                      isSaving && "opacity-50"
                    )}
                  >
                    <Upload className={clsx("w-8 h-8 mb-2", file ? "text-primary" : "text-outline")} />
                    <p className="font-bold text-on-surface-variant">
                      {file ? file.name : 'クリックしてファイルを選択'}
                    </p>
                    <p className="text-xs text-outline">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '画像またはPDF (最大10MB)'}</p>
                  </div>
                </div>
              )}

              {mode === 'diary' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">日付</label>
                  <input 
                    type="date"
                    disabled={isSaving}
                    defaultValue={new Date().toLocaleDateString('en-CA')}
                    className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">カスタムタイトル (任意)</label>
                <input 
                  type="text"
                  value={title}
                  disabled={isSaving}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                  placeholder={mode === 'diary' ? "日記のタイトル" : "タイトルを入力"}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">{mode === 'diary' ? '本文' : 'パーソナルメモ'}</label>
                <textarea 
                  value={note}
                  disabled={isSaving}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none disabled:opacity-50"
                  placeholder={mode === 'diary' ? "今日あったことを書き留めましょう" : "なぜこれを保存しましたか？"}
                  rows={mode === 'diary' ? 6 : 4}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-full text-xs font-semibold">
                    <TagIcon className="w-3.5 h-3.5" /> {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                      className="ml-0.5 hover:text-error transition-colors"
                    >×</button>
                  </span>
                ))}
                <div className="inline-flex items-center gap-1 border border-outline-variant/30 rounded-full overflow-hidden">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = tagInput.trim().replace(/^#/, '');
                        if (t && !tags.includes(t)) setTags([...tags, t]);
                        setTagInput('');
                      }
                    }}
                    placeholder="タグを追加..."
                    disabled={isSaving}
                    className="bg-transparent pl-3 py-1.5 text-xs outline-none w-24 placeholder:text-outline disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      const t = tagInput.trim().replace(/^#/, '');
                      if (t && !tags.includes(t)) setTags([...tags, t]);
                      setTagInput('');
                    }}
                    className="pr-3 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsGlobalSearch(v => !v)}
                disabled={isSaving}
                className={clsx(
                  "inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
                  isGlobalSearch ? "bg-primary" : "bg-outline-variant/40"
                )}
              >
                <span className={clsx(
                  "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isGlobalSearch ? "translate-x-[1.375rem]" : "translate-x-0.5"
                )} />
              </button>
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                グローバル検索に公開
              </span>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button 
                onClick={() => router.back()}
                disabled={isSaving}
                className="px-6 py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSaveOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                  handleSave();
                }}
                disabled={isSaving}
                className="px-8 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm shadow-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-75 flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? '保存中...' : '保存する'}
              </button>
            </div>
            
          </div>
        </div>

      </div>
      {isSaved && <CelebrationEffect type="save" origin={saveOrigin} />}
    </AppShell>
  );
}

export default function AddClipPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </AppShell>
    }>
      <AddClipForm />
    </Suspense>
  );
}
