import { Router } from 'express';
import {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  computeProjectStats,
  getProjectStats,
} from '../services/projectStore.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const projects = getAllProjects();
    const enriched = projects.map((p) => ({
      ...p,
      ...computeProjectStats(p),
    }));
    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', (_req, res) => {
  try {
    const stats = getProjectStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:projectId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
  const enriched = { ...project, ...computeProjectStats(project) };
  res.json({ success: true, data: enriched });
});

router.post('/', (req, res) => {
  try {
    const project = createProject(req.body);
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:projectId', (req, res) => {
  try {
    const updated = updateProject(req.params.projectId, req.body);
    if (!updated) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:projectId', (req, res) => {
  try {
    const success = archiveProject(req.params.projectId);
    if (!success) { res.status(404).json({ success: false, error: 'Project not found' }); return; }
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
