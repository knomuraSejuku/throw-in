import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { createClient } from '@/lib/supabase/client';

// AI完了通知用: persistしない一時セット
export const aiJustCompleted = new Set<string>();

export type ClipType = 'url' | 'pdf' | 'image' | 'video' | 'diary';

export const CATEGORY_TAXONOMY: Record<string, string[]> = {
  'Technology':  ['AI/ML', 'Web開発', 'セキュリティ', 'ハードウェア', 'モバイル', 'データサイエンス', 'クラウド'],
  'Business':    ['スタートアップ', 'マーケティング', '経営戦略', '金融・投資', 'キャリア'],
  'Design':      ['UI/UX', 'グラフィック', 'プロダクト', 'ブランディング'],
  'Science':     ['物理・数学', '生物・医学', '宇宙', '環境・気候'],
  'Culture':     ['映画・TV', '音楽', '文学', 'アート', 'ゲーム'],
  'Health':      ['フィットネス', '栄養', 'メンタルヘルス', '医療'],
  'Politics':    ['政治', '国際関係', '法律・制度', '社会問題'],
  'Education':   ['学習・研究', '哲学', '歴史'],
  'Other':       ['その他'],
};

export interface Clip {
  id: string;
  type: ClipType;
  typeLabel: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  url?: string | null;
  domain?: string | null;
  date: string;
  timestamp: number;
  isUnread: boolean;
  stage2: boolean;
  isArchived: boolean;
  isBookmarked: boolean;
  isGlobalSearch: boolean;
  thumbnail?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
  tags?: string[];
  collections?: string[];
  userNote?: string | null;
  category?: string | null;
  subcategory?: string | null;
  keyPoints?: string | null;
  saveCount?: number;
  ownerId?: string | null;
  isOwner?: boolean;
}

interface ClipStore {
  clips: Clip[];
  isLoading: boolean;
  error: string | null;
  processingJobs: Record<string, string>; // clipId -> 'extracting' | 'enriching' | 'failed' | 'done'
  fetchClips: () => Promise<void>;
  fetchClipDetail: (id: string) => Promise<Clip | null>;
  addClip: (clip: Omit<Clip, 'id' | 'timestamp'>) => void;
  updateClip: (id: string, updates: Partial<Clip>) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
  archiveClip: (id: string, archive?: boolean) => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;
  startProcessingJob: (id: string, initialStatus: string) => void;
  updateProcessingJob: (id: string, status: string) => void;
  processClipAI: (clipId: string, content: string) => Promise<void>;
  reprocessExistingClips: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  reclassifyOtherClips: (onProgress?: (done: number, total: number) => void) => Promise<void>;
  translateClip: (clipId: string, targetLang: string) => Promise<string | null>;
  semanticSearch: (query: string) => Promise<string[] | null>;
}

const typeMapping: Record<string, ClipType> = {
  'article': 'url',
  'video': 'video',
  'image': 'image',
  'document': 'pdf',
  'note': 'diary'
};

const labelMapping: Record<ClipType, string> = {
  'url': 'WEB',
  'video': 'VIDEO',
  'image': 'IMAGE',
  'pdf': 'DOCUMENT',
  'diary': 'NOTE'
};

// Custom IndexedDB storage for Zustand to support offline cache cleanly
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

const LIST_CLIP_SELECT = `
  id,
  user_id,
  title,
  summary,
  url,
  source_domain,
  created_at,
  is_read,
  is_archived,
  is_bookmarked,
  is_global_search,
  preview_image_url,
  content_type,
  my_note,
  category,
  subcategory,
  saved_from_clip_id,
  clip_tags(name),
  clip_collections(collection_id)
`;

const DETAIL_CLIP_SELECT = `
  ${LIST_CLIP_SELECT},
  extracted_content,
  key_points
`;

const SAVED_CLIP_SELECT = `
  user_id,
  my_note,
  is_bookmarked,
  is_read,
  is_archived,
  created_at,
  clips (
    ${LIST_CLIP_SELECT}
  )
`;

const SAVED_CLIP_DETAIL_SELECT = `
  user_id,
  my_note,
  is_bookmarked,
  is_read,
  is_archived,
  created_at,
  clips (
    ${DETAIL_CLIP_SELECT}
  )
`;

