export function normalizeClipUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'twitter.com' || host === 'x.com') {
    return `https://x.com${parsed.pathname}`.replace(/\/$/, '');
  }

  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://${parsed.hostname}/watch?v=${videoId}` : parsed.origin + parsed.pathname;
    }
    return parsed.origin + parsed.pathname;
  }

  if (host === 'youtu.be') {
    return `https://youtu.be${parsed.pathname}`;
  }

  const normalizedPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${parsed.protocol}//${host}${normalizedPath}`;
}

export function isUrlClipContentType(contentType: string | null | undefined): boolean {
  return contentType === 'article' || contentType === 'video';
}
