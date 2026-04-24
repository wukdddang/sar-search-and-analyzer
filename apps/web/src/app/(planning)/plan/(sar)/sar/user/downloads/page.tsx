'use client';

import { useEffect, useMemo, useState } from 'react';

import { Icon, PageHeader, useConfirm, useToast } from '@/_ui/hifi';

type JobStatus = 'running' | 'queued' | 'done' | 'failed' | 'pending';

interface Job {
    id: string;
    scene: string;
    status: JobStatus;
    progress: number;
    size: string;
    started: string;
    eta: string;
    user: string;
}

const INITIAL_JOBS: Job[] = [
    { id: 'job-58821', scene: 'S1A_IW_GRDH_1SDV_20260418T211515', status: 'running', progress: 67, size: '1.6 GB', started: '09:42', eta: '2분', user: '본인' },
    { id: 'job-58820', scene: 'S1C_IW_SLC__1SDV_20260417T092258', status: 'running', progress: 34, size: '4.1 GB', started: '09:40', eta: '6분', user: '본인' },
    { id: 'job-58819', scene: 'S1A_IW_SLC__1SDV_20260413T212030', status: 'queued', progress: 0, size: '4.3 GB', started: '—', eta: '대기', user: '본인' },
    { id: 'job-58812', scene: 'S1A_IW_GRDH_1SDV_20260415T093105', status: 'done', progress: 100, size: '1.7 GB', started: '08:15', eta: '완료', user: '본인' },
    { id: 'job-58810', scene: 'S1A_IW_GRDH_1SDV_20260408T211855', status: 'done', progress: 100, size: '1.7 GB', started: '08:02', eta: '완료', user: '본인' },
    { id: 'job-58805', scene: 'S1A_IW_SLC__1SDV_20260410T092505', status: 'failed', progress: 48, size: '4.0 GB', started: '07:50', eta: 'ESA 504', user: '본인' },
    { id: 'job-58792', scene: 'S1A_IW_GRDH_1SDV_20260405T212338', status: 'pending', progress: 0, size: '—', started: '—', eta: '승인 대기', user: '본인' },
];

const STATUS_LABEL: Record<JobStatus, string> = {
    running: '진행중',
    queued: '대기',
    done: '완료',
    failed: '실패',
    pending: '승인 대기',
};

type FilterKey = 'all' | JobStatus;

