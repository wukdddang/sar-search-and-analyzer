'use client';

import clsx from 'clsx';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastVariant = 'default' | 'success' | 'destructive';

interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    show(message: string, variant?: ToastVariant): void;
    success(message: string): void;
    error(message: string): void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const show = useCallback((message: string, variant: ToastVariant = 'default') => {
        const id = ++idRef.current;
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const value = useMemo<ToastContextValue>(
        () => ({
            show,
            success: (m) => show(m, 'success'),
            error: (m) => show(m, 'destructive'),
        }),
        [show],
    );

    return (
        <ToastCtx.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={clsx(
                            'pointer-events-auto rounded-md px-4 py-3 text-sm shadow-lg',
                            t.variant === 'success' && 'bg-emerald-600 text-white',
                            t.variant === 'destructive' && 'bg-red-600 text-white',
                            t.variant === 'default' && 'bg-gray-800 text-white',
                        )}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastCtx);
    if (!ctx) throw new Error('ToastContext가 Provider 외부에서 사용됨');
    return ctx;
}
