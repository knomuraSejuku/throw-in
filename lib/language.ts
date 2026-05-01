export type AppLanguage = 'ja' | 'en';

export function normalizePreferredLanguage(value: string | null | undefined): AppLanguage {
  if (!value) return 'ja';
  const normalized = value.trim().toLowerCase();
  return normalized === 'english' || normalized === 'en' ? 'en' : 'ja';
}

export function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ja';
  return normalizePreferredLanguage(window.localStorage.getItem('preferred_language'));
}

export function getPreferredLanguageLabel() {
  return getPreferredLanguage() === 'en' ? 'English' : '日本語';
}
