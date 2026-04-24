'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    return (
        <html lang="ko">
            <body>
                <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700 }}>치명적 오류</h1>
                    <p style={{ marginTop: 12 }}>{error.message || '알 수 없는 오류'}</p>
                    <p style={{ marginTop: 8, color: '#999' }}>digest: {error.digest ?? '-'}</p>
                </div>
            </body>
        </html>
    );
}
