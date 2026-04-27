'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from './Icon';

interface Props {
    text: string;
    /** 아이콘 픽셀 크기. 기본 13. */
    size?: number;
    /** 툴팁 위치. 기본 'right' (사이드바 아이콘 툴팁과 동일). */
    placement?: 'top' | 'bottom' | 'right' | 'left';
    /** 인라인 스타일 (트리거 span). */
    style?: React.CSSProperties;
}

interface Coords {
    top: number;
    left: number;
    /** 최종(visible) 변환. */
    transform: string;
    /** 초기/종료(invisible) 변환 — 진입 방향으로 4px 어긋난 상태. */
    transformHidden: string;
}

const ENTER_OFFSET = 4;
const ANIM_MS = 140;

export function InfoTip({ text, size = 13, placement = 'right', style }: Props) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState<Coords | null>(null);

    useEffect(() => {
        if (open) {
            if (ref.current) {
                const r = ref.current.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                let next: Coords;
                switch (placement) {
                    case 'top':
                        next = {
                            top: r.top - 6,
                            left: cx,
                            transform: 'translate(-50%, -100%)',
                            transformHidden: `translate(-50%, calc(-100% + ${ENTER_OFFSET}px))`,
                        };
                        break;
                    case 'bottom':
                        next = {
                            top: r.bottom + 6,
                            left: cx,
                            transform: 'translate(-50%, 0)',
                            transformHidden: `translate(-50%, -${ENTER_OFFSET}px)`,
                        };
                        break;
                    case 'left':
                        next = {
                            top: cy,
                            left: r.left - 8,
                            transform: 'translate(-100%, -50%)',
                            transformHidden: `translate(calc(-100% + ${ENTER_OFFSET}px), -50%)`,
                        };
                        break;
                    default:
                        next = {
                            top: cy,
                            left: r.right + 8,
                            transform: 'translate(0, -50%)',
                            transformHidden: `translate(-${ENTER_OFFSET}px, -50%)`,
                        };
                }
                setCoords(next);
            }
            setMounted(true);
            // 두 프레임 뒤에 visible=true → 마운트 직후 hidden 상태가 그려진 뒤 transition 발동
            let raf2 = 0;
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setVisible(true));
            });
            return () => {
                cancelAnimationFrame(raf1);
                if (raf2) cancelAnimationFrame(raf2);
            };
        } else {
            setVisible(false);
            const t = setTimeout(() => setMounted(false), ANIM_MS);
            return () => clearTimeout(t);
        }
    }, [open, placement]);

    return (
        <>
            <span
                ref={ref}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                tabIndex={0}
                aria-label={text}
                style={{
                    display: 'inline-flex',
                    color: 'var(--text-tertiary)',
                    cursor: 'help',
                    ...style,
                }}
            >
                <Icon name="info" size={size} />
            </span>
            {mounted && coords && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          role="tooltip"
                          style={{
                              position: 'fixed',
                              top: coords.top,
                              left: coords.left,
                              transform: visible ? coords.transform : coords.transformHidden,
                              opacity: visible ? 1 : 0,
                              transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
                              maxWidth: 320,
                              width: 'max-content',
                              padding: '4px 8px',
                              background: 'var(--bg-4)',
                              color: 'var(--text-primary)',
                              fontSize: 11,
                              lineHeight: 1.45,
                              borderRadius: 'var(--r-sm)',
                              boxShadow: 'var(--shadow-md)',
                              pointerEvents: 'none',
                              zIndex: 9999,
                          }}
                      >
                          {text}
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}
