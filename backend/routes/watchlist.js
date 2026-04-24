import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const FALLBACK_USER_ID = '11111111-1111-1111-1111-111111111111';

// GET public watchlist
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_watchlists')
            .select('ticker')
            .eq('user_id', FALLBACK_USER_ID)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching watchlist:', err);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

// POST to watchlist
router.post('/', async (req, res) => {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    try {
        const { error } = await supabase
            .from('user_watchlists')
            .insert({ user_id: FALLBACK_USER_ID, ticker: ticker.toUpperCase() });

        if (error && error.code !== '23505') throw error; // Ignore unique constraint violation if already added
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding to watchlist:', err);
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

// DELETE from watchlist
router.delete('/:ticker', async (req, res) => {
    const { ticker } = req.params;
    try {
        const { error } = await supabase
            .from('user_watchlists')
            .delete()
            .eq('user_id', FALLBACK_USER_ID)
            .eq('ticker', ticker.toUpperCase());

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing from watchlist:', err);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

export default router;
