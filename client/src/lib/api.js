import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Pre-configured Axios instance for all API calls.
 * Usage:
 *   import api from '../lib/api';
 *   const res = await api.get('/biographer/greeting', { headers: { Authorization: `Bearer ${token}` } });
 */
const api = axios.create({
    baseURL: API_BASE_URL,
});

export default api;
