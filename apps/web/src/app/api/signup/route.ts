import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SignupBody {
    name?: string;
    email?: string;
    organization?: string;
    purpose?: string;
    phone?: string;
}

// Mock: 관리자 알림은 서버 stdout 로그로만 전송. 실 구현 시 NestJS API로 POST.
export async function POST(request: NextRequest) {
    let body: SignupBody = {};
    try {
        body = (await request.json()) as SignupBody;
    } catch {
        return NextResponse.json({ error: '잘못된 요청 형식입니다' }, { status: 400 });
    }

    const name = body.name?.trim();
    const email = body.email?.trim();
    const organization = body.organization?.trim();
    const purpose = body.purpose?.trim();

    if (!name || !email || !organization || !purpose) {
        return NextResponse.json({ error: '필수 항목이 누락되었습니다' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다' }, { status: 400 });
    }

    const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const submittedAt = new Date().toISOString();

    // 관리자 알림 — 현재는 stdout 로그 mock. 백엔드 연결 후에는
    // POST /api/v1/auth/signup-requests 로 교체 + 이메일/슬랙 큐잉.
    console.info('[signup] new account request', {
        requestId,
        name,
        email,
        organization,
        phone: body.phone ?? null,
        purpose,
        submittedAt,
    });

    return NextResponse.json({
        ok: true,
        requestId,
        submittedAt,
        message: '관리자에게 알림이 전송되었습니다',
    });
}
