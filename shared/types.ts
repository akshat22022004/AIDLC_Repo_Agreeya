export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'uploading' | 'parsing' | 'ready' | 'error';
  error?: string;
  parsedTextPreview?: string;
}

export interface ProjectUnderstanding {
  projectOverview: string;
  businessObjective: string;
  scope: {
    inScope: string[];
    outOfScope: string[];
    unclear: string[];
  };
  stakeholders: string[];
  timeline: string;
  techStack: string;
  deliverables: string[];
  constraints: string[];
  assumptions: string[];
  risks: string[];
  dependencies: string[];
}

export interface ClarifyingQuestion {
  id: string;
  category: 'scope' | 'timeline' | 'technical' | 'stakeholder' | 'budget' | 'risk' | 'requirement' | 'other';
  question: string;
  context: string;
  priority: 'critical' | 'important' | 'nice-to-have';
  answerType: 'text' | 'single-select' | 'multi-select';
  options?: string[];
  answer?: string | string[];
  status: 'pending' | 'answered' | 'skipped';
}

export interface AnalysisResult {
  understanding: ProjectUnderstanding;
  confidenceScore: number;
  questions: ClarifyingQuestion[];
}

export interface Session {
  id: string;
  createdAt: string;
  files: UploadedFile[];
  analyses: AnalysisResult[];
  currentStep: 'upload' | 'analyzing' | 'understanding' | 'questions' | 'refined';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
