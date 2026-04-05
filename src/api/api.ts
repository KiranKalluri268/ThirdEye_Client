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
  baseURL:         '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
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

export default api;