export default function DownloadsPage() {
    const toast = useToast();
    const confirm = useConfirm();
    const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
    const [filter, setFilter] = useState<FilterKey>('all');

    useEffect(() => {
        const t = setInterval(() => {
            setJobs((prev) =>
                prev.map((j) => {
                    if (j.status !== 'running') return j;
                    const next = Math.min(100, j.progress + 2 + Math.floor(Math.random() * 4));
                    if (next >= 100) return { ...j, progress: 100, status: 'done', eta: '완료' };
                    const remaining = Math.round(((100 - next) / 6) * 0.8);
                    return { ...j, progress: next, eta: `${remaining}분` };
                }),
            );
        }, 1200);
        return () => clearInterval(t);
    }, []);

    const doneCount = jobs.filter((j) => j.status === 'done').length;
    useEffect(() => {
        setJobs((prev) => {
            const running = prev.filter((j) => j.status === 'running').length;
            if (running >= 2) return prev;
            const idx = prev.findIndex((j) => j.status === 'queued');
            if (idx < 0) return prev;
            const next = [...prev];
            const job = next[idx];
            if (!job) return prev;
            next[idx] = {
                ...job,
                status: 'running',
                started: new Date().toTimeString().slice(0, 5),
                progress: 3,
                eta: '시작',
            };
            return next;
        });
    }, [doneCount]);

    const counts = useMemo(() => {
        const c: Record<FilterKey, number> = {
            all: jobs.length,
            running: 0,
            queued: 0,
            done: 0,
            failed: 0,
            pending: 0,
        };
        jobs.forEach((j) => {
            c[j.status]++;
        });
        return c;
    }, [jobs]);

    const visible = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

    const retry = (id: string) => {
        setJobs((prev) =>
            prev.map((j) =>
                j.id === id
                    ? { ...j, status: 'queued' as JobStatus, progress: 0, eta: '대기', started: '—' }
                    : j,
            ),
        );
        toast('재시도 대기열에 추가됨', { tone: 'success' });
    };
    const cancel = async (id: string) => {
        const ok = await confirm({
            title: '취소',
            body: '이 다운로드를 취소합니다.',
            confirmLabel: '취소',
            danger: true,
        });
        if (!ok) return;
        setJobs((prev) => prev.filter((j) => j.id !== id));
        toast('다운로드 취소됨');
    };
    const download = (j: Job) =>
        toast(`${j.scene.slice(0, 30)} 다운로드 시작`, { tone: 'success' });

    const quotaUsed = 28.4;
    const quotaMax = 50;
    const pct = (quotaUsed / quotaMax) * 100;
    const pctClass = pct > 90 ? 'progress--danger' : pct > 75 ? 'progress--warning' : '';

    const filterTabs: [FilterKey, string][] = [
        ['all', '전체'],
        ['running', '진행중'],
        ['queued', '대기'],
        ['done', '완료'],
        ['failed', '실패'],
        ['pending', '승인 대기'],
    ];

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['홈', '다운로드']}
                actions={
                    <>
                        <span className="badge badge--success">
                            <span className="dot" />
                            실시간
                        </span>
                        <button type="button" className="btn btn--sm" onClick={() => toast('새로고침됨')}>
                            <Icon name="refresh" size={13} />
                        </button>
                    </>
                }
            />

            <div className="toolbar">
                <div className="row gap-1">
                    {filterTabs.map(([k, lbl]) => (
                        <span
                            key={k}
                            className={`chip${filter === k ? ' chip--active' : ''}`}
                            onClick={() => setFilter(k)}
                        >
                            {lbl} {counts[k]}
                        </span>
                    ))}
                </div>
                <div style={{ marginLeft: 'auto' }} className="row gap-3">
                    <div
                        className="row gap-3"
                        style={{
                            padding: '6px 14px',
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 6,
                        }}
                    >
                        <div className="col" style={{ gap: 2 }}>
                            <div className="field-label" style={{ marginBottom: 0 }}>
                                오늘 쿼터
                            </div>
                            <div className="mono tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                                {quotaUsed} / {quotaMax}{' '}
                                <span className="faint" style={{ fontWeight: 400 }}>
                                    GB
                                </span>
                            </div>
                        </div>
                        <div className={`progress ${pctClass}`} style={{ width: 140 }}>
                            <div className="progress__fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="faint mono tabular" style={{ fontSize: 11 }}>
                            00:00 KST 리셋
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <div className="card">
                    {visible.length === 0 ? (
                        <div className="empty" style={{ padding: 60 }}>
                            <div className="empty__icon">📭</div>
                            <div>{filter === 'all' ? '다운로드' : STATUS_LABEL[filter]} 상태가 없습니다</div>
                        </div>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Scene</th>
                                    <th>상태</th>
                                    <th style={{ width: 220 }}>진행</th>
                                    <th className="num">용량</th>
                                    <th>시작</th>
                                    <th>ETA</th>
                                    <th style={{ width: 140 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((j) => (
                                    <tr key={j.id}>
                                        <td>
                                            <div className="col" style={{ gap: 2 }}>
                                                <div
                                                    className="mono truncate"
                                                    style={{ fontSize: 11.5, maxWidth: 420 }}
                                                >
                                                    {j.scene}
                                                </div>
                                                <div className="mono faint" style={{ fontSize: 11 }}>
                                                    {j.id}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status status--${j.status}`}>{STATUS_LABEL[j.status]}</span>
                                        </td>
                                        <td>
                                            {j.status === 'done' ? (
                                                <span className="faint" style={{ fontSize: 12 }}>
                                                    —
                                                </span>
                                            ) : j.status === 'failed' ? (
                                                <div className="progress progress--danger">
                                                    <div className="progress__fill" style={{ width: `${j.progress}%` }} />
                                                </div>
                                            ) : j.status === 'pending' ? (
                                                <span className="faint" style={{ fontSize: 12 }}>
                                                    관리자 승인 대기 중
                                                </span>
                                            ) : j.status === 'queued' ? (
                                                <span className="faint" style={{ fontSize: 12 }}>
                                                    앞에 {Math.max(0, jobs.filter((k) => k.status === 'running').length)}건
                                                </span>
                                            ) : (
                                                <div className="row gap-2">
                                                    <div className="progress" style={{ flex: 1 }}>
                                                        <div
                                                            className="progress__fill"
                                                            style={{ width: `${j.progress}%` }}
                                                        />
                                                    </div>
                                                    <span
                                                        className="mono tabular"
                                                        style={{ fontSize: 11.5, minWidth: 32, textAlign: 'right' }}
                                                    >
                                                        {j.progress}%
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="num tabular mono" style={{ fontSize: 12 }}>
                                            {j.size}
                                        </td>
                                        <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                            {j.started}
                                        </td>
                                        <td
                                            className={j.status === 'failed' ? '' : 'mono tabular'}
                                            style={{
                                                fontSize: 12,
                                                color: j.status === 'failed' ? 'var(--danger)' : undefined,
                                            }}
                                        >
                                            {j.eta}
                                        </td>
                                        <td>
                                            <div className="row gap-1">
                                                {j.status === 'done' ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn--outline-accent btn--sm"
                                                        onClick={() => download(j)}
                                                    >
                                                        <Icon name="download" size={12} /> 받기
                                                    </button>
                                                ) : null}
                                                {j.status === 'failed' ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn--sm"
                                                        onClick={() => retry(j.id)}
                                                    >
                                                        <Icon name="refresh" size={12} /> 재시도
                                                    </button>
                                                ) : null}
                                                {j.status === 'running' || j.status === 'queued' ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn--ghost btn--sm"
                                                        onClick={() => cancel(j.id)}
                                                    >
                                                        취소
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
