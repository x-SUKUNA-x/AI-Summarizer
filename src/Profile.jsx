import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Loader2, ArrowLeft, Trash2, FileText } from 'lucide-react';

export default function Profile() {
    const { user, loading: authLoading } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        } else if (user) {
            fetchSummaries();
        }
    }, [user, authLoading, navigate]);

    const fetchSummaries = async () => {
        setLoading(true);
        // Fetch all summaries for the current user (RLS will also protect this)
        const { data, error } = await supabase
            .from('summaries')
            .select('*')
            .order('id', { ascending: false }); // simple ordering assuming standard ids if created_at isn't made

        if (error) {
            console.error('Error fetching summaries:', error.message);
        } else {
            setSummaries(data || []);
        }
        setLoading(false);
    };

    const toggleBookmark = async (id, currentStatus) => {
        const { error } = await supabase
            .from('summaries')
            .update({ is_bookmarked: !currentStatus })
            .eq('id', id);

        if (!error) {
            setSummaries(summaries.map(s => s.id === id ? { ...s, is_bookmarked: !currentStatus } : s));
        }
    };

    const deleteSummary = async (id) => {
        const { error } = await supabase
            .from('summaries')
            .delete()
            .eq('id', id);

        if (!error) {
            setSummaries(summaries.filter(s => s.id !== id));
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
            <div className="max-w-4xl mx-auto flex flex-col h-full">

                <header className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors">
                            <ArrowLeft size={20} className="text-zinc-400" />
                        </Link>
                        <h1 className="text-2xl font-bold text-zinc-100">Your Summaries</h1>
                    </div>
                    <div className="text-sm text-zinc-500 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-lg">
                        {user?.email}
                    </div>
                </header>

                <main className="flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-500">
                            <Loader2 size={32} className="animate-spin text-indigo-500" />
                            <p>Loading your saved summaries...</p>
                        </div>
                    ) : summaries.length === 0 ? (
                        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl">
                            <FileText size={48} className="mx-auto text-zinc-700/50 mb-4" />
                            <p className="text-zinc-400 font-medium">You don't have any saved summaries yet.</p>
                            <Link to="/" className="inline-block mt-4 text-indigo-400 hover:text-indigo-300 font-medium pb-1 border-b border-indigo-500/30">
                                Create one now &rarr;
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {summaries.map((item) => (
                                <div key={item.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 transition-all shadow-lg hover:border-zinc-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-zinc-200">Transcript</h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleBookmark(item.id, item.is_bookmarked)}
                                                className={`p-2 rounded-xl transition-all ${item.is_bookmarked ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-zinc-800/50 text-zinc-500 hover:text-amber-400 border border-transparent'}`}
                                            >
                                                <Star size={18} fill={item.is_bookmarked ? 'currentColor' : 'none'} />
                                            </button>
                                            <button
                                                onClick={() => deleteSummary(item.id)}
                                                className="p-2 rounded-xl bg-zinc-800/50 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-sm text-zinc-400 bg-black/20 p-4 rounded-xl mb-4 line-clamp-3">
                                        {item.transcript}
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-indigo-400 mb-2 uppercase tracking-wider">AI Summary</h3>
                                        <div className="text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed">
                                            {item.summary}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

            </div>
        </div>
    );
}
