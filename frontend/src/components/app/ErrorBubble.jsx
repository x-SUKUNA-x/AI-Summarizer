import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Error Bubble ───────────────────────────────────────────────────────────────
function ErrorBubble({ text, onDismiss }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl ml-auto"
        >
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-400 text-sm flex items-start justify-between gap-3">
                <span>{text}</span>
                <button onClick={onDismiss} className="shrink-0 hover:text-rose-300"><X size={14} /></button>
            </div>
        </motion.div>
    );
}

export default ErrorBubble;
