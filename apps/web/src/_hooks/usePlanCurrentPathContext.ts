'use client';

import { usePathname } from 'next/navigation';

export type AppMode = 'plan' | 'current';

export function usePlanCurrentPathContext(): AppMode {
    const pathname = usePathname() ?? '';
    return pathname.startsWith('/plan') ? 'plan' : 'current';
}
