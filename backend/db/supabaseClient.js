// -----------------------------------------------------------------------------
// db/supabaseClient.js
//
// Creates and exports the single shared Supabase client used across all routes.
//
// Why a single shared client:
//   Creating a new client per request (or per route file) is wasteful — each
//   client maintains its own connection pool. One shared instance is enough
//   for the entire server lifetime.
//
// Why service key (not anon key):
//   The service key bypasses Supabase Row Level Security (RLS) — this is
//   intentional because we enforce access control in our own Express middleware
//   (authMiddleware + user_id checks in every query). Using the anon key would
//   require RLS policies to be configured correctly on every table, which adds
//   complexity and is easy to misconfigure.
//
// fix: removed the || process.env.SUPABASE_ANON_KEY fallback. Previously if
//      SUPABASE_SERVICE_KEY was accidentally unset, the client would silently
//      fall back to the anon key — which has much lower permissions. This would
//      cause confusing "permission denied" errors at runtime with no indication
//      of the real cause. Now the server exits immediately if the service key
//      is missing, making the misconfiguration obvious.
// -----------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Fail fast at startup — do not let the server run without a valid Supabase config.
// index.js also checks these, but this guard catches cases where supabaseClient.js
// is imported in isolation (e.g. scripts, tests).
if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    console.error('    Do NOT use SUPABASE_ANON_KEY here — the service key is required.');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    // persistSession: false — this is a server-side client, not a browser client.
    // Sessions are managed by our own JWT cookies, not Supabase Auth sessions.
    auth: { persistSession: false },
});
