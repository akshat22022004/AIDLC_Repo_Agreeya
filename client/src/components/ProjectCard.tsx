import type { Project } from '../types';

interface Props {
  project: Project;
  onOpen: () => void;
  onNewRequirement: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  archived: 'bg-slate-100 text-slate-500',
};

export default function ProjectCard({ project, onOpen, onNewRequirement }: Props) {
  const totalSections = 15;
  const approvedPct = project.requirementCount > 0
    ? Math.round((project.approvedCount / project.requirementCount) * 100)
    : 0;

  const lastActivity = project.lastActivity
    ? new Date(project.lastActivity).toLocaleDateString()
    : 'No activity';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-800 truncate">{project.name}</h3>
            {project.client && (
              <p className="text-xs text-slate-500 mt-0.5">{project.client}</p>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${STATUS_STYLES[project.status] || STATUS_STYLES.active}`}>
            {project.status}
          </span>
        </div>

        {project.description && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <span>{project.requirementCount} requirement{project.requirementCount !== 1 ? 's' : ''}</span>
          <span>{project.ticketCount} ticket{project.ticketCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Progress bar */}
        {project.requirementCount > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Approved</span>
              <span>{project.approvedCount}/{project.requirementCount}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${approvedPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Indicators */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={`w-2 h-2 rounded-full ${project.gitProvider ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-slate-400">Git</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={`w-2 h-2 rounded-full ${project.ticketProvider ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-slate-400">Tickets</span>
          </div>
          <span className="text-[10px] text-slate-300 ml-auto">{lastActivity}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onOpen}
            className="flex-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium transition-colors"
          >
            Open
          </button>
          <button
            onClick={onNewRequirement}
            className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors"
          >
            New Req
          </button>
        </div>
      </div>
    </div>
  );
}
