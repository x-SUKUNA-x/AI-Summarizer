/* global process */
import { Router } from 'express';
import { analyzeStock } from '../services/aiService.js';

const router = Router();

// ── Marketstack API ───────────────────────────────────────────────────────────
// Docs: https://marketstack.com/documentation
// Endpoint: GET /v1/eod?access_key=KEY&symbols=AAPL&limit=2
//
// Why limit=2?
//   We need 2 days of EOD data to calculate daily % change:
//   change% = ((today.close - yesterday.close) / yesterday.close) × 100
//
// Free plan: 100 requests/month, HTTPS supported, global stocks (50+ countries)
const MS_BASE_URL = 'https://api.marketstack.com/v1/eod';

// ── In-memory cache ───────────────────────────────────────────────────────────
// Persists for the lifetime of the Node process.
// Shape: stockCache['AAPL'] = { data: { price, change, volume, insight }, timestamp: <ms> }
//
// 10-minute TTL conserves the 100 req/month free quota:
//   - Same ticker within 10 min → 0 API calls (cache hit)
//   - Unique tickers: 100 calls ~ 100 unique lookups per month
const CACHE_TTL_MS = 600_000; // 10 minutes
const stockCache  = {};       // keyed by uppercase ticker symbol

// ── Helper: parse to float or return 'N/A' ───────────────────────────────────
function parseOrNA(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num;
}

// ── GET /api/stock/:ticker ────────────────────────────────────────────────────
// Flow:
//   1. Check in-memory cache → return immediately on HIT
//   2. Fetch 2 days of EOD from Marketstack
//   3. Calculate change % from previous close → current close
//   4. Send { price, change, volume } to Gemini for plain-English insight
//   5. Cache result + return { price, change, volume, insight }
router.get('/:ticker', async (req, res) => {
    const { ticker } = req.params;

    if (!ticker || ticker.trim().length === 0) {
        return res.status(400).json({ error: 'Ticker symbol is required.' });
    }

    const apiKey  = process.env.STOCK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server misconfiguration: STOCK_API_KEY not set.' });
    }

    // ── Key guard (dev log) ───────────────────────────────────────────────────
    console.log('Using Marketstack Key:', apiKey ? 'Loaded ✅' : 'MISSING ❌');

    // ── Auto-map Indian Stocks ────────────────────────────────────────────────
    let cacheKey = ticker.toUpperCase();
    const topIndianStocks = [
        'TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'SBIN', 'ICICIBANK', 'ITC', 
        'BHARTIARTL', 'BAJFINANCE', 'WIPRO', 'TATAMOTORS', 'HINDUNILVR', 
        'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA', 'TITAN', 'ONGC', 
        'NTPC', 'POWERGRID', 'ULTRACEMCO', 'AXISBANK', 'KOTAKBANK'
    ];
    if (topIndianStocks.includes(cacheKey)) {
        cacheKey = `${cacheKey}.XNSE`;
    }

    // ── Cache check ───────────────────────────────────────────────────────────
    const cachedEntry = stockCache[cacheKey];
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        console.log(`📦 Cache HIT for ${cacheKey} — skipping API call`);
        return res.json(cachedEntry.data);
    }

    // ── Build URL: fetch last 2 trading days ──────────────────────────────────
    const eodUrl = `${MS_BASE_URL}?access_key=${apiKey}&symbols=${encodeURIComponent(cacheKey)}&limit=2&sort=DESC`;

    try {
        // ── 8-second timeout ─────────────────────────────────────────────────
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 8000);

        const eodRes = await fetch(eodUrl, { signal: controller.signal });
        clearTimeout(timeout);

        // ── HTTP-level errors ─────────────────────────────────────────────────
        if (!eodRes.ok) {
            const errData = await eodRes.json().catch(() => ({}));
            const code    = errData?.error?.code || '';

            if (eodRes.status === 429 || code === 'too_many_requests' || code === 'rate_limit_reached') {
                return res.status(429).json({
                    error: "Monthly API limit reached. Marketstack free tier allows 100 requests/month. Please try again next month or upgrade your plan.",
                    rateLimit: true,
                });
            }

            if (eodRes.status === 401) {
                return res.status(500).json({ error: 'Invalid API key. Please check your STOCK_API_KEY in .env.' });
            }

            return res.status(502).json({ error: 'Stock data service is temporarily unavailable.' });
        }

        const body = await eodRes.json();

        // ── API-level errors (status 200 but error key present) ───────────────
        if (body?.error) {
            const code = body.error.code || '';
            const msg  = body.error.message || 'Unknown error.';

            if (code === 'too_many_requests' || code === 'rate_limit_reached') {
                return res.status(429).json({
                    error: "Monthly API limit reached. Marketstack free tier allows 100 requests/month.",
                    rateLimit: true,
                });
            }

            if (code === '404_not_found' || code === 'validation_error' || code === 'invalid_api_function') {
                return res.status(400).json({
                    error: `Symbol "${cacheKey}" not found. Please check the ticker and try again.`,
                });
            }

            return res.status(400).json({ error: msg });
        }

        // ── Validate response has data ────────────────────────────────────────
        const eodData = body?.data;

        if (!eodData || eodData.length === 0) {
            return res.status(400).json({
                error: `No trading data found for "${cacheKey}". The market may be closed, or this symbol doesn't exist on Marketstack.`,
            });
        }

        // ── Extract price, volume, and calculate change % ─────────────────────
        // data[0] = latest trading day, data[1] = previous trading day
        const latest   = eodData[0];
        const previous = eodData[1] || null;

        const price  = parseOrNA(latest.close);
        const volume = parseOrNA(latest.volume);

        // Daily change %: ((current close - previous close) / previous close) × 100
        let change = 'N/A';
        if (price !== 'N/A' && previous) {
            const prevClose = parseOrNA(previous.close);
            if (prevClose !== 'N/A' && prevClose !== 0) {
                change = parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2));
            }
        }

        const normalized = { price, change, volume };

        // ── AI Insight ────────────────────────────────────────────────────────
        // Marketstack free tier has no news endpoint → headlines = null
        // Gemini will write 3 sentences (price + change + volume).
        // If Gemini fails, the Smart Local Fallback kicks in automatically.
        const insight = await analyzeStock(normalized, cacheKey, null);

        // ── Cache write (only on success) ─────────────────────────────────────
        const responseData = { ...normalized, insight };
        stockCache[cacheKey] = { data: responseData, timestamp: Date.now() };

        return res.json(responseData);

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({
                error: 'Stock data request timed out after 8 seconds. Please try again.',
            });
        }
        console.error('Stock fetch error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stock data. Please try again.' });
    }
});

export default router;