const mapClipRow = (d: any, saveCount = 0, save?: any): Clip => {
  const type = typeMapping[d.content_type] || 'url';
  const savedAt = save?.created_at ?? d.created_at;
  return {
    id: d.id,
    type: type,
    typeLabel: labelMapping[type],
    title: d.title,
    summary: d.summary,
    body: d.extracted_content,
    url: d.url,
    domain: d.source_domain,
    date: new Date(savedAt).toLocaleDateString('ja-JP'),
    timestamp: new Date(savedAt).getTime(),
    isUnread: save ? !save.is_read : !d.is_read,
    stage2: !!d.summary,
    isArchived: save ? (save.is_archived ?? false) : (d.is_archived ?? false),
    isBookmarked: save ? (save.is_bookmarked ?? false) : d.is_bookmarked,
    isGlobalSearch: d.is_global_search ?? false,
    thumbnail: d.preview_image_url,
    tags: d.clip_tags?.map((t: any) => t.name) || [],
    collections: d.clip_collections?.map((c: any) => c.collection_id) || [],
    userNote: save ? save.my_note : d.my_note,
    category: d.category ?? null,
    subcategory: d.subcategory ?? null,
    keyPoints: d.key_points ?? null,
    saveCount,
    ownerId: d.user_id ?? null,
    isOwner: save?.user_id ? d.user_id === save.user_id : undefined,
  };
};

