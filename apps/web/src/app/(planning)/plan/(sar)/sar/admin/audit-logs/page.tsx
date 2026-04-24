'use client';

import { useMemo, useState } from 'react';

import { Icon, PageHeader, useToast } from '@/_ui/hifi';

interface Log {
    ts: string;
    actor: string;
    action: string;
    target: string;
    ip: string;
    cat: '로그인' | '다운로드' | '승인' | '시스템';
}

const LOGS: Log[] = [
    { ts: '2026-04-24 09:42:18', actor: 'kim@ksit.re.kr', action: 'DOWNLOAD_COMPLETE', target: 'job-58817', ip: '10.0.12.34', cat: '다운로드' },
    { ts: '2026-04-24 09:42:02', actor: 'park@ksit.re.kr', action: 'CART_SUBMIT', target: '148 scenes · req-221', ip: '10.0.12.58', cat: '다운로드' },
    { ts: '2026-04-24 09:38:14', actor: 'admin:hong', action: 'USER_APPROVE', target: 'choi@univ.ac.kr → viewer', ip: '10.0.11.2', cat: '승인' },
    { ts: '2026-04-24 09:30:44', actor: 'admin:hong', action: 'APPROVAL_APPROVE', target: 'req-218', ip: '10.0.11.2', cat: '승인' },
    { ts: '2026-04-24 09:22:18', actor: 'lee@labs.kr', action: 'LOGIN', target: '—', ip: '203.45.22.8', cat: '로그인' },
    { ts: '2026-04-24 09:15:00', actor: 'system', action: 'SYNC_FAILED', target: 'Seoul_metro · ESA 503', ip: '—', cat: '시스템' },
    {
        ts: '2026-04-24 08:45:32',
        actor: 'admin:hong',
        action: 'ROLE_CHANGE',
        target: 'jung@ksit.re.kr: viewer → downloader',
        ip: '10.0.11.2',
        cat: '승인',
    },
    { ts: '2026-04-24 08:12:04', actor: 'yoon@ksit.re.kr', action: 'LOGIN_FAILED', target: 'password mismatch', ip: '118.44.12.9', cat: '로그인' },
];

const actionColor = (a: string) =>
    a.includes('FAIL')
        ? 'var(--danger)'
        : a.includes('APPROVE') || a.includes('COMPLETE')
          ? 'var(--success)'
          : a.includes('LOGIN')
            ? 'var(--info)'
            : 'var(--text-secondary)';

export default function AuditLogsPage() {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [cat, setCat] = useState<'전체' | Log['cat']>('전체');

    const filtered = useMemo(
        () =>
            LOGS.filter((l) => {
                if (cat !== '전체' && l.cat !== cat) return false;
                if (
                    q &&
                    !l.actor.toLowerCase().includes(q.toLowerCase()) &&
                    !l.target.toLowerCase().includes(q.toLowerCase()) &&
                    !l.action.toLowerCase().includes(q.toLowerCase())
                )
                    return false;
                return true;
            }),
        [q, cat],
    );

    const exportCsv = () => {
        const header = 'ts,actor,action,target,ip\n';
        const rows = filtered.map((l) => `${l.ts},${l.actor},${l.action},"${l.target}",${l.ip}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${filtered.length}건 CSV로 내보냄`, { tone: 'success' });
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['관리자', '감사 로그']}
                actions={
                    <>
                        <button type="button" className="btn btn--sm" onClick={exportCsv}>
                            <Icon name="download" size={12} /> CSV
                        </button>
                        <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => toast('고급 필터 패널 준비 중')}
                        >
                            <Icon name="filter" size={13} /> 고급 필터
                        </button>
                    </>
                }
            />
            <div className="toolbar">
                <input
                    className="input input--search"
                    placeholder="액터 / 대상 / 액션 검색…"
                    style={{ width: 280 }}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div className="row gap-1">
                    {(['전체', '로그인', '다운로드', '승인', '시스템'] as const).map((c) => (
                        <span
                            key={c}
                            className={`chip${cat === c ? ' chip--active' : ''}`}
                            onClick={() => setCat(c)}
                        >
                            {c}
                        </span>
                    ))}
                </div>
                <div className="input mono tabular" style={{ width: 180, marginLeft: 'auto' }}>
                    <Icon name="calendar" size={12} style={{ marginRight: 6, opacity: 0.6 }} />
                    최근 24시간
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 180 }}>시각</th>
                                <th>액터</th>
                                <th>액션</th>
                                <th>대상</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="empty" style={{ padding: 40 }}>
                                        일치하는 로그가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((l, i) => (
                                    <tr key={i}>
                                        <td className="mono tabular faint" style={{ fontSize: 11.5 }}>
                                            {l.ts}
                                        </td>
                                        <td>
                                            <span
                                                className={
                                                    l.actor.startsWith('admin')
                                                        ? 'badge badge--brand2'
                                                        : l.actor === 'system'
                                                          ? 'badge badge--neutral'
                                                          : ''
                                                }
                                            >
                                                {l.actor}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className="mono"
                                                style={{ fontSize: 11.5, fontWeight: 600, color: actionColor(l.action) }}
                                            >
                                                {l.action}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12.5 }}>{l.target}</td>
                                        <td className="mono tabular faint" style={{ fontSize: 11.5 }}>
                                            {l.ip}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
