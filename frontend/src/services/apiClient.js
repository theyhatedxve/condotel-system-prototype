// Shared JSON API client; the request interceptor attaches the current bearer token.
// Response errors are handled by callers rather than a global logout interceptor.
import axios from 'axios';

import { getAccessToken } from '../features/auth/authStorage';

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:3000/api',

  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // Read storage for each request so login/logout changes take effect without recreating the client.
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;