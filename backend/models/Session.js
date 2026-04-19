
import mongoose from 'mongoose';

// ── Message Schema ─────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  publications: [{ type: mongoose.Schema.Types.Mixed }],
  clinicalTrials: [{ type: mongoose.Schema.Types.Mixed }],
  queryContext: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

// ── Session Schema ─────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  patientName: { type: String, default: '' },
  disease: { type: String, default: '' },
  location: { type: String, default: '' },
  messages: [messageSchema],
  queryHistory: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Session = mongoose.model('Session', sessionSchema);
export const Message = mongoose.model('Message', messageSchema);
