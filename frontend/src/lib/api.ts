import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Extract backend error messages from response body
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const backendMsg = err.response?.data?.error;
    if (backendMsg) {
      err.message = backendMsg;
    }
    return Promise.reject(err);
  }
);


// ── Customers ──────────────────────────────────────────────
export const customersApi = {
  list: (params?: Record<string, any>) =>
    api.get('/api/customers', { params }).then(r => r.data),
  get: (id: string) =>
    api.get(`/api/customers/${id}`).then(r => r.data),
  create: (data: any) =>
    api.post('/api/customers', data).then(r => r.data),
};

// ── Orders ──────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: Record<string, any>) =>
    api.get('/api/orders', { params }).then(r => r.data),
  create: (data: any) =>
    api.post('/api/orders', data).then(r => r.data),
};

// ── Segments ────────────────────────────────────────────────
export const segmentsApi = {
  list: () => api.get('/api/segments').then(r => r.data),
  get: (id: string) => api.get(`/api/segments/${id}`).then(r => r.data),
  create: (data: any) => api.post('/api/segments', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/segments/${id}`).then(r => r.data),
  preview: (filter_rules: any) =>
    api.post('/api/segments/preview', { filter_rules }).then(r => r.data),
};

// ── Campaigns ───────────────────────────────────────────────
export const campaignsApi = {
  list: () => api.get('/api/campaigns').then(r => r.data),
  create: (data: any) => api.post('/api/campaigns', data).then(r => r.data),
  stats: (id: string) => api.get(`/api/campaigns/${id}/stats`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/campaigns/${id}`).then(r => r.data),
};

// ── RFM ─────────────────────────────────────────────────────
export const rfmApi = {
  summary: () => api.get('/api/rfm').then(r => r.data),
  recalculate: () => api.get('/api/rfm/recalculate').then(r => r.data),
};

// ── AI ──────────────────────────────────────────────────────
export const aiApi = {
  buildCampaign: (prompt: string) =>
    api.post('/ai/build-campaign', { prompt }).then(r => r.data),
  suggestSegments: () =>
    api.post('/ai/suggest-segments', {}).then(r => r.data),
  personalize: (template: string, customer: any) =>
    api.post('/ai/personalize', { template, customer }).then(r => r.data),
  recommendChannel: (customer_id: string) =>
    api.post('/ai/recommend-channel', { customer_id }).then(r => r.data),
  explainPerformance: (campaign_id: string) =>
    api.post('/ai/explain-performance', { campaign_id }).then(r => r.data),
  rfmInsights: () =>
    api.get('/ai/rfm-insights').then(r => r.data),
};

export default api;
