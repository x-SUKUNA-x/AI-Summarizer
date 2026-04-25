// -----------------------------------------------------------------------------
// routes/summaries.js
//
// Stores and retrieves AI-generated summaries for authenticated users.
// All routes are protected by authMiddleware — req.user.id is the owner key.
//
// Column name mapping (Supabase DB → frontend):
//   input_text   → transcript
//   summary_text → summary
//   is_starred   → is_bookmarked
// -----------------------------------------------------------------------------

import { Router } from 'express';
import { supabase } from '../db/supabaseClient.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// Helper: maps a raw Supabase row to the shape the frontend expects.
// Centralised here so all routes return a consistent response structure.
function normalize(s) {
    return {
        id: s.id,
        transcript: s.input_text,
        summary: s.summary_text,
        is_bookmarked: s.is_starred,
        created_at: s.created_at,
    };
}

// -----------------------------------------------------------------------------
// GET /api/summaries
//
// Returns all summaries for the current user, newest first.
// Returns an empty array (not an error) if none exist yet.
// -----------------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('summaries')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json((data || []).map(normalize));
    } catch (err) {
        console.error('Get summaries error:', err.message);
        res.status(500).json({ error: 'Failed to fetch summaries.' });
    }
});

// -----------------------------------------------------------------------------
// POST /api/summaries/save
//
// Saves a new summary to the database.
//
// fix: removed .single() from the insert chain. .single() throws an error when
//      Supabase returns 0 rows — which happens silently when an RLS policy
//      blocks the insert. Without .single(), we can detect this case cleanly
//      by checking if data is empty after the insert.
// -----------------------------------------------------------------------------
router.post('/save', async (req, res) => {
    try {
        const { transcript, summary } = req.body;
        if (!summary) return res.status(400).json({ error: 'summary is required.' });

        const { data, error } = await supabase
            .from('summaries')
            .insert({
                user_id: req.user.id,
                input_text: transcript || '',
                summary_text: summary,
                is_starred: false,
            })
            .select('*'); // no .single() — avoids crash if RLS silently blocks

        if (error) throw error;

        // If data is empty, the insert was silently blocked (e.g. by RLS)
        if (!data || data.length === 0) {
            return res.status(500).json({ error: 'Summary could not be saved. Check database permissions.' });
        }

        res.json(normalize(data[0]));
    } catch (err) {
        console.error('Save summary error:', err.message);
        res.status(500).json({ error: 'Failed to save summary.' });
    }
});

// -----------------------------------------------------------------------------
// PUT /api/summaries/:id/bookmark
//
// Toggles the bookmark (star) state on a summary.
//
// fix: added validation for is_bookmarked — if the frontend sends undefined or
//      a non-boolean, Supabase would silently set is_starred to null in the DB.
//      Now we reject the request with a clear error if the value is missing or
//      not a boolean.
// -----------------------------------------------------------------------------
router.put('/:id/bookmark', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_bookmarked } = req.body;

        // Validate: must be explicitly true or false — not undefined, null, or a string
        if (typeof is_bookmarked !== 'boolean') {
            return res.status(400).json({ error: 'is_bookmarked must be a boolean (true or false).' });
        }

        const { data, error } = await supabase
            .from('summaries')
            .update({ is_starred: is_bookmarked })
            .eq('id', id)
            .eq('user_id', req.user.id) // scoped to owner — users cannot bookmark others' summaries
            .select('*')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Summary not found.' });

        res.json(normalize(data));
    } catch (err) {
        console.error('Bookmark error:', err.message);
        res.status(500).json({ error: 'Failed to update bookmark.' });
    }
});

// -----------------------------------------------------------------------------
// DELETE /api/summaries/:id
//
// Deletes a summary owned by the current user.
//
// fix: added a rowCount check — previously a DELETE on a non-existent or
//      unowned ID would return { success: true } even though nothing was deleted.
//      Now we verify at least one row was actually removed.
// -----------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('summaries')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id) // scoped to owner — users cannot delete others' summaries
            .select('id'); // select after delete tells us if a row was actually removed

        if (error) throw error;

        // If no row came back, the ID didn't exist or didn't belong to this user
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Summary not found.' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete summary.' });
    }
});

export default router;
