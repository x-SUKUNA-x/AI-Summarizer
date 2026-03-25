import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SummaryCard
 * A premium AI SaaS summary card with glassmorphism, gradient border glow,
 * smooth fade-in, and subtle hover-scale. Accepts a single `summary` string.
 */
export function SummaryCard({ summary, className }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 18, scale: 0.97 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
			whileHover={{ scale: 1.012, transition: { duration: 0.25, ease: "easeOut" } }}
			className={cn("relative group w-full max-w-xl mx-auto", className)}
		>
			{/* Gradient glow ring */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-[1.5px] rounded-2xl
          bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-rose-400/30
          opacity-0 group-hover:opacity-100 transition-opacity duration-500
          blur-[2px]"
			/>

			{/* Card body */}
			<div
				className="relative rounded-2xl border border-white/10
          bg-white/5 backdrop-blur-xl
          shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)]
          px-7 py-6"
			>
				{/* Title row */}
				<div className="flex items-center gap-2 mb-4">
					<Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
					<span className="text-sm font-semibold tracking-wide text-purple-300 uppercase letter-spacing-widest">
						Summary
					</span>
				</div>

				{/* Summary text */}
				<p className="text-[15px] leading-[1.75] text-white/80 font-light tracking-normal">
					{summary}
				</p>

				{/* Subtle bottom shimmer line */}
				<div
					aria-hidden
					className="absolute bottom-0 left-6 right-6 h-px
            bg-gradient-to-r from-transparent via-white/10 to-transparent"
				/>
			</div>
		</motion.div>
	);
}

export default SummaryCard;
