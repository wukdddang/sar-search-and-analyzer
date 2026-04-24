'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
    /** 헤더 (접힘 상태에서도 항상 표시) */
    header: ReactNode;
    /** 본문 (접힘 상태에서 숨김) */
    children: ReactNode;
    /** 초기 높이(px) */
    initialHeight?: number;
    /** 최소 높이(px). 접힘 아닌 상태의 최소치 */
    minHeight?: number;
    /** 최대 높이(vh 단위 숫자, 50 = 50vh) */
    maxHeightVh?: number;
    /** localStorage 키 (선택) */
    storageKey?: string;
    /** 초기 접힘 상태 */
    initialCollapsed?: boolean;
}

const HEADER_HEIGHT = 40;

export function ResizableBottomPanel({
    header,
    children,
    initialHeight = 280,
    minHeight = 120,
    maxHeightVh = 50,
    storageKey,
    initialCollapsed = false,
}: Props) {
    const [height, setHeight] = useState(initialHeight);
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [isDragging, setIsDragging] = useState(false);

    // 복원
    useEffect(() => {
        if (!storageKey) return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as { height?: number; collapsed?: boolean };
                if (typeof parsed.height === 'number') setHeight(parsed.height);
                if (typeof parsed.collapsed === 'boolean') setCollapsed(parsed.collapsed);
            }
        } catch {
            // ignore
        }
    }, [storageKey]);

    // 저장
    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify({ height, collapsed }));
        } catch {
            // ignore
        }
    }, [storageKey, height, collapsed]);

    const clamp = useCallback(
        (v: number) => {
            const maxPx = (window.innerHeight * maxHeightVh) / 100;
            return Math.max(minHeight, Math.min(maxPx, v));
        },
        [minHeight, maxHeightVh],
    );

    const onDragStart = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (collapsed) return;
            event.preventDefault();
            setIsDragging(true);
            const startY = event.clientY;
            const startH = height;

            const onMove = (e: PointerEvent) => {
                const dy = startY - e.clientY; // 위로 당기면 height 증가
                setHeight(clamp(startH + dy));
            };
            const onUp = () => {
                setIsDragging(false);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        },
        [collapsed, height, clamp],
    );

    const targetHeight = collapsed ? HEADER_HEIGHT : height;

    return (
        <motion.div
            className="relative flex flex-col overflow-hidden border-t border-line bg-surface"
            animate={{ height: targetHeight }}
            initial={false}
            transition={
                isDragging
                    ? { duration: 0 }
                    : { type: 'spring', damping: 30, stiffness: 300 }
            }
            style={{ height: isDragging ? targetHeight : undefined }}
        >
            {/* drag handle */}
            {!collapsed ? (
                <div
                    onPointerDown={onDragStart}
                    className={clsx(
                        'absolute left-0 right-0 top-0 z-10 h-1.5 cursor-row-resize',
                        'hover:bg-blue-500/40',
                        isDragging && 'bg-blue-500/60',
                    )}
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="패널 크기 조절"
                />
            ) : null}

            {/* header with collapse toggle */}
            <div
                className={clsx(
                    'flex shrink-0 items-center justify-between border-b border-line px-4',
                    'select-none',
                )}
                style={{ height: HEADER_HEIGHT }}
            >
                <div className="min-w-0 flex-1">{header}</div>
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label={collapsed ? '패널 펼치기' : '패널 접기'}
                    className="ml-2 rounded p-1 text-content-muted hover:bg-surface-hover"
                >
                    {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {/* body */}
            <AnimatePresence initial={false}>
                {!collapsed ? (
                    <motion.div
                        key="body"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="min-h-0 flex-1 overflow-auto"
                    >
                        {children}
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
}
