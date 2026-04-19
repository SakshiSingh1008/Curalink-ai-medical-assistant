import express from 'express';
import { orchestrateResearch } from '../services/researchOrchestrator.js';

const router = express.Router();

// Direct research endpoint (no LLM, raw data)
router.post('/search', async (req, res) => {
  const { disease, query, location } = req.body;
  if (!query && !disease) {
    return res.status(400).json({ error: 'query or disease is required' });
  }
  try {
    const results = await orchestrateResearch({ disease, query, location, intent: 'general' });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
