import { Router } from 'express';
import { sessions } from '../state.js';

const router = Router();

router.get('/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }
  const latest = session.analyses[session.analyses.length - 1];
  res.json({ success: true, data: latest.questions });
});

router.post('/:sessionId/answer', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }

  const { questionId, answer } = req.body;
  if (!questionId || answer === undefined) {
    res.status(400).json({ success: false, error: 'questionId and answer are required' });
    return;
  }

  const latest = session.analyses[session.analyses.length - 1];
  const question = latest.questions.find((q) => q.id === questionId);
  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  question.answer = answer;
  question.status = 'answered';
  session.currentStep = 'questions';

  res.json({ success: true, data: question });
});

router.post('/:sessionId/answer-bulk', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }

  const { answers } = req.body as { answers: { questionId: string; answer: string | string[] }[] };
  if (!answers || !Array.isArray(answers)) {
    res.status(400).json({ success: false, error: 'answers array is required' });
    return;
  }

  const latest = session.analyses[session.analyses.length - 1];

  for (const { questionId, answer } of answers) {
    const question = latest.questions.find((q) => q.id === questionId);
    if (question) {
      question.answer = answer;
      question.status = 'answered';
    }
  }

  session.currentStep = 'questions';
  res.json({ success: true, data: latest.questions });
});

router.post('/:sessionId/skip', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }

  const { questionId } = req.body;
  const latest = session.analyses[session.analyses.length - 1];
  const question = latest.questions.find((q) => q.id === questionId);
  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  question.status = 'skipped';
  res.json({ success: true, data: question });
});

router.post('/:sessionId/import-answers', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.analyses.length === 0) {
    res.status(404).json({ success: false, error: 'No analysis found' });
    return;
  }

  const { markdown } = req.body as { markdown: string };
  if (!markdown) {
    res.status(400).json({ success: false, error: 'markdown content is required' });
    return;
  }

  const latest = session.analyses[session.analyses.length - 1];
  const answerPattern = /####\s+(\w+):\s+.*?\n\*\*Context:\*\*.*?\n\*\*Your Answer:\*\*\s*\n([\s\S]*?)(?=\n####|\n###|$)/g;

  let match;
  let count = 0;
  while ((match = answerPattern.exec(markdown)) !== null) {
    const id = match[1];
    const rawAnswer = match[2].trim().replace(/^_\[/, '').replace(/\]_$/, '');

    if (rawAnswer && rawAnswer !== 'Type your answer here') {
      const question = latest.questions.find((q) => q.id === id);
      if (question) {
        question.answer = rawAnswer;
        question.status = 'answered';
        count++;
      }
    }
  }

  res.json({ success: true, data: { importedCount: count, questions: latest.questions } });
});

export default router;
