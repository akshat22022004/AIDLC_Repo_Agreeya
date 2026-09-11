import fs from 'fs';
import path from 'path';
import type {
  SecondBrainData,
  SecondBrainStatus,
  QnaRecord,
  UnderstandingSummary,
  EpicStoriesResult,
  ProjectUnderstanding,
} from '../types/index.js';

/**
 * The Second Brain is the single source of truth for a project session.
 *
 * Two files are kept side by side in projects/<sessionId>/context/:
 *   - second-brain.md    human-readable, the artifact the team reads and reviews
 *   - second-brain.json  the structured mirror the server reads/writes
 *
 * The markdown file is always re-rendered from the JSON on every mutation, so the
 * two can never drift. Parsing markdown back into structure would be fragile, so
 * the JSON is authoritative for machine reads while the markdown is authoritative
 * for the LLM context block and for humans.
 */

export const MAX_QUESTION_CYCLES = 2;

const PROJECTS_DIR = path.resolve('projects');

function contextDir(sessionId: string): string {
  return path.join(PROJECTS_DIR, sessionId, 'context');
}

export function secondBrainMdPath(sessionId: string): string {
  return path.join(contextDir(sessionId), 'second-brain.md');
}

function secondBrainJsonPath(sessionId: string): string {
  return path.join(contextDir(sessionId), 'second-brain.json');
}

export function reportsDir(sessionId: string): string {
  return path.join(PROJECTS_DIR, sessionId, 'reports');
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyBrain(sessionId: string): SecondBrainData {
  const now = new Date().toISOString();
  return {
    sessionId,
    projectName: 'Untitled Project',
    createdAt: now,
    lastUpdated: now,
    sourceDocuments: [],
    documentUnderstanding: '',
    confidenceScore: 0,
    cycleCount: 0,
    qna: [],
    confirmedFacts: [],
    assumptions: [],
    openItems: [],
    humanInputs: [],
    approval: { status: 'pending' },
  };
}

// ── Read / write ───────────────────────────────────────────────────────────────

export function exists(sessionId: string): boolean {
  return fs.existsSync(secondBrainJsonPath(sessionId));
}

export function readBrain(sessionId: string): SecondBrainData | null {
  const p = secondBrainJsonPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as SecondBrainData;
    // Defensive defaults — a brain written by an older build may miss fields.
    return { ...emptyBrain(sessionId), ...parsed, approval: parsed.approval ?? { status: 'pending' } };
  } catch (err: any) {
    console.error(`[secondBrain] corrupt brain for session=${sessionId}: ${err.message}`);
    return null;
  }
}

/** Read the brain, creating it if it does not exist yet. */
export function getOrCreateBrain(sessionId: string): SecondBrainData {
  const existing = readBrain(sessionId);
  if (existing) return existing;
  const fresh = emptyBrain(sessionId);
  writeBrain(fresh);
  return fresh;
}

function writeBrain(brain: SecondBrainData): SecondBrainData {
  brain.lastUpdated = new Date().toISOString();
  const dir = contextDir(brain.sessionId);
  ensureDir(dir);
  fs.writeFileSync(secondBrainJsonPath(brain.sessionId), JSON.stringify(brain, null, 2), 'utf-8');
  fs.writeFileSync(secondBrainMdPath(brain.sessionId), renderMarkdown(brain), 'utf-8');
  return brain;
}

/** Apply a mutation to the brain and persist both files. */
export function updateBrain(
  sessionId: string,
  mutate: (brain: SecondBrainData) => void
): SecondBrainData {
  const brain = getOrCreateBrain(sessionId);
  mutate(brain);
  return writeBrain(brain);
}

/** Raw markdown content — this is what gets injected into every LLM prompt. */
export function readMarkdown(sessionId: string): string | null {
  const p = secondBrainMdPath(sessionId);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  const brain = readBrain(sessionId);
  return brain ? renderMarkdown(brain) : null;
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/** Called when the first document is uploaded. Idempotent. */
export function initSecondBrain(
  sessionId: string,
  opts: { projectName?: string; documents?: string[] } = {}
): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    if (opts.projectName && brain.projectName === 'Untitled Project') {
      brain.projectName = opts.projectName;
    }
    for (const doc of opts.documents ?? []) {
      if (!brain.sourceDocuments.includes(doc)) brain.sourceDocuments.push(doc);
    }
  });
}

