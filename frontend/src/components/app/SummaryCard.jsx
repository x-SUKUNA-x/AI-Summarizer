import React, { useState } from 'react';
import { Loader2, Sparkles, X, Check, XCircle, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Summary Card ───────────────────────────────────────────────────────────────
function SummaryCard({ item, onSave, onReject, onSpeak, isSpeaking, speakingId }) {
    const [localSaved, setLocalSaved] = useState(item.saved || false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const speaking = isSpeaking && speakingId === item.id;

    const handleSave = async () => {
        if (localSaved || saving) return;
        setSaving(true);
        await onSave(item);
        setSaving(false);
        setLocalSaved(true);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl ml-auto"
        >
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-zinc-800/80 border-b border-zinc-700/40">
                    <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-purple-400" />
                        <span className="text-sm font-semibold text-zinc-200">Summary</span>
                    </div>
                    <button onClick={() => onReject(item.id)} className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded-full hover:bg-rose-500/10">
                        <X size={14} />
                    </button>
                </div>

                <div className="px-5 py-4 text-zinc-300 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                    {item.text}
                </div>

                <div className="px-4 py-2.5 bg-zinc-900/40 border-t border-zinc-700/40 flex items-center justify-end gap-2">
                    {saveSuccess && (
                        <span className="text-emerald-400 text-xs font-medium mr-auto flex items-center gap-1.5">
                            <Check size={12} /> Saved!
                        </span>
                    )}
                    {speaking && !saveSuccess && (
                        <span className="text-indigo-400 text-xs font-medium mr-auto flex items-center gap-1.5 animate-pulse">
                            <Volume2 size={12} /> Speaking...
                        </span>
                    )}
                    {!speaking && !saveSuccess && <div className="mr-auto" />}

                    <button
                        onClick={() => onSpeak(item)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${speaking ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/20'}`}
                    >
                        {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>

                    <button
                        onClick={() => onReject(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-rose-400 hover:text-white hover:bg-rose-500/80 rounded-lg text-xs font-medium transition-colors"
                    >
                        <XCircle size={13} /> Reject
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || localSaved}
                        className={`flex items-center gap-1 px-3 py-1.5 text-white rounded-lg text-xs font-medium transition-colors shadow ${localSaved ? 'bg-zinc-700 cursor-not-allowed opacity-60' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                    >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {localSaved ? 'Saved' : 'Save'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

export default SummaryCard;
