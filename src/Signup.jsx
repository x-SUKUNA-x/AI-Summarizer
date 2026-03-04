import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, UserPlus, Loader2 } from 'lucide-react';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                console.error("Supabase Auth Error:", error);
                setError(error.message);
            } else {
                setMessage('Registration successful! Please log in.');
                setTimeout(() => navigate('/login'), 2500);
            }
        } catch (err) {
            console.error("Full error details:", err);
            setError("Failed to fetch. Please see the console line for full details.");
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 selection:bg-emerald-500/30">
            <div className="w-full max-w-md p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl shadow-xl backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent mb-6 text-center">
                    Create Account
                </h2>

                {error && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                        {message}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-zinc-400 text-sm font-medium">Email Address</label>
                        <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all shadow-inner group">
                            <Mail size={18} className="text-zinc-500 mr-3 group-focus-within:text-emerald-400 transition-colors" />
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
                        <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all shadow-inner group">
                            <Lock size={18} className="text-zinc-500 mr-3 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="bg-transparent border-none outline-none text-zinc-200 w-full placeholder:text-zinc-600"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20 mt-6 hover:-translate-y-[1px] active:translate-y-[1px]"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : (
                            <>
                                <span>Sign Up</span>
                                <UserPlus size={18} className="mb-[1px]" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-zinc-500 text-sm">
                    Already have an account?{' '}
                    <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                        Log in here
                    </Link>
                </p>
            </div>
        </div>
    );
}
