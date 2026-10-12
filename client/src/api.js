import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) config.headers['x-user-id'] = userId;
  return config;
});

export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  listUsers: () => api.get('/api/auth/users'),
};

export const docsApi = {
  list: () => api.get('/api/documents'),
  get: (id) => api.get(`/api/documents/${id}`),
  create: (title, content) => api.post('/api/documents', { title, content }),
  update: (id, data) => api.put(`/api/documents/${id}`, data),
  delete: (id) => api.delete(`/api/documents/${id}`),
  share: (id, email, permission) => api.post(`/api/documents/${id}/share`, { email, permission }),
  revokeShare: (id, shareId) => api.delete(`/api/documents/${id}/share/${shareId}`),
};

export const uploadApi = {
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/upload/import', form);
  },
  attachFile: (docId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/upload/attach/${docId}`, form);
  },
};
