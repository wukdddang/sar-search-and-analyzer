'use client';

import { useMemo, useState } from 'react';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { Icon, MapCanvas, Modal, PageHeader, Quicklook, useToast, type MapPoint } from '@/_ui/hifi';

interface InsarProduct {
    id: string;
    name: string;
    type: 'DInSAR' | 'SBAS' | 'PSInSAR';
    range: string;
    mission: string;
    size: string;
    scenes: number;
    owner: string;
}

const PRODUCTS: InsarProduct[] = [
    {
        id: 'pohang-q4',
        name: 'Pohang subsidence 2025Q4',
        type: 'DInSAR',
        range: '2025-10-01 ~ 2025-12-30',
        mission: 'S1A',
        size: '512 MB',
        scenes: 2,
        owner: '김연구원',
    },
    {
        id: 'gyeongju-sbas',
        name: 'Gyeongju SBAS 2024-2025',
        type: 'SBAS',
        range: '2024-01 ~ 2025-12',
        mission: 'S1A',
        size: '14.2 GB',
        scenes: 38,
        owner: '박지수',
    },
    {
        id: 'gimhae',
        name: 'Gimhae 산사태 모니터',
        type: 'DInSAR',
        range: '2025-08-12 ~ 2025-08-24',
        mission: 'S1A',
        size: '498 MB',
        scenes: 2,
        owner: '이민호',
    },
    {
        id: 'busan-ps',
        name: 'Busan Port PSInSAR',
        type: 'PSInSAR',
        range: '2023-01 ~ 2025-12',
        mission: 'S1A·S1C',
        size: '142 MB',
        scenes: 86,
        owner: '최윤라',
    },
    {
        id: 'ulleung',
        name: 'Ulleungdo SBAS',
        type: 'SBAS',
        range: '2024-06 ~ 2026-03',
        mission: 'S1A',
        size: '8.7 GB',
        scenes: 28,
        owner: '시스템',
    },
];

const POINT_COLORS = ['#dc2626', '#2563eb', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#f472b6', '#84cc16'];

const TIMESERIES_DATES = [
    '25-10',
    '25-11',
    '25-12',
    '26-01',
    '26-02',
    '26-03',
    '26-04',
    '26-05',
    '26-06',
    '26-07',
    '26-08',
    '26-09',
];

interface SceneItem {
    id: string;
    date: string;
    role: 'master' | 'slave';
    polarization: string;
    size: string;
}

function generateScenes(product: InsarProduct): SceneItem[] {
    const [startStr] = product.range.split(' ~ ');
    const start = startStr.length >= 10 ? new Date(startStr) : new Date(`${startStr}-01`);
    const stepDays = 12;
    const polarization = 'VV+VH';
    const sceneSize = product.type === 'PSInSAR' || product.type === 'SBAS' ? '4.1 GB' : '1.7 GB';
    const missionPrefix = product.mission.includes('S1C') ? 'S1C' : 'S1A';
    const productSuffix = product.type === 'DInSAR' ? 'GRDH_1SDV' : 'SLC__1SDV';
    return Array.from({ length: product.scenes }).map((_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i * stepDays);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const id = `${missionPrefix}_IW_${productSuffix}_${yyyy}${mm}${dd}T211515_${yyyy}${mm}${dd}T211544_0${(i % 9) + 1}A123_2B${(i % 16).toString(16).padStart(2, '0').toUpperCase()}`;
        return {
            id,
            date: `${yyyy}-${mm}-${dd}`,
            role: i === 0 ? 'master' : 'slave',
            polarization,
            size: sceneSize,
        };
    });
}

function simulateSeries(seed: number, len = 12): number[] {
    let s = seed;
    const out = [0];
    for (let i = 1; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const trend = seed % 3 === 0 ? -2 : seed % 3 === 1 ? 1.1 : 0;
        const noise = (s / 0x7fffffff - 0.5) * 4;
        const prev = out[i - 1] ?? 0;
        out.push(+(prev + trend + noise).toFixed(1));
    }
    return out;
}

interface Point {
    id: string;
    /** Longitude (EPSG:4326) */
    lon: number;
    /** Latitude (EPSG:4326) */
    lat: number;
    color: string;
    series: number[];
}

