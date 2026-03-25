import React from 'react';
import { Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { fmtRelative } from '../../utils/dateUtils';

// ── Activity Item ─────────────────────────────────────────────────────────────
function ActivityItem({ item, index }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0"
        >
            <div className={`mt-0.5 w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center
                ${item.is_bookmarked ? 'bg-amber-400/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {item.is_bookmarked ? <Star size={11} fill="currentColor" /> : <Zap size={11} />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{item.summary}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{fmtRelative(item.created_at)}</p>
            </div>
        </motion.div>
    );
}

export default ActivityItem;
