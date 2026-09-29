import type { PhaseConfig } from './phaseConfig.js';
import { TEST_SECTION_TEMPLATES } from '../prompts/testSections/templates.js';
import { RELEASE_SECTION_TEMPLATES } from '../prompts/releaseSections/templates.js';

/**
 * Phases that exist in the lifecycle and on the Agent Hub, but are not yet wired
 * for the full agent workflow. They are registered so the hub, the progress bar
 * and the phase-ordering logic all know about them; `comingSoon` stops the engine
 * starting one.
 *
 * Promoting one is the exercise described in the phase engine docs: write its
 * question / section / approval prompts, drop `comingSoon`, and it inherits the
 * entire workflow. Their section templates are already real — the existing
 * design/test/release builders use these same templates.
 */

const PLACEHOLDER = 'This phase is not yet available in the phase engine.';

function stub(
  partial: Omit<PhaseConfig, 'questionSystemPrompt' | 'sectionSystemPrompt' | 'approvalSystemPrompt' | 'comingSoon'>
): PhaseConfig {
  return {
    ...partial,
    questionSystemPrompt: PLACEHOLDER,
    sectionSystemPrompt: PLACEHOLDER,
    approvalSystemPrompt: PLACEHOLDER,
    comingSoon: true,
  };
}

/**
 * Developer Handoff — receives requirement + architecture + the UX/UI design package
 * and turns them into what a developer builds from. Its sections are declared so the
 * hub and the design phase's "Proceed" button can describe it; its prompts are not
 * written yet.
 */
const HANDOFF_SECTIONS: { key: string; title: string; description: string }[] = [
  { key: 'api_contracts', title: 'API Contracts', description: 'Request/response contracts for every endpoint the screen definitions call.' },
  { key: 'data_model', title: 'Data Model', description: 'Entities, fields, relationships and constraints behind the screens and APIs.' },
  { key: 'build_sequence', title: 'Build Sequence', description: 'The order in which screens, services and integrations are built, with dependencies.' },
  { key: 'implementation_guide', title: 'Implementation Guide', description: 'Per-screen implementation notes on top of the design system (ShadCN/CDS).' },
  { key: 'coding_standards', title: 'Coding Standards', description: 'Conventions for the codebase: structure, naming, accessibility and testing rules.' },
];

export const handoffPhaseConfig: PhaseConfig = stub({
  id: 'handoff',
  name: 'Developer Handoff Package',
  shortName: 'Handoff',
  icon: '🧩',
  color: 'sky',
  roleOwner: 'Tech Lead + Frontend Lead',
  requiresPhase: 'design',
  intake: 'import',
  maxQuestionsRound1: 6,
  maxQuestionsRound2: 3,
  sections: HANDOFF_SECTIONS.map((s, i) => ({
    number: i + 1,
    key: s.key,
    title: s.title,
    description: s.description,
    format: `## ${i + 1}. ${s.title}`,
  })),
  deliverables: [],
  outputFileName: 'developer-handoff.md',
  docIdPrefix: 'DEV',
});

export const testingPhaseConfig: PhaseConfig = stub({
  id: 'testing',
  name: 'Test Cases',
  shortName: 'Testing',
  icon: '🧪',
  color: 'emerald',
  roleOwner: 'QA Lead',
  requiresPhase: 'handoff',
  intake: 'import',
  maxQuestionsRound1: 6,
  maxQuestionsRound2: 3,
  sections: TEST_SECTION_TEMPLATES.map((t) => ({
    number: t.number,
    key: t.key,
    title: t.title,
    description: t.description,
    format: t.format,
  })),
  deliverables: [],
  outputFileName: 'test-plan.md',
  docIdPrefix: 'TEST',
});

export const releasePhaseConfig: PhaseConfig = stub({
  id: 'release',
  name: 'Release Notes',
  shortName: 'Release',
  icon: '🚀',
  color: 'amber',
  roleOwner: 'Release Manager',
  requiresPhase: 'testing',
  intake: 'import',
  maxQuestionsRound1: 5,
  maxQuestionsRound2: 3,
  sections: RELEASE_SECTION_TEMPLATES.map((t) => ({
    number: t.number,
    key: t.key,
    title: t.title,
    description: t.description,
    format: t.format,
  })),
  deliverables: [],
  outputFileName: 'release-notes.md',
  docIdPrefix: 'REL',
});
