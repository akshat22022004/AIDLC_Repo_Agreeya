import type { Session } from './types/index.js';
import type { LLMAdapter } from './services/llm/adapter.js';
import { selectAdapter } from './services/llm/adapter.js';
import { GeminiAdapter } from './services/llm/gemini.js';
import { OpenAIAdapter } from './services/llm/openai.js';
import { ClaudeAdapter } from './services/llm/claude.js';
import { getStatus } from './services/secondBrain.js';

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

/**
 * Sessions live in memory but the Second Brain lives on disk, so cycle count and
 * approval status are re-hydrated from the brain whenever a session is (re)created.
 */
export function createSession(sessionId: string): Session {
  const status = getStatus(sessionId);
  const session: Session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    files: [],
    analyses: [],
    currentStep: 'upload',
    cycleCount: status.cycleCount,
    approvalStatus: status.approvalStatus,
    approvedAt: status.approvedAt,
  };
  sessions.set(sessionId, session);
  return session;
}

export function getOrCreateSession(sessionId: string): Session {
  const existing = sessions.get(sessionId);
  if (existing) {
    // Fill in fields a session created by an older code path may be missing.
    if (typeof existing.cycleCount !== 'number') existing.cycleCount = getStatus(sessionId).cycleCount;
    if (!existing.approvalStatus) existing.approvalStatus = getStatus(sessionId).approvalStatus;
    return existing;
  }
  return createSession(sessionId);
}