export function recordDocuments(sessionId: string, documents: string[]): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    for (const doc of documents) {
      if (!brain.sourceDocuments.includes(doc)) brain.sourceDocuments.push(doc);
    }
  });
}

export function setProjectName(sessionId: string, projectName: string): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    if (projectName && projectName.trim()) brain.projectName = projectName.trim();
  });
}

/** Store the AI's structured understanding of the documents. */
export function recordUnderstanding(
  sessionId: string,
  understanding: ProjectUnderstanding,
  confidenceScore: number
): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.documentUnderstanding = renderUnderstanding(understanding);
    brain.confidenceScore = confidenceScore;
    brain.assumptions = dedupe(understanding.assumptions ?? []);
    brain.openItems = dedupe([
      ...(understanding.scope?.unclear ?? []),
      ...brain.openItems,
    ]);
  });
}

/**
 * Record one or more answers. Answers are keyed by question id + cycle so the same
 * question answered in the same cycle is updated rather than duplicated.
 */
export function recordAnswers(sessionId: string, records: QnaRecord[]): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    for (const rec of records) {
      if (!rec.answer || !String(rec.answer).trim()) continue;
      const idx = brain.qna.findIndex((q) => q.cycle === rec.cycle && q.questionId === rec.questionId);
      if (idx >= 0) brain.qna[idx] = rec;
      else brain.qna.push(rec);
    }
    brain.qna.sort((a, b) => a.cycle - b.cycle || a.questionId.localeCompare(b.questionId));
    brain.confirmedFacts = deriveConfirmedFacts(brain);
  });
}

/** Bump the cycle counter after a question round has been issued to the user. */
export function incrementCycle(sessionId: string): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.cycleCount = Math.min(brain.cycleCount + 1, MAX_QUESTION_CYCLES);
  });
}

export function setConfidence(sessionId: string, confidenceScore: number): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.confidenceScore = confidenceScore;
  });
}

export function recordHumanInput(sessionId: string, text: string): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.humanInputs.push({ text: text.trim(), at: new Date().toISOString() });
  });
}

export function recordUnderstandingSummary(
  sessionId: string,
  summary: UnderstandingSummary
): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.understandingSummary = { ...summary, generatedAt: new Date().toISOString() };
    brain.confidenceScore = summary.confidenceScore;
    if (summary.confirmedFacts.length > 0) {
      brain.confirmedFacts = dedupe([...deriveConfirmedFacts(brain), ...summary.confirmedFacts]);
    }
    if (summary.assumptions.length > 0) brain.assumptions = dedupe(summary.assumptions);
    brain.openItems = dedupe(summary.openItems);
  });
}

export function approve(sessionId: string): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.approval = { status: 'approved', approvedAt: new Date().toISOString() };
  });
}

export function recordGeneratedStories(
  sessionId: string,
  result: EpicStoriesResult
): SecondBrainData {
  return updateBrain(sessionId, (brain) => {
    brain.generatedStories = result;
  });
}

// ── Derived views ──────────────────────────────────────────────────────────────

export function getStatus(sessionId: string): SecondBrainStatus {
  const brain = readBrain(sessionId);
  if (!brain) {
    return {
      exists: false,
      cycleCount: 0,
      maxCycles: MAX_QUESTION_CYCLES,
      questionsExhausted: false,
      approvalStatus: 'pending',
      hasSummary: false,
      hasStories: false,
      confidenceScore: 0,
    };
  }
  return {
    exists: true,
    cycleCount: brain.cycleCount,
    maxCycles: MAX_QUESTION_CYCLES,
    questionsExhausted: brain.cycleCount >= MAX_QUESTION_CYCLES,
    approvalStatus: brain.approval.status,
    approvedAt: brain.approval.approvedAt,
    hasSummary: Boolean(brain.understandingSummary),
    hasStories: Boolean(brain.generatedStories),
    confidenceScore: brain.confidenceScore,
  };
}

