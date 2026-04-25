/* global process */
// -----------------------------------------------------------------------------
// services/aiService.js
//
// All AI model calls live here — Gemini (Google) for text tasks and
// Whisper via Groq for audio transcription.
//
// Exports:
//   transcribeAudio(buffer, filename, mimetype) — audio → text (Groq/Whisper)
//   correctText(inputText)                      — fix misheard words (Gemini)
//   summarizeText(text)                         — summarize transcript (Gemini)
//   analyzeStock({ price, change, volume }, ticker, headlines) — stock insight (Gemini)
// -----------------------------------------------------------------------------

// Gemini 2.5 Flash — fast, low-cost, good at structured text generation
const GEMINI_MODEL = 'gemini-2.5-flash';

// Sleep helper — used to wait between rate-limited retries
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// geminiGenerate — core Gemini API call with rate-limit retry
//
// fix: added a 15-second AbortController timeout. Previously if Gemini hung
//      (network stall, slow response), the request would wait indefinitely
//      and block the calling route handler, eventually causing the UI to freeze.
//
// fix: GEMINI_API_KEY is now checked before making the fetch. Previously a
//      missing key would construct a URL with "undefined" as the key value,
//      resulting in a confusing 400 response from the Gemini API instead of
//      a clear server error.
//
// @param {string} prompt        — the full prompt to send
// @param {number} temperature   — 0.0 = deterministic, 1.0 = creative (default 0.1)
// @param {number} maxAttempts   — how many times to retry on rate-limit (default 3)
// -----------------------------------------------------------------------------
async function geminiGenerate(prompt, temperature = 0.1, maxAttempts = 3) {
    const apiKey = process.env.GEMINI_API_KEY;

    // Fail immediately with a clear message rather than sending "undefined" as the key
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // 15-second timeout per attempt — prevents indefinite hangs
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        let res;
        try {
            res = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature },
                    }),
                }
            );
        } catch (fetchErr) {
            clearTimeout(timeout);
            // AbortError means our 15s timeout fired
            if (fetchErr.name === 'AbortError') {
                throw new Error('Gemini request timed out after 15 seconds.');
            }
            throw fetchErr;
        }
        clearTimeout(timeout);

        // 429 = rate limited — Gemini may include a retry-after duration in the error body
        if (res.status === 429) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error?.message || '';
            const retryMatch = msg.match(/retry in ([\d.]+)s/i);
            const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500 : 20000;

            // If the wait time is too long, fail fast rather than blocking for 20+ seconds
            if (waitMs > 5000) {
                console.warn(`Gemini rate limited — wait time too long (${waitMs}ms), failing fast.`);
                throw new Error('Gemini rate limited. Please wait a moment and try again.');
            }

            console.warn(`Gemini rate limited. Waiting ${waitMs}ms before retry (attempt ${attempt}/${maxAttempts})...`);
            if (attempt < maxAttempts) {
                await sleep(waitMs);
                continue;
            }
            throw new Error('Gemini is rate limited. Please wait a moment and try again.');
        }

        // Any other non-OK response is an unexpected API error
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Gemini API error: HTTP ${res.status}`);
        }

        // Extract the text from the response — candidates[0].content.parts[0].text
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;

        throw new Error('Gemini returned an empty response.');
    }
}

// -----------------------------------------------------------------------------
// transcribeAudio — converts an audio buffer to text using Groq's Whisper API
//
// Why Groq: Groq runs Whisper inference much faster than OpenAI's hosted API,
// making it practical for a responsive UI. Model: whisper-large-v3.
//
// Hallucination handling: Whisper sometimes returns common hallucinated phrases
// (e.g. "Thanks for watching!") when the audio is silent or unclear. We detect
// these and retry once with the same audio. If the second attempt also hallucinates,
// we return the first result rather than throwing — imperfect output beats a crash.
//
// @param {Buffer} buffer      — raw audio bytes
// @param {string} originalname — filename (used by Groq to detect format)
// @param {string} mimetype    — MIME type of the audio (e.g. "audio/webm")
// @returns {Promise<string>} — transcribed text
// -----------------------------------------------------------------------------
export async function transcribeAudio(buffer, originalname, mimetype) {
    // Known Whisper hallucinations — phrases returned when audio is silent or unclear
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
        formData.append('temperature', '0.0');  // 0.0 = most deterministic, least hallucination-prone
        formData.append('prompt', 'The user is speaking clear English. Transcribe exactly what is spoken.');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (attempt === 2) throw new Error(err?.error?.message || 'Groq transcription API error.');
            continue; // retry on first attempt
        }

        const data = await res.json();
        const text = data.text?.trim() || '';
        const lower = text.toLowerCase();
        const suspicious = !text || text.length < 3 || HALLUCINATIONS.some(h => lower.includes(h));

        if (suspicious) {
            // Save the first result in case the retry is also bad
            if (text && attempt === 1) lastTranscript = text;
            if (attempt === 2) {
                // Both attempts were suspicious — return the first result if available,
                // otherwise tell the user the audio was unclear
                if (lastTranscript) return lastTranscript;
                throw new Error('Speech unclear, please repeat.');
            }
            continue; // retry once on hallucination detection
        }

        return text;
    }
}

// -----------------------------------------------------------------------------
// correctText — fixes common transcription errors using Gemini
//
// Why: Whisper occasionally mishears words based on phonetic similarity
// (e.g. "skull" instead of "school"). This function applies known fixes first,
// then sends the text to Gemini to fix remaining context-based errors.
//
// Returns the original input unchanged if Gemini fails or the correction looks
// wrong (more than 50% length difference from original = probably hallucinating).
//
// @param {string} inputText — raw Whisper transcript
// @returns {Promise<string>} — corrected text (or original if correction fails)
// -----------------------------------------------------------------------------
export async function correctText(inputText) {
    if (!inputText) return inputText;

    // Apply known phonetic fixes before sending to Gemini (saves API calls)
    const fixes = {
        drunk: 'wrong',
        drink: 'wrong',
        skull: 'school',
        'thanks for watching': '',
    };
    let text = inputText.toLowerCase();
    for (const [bad, good] of Object.entries(fixes)) {
        text = text.split(bad).join(good);
    }
    text = text.trim();
    if (!text) return '';

    const prompt = `Correct this sentence into clear natural English. Fix misheard words based on context.