export const useClipStore = create<ClipStore>()(
  persist(
    (set, getStore) => ({
      clips: [],
      isLoading: false,
      error: null,
      processingJobs: {},
      
      startProcessingJob: (id, initialStatus) => set(state => ({ processingJobs: { ...state.processingJobs, [id]: initialStatus } })),
      updateProcessingJob: (id, status) => {
        set(state => ({ processingJobs: { ...state.processingJobs, [id]: status } }));
        if (status === 'done' || status === 'failed') {
          setTimeout(() => set(state => {
            const next = { ...state.processingJobs };
            delete next[id];
            return { processingJobs: next };
          }), 5000);
        }
      },

  processClipAI: async (clipId: string, content: string) => {
    const targetClip = getStore().clips.find(c => c.id === clipId);
    const effectiveContent = content?.trim()
      ? content
      : targetClip?.body || targetClip?.userNote || targetClip?.summary || targetClip?.title || '';

    if (!effectiveContent.trim()) {
      console.warn('Skipping AI processing because clip content is empty', { clipId });
      getStore().updateProcessingJob(clipId, 'failed');
      return;
    }

    getStore().updateProcessingJob(clipId, 'enriching');

    try {
      const existingTags = Array.from(
        new Set(getStore().clips.flatMap(c => c.tags || []))
      ).slice(0, 200);

      const res = await fetch('/api/process-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId,
          content: effectiveContent,
          existingTags,
          clipTitle: targetClip?.title || '',
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`AI processing failed: ${res.status} ${detail.slice(0, 300)}`);
      }

      const { title, summary, tags, category, subcategory, keyPoints } = await res.json();

      getStore().updateProcessingJob(clipId, 'done');
      aiJustCompleted.add(clipId);

      await getStore().updateClip(clipId, { title: title || undefined, summary, tags, category, subcategory, keyPoints });
    } catch (err) {
      console.error('Job error', err);
      getStore().updateProcessingJob(clipId, 'failed');
    }
  },

  reprocessExistingClips: async (onProgress) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: rows, error } = await supabase
      .from('clip_saves')
      .select(`
        my_note,
        clips (
          id,
          title,
          extracted_content,
          my_note,
          summary
        )
      `)
      .eq('user_id', session.user.id);
    if (error) throw error;

    const unprocessed = (rows ?? []).flatMap((row: any) => {
      const clip = Array.isArray(row.clips) ? row.clips[0] : row.clips;
      if (!clip) return [];
      return [{ ...clip, saved_note: row.my_note }];
    }).filter(row => !row.summary && (row.extracted_content || row.saved_note || row.my_note || row.title));
    const total = unprocessed.length;
    let done = 0;

    for (const clip of unprocessed) {
      const content = clip.extracted_content || clip.saved_note || clip.my_note || clip.title;
      await getStore().processClipAI(clip.id, content);
      done++;
      onProgress?.(done, total);
      // Rate limit buffer
      await new Promise(r => setTimeout(r, 500));
    }
  },

  reclassifyOtherClips: async (onProgress) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: rows } = await supabase
      .from('clips')
      .select('id, title, body, summary')
      .eq('user_id', session.user.id)
      .or('category.eq.Other,category.eq.その他,category.is.null');
    const targets = (rows ?? []).filter(r => r.body || r.title);
    const total = targets.length;
    let done = 0;
    for (const row of targets) {
      const content = row.body || row.summary || row.title;
      await getStore().processClipAI(row.id, content);
      done++;
      onProgress?.(done, total);
      await new Promise(r => setTimeout(r, 500));
    }
  },

  translateClip: async (clipId: string, targetLang: string): Promise<string | null> => {
    let clip = getStore().clips.find(c => c.id === clipId);
    if (clip && clip.body === undefined) {
      clip = await getStore().fetchClipDetail(clipId) ?? clip;
    }
    if (!clip) return null;

    const text = clip.summary || clip.body?.substring(0, 3000) || clip.title;

    try {
      const res = await fetch('/api/process-ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.translated ?? null;
    } catch {
      return null;
    }
  },

  semanticSearch: async (query: string): Promise<string[] | null> => {
    if (!query.trim()) return null;

    try {
      const res = await fetch('/api/process-ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('セマンティック検索に失敗しました');
      const data = await res.json();
      return data.ids ?? [];
    } catch (err) {
      throw err;
    }
  },

  fetchClips: async () => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ clips: [], isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('clip_saves')
        .select(SAVED_CLIP_SELECT)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const parsedClips: Clip[] = data
          .map((save: any) => {
            const clipRow = Array.isArray(save.clips) ? save.clips[0] : save.clips;
            if (!clipRow) return null;
            return mapClipRow(clipRow, getStore().clips.find(c => c.id === clipRow.id)?.saveCount ?? 0, save);
          })
          .filter(Boolean) as Clip[];
        set({ clips: parsedClips, isLoading: false });

        const clipIds = parsedClips.map(clip => clip.id);
        if (clipIds.length > 0) {
          void (async () => {
            const { data: counts, error: countError } = await supabase
              .from('clip_saves')
              .select('clip_id')
              .in('clip_id', clipIds);

            if (countError || !counts) return;

            const saveCounts: Record<string, number> = {};
            counts.forEach((c: any) => {
              if (c.clip_id) saveCounts[c.clip_id] = (saveCounts[c.clip_id] ?? 0) + 1;
            });

            set(state => ({
              clips: state.clips.map(clip => (
                clipIds.includes(clip.id)
                  ? { ...clip, saveCount: saveCounts[clip.id] ?? 0 }
                  : clip
              )),
            }));
          })();
        }
      }
    } catch (error: any) {
      console.error('Error fetching clips:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  fetchClipDetail: async (id: string) => {
    const supabase = createClient();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('clip_saves')
        .select(SAVED_CLIP_DETAIL_SELECT)
        .eq('user_id', session.user.id)
        .eq('clip_id', id)
        .single();

      if (error) throw error;

      const current = getStore().clips.find(clip => clip.id === id);
      const clipRow = Array.isArray(data.clips) ? data.clips[0] : data.clips;
      if (!clipRow) return null;
      const parsed = mapClipRow(clipRow, current?.saveCount ?? 0, data);
      set(state => {
        const exists = state.clips.some(clip => clip.id === id);
        return {
          clips: exists
            ? state.clips.map(clip => clip.id === id ? { ...clip, ...parsed } : clip)
            : [parsed, ...state.clips],
        };
      });
      return parsed;
    } catch (error) {
      console.error('Error fetching clip detail:', error);
      return null;
    }
  },

  addClip: (clipInfo) => set((state) => ({
    clips: [{ 
      ...clipInfo, 
      id: `clip-${Date.now()}`,
      timestamp: Date.now()
    }, ...state.clips]
  })),

  updateClip: async (id, updates) => {
    // Optimistic UI
    const currentClips = getStore().clips;
    set((state) => ({
      clips: state.clips.map(clip => clip.id === id ? {
        ...clip,
        ...updates,
        ...(updates.summary !== undefined ? { stage2: !!updates.summary } : {}),
      } : clip)
    }));

    const supabase = createClient();
    
    // Map Partial<Clip> to Supabase columns
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.subcategory !== undefined) dbUpdates.subcategory = updates.subcategory;
    if (updates.keyPoints !== undefined) dbUpdates.key_points = updates.keyPoints;
    if (updates.isGlobalSearch !== undefined) dbUpdates.is_global_search = updates.isGlobalSearch;
    const saveUpdates: any = {};
    if (updates.userNote !== undefined) saveUpdates.my_note = updates.userNote;
    if (updates.isArchived !== undefined) saveUpdates.is_archived = updates.isArchived;

    const clipUpdate = Object.keys(dbUpdates).length > 0
      ? await supabase.from('clips').update(dbUpdates).eq('id', id)
      : { error: null };
    const saveUpdate = Object.keys(saveUpdates).length > 0
      ? await supabase.from('clip_saves').update(saveUpdates).eq('clip_id', id)
      : { error: null };
    if (clipUpdate.error || saveUpdate.error) {
       const error = clipUpdate.error ?? saveUpdate.error;
       console.error("Update error", error);
       set({ clips: currentClips }); // rollback
    }
  },

  deleteClip: async (id) => {
    const supabase = createClient();
    const { error } = await supabase.from('clip_saves').delete().eq('clip_id', id);
    if (error) {
      console.error("Delete error", error);
      throw error;
    }
    
    set((state) => ({
      clips: state.clips.filter(clip => clip.id !== id)
    }));
  },

  archiveClip: async (id, archive = true) => {
    const supabase = createClient();
    const { error } = await supabase.from('clip_saves').update({ is_archived: archive }).eq('clip_id', id);
    if (error) {
      console.error("Archive error", error);
      throw error;
    }
    set((state) => ({
      clips: state.clips.map(clip => clip.id === id ? { ...clip, isArchived: archive } : clip)
    }));
  },

  toggleRead: async (id) => {
    // Optimistic UI update
    const currentClips = getStore().clips;
    const clipToUpdate = currentClips.find(c => c.id === id);
    if (!clipToUpdate) return;
    
    // Toggle logically: is_read is opposite of isUnread
    const nextIsRead = clipToUpdate.isUnread;
    set((state) => ({
      clips: state.clips.map(clip => clip.id === id ? { ...clip, isUnread: !clip.isUnread } : clip)
    }));

    // Update DB
    const supabase = createClient();
    const { error } = await supabase
      .from('clip_saves')
      .update({ is_read: nextIsRead })
      .eq('clip_id', id);

    if (error) {
      console.error('Error updating read status:', error);
      // Revert if error
      set({ clips: currentClips });
    }
  },

  toggleBookmark: async (id) => {
    // Optimistic UI update
    const currentClips = getStore().clips;
    const clipToUpdate = currentClips.find(c => c.id === id);
    if (!clipToUpdate) return;

    const nextIsBookmarked = !clipToUpdate.isBookmarked;
    set((state) => ({
      clips: state.clips.map(clip => clip.id === id ? { ...clip, isBookmarked: nextIsBookmarked } : clip)
    }));

    // Update DB
    const supabase = createClient();
    const { error } = await supabase
      .from('clip_saves')
      .update({ is_bookmarked: nextIsBookmarked })
      .eq('clip_id', id);

    if (error) {
      console.error('Error updating bookmark status:', error);
      // Revert if error
      set({ clips: currentClips });
    }
  }
}),
    {
      name: 'throw-in-clip-storage', // key in indexedDB
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ clips: state.clips }) // Only persist clips to allow offline reading, ignore job status and isLoading
    }
  )
);

