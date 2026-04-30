import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const manifest = read('app/manifest.ts');
const serviceWorker = read('public/sw.js');
const swRegister = read('components/sw-register.tsx');
const settings = read('app/settings/page.tsx');

expect(manifest.includes("display: 'standalone'"), 'manifest display must be standalone');
expect(manifest.includes("start_url: '/'"), 'manifest start_url must be /');
expect(manifest.includes('share_target'), 'manifest share_target is missing');
expect(manifest.includes('/icons/app-icon-192.png'), 'manifest 192 icon is missing');
expect(manifest.includes('/icons/app-icon-512.png'), 'manifest 512 icon is missing');
expect(existsSync(join(root, 'public/icons/app-icon-192.png')), 'public/icons/app-icon-192.png is missing');
expect(existsSync(join(root, 'public/icons/app-icon-512.png')), 'public/icons/app-icon-512.png is missing');
expect(serviceWorker.includes('install') && serviceWorker.includes('fetch'), 'service worker install/fetch handlers are missing');
expect(swRegister.includes('beforeinstallprompt'), 'beforeinstallprompt capture is missing');
expect(swRegister.includes('throwin:installprompt'), 'install prompt event bridge is missing');
expect(settings.includes('インストール済み') && settings.includes('ホーム画面に追加'), 'settings install fallback UI is missing');

if (failures.length > 0) {
  console.error('PWA check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PWA check passed.');
