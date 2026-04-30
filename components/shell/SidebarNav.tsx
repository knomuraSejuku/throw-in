'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Library, Bookmark, History, Settings, FileText, Video, Image as ImageIcon, File, PenLine, Hash, Folder, Plus, ChevronDown, ChevronRight, LayoutGrid, Users, ScrollText, BarChart2, Bell, Search } from 'lucide-react';
import clsx from 'clsx';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { useCollectionStore, useClipStore, CATEGORY_TAXONOMY } from '@/lib/store';

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('filter');
  const currentType = searchParams.get('type');
  const currentTag = searchParams.get('tag');
  const currentCollection = searchParams.get('collection');
  const currentCategory = searchParams.get('category');
  const currentSubcategory = searchParams.get('subcategory');

  const { collections, fetchCollections, createCollection } = useCollectionStore();
  const { clips } = useClipStore();
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    await createCollection(newCollectionName.trim());
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

  const mainNav = [
    { label: 'すべてのクリップ', href: '/', icon: Library, isActive: pathname === '/' && !currentFilter && !currentType && !currentTag && !currentCollection && !currentCategory && !currentSubcategory },
    { label: 'ブックマーク', href: '/?filter=bookmarked', icon: Bookmark, isActive: currentFilter === 'bookmarked' },
    { label: '履歴', href: '/history', icon: History, isActive: pathname === '/history' },
    { label: 'フォロー中', href: '/following', icon: Users, isActive: pathname === '/following' },
    { label: 'グローバル検索', href: '/search', icon: Search, isActive: pathname === '/search' },
  ];

  const footerNav = [
    { label: '通知', href: '/notifications', icon: Bell },
    { label: 'インサイト', href: '/insights', icon: BarChart2 },
    { label: '更新情報', href: '/changelog', icon: ScrollText },
    { label: '設定', href: '/settings', icon: Settings },
  ];

  const typeNav = [
    { label: '記事', href: '/?type=url', icon: FileText, isActive: currentType === 'url', typeKey: 'url' },
    { label: '動画', href: '/?type=video', icon: Video, isActive: currentType === 'video', typeKey: 'video' },
    { label: '画像', href: '/?type=image', icon: ImageIcon, isActive: currentType === 'image', typeKey: 'image' },
    { label: 'ドキュメント', href: '/?type=pdf', icon: File, isActive: currentType === 'pdf', typeKey: 'pdf' },
    { label: '日記・メモ', href: '/?type=diary', icon: PenLine, isActive: currentType === 'diary', typeKey: 'diary' },
  ];

  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {};
    clips.forEach(c => c.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [clips]);

  const clipCounts = useMemo(() => {
    const byType: Record<string, { unread: number; total: number }> = {};
    const byCollection: Record<string, { unread: number; total: number }> = {};
    const byTag: Record<string, { unread: number; total: number }> = {};
    const byCategory: Record<string, { unread: number; total: number }> = {};
    const bySubcategory: Record<string, { unread: number; total: number }> = {};

    for (const c of clips) {
      // type
      if (!byType[c.type]) byType[c.type] = { unread: 0, total: 0 };
      byType[c.type].total++;
      if (c.isUnread) byType[c.type].unread++;

      // collection
      c.collections?.forEach(colId => {
        if (!byCollection[colId]) byCollection[colId] = { unread: 0, total: 0 };
        byCollection[colId].total++;
        if (c.isUnread) byCollection[colId].unread++;
      });

      // tag
      c.tags?.forEach(tag => {
        if (!byTag[tag]) byTag[tag] = { unread: 0, total: 0 };
        byTag[tag].total++;
        if (c.isUnread) byTag[tag].unread++;
      });

      // category / subcategory
      if (c.category) {
        if (!byCategory[c.category]) byCategory[c.category] = { unread: 0, total: 0 };
        byCategory[c.category].total++;
        if (c.isUnread) byCategory[c.category].unread++;

        if (c.subcategory) {
          const key = `${c.category}::${c.subcategory}`;
          if (!bySubcategory[key]) bySubcategory[key] = { unread: 0, total: 0 };
          bySubcategory[key].total++;
          if (c.isUnread) bySubcategory[key].unread++;
        }
      }
    }
    return { byType, byCollection, byTag, byCategory, bySubcategory };
  }, [clips]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden bg-surface-container-lowest border-r border-outline-variant/10">

      {/* Fixed header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-outline-variant/10 bg-surface-container-lowest/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/icons/app-icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl border border-outline-variant/50 bg-surface-container-lowest object-cover"
          />
          <div>
            <h1 className="text-2xl font-logo font-light text-on-surface leading-tight">Throw In</h1>
            <p className="text-[10px] text-outline">Your clips. Organized by AI.</p>
          </div>
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-80 space-y-2">
        {/* Main Views */}
        <div className="space-y-1 pb-4">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all font-medium text-sm",
                item.isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface hover:bg-surface-container"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Collections */}
        <div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCollectionsOpen(v => !v)}
              className="flex min-w-0 flex-1 items-center justify-between px-4 py-2 rounded-xl hover:bg-surface-container transition-colors"
            >
              <h3 className="text-[11px] font-bold text-outline uppercase tracking-widest">コレクション</h3>
              {isCollectionsOpen ? <ChevronDown className="w-4 h-4 text-outline" /> : <ChevronRight className="w-4 h-4 text-outline" />}
            </button>
            <button
              type="button"
              onClick={() => { setIsCreatingCollection(true); setIsCollectionsOpen(true); }}
              className="shrink-0 p-2 text-outline-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container"
              title="コレクションを追加"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {isCollectionsOpen && (
            <div className="space-y-1 mt-1">
              {isCreatingCollection && (
                <form onSubmit={handleCreateCollection} className="px-4 py-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="コレクション名..."
                    value={newCollectionName}
                    onChange={e => setNewCollectionName(e.target.value)}
                    onBlur={() => { if (!newCollectionName.trim()) setIsCreatingCollection(false); }}
                    className="w-full bg-surface-container text-sm px-3 py-1.5 rounded-lg border border-primary/30 focus:outline-none focus:border-primary text-on-surface"
                  />
                </form>
              )}
              {collections.map((collection) => {
                const isActive = currentCollection === collection.id;
                return (
                  <Link
                    key={collection.id}
                    href={`/?collection=${collection.id}`}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium text-sm",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container"
                        : "text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    <Folder className={clsx("w-4 h-4 flex-shrink-0", isActive ? "text-secondary" : "opacity-80")} />
                    <span className="truncate">{collection.name}</span>
                    {clipCounts.byCollection[collection.id] && (
                      <span className="ml-auto text-[10px] text-outline/50 tabular-nums flex-shrink-0">
                        {clipCounts.byCollection[collection.id].unread}/{clipCounts.byCollection[collection.id].total}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <button
            onClick={() => setIsCategoryOpen(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <h3 className="text-[11px] font-bold text-outline uppercase tracking-widest">カテゴリ</h3>
            {isCategoryOpen ? <ChevronDown className="w-4 h-4 text-outline" /> : <ChevronRight className="w-4 h-4 text-outline" />}
          </button>

          {isCategoryOpen && (
            <div className="space-y-0.5 mt-1">
              {Object.entries(CATEGORY_TAXONOMY).map(([cat, subs]) => {
                const isCatActive = currentCategory === cat && !currentSubcategory;
                const isExpanded = expandedCategories.has(cat) || currentCategory === cat;
                return (
                  <div key={cat}>
                    <div className="flex items-center">
                      <Link
                        href={`/?category=${encodeURIComponent(cat)}`}
                        className={clsx(
                          "flex-1 flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl transition-all font-medium text-sm",
                          isCatActive
                            ? "bg-secondary-container text-on-secondary-container"
                            : "text-on-surface-variant hover:bg-surface-container"
                        )}
                      >
                        <LayoutGrid className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span>{cat}</span>
                        {clipCounts.byCategory[cat] && (
                          <span className="ml-auto text-[10px] text-outline/50 tabular-nums">
                            {clipCounts.byCategory[cat].unread}/{clipCounts.byCategory[cat].total}
                          </span>
                        )}
                      </Link>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="p-2 mr-1 text-outline-variant hover:text-on-surface transition-colors rounded-lg"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5 mt-0.5">
                        {subs.map(sub => {
                          const isSubActive = currentCategory === cat && currentSubcategory === sub;
                          return (
                            <Link
                              key={sub}
                              href={`/?category=${encodeURIComponent(cat)}&subcategory=${encodeURIComponent(sub)}`}
                              className={clsx(
                                "flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-lg transition-all text-xs font-medium",
                                isSubActive
                                  ? "bg-secondary-container text-on-secondary-container"
                                  : "text-on-surface-variant hover:bg-surface-container"
                              )}
                            >
                              <span className="w-1 h-1 rounded-full bg-current opacity-50 flex-shrink-0" />
                              <span>{sub}</span>
                              {clipCounts.bySubcategory[`${cat}::${sub}`] && (
                                <span className="ml-auto text-[10px] text-outline/50 tabular-nums">
                                  {clipCounts.bySubcategory[`${cat}::${sub}`].unread}/{clipCounts.bySubcategory[`${cat}::${sub}`].total}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                        {(() => {
                          const catCount = clipCounts.byCategory[cat];
                          if (!catCount) return null;
                          const subTotal = subs.reduce((acc, sub) => {
                            const sc = clipCounts.bySubcategory[`${cat}::${sub}`];
                            return { unread: acc.unread + (sc?.unread ?? 0), total: acc.total + (sc?.total ?? 0) };
                          }, { unread: 0, total: 0 });
                          const otherTotal = catCount.total - subTotal.total;
                          const otherUnread = catCount.unread - subTotal.unread;
                          if (otherTotal <= 0) return null;
                          const isOtherActive = currentCategory === cat && !currentSubcategory;
                          return (
                            <Link
                              href={`/?category=${encodeURIComponent(cat)}`}
                              className={clsx(
                                "flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-lg transition-all text-xs font-medium",
                                isOtherActive
                                  ? "bg-secondary-container text-on-secondary-container"
                                  : "text-on-surface-variant hover:bg-surface-container"
                              )}
                            >
                              <span className="w-1 h-1 rounded-full bg-current opacity-50 flex-shrink-0" />
                              <span>その他</span>
                              <span className="ml-auto text-[10px] text-outline/50 tabular-nums">
                                {otherUnread}/{otherTotal}
                              </span>
                            </Link>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <button
            onClick={() => setIsTagsOpen(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <h3 className="text-[11px] font-bold text-outline uppercase tracking-widest">よく使うタグ</h3>
            {isTagsOpen ? <ChevronDown className="w-4 h-4 text-outline" /> : <ChevronRight className="w-4 h-4 text-outline" />}
          </button>

          {isTagsOpen && (
            <div className="space-y-1 mt-1">
              {popularTags.map((tag) => {
                const isActive = currentTag === tag;
                return (
                  <Link
                    key={tag}
                    href={`/?tag=${tag}`}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium text-sm",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container"
                        : "text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    <Hash className="w-4 h-4 flex-shrink-0 opacity-60" />
                    <span>{tag}</span>
                    {clipCounts.byTag[tag] && (
                      <span className="ml-auto text-[10px] text-outline/50 tabular-nums">
                        {clipCounts.byTag[tag].unread}/{clipCounts.byTag[tag].total}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Media Types */}
        <div>
          <button
            onClick={() => setIsMediaOpen(v => !v)}
            className="flex items-center justify-between w-full px-4 py-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <h3 className="text-[11px] font-bold text-outline uppercase tracking-widest">メディアタイプ</h3>
            {isMediaOpen ? <ChevronDown className="w-4 h-4 text-outline" /> : <ChevronRight className="w-4 h-4 text-outline" />}
          </button>

          {isMediaOpen && (
            <div className="space-y-1 mt-1">
              {typeNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-2 rounded-xl transition-all font-medium text-sm",
                    item.isActive
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0 opacity-80" />
                  <span>{item.label}</span>
                  {clipCounts.byType[item.typeKey] && (
                    <span className="ml-auto text-[10px] text-outline/50 tabular-nums">
                      {clipCounts.byType[item.typeKey].unread}/{clipCounts.byType[item.typeKey].total}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-0 shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest py-4 space-y-1">
        {footerNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function SidebarNav() {
  return (
    <div className="hidden lg:block" aria-label="デスクトップサイドバー">
      <Suspense
        fallback={
          <aside
            aria-hidden="true"
            className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden bg-surface-container-lowest border-r border-outline-variant/10"
          />
        }
      >
        <SidebarContent />
      </Suspense>
    </div>
  );
}
