# AIDLC — Document Intake Agent

A full-stack application where users upload project documents (SOW, requirements, meeting notes, etc.) and an AI agent reads everything, presents its understanding, and asks clarifying questions before proceeding.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **LLM:** Google Gemini (gemini-1.5-flash) with swappable adapter pattern
- **File Parsing:** pdf-parse (PDF), mammoth (DOCX), xlsx (Excel), native (TXT/MD)

## Quick Start

```bash
cd AIDLC
npm install
```

Copy `.env.example` to `.env` and add your Gemini API key:

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here
```

Run both client and server:

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

## Core Flow

1. **Upload** — Drag and drop PDF, DOCX, XLSX, CSV, MD, or TXT files
2. **Analysis** — AI reads all documents and produces a structured understanding
3. **Understanding** — Review the agent's analysis with confidence scores
4. **Q&A** — Answer clarifying questions interactively or via downloadable markdown
5. **Refined** — Re-analyze with answers incorporated; repeat until confidence is high

## LLM Adapter Pattern

The LLM layer is abstracted behind an `LLMAdapter` interface. Currently implemented:

- **GeminiAdapter** — fully functional (set `GEMINI_API_KEY`)
- **OpenAIAdapter** — stub (set `OPENAI_API_KEY`)
- **ClaudeAdapter** — stub (set `ANTHROPIC_API_KEY`)

The system auto-selects the first configured adapter.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/:sessionId` | Upload files (multipart) |
| GET | `/api/upload/:sessionId/files` | List uploaded files |
| POST | `/api/analyze/:sessionId` | Trigger AI analysis |
| GET | `/api/analyze/:sessionId` | Get latest analysis |
| GET | `/api/questions/:sessionId` | Get questions |
| POST | `/api/questions/:sessionId/answer` | Answer a question |
| POST | `/api/questions/:sessionId/skip` | Skip a question |
| POST | `/api/questions/:sessionId/import-answers` | Import answers from markdown |
| GET | `/api/export/:sessionId/questions` | Download questions as .md |
| GET | `/api/export/:sessionId/understanding` | Download understanding as .md |
| POST | `/api/chat/:sessionId` | Send chat message |
