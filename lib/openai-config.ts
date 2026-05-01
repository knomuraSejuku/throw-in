export const OPENAI_METADATA_MODEL = 'gpt-5-nano';
export const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const OPENAI_REASONING = {
  high: { effort: 'high' },
  medium: { effort: 'medium' },
  low: { effort: 'low' },
} as const;

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIOutputText(data: any): string {
  return data?.output?.find((o: { type: string }) => o.type === 'message')
    ?.content?.find((c: { type: string }) => c.type === 'output_text')?.text ?? '';
}
