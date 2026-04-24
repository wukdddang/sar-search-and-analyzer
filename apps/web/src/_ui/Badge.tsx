import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
    neutral: 'bg-surface-hover text-content-muted',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
    info: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
};

interface Props {
    tone?: Tone;
    children: ReactNode;
    className?: string;
}

export function Badge({ tone = 'neutral', children, className }: Props) {
    return (
        <span
            className={clsx(
                'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
                TONE_CLASS[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}
