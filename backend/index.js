/* global process */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

// ── Startup environment guard ─────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
    console.error('❌  JWT_SECRET is not set in .env — server cannot start safely');
    process.exit(1);
}


import authRoutes from './routes/auth.js';
import summarizeRoutes from './routes/summarize.js';
import summariesRoutes from './routes/summaries.js';
import stockRoutes from './routes/stock.js';
import watchlistRoutes from './routes/watchlist.js';

const app = express();

// ── CORS — allow credentials so cookies are sent ──────────────────────────────
const ALLOWED_ORIGINS = [
    /^http:\/\/localhost:\d+$/,                    // any local port (dev)
    process.env.FRONTEND_URL,                      // e.g. https://your-app.vercel.app
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.some(o =>
            o instanceof RegExp ? o.test(origin) : o === origin
        )) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());  // parse HTTP-only cookies

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', summarizeRoutes);   // /api/transcribe, /api/summarize, /api/correct
app.use('/api/summaries', summariesRoutes);
app.use('/api/stock', stockRoutes);     // /api/stock/:ticker
app.use('/api/watchlist', watchlistRoutes); // /api/watchlist

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅  Server running on port ${PORT}`));
