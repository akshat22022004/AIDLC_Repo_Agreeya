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

console.log('GEMINI_API_KEY length:', (process.env.GEMINI_API_KEY ?? '').length);
console.log(
  'LLM adapter configuration:',
  adapters.map((a) => `${a.name}=${a.isConfigured() ? 'configured' : 'not configured'}`).join(', ')
);
const selected = selectAdapter(adapters);
console.log('LLM adapter selected:', selected ? selected.name : 'none');

export function getLLM(): LLMAdapter | null {
  return selectAdapter(adapters);
}