Rules: don't change meaning, don't add info, output ONLY the corrected sentence.

Sentence: ${text}`;

    try {
        const corrected = await geminiGenerate(prompt, 0.2);
        // Sanity checks — if the correction is suspiciously short or radically different
        // in length, fall back to the original rather than returning garbage
        if (corrected.split(' ').length < 3) return 'FAIL_TOO_SHORT';
        if (Math.abs(inputText.length - corrected.length) > inputText.length * 0.5) return inputText;
        return corrected;
    } catch {
        // Gemini unavailable — return original text unchanged rather than failing the request
        return inputText;
    }
}

// -----------------------------------------------------------------------------
// summarizeText — condenses a transcript into one short paragraph using Gemini
//
// Rejects inputs under 5 words — there's not enough content to summarise.
// The prompt is tightly constrained to prevent Gemini from adding headers,
// bullets, or preamble that would look odd in the UI.
//
// @param {string} text — transcript text to summarise
// @returns {Promise<string>} — one-paragraph summary (under 60 words)
// @throws Error('TOO_SHORT') if input is under 5 words
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// analyzeStock — translates raw stock numbers into plain-English insight
//
// WHY THIS EXISTS:
//   Most stock dashboards show raw numbers (price, %, volume) with no context.
//   This function acts as a "financial educator" — it explains what the numbers
//   mean in beginner-friendly language, including buyer/seller momentum and
//   what a high or zero volume actually implies.
//
// OUTPUT STRUCTURE (3 sentences, or 4 if headlines are provided):
//   S1: Current price
//   S2: Daily % change + buyer/seller momentum interpretation
//   S3: Volume + what it means for market activity
//   S4: (optional) News headlines synthesized into one sentence
//
// SMART LOCAL FALLBACK:
//   If Gemini is unavailable, the catch block generates the same 3-sentence
//   structure programmatically so the UI always shows something useful.
//
// @param {{ price, change, volume }} stockData — parsed stock metrics
// @param {string} ticker                       — stock symbol (e.g. "AAPL")
// @param {string|null} headlines               — pre-formatted news headlines or null
// @returns {Promise<string>} — sentences separated by \n\n
// -----------------------------------------------------------------------------
export async function analyzeStock({ price, change, volume }, ticker, headlines = null) {
    // Guard: no price data means we can't generate anything meaningful
    if (!price || price === 'N/A') {
        return 'Insufficient data to generate insight.';
    }

    const prompt = `You are an AI financial educator built into a premium stock dashboard. Your goal is to explain real-time stock metrics to a beginner in simple, plain English.

