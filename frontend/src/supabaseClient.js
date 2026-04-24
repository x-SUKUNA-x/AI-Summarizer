// ── Frontend Supabase Client ───────────────────────────────────────────────────
// Initialises a lightweight Supabase client for the browser using the public
// anon key. This is SAFE to expose on the frontend — the anon key is restricted
// by Supabase Row Level Security (RLS) policies.
//
// Note: The SERVICE_ROLE key lives only in the backend and is never shipped to
// the browser. The anon key here only allows what RLS explicitly permits.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
    // Non-fatal warning in dev — the stock page works without history,
    // but Supabase calls will silently fail until keys are set.
    console.warn(
        '⚠️  VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.\n' +
        '   Recent searches will not persist. Add them to frontend/.env'
    );
}

export const supabase = createClient(
    supabaseUrl  ?? '',
    supabaseAnon ?? ''
);
