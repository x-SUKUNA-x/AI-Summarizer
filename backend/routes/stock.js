/* global process */
// -----------------------------------------------------------------------------
// routes/stock.js
//
// GET /api/stock/:ticker
//
// Fetches end-of-day (EOD) stock data from the Marketstack API, calculates the
// daily % change, generates a plain-English AI insight via Gemini, and returns
// the combined result to the frontend.
//
// Features:
//   - 10-minute in-memory cache to preserve the 100 req/month free quota
//   - Auto-maps known Indian NSE tickers to the ".XNSE" exchange suffix
//   - Detects user-supplied ".NS" / ".BSE" suffixes for unlisted Indian stocks
//   - 8-second request timeout to avoid hanging the UI
//   - Layered error handling: HTTP errors, API-level errors, empty data
//   - AI insight with smart local fallback if Gemini is unavailable
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { analyzeStock } from '../services/aiService.js';

const router = Router();

// -----------------------------------------------------------------------------
// fix: removed stray dev console.log that was logging API key status on every
//      single request — floods production logs with noise
// -----------------------------------------------------------------------------

// Marketstack EOD endpoint — returns closing price, volume, open/high/low per day
// Docs: https://marketstack.com/documentation
const MS_BASE_URL = 'https://api.marketstack.com/v1/eod';

// -----------------------------------------------------------------------------
// In-memory cache
//
// Why: Marketstack free tier gives only 100 requests/month. Caching for 10 min
// means repeated lookups of the same ticker within a session cost 0 API calls.
//
// Shape: stockCache['AAPL'] = { data: { price, change, volume, insight }, timestamp: <ms> }
// Keyed by uppercase ticker (e.g. "AAPL", "TCS.XNSE")
// Resets whenever the Node process restarts — this is intentional (EOD data
// doesn't need to survive deploys).
// -----------------------------------------------------------------------------
const CACHE_TTL_MS = 600_000; // 10 minutes
const stockCache = {};

// -----------------------------------------------------------------------------
// fix: expanded Indian stock list from 23 → 50+ tickers to reduce "not found"
//      errors for common NSE stocks that were previously missing from the list
//
// Why this exists: Marketstack requires NSE stocks to be suffixed with ".XNSE"
// (e.g. "RELIANCE.XNSE"). Without the suffix, the API returns a 404. Since
// most Indian users won't know this, we auto-map known tickers for them.
//
// For any NSE stock NOT in this list, users can still type "TICKER.XNSE"
// manually — the suffix detection logic below will preserve it.
// -----------------------------------------------------------------------------
const TOP_INDIAN_STOCKS = new Set([
    // Nifty 50 large-caps
    'TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'SBIN', 'ICICIBANK', 'ITC',
    'BHARTIARTL', 'BAJFINANCE', 'WIPRO', 'TATAMOTORS', 'HINDUNILVR',
    'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA', 'TITAN', 'ONGC',
    'NTPC', 'POWERGRID', 'ULTRACEMCO', 'AXISBANK', 'KOTAKBANK',
    // Additional Nifty 50 / large-cap additions
    'HDFCLIFE', 'BAJAJFINSV', 'BAJAJ-AUTO', 'ADANIENT', 'ADANIPORTS',
    'APOLLOHOSP', 'BPCL', 'BRITANNIA', 'CIPLA', 'COALINDIA',
    'DIVISLAB', 'DRREDDY', 'EICHERMOT', 'GRASIM', 'HEROMOTOCO',
    'HINDALCO', 'INDUSINDBK', 'JSWSTEEL', 'LTIM', 'LT',
    'M&M', 'NESTLEIND', 'SBILIFE', 'SHRIRAMFIN', 'TATACONSUM',
    'TATASTEEL', 'TECHM', 'TRENT', 'UPL', 'VEDL',
]);

