import React, { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';
import { stopSpeech } from './speechUtils';
import { useSpeech } from './hooks/useSpeech';
import { Link, useNavigate } from 'react-router-dom';
import {
    Sparkles, FileText, ArrowLeft,
    ChevronRight, TrendingUp, Clock,
    Plus, LogOut, Star, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Counter from './components/profile/Counter';
import SummaryCard from './components/profile/SummaryCard';
import ActivityItem from './components/profile/ActivityItem';
import { fmtRelative } from './utils/dateUtils';


/* ─── Main ─────────────────────────────────────────────────────────────────── */
export default function Profile() {
    const { user, logout, loading: authLoading } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const { speakingId, toggleSpeech } = useSpeech();
    const [activeTab, setActiveTab] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !user) navigate('/login');
        else if (user) {
            api.getSummaries()
                .then(data => {
                    const sorted = (data || []).sort((a, b) => (b.is_bookmarked ? 1 : 0) - (a.is_bookmarked ? 1 : 0));
                    setSummaries(sorted);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
        return () => stopSpeech();
    }, [user, authLoading, navigate]);

    const toggleBookmark = async (id, cur) => {
        try {
            await api.toggleBookmark(id, !cur);
            setSummaries(prev => prev.map(s => s.id === id ? { ...s, is_bookmarked: !cur } : s)
                .sort((a, b) => (b.is_bookmarked ? 1 : 0) - (a.is_bookmarked ? 1 : 0)));
        } catch (e) { console.error(e); }
    };
    const deleteSummary = async (id) => {
        try { await api.deleteSummary(id); setSummaries(prev => prev.filter(s => s.id !== id)); }
        catch (e) { console.error(e); }
    };

    if (authLoading) return (
        <div className="min-h-screen bg-[#08080a] flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
        </div>
    );

    const starred = summaries.filter(s => s.is_bookmarked);
    const recent = [...summaries].slice(0, 5);
    const displayed = activeTab === 'starred' ? starred : summaries;
    const letter = user?.email?.[0]?.toUpperCase() || '?';
    const username = user?.email?.split('@')[0] || 'User';

    return (
        <div className="min-h-screen bg-[#08080a] text-zinc-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ambient bg */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-950/20 to-transparent" />
                <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-indigo-600/6 rounded-full blur-[140px]" />
                <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

                {/* ── top nav ──────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                        Back to chat
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link to="/"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                                bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500
                                shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                                transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                        >
                            <Plus size={14} />
                            New Summary
                        </Link>
                        <button
                            onClick={logout}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-rose-400
                                border border-zinc-800 hover:border-rose-500/40 bg-zinc-900/60 hover:bg-rose-500/10
                                transition-all duration-200"
                        >
                            <LogOut size={13} />
                            Log out
                        </button>
                    </div>
                </div>

                {/* ── hero banner ───────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative rounded-3xl overflow-hidden mb-6 border border-white/[0.07]"
                >
                    {/* rich banner */}
                    <div className="relative h-44 bg-[#0d0d10]">
                        {/* grid */}
                        <div className="absolute inset-0 opacity-[0.07]"
                            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
                        {/* glow blobs on banner */}
                        <div className="absolute top-0 left-1/4 w-64 h-32 bg-indigo-600/30 rounded-full blur-3xl" />
                        <div className="absolute top-4 right-1/3 w-48 h-24 bg-purple-600/25 rounded-full blur-3xl" />
                        <div className="absolute -bottom-4 left-1/2 w-80 h-20 bg-pink-700/15 rounded-full blur-3xl" />

                        {/* decorative orbit rings */}
                        <div className="absolute top-8 right-12 w-32 h-32 rounded-full border border-indigo-500/10" />
                        <div className="absolute top-4 right-8 w-48 h-48 rounded-full border border-purple-500/8" />

                        {/* title inside banner */}
                        <div className="absolute bottom-5 left-6">
                            <p className="text-[11px] text-indigo-400/70 uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                                <Sparkles size={9} /> AI Summarizer
                            </p>
                            <h1 className="text-3xl font-black text-white tracking-tight">My Profile</h1>
                        </div>
                    </div>

                    {/* profile info row */}
                    <div className="bg-[#0f0f12] border-t border-white/[0.05] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* avatar */}
                        <div className="relative flex-shrink-0">
                            <div className="w-16 h-16 rounded-2xl p-[2px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_30px_rgba(139,92,246,0.45)]">
                                <div className="w-full h-full rounded-[14px] bg-[#0f0f12] flex items-center justify-center text-xl font-black text-white">{letter}</div>
                            </div>
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0f0f12] shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                        </div>

                        {/* name + email */}
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-white capitalize">{username}</h2>
                            <p className="text-sm text-zinc-500">{user?.email}</p>
                        </div>

                        {/* pills */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 rounded-full font-medium">
                                <FileText size={9} className="text-indigo-400" />{summaries.length} Summaries
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 rounded-full font-medium">
                                <Star size={9} className="text-amber-400" />{starred.length} Starred
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-400/8 border border-emerald-400/20 px-3 py-1.5 rounded-full font-medium">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />Active
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* ── bento grid ────────────────────────────────────────────────── */}
                <div className="grid grid-cols-12 gap-4 mb-6">

                    {/* big stat — total */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="col-span-12 sm:col-span-4 relative rounded-2xl bg-gradient-to-br from-indigo-600/20 via-[#0f0f12] to-[#0f0f12] border border-indigo-500/20 p-6 overflow-hidden group hover:border-indigo-500/40 transition-all">
                        <div className="absolute -top-6 -right-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-colors" />
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-4">
                            <FileText size={18} className="text-indigo-400" />
                        </div>
                        <p className="text-5xl font-black text-white tabular-nums"><Counter to={summaries.length} /></p>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">Total Summaries</p>
                        <div className="mt-4 flex items-center gap-1 text-indigo-400 text-xs font-medium">
                            <TrendingUp size={11} /> All time
                        </div>
                    </motion.div>

                    {/* starred stat */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="col-span-6 sm:col-span-4 relative rounded-2xl bg-gradient-to-br from-amber-600/15 via-[#0f0f12] to-[#0f0f12] border border-amber-500/15 p-6 overflow-hidden group hover:border-amber-500/35 transition-all">
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-amber-500/15 rounded-full blur-3xl group-hover:bg-amber-500/25 transition-colors" />
                        <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-4">
                            <Star size={18} className="text-amber-400" fill="currentColor" />
                        </div>
                        <p className="text-5xl font-black text-white tabular-nums"><Counter to={starred.length} /></p>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">Starred</p>
                    </motion.div>

                    {/* recent activity panel */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="col-span-6 sm:col-span-4 relative rounded-2xl bg-[#0f0f12] border border-white/[0.07] p-6 overflow-hidden group hover:border-white/[0.12] transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                                    <Clock size={13} className="text-pink-400" />
                                </div>
                                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Recent</span>
                            </div>
                        </div>
                        {recent.length === 0
                            ? <p className="text-xs text-zinc-600 italic">No activity yet</p>
                            : recent.slice(0, 3).map((item, i) => (
                                <div key={item.id} className="flex items-center gap-2 py-2 border-b border-white/[0.03] last:border-0">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.is_bookmarked ? 'bg-amber-400' : 'bg-indigo-500'}`} />
                                    <p className="text-[11px] text-zinc-400 line-clamp-1 flex-1">{item.summary}</p>
                                    <p className="text-[9px] text-zinc-700 flex-shrink-0">{fmtRelative(item.created_at)}</p>
                                </div>
                            ))
                        }
                    </motion.div>

                    {/* CTA card */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="col-span-12 relative rounded-2xl border border-white/[0.07] bg-[#0f0f12] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/10 via-transparent to-purple-900/10 pointer-events-none" />
                        <div className="relative">
                            <p className="font-bold text-white text-lg">Ready to summarize something new?</p>
                            <p className="text-sm text-zinc-500 mt-0.5">Paste text, record audio or upload a file — Gemini does the rest.</p>
                        </div>
                        <div className="relative flex items-center gap-3 flex-shrink-0">
                            <Link to="/"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white
                                    bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500
                                    shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_32px_rgba(99,102,241,0.6)]
                                    transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                            >
                                <Sparkles size={14} />
                                Start Summarizing
                                <ChevronRight size={14} />
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* ── summaries section ───────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 p-1 bg-[#0f0f12] border border-white/[0.07] rounded-2xl">
                        {[
                            { id: 'all', label: 'All', count: summaries.length },
                            { id: 'starred', label: '⭐ Starred', count: starred.length },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                                    ${activeTab === tab.id
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'}`}
                            >
                                {tab.label}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums
                                    ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06] text-zinc-600'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-zinc-600 hidden sm:block">
                        {displayed.length} {displayed.length === 1 ? 'summary' : 'summaries'}
                    </p>
                </div>

                {/* cards */}
                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-20">
                        <div className="w-10 h-10 rounded-full border border-indigo-500/20 border-t-indigo-500 animate-spin" />
                        <p className="text-zinc-600 text-sm animate-pulse">Loading…</p>
                    </div>
                ) : displayed.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex flex-col items-center py-24 gap-5 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-[#0f0f12] border border-dashed border-white/[0.08] flex items-center justify-center">
                            {activeTab === 'starred' ? <Star size={28} className="text-zinc-700" /> : <FileText size={28} className="text-zinc-700" />}
                        </div>
                        <div>
                            <p className="text-zinc-200 font-bold text-lg mb-1">
                                {activeTab === 'starred' ? 'No starred summaries yet' : 'Nothing here yet'}
                            </p>
                            <p className="text-zinc-600 text-sm">
                                {activeTab === 'starred' ? 'Star your favourite summaries to pin them here' : 'Create your first summary to get started'}
                            </p>
                        </div>
                        {activeTab === 'all' && (
                            <Link to="/"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white
                                    bg-gradient-to-r from-indigo-500 to-purple-600
                                    shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]
                                    hover:-translate-y-0.5 transition-all duration-300">
                                <Plus size={14} /> Create first summary
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-16">
                        <AnimatePresence mode="popLayout">
                            {displayed.map((item, i) => (
                                <SummaryCard key={item.id} item={item} index={i}
                                    onToggleBookmark={toggleBookmark} onDelete={deleteSummary}
                                    speakingId={speakingId} toggleSpeech={toggleSpeech} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
