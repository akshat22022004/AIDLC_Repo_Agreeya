export interface LLMAdapter {
  name: string;
  analyze(systemPrompt: string, userContent: string): Promise<string>;
  chat(systemPrompt: string, messages: { role: 'user' | 'model'; content: string }[]): Promise<string>;
  isConfigured(): boolean;
}

export function selectAdapter(adapters: LLMAdapter[]): LLMAdapter | null {
  return adapters.find((a) => a.isConfigured()) ?? null;
}
