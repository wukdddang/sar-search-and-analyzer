'use client';

import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/_shared/contexts/ThemeContext';

export function ThemeToggle() {
    const { theme, toggle } = useTheme();
    const Icon = theme === 'dark' ? Sun : Moon;
    return (
        <button
            onClick={toggle}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            className="rounded p-2 text-content-muted hover:bg-surface-hover"
        >
            <Icon size={16} />
        </button>
    );
}
