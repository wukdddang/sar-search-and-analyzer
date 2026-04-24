'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartItem {
    id: string;
    product_id: string;
    mission: string;
    product_type: string;
    sensing_start: string;
    file_size_bytes: number;
    nas_available: boolean;
}

interface CartContextValue {
    items: CartItem[];
    hasItem(id: string): boolean;
    add(item: CartItem): void;
    remove(id: string): void;
    clear(): void;
    totalBytes: number;
    downloadRequiredBytes: number;
    nasAvailableCount: number;
    // 모달 표시 상태
    isOpen: boolean;
    open(): void;
    close(): void;
    toggle(): void;
}

const STORAGE_KEY = 'sar.cart.v1';

const CartCtx = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setItems(JSON.parse(raw));
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

    const hasItem = useCallback((id: string) => items.some((i) => i.id === id), [items]);
    const add = useCallback((item: CartItem) => {
        setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    }, []);
    const remove = useCallback((id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);
    const clear = useCallback(() => setItems([]), []);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    const totalBytes = useMemo(() => items.reduce((sum, i) => sum + i.file_size_bytes, 0), [items]);
    const downloadRequiredBytes = useMemo(
        () => items.filter((i) => !i.nas_available).reduce((sum, i) => sum + i.file_size_bytes, 0),
        [items],
    );
    const nasAvailableCount = useMemo(() => items.filter((i) => i.nas_available).length, [items]);

    const value = useMemo(
        () => ({
            items,
            hasItem,
            add,
            remove,
            clear,
            totalBytes,
            downloadRequiredBytes,
            nasAvailableCount,
            isOpen,
            open,
            close,
            toggle,
        }),
        [items, hasItem, add, remove, clear, totalBytes, downloadRequiredBytes, nasAvailableCount, isOpen, open, close, toggle],
    );

    return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartContextValue {
    const ctx = useContext(CartCtx);
    if (!ctx) throw new Error('CartContext가 Provider 외부에서 사용됨');
    return ctx;
}
