import React from 'react';
import { motion } from 'framer-motion';

// ── User Bubble ────────────────────────────────────────────────────────────────
function UserBubble({ text, type = 'text' }) {
    const icons = { text: '💬', audio: '🎙️', file: '🎵' };
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="self-end max-w-[75%]"
        >
            <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-zinc-200">
                <span className="mr-2 opacity-70">{icons[type]}</span>{text}
            </div>
        </motion.div>
    );
}

export default UserBubble;
