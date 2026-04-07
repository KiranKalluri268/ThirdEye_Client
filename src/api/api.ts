/**
 * @file api.ts
 * @description Centralised Axios instance for all ThirdEye API calls.
 *              - BaseURL points to the Express backend
 *              - withCredentials: true sends the httpOnly JWT cookie automatically
 *              - Response interceptor: extracts .data, handles 401 globally
 */

import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';

const api = axios.create({
  baseURL:         import.meta.env.VITE_SERVER_URL ? `${import.meta.env.VITE_SERVER_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * @description Request interceptor — attaches the JWT from localStorage
 *              if it exists, bypassing strict third-party cookie blockers.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('thirdeye_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * @description Response interceptor — unwraps the Axios response envelope
 *              and handles 401 (session expired) by redirecting to login.
 */
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Session expired — redirect to login if not already there
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
// ── Caching Layer ─────────────────────────────────────────────────────────────
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache GET aggressively, but respect TTL
const originalGet = api.get;
api.get = async function<T = any, R = AxiosResponse<T>>(url: string, config?: any): Promise<R> {
  const isNoCache = config?.headers?.['Cache-Control'] === 'no-cache';
  
  if (!isNoCache && cache.has(url)) {
    const cached = cache.get(url)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      // Simulate Axios wrapper structurally
      return Promise.resolve({ data: cached.data, status: 200, statusText: 'OK', headers: {}, config: config || {} } as unknown as R);
    }
  }

  const response = await originalGet.call(this, url, config) as AxiosResponse;
  if (!isNoCache) {
    cache.set(url, { data: response.data, timestamp: Date.now() });
  }
  return response as R;
};

// Aggressively invalidate cache on any structural data mutation
['post', 'put', 'patch', 'delete'].forEach((method) => {
  const original = (api as any)[method];
  (api as any)[method] = async function (...args: any[]) {
    cache.clear(); // Safely nuke all cache so next GET retrieves fresh records
    return original.apply(this, args);
  };
});

export default api;
