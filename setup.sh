#!/usr/bin/env bash
# Curalink Quick Setup Script
# Usage: bash setup.sh

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ✛  Curalink — AI Medical Research Assistant"
echo "     Setup Script"
echo -e "${NC}"

# ── Check Node ──────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node.js 18+ required (found $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── Check MongoDB ────────────────────────────────────────
if command -v mongod &> /dev/null; then
  echo -e "${GREEN}✓ MongoDB found${NC}"
else
  echo -e "${YELLOW}⚠  MongoDB not found. App will use in-memory session store (no persistence).${NC}"
  echo "   Install: https://www.mongodb.com/try/download/community"
fi

# ── Check Ollama ─────────────────────────────────────────
if command -v ollama &> /dev/null; then
  echo -e "${GREEN}✓ Ollama found${NC}"
  echo -e "${CYAN}→ Pulling llama3.2 model (2GB)…${NC}"
  ollama pull llama3.2 || echo -e "${YELLOW}⚠  Could not pull model. Run: ollama pull llama3.2${NC}"
else
  echo -e "${YELLOW}⚠  Ollama not found.${NC}"
  echo "   Install: curl -fsSL https://ollama.ai/install.sh | sh"
  echo "   Then:    ollama pull llama3.2"
  echo "   OR set HUGGINGFACE_API_KEY in backend/.env for cloud LLM"
fi

# ── Backend setup ─────────────────────────────────────────
echo ""
echo -e "${CYAN}→ Installing backend dependencies…${NC}"
cd backend
npm install --quiet

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ Created backend/.env from template${NC}"
  echo -e "${YELLOW}  Edit backend/.env to customize settings${NC}"
else
  echo -e "${GREEN}✓ backend/.env already exists${NC}"
fi
cd ..

# ── Frontend setup ────────────────────────────────────────
echo -e "${CYAN}→ Installing frontend dependencies…${NC}"
cd frontend
npm install --quiet
cd ..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Curalink setup complete!${NC}"
echo ""
echo "  Start backend:   cd backend && npm run dev"
echo "  Start frontend:  cd frontend && npm start"
echo ""
echo "  Or run both:     (cd backend && npm run dev) & (cd frontend && npm start)"
echo ""
echo -e "  Open: ${CYAN}http://localhost:3000${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
