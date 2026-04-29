import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';

export const runtime = 'nodejs';

function isPrivateIP(ip: string): boolean {
  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  // IPv6
  if (ip === '::1' || ip.toLowerCase().startsWith('fd') || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fe80')) {
    return true;
  }
  return false;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getMetaContent(html: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${escapedKey}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapedKey}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }

  return '';
}

function getTagText(html: string, tagName: string): string {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(html);
  return match?.[1] ? htmlToText(match[1]) : '';
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ');

  return normalizeText(decodeHtmlEntities(withoutNoise.replace(/<[^>]+>/g, ' ')));
}

function extractMainText(html: string): string {
  const articleMatch = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (articleMatch?.[1]) {
    const text = htmlToText(articleMatch[1]);
    if (text.length > 80) return text;
  }

  const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (mainMatch?.[1]) {
    const text = htmlToText(mainMatch[1]);
    if (text.length > 80) return text;
  }

  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return htmlToText(bodyMatch?.[1] || html);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol. Only HTTP and HTTPS are allowed.' }, { status: 400 });
    }

    // SSRF Check: resolve IP and block local/private ranges.
    // NOTE: In advanced SSRF guards, we also need to prevent redirecting to private IPs.
    try {
      const result = await dns.lookup(parsedUrl.hostname);
      if (isPrivateIP(result.address)) {
        return NextResponse.json({ error: 'Access to private IPs is blocked due to SSRF protection' }, { status: 403 });
      }
    } catch (e: any) {
      console.warn(`DNS lookup failed for ${parsedUrl.hostname}`, e);
    }

    // Google Workspace URL detection
    if (parsedUrl.hostname === 'docs.google.com') {
      const path = parsedUrl.pathname;
      const docMatch = /^\/document\/d\/([^/]+)/.exec(path);
      const slideMatch = /^\/presentation\/d\/([^/]+)/.exec(path);
      const sheetMatch = /^\/spreadsheets\/d\/([^/]+)/.exec(path);

      if (docMatch) {
        const docId = docMatch[1];
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const res = await fetch(exportUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThrowInAppBot/1.0)' } });
        if (!res.ok) return NextResponse.json({ error: `Google Docs export failed: ${res.statusText}` }, { status: res.status });
        const text = await res.text();
        const title = text.split('\n')[0]?.trim() || 'Google Doc';
        return NextResponse.json({ title, description: null, thumbnail: null, body: text.trim(), domain: 'docs.google.com' });
      }

      if (slideMatch) {
        const slideId = slideMatch[1];
        const exportUrl = `https://docs.google.com/presentation/d/${slideId}/export/pdf`;
        const res = await fetch(exportUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThrowInAppBot/1.0)' } });
        if (!res.ok) return NextResponse.json({ error: `Google Slides export failed: ${res.statusText}` }, { status: res.status });
        // @ts-ignore
        const pdfParse = (await import('pdf-parse')).default;
        const buffer = Buffer.from(await res.arrayBuffer());
        const parsed = await pdfParse(buffer);
        const title = parsed.text.split('\n')[0]?.trim() || 'Google Slides';
        return NextResponse.json({ title, description: null, thumbnail: null, body: parsed.text.trim(), domain: 'docs.google.com' });
      }

      if (sheetMatch) {
        const sheetId = sheetMatch[1];
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const res = await fetch(exportUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThrowInAppBot/1.0)' } });
        if (!res.ok) return NextResponse.json({ error: `Google Sheets export failed: ${res.statusText}` }, { status: res.status });
        const csv = await res.text();
        const body = csv.split('\n').map(row => row.replace(/,/g, '\t')).join('\n');
        const title = body.split('\n')[0]?.split('\t')[0]?.trim() || 'Google Sheets';
        return NextResponse.json({ title, description: null, thumbnail: null, body: body.trim(), domain: 'docs.google.com' });
      }
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThrowInAppBot/1.0; +https://example.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      signal: abortController.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.statusText}` }, { status: response.status });
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({ error: 'Not an HTML page' }, { status: 400 });
    }

    const html = await response.text();

    const ogTitle = getMetaContent(html, 'og:title') || getMetaContent(html, 'twitter:title');
    const pageTitle = getTagText(html, 'title');
    const ogDescription =
      getMetaContent(html, 'og:description') ||
      getMetaContent(html, 'description') ||
      getMetaContent(html, 'twitter:description');
    const ogImage = getMetaContent(html, 'og:image') || getMetaContent(html, 'twitter:image');
    const body = extractMainText(html).slice(0, 30000);

    return NextResponse.json({
      title: ogTitle || pageTitle || null,
      description: ogDescription || null,
      thumbnail: ogImage || null,
      body: body || ogDescription || null,
      domain: parsedUrl.hostname,
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('Extraction error:', {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: getErrorMessage(error) || 'Internal server error' }, { status: 500 });
  }
}
