'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { Modal } from './Modal';

export interface ConfirmOptions {
    title: ReactNode;
    body?: ReactNode;
    sub?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

interface PendingRequest extends ConfirmOptions {
    resolve: (v: boolean) => void;
}

const ConfirmCtx = createContext<Confirm>(() => Promise.resolve(false));

export function useConfirm() {
    return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [req, setReq] = useState<PendingRequest | null>(null);

    const ask = useCallback<Confirm>(
        (opts) =>
            new Promise<boolean>((resolve) => {
                setReq({ ...opts, resolve });
            }),
        [],
    );

    const close = (v: boolean) => {
        if (req) {
            req.resolve(v);
            setReq(null);
        }
    };

    return (
        <ConfirmCtx.Provider value={ask}>
            {children}
            {req ? (
                <Modal
                    title={req.title}
                    sub={req.sub}
                    onClose={() => close(false)}
                    footer={
                        <>
                            <button type="button" className="btn" onClick={() => close(false)}>
                                {req.cancelLabel || '취소'}
                            </button>
                            <button
                                type="button"
                                className={`btn ${req.danger ? 'btn--danger' : 'btn--primary'}`}
                                onClick={() => close(true)}
                            >
                                {req.confirmLabel || '확인'}
                            </button>
                        </>
                    }
                >
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{req.body}</div>
                </Modal>
            ) : null}
        </ConfirmCtx.Provider>
    );
}
