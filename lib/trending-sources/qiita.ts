export type TrendingItem = {
  source: 'qiita';
  title: string;
  url: string;
  body: string;
  thumbnail: string | null;
  score: number;
  sourceCreatedAt: string | null;
};

type QiitaItem = {
  title?: string;
  url?: string;
  body?: string;
  likes_count?: number;
  stocks_count?: number;
  created_at?: string;
  user?: { profile_image_url?: string };
};

export async function fetchQiitaTrending(limit: number): Promise<TrendingItem[]> {
  const query = encodeURIComponent('created:>=2026-01-01 stocks:>=3');
  const res = await fetch(`https://qiita.com/api/v2/items?page=1&per_page=${Math.min(Math.max(limit * 2, 10), 100)}&query=${query}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ThrowInAppBot/1.0',
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Qiita API failed: ${res.status} ${res.statusText}`);
  }

  const items = await res.json() as QiitaItem[];
  return items
    .filter(item => item.title && item.url)
    .map(item => ({
      source: 'qiita' as const,
      title: item.title!,
      url: item.url!,
      body: item.body || '',
      thumbnail: item.user?.profile_image_url || null,
      score: (item.likes_count ?? 0) * 2 + (item.stocks_count ?? 0),
      sourceCreatedAt: item.created_at || null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
