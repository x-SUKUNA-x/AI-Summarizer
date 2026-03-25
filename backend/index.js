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

const app = express();

// ── CORS — allow credentials so cookies are sent ──────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Allow any localhost origin (any port) + requests with no origin (curl, Postman)
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
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

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅  Server running on port ${PORT}`));
