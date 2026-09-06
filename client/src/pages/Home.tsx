import { useState, useCallback, useEffect } from 'react';
import type { UploadedFile, AnalysisResult, Ticket } from '../types';
import FileUpload from '../components/FileUpload';
import DocumentList from '../components/DocumentList';
import AgentUnderstanding from '../components/AgentUnderstanding';
import QuestionPanel from '../components/QuestionPanel';
import QuestionDocument from '../components/QuestionDocument';
import ChatInterface from '../components/ChatInterface';
import TicketBrowser from '../components/TicketBrowser';
import TicketWorkflow from '../components/TicketWorkflow';
import * as api from '../services/api';

interface HomeProps {
  onNavigateToRequirements: () => void;
  onBack?: () => void;
  projectName?: string;
}

type Step = 'upload' | 'analyzing' | 'understanding' | 'questions' | 'refined';
type EntryPoint = 'document' | 'ticket';

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: 'upload', label: 'Upload', num: 1 },
  { key: 'analyzing', label: 'Analysis', num: 2 },
  { key: 'understanding', label: 'Understanding', num: 3 },
  { key: 'questions', label: 'Q & A', num: 4 },
  { key: 'refined', label: 'Refined', num: 5 },
];

function getSessionId(): string {
  let id = sessionStorage.getItem('aidlc-session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('aidlc-session', id);
  }
  return id;
}

