'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface HifiScene {
    id: string;
    mission: string;
    mode?: string;
    product: string;
    pol?: string;
    date: string;
    orbit?: number;
    have: boolean;
    region: string;
    size: string;
    /** Footprint polygon ring as [lon, lat] pairs (EPSG:4326). Optional for map overlay. */
    footprint?: Array<[number, number]>;
}

interface HifiCartValue {
    items: HifiScene[];
    has: (id: string) => boolean;
    add: (scene: HifiScene) => void;
    addMany: (scenes: HifiScene[]) => void;
    remove: (id: string) => void;
    removeMany: (ids: string[]) => void;
    clear: () => void;
    totalGb: number;
    needCount: number;
}

const STORAGE_KEY = 'sar.hifi.cart.v1';

const Ctx = createContext<HifiCartValue | null>(null);

const SEED: HifiScene[] = [
    {
        id: 'S1A_IW_SLC__1SDV_20260420T092341_20260420T092408_058912_074A2B_C3D1',
        mission: 'S1A',
        mode: 'IW',
        product: 'SLC',
        pol: 'VV+VH',
        date: '2026-04-20 09:23',
        orbit: 58912,
        have: true,
        region: 'Pohang',
        size: '4.2 GB',
    },
    {
        id: 'S1A_IW_GRDH_1SDV_20260418T211515_20260418T211540_058887_0749E2_8F4A',
        mission: 'S1A',
        mode: 'IW',
        product: 'GRD',
        pol: 'VV+VH',
        date: '2026-04-18 21:15',
        orbit: 58887,
        have: false,
        region: 'Gyeongju',
        size: '1.6 GB',
    },
    {
        id: 'S1C_IW_SLC__1SDV_20260417T092258_20260417T092326_002134_003F81_AA01',
        mission: 'S1C',
        mode: 'IW',
        product: 'SLC',
        pol: 'VV+VH',
        date: '2026-04-17 09:22',
        orbit: 2134,
        have: true,
        region: 'Pohang',
        size: '4.1 GB',
    },
];

export function HifiCartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<HifiScene[]>(SEED);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as HifiScene[];
                if (Array.isArray(parsed)) setItems(parsed);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // ignore
        }
    }, [items]);

    const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);
    const add = useCallback((scene: HifiScene) => {
        setItems((prev) => (prev.some((i) => i.id === scene.id) ? prev : [scene, ...prev]));
    }, []);
    const addMany = useCallback((scenes: HifiScene[]) => {
        setItems((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const toAdd = scenes.filter((s) => !existing.has(s.id));
            return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });
    }, []);
    const remove = useCallback((id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);
    const removeMany = useCallback((ids: string[]) => {
        const idSet = new Set(ids);
        setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
    }, []);
    const clear = useCallback(() => setItems([]), []);

    const totalGb = useMemo(() => items.reduce((a, s) => a + parseFloat(s.size), 0), [items]);
    const needCount = useMemo(() => items.filter((s) => !s.have).length, [items]);

    const value = useMemo<HifiCartValue>(
        () => ({ items, has, add, addMany, remove, removeMany, clear, totalGb, needCount }),
        [items, has, add, addMany, remove, removeMany, clear, totalGb, needCount],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHifiCart() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('HifiCartContext가 Provider 외부에서 사용됨');
    return ctx;
}
