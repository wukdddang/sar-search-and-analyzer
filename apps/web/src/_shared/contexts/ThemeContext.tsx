'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'sar.theme.v1';

interface ThemeContextValue {
    theme: ThemeMode;
    setTheme(next: ThemeMode): void;
    toggle(): void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>('dark');

    useEffect(() => {
        const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as
            | ThemeMode
            | null;
        const initial: ThemeMode =
            stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark');
        setThemeState(initial);
        applyTheme(initial);
    }, []);

    const setTheme = useCallback((next: ThemeMode) => {
        setThemeState(next);
        applyTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

    const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
    return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeCtx);
    if (!ctx) throw new Error('ThemeContext가 Provider 외부에서 사용됨');
    return ctx;
}
