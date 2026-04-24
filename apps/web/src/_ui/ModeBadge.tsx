'use client';

import { usePlanCurrentPathContext } from '@/_hooks/usePlanCurrentPathContext';

export function ModeBadge() {
    const mode = usePlanCurrentPathContext();
    const label = mode === 'plan' ? 'Plan' : 'Current';
    const bg = mode === 'plan' ? 'bg-amber-400 text-amber-950' : 'bg-blue-600 text-white';
    return <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${bg}`}>{label}</span>;
}