// -----------------------------------------------------------------------------
// parseOrNA — safely parses a value to float, returns 'N/A' on failure
//
// Why: Marketstack occasionally returns null or empty strings for volume/price
// on illiquid stocks or market-closed days. Returning 'N/A' instead of NaN
// keeps the response shape consistent and prevents downstream math errors.
// -----------------------------------------------------------------------------
function parseOrNA(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num;
}

// -----------------------------------------------------------------------------
// GET /api/stock/:ticker
//
// Flow:
//   1. Validate ticker
//   2. Check in-memory cache → return immediately on HIT
//   3. Resolve exchange suffix (Indian stocks → .XNSE)
//   4. Fetch 2 days of EOD data from Marketstack (need 2 days for % change)
//   5. Parse price, volume; calculate daily % change
//   6. Generate plain-English AI insight via Gemini
//   7. Write to cache + return { price, change, volume, insight }
// -----------------------------------------------------------------------------
router.get('/:ticker', async (req, res) => {
    const { ticker } = req.params;

    // ── 1. Input validation ──────────────────────────────────────────────────
    if (!ticker || ticker.trim().length === 0) {
        return res.status(400).json({ error: 'Ticker symbol is required.' });
    }

    // Guard: fail fast if the API key is missing rather than making a doomed request
    const apiKey = process.env.STOCK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server misconfiguration: STOCK_API_KEY not set.' });
    }

    // ── 2. Resolve exchange suffix ───────────────────────────────────────────
    // fix: added suffix detection so users can type "HDFCLIFE.NS" or
    //      "RELIANCE.BSE" and get the correct Marketstack symbol without needing
    //      to be in the hardcoded list. Priority order:
    //        a) User already typed ".XNSE" → use as-is
    //        b) User typed ".NS" or ".BSE" → convert to ".XNSE"
    //        c) Ticker is in the known Indian stock set → append ".XNSE"
    //        d) Otherwise → use as-is (US/global ticker, e.g. "AAPL")
    let resolvedTicker = ticker.trim().toUpperCase();

    if (resolvedTicker.endsWith('.XNSE')) {
        // Already in the correct Marketstack format — nothing to do
    } else if (resolvedTicker.endsWith('.NS') || resolvedTicker.endsWith('.BSE')) {
        // Strip the user-facing suffix and replace with Marketstack's format
        resolvedTicker = resolvedTicker.replace(/\.(NS|BSE)$/, '') + '.XNSE';
    } else if (TOP_INDIAN_STOCKS.has(resolvedTicker)) {
        // Auto-map known NSE tickers that users type without any suffix
        resolvedTicker = `${resolvedTicker}.XNSE`;
    }
    // else: US/global ticker — use as-is

    // ── 3. Cache check ───────────────────────────────────────────────────────
    const cached = stockCache[resolvedTicker];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`Cache HIT for ${resolvedTicker} — skipping Marketstack API call`);
        return res.json(cached.data);
    }

    // ── 4. Fetch EOD data from Marketstack ───────────────────────────────────
    // limit=2: we need today's close AND yesterday's close to compute % change.
    // sort=DESC: most recent day is data[0], previous day is data[1].
    const eodUrl = `${MS_BASE_URL}?access_key=${apiKey}&symbols=${encodeURIComponent(resolvedTicker)}&limit=2&sort=DESC`;

    try {
        // 8-second timeout — prevents the request from hanging the UI indefinitely
        // if Marketstack is slow or unresponsive
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const eodRes = await fetch(eodUrl, { signal: controller.signal });
        clearTimeout(timeout);

        // ── HTTP-level error handling ────────────────────────────────────────
        // These fire when the HTTP status itself is an error (4xx / 5xx).
        if (!eodRes.ok) {
            const errData = await eodRes.json().catch(() => ({}));
            const code = errData?.error?.code || '';

            // 429 or explicit rate-limit error codes from Marketstack
            if (eodRes.status === 429 || code === 'too_many_requests' || code === 'rate_limit_reached') {
                return res.status(429).json({
                    error: 'Monthly API limit reached. Marketstack free tier allows 100 requests/month. Please try again next month or upgrade your plan.',
                    rateLimit: true,
                });
            }

            // 401 means the API key itself is wrong — not a user error
            if (eodRes.status === 401) {
                return res.status(500).json({ error: 'Invalid API key. Please check STOCK_API_KEY in your environment variables.' });
            }

            // All other HTTP errors — Marketstack is down or returning unexpected responses
            return res.status(502).json({ error: 'Stock data service is temporarily unavailable. Please try again shortly.' });
        }

        const body = await eodRes.json();

        // ── API-level error handling ─────────────────────────────────────────
        // Marketstack sometimes returns HTTP 200 but includes an "error" key in
        // the body (e.g. invalid symbol, quota exhausted). Handle those here.
        if (body?.error) {
            const code = body.error.code || '';
            const msg = body.error.message || 'Unknown error from stock data provider.';

            if (code === 'too_many_requests' || code === 'rate_limit_reached') {
                return res.status(429).json({
                    error: 'Monthly API limit reached. Marketstack free tier allows 100 requests/month.',
                    rateLimit: true,
                });
            }

            // Symbol not found or malformed — this is a user input error
            if (code === '404_not_found' || code === 'validation_error' || code === 'invalid_api_function') {
                return res.status(400).json({
                    error: `Symbol "${resolvedTicker}" not found. Please check the ticker and try again. For Indian stocks, you can also try adding ".NS" (e.g. "HDFCLIFE.NS").`,
                });
            }

            return res.status(400).json({ error: msg });
        }

        // ── Empty data guard ─────────────────────────────────────────────────
        // Valid response but no trading rows — market may be closed or the
        // symbol exists in Marketstack's registry but has no recent trading data
        const eodData = body?.data;
        if (!eodData || eodData.length === 0) {
            return res.status(400).json({
                error: `No trading data found for "${resolvedTicker}". The market may be closed, or this symbol has no recent data on Marketstack.`,
            });
        }

        // ── 5. Parse price, volume, and calculate daily % change ─────────────
        // data[0] = most recent trading day (latest)
        // data[1] = previous trading day (used only for % change calculation)
        const latest = eodData[0];
        const previous = eodData[1] || null;

        const price = parseOrNA(latest.close);
        const volume = parseOrNA(latest.volume);

        // Daily change % = ((today's close - yesterday's close) / yesterday's close) × 100
        // Returns 'N/A' if we only have one day of data or previous close is 0
        let change = 'N/A';
        if (price !== 'N/A' && previous) {
            const prevClose = parseOrNA(previous.close);
            if (prevClose !== 'N/A' && prevClose !== 0) {
                change = parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2));
            }
        }

        const normalized = { price, change, volume };

        // ── 6. Generate AI insight ───────────────────────────────────────────
        // Sends price/change/volume to Gemini which returns 3 plain-English
        // sentences explaining the data to a beginner investor.
        // headlines = null because Marketstack free tier has no news endpoint.
        // If Gemini is unavailable, analyzeStock() has a built-in local fallback.
        const insight = await analyzeStock(normalized, resolvedTicker, null);

        // ── 7. Cache and return ──────────────────────────────────────────────
        // Only cache on full success — never cache partial or error responses
        const responseData = { ...normalized, insight };
        stockCache[resolvedTicker] = { data: responseData, timestamp: Date.now() };

        return res.json(responseData);

    } catch (err) {
        // AbortError fires when the 8-second timeout triggers
        if (err.name === 'AbortError') {
            return res.status(504).json({
                error: 'Stock data request timed out after 8 seconds. Please try again.',
            });
        }

        // Unexpected errors (network failure, JSON parse error, etc.)
        console.error(`Stock fetch error for "${resolvedTicker}":`, err.message);
        return res.status(500).json({ error: 'Failed to fetch stock data. Please try again.' });
    }
});

export default router;
