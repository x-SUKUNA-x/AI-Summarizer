import { Router } from 'express';
import { supabase } from '../db/supabaseClient.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET /api/summaries
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('summaries')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Normalize Supabase column names → frontend field names
        const normalized = (data || []).map(s => ({
            id: s.id,
            transcript: s.input_text,
            summary: s.summary_text,
            is_bookmarked: s.is_starred,
            created_at: s.created_at,
        }));
        res.json(normalized);
    } catch (err) {
        console.error('Get summaries error:', err.message);
        res.status(500).json({ error: 'Failed to fetch summaries' });
    }
});

// POST /api/summaries/save
router.post('/save', async (req, res) => {
    try {
        const { transcript, summary } = req.body;
        if (!summary) return res.status(400).json({ error: 'summary is required' });

        const { data, error } = await supabase
            .from('summaries')
            .insert({ user_id: req.user.id, input_text: transcript || '', summary_text: summary, is_starred: false })
            .select('*')
            .single();

        if (error) throw error;
        res.json({ id: data.id, transcript: data.input_text, summary: data.summary_text, is_bookmarked: data.is_starred, created_at: data.created_at });
    } catch (err) {
        console.error('Save summary error:', err.message);
        res.status(500).json({ error: 'Failed to save summary' });
    }
});

// PUT /api/summaries/:id/bookmark
router.put('/:id/bookmark', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_bookmarked } = req.body;

        const { data, error } = await supabase
            .from('summaries')
            .update({ is_starred: is_bookmarked })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('*')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Summary not found' });
        res.json({ id: data.id, transcript: data.input_text, summary: data.summary_text, is_bookmarked: data.is_starred, created_at: data.created_at });
    } catch (err) {
        console.error('Bookmark error:', err.message);
        res.status(500).json({ error: 'Failed to update bookmark' });
    }
});

// DELETE /api/summaries/:id
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('summaries')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete summary' });
    }
});

export default router;
