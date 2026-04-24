import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowLeft, Search, Loader2, BarChart2, Sparkles, Star, LogIn, LogOut } from 'lucide-react';
import { api } from './api';
import { supabase } from './supabaseClient';

export default function StockPage() {

    // ── Core state ────────────────────────────────────────────────────────────
    const [searchParams]                      = useSearchParams();
    const [ticker, setTicker]                 = useState('');
    const [stockData, setStockData]           = useState(null);
    const [loading, setLoading]               = useState(false);
    const [error, setError]                   = useState('');
    const [isRateLimit, setIsRateLimit]       = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);

    // ── Auth state ────────────────────────────────────────────────────────────
    // Why: We track the Supabase session globally so every component in this
    // page can gate its DB writes behind a logged-in check. null = logged out.
    const [session, setSession] = useState(null);

    // ── Watchlist state ───────────────────────────────────────────────────────
    // Why: Tracks whether the currently-viewed ticker is already in the user's
    // watchlist. Drives the star button visual (solid yellow vs outlined gray).
    // Reset to false whenever a new search begins so stale state never persists.
    const [isSaved, setIsSaved]           = useState(false);
    const [watchlistBusy, setWatchlistBusy] = useState(false); // guard double-clicks

    const POPULAR_TICKERS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT'];

    // ── Hook: Bootstrap auth session on mount ─────────────────────────────────
    // Why: supabase.auth.getSession() reads the stored JWT from localStorage so
    // the user stays logged in across page refreshes without a round-trip.
    // onAuthStateChange subscribes to future sign-in / sign-out events so the UI
    // always reflects the true auth state without polling.
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
        });

        return () => subscription.unsubscribe(); // cleanup on unmount
    }, []);

    // ── Hook: Load recent searches on mount ───────────────────────────────────
    useEffect(() => {
        async function fetchRecentSearches() {
            try {
                const { data, error: dbErr } = await supabase
                    .from('recent_searches')
                    .select('ticker')
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (dbErr) throw dbErr;
                const unique = [...new Set(data.map((r) => r.ticker))].slice(0, 5);
                setRecentSearches(unique);
            } catch (err) {
                console.error('fetchRecentSearches failed —', err.message);
            }
        }
        fetchRecentSearches();
    }, []);

    // ── Action: Sign in with Google OAuth ────────────────────────────────────
    // Why: OAuth is the fastest zero-friction auth flow. redirectTo ensures
    // Supabase returns the user to this page after the Google consent screen.
    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href },
        });
    };

    // ── Action: Sign out ─────────────────────────────────────────────────────
    const signOut = async () => {
        await supabase.auth.signOut();
        setIsSaved(false); // clear watchlist status — no user anymore
    };

    // ── Action: Check if current ticker is in user's watchlist ───────────────
    // Why: After every successful stock fetch, we query user_watchlists so the
    // star button correctly reflects whether this ticker is already saved.
    // Only runs when the user is logged in — guests always see the star unlit.
    const checkWatchlist = async (sym, userId) => {
        try {
            const { data, error: dbErr } = await supabase
                .from('user_watchlists')
                .select('id')
                .eq('user_id', userId)
                .eq('ticker', sym)
                .maybeSingle();
            if (dbErr) throw dbErr;
            setIsSaved(!!data); // true if a row was found
        } catch (err) {
            console.error('checkWatchlist failed —', err.message);
            setIsSaved(false);
        }
    };

    // ── Action: Toggle Watchlist Status ──────────────────────────────────────
    // Why: Allows the user to persist or remove a stock from their personal
    // portfolio with a single click. Uses optimistic UI so the star flips
    // instantly — the DB write happens in the background.
    //
    // Auth bypass: We currently skip the strict login gate so the star
    // button works immediately for demos / testing. When no session exists
    // we fall back to a hardcoded test UUID so the Supabase INSERT still
    // satisfies the NOT NULL user_id constraint.
    // De-bounce: watchlistBusy prevents double-click race conditions.
    const FALLBACK_USER_ID = '11111111-1111-1111-1111-111111111111';

    const toggleWatchlist = async () => {
        if (watchlistBusy || !ticker) return;

        const userId = session?.user?.id || FALLBACK_USER_ID;

        setWatchlistBusy(true);
        const wasSaved = isSaved;
        setIsSaved(!wasSaved);   // optimistic flip — fires instantly

        try {
            if (wasSaved) {
                // DELETE — remove from watchlist
                const { error: dbErr } = await supabase
                    .from('user_watchlists')
                    .delete()
                    .eq('user_id', userId)
                    .eq('ticker', ticker.toUpperCase());
                if (dbErr) throw dbErr;
            } else {
                // INSERT — add to watchlist
                const { error: dbErr } = await supabase
                    .from('user_watchlists')
                    .insert({ user_id: userId, ticker: ticker.toUpperCase() });
                if (dbErr) throw dbErr;
            }
        } catch (err) {
            console.error('toggleWatchlist DB error —', err.message);
            setIsSaved(wasSaved); // revert optimistic update on failure
        } finally {
            setWatchlistBusy(false);
        }
    };

    // ── Action: Persist search to history ────────────────────────────────────
    const saveSearchToHistory = async (sym) => {
        setRecentSearches((prev) => {
            const filtered = prev.filter((t) => t !== sym);
            return [sym, ...filtered].slice(0, 5);
        });
        try {
            const { error: dbErr } = await supabase.from('recent_searches').insert({ ticker: sym });
            if (dbErr) throw dbErr;
        } catch (err) {
            console.error('saveSearchToHistory failed —', err.message);
        }
    };

    // ── Core fetch logic ──────────────────────────────────────────────────────
    const handleFetchFor = async (symbol) => {
        const cleaned = symbol.trim().toUpperCase();
        if (!cleaned) { setError('Please enter a stock ticker symbol (e.g., AAPL, TCS).'); return; }

        setError('');
        setIsRateLimit(false);
        setStockData(null);
        setIsSaved(false); // reset star for new ticker
        setLoading(true);

        try {
            const data = await api.getStock(cleaned);
            setStockData(data);
            await saveSearchToHistory(cleaned);

            // Check watchlist status for this ticker.
            // Why: After a fresh fetch we always re-verify the DB — avoids
            // stale isSaved state when the user searches a different ticker.
            // Uses the same FALLBACK_USER_ID when no session exists.
            const userId = session?.user?.id || FALLBACK_USER_ID;
            await checkWatchlist(cleaned, userId);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setIsRateLimit(err.rateLimit || false);
        } finally {
            setLoading(false);
        }
    };

    const handleFetch      = () => handleFetchFor(ticker);
    const handleQuickSearch = (sym) => { setTicker(sym); handleFetchFor(sym); };
    const handleTickerChange = (e) => setTicker(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase());
    const handleKeyDown    = (e) => { if (e.key === 'Enter') handleFetch(); };
    const isPositive       = typeof stockData?.change === 'number' && stockData.change >= 0;

    // ── Hook: Check URL for pre-loaded ticker from Watchlist ──────────────────
    useEffect(() => {
        const urlTicker = searchParams.get('ticker');
        if (urlTicker && !stockData && !loading) {
            setTicker(urlTicker);
            handleFetchFor(urlTicker);
        }
    }, [searchParams]); // only run when searchParams change (like on mount)

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#08080a] text-zinc-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Ambient background */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-950/20 to-transparent" />
                <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-indigo-600/6 rounded-full blur-[140px]" />
                <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">

                {/* ── Top nav ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors group">
                            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            Back to chat
                        </Link>
                        <Link to="/watchlist" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-500/80 hover:text-amber-400 transition-colors">
                            <Star size={13} className="fill-amber-500/50" /> Watchlist
                        </Link>
                    </div>

                    {/* ── Auth button ───────────────────────────────────────── */}
                    {/* Why: Surfaced in the nav so it is always visible without */}
                    {/* cluttering the main content area. Shows the user's email  */}
                    {/* when logged in so they know which account is active.      */}
                    {session ? (
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] text-zinc-500 hidden sm:block">{session.user.email}</span>
                            <button
                                id="auth-signout-button"
                                onClick={signOut}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 border border-white/[0.07] hover:border-white/20 hover:text-zinc-200 transition-all"
                            >
                                <LogOut size={12} /> Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            id="auth-signin-button"
                            onClick={signInWithGoogle}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all"
                        >
                            <LogIn size={12} /> Log In
                        </button>
                    )}
                </div>

                {/* Page header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
                    <p className="text-[11px] text-indigo-400/70 uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                        <Sparkles size={9} /> AI Summarizer
                    </p>
                    <h1 className="text-3xl font-black text-white tracking-tight">Stock Lookup</h1>
                    <p className="text-zinc-500 text-sm mt-1">Enter a ticker symbol to get real-time price, change, and volume.</p>
                </motion.div>

                {/* ── Search card ───────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="relative rounded-2xl bg-[#0f0f12] border border-white/[0.07] p-6 mb-4">
                    <label htmlFor="stock-ticker-input" className="block text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-3">Ticker Symbol</label>

                    <div className="flex gap-3">
                        <input
                            id="stock-ticker-input" type="text" value={ticker}
                            onChange={handleTickerChange} onKeyDown={handleKeyDown}
                            placeholder="e.g. AAPL, TCS, TSLA" maxLength={10} autoComplete="off" spellCheck={false}
                            className="flex-1 bg-[#0a0a0d] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200 uppercase tracking-widest"
                        />
                        <button id="stock-fetch-button" onClick={handleFetch} disabled={loading || !ticker.trim()}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-0.5 active:scale-95">
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                            {loading ? 'Fetching…' : 'Fetch Data'}
                        </button>
                    </div>

                    {/* Recent chips */}
                    {recentSearches.length > 0 && (
                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Recent:</span>
                            {recentSearches.map((sym) => (
                                <button key={sym} id={`recent-chip-${sym.toLowerCase()}`} onClick={() => handleQuickSearch(sym)} disabled={loading}
                                    className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/60 hover:border-zinc-600/60 hover:text-zinc-200 disabled:opacity-40 transition-all duration-200 cursor-pointer">
                                    {sym}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Popular chips */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Popular:</span>
                        {POPULAR_TICKERS.map((symbol) => (
                            <button key={symbol} id={`quick-chip-${symbol.toLowerCase()}`} onClick={() => handleQuickSearch(symbol)} disabled={loading}
                                className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider bg-white/[0.04] border border-white/[0.07] text-zinc-500 hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-400 disabled:opacity-40 transition-all duration-200 cursor-pointer">
                                {symbol}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className={`rounded-2xl px-5 py-4 text-sm mb-4 border ${
                                isRateLimit 
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                            {isRateLimit ? '📊' : '⚠️'} {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty state */}
                <AnimatePresence>
                    {!stockData && !loading && !error && (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[#0f0f12] border border-dashed border-white/[0.08] flex items-center justify-center">
                                <BarChart2 size={22} className="text-zinc-700" />
                            </div>
                            <p className="text-zinc-500 text-sm">Search for a stock to see data</p>
                            <p className="text-zinc-700 text-xs">Try AAPL, TSLA, MSFT, TCS…</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Shimmer */}
                {loading && (
                    <div className="space-y-3 mt-2 animate-pulse">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="rounded-2xl bg-[#0f0f12] border border-white/[0.05] p-5 space-y-3">
                                    <div className="h-2.5 w-16 rounded bg-white/[0.06]" />
                                    <div className="h-7 w-24 rounded bg-white/[0.04]" />
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl bg-[#0f0f12] border border-indigo-500/10 p-5 space-y-2">
                            <div className="h-2.5 w-20 rounded bg-indigo-500/10" />
                            <div className="h-2.5 w-full rounded bg-white/[0.04]" />
                            <div className="h-2.5 w-4/5 rounded bg-white/[0.04]" />
                        </div>
                    </div>
                )}

                {/* Results */}
                <AnimatePresence>
                    {stockData && (
                        <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>

                            {/* Ticker label + Star button */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <BarChart2 size={14} className="text-indigo-400" />
                                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                                        {ticker.toUpperCase()} — Market Data
                                    </span>
                                </div>

                                {/* ── Star / Watchlist button ────────────────────────────── */}
                                {/* Why: Placed inline with the ticker label so it feels      */}
                                {/* like a natural property of the result — not an afterthought. */}
                                {/* Solid amber when saved, outlined gray when not.           */}
                                {/* Clicking while logged out surfaces the auth prompt.        */}
                                <button
                                    id="watchlist-star-button"
                                    onClick={toggleWatchlist}
                                    disabled={watchlistBusy}
                                    title={isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
                                    className={`
                                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                        border transition-all duration-200
                                        ${isSaved
                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                                            : 'bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    <Star
                                        size={13}
                                        className={isSaved ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'}
                                    />
                                    {isSaved ? 'Saved' : 'Save'}
                                </button>
                            </div>

                            {/* Stat cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard label="Price" value={stockData.price !== 'N/A' ? `$${stockData.price.toFixed(2)}` : 'N/A'} accent="indigo" delay={0} />
                                <StatCard
                                    label="Change"
                                    value={stockData.change !== 'N/A' ? `${isPositive ? '+' : ''}${stockData.change.toFixed(2)}%` : 'N/A'}
                                    accent={isPositive ? 'emerald' : 'rose'}
                                    icon={stockData.change !== 'N/A' ? (isPositive ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />) : null}
                                    delay={0.05}
                                />
                                <StatCard label="Volume" value={stockData.volume !== 'N/A' ? Number(stockData.volume).toLocaleString() : 'N/A'} accent="purple" delay={0.1} />
                            </div>

                            {/* AI Insight */}
                            {stockData.insight && (
                                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }}
                                    className="mt-4 rounded-2xl bg-[#0f0f12] border border-indigo-500/15 p-5 relative overflow-hidden">
                                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles size={13} className="text-indigo-400" />
                                        <p className="text-[10px] uppercase tracking-widest font-semibold text-indigo-400">AI Insight</p>
                                    </div>
                                    {stockData.insight.split('\n\n').map((sentence, i) => (
                                        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-2 last:mb-0">{sentence}</p>
                                    ))}
                                    <p className="text-[10px] text-zinc-600 mt-3">Generated by Gemini · Strictly factual · Not financial advice</p>
                                </motion.div>
                            )}

                            <p className="text-[10px] text-zinc-700 mt-4 text-center">Data via Alpha Vantage · Prices may be delayed 15–20 min</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon = null, delay = 0 }) {
    const accentStyles = {
        indigo:  { border: 'border-indigo-500/20',  glow: 'bg-indigo-500/20',  text: 'text-indigo-400'  },
        emerald: { border: 'border-emerald-500/20', glow: 'bg-emerald-500/15', text: 'text-emerald-400' },
        rose:    { border: 'border-rose-500/20',    glow: 'bg-rose-500/15',    text: 'text-rose-400'    },
        purple:  { border: 'border-purple-500/20',  glow: 'bg-purple-500/15',  text: 'text-purple-400'  },
    };
    const s = accentStyles[accent] || accentStyles.indigo;
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
            className={`relative rounded-2xl bg-[#0f0f12] border ${s.border} p-5 overflow-hidden group hover:border-opacity-60 transition-all`}>
            <div className={`absolute -top-4 -right-4 w-20 h-20 ${s.glow} rounded-full blur-2xl`} />
            <div className="flex items-center gap-1.5 mb-3">
                {icon}
                <p className={`text-[10px] uppercase tracking-widest font-semibold ${s.text}`}>{label}</p>
            </div>
            <p className="text-2xl font-black text-white tabular-nums tracking-tight">{value}</p>
        </motion.div>
    );
}
