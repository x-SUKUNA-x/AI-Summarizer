import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Thinking Bubble ────────────────────────────────────────────────────────────
function ThinkingBubble() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl ml-auto"
        >
            <div className="rounded-2xl border border-zinc-700/30 bg-zinc-800/40 px-5 py-4 flex items-center gap-3 text-zinc-500 text-sm">
                <Loader2 size={16} className="text-indigo-400 animate-spin flex-shrink-0" />
                <span className="animate-pulse">Analyzing with Gemini 2.5 Flash…</span>
            </div>
        </motion.div>
    );
}

export default ThinkingBubble;
