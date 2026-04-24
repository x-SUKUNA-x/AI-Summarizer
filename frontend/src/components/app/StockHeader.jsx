import { Link, useLocation } from 'react-router-dom';
import { Activity, Search, Star } from 'lucide-react';

const TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "NFLX", "AMD", "INTC", "JPM", "V"];
const MOCK = { AAPL: 1.24, MSFT: -0.32, GOOGL: 0.87, AMZN: 1.56, META: 2.11, TSLA: -1.44, NVDA: 3.22, NFLX: 0.76, AMD: -0.95, INTC: -1.23, JPM: 0.44, V: 0.31 };

export function StockHeader() {
    const location = useLocation();
    return (
        <div className="w-full border-b border-white/10 bg-[#08090e]/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center justify-between px-6 py-4">
                <Link to="/">
                    <div className="flex items-center gap-2 cursor-pointer group">
                        <Activity className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                        <span className="font-mono font-bold tracking-widest text-lg text-white">
                            STOCK <span className="text-cyan-400/50">·</span> PULSE
                        </span>
                    </div>
                </Link>
                <div className="flex items-center gap-6">
                    <Link to="/stock">
                        <div className={`flex items-center gap-2 cursor-pointer transition-colors ${location.pathname === '/stock' ? 'text-white' : 'text-white/40 hover:text-white'}`}>
                            <Search className="h-4 w-4" />
                            <span className="font-mono text-sm tracking-wider">SEARCH</span>
                        </div>
                    </Link>
                    <Link to="/watchlist">
                        <div className={`flex items-center gap-2 cursor-pointer transition-colors ${location.pathname === '/watchlist' ? 'text-white' : 'text-white/40 hover:text-white'}`}>
                            <Star className="h-4 w-4" />
                            <span className="font-mono text-sm tracking-wider">MY WATCHLIST</span>
                        </div>
                    </Link>
                </div>
            </div>
            {/* Ticker tape */}
            <div className="w-full overflow-hidden border-t border-white/5 py-2 bg-white/[0.02]">
                <div className="flex whitespace-nowrap animate-marquee">
                    {[...TICKERS, ...TICKERS].map((t, i) => (
                        <span key={`${t}-${i}`} className="inline-flex items-center gap-2 mx-6">
                            <span className="font-mono text-sm text-white/70">{t}</span>
                            <span className={`font-mono text-sm ${MOCK[t] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {MOCK[t] > 0 ? '+' : ''}{MOCK[t]}%
                            </span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
