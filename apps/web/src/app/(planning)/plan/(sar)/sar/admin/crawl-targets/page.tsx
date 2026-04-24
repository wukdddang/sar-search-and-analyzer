'use client';

import { useMemo, useState } from 'react';

import {
    Icon,
    MapCanvas,
    PageHeader,
    ShapefileUploadModal,
    useToast,
    type MapFootprint,
    type MapTool,
} from '@/_ui/hifi';
import type { DrawnGeometry } from '@/_ui/hifi/MapCanvas';

interface Aoi {
    name: string;
    owner: string;
    scenes: number;
    last: string;
    status: 'healthy' | 'warning' | 'stale' | 'failed';
    /** Footprint ring [lon, lat][] (EPSG:4326), single ring */
    coords: Array<[number, number]>;
}

const INITIAL: Aoi[] = [
    {
        name: 'Pohang_coast',
        owner: '시스템',
        scenes: 240,
        last: '3분 전',
        status: 'healthy',
        coords: [
            [129.25, 35.95],
            [129.52, 35.94],
            [129.54, 36.12],
            [129.27, 36.13],
        ],
    },
    {
        name: 'Gyeongju_basin',
        owner: '지진연구팀',
        scenes: 186,
        last: '12분 전',
        status: 'healthy',
        coords: [
            [129.1, 35.78],
            [129.34, 35.76],
            [129.36, 35.94],
            [129.12, 35.96],
        ],
    },
    {
        name: 'Busan_port',
        owner: '해양연구원',
        scenes: 312,
        last: '2시간 전',
        status: 'healthy',
        coords: [
            [128.96, 35.07],
            [129.21, 35.05],
            [129.22, 35.22],
            [128.97, 35.24],
        ],
    },
    {
        name: 'Ulleungdo_full',
        owner: '시스템',
        scenes: 48,
        last: '8시간 전',
        status: 'warning',
        coords: [
            [130.78, 37.4],
            [131.02, 37.4],
            [131.02, 37.58],
            [130.78, 37.58],
        ],
    },
    {
        name: 'Gimhae_landslide',
        owner: '재난연구원',
        scenes: 98,
        last: '28시간 전',
        status: 'stale',
        coords: [
            [128.78, 35.16],
            [128.99, 35.15],
            [129.0, 35.32],
            [128.79, 35.34],
        ],
    },
    {
        name: 'Seoul_metro',
        owner: '김연구원',
        scenes: 156,
        last: '실패',
        status: 'failed',
        coords: [
            [126.85, 37.45],
            [127.18, 37.43],
            [127.2, 37.65],
            [126.86, 37.66],
        ],
    },
];

const STATUS_COLOR: Record<Aoi['status'], string> = {
    healthy: 'var(--success)',
    warning: 'var(--warning)',
    stale: 'var(--warning)',
    failed: 'var(--danger)',
};

