import { NextRequest, NextResponse } from 'next/server';

type TranscriptItem = { text: string };
type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
};

type TimedTextResponse = {
  events?: Array<{
    segs?: Array<{ utf8?: string }>;
  }>;
};

const YOUTUBE_CLIENT_VERSION = '20.10.38';
const YOUTUBE_PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YOUTUBE_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': `com.google.android.youtube/${YOUTUBE_CLIENT_VERSION} (Linux; U; Android 14)`,
};

function getYouTubeVideoId(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^(www\.|m\.)/, '');
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be') return pathParts[0] ?? rawUrl;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (parsed.searchParams.get('v')) return parsed.searchParams.get('v')!;
      if (['shorts', 'live', 'embed', 'v'].includes(pathParts[0])) return pathParts[1] ?? rawUrl;
    }
  } catch {
    // The library also accepts bare video IDs.
  }
  return rawUrl;
}

function pickBestCaptionTrack(tracks: CaptionTrack[]) {
  return (
    tracks.find(track => track.languageCode === 'ja' && track.kind === 'asr') ||
    tracks.find(track => track.languageCode === 'ja') ||
    tracks.find(track => track.kind === 'asr') ||
    tracks[0]
  );
}

function parseTimedTextJson(payload: TimedTextResponse): TranscriptItem[] {
  const lines: string[] = [];
  for (const event of payload.events ?? []) {
    const text = event.segs
      ?.map(segment => segment.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) lines.push(text);
  }

  return lines.map(text => ({ text }));
}

async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const response = await fetch(YOUTUBE_PLAYER_URL, {
    method: 'POST',
    headers: YOUTUBE_HEADERS,
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: YOUTUBE_CLIENT_VERSION,
          hl: 'ja',
          gl: 'JP',
        },
      },
      videoId,
    }),
  });

  if (!response.ok) {
    throw new Error(`YouTube player API failed: ${response.status}`);
  }

  const data = await response.json();
  const status = data?.playabilityStatus?.status;
  if (status && status !== 'OK') {
    throw new Error(data?.playabilityStatus?.reason || 'Video unavailable');
  }

  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

async function fetchTranscriptFromTrack(track: CaptionTrack): Promise<TranscriptItem[]> {
  if (!track.baseUrl) throw new Error('Caption track did not include a baseUrl');
  const url = new URL(track.baseUrl);
  url.searchParams.set('fmt', 'json3');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': YOUTUBE_HEADERS['User-Agent'],
      'Accept': 'application/json,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube timedtext API failed: ${response.status}`);
  }

  const data = await response.json().catch(() => null) as TimedTextResponse | null;
  if (!data) throw new Error('YouTube timedtext API returned invalid JSON');

  return parseTimedTextJson(data);
}

async function fetchYouTubeTranscript(videoId: string) {
  const tracks = await fetchCaptionTracks(videoId);
  if (tracks.length === 0) {
    throw new Error('No transcript tracks returned');
  }

  const track = pickBestCaptionTrack(tracks);
  if (!track) throw new Error('No transcript tracks returned');

  const transcript = await fetchTranscriptFromTrack(track);
  if (transcript.length > 0) return transcript;

  throw new Error('Transcript track was empty');
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      const videoId = getYouTubeVideoId(url);
      const transcript = await fetchYouTubeTranscript(videoId);
      const fullText = transcript.map(t => t.text).join(' ');
      if (!fullText.trim()) {
        return NextResponse.json({ error: '字幕は取得できましたが、本文が空でした。' }, { status: 400 });
      }

      return NextResponse.json({
        body: fullText,
        title: null,
        description: null
      });
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      let userMessage: string;
      if (msg.includes('Transcript is disabled') || msg.includes('subtitles')) {
        userMessage = 'この動画では字幕・トランスクリプトが無効になっています。';
      } else if (msg.includes('Could not find') || msg.includes('Video unavailable') || msg.includes('private')) {
        userMessage = '動画が存在しないか非公開です。URLを確認してください。';
      } else if (msg.includes('No transcripts') || msg.includes('no transcript')) {
        userMessage = 'この動画にはトランスクリプトがありません（字幕なし動画）。';
      } else {
        userMessage = `YouTube字幕の取得に失敗しました。動画が公開されており字幕が有効か確認してください。（${msg}）`;
      }
      return NextResponse.json({ error: userMessage }, { status: 400 });
    }

  } catch (error: any) {
    console.error('YouTube extraction error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。' }, { status: 500 });
  }
}
