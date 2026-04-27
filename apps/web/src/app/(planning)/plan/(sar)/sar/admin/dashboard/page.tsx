'use client';

import { useRouter } from 'next/navigation';

import { Icon, PageHeader, Sparkline, useToast, type IconName } from '@/_ui/hifi';

interface Kpi {
    label: string;
    value: string | number;
    delta: string;
    tone: 'warning' | 'up' | 'down' | 'neutral';
    unit?: string;
    spark: number[];
}

const KPIS: Kpi[] = [
    { label: '승인 대기', value: 7, delta: '+3 지난 1h', tone: 'warning', spark: [2, 3, 4, 3, 5, 6, 7] },
    { label: '처리량 (24h)', value: 284, delta: '+12% vs 어제', tone: 'up', unit: 'scenes', spark: [220, 235, 240, 248, 260, 275, 284] },
    { label: '실패율 (24h)', value: '2.1', delta: '−0.4%p', tone: 'down', unit: '%', spark: [3.1, 2.9, 2.8, 2.5, 2.4, 2.3, 2.1] },
    { label: 'NAS 사용량', value: '42.6', delta: '/ 60 TB', tone: 'neutral', unit: 'TB', spark: [38, 39, 40, 41, 41.8, 42.2, 42.6] },
];

interface QuickAction {
    icon: IconName;
    label: string;
    count: number;
    tone: 'warning' | 'danger' | 'accent';
    target: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { icon: 'shield', label: '승인 대기', count: 7, tone: 'warning', target: '/plan/sar/admin/approvals' },
    { icon: 'refresh', label: 'Sync 실패 AOI', count: 3, tone: 'danger', target: '/plan/sar/admin/sync-monitor' },
    { icon: 'users', label: '신규 가입', count: 2, tone: 'accent', target: '/plan/sar/admin/users' },
    { icon: 'activity', label: '실패한 다운로드', count: 5, tone: 'danger', target: '/plan/sar/admin/audit-logs' },
];

const EVENTS: [string, string, string, string][] = [
    ['09:42:18', 'DOWNLOAD', 'completed', 'job-58817 · S1A_IW_GRDH_20260418 · 1.7 GB · 김연구원'],
    ['09:42:02', 'APPROVAL', 'pending', 'cart-req-221 · 148 scenes · 박지수 → queue #7'],
    ['09:41:48', 'SYNC', 'success', 'Pohang_coast · 6 new scenes'],
    ['09:41:33', 'LOGIN', 'success', 'choi@ksit.re.kr'],
    ['09:40:55', 'DOWNLOAD', 'running', 'job-58821 · S1A_IW_GRDH_20260418 · 67%'],
    ['09:40:12', 'DOWNLOAD', 'failed', 'job-58805 · CDSE 504 · 재시도 예약'],
    ['09:39:28', 'CART', 'submit', '32 scenes · 58.3 GB · lee@labs.kr'],
    ['09:38:14', 'SYNC', 'success', 'Gyeongju · 2 new scenes'],
];

const STATUS_COLOR: Record<string, string> = {
    completed: 'var(--success)',
    success: 'var(--success)',
    pending: 'var(--warning)',
    running: 'var(--info)',
    failed: 'var(--danger)',
    submit: 'var(--accent)',
};

const NAS_BREAKDOWN: [string, number, string][] = [
    ['S1A / SLC', 18.2, 'var(--accent)'],
    ['S1A / GRD', 12.8, 'var(--brand-2)'],
    ['S1C / SLC', 6.1, 'var(--success)'],
    ['S1C / GRD', 3.4, 'var(--warning)'],
    ['InSAR 산출', 2.1, 'var(--info)'],
];

