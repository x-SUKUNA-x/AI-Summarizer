import React, { useState, useEffect } from 'react';

// ── Counter ───────────────────────────────────────────────────────────────────
// Animates a number from 0 up to `to` using a fast interval.
function Counter({ to }) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!to) { setVal(0); return; }
        let v = 0;
        const step = Math.max(1, Math.ceil(to / 40));
        const id = setInterval(() => { v = Math.min(v + step, to); setVal(v); if (v >= to) clearInterval(id); }, 30);
        return () => clearInterval(id);
    }, [to]);
    return <>{val}</>;
}

export default Counter;
