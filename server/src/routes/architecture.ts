import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getLLM } from '../state.js';
import { getArchSectionPrompt, type ArchSectionContext } from '../prompts/architectureSections/index.js';
import {
  createArchitecture,
  getArchitecture,
  getArchitecturesForProject,
  updateArchSectionContent,
  approveArchSection,
  skipArchSection,
  revertArchSection,
  finalizeArchitecture,
  assembleArchitecture,
  toSummary,
} from '../services/architectureStore.js';
import { getRequirement } from '../services/requirementStore.js';
import { assembleRequirement } from '../prompts/sections/assembler.js';
import { getProject } from '../services/projectStore.js';

const router = Router();

function getRequirementContent(projectId: string, requirementId: string): string | null {
  const project = getProject(projectId);
  if (!project) return null;

  const sessionId = project.sessionId;
  if (!sessionId) return null;

  const doc = getRequirement(sessionId, requirementId);
  if (!doc) return null;

  return assembleRequirement(doc);
}

// List architectures for a project
router.get('/:projectId/list', (req, res) => {
  try {
    const docs = getArchitecturesForProject(req.params.projectId);
    const summaries = docs.map(toSummary);
    res.json({ success: true, data: summaries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize a new architecture from a requirement
router.post('/:projectId/init', (req, res) => {
  try {
    const { projectId } = req.params;
    const { requirementId } = req.body;

    if (!requirementId) {
      res.status(400).json({ success: false, error: 'requirementId is required' });
      return;
    }

    const project = getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const reqContent = getRequirementContent(projectId, requirementId);
    if (!reqContent) {
      res.status(404).json({ success: false, error: 'Requirement not found or not accessible' });
      return;
    }

    const existing = getArchitecturesForProject(projectId)
      .find((a) => a.requirementId === requirementId && a.status !== 'finalized');

    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const doc = createArchitecture(projectId, requirementId, project.name);
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get architecture by ID
router.get('/:projectId/:archId', (req, res) => {
  const doc = getArchitecture(req.params.projectId, req.params.archId);
  if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }
  res.json({ success: true, data: doc });
});

// Generate a section
router.post('/:projectId/:archId/generate', async (req, res) => {
  try {
    const { projectId, archId } = req.params;
    const { sectionNumber, feedback } = req.body;

    const doc = getArchitecture(projectId, archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const reqContent = getRequirementContent(projectId, doc.requirementId);
    if (!reqContent) {
      res.status(404).json({ success: false, error: 'Source requirement not found' });
      return;
    }

    const llm = getLLM();
    if (!llm) { res.status(500).json({ success: false, error: 'No LLM configured' }); return; }

    const section = doc.sections.find((s) => s.number === sectionNumber);
    if (!section) { res.status(400).json({ success: false, error: 'Invalid section number' }); return; }

    section.status = 'generating';

    const previousSections: Record<string, string> = {};
    for (const s of doc.sections) {
      if (s.status === 'approved' && s.content) {
        previousSections[String(s.number)] = s.content;
      }
    }

    const project = getProject(projectId);

    const context: ArchSectionContext = {
      requirementContent: reqContent,
      previousSections,
      userFeedback: feedback || undefined,
      projectName: project?.name || doc.projectName,
      requirementId: doc.requirementId,
      architectureId: doc.id,
    };

    const prompt = getArchSectionPrompt(sectionNumber, context);
    const content = await llm.analyze(prompt, '');

    const updated = updateArchSectionContent(doc, sectionNumber, content.trim(), feedback);
    const updatedSection = updated.sections.find((s) => s.number === sectionNumber)!;

    res.json({
      success: true,
      data: {
        sectionNumber,
        content: updatedSection.content,
        version: updatedSection.versions.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Approve a section
router.post('/:projectId/:archId/approve', (req, res) => {
  try {
    const { projectId, archId } = req.params;
    const { sectionNumber, content } = req.body;

    const doc = getArchitecture(projectId, archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const updated = approveArchSection(doc, sectionNumber, content);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Skip a section
router.post('/:projectId/:archId/skip', (req, res) => {
  try {
    const { projectId, archId } = req.params;
    const { sectionNumber } = req.body;

    const doc = getArchitecture(projectId, archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const updated = skipArchSection(doc, sectionNumber);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revert a section
router.post('/:projectId/:archId/revert', (req, res) => {
  try {
    const { projectId, archId } = req.params;
    const { sectionNumber, version } = req.body;

    const doc = getArchitecture(projectId, archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const updated = revertArchSection(doc, sectionNumber, version);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Assemble full architecture
router.get('/:projectId/:archId/assemble', (req, res) => {
  try {
    const doc = getArchitecture(req.params.projectId, req.params.archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const markdown = assembleArchitecture(doc);
    res.json({ success: true, data: { markdown, doc } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download as markdown
router.get('/:projectId/:archId/download', (req, res) => {
  try {
    const doc = getArchitecture(req.params.projectId, req.params.archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const markdown = assembleArchitecture(doc);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.id}-architecture-${date}.md"`);
    res.send(markdown);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Finalize architecture
router.post('/:projectId/:archId/finalize', (req, res) => {
  try {
    const doc = getArchitecture(req.params.projectId, req.params.archId);
    if (!doc) { res.status(404).json({ success: false, error: 'Architecture not found' }); return; }

    const { markdown, savedPath } = finalizeArchitecture(doc);

    res.json({
      success: true,
      data: { savedPath, architectureId: doc.id, markdown },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