export default function AdminDashboardPage() {
    const toast = useToast();
    const router = useRouter();

    return (
        <div className="col" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <PageHeader
                breadcrumb={['관리자', '대시보드']}
                actions={
                    <>
                        <div className="segmented">
                            <button type="button">1h</button>
                            <button type="button" className="active">
                                24h
                            </button>
                            <button type="button">7d</button>
                            <button type="button">30d</button>
                        </div>
                        <button type="button" className="btn btn--sm" onClick={() => toast('새로고침됨')}>
                            <Icon name="refresh" size={13} />
                        </button>
                    </>
                }
            />
            <div className="col gap-4" style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {KPIS.map((k) => (
                        <div key={k.label} className="kpi">
                            <div className="between">
                                <div className="kpi__label">{k.label}</div>
                                <Sparkline
                                    points={k.spark}
                                    color={
                                        k.tone === 'warning'
                                            ? 'var(--warning)'
                                            : k.tone === 'up' || k.tone === 'down'
                                              ? 'var(--success)'
                                              : 'var(--text-tertiary)'
                                    }
                                />
                            </div>
                            <div className="kpi__value tabular">
                                {k.value}
                                {k.unit ? (
                                    <span style={{ fontSize: 14, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                        {k.unit}
                                    </span>
                                ) : null}
                            </div>
                            <div
                                className={`kpi__delta ${
                                    k.tone === 'up'
                                        ? 'kpi__delta--up'
                                        : k.tone === 'down'
                                          ? 'kpi__delta--up'
                                          : k.tone === 'warning'
                                            ? 'kpi__delta--down'
                                            : ''
                                }`}
                            >
                                {k.delta}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <div className="card">
                        <div className="card__header">
                            <div>
                                <div className="card__title">처리량 & 큐 적체</div>
                                <div className="card__subtle">24시간 · 15분 단위</div>
                            </div>
                            <div className="row gap-2">
                                <span className="badge badge--accent">
                                    <span className="dot" />
                                    Completed
                                </span>
                                <span className="badge badge--warning">
                                    <span className="dot" />
                                    Queued
                                </span>
                            </div>
                        </div>
                        <div className="card__body" style={{ paddingTop: 8 }}>
                            <ThroughputChart />
                        </div>
                    </div>

                    <div className="card">
                        <div className="card__header">
                            <div className="card__title">Quick Actions</div>
                        </div>
                        <div className="col" style={{ padding: '4px 0' }}>
                            {QUICK_ACTIONS.map((a) => (
                                <div
                                    key={a.label}
                                    className="between"
                                    style={{
                                        padding: '12px 18px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => router.push(a.target)}
                                >
                                    <div className="row gap-3">
                                        <Icon name={a.icon} size={16} style={{ color: `var(--${a.tone})` }} />
                                        <span>{a.label}</span>
                                    </div>
                                    <div className="row gap-2">
                                        <span className={`badge badge--${a.tone}`}>{a.count}</span>
                                        <Icon name="chevronRight" size={12} style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <div className="card" style={{ minHeight: 300 }}>
                        <div className="card__header">
                            <div>
                                <div className="card__title">실시간 이벤트</div>
                                <div className="card__subtle">WebSocket · 최근 50건</div>
                            </div>
                            <span className="badge badge--success">
                                <span className="dot" />
                                Connected
                            </span>
                        </div>
                        <div
                            className="col"
                            style={{
                                fontSize: 12.5,
                                fontFamily: 'var(--font-mono)',
                                padding: '4px 18px 18px',
                                maxHeight: 280,
                                overflow: 'auto',
                            }}
                        >
                            {EVENTS.map(([t, type, status, msg], i) => (
                                <div
                                    key={i}
                                    className="row gap-3"
                                    style={{
                                        padding: '6px 0',
                                        borderBottom: i < EVENTS.length - 1 ? '1px dashed var(--border-subtle)' : undefined,
                                    }}
                                >
                                    <span style={{ color: 'var(--text-tertiary)' }}>{t}</span>
                                    <span className="badge badge--neutral" style={{ minWidth: 80, justifyContent: 'center' }}>
                                        {type}
                                    </span>
                                    <span style={{ color: STATUS_COLOR[status], minWidth: 70 }}>
                                        ●&nbsp;&nbsp;{status}
                                    </span>
                                    <span className="truncate" style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                        {msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card__header">
                            <div className="card__title">NAS 사용량 분포</div>
                        </div>
                        <div className="card__body col gap-3">
                            {NAS_BREAKDOWN.map(([k, v, c]) => (
                                <div key={k}>
                                    <div className="between" style={{ fontSize: 12, marginBottom: 4 }}>
                                        <span>{k}</span>
                                        <span className="mono tabular faint">{v} TB</span>
                                    </div>
                                    <div className="progress">
                                        <div
                                            className="progress__fill"
                                            style={{ width: `${(v / 60) * 100}%`, background: c }}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div
                                className="row between"
                                style={{
                                    paddingTop: 8,
                                    borderTop: '1px solid var(--border-subtle)',
                                    fontSize: 12,
                                }}
                            >
                                <span className="faint">합계</span>
                                <span className="mono tabular" style={{ fontWeight: 600 }}>
                                    42.6 / 60 TB
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ThroughputChart() {
    const bars = Array.from({ length: 24 }).map((_, i) => 30 + Math.sin(i / 3) * 20 + ((i * 37) % 30));
    const linePoints = Array.from({ length: 24 }).map((_, i) => 140 - Math.cos(i / 4) * 30 - (i > 16 ? 20 : 0));
    const linePath = linePoints.map((y, i) => `${i === 0 ? 'M' : 'L'} ${57 + i * 30},${y}`).join(' ');
    return (
        <svg viewBox="0 0 800 240" width="100%" height="220" preserveAspectRatio="none">
            {[0, 1, 2, 3, 4].map((i) => (
                <line
                    key={i}
                    x1="40"
                    y1={30 + i * 40}
                    x2="780"
                    y2={30 + i * 40}
                    stroke="var(--border-subtle)"
                    strokeWidth="1"
                />
            ))}
            {bars.map((h, i) => (
                <rect
                    key={i}
                    x={50 + i * 30}
                    y={190 - h}
                    width="14"
                    height={h}
                    fill="var(--accent)"
                    opacity="0.85"
                    rx="1"
                />
            ))}
            <path d={linePath} stroke="var(--warning)" strokeWidth="2" fill="none" strokeLinecap="round" />
            {[0, 6, 12, 18, 24].map((i) => (
                <text
                    key={i}
                    x={50 + i * 30}
                    y="215"
                    fontSize="10"
                    fill="var(--text-tertiary)"
                    fontFamily="var(--font-mono)"
                >
                    {(i + 12) % 24}:00
                </text>
            ))}
        </svg>
    );
}
