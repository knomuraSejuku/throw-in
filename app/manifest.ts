import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Throw In',
    short_name: 'Throw In',
    description: '投げ入れるように、気になる情報を整理する個人ライブラリ。',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#fafaf8',
    lang: 'ja-JP',
    orientation: 'portrait',
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
      action: '/api/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'files',
            accept: ['image/*', 'application/pdf', 'video/mp4'],
          },
        ],
      },
    }
  } as any; // Type override for share_target not officially in Next.js manifest types yet
}
