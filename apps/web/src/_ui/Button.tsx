import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400/50',
    secondary: 'bg-surface-hover text-content hover:bg-surface-muted border border-line disabled:opacity-50',
    ghost: 'bg-transparent text-content-muted hover:bg-surface-hover hover:text-content',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400/50',
};

const SIZE_CLASS: Record<Size, string> = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: Props) {
    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed',
                VARIANT_CLASS[variant],
                SIZE_CLASS[size],
                className,
            )}
            {...rest}
        >
            {children}
        </button>
    );
}
