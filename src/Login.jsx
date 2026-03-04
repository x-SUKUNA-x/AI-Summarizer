import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            navigate('/');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 selection:bg-indigo-500/30">
            <div className="w-full max-w-md p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl shadow-xl backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 text-center">
                    Welcome Back
                </h2>

                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-zinc-400 text-sm font-medium">Email Address</label>
                        <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-inner group">
                            <Mail size={18} className="text-zinc-500 mr-3 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="bg-transparent border-none outline-none text-zinc-200 w-full placeholder:text-zinc-600"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-zinc-400 text-sm font-medium">Password</label>
                        <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-inner group">
                            <Lock size={18} className="text-zinc-500 mr-3 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="bg-transparent border-none outline-none text-zinc-200 w-full placeholder:text-zinc-600"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 mt-6 hover:-translate-y-[1px] active:translate-y-[1px]"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : (
                            <>
                                <span>Log In</span>
                                <LogIn size={18} className="mb-[1px]" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-zinc-500 text-sm">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
