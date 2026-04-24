'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { CartButton } from './CartOverlay';
import { Icon, type IconName } from './Icon';
import { useHifiPrefs } from './HifiPrefsProvider';
import { NotificationsButton } from './NotificationsOverlay';

type Role = 'user' | 'admin';

interface NavItem {
    label: string;
    href: string;
    icon: IconName;
    match: (path: string) => boolean;
}

const base = '/plan/sar';

const USER_ITEMS: NavItem[] = [
    { label: '검색', href: `${base}/user/search`, icon: 'search', match: (p) => p.includes('/user/search') },
    {
        label: '다운로드',
        href: `${base}/user/downloads`,
        icon: 'download',
        match: (p) => p.includes('/user/downloads'),
    },
    { label: 'InSAR', href: `${base}/user/insar`, icon: 'activity', match: (p) => p.includes('/user/insar') },
    {
        label: '공공 데이터',
        href: `${base}/user/public-datasets`,
        icon: 'folder',
        match: (p) => p.includes('/user/public-datasets'),
    },
];

const ADMIN_ITEMS: NavItem[] = [
    {
        label: '대시보드',
        href: `${base}/admin/dashboard`,
        icon: 'chart',
        match: (p) => p.includes('/admin/dashboard'),
    },
    { label: '검색', href: `${base}/admin/search`, icon: 'search', match: (p) => p.includes('/admin/search') },
    { label: '사용자', href: `${base}/admin/users`, icon: 'users', match: (p) => p.includes('/admin/users') },
    {
        label: '승인 큐',
        href: `${base}/admin/approvals`,
        icon: 'shield',
        match: (p) => p.includes('/admin/approvals'),
    },
    {
        label: '크롤 AOI',
        href: `${base}/admin/crawl-targets`,
        icon: 'satellite',
        match: (p) => p.includes('/admin/crawl-targets'),
    },
    { label: 'Sync', href: `${base}/admin/sync-monitor`, icon: 'refresh', match: (p) => p.includes('/admin/sync-monitor') },
    {
        label: '공공 데이터',
        href: `${base}/admin/public-datasets`,
        icon: 'folder',
        match: (p) => p.includes('/admin/public-datasets'),
    },
    { label: '감사', href: `${base}/admin/audit-logs`, icon: 'clock', match: (p) => p.includes('/admin/audit-logs') },
];

export function SideNav() {
    const pathname = usePathname() ?? '';
    const { theme, toggleTheme } = useHifiPrefs();

    const role: Role = pathname.includes('/admin/') ? 'admin' : 'user';
    const items = role === 'admin' ? ADMIN_ITEMS : USER_ITEMS;
    const homeHref = role === 'admin' ? `${base}/admin/dashboard` : `${base}/user/search`;

    return (
        <aside className="sidenav">
            <Link href={homeHref} className="sidenav__logo" data-tooltip="위성검색" data-tooltip-pos="right">
                S1
            </Link>
            <nav className="sidenav__nav">
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidenav__item${item.match(pathname) ? ' sidenav__item--active' : ''}`}
                        data-tooltip={item.label}
                        data-tooltip-pos="right"
                        aria-label={item.label}
                    >
                        <Icon name={item.icon} size={18} />
                    </Link>
                ))}
            </nav>
            <div className="sidenav__footer">
                <NotificationsButton className="sidenav__icon-btn" />
                {role === 'user' ? <CartButton className="sidenav__icon-btn" /> : null}
                <button
                    type="button"
                    className="sidenav__icon-btn"
                    onClick={toggleTheme}
                    data-tooltip={theme === 'dark' ? '라이트' : '다크'}
                    data-tooltip-pos="right"
                    aria-label="테마 전환"
                >
                    <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
                </button>
                <div className="sidenav__avatar" data-tooltip="김연구원" data-tooltip-pos="right">
                    KY
                </div>
            </div>
        </aside>
    );
}

/**
 * 페이지 헤더 우측에 표시되는 역할 전환 select.
 * `/plan/sar/user/*` ↔ `/plan/sar/admin/*` 대표 페이지로 이동한다.
 * 기존 floating `RoleSwitchFab`을 대체한다.
 */
export function RoleSelect() {
    const pathname = usePathname() ?? '';
    const router = useRouter();
    const role: Role = pathname.includes('/admin/') ? 'admin' : 'user';

    const onChange = (next: Role) => {
        if (next === role) return;
        router.push(next === 'admin' ? `${base}/admin/dashboard` : `${base}/user/search`);
    };

    return (
        <label className="role-select" aria-label="역할 전환">
            <span className="role-select__label">역할</span>
            <select
                className="role-select__input"
                value={role}
                onChange={(e) => onChange(e.target.value as Role)}
            >
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
        </label>
    );
}
