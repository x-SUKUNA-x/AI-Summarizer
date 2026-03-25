import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeroGeometric } from './components/ui/shape-landing-hero';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#030303] text-slate-300 font-sans selection:bg-purple-500/30">
            {/* Navigation Bar */}
            <nav className="fixed top-0 w-full border-b border-white/5 bg-[#030303]/80 backdrop-blur-md z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-rose-500" />
                        <span className="text-white font-semibold tracking-tight text-lg">AI Summarizer</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-medium">
                        <Link to="/login" className="text-white/60 hover:text-white transition-colors hidden sm:block">Log in</Link>
                        <Link to="/signup" className="bg-white text-black px-4 py-2 rounded-full hover:bg-slate-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section — shape-landing-hero */}
            <div className="relative">
                <HeroGeometric
                    badge="Powered by Gemini 2.5 Flash + Groq Whisper"
                    title1="Understand every word."
                    title2="In seconds."
                />

                {/* CTA overlay at the bottom of the hero */}
                <div className="absolute bottom-16 left-0 right-0 z-20 flex flex-col items-center gap-6 px-6">
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.4 }}
                        className="text-white/40 text-sm tracking-wide text-center max-w-lg"
                    >
                        Upload audio, speak, or type — get instant structured AI summaries. Zero noise.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link
                            to="/signup"
                            className="px-8 py-3.5 rounded-full bg-white text-black font-semibold hover:bg-slate-200 transition-all flex items-center gap-2 group shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                        >
                            Start Summarizing Free
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>
                        <Link
                            to="/login"
                            className="px-8 py-3.5 rounded-full bg-white/5 text-white font-semibold border border-white/10 hover:bg-white/10 transition-all"
                        >
                            Log In
                        </Link>
                    </motion.div>
                </div>
            </div>

            {/* Features Section */}
            <section id="features" className="py-32 px-6 bg-[#030303]">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-20"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                            Everything you need to{' '}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-rose-300">
                                stay informed
                            </span>
                        </h2>
                        <p className="text-white/40 text-lg max-w-xl mx-auto">Built for professionals who need to extract knowledge from audio and text — fast.</p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: '🎙️',
                                title: 'Voice-to-Summary',
                                desc: 'Record your audio and get a Groq Whisper-powered transcript corrected and summarized instantly.',
                                gradient: 'from-indigo-500/[0.15]',
                                border: 'border-indigo-500/20',
                            },
                            {
                                icon: '✨',
                                title: 'Smart Correction',
                                desc: 'AI detects and fixes misheard words before summarizing, giving you clean, accurate output every time.',
                                gradient: 'from-violet-500/[0.15]',
                                border: 'border-violet-500/20',
                            },
                            {
                                icon: '💾',
                                title: 'Save & Revisit',
                                desc: 'All your summaries are stored in your profile. Listen to them aloud with one click.',
                                gradient: 'from-rose-500/[0.15]',
                                border: 'border-rose-500/20',
                            },
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.15 }}
                                className={`bg-gradient-to-br ${f.gradient} to-transparent border ${f.border} rounded-2xl p-6 backdrop-blur-sm`}
                            >
                                <div className="text-3xl mb-4">{f.icon}</div>
                                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6 text-center text-white/20 text-xs bg-[#030303]">
                © {new Date().getFullYear()} AI Summarizer · Powered by Gemini & Groq
            </footer>
        </div>
    );
}
