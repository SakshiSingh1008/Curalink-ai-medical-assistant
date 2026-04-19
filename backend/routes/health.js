import express from 'express';
import axios from 'axios';
const router = express.Router();

router.get('/', async (req, res) => {
  const checks = {
    server: 'ok',
    ollama: 'unknown',
    pubmed: 'unknown',
    openalex: 'unknown',
    clinicaltrials: 'unknown',
  };

  // Check Ollama
  try {
    await axios.get(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`, { timeout: 3000 });
    checks.ollama = 'ok';
  } catch {
    checks.ollama = 'unavailable';
  }

  // Quick API ping checks
  try {
    await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=test&retmax=1&retmode=json', { timeout: 5000 });
    checks.pubmed = 'ok';
  } catch { checks.pubmed = 'unavailable'; }

  try {
    await axios.get('https://api.openalex.org/works?search=test&per-page=1', { timeout: 5000 });
    checks.openalex = 'ok';
  } catch { checks.openalex = 'unavailable'; }

  try {
    await axios.get('https://clinicaltrials.gov/api/v2/studies?query.cond=diabetes&pageSize=1&format=json', { timeout: 5000 });
    checks.clinicaltrials = 'ok';
  } catch { checks.clinicaltrials = 'unavailable'; }

  res.json({ status: 'running', checks, model: process.env.OLLAMA_MODEL || 'llama3.2' });
});

export default router;