export default function Home({ onNavigateToRequirements, onBack, projectName }: HomeProps) {
  const [sessionId] = useState(getSessionId);
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisRound, setAnalysisRound] = useState(0);
  const [entryPoint, setEntryPoint] = useState<EntryPoint>('document');
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [ticketSource, setTicketSource] = useState<string | null>(null);

  useEffect(() => {
    async function checkConnections() {
      try {
        const connections = await api.getConnections(sessionId);
        const connected = connections.find((c) => c.connected);
        if (connected) setConnectedProvider(connected.provider!);
      } catch {}
    }
    checkConnections();
  }, [sessionId]);

  const handleFilesUploaded = useCallback(
    (uploaded: UploadedFile[]) => {
      setFiles((prev) => [...prev, ...uploaded]);
      setError(null);
    },
    []
  );

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    setStep('analyzing');
    try {
      const result = await api.analyzeDocuments(sessionId);
      setAnalysis(result);
      setAnalysisRound((r) => r + 1);
      setStep('understanding');
    } catch (err: any) {
      setError(err.message);
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId]);

  const handleQuestionsUpdated = useCallback((updated: AnalysisResult) => {
    setAnalysis(updated);
  }, []);

  const handleReanalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    setStep('analyzing');
    try {
      const result = await api.analyzeDocuments(sessionId);
      setAnalysis(result);
      setAnalysisRound((r) => r + 1);
      setStep(result.confidenceScore >= 90 ? 'refined' : 'understanding');
    } catch (err: any) {
      setError(err.message);
      setStep('understanding');
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId]);

  const handleWorkOnTicket = useCallback(async (ticket: Ticket) => {
    setError(null);
    try {
      await api.workOnTicket(sessionId, connectedProvider!, ticket.id);
      setTicketSource(ticket.key);
      setFiles((prev) => [
        ...prev,
        {
          id: `ticket-${ticket.key}`,
          originalName: `${ticket.key}: ${ticket.title}`,
          mimeType: 'text/plain',
          size: 0,
          status: 'ready',
        },
      ]);
      setEntryPoint('document');
      setStep('upload');
    } catch (err: any) {
      setError(err.message);
    }
  }, [sessionId, connectedProvider]);

  const readyFiles = files.filter((f) => f.status === 'ready');
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {projectName ? `${projectName} — Intake` : 'AIDLC'}
              </h1>
              <p className="text-sm text-slate-300 mt-0.5">Document Intake Agent</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono">Session: {sessionId.slice(0, 8)}</div>
        </div>
      </header>

      {/* Entry Point Toggle + Step Indicator */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Entry point toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Entry Point:</span>
            <button
              onClick={() => setEntryPoint('document')}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                entryPoint === 'document'
                  ? 'bg-accent text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              A. Upload Documents
            </button>
            <button
              onClick={() => setEntryPoint('ticket')}
              disabled={!connectedProvider}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                entryPoint === 'ticket'
                  ? 'bg-accent text-white'
                  : connectedProvider
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
            >
              B. Browse Tickets
              {!connectedProvider && <span className="text-xs ml-1">(connect first)</span>}
            </button>
            {ticketSource && (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">
                Working on ticket: {ticketSource}
              </span>
            )}
          </div>

          {/* Step indicator (only for document flow) */}
          {entryPoint === 'document' && (
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => {
                const isActive = s.key === step;
                const isDone = i < stepIndex;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {i > 0 && (
                      <div className={`w-8 h-px ${isDone ? 'bg-accent' : 'bg-slate-200'}`} />
                    )}
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-accent text-white'
                            : isDone
                            ? 'bg-accent/10 text-accent'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? '✓' : s.num}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          isActive ? 'text-slate-900' : isDone ? 'text-accent' : 'text-slate-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm animate-fade-in">
            <strong>Error:</strong> {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}

        {/* Entry Point B: Ticket Browser */}
        {entryPoint === 'ticket' && connectedProvider && (
          <section className="animate-slide-up">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800">Browse Tickets</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Select a ticket to feed into the agent's analysis pipeline
                </p>
              </div>
              <div className="p-6">
                <TicketBrowser
                  sessionId={sessionId}
                  provider={connectedProvider}
                  onWorkOnTicket={handleWorkOnTicket}
                />
              </div>
            </div>
          </section>
        )}

        {/* Entry Point A: Upload */}
        {entryPoint === 'document' && (
          <>
            <section className="animate-slide-up">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800">1. Upload Project Documents</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Upload SOW, requirements, meeting notes, or any project documentation
                  </p>
                </div>
                <div className="p-6">
                  <FileUpload sessionId={sessionId} onFilesUploaded={handleFilesUploaded} />
                  {files.length > 0 && <DocumentList files={files} />}
                  {readyFiles.length > 0 && step === 'upload' && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleAnalyze}
                        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
                      >
                        Analyze Documents ({readyFiles.length} file{readyFiles.length > 1 ? 's' : ''})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Analyzing spinner */}
            {isAnalyzing && (
              <section className="animate-fade-in">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <div className="inline-block w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-700 font-medium">Analyzing your documents...</p>
                  <p className="text-sm text-slate-500 mt-1">
                    The AI agent is reading everything carefully
                  </p>
                </div>
              </section>
            )}

            {/* Step 3: Understanding */}
            {analysis && !isAnalyzing && (
              <section className="animate-slide-up">
                <AgentUnderstanding
                  analysis={analysis}
                  round={analysisRound}
                  onProceedToQuestions={() => setStep('questions')}
                />
              </section>
            )}

            {/* Step 4: Questions */}
            {analysis && (step === 'questions' || step === 'refined') && !isAnalyzing && (
              <section className="animate-slide-up">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">
                        {analysisRound > 1 ? '4. Follow-up Questions' : '4. Clarifying Questions'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Answer these questions to improve the agent's understanding
                      </p>
                    </div>
                    <QuestionDocument sessionId={sessionId} analysis={analysis} onImported={handleQuestionsUpdated} />
                  </div>
                  <div className="p-6">
                    <QuestionPanel
                      sessionId={sessionId}
                      analysis={analysis}
                      onUpdated={handleQuestionsUpdated}
                    />
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={handleReanalyze}
                        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
                      >
                        Re-analyze with Answers
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Step 5: Ticket Creation */}
            {analysis && (step === 'questions' || step === 'refined') && !isAnalyzing && (
              <section className="animate-slide-up">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800">5. Create Tickets</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Generate and create work items in your project management tool
                    </p>
                  </div>
                  <div className="p-6">
                    <TicketWorkflow sessionId={sessionId} analysis={analysis} />
                  </div>
                </div>
              </section>
            )}

            {/* Step 6: Generate Requirements */}
            {analysis && (step === 'questions' || step === 'refined') && !isAnalyzing && (
              <section className="animate-slide-up">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800">6. Generate Requirements</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Build a formal requirements document section-by-section with AI
                    </p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-600 mb-4">
                      Generate a comprehensive 15-section requirement document from your uploaded documents and Q&A answers.
                      You'll review and approve each section individually.
                    </p>
                    <button
                      onClick={onNavigateToRequirements}
                      className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      Open Requirements Builder
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Chat */}
            {analysis && !isAnalyzing && (
              <section className="animate-slide-up">
                <ChatInterface sessionId={sessionId} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
