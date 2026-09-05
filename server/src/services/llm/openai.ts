import type { LLMAdapter } from './adapter.js';

export class OpenAIAdapter implements LLMAdapter {
  name = 'openai';

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async analyze(_systemPrompt: string, _userContent: string): Promise<string> {
    throw new Error('OpenAI adapter not yet implemented. Set GEMINI_API_KEY to use the Gemini adapter.');
  }

  async chat(
    _systemPrompt: string,
    _messages: { role: 'user' | 'model'; content: string }[]
  ): Promise<string> {
    throw new Error('OpenAI adapter not yet implemented.');
  }
}
