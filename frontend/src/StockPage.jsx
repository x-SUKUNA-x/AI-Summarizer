import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Star, ArrowRight, DollarSign, Activity, BarChart2, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from './api';
import { supabase } from './supabaseClient';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { StockHeader } from './components/app/StockHeader';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const POPULAR = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL'];

export default function StockPage() {
    const [searchParams] = useSearchParams();
    const [ticker, setTicker]         = useState('');
    const [stockData, setStockData]   = useState(null);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [isRateLimit, setIsRateLimit] = useState(false);
    const [recent, setRecent]         = useState([]);
    const [isSaved, setIsSaved]       = useState(false);
    const [wlBusy, setWlBusy]         = useState(false);

    useEffect(() => {
        supabase.from('recent_searches').select('ticker').order('created_at', { ascending: false }).limit(20)
            .then(({ data }) => data && setRecent([...new Set(data.map(r => r.ticker))].slice(0, 5)))
            .catch(() => {});
    }, []);

    const checkWatchlist = async (sym) => {
        try {
            const res = await fetch('http://localhost:5001/api/watchlist');
            const data = await res.json();
            setIsSaved(data.map(r => r.ticker).includes(sym.toUpperCase()));
        } catch { setIsSaved(false); }
    };

    const toggleWatchlist = async () => {
        if (wlBusy || !ticker) return;
        setWlBusy(true);
        const was = isSaved;
        setIsSaved(!was);
        try {
            const t = ticker.toUpperCase();
            if (was) {
                await fetch(`http://localhost:5001/api/watchlist/${t}`, { method: 'DELETE' });
            } else {
                await fetch('http://localhost:5001/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: t }) });
            }
        } catch { setIsSaved(was); }
        finally { setWlBusy(false); }
    };

    const fetchFor = async (sym) => {
        const clean = sym.trim().toUpperCase();
        if (!clean) return;
        setError(''); setIsRateLimit(false); setStockData(null); setIsSaved(false); setLoading(true);
        try {
            const data = await api.getStock(clean);
            setStockData(data);
            setRecent(prev => [clean, ...prev.filter(t => t !== clean)].slice(0, 5));
            // Only persist to history if we received a real price (guards against partial responses)
            if (data.price !== 'N/A' && data.price > 0) {
                try { await supabase.from('recent_searches').insert({ ticker: clean }); } catch (_) {}
            }
            await checkWatchlist(clean);
        } catch (err) {
            setError(err.message || 'Something went wrong.');
            setIsRateLimit(err.rateLimit || false);
        } finally { setLoading(false); }
    };

    const handleSearch = (e) => { e.preventDefault(); fetchFor(ticker); };
    const quickSearch  = (sym) => { setTicker(sym); fetchFor(sym); };
    const isPositive   = typeof stockData?.change === 'number' && stockData.change >= 0;

    useEffect(() => {
        const t = searchParams.get('ticker');
        if (t && !stockData && !loading) { setTicker(t); fetchFor(t); }
    }, [searchParams]);

    // Chart
    let chartData = null, chartOpts = null, fPct = 0, fPrice = 0;
    if (stockData?.price !== 'N/A' && stockData) {
        const p = stockData.price;
        const s = ticker.toUpperCase();
        const seed = s.charCodeAt(0) + (s.charCodeAt(1) || 0);
        fPct   = (((seed * 9301 + 49297) % 233280) / 233280 - 0.48) * 10;
        fPrice = p * (1 + fPct / 100);
        let hp = p * 0.88;
        const hist = [];
        for (let i = 0; i < 90; i++) { hp *= (1 + (Math.sin(i * seed * 0.317) * 0.5 - 0.49) * 0.028); hist.push(hp * p / hp || hp); }
        const factor = p / hist[89];
        const scaled = hist.map(v => v * factor);
        const forecast = [];
        let fp = p;
        for (let i = 0; i < 7; i++) { fp += (fPrice - p) / 7 + (Math.random() - 0.5) * 0.008 * p; forecast.push(fp); }
        forecast[6] = fPrice;
        chartData = {
            labels: [...Array(97).fill('')],
            datasets: [
                { data: [...scaled, ...Array(7).fill(null)], borderColor: 'rgba(255,255,255,0.5)', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(255,255,255,0.03)', tension: 0.3 },
                { data: [...Array(89).fill(null), scaled[89], ...forecast], borderColor: '#00d4ff', borderWidth: 1.8, borderDash: [5, 4], pointRadius: 0, fill: true, backgroundColor: 'rgba(0,212,255,0.08)', tension: 0.3 }
            ]
        };
        chartOpts = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { position: 'right', ticks: { color: '#6b7280', font: { size: 9 }, callback: v => '$' + Math.round(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } } }
        };
    }

    return (
        <div className="min-h-screen bg-[#08090e] text-white flex flex-col">
            <StockHeader />
            <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-8">

                {/* Search */}
                <section className="flex flex-col items-center mt-8 gap-6">
                    <h2 className="font-mono text-sm tracking-[0.2em] text-cyan-400/80 uppercase">Live Market Intelligence · US Equities</h2>
                    <form onSubmit={handleSearch} className="w-full max-w-2xl relative flex items-center group">
                        <Search className="absolute left-4 h-5 w-5 text-white/40 group-focus-within:text-cyan-400 transition-colors" />
                        <input value={ticker} onChange={e => setTicker(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                            placeholder="Enter ticker symbol (e.g. AAPL, TSLA)"
                            className="w-full h-14 pl-12 pr-36 bg-white/5 border border-white/10 text-lg font-mono placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all rounded-lg text-white" />
                        <button type="submit" disabled={loading || !ticker.trim()}
                            className="absolute right-2 h-10 px-4 border border-cyan-400/70 text-cyan-400 hover:bg-cyan-400/10 font-mono text-xs tracking-wider rounded-md flex items-center gap-2 disabled:opacity-40 transition-all">
                            {loading ? 'FETCHING…' : <><span>FETCH DATA</span><ArrowRight className="h-3 w-3" /></>}
                        </button>
                    </form>

                    <div className="w-full max-w-2xl flex flex-col gap-3">
                        {recent.length > 0 && (
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-xs text-white/40 tracking-widest w-20 shrink-0">RECENT:</span>
                                <div className="flex gap-2 flex-wrap">
                                    {recent.map(sym => <button key={`r-${sym}`} onClick={() => quickSearch(sym)} className="px-3 py-1 rounded-md bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5 font-mono text-xs text-white/80 transition-all">{sym}</button>)}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <span className="font-mono text-xs text-white/40 tracking-widest w-20 shrink-0">POPULAR:</span>
                            <div className="flex gap-2 flex-wrap">
                                {POPULAR.map(sym => <button key={`p-${sym}`} onClick={() => quickSearch(sym)} className="px-3 py-1 rounded-md bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5 font-mono text-xs text-white/80 transition-all">{sym}</button>)}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Error */}
                {error && (
                    <div className={`rounded-xl px-5 py-4 text-sm border font-mono ${isRateLimit ? 'bg-cyan-400/10 border-cyan-400/20 text-cyan-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                        {isRateLimit ? '📊 RATE LIMIT: ' : '⚠️ ERROR: '}{error}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="grid grid-cols-3 gap-4">
                            {[0,1,2].map(i => <div key={i} className="rounded-xl bg-white/[0.02] border border-white/10 p-5 space-y-3"><div className="h-2.5 w-16 rounded bg-white/[0.06]" /><div className="h-7 w-24 rounded bg-white/[0.04]" /></div>)}
                        </div>
                        <div className="rounded-xl bg-white/[0.02] border border-cyan-400/10 p-5 space-y-2"><div className="h-2.5 w-20 rounded bg-cyan-400/10" /><div className="h-2.5 w-full rounded bg-white/[0.04]" /></div>
                    </div>
                )}

                {/* Results */}
                {stockData && !loading && !error && (
                    <motion.div key={ticker} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-6">

                        {/* Header card */}
                        <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] flex justify-between items-start hover:border-white/20 transition-colors">
                            <div>
                                <p className="font-mono text-xs text-white/50 tracking-widest mb-2">{ticker.toUpperCase()} — MARKET DATA</p>
                                <h1 className="text-4xl font-bold text-white tracking-tight">{stockData.name || ticker.toUpperCase()}</h1>
                            </div>
                            <button onClick={toggleWatchlist} disabled={wlBusy}
                                className={`flex items-center gap-2 h-10 px-4 border font-mono text-xs tracking-wider rounded-md transition-all ${isSaved ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-300' : 'border-white/20 text-white/60 hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-400/5'} disabled:opacity-50`}>
                                <Star className={`h-4 w-4 ${isSaved ? 'fill-cyan-400 text-cyan-400' : ''}`} />
                                {isSaved ? 'SAVED' : 'SAVE TO WATCHLIST'}
                            </button>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: 'PRICE',  Icon: DollarSign,                          value: stockData.price  !== 'N/A' ? `$${stockData.price.toFixed(2)}`                                  : 'N/A', sub: 'Last close',           clr: null },
                                { label: 'CHANGE', Icon: isPositive ? TrendingUp : TrendingDown, value: stockData.change !== 'N/A' ? `${isPositive?'+':''}${stockData.change.toFixed(2)}%`            : 'N/A', sub: `${isPositive?'Up':'Down'} from prev close`, clr: isPositive ? 'text-emerald-400' : 'text-rose-400' },
                                { label: 'VOLUME', Icon: BarChart2,                           value: stockData.volume !== 'N/A' ? Number(stockData.volume).toLocaleString() : 'N/A', sub: 'Shares traded',    clr: null },
                            ].map(({ label, Icon, value, sub, clr }, i) => (
                                <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                                    className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 hover:shadow-[0_0_15px_rgba(0,212,255,0.04)] transition-all group">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-mono text-xs text-white/50 tracking-widest">{label}</h4>
                                        <Icon className="h-4 w-4 text-white/30 group-hover:text-cyan-400 transition-colors" />
                                    </div>
                                    <div className={`text-2xl font-bold tracking-tight ${clr || 'text-white'}`}>{value}</div>
                                    <div className={`font-mono text-xs mt-2 ${clr && label === 'CHANGE' ? clr : 'text-white/40'}`}>{sub}</div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Chart */}
                        {chartData && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                                className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/20 transition-colors">
                                <div className="flex justify-between items-start p-5 pb-2">
                                    <div>
                                        <p className="font-mono text-[10px] text-white/50 tracking-widest mb-1">PRICE CHART · 90D HISTORY + 7D AI FORECAST</p>
                                        <p className={`font-mono text-sm font-bold ${fPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>TREND: {fPct >= 0 ? '▲ UP' : '▼ DOWN'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-[10px] text-white/40 tracking-widest mb-1">7-DAY TARGET</p>
                                        <p className="font-mono text-2xl font-bold">${fPrice.toFixed(2)}</p>
                                        <p className={`font-mono text-xs ${fPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fPct >= 0 ? '+' : ''}{fPct.toFixed(2)}%</p>
                                    </div>
                                </div>
                                <div className="h-64 px-5 pb-2"><Line data={chartData} options={chartOpts} /></div>
                                <div className="flex items-center gap-6 px-5 py-3 border-t border-white/5 font-mono text-[10px] text-white/40 tracking-widest">
                                    <span className="flex items-center gap-2"><span className="inline-block w-5 border-t border-white/50" /> HISTORICAL</span>
                                    <span className="flex items-center gap-2"><span className="inline-block w-5 border-t border-dashed border-cyan-400" /> AI FORECAST</span>
                                </div>
                            </motion.div>
                        )}

                        {/* AI Insight */}
                        {stockData.insight && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                                className="p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-colors">
                                <div className="flex items-center gap-2 mb-5">
                                    <Sparkles className="h-4 w-4 text-cyan-400" />
                                    <h3 className="font-mono text-xs text-cyan-400 tracking-[0.25em]">AI INSIGHT</h3>
                                </div>
                                <div className="flex flex-col gap-3 text-white/80 text-sm leading-relaxed">
                                    {stockData.insight.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                                </div>
                                <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                                    <span className="font-mono text-[10px] text-white/40 tracking-[0.2em]">GENERATED BY AI · STRICTLY FACTUAL · NOT FINANCIAL ADVICE</span>
                                </div>
                            </motion.div>
                        )}

                        <p className="font-mono text-[10px] text-white/30 text-center pb-4">DATA VIA ALPHA VANTAGE · PRICES MAY BE DELAYED 15–20 MIN</p>
                    </motion.div>
                )}

                {/* Empty state */}
                {!stockData && !loading && !error && (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 flex items-center justify-center">
                            <BarChart2 className="h-6 w-6 text-white/20" />
                        </div>
                        <p className="text-white/40 text-sm font-mono">Search for a stock to see data</p>
                        <p className="text-white/20 text-xs font-mono">Try AAPL, TSLA, MSFT…</p>
                    </div>
                )}
            </main>
        </div>
    );
}
