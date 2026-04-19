import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

export const chatAPI = {
  sendMessage: (payload) => api.post('/chat', payload),
  getHistory: (sessionId) => api.get(`/chat/history/${sessionId}`),
};

export const researchAPI = {
  search: (payload) => api.post('/research/search', payload),
};

export const sessionAPI = {
  create: () => api.post('/session/new'),
};

export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
