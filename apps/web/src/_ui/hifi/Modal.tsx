'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

import { Icon } from './Icon';

interface ModalProps {
    title: ReactNode;
    sub?: ReactNode;
    children?: ReactNode;
    /** ReactNode — 그대로 렌더. 함수 — `close()`(애니메이션 후 onClose)를 인자로 받는 render prop. */
    footer?: ReactNode | ((close: () => void) => ReactNode);
    onClose: () => void;
    size?: 'default' | 'lg' | 'xl';
}

/** modalOut 키프레임 길이와 일치시킬 것 (globals.css). */
const CLOSE_ANIM_MS = 180;

export function Modal({ title, sub, children, footer, onClose, size = 'default' }: ModalProps) {
    const [closing, setClosing] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const requestClose = useCallback(() => {
        if (closing) return;
        setClosing(true);
        timerRef.current = setTimeout(onClose, CLOSE_ANIM_MS);
    }, [closing, onClose]);

    return (
        <div
            className={`modal-backdrop${closing ? ' modal-backdrop--closing' : ''}`}
            onClick={requestClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className={`modal${size === 'lg' ? ' modal--lg' : size === 'xl' ? ' modal--xl' : ''}${closing ? ' modal--closing' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal__header">
                    <div className="between" style={{ alignItems: 'flex-start' }}>
                        <div>
                            <div className="modal__title">{title}</div>
                            {sub ? <div className="modal__sub">{sub}</div> : null}
                        </div>
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={requestClose}>
                            <Icon name="x" size={14} />
                        </button>
                    </div>
                </div>
                <div className="modal__body">{children}</div>
                {footer ? (
                    <div className="modal__footer">
                        {typeof footer === 'function' ? footer(requestClose) : footer}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
