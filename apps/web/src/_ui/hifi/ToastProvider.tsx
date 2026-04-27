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
    exiting?: boolean;
}

type PushToast = (message: string, opts?: ToastOptions) => void;

const ToastCtx = createContext<PushToast>(() => {});

// CSS .toast--exiting 애니메이션 길이와 일치시킬 것.
const EXIT_ANIMATION_MS = 220;

export function useToast() {
    return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    // 두 단계 제거: exiting 플래그를 켜서 페이드아웃 → 애니메이션 끝나면 배열에서 삭제.
    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, EXIT_ANIMATION_MS);
    }, []);

    const push = useCallback<PushToast>(
        (message, opts = {}) => {
            const id = Math.random().toString(36).slice(2);
            const tone = opts.tone ?? 'default';
            const item: ToastItem = { id, message, tone, title: opts.title };
            setToasts((prev) => [...prev, item]);
            const duration = opts.duration ?? 3000;
            if (duration > 0) {
                setTimeout(() => dismiss(id), duration);
            }
        },
        [dismiss],
    );

    return (
        <ToastCtx.Provider value={push}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={
                            'toast' +
                            (t.tone !== 'default' ? ' toast--' + t.tone : '') +
                            (t.exiting ? ' toast--exiting' : '')
                        }
                    >
                        <div className="toast__text">
                            {t.title ? <span className="toast__title">{t.title}</span> : null}
                            {t.title ? <span className="toast__sep">·</span> : null}
                            <span className="toast__body">{t.message}</span>
                        </div>
                        <button
                            type="button"
                            className="toast__close"
                            onClick={() => dismiss(t.id)}
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
