import type { UploadedFile, AnalysisResult, ClarifyingQuestion, ApiResponse } from '../types';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const body: ApiResponse<T> = await res.json();
  if (!body.success) throw new Error(body.error || 'Unknown error');
  return body.data as T;
}

export async function uploadFiles(sessionId: string, files: File[]): Promise<UploadedFile[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const res = await fetch(`${BASE}/upload/${sessionId}`, { method: 'POST', body: formData });
  return handleResponse<UploadedFile[]>(res);
}

export async function getFiles(sessionId: string): Promise<UploadedFile[]> {
  const res = await fetch(`${BASE}/upload/${sessionId}/files`);
  return handleResponse<UploadedFile[]>(res);
}

export async function analyzeDocuments(sessionId: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/analyze/${sessionId}`, { method: 'POST' });
  return handleResponse<AnalysisResult>(res);
}

export async function getAnalysis(sessionId: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/analyze/${sessionId}`);
  return handleResponse<AnalysisResult>(res);
}

export async function answerQuestion(
  sessionId: string,
  questionId: string,
  answer: string | string[]
): Promise<ClarifyingQuestion> {
  const res = await fetch(`${BASE}/questions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, answer }),
  });
  return handleResponse<ClarifyingQuestion>(res);
}

export async function skipQuestion(
  sessionId: string,
  questionId: string
): Promise<ClarifyingQuestion> {
  const res = await fetch(`${BASE}/questions/${sessionId}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId }),
  });
  return handleResponse<ClarifyingQuestion>(res);
}

export async function importAnswers(
  sessionId: string,
  markdown: string
): Promise<{ importedCount: number; questions: ClarifyingQuestion[] }> {
  const res = await fetch(`${BASE}/questions/${sessionId}/import-answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
  return handleResponse<{ importedCount: number; questions: ClarifyingQuestion[] }>(res);
}

export function getExportQuestionsUrl(sessionId: string): string {
  return `${BASE}/export/${sessionId}/questions`;
}

export function getExportUnderstandingUrl(sessionId: string): string {
  return `${BASE}/export/${sessionId}/understanding`;
}

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<{ reply: string }> {
  const res = await fetch(`${BASE}/chat/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return handleResponse<{ reply: string }>(res);
}
