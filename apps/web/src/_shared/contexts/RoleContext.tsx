'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ViewRole = 'user' | 'admin';

const STORAGE_KEY = 'sar.plan.role.v1';

interface RoleContextValue {
    role: ViewRole;
    setRole(next: ViewRole): void;
}

const RoleCtx = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname() ?? '';
    const router = useRouter();

    const initial: ViewRole = pathname.includes('/sar/admin') ? 'admin' : 'user';
    const [role, setRoleState] = useState<ViewRole>(initial);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as ViewRole | null;
            if (stored) setRoleState(stored);
        } catch {
            // ignore
        }
    }, []);

    // 경로에 따라 role 동기화 (링크 직접 클릭 대응)
    useEffect(() => {
        if (pathname.includes('/sar/admin') && role !== 'admin') setRoleState('admin');
        else if (pathname.includes('/sar/user') && role !== 'user') setRoleState('user');
    }, [pathname, role]);

    const setRole = useCallback(
        (next: ViewRole) => {
            setRoleState(next);
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // ignore
            }
            // 역할 전환 시 해당 역할의 기본 페이지로 이동
            const target = next === 'admin' ? '/plan/sar/admin/dashboard' : '/plan/sar/user/search';
            router.push(target);
        },
        [router],
    );

    const value = useMemo(() => ({ role, setRole }), [role, setRole]);
    return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>;
}

export function useRole() {
    const ctx = useContext(RoleCtx);
    if (!ctx) throw new Error('RoleContext가 Provider 외부에서 사용됨');
    return ctx;
}
