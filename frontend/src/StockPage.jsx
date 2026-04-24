import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowLeft, Search, Loader2, BarChart2, Sparkles } from 'lucide-react';
import { api } from './api';
import { supabase } from './supabaseClient';

// ── StockPage ─────────────────────────────────────────────────────────────────
// Standalone page accessible at /stock.
// Lets the user look up a stock ticker and see:
//   price, change percent, and volume — fetched via our Express backend.
// ─────────────────────────────────────────────────────────────────────────────
export default function StockPage() {

    // ── Local state ──────────────────────────────────────────────────────────
    const [ticker, setTicker]                 = useState('');    // controlled input
    const [stockData, setStockData]           = useState(null);  // { price, change, volume, insight }
    const [loading, setLoading]               = useState(false);
    const [error, setError]                   = useState('');    // user-facing error
    const [recentSearches, setRecentSearches] = useState([]);    // cloud-persisted history

    // ── Popular tickers — default quick-search suggestions ───────────────────
    // Why: New users often don't know which tickers to try. This list gives them
    // a zero-typing entry point covering the most commonly searched symbols.
    const POPULAR_TICKERS = ['AAPL', 'TSLA', 'NVDA', 'GOOGL', 'MSFT'];

    // ── Hook: Load Recent Searches from Supabase ─────────────────────────────
    // Why: On mount, we fetch the user's global search history from the cloud
    // so it persists across devices and browser sessions. localStorage would
    // only survive on one machine; Supabase gives us real cross-device sync.
    // Ordered by newest first, capped at 5 unique tickers to keep the row compact.
    // Wrapped in its own async function because useEffect cannot be async itself.
    useEffect(() => {
        async function fetchRecentSearches() {
            try {
                const { data, error: dbErr } = await supabase
                    .from('recent_searches')
                    .select('ticker')
                    .order('created_at', { ascending: false })
                    .limit(20); // fetch extras so de-dup still yields 5 unique

                if (dbErr) throw dbErr;

                // De-duplicate — the same ticker may appear many times.
                // We only show each symbol once, in most-recent-first order.
                const unique = [...new Set(data.map((r) => r.ticker))].slice(0, 5);
                setRecentSearches(unique);
            } catch (err) {
                // Non-fatal — the page still works; history simply won't load.
                console.error('fetchRecentSearches: could not load history —', err.message);
            }
        }

        fetchRecentSearches();
    }, []); // run once on mount

    // ── Action: Persist Successful Search to Cloud ───────────────────────────
    // Why: We save every successful stock lookup to Supabase so the user gets
    // persistent cross-device history.
    //
    // OPTIMISTIC UI UPDATE: The local state is updated immediately (before the
    // DB insert resolves) so the chip appears instantly with no visible latency.
    // The DB write happens in the background — errors are swallowed silently so
    // they never interrupt the stock data flow.
    //
    // De-duplication: if the ticker is already in state, it is moved to the
    // front (most-recently-used order) rather than added as a duplicate.
    const saveSearchToHistory = async (sym) => {
        // Optimistic UI — update state immediately, don't wait for DB
        setRecentSearches((prev) => {
            const filtered = prev.filter((t) => t !== sym); // remove if already present
            return [sym, ...filtered].slice(0, 5);           // prepend + cap at 5
        });

        // Background DB insert
        try {
            const { error: dbErr } = await supabase
                .from('recent_searches')
                .insert({ ticker: sym });

            if (dbErr) throw dbErr;
        } catch (err) {
            console.error('saveSearchToHistory: DB insert failed —', err.message);
        }
    };

    // ── handleFetchFor(symbol) ────────────────────────────────────────────────
    // Core fetch logic — accepts an explicit symbol string so it can be called
    // from both chip clicks (known value) and the button/Enter (state value),
    // bypassing the async state-update race condition entirely.
    //
    // saveSearchToHistory is called ONLY on success — failed queries (invalid
    // tickers, rate limits) are never persisted to history.
    const handleFetchFor = async (symbol) => {
        const cleaned = symbol.trim().toUpperCase();
        if (!cleaned) {
            setError('Please enter a stock ticker symbol (e.g., AAPL, TCS).');
            return;
        }

        setError('');
        setStockData(null);
        setLoading(true);

        try {
            const data = await api.getStock(cleaned);
            setStockData(data);
            await saveSearchToHistory(cleaned); // persist on success only
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── handleFetch ───────────────────────────────────────────────────────────
    // Thin wrapper — reads the current ticker state and passes it to
    // handleFetchFor. Used by the button onClick and the Enter-key handler.
    const handleFetch = () => handleFetchFor(ticker);

    // ── handleQuickSearch ─────────────────────────────────────────────────────
    // Why: React's setTicker() is asynchronous — calling setTicker(symbol) then
    // handleFetch() immediately would read the old ticker from the stale closure.
    // We bypass this by passing symbol directly to handleFetchFor instead,
    // while also calling setTicker so the input field visually updates.
    const handleQuickSearch = (symbol) => {
        setTicker(symbol);
        handleFetchFor(symbol);
    };

    // ── Input change handler ──────────────────────────────────────────────────
    // Strip any non-letter characters as the user types (tickers are always alpha).
    // toUpperCase() auto-capitalises so the user never needs to worry about case.
    const handleTickerChange = (e) => {
        const lettersOnly = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setTicker(lettersOnly);
    };

    // ── Allow Enter key to trigger fetch ─────────────────────────────────────
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleFetch();
    };

    // ── Colour coding helper ──────────────────────────────────────────────────
    const isPositive = typeof stockData?.change === 'number' && stockData.change >= 0;

    // ── UI Rendering ──────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen bg-[#08080a] text-zinc-100"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
            {/* Ambient background */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-950/20 to-transparent" />
                <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-indigo-600/6 rounded-full blur-[140px]" />
                <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">

                {/* Top nav */}
                <div className="flex items-center justify-between mb-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors group"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                        Back to chat
                    </Link>
                </div>

                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-8"
                >
                    <p className="text-[11px] text-indigo-400/70 uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                        <Sparkles size={9} /> AI Summarizer
                    </p>
                    <h1 className="text-3xl font-black text-white tracking-tight">Stock Lookup</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Enter a ticker symbol to get real-time price, change, and volume.
                    </p>
                </motion.div>

                {/* ── Search card ───────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="relative rounded-2xl bg-[#0f0f12] border border-white/[0.07] p-6 mb-4"
                >
                    <label
                        htmlFor="stock-ticker-input"
                        className="block text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-3"
                    >
                        Ticker Symbol
                    </label>

                    {/* Input + Button row */}
                    <div className="flex gap-3">
                        <input
                            id="stock-ticker-input"
                            type="text"
                            value={ticker}
                            onChange={handleTickerChange}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g. AAPL, TCS, TSLA"
                            maxLength={10}
                            autoComplete="off"
                            spellCheck={false}
                            className="
                                flex-1 bg-[#0a0a0d] border border-white/[0.08] rounded-xl
                                px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600
                                focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30
                                transition-all duration-200 uppercase tracking-widest
                            "
                        />
                        <button
                            id="stock-fetch-button"
                            onClick={handleFetch}
                            disabled={loading || !ticker.trim()}
                            className="
                                inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white
                                bg-gradient-to-r from-indigo-500 to-purple-600
                                hover:from-indigo-400 hover:to-purple-500
                                shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0
                                transition-all duration-300 hover:-translate-y-0.5 active:scale-95
                            "
                        >
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                            {loading ? 'Fetching…' : 'Fetch Data'}
                        </button>
                    </div>

                    {/* ── Recent Searches Chips ─────────────────────────────── */}
                    {/* Why: Cloud-persisted history lets returning users re-run  */}
                    {/* their last searches in one click. Only shown when at      */}
                    {/* least one search has been saved to Supabase.              */}
                    {recentSearches.length > 0 && (
                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                                Recent:
                            </span>
                            {recentSearches.map((sym) => (
                                <button
                                    key={sym}
                                    id={`recent-chip-${sym.toLowerCase()}`}
                                    onClick={() => handleQuickSearch(sym)}
                                    disabled={loading}
                                    className="
                                        px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider
                                        bg-zinc-800/60 border border-zinc-700/50 text-zinc-400
                                        hover:bg-zinc-700/60 hover:border-zinc-600/60 hover:text-zinc-200
                                        disabled:opacity-40 disabled:cursor-not-allowed
                                        transition-all duration-200 cursor-pointer
                                    "
                                >
                                    {sym}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Popular Stocks Quick Chips ────────────────────────── */}
                    {/* Why: Provides a frictionless entry point for new users   */}
                    {/* who don't know which tickers to type. One click populates */}
                    {/* the input AND triggers the fetch — no extra step needed. */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                            Popular:
                        </span>
                        {POPULAR_TICKERS.map((symbol) => (
                            <button
                                key={symbol}
                                id={`quick-chip-${symbol.toLowerCase()}`}
                                onClick={() => handleQuickSearch(symbol)}
                                disabled={loading}
                                className="
                                    px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider
                                    bg-white/[0.04] border border-white/[0.07] text-zinc-500
                                    hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-400
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    transition-all duration-200 cursor-pointer
                                "
                            >
                                {symbol}
                            </button>
                        ))}
                    </div>

                </motion.div>

                {/* ── Error state ───────────────────────────────────────────── */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-5 py-4 text-sm text-rose-400 mb-4"
                        >
                            ⚠️ {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Empty state ───────────────────────────────────────────── */}
                {/* Shown before the first successful fetch */}
                <AnimatePresence>
                    {!stockData && !loading && !error && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-3 py-16 text-center"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-[#0f0f12] border border-dashed border-white/[0.08] flex items-center justify-center">
                                <BarChart2 size={22} className="text-zinc-700" />
                            </div>
                            <p className="text-zinc-500 text-sm">Search for a stock to see data</p>
                            <p className="text-zinc-700 text-xs">Try AAPL, TSLA, MSFT, TCS…</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Loading shimmer ───────────────────────────────────────── */}
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

                {/* ── Results ───────────────────────────────────────────────── */}
                <AnimatePresence>
                    {stockData && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.35 }}
                        >
                            {/* Ticker label */}
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart2 size={14} className="text-indigo-400" />
                                <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                                    {ticker.toUpperCase()} — Market Data
                                </span>
                            </div>

                            {/* Stat cards grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard
                                    label="Price"
                                    value={stockData.price !== 'N/A' ? `$${stockData.price.toFixed(2)}` : 'N/A'}
                                    accent="indigo"
                                    delay={0}
                                />
                                <StatCard
                                    label="Change"
                                    value={
                                        stockData.change !== 'N/A'
                                            ? `${isPositive ? '+' : ''}${stockData.change.toFixed(2)}%`
                                            : 'N/A'
                                    }
                                    accent={isPositive ? 'emerald' : 'rose'}
                                    icon={
                                        stockData.change !== 'N/A'
                                            ? (isPositive
                                                ? <TrendingUp size={14} className="text-emerald-400" />
                                                : <TrendingDown size={14} className="text-rose-400" />)
                                            : null
                                    }
                                    delay={0.05}
                                />
                                <StatCard
                                    label="Volume"
                                    value={
                                        stockData.volume !== 'N/A'
                                            ? Number(stockData.volume).toLocaleString()
                                            : 'N/A'
                                    }
                                    accent="purple"
                                    delay={0.1}
                                />
                            </div>

                            {/* AI Insight */}
                            {stockData.insight && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.18, duration: 0.35 }}
                                    className="mt-4 rounded-2xl bg-[#0f0f12] border border-indigo-500/15 p-5 relative overflow-hidden"
                                >
                                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles size={13} className="text-indigo-400" />
                                        <p className="text-[10px] uppercase tracking-widest font-semibold text-indigo-400">
                                            AI Insight
                                        </p>
                                    </div>
                                    {stockData.insight.split('\n\n').map((sentence, i) => (
                                        <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-2 last:mb-0">
                                            {sentence}
                                        </p>
                                    ))}
                                    <p className="text-[10px] text-zinc-600 mt-3">
                                        Generated by Gemini · Strictly factual · Not financial advice
                                    </p>
                                </motion.div>
                            )}

                            {/* Attribution */}
                            <p className="text-[10px] text-zinc-700 mt-4 text-center">
                                Data via Alpha Vantage · Prices may be delayed 15–20 min
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
// Reusable display card for a single stock metric.
// Props:
//   label  — metric name (string)
//   value  — formatted display value (string)
//   accent — colour variant: 'indigo' | 'emerald' | 'rose' | 'purple'
//   icon   — optional lucide icon element shown next to label
//   delay  — framer-motion stagger delay (number, seconds)
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon = null, delay = 0 }) {
    const accentStyles = {
        indigo:  { border: 'border-indigo-500/20',  glow: 'bg-indigo-500/20',  text: 'text-indigo-400'  },
        emerald: { border: 'border-emerald-500/20', glow: 'bg-emerald-500/15', text: 'text-emerald-400' },
        rose:    { border: 'border-rose-500/20',    glow: 'bg-rose-500/15',    text: 'text-rose-400'    },
        purple:  { border: 'border-purple-500/20',  glow: 'bg-purple-500/15',  text: 'text-purple-400'  },
    };
    const s = accentStyles[accent] || accentStyles.indigo;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.35 }}
            className={`relative rounded-2xl bg-[#0f0f12] border ${s.border} p-5 overflow-hidden group hover:border-opacity-60 transition-all`}
        >
            <div className={`absolute -top-4 -right-4 w-20 h-20 ${s.glow} rounded-full blur-2xl`} />
            <div className="flex items-center gap-1.5 mb-3">
                {icon}
                <p className={`text-[10px] uppercase tracking-widest font-semibold ${s.text}`}>
                    {label}
                </p>
            </div>
            <p className="text-2xl font-black text-white tabular-nums tracking-tight">
                {value}
            </p>
        </motion.div>
    );
}
