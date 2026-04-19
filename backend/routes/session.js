import express from 'express';
import { v4 as uuidv4 } from 'uuid';
const router = express.Router();

router.post('/new', (req, res) => {
  res.json({ sessionId: uuidv4() });
});

export default router;
