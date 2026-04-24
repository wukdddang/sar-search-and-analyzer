import type { ReactNode } from 'react';

import { AppProviders } from '@/_shared/contexts/AppProviders';
import { ModeBadge } from '@/_ui/ModeBadge';
import { ThemeToggle } from '@/_ui/ThemeToggle';

export default function CurrentLayout({ children }: { children: ReactNode }) {
    return (
        <AppProviders>
            <div className="flex h-screen flex-col bg-app text-content">
                <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
                    <h1 className="text-base font-bold">Sentinel 데이터 플랫폼</h1>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <ModeBadge />
                        <span className="text-xs text-content-muted">로그인 사용자</span>
                    </div>
                </header>
                <main className="flex-1 overflow-hidden">{children}</main>
            </div>
        </AppProviders>
    );
}
