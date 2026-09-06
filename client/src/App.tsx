import { useState, useCallback } from 'react';
import type { Project } from './types';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Home from './pages/Home';
import Connections from './pages/Connections';
import RequirementBuilder from './pages/RequirementBuilder';
import ArchitectureBuilder from './pages/ArchitectureBuilder';
import DesignBuilder from './pages/DesignBuilder';
import TestBuilder from './pages/TestBuilder';
import ReleaseBuilder from './pages/ReleaseBuilder';

type Page =
  | { kind: 'dashboard' }
  | { kind: 'connections' }
  | { kind: 'project-detail'; project: Project }
  | { kind: 'project-intake'; project: Project }
  | { kind: 'requirements'; project: Project; reqId?: string }
  | { kind: 'architecture'; project: Project; requirementId: string; archId?: string }
  | { kind: 'design'; project: Project; requirementId: string; architectureId: string; designId?: string }
  | { kind: 'test'; project: Project; requirementId: string; architectureId: string; designId: string; testId?: string }
  | { kind: 'release'; project: Project; requirementId: string; architectureId: string; designId: string; testId: string; releaseId?: string };

function getSessionId(): string {
  let id = sessionStorage.getItem('aidlc-session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('aidlc-session', id);
  }
  return id;
}

export default function App() {
  const [page, setPage] = useState<Page>({ kind: 'dashboard' });
  const [sessionId] = useState(getSessionId);

  const navTab = page.kind === 'connections' ? 'connections' : 'projects';

  const goToDashboard = useCallback(() => setPage({ kind: 'dashboard' }), []);
  const goToConnections = useCallback(() => setPage({ kind: 'connections' }), []);

  const openProject = useCallback((project: Project) => {
    setPage({ kind: 'project-detail', project });
  }, []);

  const startIntake = useCallback((project: Project) => {
    setPage({ kind: 'project-intake', project });
  }, []);

  const openRequirements = useCallback((project: Project, reqId?: string) => {
    setPage({ kind: 'requirements', project, reqId });
  }, []);

  const openArchitecture = useCallback((project: Project, requirementId: string, archId?: string) => {
    setPage({ kind: 'architecture', project, requirementId, archId });
  }, []);

  const openDesign = useCallback((project: Project, requirementId: string, architectureId: string, designId?: string) => {
    setPage({ kind: 'design', project, requirementId, architectureId, designId });
  }, []);

  const openTest = useCallback((project: Project, requirementId: string, architectureId: string, designId: string, testId?: string) => {
    setPage({ kind: 'test', project, requirementId, architectureId, designId, testId });
  }, []);

  const openRelease = useCallback((project: Project, requirementId: string, architectureId: string, designId: string, testId: string, releaseId?: string) => {
    setPage({ kind: 'release', project, requirementId, architectureId, designId, testId, releaseId });
  }, []);

  const projectSessionId = (project: Project) => project.sessionId || sessionId;

  if (page.kind === 'release') {
    return (
      <ReleaseBuilder
        projectId={page.project.id}
        sessionId={projectSessionId(page.project)}
        requirementId={page.requirementId}
        architectureId={page.architectureId}
        designId={page.designId}
        testId={page.testId}
        releaseId={page.releaseId}
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
      />
    );
  }

  if (page.kind === 'test') {
    return (
      <TestBuilder
        projectId={page.project.id}
        sessionId={projectSessionId(page.project)}
        requirementId={page.requirementId}
        architectureId={page.architectureId}
        designId={page.designId}
        testId={page.testId}
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
        onGenerateReleaseNotes={(reqId, archId, desId, testId) =>
          openRelease(page.project, reqId, archId, desId, testId)
        }
      />
    );
  }

  if (page.kind === 'design') {
    return (
      <DesignBuilder
        projectId={page.project.id}
        sessionId={projectSessionId(page.project)}
        requirementId={page.requirementId}
        architectureId={page.architectureId}
        designId={page.designId}
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
        onGenerateTestCases={(reqId, archId, desId) =>
          openTest(page.project, reqId, archId, desId)
        }
      />
    );
  }

  if (page.kind === 'architecture') {
    return (
      <ArchitectureBuilder
        projectId={page.project.id}
        sessionId={projectSessionId(page.project)}
        requirementId={page.requirementId}
        architectureId={page.archId}
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
        onGenerateDesign={(reqId, archId) =>
          openDesign(page.project, reqId, archId)
        }
      />
    );
  }

  if (page.kind === 'requirements') {
    return (
      <RequirementBuilder
        sessionId={projectSessionId(page.project)}
        projectId={page.project.id}
        requirementId={page.reqId}
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
        onGenerateArchitecture={(reqId) =>
          setPage({ kind: 'architecture', project: page.project, requirementId: reqId })
        }
      />
    );
  }

  if (page.kind === 'project-intake') {
    return (
      <Home
        onNavigateToRequirements={() =>
          setPage({ kind: 'requirements', project: page.project })
        }
        onBack={() => setPage({ kind: 'project-detail', project: page.project })}
        projectName={page.project.name}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <nav className="bg-navy text-white border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1
              className="text-lg font-bold tracking-tight cursor-pointer py-3"
              onClick={goToDashboard}
            >
              AIDLC
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={goToDashboard}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  navTab === 'projects' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Projects
                {navTab === 'projects' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
              <button
                onClick={goToConnections}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  navTab === 'connections' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Connections
                {navTab === 'connections' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            {sessionId.slice(0, 8)}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {page.kind === 'dashboard' && (
          <Dashboard
            sessionId={sessionId}
            onOpenProject={openProject}
            onNewRequirement={startIntake}
          />
        )}

        {page.kind === 'connections' && <Connections />}

        {page.kind === 'project-detail' && (
          <ProjectDetail
            project={page.project}
            sessionId={projectSessionId(page.project)}
            onBack={goToDashboard}
            onOpenRequirement={(reqId) => openRequirements(page.project, reqId)}
            onNewRequirement={() => startIntake(page.project)}
            onOpenArchitecture={(reqId, archId) => openArchitecture(page.project, reqId, archId)}
            onOpenDesign={(reqId, archId, desId) => openDesign(page.project, reqId, archId, desId)}
            onOpenTest={(reqId, archId, desId, testId) => openTest(page.project, reqId, archId, desId, testId)}
            onOpenRelease={(reqId, archId, desId, testId, relId) => openRelease(page.project, reqId, archId, desId, testId, relId)}
          />
        )}
      </main>
    </div>
  );
}
