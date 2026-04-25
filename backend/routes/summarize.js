// -----------------------------------------------------------------------------
// routes/summarize.js
//
// Handles all AI-powered text processing routes — no authentication required
// on any of these endpoints. The frontend decides whether to save the result.
//
// Endpoints:
//   POST /api/transcribe — audio file → transcript text (via Groq/Whisper)
//   POST /api/correct    — raw transcript → grammar-corrected text (via Gemini)
//   POST /api/summarize  — any text → one-paragraph summary (via Gemini)
// -----------------------------------------------------------------------------

import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio, correctText, summarizeText } from '../services/aiService.js';

const router = Router();

// -----------------------------------------------------------------------------
// Multer configuration — handles multipart/form-data file uploads
//
// fix: previously used multer() with no config, which accepts files of any size.
//      A user could upload a 1GB file and exhaust server memory before the
//      request even reached the route handler. Now capped at 25MB to match
//      Groq Whisper's own file size limit — anything larger would be rejected
//      by Groq anyway, so we reject it earlier with a cleaner error message.
//
// storage: memoryStorage (default) — file is kept as a Buffer in memory.
// This is fine for audio files up to 25MB on a typical Node server.
// -----------------------------------------------------------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB — matches Groq Whisper's max file size
    },
    fileFilter: (_req, file, cb) => {
        // Only accept audio files — reject images, PDFs, etc. before they're buffered
        if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are accepted.'));
        }
    },
});

// -----------------------------------------------------------------------------
// POST /api/transcribe
//
// Accepts a multipart audio file and returns the transcript as plain text.
//
// fix: previously returned status 400 for ALL errors including server-side
//      failures like Groq being down. A 400 means "the client did something
//      wrong" — server/API failures should return 500 so the frontend can
//      show the right message. Now distinguishes between client errors (missing
//      file, bad format) and server errors (Groq failure, timeout).
// -----------------------------------------------------------------------------
router.post('/transcribe', upload.single('file'), async (req, res) => {
    // Multer file size / fileFilter errors land here as req.fileValidationError
    // but multer also throws directly — both are caught by the catch block below

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        const { buffer, originalname, mimetype } = req.file;
        const text = await transcribeAudio(buffer, originalname, mimetype);
        res.json({ text });

    } catch (err) {
        console.error('Transcribe error:', err.message);

        // Multer-specific errors (file too large, wrong type) = client error → 400
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 25MB.' });
        }
        if (err.message === 'Only audio files are accepted.') {
            return res.status(400).json({ error: err.message });
        }

        // "Speech unclear" is a user-facing prompt to retry — still a 400
        if (err.message?.toLowerCase().includes('unclear')) {
            return res.status(400).json({ error: err.message });
        }

        // Everything else (Groq down, timeout, etc.) = server error → 500
        res.status(500).json({ error: 'Transcription failed. Please try again.' });
    }
});

// -----------------------------------------------------------------------------
// POST /api/correct
//
// Accepts a raw transcript string and returns a grammar/mishearing-corrected
// version. Used after transcription to clean up common Whisper errors.
// -----------------------------------------------------------------------------
router.post('/correct', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'text is required.' });
        }

        const corrected = await correctText(text);

        // FAIL_TOO_SHORT is returned by correctText when the corrected output
        // is suspiciously short — signal to the frontend to prompt the user to retry
        if (corrected === 'FAIL_TOO_SHORT') {
            return res.status(400).json({ error: 'Speech unclear, please repeat.' });
        }

        res.json({ text: corrected });

    } catch (err) {
        console.error('Correct error:', err.message);
        res.status(500).json({ error: 'Text correction failed. Please try again.' });
    }
});

// -----------------------------------------------------------------------------
// POST /api/summarize
//
// Accepts any text and returns a one-paragraph summary under 60 words.
// The frontend can then optionally save this via POST /api/summaries/save.
// -----------------------------------------------------------------------------
router.post('/summarize', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'text is required.' });
        }

        const summary = await summarizeText(text);
        res.json({ text: summary });

    } catch (err) {
        console.error('Summarize error:', err.message);

        // TOO_SHORT is thrown by summarizeText when input is under 5 words — client error
        if (err.message === 'TOO_SHORT') {
            return res.status(400).json({ error: 'Input is too short to summarize. Please provide at least a sentence.' });
        }

        // All other errors (Gemini down, timeout, etc.) = server error → 500
        res.status(500).json({ error: 'Summarization failed. Please try again.' });
    }
});

export default router;