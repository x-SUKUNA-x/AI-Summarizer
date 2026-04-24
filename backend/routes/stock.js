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

// ── In-memory cache ───────────────────────────────────────────────────
// Declared at MODULE level so it persists across all requests for the lifetime
// of the Node process. Each entry shape:
//   stockCache['AAPL'] = { data: { price, change, volume, insight }, timestamp: <ms> }
//
// Why in-memory and not Redis?
//   This is a free-tier project. In-memory is zero-dependency and survives
//   the request cycle. It resets on server restart, which is acceptable because
//   stock prices change frequently anyway.
const CACHE_TTL_MS = 60_000; // 60 seconds — balances freshness vs AV rate limit
const stockCache  = {};      // keyed by uppercase ticker symbol

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

    // ── Cache check ───────────────────────────────────────────────────
    // Always normalise to uppercase so 'aapl', 'Aapl', 'AAPL' all share one entry.
    const cacheKey    = ticker.toUpperCase();
    const cachedEntry = stockCache[cacheKey];

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        // Cache HIT — entry exists and is still fresh.
        // Return immediately: zero calls to Alpha Vantage or Gemini.
        console.log(`✅  CACHE HIT: ${cacheKey}`);
        return res.json(cachedEntry.data);
    }

    // Cache MISS — either no entry or TTL expired. Proceed with live fetch.
    console.log(`🔄  CACHE MISS: ${cacheKey}`);

    // ── Build Alpha Vantage URLs ──────────────────────────────────────────────
    // Two endpoints built here so they can fire concurrently via Promise.all.
    const quoteUrl = `${AV_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(cacheKey)}&apikey=${apiKey}`;
    const newsUrl  = `${AV_BASE_URL}?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(cacheKey)}&apikey=${apiKey}`;

    try {
        // ── Key guard (temporary dev log) ─────────────────────────────────────
        console.log('Using AV Key:', process.env.STOCK_API_KEY ? 'Loaded ✅' : 'MISSING ❌');

        // ── Action: Fetch Market Context (Concurrent) ─────────────────────────
        // Why: Firing both requests concurrently with Promise.all means total wait
        // time is max(quoteTime, newsTime) not quoteTime + newsTime. On AV free
        // tier this saves 2–4 seconds per cache miss.
        //
        // The quote has an 8s AbortController. News has its own 6s controller
        // inside fetchNews(). If news fails for any reason it returns null —
        // the quote path is never blocked or crashed by a news failure.
        const quoteController = new AbortController();
        const quoteTimeout    = setTimeout(() => quoteController.abort(), 8000);

        // ── Action: Fetch News Headlines (Graceful Degradation) ───────────────
        // Why: News context lets Gemini answer "why is this stock moving today?"
        // It is always optional — if NEWS_SENTIMENT is rate-limited, slow, or
        // unavailable we silently return null and produce 3 sentences instead of 4.
        const fetchNews = async () => {
            try {
                const newsController = new AbortController();
                const newsTimeout    = setTimeout(() => newsController.abort(), 6000);
                const newsRes        = await fetch(newsUrl, { signal: newsController.signal });
                clearTimeout(newsTimeout);

                if (!newsRes.ok) return null;

                const newsData = await newsRes.json();

                if (!newsData?.feed || newsData.feed.length === 0) return null;

                // Extract top 3 headlines — enough context without bloating the prompt.
                return newsData.feed
                    .slice(0, 3)
                    .map((article, i) => `${i + 1}. ${article.title}`)
                    .join(' ');
            } catch {
                return null; // timeout / network error / rate limit — always degrade gracefully
            }
        };

        // Fire quote + news at the exact same time.
        let quoteResponse;
        const [resolvedQuote, headlines] = await Promise.all([
            fetch(quoteUrl, { signal: quoteController.signal }).catch((fetchErr) => {
                clearTimeout(quoteTimeout);
                const isTimeout = fetchErr.name === 'AbortError';
                return res.status(504).json({
                    error: isTimeout
                        ? 'Stock service timed out. Please try again.'
                        : 'Stock service unavailable.',
                });
            }),
            fetchNews(),
        ]);
        clearTimeout(quoteTimeout);
        quoteResponse = resolvedQuote;

        // If the quote handler already sent an error response above, stop.
        if (res.headersSent) return;

        if (!quoteResponse.ok) {
            return res.status(502).json({ error: 'Stock service unavailable.' });
        }

        const data = await quoteResponse.json();

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
                    // Action: Surface a friendly, informative rate-limit message.
                    // Why: A raw "API limit reached" error is confusing for non-technical
                    // users. We tell them what happened, when it resets, and what they
                    // CAN still do (use cached recent searches). The rateLimit flag lets
                    // the frontend distinguish this from a user-error (wrong ticker) so
                    // it can show amber instead of red — communicating "temporary" vs "mistake".
                    error: "We've hit our data limit for today. Real-time quotes reset at midnight EST. In the meantime, try searching a stock you've already looked up recently — it may still be cached!",
                    rateLimit: true,
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

        // ── AI Insight (Phase 3 — Why Engine) ────────────────────────────────
        // Pass headlines as a third argument so Gemini can synthesize a 4th
        // sentence explaining the news driving today's price movement.
        // If headlines is null (news unavailable), analyzeStock produces 3 sentences.
        const insight = await analyzeStock(normalized, cacheKey, headlines);

        // ── Cache write ──────────────────────────────────────────────────
        // Only written here — on the SUCCESS path, after full data is available.
        // Errors (400, 429, 502, 504) never reach this line, so they are
        // never cached. A bad response will always trigger a fresh live fetch.
        const responseData = { ...normalized, insight };
        stockCache[cacheKey] = { data: responseData, timestamp: Date.now() };

        return res.json(responseData);

    } catch (err) {
        // Network failure or unexpected JSON parse error
        console.error('Stock fetch error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stock data. Please try again.' });
    }
});

export default router;
