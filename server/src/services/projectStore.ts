import fs from 'fs';
import path from 'path';
import type { Project, ProjectStats } from '../types/index.js';

const DATA_DIR = path.resolve('data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const REQUIREMENTS_DIR = path.resolve('requirements');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readProjects(): Project[] {
  ensureDir();
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
}

function writeProjects(projects: Project[]): void {
  ensureDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

export function getAllProjects(): Project[] {
  return readProjects().filter((p) => p.status !== 'archived');
}

export function getProject(projectId: string): Project | null {
  return readProjects().find((p) => p.id === projectId) || null;
}

export function createProject(data: {
  name: string;
  description?: string;
  client?: string;
  sessionId?: string;
  ticketProvider?: string;
  ticketProjectId?: string;
  gitProvider?: string;
  gitRepoId?: string;
  gitBranch?: string;
}): Project {
  const projects = readProjects();
  const now = new Date().toISOString();

  const project: Project = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    client: data.client,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    sessionId: data.sessionId,
    ticketProvider: data.ticketProvider as any,
    ticketProjectId: data.ticketProjectId,
    gitProvider: data.gitProvider as any,
    gitRepoId: data.gitRepoId,
    gitBranch: data.gitBranch,
    requirementCount: 0,
    approvedCount: 0,
    ticketCount: 0,
    lastActivity: now,
  };

  projects.push(project);
  writeProjects(projects);
  return project;
}

export function updateProject(projectId: string, updates: Partial<Project>): Project | null {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;

  const { id, createdAt, ...safeUpdates } = updates as any;
  Object.assign(projects[idx], safeUpdates, { updatedAt: new Date().toISOString() });
  writeProjects(projects);
  return projects[idx];
}

export function archiveProject(projectId: string): boolean {
  const projects = readProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return false;
  project.status = 'archived';
  project.updatedAt = new Date().toISOString();
  writeProjects(projects);
  return true;
}

export function computeProjectStats(project: Project): Partial<Project> {
  let requirementCount = 0;
  let approvedCount = 0;

  if (!fs.existsSync(REQUIREMENTS_DIR)) return { requirementCount: 0, approvedCount: 0 };

  const sessionId = project.sessionId;
  if (!sessionId) return { requirementCount: 0, approvedCount: 0 };

  const files = fs.readdirSync(REQUIREMENTS_DIR).filter((f) => f.startsWith(sessionId) && f.endsWith('.json'));

  for (const file of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(REQUIREMENTS_DIR, file), 'utf-8'));
      requirementCount++;
      if (doc.status === 'finalized' || doc.status === 'approved') approvedCount++;
    } catch {}
  }

  return { requirementCount, approvedCount };
}

export function getProjectStats(): ProjectStats {
  const projects = getAllProjects();
  let activeRequirements = 0;
  let connectedTickets = 0;
  let pendingApprovals = 0;

  if (!fs.existsSync(REQUIREMENTS_DIR)) {
    return { totalProjects: projects.length, activeRequirements: 0, connectedTickets: 0, pendingApprovals: 0 };
  }

  const allReqFiles = fs.readdirSync(REQUIREMENTS_DIR).filter((f) => f.endsWith('.json'));
  for (const file of allReqFiles) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(REQUIREMENTS_DIR, file), 'utf-8'));
      activeRequirements++;
      if (doc.status === 'in-progress') pendingApprovals++;
      if (doc.linkedTickets?.length) connectedTickets += doc.linkedTickets.length;
    } catch {}
  }

  return {
    totalProjects: projects.length,
    activeRequirements,
    connectedTickets,
    pendingApprovals,
  };
}
