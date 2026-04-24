'use client';

import type { ReactNode } from 'react';

import { CartProvider } from './CartContext';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './ToastContext';

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <ToastProvider>
                <CartProvider>{children}</CartProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
