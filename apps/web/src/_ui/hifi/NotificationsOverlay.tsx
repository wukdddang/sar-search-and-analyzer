'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { Icon, type IconName } from './Icon';
import { useToast } from './ToastProvider';

type Tone = 'success' | 'warning' | 'danger' | 'info';

interface Notification {
    id: string;
    title: string;
    body: string;
    tone: Tone;
    time: string;
    read: boolean;
    icon: IconName;
}

const SEED: Notification[] = [
    {
        id: 'n-8821',
        title: '다운로드 완료',
        body: 'S1A_IW_GRDH_1SDV_20260418T211515 다운로드가 완료되었습니다.',
        tone: 'success',
        time: '2분 전',
        read: false,
        icon: 'download',
    },
    {
        id: 'n-8819',
        title: 'CDSE 504 오류',
        body: 'job-58805가 CDSE 카탈로그 504 Gateway Timeout으로 실패했습니다. 재시도를 권장합니다.',
        tone: 'danger',
        time: '1시간 전',
        read: false,
        icon: 'server',
    },
    {
        id: 'n-8818',
        title: '크롤 완료',
        body: 'AOI "Pohang_coast" 일일 크롤이 완료되었습니다. 신규 scene 4개 추가.',
        tone: 'info',
        time: '3시간 전',
        read: true,
        icon: 'satellite',
    },
];

const TONE_BADGE: Record<Tone, string> = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'info',
};

interface NotificationsOverlayValue {
    open: boolean;
    show: () => void;
    hide: () => void;
    toggle: () => void;
    unreadCount: number;
}

const Ctx = createContext<NotificationsOverlayValue | null>(null);

export function NotificationsOverlayProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>(SEED);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const toast = useToast();

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

    const unreadCount = items.filter((n) => !n.read).length;
    const visible = filter === 'unread' ? items.filter((n) => !n.read) : items;

    const markAllRead = () => {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        toast('모두 읽음으로 표시');
    };
    const removeOne = (id: string) => {
        setItems((prev) => prev.filter((n) => n.id !== id));
    };
    const toggleRead = (id: string) => {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
    };

    const value = useMemo<NotificationsOverlayValue>(
        () => ({ open, show, hide, toggle, unreadCount }),
        [open, show, hide, toggle, unreadCount],
    );

    return (
        <Ctx.Provider value={value}>
            {children}
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
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="알림"
                aria-hidden={!open}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    height: '100dvh',
                    width: 'min(440px, 100vw)',
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
                        <Icon name="bell" size={16} />
                        <span style={{ fontWeight: 600 }}>알림</span>
                        {unreadCount > 0 ? <span className="badge badge--accent">{unreadCount}</span> : null}
                    </div>
                    <div className="row gap-1">
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={markAllRead}
                            disabled={unreadCount === 0}
                        >
                            <Icon name="check" size={12} /> 모두 읽음
                        </button>
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

                {/* Filter tabs */}
                <div
                    className="row gap-1"
                    style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}
                >
                    <span
                        className={`chip${filter === 'all' ? ' chip--active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        전체 {items.length}
                    </span>
                    <span
                        className={`chip${filter === 'unread' ? ' chip--active' : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        안 읽음 {unreadCount}
                    </span>
                </div>

                {/* List */}
                <div className="col" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                    {visible.length === 0 ? (
                        <div className="empty" style={{ padding: 60 }}>
                            <div className="empty__icon">🔔</div>
                            <div>새 알림이 없습니다</div>
                        </div>
                    ) : (
                        <div className="col gap-2">
                            {visible.map((n) => (
                                <div
                                    key={n.id}
                                    className="card"
                                    style={{
                                        background: n.read ? 'var(--bg-2)' : 'var(--bg-3)',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => toggleRead(n.id)}
                                >
                                    <div className="card__body row gap-3" style={{ alignItems: 'flex-start' }}>
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                background: `var(--${n.tone}-soft)`,
                                                color: `var(--${n.tone})`,
                                            }}
                                        >
                                            <Icon name={n.icon} size={16} />
                                        </div>
                                        <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                                            <div className="between">
                                                <div className="row gap-2">
                                                    <span
                                                        style={{
                                                            fontWeight: n.read ? 500 : 600,
                                                            color: 'var(--text-primary)',
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        {n.title}
                                                    </span>
                                                    {!n.read ? (
                                                        <span className={`badge badge--${TONE_BADGE[n.tone]}`}>NEW</span>
                                                    ) : null}
                                                </div>
                                                <span className="faint mono tabular" style={{ fontSize: 11 }}>
                                                    {n.time}
                                                </span>
                                            </div>
                                            <div className="muted" style={{ fontSize: 12 }}>
                                                {n.body}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--icon btn--sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeOne(n.id);
                                            }}
                                            aria-label="알림 삭제"
                                        >
                                            <Icon name="x" size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </Ctx.Provider>
    );
}

export function useNotificationsOverlay() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('NotificationsOverlayContext가 Provider 외부에서 사용됨');
    return ctx;
}

interface NotificationsButtonProps {
    className?: string;
    tooltipPos?: 'right' | 'left' | 'top' | 'bottom' | 'top-right' | 'top-left';
}

export function NotificationsButton({
    className = 'btn btn--ghost btn--icon btn--sm',
    tooltipPos = 'right',
}: NotificationsButtonProps) {
    const { toggle, unreadCount } = useNotificationsOverlay();
    return (
        <button
            type="button"
            className={className}
            data-tooltip={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
            data-tooltip-pos={tooltipPos}
            onClick={toggle}
            aria-label={`알림 ${unreadCount}건`}
            style={{ position: 'relative' }}
        >
            <Icon name="bell" size={14} />
            {unreadCount > 0 ? (
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
                        background: 'var(--warning, #f59e0b)',
                        color: '#1a1300',
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: '16px',
                        textAlign: 'center',
                        boxShadow: '0 0 0 2px var(--bg-1)',
                    }}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            ) : null}
        </button>
    );
}
