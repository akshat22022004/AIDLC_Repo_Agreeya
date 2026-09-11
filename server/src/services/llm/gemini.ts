if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMAdapter } from './adapter.js';

const MODEL_FALLBACK_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

const REQUEST_OPTIONS = {};

const NO_FALLBACK_STATUS = new Set([400, 401]);

function getErrorStatus(err: any): number | undefined {
  if (typeof err?.status === 'number') return err.status;
  const match = /\[(\d{3})\s/.exec(err?.message ?? '');
  return match ? Number(match[1]) : undefined;
}

export class GeminiAdapter implements LLMAdapter {
  name = 'gemini';

  private getClient(): GoogleGenerativeAI | null {
    const key = process.env.GEMINI_API_KEY;
    return key ? new GoogleGenerativeAI(key) : null;
  }

  isConfigured(): boolean {
    return this.getClient() !== null;
  }

  private async withFallback<T>(run: (modelName: string) => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (const modelName of MODEL_FALLBACK_CHAIN) {
      console.log(`[Gemini] Trying model: ${modelName}...`);
      try {
        const result = await run(modelName);
        console.log(`[Gemini] Success with: ${modelName}`);
        return result;
      } catch (err: any) {
        const status = getErrorStatus(err);

        if (status !== undefined && NO_FALLBACK_STATUS.has(status)) {
          console.log(`[Gemini] ${modelName} failed (${status}), not retryable, aborting.`);
          throw err;
        }

        console.log(`[Gemini] ${modelName} failed (${status ?? 'unknown'}), trying next...`);
        lastError = err;
      }
    }

    throw new Error('All Gemini models unavailable. Try again later.');
  }

  async analyze(systemPrompt: string, userContent: string): Promise<string> {
    const client = this.getClient();
    if (!client) throw new Error('Gemini API key not configured');

    return this.withFallback(async (modelName) => {
      const model = client.getGenerativeModel(
        {
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        },
        REQUEST_OPTIONS
      );

      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\nDOCUMENTS:\n${userContent}` }] },
        ],
      });

      return result.response.text();
    });
  }

  async chat(
    systemPrompt: string,
    messages: { role: 'user' | 'model'; content: string }[]
  ): Promise<string> {
    const client = this.getClient();
    if (!client) throw new Error('Gemini API key not configured');

    return this.withFallback(async (modelName) => {
      const model = client.getGenerativeModel(
        {
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        },
        REQUEST_OPTIONS
      );

      const chat = model.startChat({
        history: messages.slice(0, -1).map((m) => ({
          role: m.role,
          parts: [{ text: m.content }],
        })),
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      return result.response.text();
    });
  }
}
