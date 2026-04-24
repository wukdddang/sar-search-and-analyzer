'use client';

import { useState } from 'react';

import { Icon, PageHeader, useToast } from '@/_ui/hifi';

interface Run {
    aoi: string;
    started: string;
    duration: string;
    fetched: number;
    status: 'success' | 'warning' | 'failed';
    err?: string;
}

const INITIAL: Run[] = [
    { aoi: 'Pohang_coast', started: '09:41:48', duration: '42s', fetched: 6, status: 'success' },
    { aoi: 'Gyeongju_basin', started: '09:30:12', duration: '38s', fetched: 2, status: 'success' },
    { aoi: 'Busan_port', started: '07:42:00', duration: '1m 14s', fetched: 12, status: 'success' },
    { aoi: 'Ulleungdo_full', started: '01:00:00', duration: '22s', fetched: 0, status: 'success' },
    { aoi: 'Gimhae_landslide', started: 'Yesterday 04:00', duration: '—', fetched: 0, status: 'warning' },
    {
        aoi: 'Seoul_metro',
        started: '07:30:00',
        duration: '12s',
        fetched: 0,
        status: 'failed',
        err: 'ESA 503 Service Unavailable',
    },
];

export default function SyncMonitorPage() {
    const toast = useToast();
    const [runs, setRuns] = useState<Run[]>(INITIAL);

    const retry = (aoi: string) => {
        setRuns((prev) =>
            prev.map((r) =>
                r.aoi === aoi
                    ? { ...r, status: 'success' as const, duration: '진행 중…', err: undefined }
                    : r,
            ),
        );
        toast(`${aoi} 재시도 중…`, { tone: 'success' });
        setTimeout(() => {
            setRuns((prev) =>
                prev.map((r) =>
                    r.aoi === aoi
                        ? {
                              ...r,
                              started: new Date().toTimeString().slice(0, 8),
                              duration: '34s',
                              fetched: Math.floor(Math.random() * 8) + 1,
                          }
                        : r,
                ),
            );
            toast(`${aoi} 동기화 완료`, { tone: 'success' });
        }, 2000);
    };
    const retryAll = () => {
        const failed = runs.filter((r) => r.status !== 'success');
        if (failed.length === 0) {
            toast('실패한 작업이 없습니다');
            return;
        }
        failed.forEach((r) => retry(r.aoi));
    };

    const failedCount = runs.filter((r) => r.status === 'failed').length;

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['관리자', 'Sync 모니터']}
                actions={
                    <>
                        <span className="badge badge--danger">{failedCount} 실패</span>
                        <button type="button" className="btn btn--sm" onClick={retryAll}>
                            <Icon name="refresh" size={13} /> 전체 재시도
                        </button>
                    </>
                }
            />
            <div className="col gap-3" style={{ padding: 24, flex: 1, overflow: 'auto' }}>
                {failedCount > 0 ? (
                    <div
                        className="card"
                        style={{ borderColor: 'var(--danger-soft)', background: 'var(--danger-soft)' }}
                    >
                        <div className="card__body row gap-3">
                            <Icon name="x" size={18} style={{ color: 'var(--danger)' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: 'var(--danger)' }}>
                                    {failedCount}개 AOI 동기화 실패
                                </div>
                                <div className="muted" style={{ fontSize: 12.5 }}>
                                    {runs.filter((r) => r.status === 'failed').map((r) => r.aoi).join(', ')} · 5분 후 자동 재시도
                                </div>
                            </div>
                            <button type="button" className="btn btn--sm" onClick={retryAll}>
                                지금 재시도
                            </button>
                        </div>
                    </div>
                ) : null}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title">동기화 이력 (24h)</div>
                        <span className="faint" style={{ fontSize: 12 }}>
                            총 {runs.length}회
                        </span>
                    </div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>AOI</th>
                                <th>시작</th>
                                <th>소요</th>
                                <th className="num">신규 Scene</th>
                                <th>결과</th>
                                <th style={{ width: 120 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((r, i) => (
                                <tr key={i}>
                                    <td>
                                        <span style={{ fontWeight: 500 }}>{r.aoi}</span>
                                    </td>
                                    <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                        {r.started}
                                    </td>
                                    <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                        {r.duration}
                                    </td>
                                    <td className="num mono tabular">{r.fetched}</td>
                                    <td>
                                        {r.status === 'success' ? (
                                            <span className="status status--done">성공</span>
                                        ) : r.status === 'warning' ? (
                                            <span className="status status--pending">지연</span>
                                        ) : (
                                            <div className="col" style={{ gap: 2 }}>
                                                <span className="status status--failed">실패</span>
                                                <span className="mono faint" style={{ fontSize: 11 }}>
                                                    {r.err}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {r.status !== 'success' ? (
                                            <button
                                                type="button"
                                                className="btn btn--sm"
                                                onClick={() => retry(r.aoi)}
                                            >
                                                <Icon name="refresh" size={12} /> 재시도
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