/** 산출물별 지도 중심(lon/lat). product.id 로 lookup. */
const PRODUCT_CENTERS: Record<string, [number, number]> = {
    'pohang-q4': [129.37, 36.02],
    'gyeongju-sbas': [129.22, 35.85],
    gimhae: [128.88, 35.24],
    'busan-ps': [129.08, 35.18],
    ulleung: [130.9, 37.49],
};

type Layer = 'mean_velocity' | 'coherence' | 'cumulative_disp' | 'wrapped_phase';

const LAYER_META: Record<Layer, { unit: string; label: string }> = {
    mean_velocity: { unit: 'mm/yr', label: 'mean_velocity' },
    coherence: { unit: '0–1', label: 'coherence' },
    cumulative_disp: { unit: 'mm', label: 'cumulative_disp' },
    wrapped_phase: { unit: 'rad', label: 'wrapped_phase' },
};

type Colormap = 'RdBu' | 'viridis' | 'magma';

const COLORMAP_GRADIENTS: Record<Colormap, string> = {
    RdBu: 'linear-gradient(to right, #2563eb, #60a5fa, #f1f5f9, #fb923c, #dc2626)',
    viridis: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
    magma: 'linear-gradient(to right, #000004, #51127c, #b73779, #fc8961, #fcfdbf)',
};

const typeBadge = (t: InsarProduct['type']) =>
    t === 'DInSAR' ? 'badge--info' : t === 'SBAS' ? 'badge--warning' : 'badge--brand2';

