import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer();

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { buffer, originalname, mimetype } = req.file;

        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimetype });
        formData.append('file', blob, originalname || 'audio.webm');
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: errorData?.error?.message || 'Error from Groq API' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/summarize', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const prompt = `Please summarize the following text.\n\nText: "${text}"\n\nGive me a 3-bullet summary and 1 main action item.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: errorData?.error?.message || 'Error from Gemini API' });
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            res.json({ text: data.candidates[0].content.parts[0].text });
        } else {
            res.status(500).json({ error: 'Invalid response format from Gemini API.' });
        }
    } catch (error) {
        console.error('Summarize error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
