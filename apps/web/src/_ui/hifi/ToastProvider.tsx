'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { Icon } from './Icon';

export type ToastTone = 'default' | 'success' | 'warning' | 'danger';
export interface ToastOptions {
    tone?: ToastTone;
    title?: string;
    duration?: number;
}

interface ToastItem {
    id: string;
    message: string;
    tone: ToastTone;
    title?: string;
}

type PushToast = (message: string, opts?: ToastOptions) => void;

const ToastCtx = createContext<PushToast>(() => {});

export function useToast() {
    return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const push = useCallback<PushToast>((message, opts = {}) => {
        const id = Math.random().toString(36).slice(2);
        const tone = opts.tone ?? 'default';
        const item: ToastItem = { id, message, tone, title: opts.title };
        setToasts((prev) => [...prev, item]);
        const duration = opts.duration ?? 3000;
        if (duration > 0) {
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
        }
    }, []);

    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast${t.tone !== 'default' ? ' toast--' + t.tone : ''}`}>
                        <div className="toast__text">
                            {t.title ? <span className="toast__title">{t.title}</span> : null}
                            {t.title ? <span className="toast__sep">·</span> : null}
                            <span className="toast__body">{t.message}</span>
                        </div>
                        <button
                            type="button"
                            className="toast__close"
                            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                            aria-label="닫기"
                        >
                            <Icon name="x" size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}