export default function InsarPage() {
    const toast = useToast();
    const [selected, setSelected] = useState('pohang-q4');
    const [typeFilter, setTypeFilter] = useState<'전체' | InsarProduct['type']>('전체');
    const [layer, setLayer] = useState<Layer>('mean_velocity');
    const [colormap, setColormap] = useState<Colormap>('RdBu');
    const [opacity, setOpacity] = useState(75);
    const [rangeMin, setRangeMin] = useState(-30);
    const [rangeMax, setRangeMax] = useState(30);
    const [points, setPoints] = useState<Point[]>([
        { id: 'A', lon: 129.33, lat: 36.01, color: '#dc2626', series: simulateSeries(3) },
        { id: 'B', lon: 129.42, lat: 36.04, color: '#2563eb', series: simulateSeries(7) },
        { id: 'C', lon: 129.38, lat: 35.98, color: '#10b981', series: simulateSeries(5) },
    ]);
    const [showScenes, setShowScenes] = useState(false);

    const product = useMemo(() => PRODUCTS.find((p) => p.id === selected) ?? PRODUCTS[0]!, [selected]);
    const filtered = PRODUCTS.filter((p) => typeFilter === '전체' || p.type === typeFilter);
    const mapCenter = PRODUCT_CENTERS[product.id] ?? [129.37, 36.02];

    const nextPointId = () => {
        const used = new Set(points.map((p) => p.id));
        for (const L of 'ABCDEFGH') if (!used.has(L)) return L;
        return 'Z';
    };

    const addPointAt = (lon: number, lat: number) => {
        if (points.length >= 8) {
            toast('최대 8개 점까지 선택할 수 있습니다', { tone: 'warning' });
            return;
        }
        const id = nextPointId();
        const seed = Math.floor(Math.abs(lon * lat * 1000));
        const color = POINT_COLORS[points.length % POINT_COLORS.length]!;
        setPoints((prev) => [...prev, { id, lon, lat, color, series: simulateSeries(seed) }]);
        toast(`점 ${id} 추가 — 시계열 계산 중…`, { tone: 'success' });
    };

    const removePoint = (id: string) => {
        setPoints((prev) => prev.filter((p) => p.id !== id));
        toast(`점 ${id} 제거됨`);
    };
    const clearPoints = () => {
        setPoints([]);
        toast('모든 점 해제됨');
    };

    const mapPoints = useMemo<MapPoint[]>(
        () =>
            points.map((p) => ({
                id: p.id,
                coord: [p.lon, p.lat] as [number, number],
                color: p.color,
                label: p.id,
                onClick: () => removePoint(p.id),
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [points],
    );

    const exportCsv = () => {
        if (points.length === 0) {
            toast('내보낼 점이 없습니다', { tone: 'warning' });
            return;
        }
        const header = 'date,' + points.map((p) => p.id).join(',') + '\n';
        const dates = ['25-10', '25-11', '25-12', '26-01', '26-02', '26-03', '26-04', '26-05', '26-06', '26-07', '26-08', '26-09'];
        const rows = dates.map((d, i) => d + ',' + points.map((p) => p.series[i] ?? '').join(',')).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `insar-${product.id}-timeseries.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${points.length}개 점 시계열 CSV로 내보냄`, { tone: 'success' });
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['홈', 'InSAR 분석 산출물']}
                actions={
                    <>
                        <span className="badge badge--neutral">{PRODUCTS.length} products</span>
                        <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => toast('새 InSAR 분석 생성 패널 준비 중')}
                        >
                            <Icon name="plus" size={13} /> 새 분석
                        </button>
                    </>
                }
            />
            <div className="split">
                <aside className="split__side split__side--left" style={{ width: 320 }}>
                    <div className="toolbar" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="row gap-1">
                            {(['전체', 'DInSAR', 'SBAS', 'PSInSAR'] as const).map((t) => (
                                <span
                                    key={t}
                                    className={`chip${typeFilter === t ? ' chip--active' : ''}`}
                                    onClick={() => setTypeFilter(t)}
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div className="empty" style={{ padding: 40 }}>
                                해당 타입의 산출물이 없습니다
                            </div>
                        ) : (
                            filtered.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelected(p.id)}
                                    style={{
                                        padding: '14px 16px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: selected === p.id ? 'var(--accent-soft)' : undefined,
                                        borderLeft: selected === p.id ? '3px solid var(--accent)' : '3px solid transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div className="between">
                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                                        <span className={`badge ${typeBadge(p.type)}`}>{p.type}</span>
                                    </div>
                                    <div className="mono tabular faint" style={{ fontSize: 11.5, marginTop: 4 }}>
                                        {p.range}
                                    </div>
                                    <div className="row gap-3" style={{ marginTop: 6, fontSize: 11.5 }}>
                                        <span className="faint">{p.mission}</span>
                                        <span className="faint">·</span>
                                        <span className="mono tabular">{p.scenes}</span>
                                        <span className="faint">scenes</span>
                                        <span className="faint" style={{ marginLeft: 'auto' }}>
                                            {p.size}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>

                <div className="split__main">
                    <div className="toolbar" style={{ background: 'var(--bg-2)' }}>
                        <div className="col" style={{ gap: 2 }}>
                            <div className="row gap-2">
                                <span style={{ fontWeight: 600, fontSize: 15 }}>{product.name}</span>
                                <span className={`badge ${typeBadge(product.type)}`}>{product.type}</span>
                                <span className="badge badge--neutral">{product.mission}</span>
                            </div>
                            <div className="mono faint" style={{ fontSize: 11.5 }}>
                                {product.range} · LOS inc=39.2° head=−169.1° · owner {product.owner}
                            </div>
                        </div>
                        <div style={{ marginLeft: 'auto' }} className="row gap-2">
                            <button
                                type="button"
                                className="btn btn--sm"
                                onClick={() => setShowScenes(true)}
                            >
                                원본 scene ({product.scenes})
                            </button>
                            <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                onClick={() => toast(`${product.name} 다운로드 시작`, { tone: 'success' })}
                            >
                                <Icon name="download" size={13} /> 다운로드
                            </button>
                        </div>
                    </div>

                    <div className="split" style={{ flex: 1 }}>
                        <aside className="split__side split__side--left" style={{ width: 240, background: 'var(--bg-1)' }}>
                            <div className="col gap-4" style={{ padding: 16, overflow: 'auto' }}>
                                <div>
                                    <label className="field-label">레이어</label>
                                    <div className="col gap-1" style={{ marginTop: 2 }}>
                                        {(Object.entries(LAYER_META) as [Layer, { unit: string; label: string }][]).map(
                                            ([k, meta]) => {
                                                const on = layer === k;
                                                return (
                                                    <div
                                                        key={k}
                                                        onClick={() => {
                                                            setLayer(k);
                                                            toast(`레이어: ${k}`);
                                                        }}
                                                        className="between"
                                                        style={{
                                                            padding: '8px 10px',
                                                            borderRadius: 6,
                                                            background: on ? 'var(--accent-soft)' : 'transparent',
                                                            border: on
                                                                ? '1px solid var(--accent-border)'
                                                                : '1px solid transparent',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        <span className="row gap-2">
                                                            <span
                                                                style={{
                                                                    width: 8,
                                                                    height: 8,
                                                                    borderRadius: 50,
                                                                    background: on ? 'var(--accent)' : 'var(--text-tertiary)',
                                                                }}
                                                            />
                                                            <span
                                                                className="mono"
                                                                style={{ fontSize: 12, fontWeight: on ? 600 : 400 }}
                                                            >
                                                                {k}
                                                            </span>
                                                        </span>
                                                        <span className="faint" style={{ fontSize: 11 }}>
                                                            {meta.unit}
                                                        </span>
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="field-label">컬러맵</label>
                                    <div
                                        className="segmented"
                                        style={{ marginTop: 2, display: 'flex', width: '100%' }}
                                    >
                                        {(['RdBu', 'viridis', 'magma'] as const).map((cm) => (
                                            <button
                                                key={cm}
                                                type="button"
                                                className={colormap === cm ? 'active' : ''}
                                                style={{ flex: 1 }}
                                                onClick={() => setColormap(cm)}
                                            >
                                                {cm}
                                            </button>
                                        ))}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 10,
                                            height: 14,
                                            borderRadius: 3,
                                            background: COLORMAP_GRADIENTS[colormap],
                                            border: '1px solid var(--border-default)',
                                        }}
                                    />
                                    <div
                                        className="between mono tabular"
                                        style={{ fontSize: 10, marginTop: 4, color: 'var(--text-tertiary)' }}
                                    >
                                        <span>{rangeMin}</span>
                                        <span>0</span>
                                        <span>+{rangeMax}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="field-label">범위 ({LAYER_META[layer].unit})</label>
                                    <div className="input-group" style={{ marginTop: 2 }}>
                                        <input
                                            className="input mono tabular"
                                            type="number"
                                            value={rangeMin}
                                            onChange={(e) => setRangeMin(+e.target.value)}
                                        />
                                        <input
                                            className="input mono tabular"
                                            type="number"
                                            value={rangeMax}
                                            onChange={(e) => setRangeMax(+e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="between" style={{ marginBottom: 6 }}>
                                        <label className="field-label" style={{ margin: 0 }}>
                                            투명도
                                        </label>
                                        <span className="mono tabular faint" style={{ fontSize: 11 }}>
                                            {opacity}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={opacity}
                                        onChange={(e) => setOpacity(+e.target.value)}
                                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                                    />
                                </div>
                                <div>
                                    <div className="between" style={{ marginBottom: 4 }}>
                                        <label className="field-label" style={{ margin: 0 }}>
                                            선택된 점 ({points.length}/8)
                                        </label>
                                        {points.length > 0 ? (
                                            <button
                                                type="button"
                                                className="btn btn--ghost btn--sm"
                                                style={{ height: 20, padding: '0 6px', fontSize: 11 }}
                                                onClick={clearPoints}
                                            >
                                                전체 해제
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="col gap-2" style={{ marginTop: 4 }}>
                                        {points.length === 0 ? (
                                            <div className="faint" style={{ fontSize: 11.5, padding: '6px 2px' }}>
                                                지도를 클릭하여 시계열 점 추가
                                            </div>
                                        ) : null}
                                        {points.map((p) => (
                                            <div
                                                key={p.id}
                                                className="row gap-2"
                                                style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--bg-3)' }}
                                            >
                                                <span
                                                    style={{
                                                        width: 14,
                                                        height: 14,
                                                        borderRadius: 50,
                                                        background: p.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#fff',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {p.id}
                                                </span>
                                                <span
                                                    className="mono tabular faint"
                                                    style={{ fontSize: 11, flex: 1 }}
                                                >
                                                    {p.lon.toFixed(3)}E, {p.lat.toFixed(3)}N
                                                </span>
                                                <Icon
                                                    name="x"
                                                    size={11}
                                                    style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                                    onClick={() => removePoint(p.id)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <div className="split__main">
                            <div style={{ flex: 1, position: 'relative' }}>
                                <MapCanvas
                                    showLegend
                                    legend="velocity"
                                    center={mapCenter}
                                    zoom={10}
                                    points={mapPoints}
                                    onMapClick={([lon, lat]) => addPointAt(lon, lat)}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 12,
                                            right: 56,
                                            padding: '6px 12px',
                                            background: 'var(--bg-2)',
                                            border: '1px solid var(--border-default)',
                                            borderRadius: 6,
                                            fontSize: 12,
                                            boxShadow: 'var(--shadow-md)',
                                            pointerEvents: 'none',
                                            zIndex: 3,
                                        }}
                                    >
                                        <Icon name="mapPin" size={11} style={{ marginRight: 6, opacity: 0.6 }} />
                                        {layer} · {opacity}% · 지도 클릭 → 시계열 추가
                                    </div>
                                </MapCanvas>
                            </div>

                            <div
                                style={{
                                    height: 240,
                                    borderTop: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <div
                                    className="between"
                                    style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                    <div className="row gap-3">
                                        <div className="row gap-2">
                                            <Icon name="chart" size={14} />
                                            <span style={{ fontWeight: 600 }}>LOS 변위 시계열</span>
                                        </div>
                                        <div className="row gap-1">
                                            {points.map((p) => (
                                                <span
                                                    key={p.id}
                                                    className="badge"
                                                    style={{
                                                        background: p.color + '22',
                                                        color: p.color,
                                                        border: `1px solid ${p.color}44`,
                                                    }}
                                                >
                                                    ● {p.id}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="row gap-2">
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--sm"
                                            onClick={exportCsv}
                                        >
                                            <Icon name="download" size={11} /> CSV 내보내기
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: '12px 16px', flex: 1, minHeight: 0 }}>
                                    {points.length === 0 ? (
                                        <div className="empty" style={{ padding: 20, fontSize: 12 }}>
                                            지도에서 점을 찍으면 시계열이 여기 표시됩니다
                                        </div>
                                    ) : (
                                        <TimeseriesChart points={points} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showScenes ? (
                <ScenesModal product={product} onClose={() => setShowScenes(false)} />
            ) : null}
        </div>
    );
}

function TimeseriesChart({ points }: { points: Point[] }) {
    const data = TIMESERIES_DATES.map((date, i) => {
        const row: Record<string, number | string> = { date };
        points.forEach((p) => {
            const v = p.series[i];
            if (typeof v === 'number') row[p.id] = v;
        });
        return row;
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                    stroke="var(--border-default)"
                />
                <YAxis
                    width={40}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                    stroke="var(--border-default)"
                    label={{
                        value: 'mm',
                        angle: 0,
                        position: 'insideTopLeft',
                        offset: -2,
                        style: { fontSize: 10, fill: 'var(--text-tertiary)' },
                    }}
                />
                <Tooltip
                    contentStyle={{
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 6,
                        fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)' }}
                    formatter={(value) => [
                        typeof value === 'number' ? `${value.toFixed(1)} mm` : String(value),
                        '',
                    ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="3 3" />
                {points.map((p) => (
                    <Line
                        key={p.id}
                        type="monotone"
                        dataKey={p.id}
                        stroke={p.color}
                        strokeWidth={1.8}
                        dot={{ r: 2.5, fill: p.color, strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

function ScenesModal({ product, onClose }: { product: InsarProduct; onClose: () => void }) {
    const scenes = useMemo(() => generateScenes(product), [product]);
    return (
        <Modal
            title={`원본 scene 목록 — ${product.name}`}
            sub={`${product.type} · ${product.mission} · ${product.range} · ${scenes.length} scenes`}
            size="xl"
            onClose={onClose}
        >
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ width: 56 }}>미리보기</th>
                            <th>Scene ID</th>
                            <th style={{ width: 110 }}>관측일</th>
                            <th style={{ width: 80 }}>역할</th>
                            <th style={{ width: 90 }}>편파</th>
                            <th className="num" style={{ width: 90 }}>용량</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scenes.map((s) => (
                            <tr key={s.id}>
                                <td>
                                    <Quicklook sceneId={s.id} size={42} />
                                </td>
                                <td>
                                    <div className="mono truncate" style={{ fontSize: 11.5, maxWidth: 460 }}>
                                        {s.id}
                                    </div>
                                </td>
                                <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                    {s.date}
                                </td>
                                <td>
                                    <span
                                        className={`badge ${s.role === 'master' ? 'badge--brand2' : 'badge--neutral'}`}
                                    >
                                        {s.role}
                                    </span>
                                </td>
                                <td className="mono tabular faint" style={{ fontSize: 12 }}>
                                    {s.polarization}
                                </td>
                                <td className="num tabular mono" style={{ fontSize: 12 }}>
                                    {s.size}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