Given the following stock data:
Ticker: ${ticker}
Price: $${price}
Change: ${change}%
Volume: ${volume}

Latest News Headlines:
${headlines ? headlines : 'No recent news available.'}

Write 3 distinct sentences explaining the data. If news headlines are provided, also write a 4th sentence. Separate each sentence with a double line break (\\n\\n).

Structure your response exactly like this:
Sentence 1: State the current price clearly.
Sentence 2: Explain the daily change percentage and what it implies about buyer vs. seller momentum today.
Sentence 3: Explain the volume and what it indicates about the stock's activity level.
Sentence 4 (ONLY if news headlines are provided): Synthesize the headlines into one sentence explaining how they may be driving today's momentum.

STRICT RULES:
- NO financial advice. Do NOT suggest buying, selling, or holding.
- NO predictions about future prices.
- Use simple, beginner-friendly language (no jargon).
- If volume is 0 or N/A: state that there is no active trading and the price may be from a prior session.
- If change is 0.00%: state the price has remained completely flat.

Output ONLY the sentences separated by \\n\\n. No intros, no outros, no markdown.`;

    try {
        // maxAttempts=1 — stock insight is non-critical; we'd rather fall back
        // immediately than retry and delay the UI response
        const insight = await geminiGenerate(prompt, 0.1, 1);
        return insight.trim();
    } catch (err) {
        // Smart local fallback — Gemini is down or rate-limited.
        // Generate the same 3-sentence structure programmatically so the user
        // always sees a readable explanation, not an error message.
        console.warn('analyzeStock: Gemini unavailable, using local fallback —', err.message);

        const changeNum = typeof change === 'number' ? change : parseFloat(change);

        // S1 — price
        const s1 = `${ticker} is currently trading at $${price}.`;

        // S2 — change and momentum direction
        let s2;
        if (isNaN(changeNum) || change === 'N/A') {
            s2 = 'The daily change data is currently unavailable.';
        } else if (changeNum === 0) {
            s2 = 'The stock has remained completely flat today — buyers and sellers are in perfect balance.';
        } else if (changeNum > 0) {
            s2 = `The stock is up ${Math.abs(changeNum).toFixed(2)}% today, meaning buyers have more momentum and are pushing the price higher.`;
        } else {
            s2 = `The stock is down ${Math.abs(changeNum).toFixed(2)}% today, meaning sellers have more momentum and are pushing the price lower.`;
        }

        // S3 — volume and trading activity
        const volumeNum = typeof volume === 'number' ? volume : parseFloat(volume);
        let s3;
        if (volume === 'N/A' || volume === 0 || volume === '0' || isNaN(volumeNum) || volumeNum === 0) {
            s3 = 'Volume is currently zero — there is no active trading right now, so this price may be from a previous session or the market may be closed.';
        } else {
            s3 = `Today's trading volume of ${Number(volumeNum).toLocaleString()} shares indicates the stock is actively traded, meaning this price reflects real current market activity.`;
        }

        return `${s1}\n\n${s2}\n\n${s3}${headlines ? `\n\nRecent news: ${headlines}` : ''}`;
    }
}
