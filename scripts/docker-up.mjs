// docker-compose up 래퍼.
// 호스트의 LAN IPv4 주소(예: 192.168.10.42)를 감지해 `HOST_LAN_IP` 환경변수로 주입한다.
// 컨테이너는 docker bridge SNAT 때문에 gateway IP(172.x.x.x)만 보게 되므로,
// 실제 내부망 IP를 웹 UI에 표시하려면 호스트 쪽에서 값을 넣어줘야 한다.

import { spawn } from 'node:child_process';
import os from 'node:os';

/** 프라이빗 대역(RFC 1918) 중 docker bridge 대역(172.16.0.0/12)을 제외한 LAN IPv4를 선호 */
function pickLanIp() {
    const ifaces = os.networkInterfaces();
    const candidates = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs) continue;
        for (const a of addrs) {
            if (a.family !== 'IPv4') continue;
            if (a.internal) continue;
            const ip = a.address;
            // Docker bridge / WSL interface 제외
            if (ip.startsWith('172.')) {
                const second = Number(ip.split('.')[1]);
                if (second >= 16 && second <= 31) continue;
            }
            // APIPA
            if (ip.startsWith('169.254.')) continue;
            candidates.push({ name, ip });
        }
    }
    // 192.168.x > 10.x > 그 외 순으로 선호
    candidates.sort((a, b) => rank(a.ip) - rank(b.ip));
    return candidates[0]?.ip ?? '';
}
function rank(ip) {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    return 2;
}

const preset = process.env.HOST_LAN_IP?.trim();
const hostLanIp = preset || pickLanIp();

if (hostLanIp) {
    console.log(`[docker-up] HOST_LAN_IP = ${hostLanIp}${preset ? ' (env 지정)' : ' (자동 감지)'}`);
} else {
    console.warn('[docker-up] LAN IP를 감지하지 못했습니다. 로그인 페이지 접속 IP가 도커 gateway로 표시될 수 있습니다.');
}

const args = ['compose', 'up', '--build', '-d', 'web'];
const proc = spawn('docker', args, {
    stdio: 'inherit',
    env: { ...process.env, HOST_LAN_IP: hostLanIp },
    shell: process.platform === 'win32',
});
proc.on('exit', (code) => process.exit(code ?? 0));
