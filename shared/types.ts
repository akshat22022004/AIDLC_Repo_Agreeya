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
  currentStep: 'upload' | 'analyzing' | 'understanding' | 'questions' | 'approval' | 'approved' | 'refined';
  /** Number of question cycles already issued to the user. Hard capped at MAX_QUESTION_CYCLES. */
  cycleCount: number;
  /** Human-in-the-loop gate. Requirements/Excel generation is blocked until 'approved'. */
  approvalStatus: 'pending' | 'approved';
  approvedAt?: string;
}

// ── Second Brain / Human Approval Types ──

export interface QnaRecord {
  cycle: number;
  questionId: string;
  question: string;
  category: string;
  priority: string;
  answer: string;
  answeredAt: string;
}

export interface HumanInput {
  text: string;
  at: string;
}

export interface UnderstandingSummary {
  projectOverview: string;
  confirmedFacts: string[];
  assumptions: string[];
  openItems: string[];
  readyToGenerate: boolean;
  confidenceScore: number;
  generatedAt?: string;
}

export interface SecondBrainData {
  sessionId: string;
  projectName: string;
  createdAt: string;
  lastUpdated: string;
  sourceDocuments: string[];
  documentUnderstanding: string;
  confidenceScore: number;
  cycleCount: number;
  qna: QnaRecord[];
  confirmedFacts: string[];
  assumptions: string[];
  openItems: string[];
  humanInputs: HumanInput[];
  approval: {
    status: 'pending' | 'approved';
    approvedAt?: string;
  };
  understandingSummary?: UnderstandingSummary;
  generatedStories?: EpicStoriesResult;
}

export interface SecondBrainStatus {
  exists: boolean;
  cycleCount: number;
  maxCycles: number;
  questionsExhausted: boolean;
  approvalStatus: 'pending' | 'approved';
  approvedAt?: string;
  hasSummary: boolean;
  hasStories: boolean;
  confidenceScore: number;
}

// ── Epic & User Stories (Excel Report) ──

export interface Epic {
  title: string;
  description: string;
  businessValue: string;
  acceptanceCriteria: string[];
}

export interface UserStory {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: 'High' | 'Medium' | 'Low';
  epic: string;
  labels: string[];
  component: string;
  status: string;
}

export interface EpicStoriesResult {
  epic: Epic;
  stories: UserStory[];
  generatedAt: string;
  totalStoryPoints: number;
  downloadUrl?: string;
  filePath?: string;
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

// ── Ticket Integration Types ──

export interface TicketProviderConnection {
  provider: 'azure-devops' | 'jira';
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  organizationUrl?: string;
  cloudId?: string;
  userName?: string;
  orgName?: string;
}

export interface TicketProject {
  id: string;
  name: string;
  key?: string;
  url?: string;
}

export interface Ticket {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
  status: string;
  priority: string;
  assignee?: string;
  sprint?: string;
  storyPoints?: number;
  acceptanceCriteria?: string;
  labels: string[];
  parentId?: string;
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story' | 'task' | 'subtask';
  priority: string;
  labels?: string[];
  storyPoints?: number;
  acceptanceCriteria?: string;
  parentId?: string;
  projectId: string;
}

export interface CreatedTicket {
  id: string;
  key: string;
  title: string;
  type: string;
  url: string;
}

export interface TicketFilter {
  type?: string;
  status?: string;
  sprint?: string;
  assignee?: string;
}

export interface TicketHierarchyNode {
  tempId: string;
  ticket: CreateTicketInput;
  children: TicketHierarchyNode[];
  createdTicket?: CreatedTicket;
  status: 'pending' | 'creating' | 'created' | 'failed';
  error?: string;
}

export interface DuplicateCandidate {
  ticket: Ticket;
  similarity: number;
  reason: string;
}

export interface TicketCreationSummary {
  epics: number;
  features: number;
  stories: number;
  tasks: number;
  total: number;
  created: CreatedTicket[];
  failed: { title: string; error: string }[];
}

// ── Requirements Generator Types ──

export type SectionStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'skipped';

export interface SectionVersion {
  version: number;
  content: string;
  generatedAt: string;
  feedback?: string;
  status: 'superseded' | 'current' | 'approved';
  approvedAt?: string;
}

export interface RequirementSection {
  number: number;
  title: string;
  key: string;
  status: SectionStatus;
  content: string;
  versions: SectionVersion[];
}

export interface RequirementDoc {
  id: string;
  sessionId: string;
  projectName: string;
  generatedDate: string;
  status: 'in-progress' | 'approved' | 'finalized';
  sourceDocuments: string[];
  linkedTickets: string[];
  confidenceScore: number;
  sections: RequirementSection[];
}

export interface GenerateSectionRequest {
  sectionNumber: number;
  feedback?: string;
}

export interface GenerateSectionResponse {
  sectionNumber: number;
  content: string;
  version: number;
}

// ── Git Integration Types (Phase 4) ──

export type GitProvider = 'github' | 'gitlab' | 'azure-repos';

export interface GitProviderConnection {
  provider: GitProvider;
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  userName?: string;
  orgName?: string;
  avatarUrl?: string;
}

export interface Repo {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
  private: boolean;
}

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

export interface FileCommit {
  path: string;
  content: string;
}

export interface CommitResult {
  sha: string;
  url: string;
  message: string;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  status: 'open' | 'merged' | 'closed';
}

export interface GitRepoConfig {
  provider: GitProvider;
  repoId: string;
  repoName: string;
  branch: string;
  createAidlcBranch: boolean;
  autoCreatePR: boolean;
  basePath: string;
}

export interface GitCommitHistoryEntry {
  version: string;
  sha: string;
  date: string;
  message: string;
}

// ── Project Dashboard Types (Phase 5) ──

export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  client?: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;

