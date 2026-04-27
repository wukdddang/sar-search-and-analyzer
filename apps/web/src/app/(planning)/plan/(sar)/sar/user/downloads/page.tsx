'use client';

import { useEffect, useMemo, useState } from 'react';

import { Icon, PageHeader, Quicklook, useConfirm, useToast } from '@/_ui/hifi';

type JobStatus = 'running' | 'queued' | 'done' | 'failed';

interface Job {
    id: string;
    scene: string;
    status: JobStatus;
    progress: number;
    size: string;
    started: string;
    finished: string;
    eta: string;
    user: string;
}

const INITIAL_JOBS: Job[] = [
    { id: 'job-58821', scene: 'S1A_IW_GRDH_1SDV_20260418T211515', status: 'running', progress: 67, size: '1.6 GB', started: '2026-04-27 09:42', finished: '—', eta: '2분', user: '본인' },
    { id: 'job-58820', scene: 'S1C_IW_SLC__1SDV_20260417T092258', status: 'running', progress: 34, size: '4.1 GB', started: '2026-04-27 09:40', finished: '—', eta: '6분', user: '본인' },
    { id: 'job-58819', scene: 'S1A_IW_SLC__1SDV_20260413T212030', status: 'queued', progress: 0, size: '4.3 GB', started: '—', finished: '—', eta: '대기', user: '본인' },
    { id: 'job-58812', scene: 'S1A_IW_GRDH_1SDV_20260415T093105', status: 'done', progress: 100, size: '1.7 GB', started: '2026-04-27 08:15', finished: '2026-04-27 08:21', eta: '완료', user: '본인' },
    { id: 'job-58810', scene: 'S1A_IW_GRDH_1SDV_20260408T211855', status: 'done', progress: 100, size: '1.7 GB', started: '2026-04-27 08:02', finished: '2026-04-27 08:09', eta: '완료', user: '본인' },
    { id: 'job-58805', scene: 'S1A_IW_SLC__1SDV_20260410T092505', status: 'failed', progress: 48, size: '4.0 GB', started: '2026-04-27 07:50', finished: '2026-04-27 07:54', eta: 'CDSE 504', user: '본인' },
];

function formatDateTime(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const STATUS_LABEL: Record<JobStatus, string> = {
    running: '진행중',
    queued: '대기',
    done: '완료',
    failed: '실패',
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
                    if (next >= 100)
                        return {
                            ...j,
                            progress: 100,
                            status: 'done',
                            eta: '완료',
                            finished: formatDateTime(new Date()),
                        };
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
                started: formatDateTime(new Date()),
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

    const filterTabs: [FilterKey, string][] = [
        ['all', '전체'],
        ['running', '진행중'],
        ['queued', '대기'],
        ['done', '완료'],
        ['failed', '실패'],
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
                                    <th style={{ width: 56 }}>미리보기</th>
                                    <th>Scene</th>
                                    <th>상태</th>
                                    <th style={{ width: 220 }}>진행</th>
                                    <th className="num">용량</th>
                                    <th>시작</th>
                                    <th>종료</th>
                                    <th>ETA</th>
                                    <th style={{ width: 140 }}>다운로드</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((j) => (
                                    <tr key={j.id}>
                                        <td>
                                            <Quicklook sceneId={j.scene} size={42} />
                                        </td>
                                        <td>
                                            <div
                                                className="mono truncate"
                                                style={{ fontSize: 11.5, maxWidth: 420 }}
                                            >
                                                {j.scene}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status status--${j.status}`}>{STATUS_LABEL[j.status]}</span>
                                        </td>
                                        <td>
                                            {j.status === 'done' ? (
                                                <div className="row gap-2">
                                                    <div className="progress progress--success" style={{ flex: 1 }}>
                                                        <div className="progress__fill" style={{ width: '100%' }} />
                                                    </div>
                                                    <span
                                                        className="mono tabular"
                                                        style={{ fontSize: 11.5, minWidth: 32, textAlign: 'right' }}
                                                    >
                                                        100%
                                                    </span>
                                                </div>
                                            ) : j.status === 'failed' ? (
                                                <div className="progress progress--danger">
                                                    <div className="progress__fill" style={{ width: `${j.progress}%` }} />
                                                </div>
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
                                        <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                            {j.finished}
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
