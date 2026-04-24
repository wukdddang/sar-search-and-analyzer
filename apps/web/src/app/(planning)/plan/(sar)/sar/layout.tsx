import type { ReactNode } from 'react';

export default function SarLayout({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>;
}
