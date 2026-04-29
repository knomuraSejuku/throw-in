import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Throw In',
    short_name: 'Throw In',
    description: '気になる情報を保存し、整理し、あとで見返せる個人ライブラリ。',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8ff',
    theme_color: '#faf8ff',
    lang: 'ja-JP',
    orientation: 'any',
    icons: [
      {
        src: '/icons/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: '/icons/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any',
      },
    ],
    shortcuts: [
      {
        name: '新規追加',
        short_name: '追加',
        url: '/add',
      },
      {
        name: '検索',
        short_name: '検索',
        url: '/search',
      },
    ],
    share_target: {
      action: '/add',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    }
  } as any; // Type override for share_target not officially in Next.js manifest types yet
}
