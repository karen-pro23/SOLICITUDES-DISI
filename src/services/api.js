import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Ignorar redirección automática a /login si es una petición pública
    if (originalRequest.url?.startsWith('/public/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const storedRefresh = localStorage.getItem('refreshToken');
      if (!storedRefresh) {
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh', { refreshToken: storedRefresh });
        }

        const { data } = await refreshPromise;
        refreshPromise = null;
        localStorage.setItem('refreshToken', data.refreshToken);

        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Public API
export async function getPublicModules() {
  const { data } = await api.get('/public/modules');
  return data.modules;
}

export async function getPublicRequestTypes() {
  const { data } = await api.get('/public/types');
  return data.requestTypes;
}

export async function getPublicDepartments() {
  const { data } = await api.get('/public/departments');
  return data.departments;
}

export async function getPersona(cedula) {
  const { data } = await api.get(`/public/persona/${encodeURIComponent(cedula)}`);
  return data.persona;
}

export async function createPersona(personaData) {
  const { data } = await api.post('/public/persona', personaData);
  return data.persona;
}

export async function createPublicRequest(formData) {
  const { data } = await api.post('/public/requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function searchPublicRequests(query) {
  const { data } = await api.get('/public/search', { params: { q: query } });
  return data.requests;
}

export async function getPublicRequest(id) {
  const { data } = await api.get(`/public/requests/${id}`);
  return data;
}

// Attachment helpers — build URLs that go through the auth proxy
export function getAttachmentDownloadUrl(requestId, fileId) {
  return `/api/requests/${requestId}/attachments/${fileId}/download`;
}

export function getAttachmentPreviewUrl(requestId, fileId) {
  return `/api/requests/${requestId}/attachments/${fileId}/preview`;
}

// Authenticated API
export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  return data;
}

export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    await api.post('/auth/logout', { refreshToken });
  } finally {
    localStorage.removeItem('refreshToken');
  }
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}

export async function getRequests(params = {}) {
  const { data } = await api.get('/requests', { params });
  return data;
}

export async function getRequest(id) {
  const { data } = await api.get(`/requests/${id}`);
  return data;
}

export async function createRequest(formData) {
  const { data } = await api.post('/requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateRequestStatus(id, status, rejectionReason) {
  const { data } = await api.patch(`/requests/${id}/status`, { status, rejectionReason });
  return data;
}

export async function deleteRequest(id) {
  const { data } = await api.delete(`/requests/${id}`);
  return data;
}

export async function updateRequestPriority(id, priority) {
  const { data } = await api.patch(`/requests/${id}/priority`, { priority });
  return data;
}

export async function assignRequest(id, assigneeId) {
  const { data } = await api.patch(`/requests/${id}/assign`, { assigneeId });
  return data;
}

export async function addComment(requestId, content, isInternal = false) {
  const { data } = await api.post(`/requests/${requestId}/comments`, { content, isInternal });
  return data;
}

export async function getModules() {
  const { data } = await api.get('/admin/modules');
  return data.modules;
}

export async function getRequestTypes() {
  const { data } = await api.get('/admin/request-types');
  return data.requestTypes;
}

export async function getDepartments() {
  const { data } = await api.get('/admin/departments');
  return data.departments;
}

export async function getUsers() {
  const { data } = await api.get('/admin/users');
  return data.users;
}

export async function createUser(userData) {
  const { data } = await api.post('/admin/users', userData);
  return data.user;
}

export async function updateUser(id, userData) {
  const { data } = await api.put(`/admin/users/${id}`, userData);
  return data.user;
}

export async function deleteUser(id) {
  await api.delete(`/admin/users/${id}`);
}

export async function getMetrics() {
  const { data } = await api.get('/admin/metrics');
  return data.metrics;
}

// AI endpoints
export async function classifyRequest(requestId) {
  const { data } = await api.post('/ai/classify', { requestId });
  return data.clasificacion;
}

export async function generateResponse(requestId, tipoRespuesta, observaciones) {
  const { data } = await api.post('/ai/generate-response', {
    requestId,
    tipoRespuesta,
    observaciones,
  });
  return data.respuesta;
}

export default api;
