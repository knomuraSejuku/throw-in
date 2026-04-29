import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const fullText = transcript.map(t => t.text).join(' ');

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
