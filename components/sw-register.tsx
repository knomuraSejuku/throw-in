'use client';

import { useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __throwInInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    const installPromptHandler = (e: Event) => {
      e.preventDefault();
      window.__throwInInstallPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event('throwin:installprompt'));
    };
    const installedHandler = () => {
      window.__throwInInstallPrompt = null;
      window.dispatchEvent(new Event('throwin:appinstalled'));
    };

    window.addEventListener('beforeinstallprompt', installPromptHandler);
    window.addEventListener('appinstalled', installedHandler);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(
          function (registration) {
             // console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          function (err) {
             console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', installPromptHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  return null;
}
