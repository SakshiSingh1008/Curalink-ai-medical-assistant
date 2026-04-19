import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import chatRoutes from './routes/chat.js';
import chatStreamRoutes from './routes/chatStream.js';
import researchRoutes from './routes/research.js';
import sessionRoutes from './routes/session.js';
import healthRoutes from './routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan('dev'));
const allowedOrigins = [
  "http://localhost:3000",
  "https://curalink-frontend-uefr.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── MongoDB ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/curalink')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.warn('⚠️  MongoDB connection failed (running without persistence):', err.message);
  });

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);
app.use('/api/chat', chatStreamRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/health', healthRoutes);

// ── Root ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Curalink API',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api/chat', '/api/research', '/api/session', '/api/health'],
  });
});

// ── Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Curalink server running on port ${PORT}`);
  console.log(`   LLM: ${process.env.OLLAMA_MODEL || 'llama3.2'} via Ollama`);
});

export default app;
