import { v4 as uuidv4 } from 'uuid';
import { orchestrateResearch } from '../services/researchOrchestrator.js';
import { generateResearchAnswer } from '../services/llmService.js';
import { Session } from '../models/Session.js';

// In-memory session store (fallback when MongoDB unavailable)
const memoryStore = new Map();

async function getSession(sessionId) {
  try {
    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({ sessionId });
      await session.save();
    }
    return session;
  } catch {
    // MongoDB unavailable - use memory
    if (!memoryStore.has(sessionId)) {
      memoryStore.set(sessionId, {
        sessionId, patientName: '', disease: '', location: '',
        messages: [], queryHistory: [],
      });
    }
    return memoryStore.get(sessionId);
  }
}

async function saveSession(session) {
  try {
    if (session.save) await session.save();
    // Memory store is already mutable, no save needed
  } catch (err) {
    console.warn('[Session] Save failed:', err.message);
  }
}

export async function handleChat(req, res) {
  const {
    sessionId: incomingSessionId,
    message,
    patientName,
    disease,
    location,
    isStructured = false,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sessionId = incomingSessionId || uuidv4();

  try {
    // Load session
    const session = await getSession(sessionId);

    // Update patient context if provided
    if (patientName) session.patientName = patientName;
    if (disease) session.disease = disease;
    if (location) session.location = location;

    // Resolve context: use session context if not in current message
    const effectiveDisease = disease || session.disease || '';
    const effectiveLocation = location || session.location || '';
    const effectiveName = patientName || session.patientName || '';

    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    session.queryHistory = session.queryHistory || [];
    session.queryHistory.push(message);

    // Determine intent from message
    const intent = detectIntent(message);

    // Orchestrate research retrieval
    const { expandedQuery, publications, clinicalTrials } = await orchestrateResearch({
      disease: effectiveDisease,
      query: message,
      location: effectiveLocation,
      intent,
    });

    // Generate LLM response
    const conversationHistory = session.messages.slice(-8).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const aiResponse = await generateResearchAnswer({
      query: message,
      disease: effectiveDisease,
      patientName: effectiveName,
      publications,
      clinicalTrials,
      conversationHistory,
    });

    // Save assistant message
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      publications,
      clinicalTrials,
      queryContext: { expandedQuery, disease: effectiveDisease, location: effectiveLocation },
    };
    session.messages.push(assistantMessage);
    await saveSession(session);

    return res.json({
      sessionId,
      message: aiResponse,
      publications,
      clinicalTrials,
      expandedQuery,
      context: {
        disease: effectiveDisease,
        patientName: effectiveName,
        location: effectiveLocation,
      },
    });

  } catch (err) {
    console.error('[Chat] Error:', err);
    return res.status(500).json({
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

export async function getHistory(req, res) {
  const { sessionId } = req.params;
  try {
    const session = await getSession(sessionId);
    return res.json({
      sessionId,
      messages: session.messages || [],
      context: {
        patientName: session.patientName,
        disease: session.disease,
        location: session.location,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load history' });
  }
}

function detectIntent(message) {
  const lower = message.toLowerCase();
  if (lower.includes('trial') || lower.includes('study') || lower.includes('recruit')) return 'clinical_trial';
  if (lower.includes('treatment') || lower.includes('therapy') || lower.includes('drug')) return 'treatment';
  if (lower.includes('researcher') || lower.includes('expert') || lower.includes('doctor')) return 'researcher';
  if (lower.includes('symptom') || lower.includes('sign')) return 'symptom';
  if (lower.includes('diet') || lower.includes('food') || lower.includes('supplement') || lower.includes('vitamin')) return 'lifestyle';
  return 'general';
}
