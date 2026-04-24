'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

interface Prefs {
    theme: Theme;
    density: Density;
    toggleTheme: () => void;
    toggleDensity: () => void;
    setTheme: (t: Theme) => void;
    setDensity: (d: Density) => void;
}

const STORAGE_THEME = 'sar.theme.v1';
const STORAGE_DENSITY = 'sar.density.v1';

const Ctx = createContext<Prefs | null>(null);

function readInitial(): { theme: Theme; density: Density } {
    if (typeof document === 'undefined') return { theme: 'dark', density: 'comfortable' };
    const theme = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
    const density = (document.documentElement.getAttribute('data-density') as Density) || 'comfortable';
    return { theme, density };
}

export function HifiPrefsProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    const [density, setDensityState] = useState<Density>('comfortable');

    useEffect(() => {
        const { theme: t, density: d } = readInitial();
        setThemeState(t);
        setDensityState(d);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem(STORAGE_THEME, next);
            } catch {}
        }
    }, []);

    const setDensity = useCallback((next: Density) => {
        setDensityState(next);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-density', next);
            try {
                localStorage.setItem(STORAGE_DENSITY, next);
            } catch {}
        }
    }, []);

    const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
    const toggleDensity = useCallback(
        () => setDensity(density === 'compact' ? 'comfortable' : 'compact'),
        [density, setDensity],
    );

    return (
        <Ctx.Provider value={{ theme, density, toggleTheme, toggleDensity, setTheme, setDensity }}>{children}</Ctx.Provider>
    );
}

export function useHifiPrefs() {
    const ctx = useContext(Ctx);
    if (!ctx) {
        return {
            theme: 'dark' as Theme,
            density: 'comfortable' as Density,
            toggleTheme: () => {},
            toggleDensity: () => {},
            setTheme: () => {},
            setDensity: () => {},
        };
    }
    return ctx;
}