export default function CrawlTargetsPage() {
    const toast = useToast();
    const [aois, setAois] = useState<Aoi[]>(INITIAL);
    const [selected, setSelected] = useState('Pohang_coast');
    const [activeTool, setActiveTool] = useState<MapTool | undefined>(undefined);
    const [shpOpen, setShpOpen] = useState(false);

    const crawlNow = (name: string) => {
        toast(`${name} 크롤 시작됨`, { tone: 'success', title: 'ESA 동기화' });
        setTimeout(() => {
            setAois((prev) =>
                prev.map((a) => (a.name === name ? { ...a, last: '방금', status: 'healthy' } : a)),
            );
            toast(`${name} 크롤 완료`, { tone: 'success' });
        }, 1800);
    };
    const edit = (name: string) => toast(`${name} 편집 패널 준비 중`);

    const addAoiFromRing = (coords: Array<[number, number]>) => {
        // Generate a unique name with a sequence suffix so repeated drawings don't collide.
        let seq = aois.filter((a) => a.name.startsWith('AOI_')).length + 1;
        const usedNames = new Set(aois.map((a) => a.name));
        let name = `AOI_${String(seq).padStart(3, '0')}`;
        while (usedNames.has(name)) {
            seq += 1;
            name = `AOI_${String(seq).padStart(3, '0')}`;
        }
        const next: Aoi = {
            name,
            owner: '김연구원',
            scenes: 0,
            last: '생성됨',
            status: 'healthy',
            coords,
        };
        setAois((prev) => [next, ...prev]);
        setSelected(name);
        toast(`${name} 생성됨 · ${coords.length}개 vertex`, { tone: 'success', title: '새 AOI' });
    };

    const handleDrawEnd = (_tool: MapTool, geometry: DrawnGeometry) => {
        if (geometry.type === 'Polygon') {
            const outer = (geometry.coordinates as number[][][])[0];
            if (outer && outer.length >= 4) {
                const ring = outer.slice(0, outer.length - 1).map(([lon, lat]) => [lon, lat] as [number, number]);
                addAoiFromRing(ring);
                setActiveTool(undefined);
            }
        }
    };

    // status 색상 → footprint kind 매핑 (정상=have, 경고/오래됨=need, 실패=need 빨간색은 별도 처리 어려우니 단일 kind)
    // 실제로는 footprint kind로 색을 구분하지만, status가 더 풍부하므로 라벨에 상태 prefix를 붙여 구분.
    const footprints = useMemo<MapFootprint[]>(
        () =>
            aois.map((a) => ({
                id: a.name,
                coords: a.coords,
                kind: a.status === 'failed' ? 'need' : a.status === 'healthy' ? 'have' : 'aoi',
                label: a.name,
                active: selected === a.name,
                onClick: () => setSelected(a.name),
            })),
        [aois, selected],
    );

    const counts = useMemo(() => {
        const c = { healthy: 0, warning: 0, failed: 0 };
        for (const a of aois) {
            if (a.status === 'healthy') c.healthy++;
            else if (a.status === 'failed') c.failed++;
            else c.warning++;
        }
        return c;
    }, [aois]);

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['관리자', '크롤 AOI']}
                actions={
                    <>
                        <span className="faint" style={{ fontSize: 12 }}>
                            지도 툴박스의 <b>폴리곤</b>·<b>사각형</b>으로 그려 바로 추가
                        </span>
                        <button type="button" className="btn btn--sm" onClick={() => setShpOpen(true)}>
                            <Icon name="upload" size={13} /> SHP 업로드
                        </button>
                    </>
                }
            />
            <div className="split">
                <div className="split__main">
                    <div style={{ flex: 1, padding: 16 }}>
                        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div className="card__header">
                                <div className="card__title">AOI 지도 · 상태 색상</div>
                                <div className="row gap-1">
                                    <span className="chip">
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                background: 'var(--success)',
                                                borderRadius: 50,
                                                display: 'inline-block',
                                            }}
                                        />
                                        &nbsp;정상 {counts.healthy}
                                    </span>
                                    <span className="chip">
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                background: 'var(--warning)',
                                                borderRadius: 50,
                                                display: 'inline-block',
                                            }}
                                        />
                                        &nbsp;경고 {counts.warning}
                                    </span>
                                    <span className="chip">
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                background: 'var(--danger)',
                                                borderRadius: 50,
                                                display: 'inline-block',
                                            }}
                                        />
                                        &nbsp;실패 {counts.failed}
                                    </span>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <MapCanvas
                                    footprints={footprints}
                                    center={[129.0, 36.0]}
                                    zoom={7}
                                    activeTool={activeTool}
                                    onToolSelect={(t) => {
                                        if (t === 'upload') {
                                            setShpOpen(true);
                                            return;
                                        }
                                        setActiveTool((cur) => (cur === t ? undefined : t));
                                    }}
                                    onDrawEnd={handleDrawEnd}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <aside className="split__side" style={{ width: 420 }}>
                    <div className="card__header" style={{ padding: '14px 16px' }}>
                        <div className="card__title">AOI 목록</div>
                        <span className="badge badge--neutral">{aois.length}</span>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {aois.map((a) => (
                            <div
                                key={a.name}
                                className="col"
                                style={{
                                    padding: '14px 16px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    background: selected === a.name ? 'var(--accent-soft)' : undefined,
                                }}
                                onClick={() => setSelected(a.name)}
                            >
                                <div className="between">
                                    <div className="row gap-2">
                                        <span
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 50,
                                                background: STATUS_COLOR[a.status],
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                color: selected === a.name ? 'var(--accent)' : undefined,
                                            }}
                                        >
                                            {a.name}
                                        </span>
                                    </div>
                                    <div className="row gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--icon btn--sm"
                                            data-tooltip="지금 크롤"
                                            onClick={() => crawlNow(a.name)}
                                        >
                                            <Icon name="refresh" size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--icon btn--sm"
                                            data-tooltip="편집"
                                            onClick={() => edit(a.name)}
                                        >
                                            <Icon name="settings" size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div className="row gap-3" style={{ marginTop: 6, fontSize: 12 }}>
                                    <span className="faint">{a.owner}</span>
                                    <span className="faint">·</span>
                                    <span className="mono tabular">{a.scenes}</span>
                                    <span className="faint">scenes</span>
                                    <span
                                        className="faint"
                                        style={{
                                            marginLeft: 'auto',
                                            color:
                                                a.status === 'stale'
                                                    ? 'var(--warning)'
                                                    : a.status === 'failed'
                                                      ? 'var(--danger)'
                                                      : undefined,
                                        }}
                                    >
                                        {a.last}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
            {shpOpen ? <ShapefileUploadModal onClose={() => setShpOpen(false)} /> : null}
        </div>
    );
}
