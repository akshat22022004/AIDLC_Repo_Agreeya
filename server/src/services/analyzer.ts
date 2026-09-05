import type { LLMAdapter } from './llm/adapter.js';
import type { AnalysisResult, ClarifyingQuestion } from '../types/index.js';
import { buildAnalysisPrompt } from '../prompts/documentAnalysis.js';

const MAX_CHARS_PER_CHUNK = 100_000;

function chunkContent(content: string): string[] {
  if (content.length <= MAX_CHARS_PER_CHUNK) return [content];

  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = start + MAX_CHARS_PER_CHUNK;
    if (end < content.length) {
      const breakPoint = content.lastIndexOf('\n', end);
      if (breakPoint > start) end = breakPoint;
    }
    chunks.push(content.slice(start, end));
    start = end;
  }
  return chunks;
}

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return raw.slice(braceStart, braceEnd + 1);
  }
  return raw;
}

export async function analyzeDocuments(
  llm: LLMAdapter,
  parsedContent: string,
  previousAnswers?: string
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(previousAnswers);
  const chunks = chunkContent(parsedContent);

  let content: string;
  if (chunks.length === 1) {
    content = chunks[0];
  } else {
    content = chunks
      .map((chunk, i) => `--- DOCUMENT CHUNK ${i + 1} of ${chunks.length} ---\n${chunk}`)
      .join('\n\n');
  }

  const rawResponse = await llm.analyze(prompt, content);
  const jsonStr = extractJson(rawResponse);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON. Raw response starts with: ${rawResponse.slice(0, 200)}`);
  }

  const questions: ClarifyingQuestion[] = (parsed.questions || []).map((q: any) => ({
    id: q.id,
    category: q.category,
    question: q.question,
    context: q.context,
    priority: q.priority,
    answerType: q.answerType || 'text',
    options: q.options,
    status: 'pending' as const,
  }));

  return {
    understanding: {
      projectOverview: parsed.understanding?.projectOverview || 'NOT FOUND in documents',
      businessObjective: parsed.understanding?.businessObjective || 'NOT FOUND in documents',
      scope: {
        inScope: parsed.understanding?.scope?.inScope || [],
        outOfScope: parsed.understanding?.scope?.outOfScope || [],
        unclear: parsed.understanding?.scope?.unclear || [],
      },
      stakeholders: parsed.understanding?.stakeholders || [],
      timeline: parsed.understanding?.timeline || 'NOT FOUND in documents',
      techStack: parsed.understanding?.techStack || 'NOT FOUND in documents',
      deliverables: parsed.understanding?.deliverables || [],
      constraints: parsed.understanding?.constraints || [],
      assumptions: parsed.understanding?.assumptions || [],
      risks: parsed.understanding?.risks || [],
      dependencies: parsed.understanding?.dependencies || [],
    },
    confidenceScore: parsed.confidenceScore ?? 0,
    questions,
  };
}
