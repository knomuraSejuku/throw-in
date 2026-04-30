'use client';

import { AppShell } from '@/components/shell/AppShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Link as LinkIcon, Upload, Edit3, Tag as TagIcon, Plus, Loader2, CheckCircle, Globe, FileText } from 'lucide-react';
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
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.clone().json();
      if (data?.error) return String(data.error);
      if (data?.detail) return String(data.detail);
    }
  } catch {
    // Fall back to text below.
  }

  if (contentType.includes('text/html')) {
    return `サーバー内部エラーが発生しました。Vercel Function Logsを確認してください。HTTP ${response.status}`;
  }

  try {
    const text = await response.text();
    if (text) return text.slice(0, 300);
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || `HTTP ${response.status}`;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const CSV_IMPORT_DRAFT_KEY = 'throwin:csv-import-draft';

type CsvBatchResult = {
  url: string;
  normalizedUrl?: string;
  status: 'created' | 'skipped' | 'failed';
  clipId?: string;
  title?: string;
  body?: string | null;
  error?: string;
  reason?: 'duplicate' | 'invalid_url';
};

const csvResultLabel = (result: CsvBatchResult) => {
  if (result.status === 'created') return '保存済み';
  if (result.reason === 'duplicate') return '重複のためスキップ';
  if (result.reason === 'invalid_url') return 'URL形式エラー';
  if (result.status === 'skipped') return 'スキップ';
  return result.error || '保存失敗';
};

function AddClipForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'url' | 'upload' | 'diary' | 'csv'>('url');
  
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
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvUrls, setCsvUrls] = useState<string[]>([]);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number } | null>(null);
  const [csvAiProgress, setCsvAiProgress] = useState<{ done: number; total: number } | null>(null);
  const [csvResults, setCsvResults] = useState<CsvBatchResult[]>([]);

  useEffect(() => {
    const savedDraft = localStorage.getItem(CSV_IMPORT_DRAFT_KEY);
    if (!savedDraft) return;
    try {
      const parsed = JSON.parse(savedDraft) as { urls?: string[]; results?: CsvBatchResult[] };
      if (Array.isArray(parsed.urls) && parsed.urls.length > 0) {
        setCsvUrls(parsed.urls.slice(0, 200));
        setCsvResults(Array.isArray(parsed.results) ? parsed.results : []);
      }
    } catch {
      localStorage.removeItem(CSV_IMPORT_DRAFT_KEY);
    }
  }, []);

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const urls = Array.from(new Set(text.match(/https?:\/\/[^\s"',)]+/g) ?? [])).slice(0, 200);
      setCsvUrls(urls);
      setCsvResults([]);
      setCsvProgress(null);
      setCsvAiProgress(null);
      localStorage.setItem(CSV_IMPORT_DRAFT_KEY, JSON.stringify({ urls, results: [] }));
    };
    reader.readAsText(f);
  };

  const handleCsvBatch = async () => {
    if (csvUrls.length === 0) return;
    setIsSaving(true);
    setErrorMsg('');
    setCsvResults([]);
    setCsvProgress({ done: 0, total: csvUrls.length });
    setCsvAiProgress(null);
    localStorage.setItem(CSV_IMPORT_DRAFT_KEY, JSON.stringify({ urls: csvUrls, results: [] }));

    try {
      const allResults: CsvBatchResult[] = [];

      for (const chunk of chunkArray(csvUrls, 10)) {
        const res = await fetch('/api/batch-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: chunk }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `一括保存に失敗しました (${res.status})`);
        }

        const chunkResults = (data?.results ?? []) as CsvBatchResult[];
        allResults.push(...chunkResults);
        setCsvResults([...allResults]);
        localStorage.setItem(CSV_IMPORT_DRAFT_KEY, JSON.stringify({ urls: csvUrls, results: allResults }));
        setCsvProgress({ done: Math.min(allResults.length, csvUrls.length), total: csvUrls.length });
      }

      await useClipStore.getState().fetchClips();

      const aiTargets = allResults
        .filter(result => result.status === 'created' && result.clipId)
        .map(result => result.clipId!);

      if (aiTargets.length > 0) {
        let done = 0;
        const queue = [...aiTargets];
        const attempts = new Map<string, number>();
        setCsvAiProgress({ done, total: aiTargets.length });
        while (queue.length > 0) {
          const chunk = queue.splice(0, 5);
          const res = await fetch('/api/batch-process-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIds: chunk }),
          });
          if (!res.ok) {
            console.warn('Batch AI processing failed', await readApiError(res));
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
          setCsvAiProgress({ done: Math.min(done, aiTargets.length), total: aiTargets.length });
        }
      }

      await useClipStore.getState().fetchClips();
      localStorage.removeItem(CSV_IMPORT_DRAFT_KEY);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '一括保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

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
            const base64Data = await toBase64(file);
            const response = await fetch('/api/ocr-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  mimeType: file.type,
                  base64: base64Data,
                })
              });
              if (response.ok) {
                 const data = await response.json();
                 extractedData = { body: data.text };
              } else {
                setWarnMsg('画像のOCR処理に失敗しました。クリップは保存されますが、テキスト抽出ができませんでした。');
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-on-surface/20 px-3 py-4 backdrop-blur-sm [height:100dvh] [height:100svh] md:p-6">
        <div className="relative flex min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-surface-container-lowest shadow-2xl max-h-[calc(100svh-2rem)] md:max-h-[calc(100dvh-3rem)] md:flex-row md:rounded-[32px]">
          
          <button 
            onClick={() => router.back()}
            disabled={isSaving}
            className="absolute top-4 md:top-6 right-4 md:right-6 p-2 rounded-full hover:bg-surface-container-low transition-colors z-20"
          >
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>

          {/* Left Rail */}
          <div className="w-full md:w-64 bg-surface-container-low p-5 md:p-8 flex flex-col gap-4 md:gap-8 flex-shrink-0">
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
              <button
                onClick={() => setMode('csv')}
                disabled={isSaving}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 min-w-max transition-all font-semibold text-sm",
                  mode === 'csv' ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high outline-none disabled:opacity-50"
                )}
              >
                <FileText className="w-5 h-5" />
                <span>CSV一括</span>
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
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5 md:space-y-8 md:p-10 lg:p-12">
            
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

              {mode === 'csv' && (
                <div className="space-y-4">
                  <input type="file" accept=".csv,.txt" className="hidden" ref={csvFileInputRef} onChange={handleCsvFileChange} />
                  <div
                    onClick={() => !isSaving && csvFileInputRef.current?.click()}
                    className={clsx(
                      "w-full border-2 border-dashed rounded-2xl px-4 py-8 flex flex-col items-center justify-center gap-2 transition-colors text-center",
                      csvUrls.length > 0 ? "bg-surface-container border-primary/40" : "bg-surface-container-low border-outline-variant/30 hover:bg-surface-container",
                      !isSaving && "cursor-pointer",
                      isSaving && "opacity-50"
                    )}
                  >
                    <FileText className="w-8 h-8 text-outline" />
                    <p className="font-bold text-on-surface-variant text-sm">CSVファイルを選択</p>
                    <p className="text-xs text-outline">ファイル内のURLを抽出（最大200件）</p>
                  </div>
                  {csvUrls.length > 0 && (
                    <div className="rounded-2xl bg-surface-container-low p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-on-surface-variant">{csvUrls.length}件のURL</p>
                        {csvResults.some(result => result.status === 'failed') && (
                          <p className="text-[10px] text-outline">再実行で失敗分を再試行できます</p>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {(csvResults.length > 0 ? csvResults : csvUrls.map(url => ({ url, status: 'skipped' as const }))).map((result, i) => {
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {csvResults.length > 0 ? (
                                result.status === 'created'
                                  ? <CheckCircle className="w-3 h-3 text-success shrink-0" />
                                  : result.status === 'failed'
                                    ? <X className="w-3 h-3 text-error shrink-0" />
                                    : <div className="w-3 h-3 rounded-full bg-outline shrink-0" />
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-outline-variant/40 shrink-0" />
                              )}
                              <span className={clsx("truncate", csvResults.length > 0 && result.status === 'failed' && "text-error")}>{result.url}</span>
                              {csvResults.length > 0 && <span className="shrink-0 text-[10px] text-outline">{csvResultLabel(result)}</span>}
                            </div>
                          );
                        })}
                      </div>
                      {csvProgress && (
                        <div className="pt-2">
                          <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(csvProgress.done / csvProgress.total) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1">{csvProgress.done} / {csvProgress.total} 完了</p>
                        </div>
                      )}
                      {csvAiProgress && (
                        <div className="pt-2">
                          <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-secondary rounded-full transition-all"
                              style={{ width: `${(csvAiProgress.done / csvAiProgress.total) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1">AI整理 {csvAiProgress.done} / {csvAiProgress.total}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {mode !== 'csv' && (
                <>
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
                </>
              )}
            </div>

            {mode !== 'csv' && (
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
            )}

            <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-3 border-t border-outline-variant/10 bg-surface-container-lowest/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:pt-4 md:pb-0 md:backdrop-blur-0">
              <button
                onClick={() => router.back()}
                disabled={isSaving}
                className="px-6 py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              {mode === 'csv' ? (
                <button
                  onClick={handleCsvBatch}
                  disabled={isSaving || csvUrls.length === 0}
                  className="px-8 py-3 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm shadow-primary hover:scale-105 active:scale-95 transition-all disabled:opacity-75 flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? '保存中...' : `一括保存する（${csvUrls.length}件）`}
                </button>
              ) : (
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
              )}
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
        <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
      </AppShell>
    }>
      <AddClipForm />
    </Suspense>
  );
}
