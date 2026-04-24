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

// ── Gemini stock analysis (Financial Educator) ───────────────────────────────
// PURPOSE: Translate raw stock numbers into plain English for everyday users.
//
// WHY THIS EXISTS:
//   Most stock dashboards dump raw numbers — price, change %, volume — with no
//   explanation. This function acts as a financial educator: it takes those
//   same numbers and explains what they actually mean to a beginner. The goal
//   is not to give advice, but to build understanding.
//
// ROLE AS TRANSLATOR:
//   The prompt instructs Gemini to produce exactly 3 sentences, each covering
//   one metric (price → change → volume) in plain, jargon-free English.
//   Each sentence is separated by \n\n so the frontend can optionally style
//   them as distinct paragraphs.
//
// SMART LOCAL FALLBACK:
//   If Gemini is unavailable (rate-limited, network error, quota exhausted),
//   the catch block silently generates the same 3-sentence structure
//   programmatically from the input variables. The user never sees an error
//   message — they always receive a coherent, readable explanation.
//   This protects the UX even when the external AI service is down.
//
// INPUT:  { price, change, volume } (normalized), ticker (string)
// OUTPUT: 3 sentences separated by \n\n  |  or the programmatic fallback
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeStock({ price, change, volume }, ticker) {
    // Guard: if price is missing or "N/A", no meaningful education is possible.
    // Return a safe static message instead of letting Gemini hallucinate.
    if (!price || price === 'N/A') {
        return 'Insufficient data to generate insight.';
    }

    // ── Educator prompt ───────────────────────────────────────────────────────
    // Temperature 0.1 → near-deterministic output, minimal hallucination risk.
    // The model only receives the 3 data points we provide — nothing else.
    const prompt = `You are an AI financial educator built into a premium stock dashboard. Your goal is to explain real-time stock metrics to a beginner in simple, plain English.

Given the following stock data:
Ticker: ${ticker}
Price: $${price}
Change: ${change}%
Volume: ${volume}

Write exactly 3 distinct sentences explaining this data. Separate each sentence with a double line break (\n\n).

Structure your response exactly like this:
Sentence 1: State the current price clearly.
Sentence 2: Explain the daily change percentage and what it implies about buyer vs. seller momentum today (e.g., positive means buyers are driving it up, negative means sellers are driving it down).
Sentence 3: Explain the volume and what it indicates about the stock's "pulse" or activity level.

STRICT RULES & EDGE CASES:

NO financial advice. Do NOT suggest buying, selling, or holding.

NO predictions about future prices.

Use simple, beginner-friendly language (no complex jargon).

EDGE CASE 1: If the volume is 0, '0', or 'N/A', you MUST explicitly explain that a volume of zero indicates there is no active trading right now, meaning this price might be from a previous trading session or the market is closed.

EDGE CASE 2: If the change is 0.00%, explain that the price has remained completely flat with no market movement.

Output ONLY the 3 sentences separated by \\n\\n. No intros, no outros, no markdown bullet points.`;

    try {
        // geminiGenerate retries up to 3 times with backoff on rate-limit errors.
        const insight = await geminiGenerate(prompt, 0.1);
        return insight.trim();
    } catch (err) {
        // ── Smart Local Fallback ──────────────────────────────────────────────
        // Gemini is unavailable (rate limit exhausted, network error, etc.).
        // Instead of returning a generic error string, we silently generate
        // the same 3-sentence structure programmatically. The user experience
        // remains intact — they always receive a readable explanation.
        console.warn('analyzeStock: Gemini unavailable, using local fallback —', err.message);

        // Parse the change value so we can describe momentum direction.
        const changeNum = typeof change === 'number' ? change : parseFloat(change);

        // Sentence 1 — current price.
        const s1 = `${ticker} is currently trading at $${price}.`;

        // Sentence 2 — change and buyer/seller momentum.
        let s2;
        if (isNaN(changeNum) || change === 'N/A') {
            s2 = 'The daily change data is currently unavailable.';
        } else if (changeNum === 0) {
            s2 = 'The stock has remained completely flat today, with no movement in either direction — buyers and sellers are perfectly balanced.';
        } else if (changeNum > 0) {
            s2 = `The stock is up ${Math.abs(changeNum).toFixed(2)}% today, which means buyers have more momentum than sellers and are pushing the price higher.`;
        } else {
            s2 = `The stock is down ${Math.abs(changeNum).toFixed(2)}% today, which means sellers have more momentum than buyers and are pushing the price lower.`;
        }

        // Sentence 3 — volume and market activity.
        const volumeNum = typeof volume === 'number' ? volume : parseFloat(volume);
        let s3;
        if (volume === 'N/A' || volume === 0 || volume === '0' || isNaN(volumeNum) || volumeNum === 0) {
            s3 = 'The volume is currently zero, meaning there is no active trading right now — this price may be from a previous trading session or the market might be closed.';
        } else {
            s3 = `Today's volume of ${Number(volumeNum).toLocaleString()} shares shows the stock is being actively traded, giving investors confidence that this price reflects real, current market activity.`;
        }

        return `${s1}\n\n${s2}\n\n${s3}`;
    }
}
