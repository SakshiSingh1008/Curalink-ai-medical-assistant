import axios from 'axios';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_MODEL = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';

/**
 * Main LLM call - tries Ollama first, falls back to HuggingFace.
 */
export async function callLLM(systemPrompt, userMessage, options = {}) {
  const { maxTokens = 1500, temperature = 0.3 } = options;

  // Try Ollama first (local, preferred)
  try {
    const res = await callOllama(systemPrompt, userMessage, { maxTokens, temperature });
    return res;
  } catch (ollamaErr) {
    console.warn('[LLM] Ollama unavailable:', ollamaErr.message);
  }

  // Fallback: HuggingFace
  if (HF_API_KEY) {
    try {
      const res = await callHuggingFace(systemPrompt, userMessage, { maxTokens });
      return res;
    } catch (hfErr) {
      console.warn('[LLM] HuggingFace unavailable:', hfErr.message);
    }
  }

  // Last resort: structured template response (no hallucination)
  return generateTemplateResponse(userMessage);
}

/**
 * Query expansion using LLM - expands user query for better retrieval.
 */
export async function expandQuery(disease, userQuery, intent = '') {
  const prompt = `You are a medical query expansion expert.
Given:
- Disease: ${disease}
- User query: ${userQuery}
- Intent: ${intent}

Generate a comprehensive PubMed/medical database search query that:
1. Combines disease + specific treatment/topic
2. Includes relevant medical synonyms
3. Uses AND/OR operators appropriately
4. Is optimized for retrieving high-quality research

Return ONLY the search query string, nothing else. Max 100 characters.`;

  try {
    const result = await callLLM('You are a medical search query expert. Return only the search query, no explanations.', prompt, { maxTokens: 100, temperature: 0.2 });
    return result.trim().replace(/^["']|["']$/g, '');
  } catch {
    // Fallback: simple concatenation
    return disease && userQuery && disease !== userQuery
      ? `${disease} ${userQuery}`
      : disease || userQuery;
  }
}

/**
 * Generate structured medical research answer.
 */
export async function generateResearchAnswer({ query, disease, patientName, publications, clinicalTrials, conversationHistory = [] }) {
  const pubSummaries = publications.slice(0, 6).map((p, i) =>
    `[PUB${i + 1}] "${p.title}" (${p.year}, ${p.source}) - ${p.abstract?.slice(0, 300) || 'No abstract'}`
  ).join('\n\n');

  const trialSummaries = clinicalTrials.slice(0, 4).map((t, i) =>
    `[TRIAL${i + 1}] "${t.title}" - Status: ${t.status}, Phase: ${t.phase}, Brief: ${t.brief?.slice(0, 200) || 'N/A'}`
  ).join('\n\n');

  const historyContext = conversationHistory.slice(-4).map(m =>
    `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content?.slice(0, 200)}`
  ).join('\n');

  const systemPrompt = `You are Curalink, an expert AI medical research assistant. Your role is to synthesize peer-reviewed medical research and clinical trial data to provide accurate, structured, evidence-based information.

CRITICAL RULES:
- NEVER hallucinate or invent medical facts
- Only state what is supported by the provided research
- Always cite sources using [PUB1], [PUB2] etc.
- Clearly distinguish between established treatments and experimental ones
- Add appropriate medical disclaimers
- Be personalized when patient context is available
- Use clear, readable language`;

  const userMessage = `Patient Context:
${patientName ? `- Name: ${patientName}` : ''}
${disease ? `- Condition: ${disease}` : ''}
- Query: ${query}

${historyContext ? `Conversation History:\n${historyContext}\n` : ''}

Research Publications Retrieved:
${pubSummaries || 'No publications found.'}

Clinical Trials Retrieved:
${trialSummaries || 'No clinical trials found.'}

Generate a comprehensive, structured response with these sections:
1. **Condition Overview** (brief, relevant to their query)
2. **Key Research Insights** (cite [PUB1] etc., focus on query)
3. **Clinical Trials** (if relevant trials exist)
4. **Personalized Recommendations** (tailored to their specific question)
5. **Important Disclaimer**

Be specific, evidence-based, and personalized. Do not be generic.`;

  return await callLLM(systemPrompt, userMessage, { maxTokens: 1500, temperature: 0.3 });
}

// ── Internal Implementations ──────────────────────────────────────

async function callOllama(systemPrompt, userMessage, { maxTokens, temperature }) {
  const res = await axios.post(`${OLLAMA_BASE}/api/chat`, {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: false,
    options: {
      temperature,
      num_predict: maxTokens,
    },
  }, { timeout: 120000 });

  const content = res.data?.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

async function callHuggingFace(systemPrompt, userMessage, { maxTokens }) {
  const prompt = `<s>[INST] ${systemPrompt}\n\n${userMessage} [/INST]`;
  const res = await axios.post(
    `https://api-inference.huggingface.co/models/${HF_MODEL}`,
    { inputs: prompt, parameters: { max_new_tokens: maxTokens, temperature: 0.3, return_full_text: false } },
    { headers: { Authorization: `Bearer ${HF_API_KEY}` }, timeout: 60000 }
  );
  const text = res.data?.[0]?.generated_text || res.data?.generated_text;
  if (!text) throw new Error('Empty response from HuggingFace');
  return text.trim();
}

function generateTemplateResponse(query) {
  return `## Research Summary

Based on your query: "${query}"

I retrieved relevant medical research publications and clinical trials from PubMed, OpenAlex, and ClinicalTrials.gov. Please review the cited sources below for detailed information.

**Note**: The AI reasoning model is currently unavailable. The research data has been retrieved successfully — please review the publications and clinical trials directly.

*⚠️ This information is for research purposes only. Please consult a qualified healthcare professional for medical advice.*`;
}
