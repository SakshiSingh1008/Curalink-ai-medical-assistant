import express from 'express';
import { orchestrateResearch } from '../services/researchOrchestrator.js';
import { Session } from '../models/Session.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// In-memory fallback store
const memStore = new Map();

async function getOrCreateSession(sessionId) {
  try {
    let s = await Session.findOne({ sessionId });
    if (!s) { s = new Session({ sessionId }); await s.save(); }
    return s;
  } catch {
    if (!memStore.has(sessionId)) memStore.set(sessionId, { sessionId, patientName: '', disease: '', location: '', messages: [] });
    return memStore.get(sessionId);
  }
}

/**
 * POST /api/chat/stream
 * Server-Sent Events streaming endpoint.
 * Emits: research_start, research_done, stream_token, stream_done, error
 */
router.post('/stream', async (req, res) => {
  const { sessionId: sid, message, patientName, disease, location } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const sessionId = sid || uuidv4();

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const emit = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const session = await getOrCreateSession(sessionId);
    if (patientName) session.patientName = patientName;
    if (disease) session.disease = disease;
    if (location) session.location = location;

    const effectiveDisease = disease || session.disease || '';
    const effectiveLocation = location || session.location || '';

    // Emit: research starting
    emit('research_start', { message: 'Retrieving research from PubMed, OpenAlex & ClinicalTrials…' });

    // Run research
    const { expandedQuery, publications, clinicalTrials } = await orchestrateResearch({
      disease: effectiveDisease,
      query: message,
      location: effectiveLocation,
      intent: 'general',
    });

    // Emit: research done
    emit('research_done', {
      expandedQuery,
      publications,
      clinicalTrials,
      sessionId,
    });

    // Build prompt
    const pubCtx = publications.slice(0, 6).map((p, i) =>
      `[PUB${i+1}] "${p.title}" (${p.year}, ${p.source}): ${p.abstract?.slice(0, 300) || ''}`
    ).join('\n\n');

    const trialCtx = clinicalTrials.slice(0, 4).map((t, i) =>
      `[TRIAL${i+1}] "${t.title}" - Status: ${t.status}: ${t.brief?.slice(0, 200) || ''}`
    ).join('\n\n');

    const historyCtx = (session.messages || []).slice(-6).map(m =>
      `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content?.slice(0, 150)}`
    ).join('\n');

    const systemPrompt = `You are Curalink, an expert AI medical research assistant. Synthesize medical research and clinical trials to provide accurate, evidence-based, structured answers. Only cite provided sources. Never hallucinate. Add medical disclaimers.`;

    const userPrompt = `Patient: ${session.patientName || 'Unknown'} | Condition: ${effectiveDisease || 'Unknown'}
Query: ${message}
${historyCtx ? `Recent conversation:\n${historyCtx}\n` : ''}

Publications:
${pubCtx || 'None found.'}

Clinical Trials:
${trialCtx || 'None found.'}

Provide a structured response with: Condition Overview, Research Insights (cite [PUB1] etc.), Clinical Trials section, Personalized Recommendations, Disclaimer.`;

    // Stream from Ollama
    emit('stream_start', { message: 'Generating AI analysis…' });

    let fullResponse = '';

    try {
      const ollamaRes = await axios.post(`${OLLAMA_BASE}/api/chat`, {
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        options: { temperature: 0.3, num_predict: 1500 },
      }, {
        responseType: 'stream',
        timeout: 120000,
      });

      await new Promise((resolve, reject) => {
        ollamaRes.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              const token = json?.message?.content || '';
              if (token) {
                fullResponse += token;
                emit('stream_token', { token });
              }
              if (json.done) resolve();
            } catch { /* skip malformed */ }
          }
        });
        ollamaRes.data.on('end', resolve);
        ollamaRes.data.on('error', reject);
      });

    } catch (ollamaErr) {
      // Fallback: non-streaming template
      fullResponse = `## Research Summary for "${message}"\n\nI retrieved **${publications.length} publications** and **${clinicalTrials.length} clinical trials** relevant to your query${effectiveDisease ? ` on ${effectiveDisease}` : ''}.\n\n### Key Publications\n${publications.slice(0, 3).map((p, i) => `- **[PUB${i+1}]** ${p.title} (${p.year})`).join('\n')}\n\n### Clinical Trials\n${clinicalTrials.slice(0, 2).map((t, i) => `- **${t.status}**: ${t.title}`).join('\n') || 'No trials found.'}\n\n> ⚠️ AI reasoning unavailable (Ollama not running). Please review the research results directly.\n\n*This information is for research purposes only. Consult a healthcare professional for medical advice.*`;
      for (const char of fullResponse) {
        emit('stream_token', { token: char });
        await new Promise(r => setTimeout(r, 2)); // simulate streaming
      }
    }

    // Save to session
    session.messages = session.messages || [];
    session.messages.push({ role: 'user', content: message });
    session.messages.push({
      role: 'assistant', content: fullResponse,
      publications, clinicalTrials,
      queryContext: { expandedQuery, disease: effectiveDisease },
    });

    try { if (session.save) await session.save(); } catch {}

    emit('stream_done', { sessionId, fullResponse });
    res.end();

  } catch (err) {
    console.error('[Stream] Error:', err.message);
    emit('error', { message: err.message });
    res.end();
  }
});

export default router;
