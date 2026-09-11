import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { parseFile } from '../services/parser.js';
import { sessions, getOrCreateSession } from '../state.js';
import { initSecondBrain } from '../services/secondBrain.js';
import type { UploadedFile } from '../types/index.js';

const UPLOAD_DIR = path.resolve('uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.md', '.txt', '.markdown'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not supported`));
    }
  },
});

const router = Router();

router.post('/:sessionId', upload.array('files', 20), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No files uploaded' });
      return;
    }

    const session = getOrCreateSession(sessionId);

    // The Second Brain is created with the very first upload and lives for the
    // whole project from here on.
    initSecondBrain(sessionId, { documents: files.map((f) => f.originalname) });

    const uploadedFiles: UploadedFile[] = [];

    for (const file of files) {
      const fileRecord: UploadedFile = {
        id: uuid(),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        status: 'parsing',
      };

      try {
        const text = await parseFile(file.path, file.mimetype);
        fileRecord.status = 'ready';
        fileRecord.parsedTextPreview = text.slice(0, 500);

        const parsedDir = path.resolve('parsed');
        const { mkdir, writeFile } = await import('fs/promises');
        await mkdir(parsedDir, { recursive: true });
        await writeFile(path.join(parsedDir, `${fileRecord.id}.txt`), text, 'utf-8');
      } catch (err: any) {
        fileRecord.status = 'error';
        fileRecord.error = err.message;
      }

      session.files.push(fileRecord);
      uploadedFiles.push(fileRecord);
    }

    res.json({ success: true, data: uploadedFiles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:sessionId/files', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    res.json({ success: true, data: [] });
    return;
  }
  res.json({ success: true, data: session.files });
});

export default router;
