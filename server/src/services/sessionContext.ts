import fs from 'fs/promises';
import path from 'path';
import type { Session } from '../types/index.js';

/** Concatenated text of every successfully parsed file in a session. */
export async function readParsedDocuments(session: Session, maxCharsPerFile?: number): Promise<string> {
  const parsedDir = path.resolve('parsed');
  const parts: string[] = [];

  for (const file of session.files.filter((f) => f.status === 'ready')) {
    try {
      const text = await fs.readFile(path.join(parsedDir, `${file.id}.txt`), 'utf-8');
      const body = maxCharsPerFile ? text.slice(0, maxCharsPerFile) : text;
      parts.push(`=== FILE: ${file.originalName} ===\n${body}`);
    } catch {
      // Virtual/ticket files may not have parsed text on disk — skip silently.
    }
  }

  return parts.join('\n\n');
}

/**
 * Pull a JSON object out of an LLM response, tolerating markdown fences and
 * surrounding prose.
 */
export function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return raw.slice(braceStart, braceEnd + 1);
  }
  return raw;
}

export function parseLlmJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    throw new Error(
      `Failed to parse ${label} as JSON. Raw response starts with: ${raw.slice(0, 200)}`
    );
  }
}
