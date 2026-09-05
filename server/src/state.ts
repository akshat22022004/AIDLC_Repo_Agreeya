import type { Session } from './types/index.js';
import type { LLMAdapter } from './services/llm/adapter.js';
import { selectAdapter } from './services/llm/adapter.js';
import { GeminiAdapter } from './services/llm/gemini.js';
import { OpenAIAdapter } from './services/llm/openai.js';
import { ClaudeAdapter } from './services/llm/claude.js';

export const sessions = new Map<string, Session>();
export const chatHistories = new Map<string, { role: 'user' | 'model'; content: string }[]>();

const adapters: LLMAdapter[] = [
  new GeminiAdapter(),
  new OpenAIAdapter(),
  new ClaudeAdapter(),
];

export function getLLM(): LLMAdapter | null {
  return selectAdapter(adapters);
}
