import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectStats } from '../types';
import ProjectStatsCards from '../components/ProjectStats';
import ProjectCard from '../components/ProjectCard';
import ProjectForm from '../components/ProjectForm';
import EmptyState from '../components/EmptyState';
import * as api from '../services/api';

interface Props {
  onOpenProject: (project: Project) => void;
  onNewRequirement: (project: Project) => void;
}

export default function Dashboard({ onOpenProject, onNewRequirement }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'lastActivity' | 'name' | 'requirementCount'>('lastActivity');
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    setDeleteError(null);
    try {
      await api.deleteProject(pendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
      // Requirement and approval totals change with the project, so refetch rather
      // than guessing at the new numbers.
      api.getProjectStats().then(setStats).catch(() => {});
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete]);

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
              onDelete={() => { setDeleteError(null); setPendingDelete(project); }}
              deleting={deletingId === project.id}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProjectForm
          onCreated={handleProjectCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Delete project</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Delete <strong className="text-slate-900">{pendingDelete.name}</strong> and everything
                in it? Its documents, project understanding, requirements, architecture, design, test
                and release artifacts are removed permanently.
              </p>
              <p className="text-xs text-slate-400">This cannot be undone.</p>

              {deleteError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletingId !== null}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deletingId ? 'Deleting...' : 'Delete project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
