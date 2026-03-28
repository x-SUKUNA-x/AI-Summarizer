/* global process */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // index.js already exits if this is missing

/**
 * Reads JWT from:
 *  1. HTTP-only cookie  "token"
 *  2. Authorization: Bearer <token>  header  (backwards compat)
 */
export const authMiddleware = (req, res, next) => {
    // 1. Cookie (preferred — HTTP-only, not accessible to JS)
    let token = req.cookies?.token;

    // 2. Bearer header fallback
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    }

    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = payload; // { id, email }
        next();
    });
};
