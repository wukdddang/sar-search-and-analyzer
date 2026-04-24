'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props extends Omit<HTMLMotionProps<'aside'>, 'children'> {
    children: ReactNode;
    width?: string; // tailwind width class
}

/**
 * 오른쪽에서 슬라이드 인/아웃 되는 사이드 패널.
 * 부모에서 AnimatePresence 로 감싸고 conditional 로 mount/unmount 한다.
 */
export function SidePanel({ children, width = 'w-80', className = '', ...rest }: Props) {
    return (
        <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className={`${width} flex shrink-0 flex-col overflow-y-auto border-l border-line bg-surface ${className}`}
            {...rest}
        >
            {children}
        </motion.aside>
    );
}
