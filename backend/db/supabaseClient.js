import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});
