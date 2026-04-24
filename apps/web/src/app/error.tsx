'use client';

import { useEffect } from 'react';

import { Button } from '@/_ui/Button';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        // eslint-disable-next-line no-console
        console.error('[UI error]', error);
    }, [error]);

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-2xl font-bold">문제가 발생했습니다</h1>
            <p className="max-w-xl text-center text-content-muted">{error.message || '예기치 않은 오류'}</p>
            {error.digest ? <p className="text-xs text-content-subtle">digest: {error.digest}</p> : null}
            <div className="flex gap-2">
                <Button onClick={() => reset()}>재시도</Button>
                <Button variant="secondary" onClick={() => (window.location.href = '/')}>
                    홈으로
                </Button>
            </div>
        </div>
    );
}
