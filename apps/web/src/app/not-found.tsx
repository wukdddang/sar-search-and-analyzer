import Link from 'next/link';

import { Button } from '@/_ui/Button';

export default function NotFound() {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">찾는 페이지가 없습니다</h1>
            <p className="text-content-muted">주소를 다시 확인해 주세요.</p>
            <Link href="/">
                <Button>홈으로</Button>
            </Link>
        </div>
    );
}
