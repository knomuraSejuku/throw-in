export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}