/** Normalized text of every already-answered question, for dedupe checks. */
export function answeredQuestionKeys(sessionId: string): Set<string> {
  const brain = readBrain(sessionId);
  const keys = new Set<string>();
  for (const q of brain?.qna ?? []) keys.add(normalizeQuestion(q.question));
  return keys;
}

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|is|are|do|does|will|would|should|what|which|who|whom|how|why|when|of|for|to|in|on|this|that|your|you|please|specify|provide)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── LLM context block ──────────────────────────────────────────────────────────

/**
 * The standard block prepended to EVERY LLM prompt in the system. It carries the
 * full second brain plus the non-negotiable rules that keep the agent from
 * re-asking, contradicting, or inventing.
 */
export function buildSecondBrainContextBlock(sessionId: string): string {
  const md = readMarkdown(sessionId);
  if (!md) return '';

  const brain = readBrain(sessionId);
  const exhausted = (brain?.cycleCount ?? 0) >= MAX_QUESTION_CYCLES;

  return `
=== CONTEXT FROM SECOND BRAIN (SINGLE SOURCE OF TRUTH) ===
${md}
=== END SECOND BRAIN ===

RULES YOU MUST FOLLOW:
1. Never ask a question whose answer is in the Second Brain above.
2. Never assume anything not stated in the documents or the Second Brain.
3. Never contradict an answer already confirmed by the user in the Q&A History.
4. If something is unclear and the maximum question cycles have been reached, record it as an assumption or open item — do NOT ask.
${exhausted ? '5. The maximum of ' + MAX_QUESTION_CYCLES + ' question cycles has been REACHED. You may not ask any further questions.' : '5. Question cycles used: ' + (brain?.cycleCount ?? 0) + ' of ' + MAX_QUESTION_CYCLES + '.'}
`.trim();
}

// ── Rendering ──────────────────────────────────────────────────────────────────

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = (item ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Every answered question is, by definition, a fact the user confirmed. These are
 * merged with any facts the approval summary adds.
 */
function deriveConfirmedFacts(brain: SecondBrainData): string[] {
  const fromQna = brain.qna.map((q) => `${stripTrailingPunctuation(q.question)} → ${q.answer}`);
  const manual = brain.understandingSummary?.confirmedFacts ?? [];
  return dedupe([...fromQna, ...manual]);
}

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[?:.\s]+$/, '');
}

function renderUnderstanding(u: ProjectUnderstanding): string {
  const list = (items: string[]) =>
    items && items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- _None identified_';

  return [
    `**Project Overview:** ${u.projectOverview}`,
    '',
    `**Business Objective:** ${u.businessObjective}`,
    '',
    '**In Scope:**',
    list(u.scope?.inScope ?? []),
    '',
    '**Out of Scope:**',
    list(u.scope?.outOfScope ?? []),
    '',
    '**Unclear Scope:**',
    list(u.scope?.unclear ?? []),
    '',
    `**Stakeholders:** ${(u.stakeholders ?? []).join(', ') || 'NOT FOUND in documents'}`,
    `**Timeline:** ${u.timeline}`,
    `**Tech Stack:** ${u.techStack}`,
    '',
    '**Deliverables:**',
    list(u.deliverables ?? []),
    '',
    '**Constraints:**',
    list(u.constraints ?? []),
    '',
    '**Risks:**',
    list(u.risks ?? []),
    '',
    '**Dependencies:**',
    list(u.dependencies ?? []),
  ].join('\n');
}

