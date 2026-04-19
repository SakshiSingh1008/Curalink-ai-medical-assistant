import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

export const chatAPI = {
  sendMessage: (payload) => api.post('/api/chat', payload),
  getHistory: (sessionId) => api.get(`/api/chat/history/${sessionId}`),
};

export const researchAPI = {
  search: (payload) => api.post('/api/research/search', payload),
};

export const sessionAPI = {
  create: () => api.post('/api/session/new'),
};

export const healthAPI = {
  check: () => api.get('/api/health'),
};

export default api;
