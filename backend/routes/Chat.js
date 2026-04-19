// routes/chat.js
import express from 'express';
import { handleChat, getHistory } from '../controllers/chatController.js';
const router = express.Router();
router.post('/', handleChat);
router.get('/history/:sessionId', getHistory);
export default router;
