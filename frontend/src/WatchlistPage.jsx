import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Star, Search, LogIn } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function WatchlistPage() {
    const navigate = useNavigate();

    // ── Core state ────────────────────────────────────────────────────────────
    const [savedStocks, setSavedStocks] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [session, setSession]         = useState(null);

    // ── Hook: Bootstrap auth session on mount ─────────────────────────────────
    // Why: We need to know if a user is logged in to fetch their private
    // watchlist. We listen for auth changes to handle fast logouts gracefully.
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
            if (!s) {
                setSavedStocks([]); // clear data if logged out
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Hook: Fetch User Portfolio ────────────────────────────────────────────
    // Why: Retrieves the user's saved tickers from the Supabase user_watchlists
    // table. Only runs when the session exists.
    useEffect(() => {
        if (!session) {
            setLoading(false);
            return;
        }

        async function fetchWatchlist() {
            setLoading(true);
            try {
                const { data, error: dbErr } = await supabase
                    .from('user_watchlists')
                    .select('ticker')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });
                
                if (dbErr) throw dbErr;
                
                const tickers = data.map(row => row.ticker);
                setSavedStocks(tickers);
            } catch (err) {
                console.error('fetchWatchlist failed —', err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchWatchlist();
    }, [session]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#08080a] text-zinc-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            
            {/* Ambient background */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-amber-950/10 to-transparent" />
                <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[140px]" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
                
                {/* ── Top nav ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-8">
                    <Link to="/stock" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                        Back to Search
                    </Link>
                </div>

                {/* Page header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
                    <p className="text-[11px] text-amber-500/70 uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                        <Star size={9} className="fill-amber-500/70" /> Portfolio
                    </p>
                    <h1 className="text-3xl font-black text-white tracking-tight">Your Watchlist</h1>
                    <p className="text-zinc-500 text-sm mt-1">Quickly access the stocks you've starred.</p>
                </motion.div>

                {/* ── Auth Gate ─────────────────────────────────────────────── */}
                {!session && !loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-16 text-center bg-[#0f0f12] border border-white/[0.05] rounded-2xl">
                        <div className="w-14 h-14 rounded-2xl bg-[#0a0a0d] border border-dashed border-indigo-500/30 flex items-center justify-center">
                            <LogIn size={22} className="text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-zinc-300 text-sm font-medium">Please log in to view your watchlist</p>
                            <p className="text-zinc-600 text-xs mt-1">Your saved stocks are synced securely to your account.</p>
                        </div>
                        <Link to="/stock" className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 transition-colors">
                            Go to Login
                        </Link>
                    </motion.div>
                )}

                {/* ── Loading State ─────────────────────────────────────────── */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="text-zinc-600 animate-spin" />
                    </div>
                )}

                {/* ── Empty State ───────────────────────────────────────────── */}
                {session && !loading && savedStocks.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-16 text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
                        <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center">
                            <Star size={20} className="text-zinc-600" />
                        </div>
                        <div>
                            <p className="text-zinc-400 text-sm font-medium">Your watchlist is empty.</p>
                            <p className="text-zinc-600 text-xs mt-1">Go to the search page to add some stocks!</p>
                        </div>
                        <Link to="/stock" className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] transition-colors">
                            <Search size={14} /> Search Stocks
                        </Link>
                    </motion.div>
                )}

                {/* ── Watchlist Grid ────────────────────────────────────────── */}
                {session && !loading && savedStocks.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        <AnimatePresence>
                            {savedStocks.map((ticker, index) => (
                                <motion.div
                                    key={ticker}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.2, delay: index * 0.05 }}
                                    onClick={() => navigate(`/stock?ticker=${ticker}`)}
                                    className="cursor-pointer group relative overflow-hidden rounded-2xl bg-[#0f0f12] border border-white/[0.07] hover:border-amber-500/40 p-5 flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(251,191,36,0.1)]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-transparent transition-colors" />
                                    <Star size={16} className="fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                                    <span className="text-lg font-black text-white tracking-widest">{ticker}</span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
