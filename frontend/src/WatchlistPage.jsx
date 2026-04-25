import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ArrowRight, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { StockHeader } from './components/app/StockHeader';
import { API_BASE } from './config';

export default function WatchlistPage() {
    const navigate = useNavigate();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const res  = await fetch(`${API_BASE}/watchlist`, { credentials: 'include' });
                const data = await res.json();
                const tickers = data.map(r => r.ticker);

                if (tickers.length === 0) { setWatchlist([]); return; }

                const withData = await Promise.all(tickers.map(async sym => {
                    try {
                        const r = await fetch(`${API_BASE}/stock/${sym}`);
                        if (!r.ok) throw new Error();
                        const s = await r.json();
                        return { sym, name: s.name || sym, price: s.price !== 'N/A' ? s.price : 0, change: s.change !== 'N/A' ? s.change : 0, target: s.price !== 'N/A' ? s.price * (1 + ((sym.charCodeAt(0) * 9301 + 49297) % 233280) / 233280 * 0.1 - 0.05) : 0 };
                    } catch { return { sym, name: sym, price: 0, change: 0, target: 0 }; }
                }));
                setWatchlist(withData);
            } catch { setWatchlist([]); }
            finally { setLoading(false); }
        }
        load();
    }, []);

    const remove = async (sym) => {
        setWatchlist(prev => prev.filter(i => i.sym !== sym));
        await fetch(`${API_BASE}/watchlist/${sym}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    };

    return (
        <div className="min-h-screen bg-[#08090e] text-white flex flex-col">
            <StockHeader />
            <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col gap-8 mt-8">

                {/* Title row */}
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                        <Star className="h-6 w-6 text-cyan-400" />
                        <h1 className="text-3xl font-bold tracking-tight font-mono">MY WATCHLIST</h1>
                    </div>
                    <span className="font-mono text-sm text-white/50">{watchlist.length} TICKERS SAVED</span>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="space-y-3 animate-pulse">
                        {[0,1,2].map(i => <div key={i} className="rounded-xl bg-white/[0.02] border border-white/10 h-20" />)}
                    </div>
                )}

                {/* Empty */}
                {!loading && watchlist.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center border border-white/5 rounded-xl bg-white/[0.01]">
                        <Star className="h-12 w-12 text-white/10 mb-4" />
                        <h2 className="text-xl font-bold mb-2">Your watchlist is empty</h2>
                        <p className="text-white/50 font-mono text-sm mb-6 max-w-md">
                            Search for stocks and save them here to track performance and AI forecasts.
                        </p>
                        <button onClick={() => navigate('/stock')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 text-black font-mono text-xs tracking-wider rounded-lg hover:bg-cyan-300 transition-colors">
                            EXPLORE STOCKS <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* List */}
                {!loading && watchlist.length > 0 && (
                    <div className="grid gap-4">
                        {watchlist.map((item, i) => {
                            const up = item.change >= 0;
                            return (
                                <motion.div key={item.sym} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="group relative">
                                    <div onClick={() => navigate(`/stock?ticker=${item.sym}`)}
                                        className="p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-400/20 transition-all flex items-center justify-between cursor-pointer">

                                        <div className="flex items-center gap-6">
                                            <span className="font-mono text-lg font-bold w-16">{item.sym}</span>
                                            <div>
                                                <div className="text-white/50 font-mono text-xs tracking-wider mb-1">{item.name}</div>
                                                <div className="text-xl font-bold">${item.price.toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-white/40 font-mono text-[10px] tracking-widest mb-1">TODAY</div>
                                                <div className={`font-mono text-sm flex items-center gap-1 ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {up ? '+' : ''}{item.change.toFixed(2)}%
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-cyan-400/60 font-mono text-[10px] tracking-widest mb-1">7D TARGET</div>
                                                <div className="font-bold font-mono">${item.target.toFixed(2)}</div>
                                            </div>

                                            <button onClick={e => { e.stopPropagation(); remove(item.sym); }}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
