import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { sessions, getLLM } from '../state.js';
import { analyzeDocuments } from '../services/analyzer.js';

const router = Router();

router.post('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const readyFiles = session.files.filter((f) => f.status === 'ready');
    if (readyFiles.length === 0) {
      res.status(400).json({ success: false, error: 'No parsed files available' });
      return;
    }

    const llm = getLLM();
    if (!llm) {
      res.status(500).json({
        success: false,
        error: 'No LLM configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in your .env file.',
      });
      return;
    }
    console.log(`[analyze] session=${sessionId} using LLM adapter: ${llm.name}`);

    session.currentStep = 'analyzing';

    const parsedDir = path.resolve('parsed');
    const contentParts: string[] = [];

    for (const file of readyFiles) {
      const text = await fs.readFile(path.join(parsedDir, `${file.id}.txt`), 'utf-8');
      contentParts.push(`=== FILE: ${file.originalName} ===\n${text}`);
    }

    const fullContent = contentParts.join('\n\n');

    let previousAnswers: string | undefined;
    const seenQuestions = new Set<string>();
    const allAnswered: { question: string; answer: string | string[] }[] = [];
    for (const pastAnalysis of session.analyses) {
      for (const q of pastAnalysis.questions) {
        if (q.status !== 'answered' || q.answer === undefined) continue;
        const key = q.question.trim().toLowerCase();
        if (seenQuestions.has(key)) continue;
        seenQuestions.add(key);
        allAnswered.push({ question: q.question, answer: q.answer });
      }
    }
    if (allAnswered.length > 0) {
      previousAnswers = allAnswered
        .map((q) => `Q: ${q.question}\nA: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}`)
        .join('\n\n');
    }

    const analysis = await analyzeDocuments(llm, fullContent, previousAnswers);
    session.analyses.push(analysis);
    session.currentStep = 'understanding';

    res.json({ success: true, data: analysis });
  } catch (err: any) {
    console.error(`[analyze] session=${req.params.sessionId} failed:`, err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error during analysis' });
  }
});

router.get('/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }
  const latest = session.analyses[session.analyses.length - 1];
  res.json({ success: true, data: latest });
});

export default router;
