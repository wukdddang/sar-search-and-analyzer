'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon, PageHeader, useToast } from '@/_ui/hifi';

interface Dataset {
    name: string;
    desc: string;
    scenes: number;
    owner: string;
    updated: string;
    size: string;
    type: 'AOI' | '메타' | 'InSAR';
}

const PDS_SETS: Dataset[] = [
    {
        name: '경주 지진 2016 AOI',
        desc: '경주 지역 SAR 커버리지용 AOI',
        scenes: 142,
        owner: '지진연구팀',
        updated: '2026-04-12',
        size: '—',
        type: 'AOI',
    },
    {
        name: '포항 해안선 폴리곤',
        desc: '포항시 해안선 1km 버퍼',
        scenes: 0,
        owner: '김연구원',
        updated: '2026-03-28',
        size: '—',
        type: 'AOI',
    },
    {
        name: 'Sentinel-1A 한반도 2024 요약',
        desc: '2024년 S1A GRD 메타 요약 CSV',
        scenes: 2840,
        owner: '시스템',
        updated: '2026-01-05',
        size: '12.4 MB',
        type: '메타',
    },
    {
        name: 'InSAR 대구 지반 시계열 (2023-2025)',
        desc: 'SBAS 분석 결과 공유',
        scenes: 48,
        owner: '박지수',
        updated: '2026-02-14',
        size: '340 MB',
        type: 'InSAR',
    },
    {
        name: '울릉도 해안 AOI',
        desc: '울릉도 전체 커버리지',
        scenes: 28,
        owner: '해양연구원',
        updated: '2025-11-20',
        size: '—',
        type: 'AOI',
    },
    {
        name: '김해 산사태 모니터링 AOI',
        desc: '2025 여름 산사태 집중 관측',
        scenes: 36,
        owner: '재난연구원',
        updated: '2025-09-03',
        size: '—',
        type: 'AOI',
    },
];

const TYPE_BADGE: Record<Dataset['type'], string> = {
    AOI: 'brand2',
    InSAR: 'accent',
    메타: 'neutral',
};

export default function PublicDatasetsPage() {
    const toast = useToast();
    const router = useRouter();
    const [q, setQ] = useState('');
    const [type, setType] = useState<'전체' | Dataset['type']>('전체');

    const filtered = PDS_SETS.filter(
        (ds) =>
            (type === '전체' || ds.type === type) &&
            (q === '' || ds.name.toLowerCase().includes(q.toLowerCase()) || ds.desc.toLowerCase().includes(q.toLowerCase())),
    );

    return (
        <div className="col" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <PageHeader
                breadcrumb={['홈', '공공 데이터셋']}
                actions={
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => toast('새 데이터셋 업로드 준비 중')}
                    >
                        <Icon name="plus" size={13} /> 새 데이터셋
                    </button>
                }
            />
            <div className="toolbar">
                <input
                    className="input input--search"
                    placeholder="데이터셋 검색…"
                    style={{ width: 320 }}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div className="row gap-1">
                    {(['전체', 'AOI', '메타', 'InSAR'] as const).map((t) => (
                        <span
                            key={t}
                            className={`chip${type === t ? ' chip--active' : ''}`}
                            onClick={() => setType(t)}
                        >
                            {t}
                        </span>
                    ))}
                </div>
                <span className="faint" style={{ fontSize: 12, marginLeft: 'auto' }}>
                    {filtered.length}개 일치
                </span>
            </div>
            <div
                style={{
                    padding: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 12,
                }}
            >
                {filtered.length === 0 ? (
                    <div className="empty" style={{ gridColumn: '1 / -1', padding: 60 }}>
                        <div className="empty__icon">📂</div>
                        <div>일치하는 데이터셋이 없습니다</div>
                    </div>
                ) : null}
                {filtered.map((ds) => (
                    <div key={ds.name} className="card">
                        <div className="card__body">
                            <div className="between" style={{ marginBottom: 8 }}>
                                <span className={`badge badge--${TYPE_BADGE[ds.type]}`}>{ds.type}</span>
                                <span className="faint mono tabular" style={{ fontSize: 11 }}>
                                    {ds.updated}
                                </span>
                            </div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{ds.name}</div>
                            <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                                {ds.desc}
                            </div>
                            <div className="row gap-4" style={{ fontSize: 12 }}>
                                {ds.scenes > 0 ? (
                                    <div className="col" style={{ gap: 2 }}>
                                        <span className="faint">Scenes</span>
                                        <span className="mono tabular">{ds.scenes.toLocaleString()}</span>
                                    </div>
                                ) : null}
                                {ds.size !== '—' ? (
                                    <div className="col" style={{ gap: 2 }}>
                                        <span className="faint">크기</span>
                                        <span className="mono tabular">{ds.size}</span>
                                    </div>
                                ) : null}
                                <div className="col" style={{ gap: 2 }}>
                                    <span className="faint">담당</span>
                                    <span>{ds.owner}</span>
                                </div>
                            </div>
                        </div>
                        <div className="card__footer row between">
                            <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => toast(`${ds.name} 미리보기`, { title: '준비 중' })}
                            >
                                미리보기
                            </button>
                            <button
                                type="button"
                                className="btn btn--outline-accent btn--sm"
                                onClick={() => {
                                    toast(`AOI "${ds.name}" 적용됨`, { tone: 'success' });
                                    router.push('/plan/sar/user/search');
                                }}
                            >
                                검색에 적용
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
