import { API_BASE } from './config.js';
const API_URL = API_BASE;

// All requests send cookies automatically — no localStorage token needed
const req = (url, options = {}) =>
    fetch(`${API_URL}${url}`, {
        credentials: 'include',   // send HTTP-only cookie on every request
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
    });

export const api = {
    // ── Auth ────────────────────────────────────────────────────────────────────
    login: async (email, password) => {
        const res = await req('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Login failed'); }
        return res.json(); // { user }
    },

    signup: async (email, password) => {
        const res = await req('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Signup failed'); }
        return res.json(); // { user }
    },

    me: async () => {
        const res = await req('/auth/me');
        if (res.status === 401 || res.status === 403) throw new Error('Not authenticated');
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json(); // { user }
    },

    logout: async () => {
        await req('/auth/logout', { method: 'POST' });
    },

    // ── AI ──────────────────────────────────────────────────────────────────────
    summarize: async (text) => {
        const res = await req('/summarize', {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Summarize failed'); }
        return res.json(); // { text }
    },

    transcribe: async (formData) => {
        const res = await fetch(`${API_URL}/transcribe`, {
            method: 'POST',
            credentials: 'include',
            body: formData, // multipart — do NOT set Content-Type header
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Transcription failed'); }
        return res.json(); // { text }
    },

    // ── Summaries ────────────────────────────────────────────────────────────────
    getSummaries: async () => {
        const res = await req('/summaries');
        if (!res.ok) throw new Error('Failed to fetch summaries');
        return res.json(); // [{ id, transcript, summary, is_bookmarked, created_at }]
    },

    saveSummary: async (transcript, summary) => {
        const res = await req('/summaries/save', {
            method: 'POST',
            body: JSON.stringify({ transcript, summary }),
        });
        if (!res.ok) throw new Error('Failed to save summary');
        return res.json();
    },

    toggleBookmark: async (id, is_bookmarked) => {
        const res = await req(`/summaries/${id}/bookmark`, {
            method: 'PUT',
            body: JSON.stringify({ is_bookmarked }),
        });
        if (!res.ok) throw new Error('Failed to update bookmark');
        return res.json();
    },

    deleteSummary: async (id) => {
        const res = await req(`/summaries/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete summary');
        return res.json();
    },
};
