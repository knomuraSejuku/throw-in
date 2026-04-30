import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Noto_Sans_JP, Dela_Gothic_One } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/auth-provider';
import { ServiceWorkerRegister } from '@/components/sw-register';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-pj',
});

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto',
});

const delaGothicOne = Dela_Gothic_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-dela',
});

export const metadata: Metadata = {
  title: 'Throw In',
  description: 'Digital Curator - 気になる情報を保存し、整理し、あとで見返せる個人ライブラリ。',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/app-icon-192.png',
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
      <body className={`${plusJakartaSans.variable} ${notoSansJp.variable} ${delaGothicOne.variable} font-sans antialiased text-on-surface bg-background`}>
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
