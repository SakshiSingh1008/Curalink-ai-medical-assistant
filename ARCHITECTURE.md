# Curalink — Architecture & Pipeline Guide


---

## 1. End-to-End Pipeline

```
User Message
     │
     ▼
┌────────────────────────────────────────────────────┐
│  STEP 1: QUERY EXPANSION (LLM)                     │
│  Input:  "deep brain stimulation" + disease: Parkinson's │
│  Output: "deep brain stimulation Parkinson's disease motor control" │
│  Method: Ollama (llama3.2) with medical prompt     │
└────────────────────────────────────────────────────┘
     │
     ▼  (parallel fetch)
┌──────────────┬──────────────────┬──────────────────┐
│   PubMed     │    OpenAlex      │  ClinicalTrials  │
│  80 results  │   80 results     │   50 results     │
│  XML parse   │  JSON + abstract │  v2 API JSON     │
│  → 8 best    │  reconstruction  │  → 6 best        │
│              │  → 8 best        │                  │
└──────────────┴──────────────────┴──────────────────┘
     │                │                   │
     └────────────────┴──── MERGE ────────┘
                           │
                    DEDUPLICATE (title hash)
                           │
                    RE-RANK (composite score)
                    ├── Recency:      40pts
                    ├── Has abstract: 25pts
                    ├── Citations:    20pts
                    ├── Open access:  10pts
                    └── Has URL:       5pts
                           │
                    TOP 8 publications + 6 trials
                           │
     ┌─────────────────────┘
     ▼
┌────────────────────────────────────────────────────┐
│  STEP 3: LLM REASONING (RAG)                       │
│  System: Anti-hallucination medical assistant       │
│  Context: publications + trials injected as text   │
│  Output: Structured markdown response with [PUB1]  │
│           citations, sections, disclaimers         │
└────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│  STEP 4: SSE STREAMING                             │
│  Token-by-token streaming via Server-Sent Events  │
│  Frontend renders markdown in real-time            │
│  Research panel populated before stream starts    │
└────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│  STEP 5: SESSION PERSISTENCE                       │
│  MongoDB stores: messages, publications, trials    │
│  In-memory fallback if MongoDB unavailable         │
│  Context carried across conversation turns         │
└────────────────────────────────────────────────────┘
```

---

## 2. LLM Choice & Rationale

### Primary: Ollama (llama3.2 / llama3.1 / mistral)
- **Why**: Fully local, no API costs, no rate limits, privacy-preserving for medical data
- **Control**: Complete control over prompt, temperature, token limits
- **Reliability**: Works offline, deterministic given same seed
- **Transparency**: Can inspect model weights, no black box

### Fallback: HuggingFace Inference API
- **Why**: Free tier available, many biomedical models (BioMedBERT, BioMistral)
- **Model**: `mistralai/Mistral-7B-Instruct-v0.3` (instruction-tuned, good medical reasoning)

### Anti-Hallucination Strategy
1. System prompt explicitly forbids inventing facts
2. All publications injected verbatim as `[PUB1]`, `[PUB2]` etc.
3. LLM instructed: *"only state what is supported by provided research"*
4. Template fallback generates response from raw data if LLM unavailable

---

## 3. Retrieval Strategy

### Why 80-100 results before filtering?
- **Coverage**: Medical literature is vast; top 3 results are often not the most clinically relevant
- **Quality signal**: Citation count + recency only visible after fetching metadata
- **Deduplication**: PubMed and OpenAlex overlap; need pool to deduplicate meaningfully

### Ranking Formula
```
score = recency(0-40) + has_abstract(0-25) + citations(0-20) + open_access(0-10) + has_url(0-5)
```

### Clinical Trial Priority
1. `RECRUITING` trials ranked first (immediately actionable)
2. `ACTIVE_NOT_RECRUITING` second
3. `COMPLETED` third (evidence base)

---

## 4. Chunking Strategy

**For this system, chunking is applied at the abstract level:**

- Each publication abstract is truncated to 800 characters before LLM injection
- This prevents context window overflow with 6+ publications
- Clinical trial briefs truncated to 500 characters
- Eligibility criteria truncated to 600 characters

**Trade-off reasoning:**
- Full abstracts ≈ 3000 chars × 6 pubs = 18,000 chars → exceeds context for smaller models
- 800 char truncation preserves key findings while fitting in ~4096 token context
- For production: use embeddings + vector DB (Chroma/Pinecone) for full-text retrieval

---

## 5. Scalability Considerations

| Component | Current | Production Path |
|-----------|---------|----------------|
| LLM | Ollama local | Ollama cluster / vLLM |
| Storage | MongoDB | MongoDB Atlas |
| Retrieval | Real-time API | Scheduled cache + Redis |
| Context | In-memory | Redis sessions |
| Search | Keyword | Hybrid (keyword + embedding) |
| Vector DB | None | Chroma / Qdrant |

---

## 6. Multi-Turn Context Handling

```javascript
// Each request carries last 8 messages as context
const conversationHistory = session.messages.slice(-8).map(m => ({
  role: m.role,
  content: m.content.slice(0, 200), // summarized to save tokens
}));
```

**Follow-up example:**
1. User: *"Latest treatment for lung cancer"* → disease set to "Lung Cancer"
2. User: *"Can I take Vitamin D?"* → system uses session.disease = "Lung Cancer", re-queries PubMed for "Vitamin D lung cancer"

---

## 7. API Data Sources

| Source | Endpoint | Rate Limit | Auth Required |
|--------|----------|------------|---------------|
| PubMed | `eutils.ncbi.nlm.nih.gov` | 10/sec (3 without key) | Optional API key |
| OpenAlex | `api.openalex.org` | 100,000/day | None (polite pool with email) |
| ClinicalTrials | `clinicaltrials.gov/api/v2` | Generous | None |

---

## 8. Demo Script (for Loom)

1. **Show health check** → `/api/health` confirms all 4 sources green
2. **Set patient context** → "John Smith, Parkinson's Disease, Toronto Canada"
3. **Ask**: *"Latest deep brain stimulation research"*
   - Show expanded query: `"deep brain stimulation Parkinson's disease motor control"`
   - Watch streaming tokens appear in real-time
   - Open Research Panel → 8 publications from PubMed + OpenAlex
   - Switch to Clinical Trials tab → recruiting trials with eligibility + contacts
4. **Follow-up**: *"What are the risks of this procedure?"*
   - System uses conversation context (Parkinson's) automatically
   - Shows PubMed citations in response
5. **Show architecture** → code walkthrough of `researchOrchestrator.js`
6. **Show MongoDB** → session with full message history stored
