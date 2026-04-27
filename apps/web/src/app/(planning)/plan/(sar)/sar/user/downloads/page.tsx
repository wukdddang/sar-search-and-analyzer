'use client';

import { useEffect, useMemo, useState } from 'react';

import { Icon, PageHeader, Quicklook, useConfirm, useToast } from '@/_ui/hifi';

type ProductKind = 'SLC' | 'GRD' | 'OCN' | 'RAW';
type JobStatus = 'running' | 'queued' | 'done' | 'failed';

interface Job {
    id: string;
    scene: string;
    productKind: ProductKind;
    /** SLC 만 NAS 스테이징 진행을 표시. 비-SLC 는 항상 'done' (= S3 직링크 사용 가능). */
    status: JobStatus;
    progress: number;
    size: string;
    started: string;
    finished: string;
    eta: string;
    user: string;
    /** 비-SLC(GRD/OCN/RAW): 메타데이터에서 받은 Copernicus S3 경로. */
    s3Path?: string;
}

const INITIAL_JOBS: Job[] = [
    {
        id: 'job-58821',
        scene: 'S1A_IW_GRDH_1SDV_20260418T211515',
        productKind: 'GRD',
        status: 'done',
        progress: 100,
        size: '1.6 GB',
        started: '—',
        finished: '—',
        eta: '—',
        user: '본인',
        s3Path: 's3://EODATA/Sentinel-1/SAR/GRDH/2026/04/18/S1A_IW_GRDH_1SDV_20260418T211515.SAFE.zip',
    },
    {
        id: 'job-58820',
        scene: 'S1C_IW_SLC__1SDV_20260417T092258',
        productKind: 'SLC',
        status: 'running',
        progress: 34,
        size: '4.1 GB',
        started: '2026-04-27 09:40',
        finished: '—',
        eta: '6분',
        user: '본인',
    },
    {
        id: 'job-58819',
        scene: 'S1A_IW_SLC__1SDV_20260413T212030',
        productKind: 'SLC',
        status: 'queued',
        progress: 0,
        size: '4.3 GB',
        started: '—',
        finished: '—',
        eta: '대기',
        user: '본인',
    },
    {
        id: 'job-58815',
        scene: 'S1A_WV_OCN__2SSV_20260416T141022',
        productKind: 'OCN',
        status: 'done',
        progress: 100,
        size: '12 MB',
        started: '—',
        finished: '—',
        eta: '—',
        user: '본인',
        s3Path: 's3://EODATA/Sentinel-1/SAR/OCN/2026/04/16/S1A_WV_OCN__2SSV_20260416T141022.SAFE.zip',
    },
    {
        id: 'job-58814',
        scene: 'S1A_S6_RAW__0SDV_20260414T031244',
        productKind: 'RAW',
        status: 'done',
        progress: 100,
        size: '1.1 GB',
        started: '—',
        finished: '—',
        eta: '—',
        user: '본인',
        s3Path: 's3://EODATA/Sentinel-1/SAR/RAW/2026/04/14/S1A_S6_RAW__0SDV_20260414T031244.SAFE.zip',
    },
    {
        id: 'job-58812',
        scene: 'S1A_IW_SLC__1SDV_20260415T093105',
        productKind: 'SLC',
        status: 'done',
        progress: 100,
        size: '4.2 GB',
        started: '2026-04-27 08:15',
        finished: '2026-04-27 08:21',
        eta: '완료',
        user: '본인',
    },
    {
        id: 'job-58810',
        scene: 'S1A_IW_GRDH_1SDV_20260408T211855',
        productKind: 'GRD',
        status: 'done',
        progress: 100,
        size: '1.7 GB',
        started: '—',
        finished: '—',
        eta: '—',
        user: '본인',
        s3Path: 's3://EODATA/Sentinel-1/SAR/GRDH/2026/04/08/S1A_IW_GRDH_1SDV_20260408T211855.SAFE.zip',
    },
    {
        id: 'job-58805',
        scene: 'S1A_IW_SLC__1SDV_20260410T092505',
        productKind: 'SLC',
        status: 'failed',
        progress: 48,
        size: '4.0 GB',
        started: '2026-04-27 07:50',
        finished: '2026-04-27 07:54',
        eta: 'CDSE 504',
        user: '본인',
    },
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

const PRODUCT_TONE: Record<ProductKind, string> = {
    SLC: 'badge--solid',
    GRD: 'badge--accent',
    OCN: 'badge--neutral',
    RAW: 'badge--neutral',
};

type KindKey = 'all' | 'slc' | 's3';

export default function DownloadsPage() {
    const toast = useToast();
    const confirm = useConfirm();
    const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
    const [kind, setKind] = useState<KindKey>('all');

    // SLC NAS 스테이징 진행 시뮬레이션 — 비-SLC 잡은 진행도가 이미 100/done 이므로 영향 없음.
    useEffect(() => {
        const t = setInterval(() => {
            setJobs((prev) =>
                prev.map((j) => {
                    if (j.productKind !== 'SLC' || j.status !== 'running') return j;
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

    // 동시 SLC 스테이징 2건으로 제한, 빈 슬롯 생기면 큐에서 시작.
    const slcDoneCount = jobs.filter((j) => j.productKind === 'SLC' && j.status === 'done').length;
    useEffect(() => {
        setJobs((prev) => {
            const running = prev.filter((j) => j.productKind === 'SLC' && j.status === 'running').length;
            if (running >= 2) return prev;
            const idx = prev.findIndex((j) => j.productKind === 'SLC' && j.status === 'queued');
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
    }, [slcDoneCount]);

    const slcJobs = useMemo(() => jobs.filter((j) => j.productKind === 'SLC'), [jobs]);
    const s3Jobs = useMemo(() => jobs.filter((j) => j.productKind !== 'SLC'), [jobs]);

    const kindTabs: [KindKey, string, number][] = [
        ['all', '전체', jobs.length],
        ['slc', 'SLC (NAS 스테이징)', slcJobs.length],
        ['s3', 'S3 직링크 (GRD/OCN/RAW)', s3Jobs.length],
    ];

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
            body: '이 NAS 스테이징을 취소합니다.',
            confirmLabel: '취소',
            danger: true,
        });
        if (!ok) return;
        setJobs((prev) => prev.filter((j) => j.id !== id));
        toast('스테이징 취소됨');
    };
    const downloadFromNas = (j: Job) =>
        toast(`${j.scene.slice(0, 30)} NAS → 로컬 다운로드 시작`, { tone: 'success' });
    const downloadFromS3 = (j: Job) => {
        if (!j.s3Path) return;
        toast(`${j.productKind} S3 다운로드 시작`, { tone: 'success' });
        // 실제로는 S3 presigned URL 또는 sync 명령으로 연결. 여기서는 토스트로 대체.
    };
    const copyS3Path = async (j: Job) => {
        if (!j.s3Path) return;
        try {
            await navigator.clipboard.writeText(j.s3Path);
            toast('S3 경로 복사됨', { tone: 'success' });
        } catch {
            toast('클립보드 복사 실패', { tone: 'danger' });
        }
    };

    const showSlc = kind === 'all' || kind === 'slc';
    const showS3 = kind === 'all' || kind === 's3';

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
                    {kindTabs.map(([k, lbl, n]) => (
                        <span
                            key={k}
                            className={`chip${kind === k ? ' chip--active' : ''}`}
                            onClick={() => setKind(k)}
                        >
                            {lbl} {n}
                        </span>
                    ))}
                </div>
            </div>

            <div className="col gap-4" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {showSlc ? (
                    <SlcSection
                        jobs={slcJobs}
                        runningCount={jobs.filter((j) => j.productKind === 'SLC' && j.status === 'running').length}
                        onDownload={downloadFromNas}
                        onRetry={retry}
                        onCancel={cancel}
                    />
                ) : null}

                {showS3 ? (
                    <S3Section jobs={s3Jobs} onDownload={downloadFromS3} onCopy={copyS3Path} />
                ) : null}
            </div>
        </div>
    );
}

interface SlcProps {
    jobs: Job[];
    runningCount: number;
    onDownload: (j: Job) => void;
    onRetry: (id: string) => void;
    onCancel: (id: string) => void;
}

function SlcSection({ jobs, runningCount, onDownload, onRetry, onCancel }: SlcProps) {
    return (
        <div className="card">
            <SectionHeader title="SLC" count={jobs.length} />
            {jobs.length === 0 ? (
                <div className="empty" style={{ padding: 40 }}>
                    <div className="empty__icon">📭</div>
                    <div>SLC 다운로드 잡이 없습니다</div>
                </div>
            ) : (
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: 56 }}>미리보기</th>
                            <th>Scene</th>
                            <th>상태</th>
                            <th style={{ width: 220 }}>NAS 진행</th>
                            <th className="num">용량</th>
                            <th>시작</th>
                            <th>종료</th>
                            <th>ETA</th>
                            <th style={{ width: 140 }}>다운로드</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((j) => (
                            <tr key={j.id}>
                                <td>
                                    <Quicklook sceneId={j.scene} size={42} />
                                </td>
                                <td>
                                    <div className="row gap-2">
                                        <span className={`badge ${PRODUCT_TONE[j.productKind]}`} style={{ fontSize: 10 }}>
                                            {j.productKind}
                                        </span>
                                        <div className="mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                                            {j.scene}
                                        </div>
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
                                            앞에 {Math.max(0, runningCount)}건
                                        </span>
                                    ) : (
                                        <div className="row gap-2">
                                            <div className="progress" style={{ flex: 1 }}>
                                                <div className="progress__fill" style={{ width: `${j.progress}%` }} />
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
                                                onClick={() => onDownload(j)}
                                            >
                                                <Icon name="download" size={12} /> 받기
                                            </button>
                                        ) : null}
                                        {j.status === 'failed' ? (
                                            <button
                                                type="button"
                                                className="btn btn--sm"
                                                onClick={() => onRetry(j.id)}
                                            >
                                                <Icon name="refresh" size={12} /> 재시도
                                            </button>
                                        ) : null}
                                        {j.status === 'running' || j.status === 'queued' ? (
                                            <button
                                                type="button"
                                                className="btn btn--ghost btn--sm"
                                                onClick={() => onCancel(j.id)}
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
    );
}

interface S3Props {
    jobs: Job[];
    onDownload: (j: Job) => void;
    onCopy: (j: Job) => void;
}

function S3Section({ jobs, onDownload, onCopy }: S3Props) {
    return (
        <div className="card">
            <SectionHeader title="GRD · OCN · RAW" count={jobs.length} />
            {jobs.length === 0 ? (
                <div className="empty" style={{ padding: 40 }}>
                    <div className="empty__icon">📭</div>
                    <div>S3 직링크로 받을 항목이 없습니다</div>
                </div>
            ) : (
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: 56 }}>미리보기</th>
                            <th>Scene</th>
                            <th className="num">용량</th>
                            <th>S3 경로</th>
                            <th style={{ width: 200 }}>다운로드</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((j) => (
                            <tr key={j.id}>
                                <td>
                                    <Quicklook sceneId={j.scene} size={42} />
                                </td>
                                <td>
                                    <div className="row gap-2">
                                        <span className={`badge ${PRODUCT_TONE[j.productKind]}`} style={{ fontSize: 10 }}>
                                            {j.productKind}
                                        </span>
                                        <div className="mono" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                                            {j.scene}
                                        </div>
                                    </div>
                                </td>
                                <td className="num tabular mono" style={{ fontSize: 12 }}>
                                    {j.size}
                                </td>
                                <td>
                                    <div
                                        className="mono"
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--text-secondary)',
                                            wordBreak: 'break-all',
                                            maxWidth: 540,
                                        }}
                                        title={j.s3Path}
                                    >
                                        {j.s3Path}
                                    </div>
                                </td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <div className="row gap-1">
                                        <button
                                            type="button"
                                            className="btn btn--outline-accent btn--sm"
                                            onClick={() => onDownload(j)}
                                        >
                                            <Icon name="download" size={12} /> 받기
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--sm"
                                            data-tooltip="S3 경로 복사"
                                            onClick={() => onCopy(j)}
                                        >
                                            <Icon name="copy" size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
    return (
        <div
            className="row between"
            style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
            }}
        >
            <div className="row gap-2" style={{ alignItems: 'baseline' }}>
                <strong style={{ fontSize: 13 }}>{title}</strong>
                <span className="faint" style={{ fontSize: 12 }}>
                    {count}건
                </span>
            </div>
        </div>
    );
}
