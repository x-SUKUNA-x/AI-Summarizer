import { API_BASE } from './config.js';

export async function summarizeText(text) {
    const response = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
}

export async function correctText(text) {
    const response = await fetch(`${API_BASE}/correct`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
}
