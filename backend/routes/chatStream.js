import express from 'express';
import { orchestrateResearch } from '../services/researchOrchestrator.js';
import { Session } from '../models/Session.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const memStore = new Map();

async function getOrCreateSession(sessionId) {
  try {
    let s = await Session.findOne({ sessionId });
    if (!s) {
      s = new Session({ sessionId });
      await s.save();
    }
    return s;
  } catch {
    if (!memStore.has(sessionId)) {
      memStore.set(sessionId, {
        sessionId,
        patientName: '',
        disease: '',
        location: '',
        messages: []
      });
    }
    return memStore.get(sessionId);
  }
}

router.post('/stream', async (req, res) => {
  const { sessionId: sid, message, patientName, disease, location } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const sessionId = sid || uuidv4();

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const emit = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const session = await getOrCreateSession(sessionId);

    session.patientName = patientName || session.patientName;
    session.disease = disease || session.disease;
    session.location = location || session.location;

    const effectiveDisease = session.disease || '';
    const effectiveLocation = session.location || '';

    emit('research_start', { message: 'Fetching research...' });

    const { publications, clinicalTrials, expandedQuery } =
      await orchestrateResearch({
        disease: effectiveDisease,
        query: message,
        location: effectiveLocation,
        intent: 'general',
      });

    emit('research_done', {
      publications,
      clinicalTrials,
      expandedQuery,
      sessionId,
    });

    const pubCtx = publications.slice(0, 5).map(
      (p, i) => `[PUB${i + 1}] ${p.title}`
    ).join('\n');

    const trialCtx = clinicalTrials.slice(0, 3).map(
      (t, i) => `[TRIAL${i + 1}] ${t.title}`
    ).join('\n');

    const systemPrompt = `You are a medical AI assistant. Use research context only.`;

    const userPrompt = `
Patient: ${session.patientName || 'Unknown'}
Condition: ${effectiveDisease}

Query: ${message}

Publications:
${pubCtx || 'None'}

Clinical Trials:
${trialCtx || 'None'}
`;

    emit('stream_start', { message: 'Generating AI response...' });

    let fullResponse = '';

    // ✅ STABLE OLLAMA CALL (NO STREAMING)
    const ollamaRes = await axios.post(
      `${OLLAMA_BASE}/api/chat`,
      {
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: 120000,
      }
    );

    fullResponse =
      ollamaRes?.data?.message?.content ||
      ollamaRes?.data?.response ||
      'No response from model';

    // fake streaming for UI
    for (const char of fullResponse) {
      emit('stream_token', { token: char });
      await new Promise((r) => setTimeout(r, 1));
    }

    session.messages.push({
      role: 'user',
      content: message,
    });

    session.messages.push({
      role: 'assistant',
      content: fullResponse,
      publications,
      clinicalTrials,
      queryContext: { expandedQuery, disease: effectiveDisease },
    });

    try {
      await session.save();
    } catch {}

    emit('stream_done', { sessionId, fullResponse });
    res.end();

  } catch (err) {
    console.error('[Stream Error]', err.message);

    emit('error', {
      message: 'Server error or Ollama not reachable',
    });

    res.end();
  }
});

export default router;