/* global process */
import { Router } from 'express';
import { analyzeStock } from '../services/aiService.js';

const router = Router();

// ── Alpha Vantage API base URL ────────────────────────────────────────────────
// Docs: https://www.alphavantage.co/documentation/#global-quote
// Endpoint used: GLOBAL_QUOTE
//
// Assuming response format is from Global Quote endpoint:
// {
//   "Global Quote": {
//     "05. price":          "150.5000",
//     "06. volume":         "12345678",
//     "10. change percent": "1.0067%"
//   }
// }
const AV_BASE_URL = 'https://www.alphavantage.co/query';

// ── Helper: parse a string value to a float, or return "N/A" ─────────────────
// Alpha Vantage returns all numbers as strings (e.g., "150.5000").
// We convert to float for clean output; fallback to "N/A" if missing/invalid.
function parseOrNA(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num;
}

// ── Helper: strip the trailing "%" from change percent (e.g., "1.0067%" → 1.0067) ──
function parseChangePercent(value) {
    if (!value || typeof value !== 'string') return 'N/A';
    const num = parseFloat(value.replace('%', ''));
    return isNaN(num) ? 'N/A' : num;
}

// ── GET /api/stock/:ticker ────────────────────────────────────────────────────
// Request flow:
//   1. Frontend sends GET /api/stock/AAPL
//   2. We call Alpha Vantage GLOBAL_QUOTE with the ticker + API key
//   3. We validate the response (handles invalid symbol + rate limit)
//   4. We normalize into { price, change, volume } and send to frontend
router.get('/:ticker', async (req, res) => {
    const { ticker } = req.params;

    // Basic guard — reject obviously bad input before hitting the API
    if (!ticker || ticker.trim().length === 0) {
        return res.status(400).json({ error: 'Ticker symbol is required.' });
    }

    const apiKey = process.env.STOCK_API_KEY;

    // Guard against missing env var — fail clearly in dev
    if (!apiKey) {
        console.error('❌  STOCK_API_KEY is not set in .env');
        return res.status(500).json({ error: 'Stock API key not configured on server.' });
    }

    // ── Build Alpha Vantage URL ───────────────────────────────────────────────
    const url = `${AV_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker.toUpperCase())}&apikey=${apiKey}`;

    try {
        // ── Fetch from Alpha Vantage (Node 18+ built-in fetch) ────────────────
        // AbortController gives us a hard 8-second timeout.
        // AV free tier can be slow — this prevents the request from hanging
        // indefinitely and blocking the response.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let response;
        try {
            response = await fetch(url, { signal: controller.signal });
        } catch (fetchErr) {
            // AbortError = timeout; any other error = network failure
            const isTimeout = fetchErr.name === 'AbortError';
            return res.status(504).json({
                error: isTimeout
                    ? 'Stock service timed out. Please try again.'
                    : 'Stock service unavailable.',
            });
        } finally {
            clearTimeout(timeoutId); // always clear timer to prevent memory leak
        }

        if (!response.ok) {
            // Non-2xx from Alpha Vantage itself (rare, but handle it)
            return res.status(502).json({ error: 'Stock service unavailable.' });
        }

        const data = await response.json();

        // ── Validate response structure ───────────────────────────────────────
        // "Global Quote" key is absent when:
        //   - Symbol doesn't exist (e.g., typo)
        //   - Free-tier rate limit exceeded (AV returns a "Note" or "Information" key)
        //   - Network/API issue on their end
        const quote = data?.['Global Quote'];

        if (!quote || Object.keys(quote).length === 0) {
            // Surface the Alpha Vantage note/message if present, for better debugging
            const avMessage = data?.['Note'] || data?.['Information'] || null;

            if (avMessage) {
                // Rate limit hit — AV free tier: 25 req/day, 5 req/min
                console.warn('⚠️  Alpha Vantage rate limit or info message:', avMessage);
                return res.status(429).json({
                    error: 'API limit reached. Please wait a moment and try again.',
                });
            }

            // Invalid symbol — "Global Quote" is empty object {}
            // 400 = bad client input (the ticker they sent doesn't exist)
            return res.status(400).json({
                error: 'Invalid stock symbol. Please check and try again.',
            });
        }

        // ── Data transformation ───────────────────────────────────────────────
        // Map only the three fields we care about.
        // Alpha Vantage keys use numbered prefixes ("05. price", etc.) —
        // we extract these by exact key name and normalize them.
        const normalized = {
            price:  parseOrNA(quote['05. price']),
            change: parseChangePercent(quote['10. change percent']),
            volume: parseOrNA(quote['06. volume']),
        };

        // ── AI Insight (Phase 2) ──────────────────────────────────────────────
        // Call analyzeStock after normalization so it only runs on valid data.
        // It handles its own errors internally — if Gemini fails, it returns a
        // safe fallback string so stock data is never blocked by an AI failure.
        const insight = await analyzeStock(normalized, ticker.toUpperCase());

        return res.json({ ...normalized, insight });

    } catch (err) {
        // Network failure or unexpected JSON parse error
        console.error('Stock fetch error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stock data. Please try again.' });
    }
});

export default router;
