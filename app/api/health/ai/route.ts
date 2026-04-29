import { NextResponse } from 'next/server';
import { hasOpenAIKey } from '@/lib/openai-config';

export async function GET() {
  return NextResponse.json({ openaiConfigured: hasOpenAIKey() });
}