export function renderMarkdown(brain: SecondBrainData): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`session_id: ${brain.sessionId}`);
  lines.push(`project_name: ${brain.projectName}`);
  lines.push(`created_at: ${brain.createdAt}`);
  lines.push(`last_updated: ${brain.lastUpdated}`);
  lines.push(`question_cycles_used: ${brain.cycleCount} of ${MAX_QUESTION_CYCLES}`);
  lines.push(`confidence_score: ${brain.confidenceScore}`);
  lines.push(`approval_status: ${brain.approval.status}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${brain.projectName} — Project Second Brain`);
  lines.push('');

  lines.push('## Source Documents');
  lines.push('');
  if (brain.sourceDocuments.length === 0) lines.push('_No documents uploaded yet._');
  else for (const doc of brain.sourceDocuments) lines.push(`- ${doc}`);
  lines.push('');

  lines.push('## Document Understanding');
  lines.push('');
  lines.push(brain.documentUnderstanding || '_Not analyzed yet._');
  lines.push('');

  lines.push('## Q&A History (Complete Chain)');
  lines.push('');
  if (brain.qna.length === 0) {
    lines.push('_No questions answered yet._');
    lines.push('');
  } else {
    const cycles = [...new Set(brain.qna.map((q) => q.cycle))].sort((a, b) => a - b);
    for (const cycle of cycles) {
      lines.push(`### Cycle ${cycle}`);
      lines.push('');
      for (const q of brain.qna.filter((r) => r.cycle === cycle)) {
        lines.push(`**${q.questionId} — Q:** ${q.question}`);
        lines.push(`Category: ${q.category} / ${q.priority}`);
        lines.push(`**A:** ${q.answer}`);
        lines.push(`Answered at: ${q.answeredAt}`);
        lines.push('');
      }
    }
  }

  lines.push('## Confirmed Facts');
  lines.push('');
  const facts = deriveConfirmedFacts(brain);
  if (facts.length === 0) lines.push('_No facts confirmed by the user yet._');
  else for (const fact of facts) lines.push(`- ${fact}`);
  lines.push('');

  lines.push('## Assumptions (AI assumed — not confirmed by the user)');
  lines.push('');
  if (brain.assumptions.length === 0) lines.push('_None._');
  else for (const a of brain.assumptions) lines.push(`- ${a}`);
  lines.push('');

  lines.push('## Open Items');
  lines.push('');
  if (brain.openItems.length === 0) lines.push('_None outstanding._');
  else for (const item of brain.openItems) lines.push(`- ${item}`);
  lines.push('');

  lines.push('## Human Additional Input');
  lines.push('');
  if (brain.humanInputs.length === 0) lines.push('_None provided._');
  else
    for (const input of brain.humanInputs) {
      lines.push(`### Added at ${input.at}`);
      lines.push('');
      lines.push(input.text);
      lines.push('');
    }
  lines.push('');

  lines.push('## Human Approval');
  lines.push('');
  lines.push(`Status: ${brain.approval.status === 'approved' ? 'Approved' : 'Pending'}`);
  lines.push(`Approved at: ${brain.approval.approvedAt ?? '—'}`);
  lines.push('');

  if (brain.understandingSummary) {
    const s = brain.understandingSummary;
    lines.push('## Understanding Summary (presented for approval)');
    lines.push('');
    lines.push(`**Overview:** ${s.projectOverview}`);
    lines.push('');
    lines.push(`**Confidence:** ${s.confidenceScore}%  |  **Ready to generate:** ${s.readyToGenerate ? 'Yes' : 'No'}`);
    lines.push('');
  }

  if (brain.generatedStories) {
    const { epic, stories, generatedAt, totalStoryPoints } = brain.generatedStories;
    lines.push('## Generated Stories');
    lines.push('');
    lines.push(`Generated at: ${generatedAt}`);
    lines.push('');
    lines.push(`### Epic: ${epic.title}`);
    lines.push('');
    lines.push(epic.description);
    lines.push('');
    lines.push(`**Business Value:** ${epic.businessValue}`);
    lines.push('');
    lines.push('**Epic Acceptance Criteria:**');
    for (const ac of epic.acceptanceCriteria) lines.push(`- ${ac}`);
    lines.push('');
    lines.push(`### User Stories (${stories.length} stories, ${totalStoryPoints} points)`);
    lines.push('');
    for (const s of stories) {
      lines.push(`#### ${s.id} — ${s.title}`);
      lines.push(`${s.userStory}`);
      lines.push(`Points: ${s.storyPoints} | Priority: ${s.priority} | Component: ${s.component} | Labels: ${s.labels.join(', ')}`);
      lines.push('Acceptance Criteria:');
      for (const ac of s.acceptanceCriteria) lines.push(`- ${ac}`);
      lines.push('');
    }
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify({ epic, stories }, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
