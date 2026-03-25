import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio, correctText, summarizeText } from '../services/aiService.js';

const router = Router();
const upload = multer();

// POST /api/transcribe  — no auth needed (audio file → transcript)
router.post('/transcribe', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { buffer, originalname, mimetype } = req.file;
        const text = await transcribeAudio(buffer, originalname, mimetype);
        res.json({ text });
    } catch (err) {
        console.error('Transcribe error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/correct  — no auth needed
router.post('/correct', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        const corrected = await correctText(text);
        if (corrected === 'FAIL_TOO_SHORT') return res.status(400).json({ error: 'Speech unclear, please repeat' });
        res.json({ text: corrected });
    } catch (err) {
        console.error('Correct error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/summarize  — no auth needed (frontend decides whether to save)
router.post('/summarize', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });
        const summary = await summarizeText(text);
        res.json({ text: summary });
    } catch (err) {
        console.error('Summarize error:', err.message);
        if (err.message === 'TOO_SHORT') {
            return res.status(400).json({ error: 'Input is too short to summarize. Please provide at least a sentence.' });
        }
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

export default router;
