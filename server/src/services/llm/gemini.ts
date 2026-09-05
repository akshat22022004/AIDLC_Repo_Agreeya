import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMAdapter } from './adapter.js';

export class GeminiAdapter implements LLMAdapter {
  name = 'gemini';
  private modelName = 'gemini-flash-latest';

  private getClient(): GoogleGenerativeAI | null {
    const key = process.env.GEMINI_API_KEY;
    return key ? new GoogleGenerativeAI(key) : null;
  }

  isConfigured(): boolean {
    return this.getClient() !== null;
  }

  async analyze(systemPrompt: string, userContent: string): Promise<string> {
    const client = this.getClient();
    if (!client) throw new Error('Gemini API key not configured');

    const model = client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\nDOCUMENTS:\n${userContent}` }] },
      ],
    });

    return result.response.text();
  }

  async chat(
    systemPrompt: string,
    messages: { role: 'user' | 'model'; content: string }[]
  ): Promise<string> {
    const client = this.getClient();
    if (!client) throw new Error('Gemini API key not configured');

    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }
}
