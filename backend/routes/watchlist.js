// -----------------------------------------------------------------------------
// routes/watchlist.js
//
// Manages a user's stock watchlist — the list of ticker symbols they want to
// track on their dashboard.
//
// fix: was creating a second Supabase client instance here instead of reusing
//      the shared one from db/supabaseClient.js. This wastes a connection and
//      means the watchlist bypasses the shared client's env guards.
//
// fix: was using a hardcoded FALLBACK_USER_ID for all operations — meaning
//      every user shared the same watchlist with no isolation. Now uses
//      authMiddleware + req.user.id so each user has their own private watchlist.
//
// Endpoints:
//   GET    /api/watchlist         — fetch all tickers for the current user
//   POST   /api/watchlist         — add a ticker to the current user's watchlist
//   DELETE /api/watchlist/:ticker — remove a ticker from the current user's watchlist
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { supabase } from '../db/supabaseClient.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all watchlist routes — a valid JWT cookie is required.
// req.user.id (set by authMiddleware) is used as the user identifier in all queries.
router.use(authMiddleware);

// -----------------------------------------------------------------------------
// GET /api/watchlist
//
// Returns all ticker symbols the current user has saved, ordered newest first.
// Returns an empty array (not an error) if the watchlist is empty.
// -----------------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_watchlists')
            .select('ticker')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (err) {
        console.error('Error fetching watchlist:', err);
        res.status(500).json({ error: 'Failed to fetch watchlist.' });
    }
});

// -----------------------------------------------------------------------------
// POST /api/watchlist
//
// Adds a ticker to the current user's watchlist.
// Ticker is uppercased before storage so "aapl" and "AAPL" are treated the same.
//
// fix: removed .single() from the insert — .single() throws if Supabase returns
//      no rows (which happens silently when RLS blocks the insert), making it
//      impossible to distinguish a real error from an RLS policy block.
//
// fix: moved the error throw BEFORE res.json() so a failed insert no longer
//      returns { success: true } to the client. Previously the error was only
//      console.log'd and execution continued to the success response.
//
// Duplicate tickers (error code 23505 = unique_violation) are treated as a
// no-op success — adding something already in the watchlist is not an error.
// -----------------------------------------------------------------------------
router.post('/', async (req, res) => {
    const { ticker } = req.body;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('user_watchlists')
            .insert({ user_id: req.user.id, ticker: ticker.toUpperCase() })
            .select(); // no .single() — avoids crash if RLS returns 0 rows

        // 23505 = unique_violation — ticker already in watchlist, treat as success
        if (error?.code === '23505') {
            return res.json({ success: true, message: 'Already in watchlist.' });
        }

        // Any other Supabase error is a real failure — throw it
        if (error) {
            console.error('Supabase insert error (watchlist):', error);
            throw error;
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error adding to watchlist:', err);
        res.status(500).json({ error: 'Failed to add to watchlist.' });
    }
});

// -----------------------------------------------------------------------------
// DELETE /api/watchlist/:ticker
//
// Removes a ticker from the current user's watchlist.
// The .eq('user_id', req.user.id) filter ensures users can only delete their
// own entries — they cannot delete another user's watchlist items.
// -----------------------------------------------------------------------------
router.delete('/:ticker', async (req, res) => {
    const { ticker } = req.params;

    try {
        const { error } = await supabase
            .from('user_watchlists')
            .delete()
            .eq('user_id', req.user.id)
            .eq('ticker', ticker.toUpperCase());

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error('Error removing from watchlist:', err);
        res.status(500).json({ error: 'Failed to remove from watchlist.' });
    }
});

export default router;
