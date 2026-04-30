import type { Metadata } from 'next';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/auth-provider';
import { ServiceWorkerRegister } from '@/components/sw-register';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto',
});

export const metadata: Metadata = {
  title: 'Throw In',
  description: '投げ入れるように、気になる情報を整理する個人ライブラリ。',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/app-icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansJp.variable} font-sans antialiased text-on-surface bg-background`}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AuthProvider>
            {children}
            <ServiceWorkerRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
