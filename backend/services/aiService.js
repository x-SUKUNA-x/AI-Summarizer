/* global process */

// ── Gemini model — 2.5-flash has quota on current API key
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Gemini fetch with rate-limit retry ──────────────────────────────────────
async function geminiGenerate(prompt, temperature = 0.1, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature },
                }),
            }
        );

        if (res.status === 429) {
            // Rate limited — read retry-after from error body if available
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error?.message || '';
            const retryMatch = msg.match(/retry in ([\d.]+)s/i);
            const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 20000;
            console.warn(`⚠️  Gemini rate limited. Waiting ${waitMs}ms before retry (attempt ${attempt}/${maxAttempts})...`);
            if (attempt < maxAttempts) { await sleep(waitMs); continue; }
            throw new Error('Gemini is rate limited. Please wait a moment and try again.');
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Gemini error ${res.status}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
        throw new Error('Empty response from Gemini');
    }
}

// ── Whisper (Groq) ────────────────────────────────────────────────────────────
export async function transcribeAudio(buffer, originalname, mimetype) {
    const HALLUCINATIONS = [
        'skål', 'skal', 'thanks for watching', 'thank you for watching',
        'sous-titres', 'amara.org', 'drunk',
    ];

    let lastTranscript = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimetype }), originalname || 'audio.webm');
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');
        formData.append('language', 'en');
        formData.append('temperature', '0.0');
        formData.append('prompt', 'The user is speaking clear English. Transcribe exactly what is spoken.');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (attempt === 2) throw new Error(err?.error?.message || 'Groq API error');
            continue;
        }

        const data = await res.json();
        const text = data.text?.trim() || '';
        const lower = text.toLowerCase();
        const suspicious = !text || text.length < 3 || HALLUCINATIONS.some(h => lower.includes(h));

        if (suspicious) {
            if (text && attempt === 1) lastTranscript = text;
            if (attempt === 2) {
                if (lastTranscript) return lastTranscript;
                throw new Error('Speech unclear, please repeat');
            }
            continue;
        }

        return text;
    }
}

// ── Gemini text correction ────────────────────────────────────────────────────
export async function correctText(inputText) {
    if (!inputText) return inputText;

    const fixes = { drunk: 'wrong', drink: 'wrong', skull: 'school', 'thanks for watching': '' };
    let text = inputText.toLowerCase();
    for (const [bad, good] of Object.entries(fixes)) text = text.split(bad).join(good);
    text = text.trim();
    if (!text) return '';

    const prompt = `Correct this sentence into clear natural English. Fix misheard words based on context.
Rules: don't change meaning, don't add info, output ONLY the corrected sentence.

Sentence: ${text}`;

    try {
        const corrected = await geminiGenerate(prompt, 0.2);
        if (corrected.split(' ').length < 3) return 'FAIL_TOO_SHORT';
        if (Math.abs(inputText.length - corrected.length) > inputText.length * 0.5) return inputText;
        return corrected;
    } catch {
        return inputText;
    }
}

// ── Gemini summarization ──────────────────────────────────────────────────────
export async function summarizeText(text) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) throw new Error('TOO_SHORT');

    const prompt = `Summarize the following text in one clear, concise paragraph in natural English.

Rules:
- Output ONLY the summary paragraph — no title, no labels, no bullets, no intro, no outro
- Do NOT include "Summary:", "Key Idea:", "Main Point:", or any prefix
- Keep it under 60 words
- Use plain language

Text:
"${text}"`;

    return await geminiGenerate(prompt, 0.1);
}
