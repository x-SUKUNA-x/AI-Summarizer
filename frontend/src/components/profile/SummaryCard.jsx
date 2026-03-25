import React, { useState } from 'react';
import { Star, Loader2, Trash2, Volume2, VolumeX, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtRelative } from '../../utils/dateUtils';

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ item, index, onToggleBookmark, onDelete, speakingId, toggleSpeech }) {
    const [deleting, setDeleting] = useState(false);
    const speaking = speakingId === item.id;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`group relative rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1
                ${item.is_bookmarked
                    ? 'bg-gradient-to-br from-[#1a1500] via-[#13120d] to-[#0f0e0b] border-amber-500/25'
                    : 'bg-[#0f0f11] border-white/[0.07] hover:border-indigo-500/30'
                }`}
        >
            {/* top accent line */}
            <div className={`h-[1.5px] w-full ${item.is_bookmarked
                ? 'bg-gradient-to-r from-amber-500/60 via-orange-400/40 to-transparent'
                : 'bg-gradient-to-r from-indigo-500/50 via-purple-500/30 to-transparent'}`}
            />

            <div className="p-5 flex flex-col gap-3">
                {/* top row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {item.is_bookmarked
                            ? <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                                <Star size={8} fill="currentColor" /> Starred
                            </span>
                            : <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2.5 py-1 rounded-full">
                                <Zap size={8} /> Gemini
                            </span>
                        }
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                            <Clock size={8} /> {fmtRelative(item.created_at)}
                        </span>
                    </div>
                    {/* action buttons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                        <button onClick={() => toggleSpeech(item.id, item.summary)}
                            className={`p-2 rounded-xl text-xs font-medium transition-all border
                                ${speaking
                                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                    : 'text-zinc-500 border-white/[0.06] hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/20'}`}>
                            {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
                        <button onClick={() => onToggleBookmark(item.id, item.is_bookmarked)}
                            className={`p-2 rounded-xl text-xs font-medium transition-all border ml-0.5
                                ${item.is_bookmarked
                                    ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                                    : 'text-zinc-500 border-white/[0.06] hover:text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/20'}`}>
                            <Star size={12} fill={item.is_bookmarked ? 'currentColor' : 'none'} />
                        </button>
                        <button onClick={async () => { setDeleting(true); await onDelete(item.id); }}
                            disabled={deleting}
                            className="p-2 rounded-xl text-xs font-medium transition-all border border-white/[0.06] text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 hover:border-rose-400/20 ml-0.5 disabled:opacity-40">
                            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                    </div>
                </div>

                {/* input snippet */}
                {item.transcript && (
                    <p className="text-[11px] text-zinc-600 italic line-clamp-1 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2">
                        "{item.transcript}"
                    </p>
                )}

                {/* summary */}
                <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">{item.summary}</p>

                {/* speaking indicator */}
                <AnimatePresence>
                    {speaking && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 text-indigo-400 text-[11px] mt-1">
                            <span className="flex gap-0.5 items-end h-3">
                                {[0, 0.1, 0.2, 0.3, 0.15].map((d, i) => (
                                    <span key={i} className="w-[2px] bg-indigo-400 rounded-full animate-bounce"
                                        style={{ height: `${8 + Math.random() * 4}px`, animationDelay: `${d}s` }} />
                                ))}
                            </span>
                            Speaking aloud…
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

export default SummaryCard;
