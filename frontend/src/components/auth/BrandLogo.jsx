import React from 'react';
import { cn } from '@/lib/utils';
import { Gem } from 'lucide-react';

// ── BrandLogo ─────────────────────────────────────────────────────────────────
// Fixed top logo/brand shown on auth pages (Login & Signup).
const BrandLogo = () => (
    <div className={cn('fixed top-4 left-4 z-20 flex items-center gap-2', 'md:left-1/2 md:-translate-x-1/2')}>
        <div className="bg-primary text-primary-foreground rounded-md p-1.5"><Gem className="h-4 w-4" /></div>
        <h1 className="text-base font-bold text-foreground">AI Summarizer</h1>
    </div>
);

export default BrandLogo;
