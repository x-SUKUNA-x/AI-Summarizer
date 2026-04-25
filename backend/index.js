/* global process */
// -----------------------------------------------------------------------------
// index.js — Express server entry point
//
// Responsibilities:
//   1. Validate all required environment variables at startup (fail fast)
//   2. Configure CORS to allow credentialed cross-origin requests
//   3. Mount all route handlers
//   4. Provide a global error handler so uncaught route errors return JSON
//      (not Express's default HTML error page, which breaks API clients)
// -----------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

// -----------------------------------------------------------------------------
// Startup environment guard
//
// fix: previously only JWT_SECRET was checked. SUPABASE_URL, SUPABASE_SERVICE_KEY,
//      and STOCK_API_KEY were not validated at startup, so the server would boot
//      fine but silently fail on the first request that needed them. Now all
//      required vars are checked before anything else — if any are missing the
//      process exits immediately with a clear message.
// -----------------------------------------------------------------------------
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'STOCK_API_KEY'];
const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    console.error(`❌  Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('    Add them to your .env file and restart the server.');
    process.exit(1);
}

import authRoutes from './routes/auth.js';
import summarizeRoutes from './routes/summarize.js';
import summariesRoutes from './routes/summaries.js';
import stockRoutes from './routes/stock.js';
import watchlistRoutes from './routes/watchlist.js';

const app = express();

// -----------------------------------------------------------------------------
// CORS configuration
//
// credentials: true — required so the browser sends HTTP-only cookies
//              cross-origin (Vercel frontend → Render backend)
//
// origin allowlist:
//   - Any localhost port (for local development)
//   - FRONTEND_URL from env (production Vercel URL)
//
// Requests with no Origin header (e.g. curl, Postman, server-to-server) are
// allowed through — the !origin check handles that case.
// -----------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
    /^http:\/\/localhost:\d+$/,       // any localhost port — dev only
    /^https:\/\/.*\.vercel\.app$/,    // any Vercel preview/prod deployment
    process.env.FRONTEND_URL,         // explicit production URL if set
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        const allowed = !origin || ALLOWED_ORIGINS.some(o =>
            o instanceof RegExp ? o.test(origin) : o === origin
        );
        allowed
            ? callback(null, true)
            : callback(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser()); // needed to read the JWT from the HTTP-only 'token' cookie

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api', summarizeRoutes);           // /api/transcribe, /api/summarize, /api/correct
app.use('/api/summaries', summariesRoutes); // /api/summaries
app.use('/api/stock', stockRoutes);         // /api/stock/:ticker
app.use('/api/watchlist', watchlistRoutes); // /api/watchlist

// Health check — used by uptime monitors and deployment platforms to verify
// the server is running and reachable
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// -----------------------------------------------------------------------------
// Global error handler
//
// fix: without this, any unhandled error thrown inside a route (e.g. a missing
//      try/catch, a middleware crash) causes Express to send an HTML error page.
//      API clients (React frontend, Postman) expect JSON — this ensures they
//      always get a consistent { error: '...' } response even in unexpected cases.
//
// Must be defined AFTER all routes (Express identifies error handlers by their
// 4-argument signature: err, req, res, next).
// -----------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err.message);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅  Server running on port ${PORT}`));