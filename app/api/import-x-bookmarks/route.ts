import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { inflateRawSync } from 'zlib';

export const runtime = 'nodejs';

const MAX_FILES = 1200;
const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

type MarkdownFile = {
  name: string;
  text: string;
};

type ImportRow = {
  user_id: string;
  title: string;
  url: string;
  content_type: 'note';
  source_domain: 'x.com';
  extracted_content: string;
  my_note: string;
  preview_image_url: string | null;
  is_read: false;
  is_global_search: false;
  created_at?: string;
};

type ImportResult = {
  fileName: string;
  status: 'created' | 'skipped' | 'failed';
  clipId?: string;
  url?: string;
  body?: string;
  error?: string;
  reason?: 'duplicate' | 'missing_url' | 'unsupported_zip_entry';
};

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (readUInt32(buffer, i) === 0x06054b50) return i;
  }
  return -1;
}

function extractMarkdownFromZip(buffer: Buffer): MarkdownFile[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error('Invalid ZIP file');

  const entryCount = readUInt16(buffer, eocdOffset + 10);
  let centralOffset = readUInt32(buffer, eocdOffset + 16);
  const files: MarkdownFile[] = [];

  for (let i = 0; i < entryCount && files.length < MAX_FILES; i++) {
    if (readUInt32(buffer, centralOffset) !== 0x02014b50) break;

    const method = readUInt16(buffer, centralOffset + 10);
    const compressedSize = readUInt32(buffer, centralOffset + 20);
    const fileNameLength = readUInt16(buffer, centralOffset + 28);
    const extraLength = readUInt16(buffer, centralOffset + 30);
    const commentLength = readUInt16(buffer, centralOffset + 32);
    const localHeaderOffset = readUInt32(buffer, centralOffset + 42);
    const fileName = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf8');
    const isDirectory = fileName.endsWith('/');

    if (!isDirectory && fileName.toLowerCase().endsWith('.md')) {
      if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) {
        files.push({ name: fileName, text: '' });
      } else {
        const localFileNameLength = readUInt16(buffer, localHeaderOffset + 26);
        const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
        const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

        if (method === 0) {
          files.push({ name: fileName, text: compressed.toString('utf8') });
        } else if (method === 8) {
          files.push({ name: fileName, text: inflateRawSync(compressed).toString('utf8') });
        } else {
          files.push({ name: fileName, text: '' });
        }
      }
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function parseMarkdown(file: MarkdownFile, userId: string): ImportRow | null {
  const text = file.text.trim();
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const field = (name: string) => {
    const match = text.match(new RegExp(`^${name}\\s*[:：]\\s*(.+)$`, 'im'));
    return match?.[1]?.trim() || '';
  };
  const contentField = text.match(/^Content\s*[:：]\s*([\s\S]*)$/im)?.[1]?.trim();
  const content = contentField || text;
  const firstContentLine = content.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  const title = field('Title') || lines[0]?.replace(/^#+\s*/, '').trim() || firstContentLine || file.name.replace(/\.md$/i, '');
  const urlMatch = text.match(/https?:\/\/(?:x\.com|twitter\.com)\/\w+\/status\/\d+/);
  const url = field('URL') || (urlMatch ? urlMatch[0] : '');
  const createdAt = field('Date') || text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/)?.[0] || '';
  const imgMatch = text.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);

  if (!url) return null;

  return {
    user_id: userId,
    title,
    url,
    content_type: 'note',
    source_domain: 'x.com',
    extracted_content: content,
    my_note: 'Xブックマーク取り込み',
    preview_image_url: imgMatch ? imgMatch[1] : null,
    is_read: false,
    is_global_search: false,
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart form required' }, { status: 400 });

  const uploadedFiles = form.getAll('files').filter((value): value is File => value instanceof File);
  if (uploadedFiles.length === 0) return NextResponse.json({ error: 'files required' }, { status: 400 });

  let totalBytes = 0;
  const markdownFiles: MarkdownFile[] = [];
  const results: ImportResult[] = [];

  for (const file of uploadedFiles) {
    totalBytes += file.size;
    if (totalBytes > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: 'Import files are too large' }, { status: 413 });
    }

    if (file.name.toLowerCase().endsWith('.zip')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const entries = extractMarkdownFromZip(buffer);
      for (const entry of entries) {
        if (!entry.text) {
          results.push({ fileName: entry.name, status: 'failed', reason: 'unsupported_zip_entry', error: 'Unsupported or invalid ZIP entry' });
        } else {
          markdownFiles.push(entry);
        }
      }
    } else if (file.name.toLowerCase().endsWith('.md')) {
      markdownFiles.push({ name: file.name, text: await file.text() });
    }
  }

  const limitedFiles = markdownFiles.slice(0, MAX_FILES);
  const parsedRows: Array<{ fileName: string; row: ImportRow }> = [];
  const seen = new Set<string>();

  for (const file of limitedFiles) {
    const row = parseMarkdown(file, user.id);
    if (!row) {
      results.push({ fileName: file.name, status: 'skipped', reason: 'missing_url' });
      continue;
    }

    if (seen.has(row.url)) {
      results.push({ fileName: file.name, status: 'skipped', url: row.url, reason: 'duplicate' });
      continue;
    }

    seen.add(row.url);
    parsedRows.push({ fileName: file.name, row });
  }

  const urls = parsedRows.map(item => item.row.url);
  const existingUrls = new Set<string>();
  if (urls.length > 0) {
    const { data: existing, error } = await supabase
      .from('clips')
      .select('url')
      .eq('user_id', user.id)
      .in('url', urls);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    (existing ?? []).forEach(row => {
      if (row.url) existingUrls.add(row.url);
    });
  }

  for (const item of parsedRows) {
    if (existingUrls.has(item.row.url)) {
      results.push({ fileName: item.fileName, status: 'skipped', url: item.row.url, reason: 'duplicate' });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('clips')
      .insert(item.row)
      .select('id')
      .single();

    if (error) {
      results.push({ fileName: item.fileName, status: 'failed', url: item.row.url, error: error.message });
    } else {
      results.push({
        fileName: item.fileName,
        status: 'created',
        clipId: inserted.id,
        url: item.row.url,
        body: item.row.extracted_content,
      });
    }
  }

  return NextResponse.json({
    total: results.length,
    created: results.filter(result => result.status === 'created').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    failed: results.filter(result => result.status === 'failed').length,
    results,
  });
}
