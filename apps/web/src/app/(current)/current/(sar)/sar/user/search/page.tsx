import Link from 'next/link';

import { Button } from '@/_ui/Button';

export default function CurrentSearchPage() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="text-2xl font-bold">검색 (Current)</h1>
            <p className="max-w-md text-content-muted">
                이 화면은 실제 API에 연결된 검색 화면입니다. 백엔드 `apps/api`의 `GET /scenes`가 준비되면 연결됩니다.
            </p>
            <p className="max-w-md text-sm text-content-muted">
                Plan(Mock) 화면에서 UX를 먼저 확인하려면 아래 링크로 이동하세요.
            </p>
            <Link href="/plan/sar/user/search">
                <Button>Plan 검색 화면 열기</Button>
            </Link>
        </div>
    );
}
