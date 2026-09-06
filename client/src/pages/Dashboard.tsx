import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectStats } from '../types';
import ProjectStatsCards from '../components/ProjectStats';
import ProjectCard from '../components/ProjectCard';
import ProjectForm from '../components/ProjectForm';
import EmptyState from '../components/EmptyState';
import * as api from '../services/api';

interface Props {
  sessionId: string;
  onOpenProject: (project: Project) => void;
  onNewRequirement: (project: Project) => void;
}

export default function Dashboard({ sessionId, onOpenProject, onNewRequirement }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'lastActivity' | 'name' | 'requirementCount'>('lastActivity');

  const loadData = useCallback(async () => {
    try {
      const [projectsData, statsData] = await Promise.all([
        api.getProjects_all(),
        api.getProjectStats(),
      ]);
      setProjects(projectsData);
      setStats(statsData);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    setShowForm(false);
    if (stats) {
      setStats({ ...stats, totalProjects: stats.totalProjects + 1 });
    }
  };

  const filtered = projects
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.client || '').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'requirementCount') return b.requirementCount - a.requirementCount;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && <ProjectStatsCards stats={stats} />}

      {/* Search + Filter + New */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="lastActivity">Last Activity</option>
            <option value="name">Name</option>
            <option value="requirementCount">Requirements</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            New Project
          </button>
        </div>
      </div>

      {/* Project Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title={projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          description={
            projects.length === 0
              ? 'Create your first project to get started with AIDLC.'
              : 'Try adjusting your search or filter.'
          }
          actionLabel={projects.length === 0 ? 'Create Project' : undefined}
          onAction={projects.length === 0 ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => onOpenProject(project)}
              onNewRequirement={() => onNewRequirement(project)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProjectForm
          sessionId={sessionId}
          onCreated={handleProjectCreated}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
