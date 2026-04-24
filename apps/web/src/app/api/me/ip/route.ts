import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// IPv6-mapped IPv4 (::ffff:X.X.X.X) 정규화 + 루프백 치환.
function normalizeIp(ip: string): string {
    const trimmed = ip.trim();
    if (trimmed.startsWith('::ffff:')) return trimmed.slice('::ffff:'.length);
    if (trimmed === '::1') return '127.0.0.1';
    return trimmed;
}

/**
 * 의미 없는(실제 클라이언트를 식별하지 못하는) IP인지 판별.
 * - 루프백 (127.x, ::1)
 * - Docker bridge 기본 대역 (172.16.0.0/12)
 * - 링크로컬 (169.254.x)
 * 컨테이너가 브리지 네트워크로 실행되면 SNAT 때문에 항상 gateway IP(예: 172.22.0.1)만 보이므로
 * 이 경우 호스트 LAN IP(HOST_LAN_IP env)로 대체한다.
 */
function isContainerLocal(ip: string): boolean {
    if (!ip) return true;
    if (ip.startsWith('127.')) return true;
    if (ip === '::1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('172.')) {
        const second = Number(ip.split('.')[1]);
        if (second >= 16 && second <= 31) return true;
    }
    return false;
}

export async function GET(request: NextRequest) {
    const h = request.headers;
    const xff = h.get('x-forwarded-for');
    const xri = h.get('x-real-ip');
    const cfip = h.get('cf-connecting-ip');
    const forwarded = h.get('forwarded');

    let clientIp = '';
    if (xff) clientIp = xff.split(',')[0];
    if (!clientIp && xri) clientIp = xri;
    if (!clientIp && cfip) clientIp = cfip;
    if (!clientIp && forwarded) {
        const m = /for="?\[?([^\];,"]+)\]?"?/.exec(forwarded);
        if (m) clientIp = m[1];
    }
    if (!clientIp) {
        const socketIp =
            (request as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ??
            (request as unknown as { ip?: string }).ip ??
            '';
        if (socketIp) clientIp = socketIp;
    }
    clientIp = clientIp ? normalizeIp(clientIp) : '';

    // Docker bridge에서는 항상 gateway IP만 보이므로 호스트 주입 LAN IP로 대체.
    const hostLanIp = process.env.HOST_LAN_IP?.trim() ?? '';
    const effective = isContainerLocal(clientIp) && hostLanIp ? hostLanIp : clientIp;

    return NextResponse.json({
        ip: effective,
        source: isContainerLocal(clientIp) && hostLanIp ? 'host-lan' : clientIp ? 'client' : 'unknown',
    });
}
