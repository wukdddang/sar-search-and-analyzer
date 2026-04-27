import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
    title: 'Sentinel 데이터 플랫폼',
    description: 'Copernicus Sentinel 위성 데이터 검색 · 다운로드 플랫폼',
};

// Hydration 이전에 테마/밀도 속성을 적용해 FOUC 방지
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var storedTheme = localStorage.getItem('sar.theme.v1');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = storedTheme || (prefersDark ? 'dark' : 'dark');
    var storedDensity = localStorage.getItem('sar.density.v1') || 'comfortable';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-density', storedDensity);
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko" data-theme="dark" data-density="comfortable" suppressHydrationWarning>
            <head>
                <link
                    rel="stylesheet"
                    href="https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css"
                />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&display=swap"
                />
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
