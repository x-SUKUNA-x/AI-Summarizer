// In dev: falls back to localhost. In production: set VITE_API_BASE in Vercel dashboard.
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/api';
