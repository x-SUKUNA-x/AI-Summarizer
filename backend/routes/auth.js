/* global process */
// -----------------------------------------------------------------------------
// routes/auth.js
//
// Handles user registration, login, session check, and logout.
//
// Auth strategy:
//   - Passwords are hashed with bcrypt (cost factor 10) — never stored plain
//   - Sessions are issued as JWTs stored in HTTP-only cookies (not localStorage)
//   - HTTP-only + sameSite:'none' + secure:true allows cross-origin cookies
//     between a Vercel frontend and a Render backend over HTTPS
//   - Cookie expiry matches JWT expiry: 7 days
// -----------------------------------------------------------------------------

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabaseClient.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Cookie options applied on both set (login/signup) and clear (logout).
// secure: true  — cookie only sent over HTTPS (required for sameSite: 'none')
// sameSite: none — allows the cookie to be sent cross-origin (Vercel → Render)
// httpOnly: true — JS in the browser cannot read this cookie (XSS protection)
const COOKIE_OPTS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// -----------------------------------------------------------------------------
// POST /api/auth/signup
//
// Creates a new user account.
//
// fix: removed the SELECT-then-INSERT pattern (TOCTOU race condition).
//      Previously: check if email exists → if not, insert. Two concurrent
//      requests with the same email could both pass the SELECT check and both
//      attempt to insert, causing a duplicate. Now we just INSERT directly and
//      rely on the database's unique constraint on the email column. If a
//      duplicate exists, Postgres returns error code 23505 which we catch and
//      convert to a clean 400 response.
//
// fix: added minimum password length validation (8 characters). Previously a
//      user could sign up with a 1-character password.
// -----------------------------------------------------------------------------
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic presence check
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Enforce minimum password length before doing any hashing work
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }

        // Hash password with bcrypt cost factor 10 (~100ms on modern hardware)
        // High enough to slow brute-force attacks; low enough to not bottleneck signups
        const password_hash = await bcrypt.hash(password, 10);

        // Insert directly — let the DB unique constraint reject duplicates.
        // This is atomic and race-condition safe (no SELECT needed first).
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({ email, password_hash })
            .select('id, email')
            .single();

        // error code 23505 = unique_violation — email already registered
        if (error?.code === '23505') {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        if (error) throw error;

        // Issue JWT and set it as an HTTP-only cookie
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, COOKIE_OPTS).json({ user: { id: newUser.id, email: newUser.email } });

    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
});

// -----------------------------------------------------------------------------
// POST /api/auth/login
//
// Authenticates an existing user and issues a session cookie.
//
// Returns the same generic error message for both "email not found" and
// "wrong password" — intentionally vague to prevent user enumeration attacks
// (an attacker shouldn't be able to tell whether an email is registered).
// -----------------------------------------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Fetch the user record including the hashed password for comparison
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, password_hash')
            .eq('email', email)
            .maybeSingle(); // returns null (not an error) if no row found

        // Deliberately identical error for both "no user" and "wrong password"
        // to avoid leaking whether the email is registered
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Issue JWT and set it as an HTTP-only cookie
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, COOKIE_OPTS).json({ user: { id: user.id, email: user.email } });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// -----------------------------------------------------------------------------
// GET /api/auth/me
//
// Returns the currently authenticated user from the JWT payload.
// Used by the frontend on page load to restore session state without
// making a full database query — the JWT already contains id + email.
// -----------------------------------------------------------------------------
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email } });
});

// -----------------------------------------------------------------------------
// POST /api/auth/logout
//
// Clears the session cookie. The same COOKIE_OPTS must be passed to
// clearCookie() so the browser correctly identifies which cookie to remove
// (path, domain, sameSite, and secure must all match the original Set-Cookie).
// -----------------------------------------------------------------------------
router.post('/logout', (_req, res) => {
    res.clearCookie('token', COOKIE_OPTS).json({ success: true });
});

export default router;