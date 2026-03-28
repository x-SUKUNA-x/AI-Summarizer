/* global process */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabaseClient.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

const COOKIE_OPTS = {
    httpOnly: true,
    secure: true,         // required for sameSite: 'none' (must be HTTPS)
    sameSite: 'none',     // allows cross-origin cookies (Vercel → Render)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        // Check existing
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        if (existing) return res.status(400).json({ error: 'User already exists' });

        const password_hash = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({ email, password_hash })
            .select('id, email')
            .single();

        if (error) throw error;

        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, COOKIE_OPTS).json({ user: { id: newUser.id, email: newUser.email } });
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, password_hash')
            .eq('email', email)
            .maybeSingle();

        if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, COOKIE_OPTS).json({ user: { id: user.id, email: user.email } });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email } });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
    res.clearCookie('token', COOKIE_OPTS).json({ success: true });
});

export default router;
