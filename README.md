# Curalink — AI Medical Research Assistant

> **Evidence-based medical research at your fingertips** — powered by PubMed, OpenAlex, ClinicalTrials.gov, and an open-source LLM.

---

## 🏗️ Architecture Overview

```
User Query
    │
    ▼
┌─────────────────────────────────────────────┐
│              React Frontend (Port 3000)      │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Sidebar  │ │  Chat    │ │  Research   │ │
│  │ Context  │ │  Panel   │ │   Panel     │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
└─────────────────────────────────────────────┘
                    │ REST API
                    ▼
┌─────────────────────────────────────────────┐
│           Express Backend (Port 5000)        │
│                                             │
│  1. Query Expansion (LLM)                   │
│  2. Parallel Research Retrieval             │
│     ├── PubMed API (80 results)             │
│     ├── OpenAlex API (80 results)           │
│     └── ClinicalTrials.gov (50 results)     │
│  3. Merge + Deduplicate + Re-rank           │
│  4. LLM Reasoning + Response Gen            │
│  5. Session persistence (MongoDB)           │
└─────────────────────────────────────────────┘
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
┌──────────┐                  ┌──────────┐
│  Ollama  │  (preferred)     │    HF    │ (fallback)
│ llama3.2 │                  │ Mistral  │
└──────────┘                  └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Ollama (recommended) OR HuggingFace API key

### 1. Install Ollama & Pull Model

```bash
# Install Ollama: https://ollama.ai
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the model (choose one)
ollama pull llama3.2          # Recommended (2GB, fast)
ollama pull llama3.1          # More capable (4GB)
ollama pull mistral           # Alternative
ollama pull phi3              # Lightweight
```

### 2. Set Up Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI, OLLAMA_MODEL, etc.
npm run dev
```

### 3. Set Up Frontend

```bash
cd frontend
npm install
npm start
```

### 4. Open App

```
http://localhost:3000
```

---

## ⚙️ Configuration

### Backend `.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/curalink

# LLM Config (Ollama - preferred)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# OR HuggingFace (fallback)
HUGGINGFACE_API_KEY=hf_...
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.3

# PubMed (optional, increases rate limits)
PUBMED_API_KEY=your_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## 🧠 AI Pipeline Design

### Query Expansion
The LLM expands user queries before retrieval:
- Input: `"deep brain stimulation"` + disease: `"Parkinson's"`
- Output: `"deep brain stimulation Parkinson's disease motor symptoms"`

### Retrieval Strategy
| Source | Pool Size | Final |
|--------|-----------|-------|
| PubMed | ~80 | Top 8 |
| OpenAlex | ~80 | Top 8 |
| ClinicalTrials | ~50 | Top 6 |

After retrieval: **merge → deduplicate by title → re-rank by composite score**

### Ranking Factors
1. **Recency** (40 points max) — newer papers preferred
2. **Has Abstract** (25 points) — quality signal
3. **Citation Count** (20 points) — impact signal
4. **Open Access** (10 points) — accessibility
5. **Has URL** (5 points) — verifiability

### LLM Reasoning
System uses Retrieval-Augmented Generation (RAG):
1. Retrieved research is injected as context
2. LLM is instructed to only cite provided sources
3. Responses are structured with sections
4. Anti-hallucination prompts enforce grounding

---

## 📁 Project Structure

```
curalink/
├── backend/
│   ├── server.js                  # Express entry point
│   ├── models/Session.js          # MongoDB schema
│   ├── routes/
│   │   ├── chat.js
│   │   ├── research.js
│   │   ├── session.js
│   │   └── health.js
│   ├── controllers/
│   │   └── chatController.js      # Main conversation logic
│   └── services/
│       ├── pubmedService.js        # PubMed API
│       ├── openAlexService.js      # OpenAlex API
│       ├── clinicalTrialsService.js # ClinicalTrials.gov API
│       ├── researchOrchestrator.js # Parallel fetch + merge
│       └── llmService.js           # Ollama/HF LLM calls
│
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js
        ├── index.js
        ├── index.css              # Design system variables
        ├── utils/api.js           # Axios API client
        ├── context/SessionContext.js
        └── components/
            ├── MainLayout.js/css
            ├── Sidebar.js/css
            ├── ChatPanel.js/css
            ├── ResearchPanel.js/css
            └── PatientContextModal.js/css
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, get AI response + research |
| GET | `/api/chat/history/:sessionId` | Get conversation history |
| POST | `/api/research/search` | Direct research search (no LLM) |
| POST | `/api/session/new` | Create new session |
| GET | `/api/health` | System health check |

### Chat Request Body
```json
{
  "sessionId": "uuid",
  "message": "Latest treatment for lung cancer",
  "patientName": "John Smith",
  "disease": "Lung Cancer",
  "location": "Toronto, Canada"
}
```

---

## 🚢 Deployment

### Render / Railway
```bash
# Backend: set build command = npm install, start = node server.js
# Frontend: set build command = npm run build, serve the build folder
```

### Docker (optional)
```bash
# Build backend
cd backend && docker build -t curalink-api .

# Or use docker-compose (create your own compose file)
```

---

## 🧪 Example Queries

- `"Latest treatment for lung cancer"`
- `"Clinical trials for Parkinson's disease in Toronto"`
- `"Deep brain stimulation outcomes"`
- `"Top studies on Alzheimer's prevention"`
- `"Can patients with diabetes take metformin long-term?"`
- `"Heart failure recent clinical trials recruiting"`

---

## ⚠️ Disclaimer

This application is for **research and educational purposes only**. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.

---

## 📄 License

MIT — Built for the Curalink AI Medical Research Assistant Hackathon.
