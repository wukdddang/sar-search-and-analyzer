'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useHifiCart } from '@/_shared/contexts/HifiCartContext';

import { Icon } from './Icon';
import { Quicklook } from './Quicklook';
import { useToast } from './ToastProvider';

interface CartOverlayValue {
    open: boolean;
    show: () => void;
    hide: () => void;
    toggle: () => void;
}

const Ctx = createContext<CartOverlayValue | null>(null);

export function CartOverlayProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    const show = useCallback(() => setOpen(true), []);
    const hide = useCallback(() => setOpen(false), []);
    const toggle = useCallback(() => setOpen((v) => !v), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Global shortcut: `c` opens the panel (ignore when typing in inputs)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'c' && e.key !== 'C') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            setOpen((v) => !v);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const value = useMemo<CartOverlayValue>(() => ({ open, show, hide, toggle }), [open, show, hide, toggle]);

    return (
        <Ctx.Provider value={value}>
            {children}
            <CartOverlayPanel />
        </Ctx.Provider>
    );
}

export function useCartOverlay() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('CartOverlayContext가 Provider 외부에서 사용됨');
    return ctx;
}

function CartOverlayPanel() {
    const { open, hide } = useCartOverlay();
    const { items, remove, clear, totalGb, needCount } = useHifiCart();
    const toast = useToast();

    return (
        <>
            {/* Backdrop */}
            <div
                aria-hidden="true"
                onClick={hide}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.35)',
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? 'auto' : 'none',
                    transition: 'opacity 180ms ease',
                    zIndex: 59,
                    backdropFilter: 'blur(2px)',
                }}
            />
            {/* Slide-in panel */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="장바구니"
                aria-hidden={!open}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    height: '100dvh',
                    width: 'min(420px, 100vw)',
                    background: 'var(--bg-1)',
                    borderLeft: '1px solid var(--border-default)',
                    transform: open ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 220ms ease',
                    zIndex: 60,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div
                    className="between"
                    style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}
                >
                    <div className="row gap-2">
                        <Icon name="cart" size={16} />
                        <span style={{ fontWeight: 600 }}>장바구니</span>
                        <span className="badge badge--accent">{items.length}</span>
                    </div>
                    <div className="row gap-1">
                        {items.length > 0 ? (
                            <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                    clear();
                                    toast('장바구니를 비웠습니다');
                                }}
                            >
                                <Icon name="trash" size={12} /> 비우기
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="btn btn--ghost btn--icon btn--sm"
                            onClick={hide}
                            aria-label="닫기"
                        >
                            <Icon name="x" size={14} />
                        </button>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="empty" style={{ padding: '60px 20px', flex: 1 }}>
                        <div className="empty__icon">🛰</div>
                        <div>담긴 scene이 없습니다</div>
                        <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
                            검색 결과에서 <b>담기</b>를 눌러보세요
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div
                            className="col gap-1"
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-subtle)',
                                fontSize: 12,
                            }}
                        >
                            <div className="between">
                                <span className="faint">총 용량</span>
                                <span className="mono tabular" style={{ fontWeight: 600 }}>
                                    {totalGb.toFixed(1)} GB
                                </span>
                            </div>
                            <div className="between">
                                <span className="faint">받기 필요</span>
                                <span className="mono tabular">
                                    {needCount} / {items.length}
                                </span>
                            </div>
                        </div>

                        {/* List */}
                        <div className="col" style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                            {items.map((s) => (
                                <div
                                    key={s.id}
                                    className="row gap-2"
                                    style={{
                                        padding: '8px 8px',
                                        borderRadius: 6,
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <Quicklook sceneId={s.id} size={40} />
                                    <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                                        <div className="mono truncate" style={{ fontSize: 11 }}>
                                            {s.id.slice(0, 42)}…
                                        </div>
                                        <div className="row gap-2" style={{ fontSize: 11 }}>
                                            <span className="badge badge--solid" style={{ fontSize: 10 }}>
                                                {s.mission}
                                            </span>
                                            <span className="faint">{s.date.slice(0, 10)}</span>
                                            <span className="faint">·</span>
                                            <span className="faint mono">{s.size}</span>
                                        </div>
                                        <div style={{ fontSize: 11 }}>
                                            {s.have ? (
                                                <span className="status status--done">NAS 보유</span>
                                            ) : (
                                                <span className="status status--pending">받기 필요</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn--ghost btn--icon btn--sm"
                                        onClick={() => {
                                            remove(s.id);
                                            toast('제거됨');
                                        }}
                                        aria-label={`${s.id} 제거`}
                                    >
                                        <Icon name="x" size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer actions */}
                        <div
                            className="col gap-2"
                            style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}
                        >
                            <Link href="/plan/sar/user/cart" className="btn btn--primary" onClick={hide}>
                                <Icon name="download" size={13} /> 다운로드 요청
                            </Link>
                        </div>
                    </>
                )}
            </aside>
        </>
    );
}

interface CartButtonProps {
    className?: string;
    tooltipPos?: 'right' | 'left' | 'top' | 'bottom' | 'top-right' | 'top-left';
}

export function CartButton({
    className = 'btn btn--ghost btn--icon btn--sm',
    tooltipPos = 'right',
}: CartButtonProps) {
    const { toggle } = useCartOverlay();
    const { items } = useHifiCart();
    return (
        <button
            type="button"
            className={className}
            data-tooltip={`장바구니 (${items.length})  ·  단축키 C`}
            data-tooltip-pos={tooltipPos}
            onClick={toggle}
            aria-label={`장바구니 ${items.length}건`}
            style={{ position: 'relative' }}
        >
            <Icon name="cart" size={14} />
            {items.length > 0 ? (
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 999,
                        background: 'var(--accent)',
                        color: 'var(--accent-fg)',
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: '16px',
                        textAlign: 'center',
                        boxShadow: '0 0 0 2px var(--bg-1)',
                    }}
                >
                    {items.length > 99 ? '99+' : items.length}
                </span>
            ) : null}
        </button>
    );
}