  sessionId?: string;

  ticketProvider?: 'azure-devops' | 'jira';
  ticketProjectId?: string;
  gitProvider?: GitProvider;
  gitRepoId?: string;
  gitBranch?: string;
  gitConfig?: GitRepoConfig;

  requirementCount: number;
  approvedCount: number;
  ticketCount: number;
  lastActivity: string;
}

export interface ProjectStats {
  totalProjects: number;
  activeRequirements: number;
  connectedTickets: number;
  pendingApprovals: number;
}

// ── Architecture Types ──

export type ArchSectionStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'skipped';

export interface ArchSectionVersion {
  version: number;
  content: string;
  generatedAt: string;
  feedback?: string;
  status: 'superseded' | 'current' | 'approved';
  approvedAt?: string;
}

export interface ArchitectureSection {
  number: number;
  title: string;
  key: string;
  status: ArchSectionStatus;
  content: string;
  versions: ArchSectionVersion[];
}

export interface ArchitectureDoc {
  id: string;
  projectId: string;
  requirementId: string;
  projectName: string;
  generatedDate: string;
  status: 'draft' | 'in-progress' | 'finalized';
  sections: ArchitectureSection[];
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureSummary {
  id: string;
  requirementId: string;
  title: string;
  status: string;
  sectionProgress: string;
  createdAt: string;
}

// ── Design Types ──

export type DesignSectionStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'skipped';

export interface DesignSectionVersion {
  version: number;
  content: string;
  generatedAt: string;
  feedback?: string;
  status: 'superseded' | 'current' | 'approved';
  approvedAt?: string;
}

export interface DesignSection {
  number: number;
  title: string;
  key: string;
  status: DesignSectionStatus;
  content: string;
  versions: DesignSectionVersion[];
}

export interface DesignDoc {
  id: string;
  projectId: string;
  requirementId: string;
  architectureId: string;
  projectName: string;
  generatedDate: string;
  status: 'draft' | 'in-progress' | 'finalized';
  sections: DesignSection[];
  createdAt: string;
  updatedAt: string;
}

export interface DesignSummary {
  id: string;
  requirementId: string;
  architectureId: string;
  title: string;
  status: string;
  sectionProgress: string;
  createdAt: string;
}

// ── Test Types ──

export type TestSectionStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'skipped';

export interface TestSectionVersion {
  version: number;
  content: string;
  generatedAt: string;
  feedback?: string;
  status: 'superseded' | 'current' | 'approved';
  approvedAt?: string;
}

export interface TestSection {
  number: number;
  title: string;
  key: string;
  status: TestSectionStatus;
  content: string;
  versions: TestSectionVersion[];
}

export interface TestDoc {
  id: string;
  projectId: string;
  requirementId: string;
  architectureId: string;
  designId: string;
  projectName: string;
  generatedDate: string;
  status: 'draft' | 'in-progress' | 'finalized';
  sections: TestSection[];
  createdAt: string;
  updatedAt: string;
}

export interface TestSummary {
  id: string;
  requirementId: string;
  architectureId: string;
  designId: string;
  title: string;
  status: string;
  sectionProgress: string;
  createdAt: string;
}

// ── Release Types ──

export type ReleaseSectionStatus = 'pending' | 'generating' | 'draft' | 'approved' | 'skipped';

export interface ReleaseSectionVersion {
  version: number;
  content: string;
  generatedAt: string;
  feedback?: string;
  status: 'superseded' | 'current' | 'approved';
  approvedAt?: string;
}

export interface ReleaseSection {
  number: number;
  title: string;
  key: string;
  status: ReleaseSectionStatus;
  content: string;
  versions: ReleaseSectionVersion[];
}

export interface ReleaseDoc {
  id: string;
  projectId: string;
  requirementId: string;
  architectureId: string;
  designId: string;
  testId: string;
  projectName: string;
  generatedDate: string;
  status: 'draft' | 'in-progress' | 'finalized';
  sections: ReleaseSection[];
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseSummary {
  id: string;
  requirementId: string;
  architectureId: string;
  designId: string;
  testId: string;
  title: string;
  status: string;
  sectionProgress: string;
  createdAt: string;
}
