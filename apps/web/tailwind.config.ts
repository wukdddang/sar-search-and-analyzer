import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class', '[data-theme="dark"]'],
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                app: 'rgb(var(--app) / <alpha-value>)',
                surface: 'rgb(var(--surface) / <alpha-value>)',
                'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
                'surface-hover': 'rgb(var(--surface-hover) / <alpha-value>)',
                content: 'rgb(var(--content) / <alpha-value>)',
                'content-muted': 'rgb(var(--content-muted) / <alpha-value>)',
                'content-subtle': 'rgb(var(--content-subtle) / <alpha-value>)',
                line: 'rgb(var(--line) / <alpha-value>)',

                mode: {
                    plan: '#fbbf24',
                    current: '#3b82f6',
                },
                scene: {
                    nasAvailable: '#10b981',
                    downloadRequired: '#f59e0b',
                },
            },
        },
    },
    plugins: [],
};

export default config;
