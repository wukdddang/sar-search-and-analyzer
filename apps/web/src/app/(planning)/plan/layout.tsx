import type { ReactNode } from 'react';

import { HifiCartProvider } from '@/_shared/contexts/HifiCartContext';
import {
    CartOverlayProvider,
    ConfirmProvider,
    HifiPrefsProvider,
    NotificationsOverlayProvider,
    SideNav,
    ToastProvider,
} from '@/_ui/hifi';

export default function PlanLayout({ children }: { children: ReactNode }) {
    return (
        <HifiPrefsProvider>
            <ToastProvider>
                <ConfirmProvider>
                    <HifiCartProvider>
                        <CartOverlayProvider>
                            <NotificationsOverlayProvider>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        height: '100%',
                                        minHeight: 0,
                                    }}
                                >
                                    <SideNav />
                                    <main
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            minWidth: 0,
                                            minHeight: 0,
                                            background: 'var(--bg-1)',
                                        }}
                                    >
                                        {children}
                                    </main>
                                </div>
                            </NotificationsOverlayProvider>
                        </CartOverlayProvider>
                    </HifiCartProvider>
                </ConfirmProvider>
            </ToastProvider>
        </HifiPrefsProvider>
    );
}
