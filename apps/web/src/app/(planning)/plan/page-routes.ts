import {
    Activity,
    Bell,
    CheckSquare,
    Database,
    Download,
    LayoutDashboard,
    Map,
    Search,
    ScrollText,
    Settings,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RouteDef {
    href: string;
    label: string;
    icon: LucideIcon;
}

export const userRoutes: RouteDef[] = [
    { href: '/plan/sar/user/search', label: '검색', icon: Search },
    { href: '/plan/sar/user/downloads', label: '다운로드', icon: Download },
    { href: '/plan/sar/user/public-datasets', label: '공공데이터', icon: Database },
    { href: '/plan/sar/user/notifications', label: '알림', icon: Bell },
];

export const adminRoutes: RouteDef[] = [
    { href: '/plan/sar/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/plan/sar/admin/users', label: '사용자', icon: Users },
    { href: '/plan/sar/admin/approvals', label: '승인', icon: CheckSquare },
    { href: '/plan/sar/admin/crawl-targets', label: 'AOI', icon: Map },
    { href: '/plan/sar/admin/public-datasets', label: '공공데이터', icon: Database },
    { href: '/plan/sar/admin/sync-monitor', label: 'Sync', icon: Activity },
    { href: '/plan/sar/admin/audit-logs', label: '감사', icon: ScrollText },
];

export function createRoutes(basePath: 'plan' | 'current') {
    function replacePrefix(routes: RouteDef[]): RouteDef[] {
        return routes.map((r) => ({ ...r, href: r.href.replace('/plan/', `/${basePath}/`) }));
    }
    return {
        userRoutes: replacePrefix(userRoutes),
        adminRoutes: replacePrefix(adminRoutes),
    };
}

// 사이드바에 표시되지 않는 경로용 아이콘 (추후 헤더 버튼 등)
export { Settings };
