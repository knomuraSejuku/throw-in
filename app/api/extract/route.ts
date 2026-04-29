import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';

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

    // 1. Cheerio for fast metadata extraction
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || '';
    const pageTitle = $('title').text() || '';

    const ogDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';

    // 2. Readability for main content extraction
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    return NextResponse.json({
      title: ogTitle || pageTitle || article?.title || null,
      description: ogDescription || article?.excerpt || null,
      thumbnail: ogImage || null,
      body: article?.content?.trim() || null,
      domain: parsedUrl.hostname,
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('Extraction error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
