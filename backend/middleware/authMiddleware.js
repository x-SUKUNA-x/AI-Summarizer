/* global process */
// -----------------------------------------------------------------------------
// middleware/authMiddleware.js
//
// Express middleware that validates the JWT on every protected route.
// Attaches the decoded payload to req.user so route handlers can access
// the authenticated user's id and email without querying the database.
//
// Token sources (checked in order):
//   1. HTTP-only cookie named "token"  ← preferred (not accessible to JS, XSS safe)
//   2. Authorization: Bearer <token>   ← fallback for non-browser clients
// -----------------------------------------------------------------------------

import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
    // fix: JWT_SECRET was previously read at module load time (top-level const).
    //      If this module is imported before dotenv.config() runs in index.js,
    //      it captures undefined and every token verification silently fails.
    //      Reading it inside the function guarantees it's always resolved after
    //      dotenv has populated process.env.
    const JWT_SECRET = process.env.JWT_SECRET;

    // 1. Try HTTP-only cookie first — set by auth routes on login/signup
    let token = req.cookies?.token;

    // 2. Fall back to Authorization header — used by non-browser clients (e.g. mobile apps, Postman)
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    }

    // No token found in either location — user is not logged in
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }

    // Verify the token signature and expiry against our secret.
    // jwt.verify is synchronous internally but accepts a callback for consistency.
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            // err.name === 'TokenExpiredError' means the 7-day window has passed
            // err.name === 'JsonWebTokenError' means the token is malformed or tampered with
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }

        // Attach decoded payload to the request so route handlers can use it
        // payload shape: { id: <uuid>, email: <string>, iat: <timestamp>, exp: <timestamp> }
        req.user = payload;
        next();
    });
};