// --- Collection Store ---

export interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface CollectionStore {
  collections: Collection[];
  isLoading: boolean;
  fetchCollections: () => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<Collection | null>;
  addClipToCollection: (clipId: string, collectionId: string) => Promise<boolean>;
  removeClipFromCollection: (clipId: string, collectionId: string) => Promise<boolean>;
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      collections: [],
      isLoading: false,

      fetchCollections: async () => {
        set({ isLoading: true });
        const supabase = createClient();
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ collections: [], isLoading: false });
            return;
          }

          const { data, error } = await supabase
            .from('collections')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          set({ collections: data || [], isLoading: false });
        } catch (e) {
          console.error(e);
          set({ isLoading: false });
        }
      },

      createCollection: async (name, description) => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const { data, error } = await supabase
          .from('collections')
          .insert({ user_id: session.user.id, name, description })
          .select()
          .single();

        if (error) {
          console.error(error);
          return null;
        }

        set(state => ({ collections: [data, ...state.collections] }));
        return data as Collection;
      },

      addClipToCollection: async (clipId, collectionId) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('clip_collections')
          .insert({ clip_id: clipId, collection_id: collectionId });
          
        if (error) {
           console.error(error);
           return false;
        }
        // Note: To see the collection count instantly update locally on the clip, we should also update the clipStore,
        // but typically a refetch or simple local state mapping is sufficient for optimistic updates.
        return true;
      },

      removeClipFromCollection: async (clipId, collectionId) => {
        const supabase = createClient();
        const { error } = await supabase
          .from('clip_collections')
          .delete()
          .eq('clip_id', clipId)
          .eq('collection_id', collectionId);

        if (error) {
           console.error(error);
           return false;
        }
        return true;
      }
    }),
    {
      name: 'throw-in-collection-storage', // key in indexedDB
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ collections: state.collections })
    }
  )
);
