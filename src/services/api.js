import axios from 'axios';

// Detectar si está corriendo en Capacitor (app móvil)
const isCapacitor = window.location.protocol === 'capacitor:' 
  || (window.location.hostname === 'localhost' && !window.location.port)
  || window.location.href.startsWith('capacitor://');
const API_BASE = isCapacitor ? 'http://192.168.16.204:3001/api' : '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Enviar token de localStorage como Bearer header (para Capacitor)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
        localStorage.removeItem('accessToken');
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
        // Guardar access token para Capacitor
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
        }

        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('accessToken');
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
const ATTACHMENT_BASE = isCapacitor ? 'http://192.168.16.204:3001' : '';

export function getAttachmentDownloadUrl(requestId, fileId) {
  return `${ATTACHMENT_BASE}/api/requests/${requestId}/attachments/${fileId}/download`;
}

export function getAttachmentPreviewUrl(requestId, fileId) {
  return `${ATTACHMENT_BASE}/api/requests/${requestId}/attachments/${fileId}/preview`;
}

// Authenticated API
export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  // Guardar access token para Capacitor (cookie httpOnly no funciona en apps)
  if (data.accessToken) {
    localStorage.setItem('accessToken', data.accessToken);
  }
  return data;
}

export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    await api.post('/auth/logout', { refreshToken });
  } finally {
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('accessToken');
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

export async function assignRequest(id, data) {
  const res = await api.patch(`/requests/${id}/assign`, data);
  return res.data;
}

export async function addComment(requestId, content, isInternal = false, files = []) {
  const formData = new FormData();
  formData.append('content', content);
  formData.append('isInternal', isInternal);
  
  // Agregar archivos si existen
  for (const file of files) {
    formData.append('files', file);
  }
  
  const { data } = await api.post(`/requests/${requestId}/comments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

export async function getUsersByDepartment(deptId) {
  const { data } = await api.get(`/admin/users/department/${deptId}`);
  return data.users;
}

export async function getUsersByArea(areaId) {
  const { data } = await api.get(`/admin/users/area/${areaId}`);
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

// Area endpoints
export async function getAreasByDepartment(departmentId) {
  const { data } = await api.get(`/areas/department/${departmentId}`);
  return data.areas;
}

export async function createArea(departmentId, name, description) {
  const { data } = await api.post('/areas', { departmentId, name, description });
  return data.area;
}

export async function updateArea(areaId, name, description, isActive) {
  const { data } = await api.patch(`/areas/${areaId}`, { name, description, isActive });
  return data.area;
}

export async function deleteArea(areaId) {
  await api.delete(`/areas/${areaId}`);
}

export async function getMyAreas() {
  const { data } = await api.get('/areas/my-areas');
  return data.areas;
}

// Service Ticket endpoints
export async function createServiceTicket(data) {
  const { data: result } = await api.post('/service-tickets', data);
  return result.ticket;
}

export async function getServiceTickets(params = {}) {
  const { data } = await api.get('/service-tickets', { params });
  return data;
}

export async function getServiceTicket(code) {
  const { data } = await api.get(`/service-tickets/${code}`);
  return data.ticket;
}

export async function acceptServiceTicket(id) {
  const { data } = await api.patch(`/service-tickets/${id}/accept`);
  return data.ticket;
}

export async function rejectServiceTicket(id, reason) {
  const { data } = await api.patch(`/service-tickets/${id}/reject`, { reason });
  return data.ticket;
}

export async function assignServiceTicket(id, technicianId) {
  const { data } = await api.patch(`/service-tickets/${id}/assign`, { technicianId });
  return data.ticket;
}

export async function closeServiceTicket(id, data) {
  const { data: result } = await api.patch(`/service-tickets/${id}/close`, data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  });
  return result.ticket;
}

export async function getPublicServiceTicket(code) {
  const { data } = await api.get(`/service-tickets/public/${code}`);
  return data.ticket;
}

export async function rateServiceTicket(code, satisfaction) {
  const { data } = await api.patch(`/service-tickets/public/${code}/rate`, { satisfaction });
  return data.ticket;
}

export async function getServiceTicketStats() {
  const { data } = await api.get('/service-tickets/stats');
  return data.stats;
}

export async function getServiceTypes() {
  const { data } = await api.get('/service-tickets/service-types');
  return data.serviceTypes;
}

export default api;
