'use client';

import { useMemo, useState } from 'react';

import { useHifiCart, type HifiScene } from '@/_shared/contexts/HifiCartContext';
import {
    DateRangePicker,
    Icon,
    MapCanvas,
    Modal,
    PageHeader,
    Quicklook,
    ShapefileUploadModal,
    useToast,
    type MapFootprint,
    type MapTool,
} from '@/_ui/hifi';
import type { DrawnGeometry } from '@/_ui/hifi/MapCanvas';

import { MOCK_DEFAULT_AOI, MOCK_SCENES } from '../../../../_mocks/scenes';

interface Filters {
    s1a: boolean;
    s1c: boolean;
    slc: boolean;
    grd: boolean;
    ocn: boolean;
    raw: boolean;
    pol: string;
    pass: 'A' | 'D';
    relOrbit: string;
    haveOnly: boolean;
    esaRefresh: boolean;
    startDate: Date;
    endDate: Date;
    datePreset: '1주' | '1개월' | '3개월' | '1년' | '';
}

/** 오늘 기준 preset 범위를 계산해 [start, end]를 반환. */
function presetRange(preset: '1주' | '1개월' | '3개월' | '1년'): [Date, Date] {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    if (preset === '1주') start.setDate(end.getDate() - 7);
    else if (preset === '1개월') start.setMonth(end.getMonth() - 1);
    else if (preset === '3개월') start.setMonth(end.getMonth() - 3);
    else start.setFullYear(end.getFullYear() - 1);
    return [start, end];
}

function buildDefaultFilters(): Filters {
    const [start, end] = presetRange('1개월');
    return {
        s1a: true,
        s1c: true,
        slc: true,
        grd: true,
        ocn: false,
        raw: false,
        pol: 'VV+VH',
        pass: 'A',
        relOrbit: '127',
        haveOnly: false,
        esaRefresh: false,
        startDate: start,
        endDate: end,
        datePreset: '1개월',
    };
}

export default function SearchPage() {
    const toast = useToast();
    const { has: inCart, add: addToCart, addMany: addManyToCart } = useHifiCart();

    const [activeTool, setActiveTool] = useState<MapTool | undefined>(undefined);
    const [sceneModal, setSceneModal] = useState<HifiScene | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [aoi, setAoi] = useState<Array<[number, number]> | null>(MOCK_DEFAULT_AOI);
    const [query, setQuery] = useState('');
    const [checked, setChecked] = useState<Set<string>>(() => new Set());
    const [filters, setFilters] = useState<Filters>(() => buildDefaultFilters());
    const [resultsOpen, setResultsOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [shpOpen, setShpOpen] = useState(false);

    const filtered = useMemo(() => {
        return MOCK_SCENES.filter((s) => {
            if (
                query &&
                !s.id.toLowerCase().includes(query.toLowerCase()) &&
                !s.region.toLowerCase().includes(query.toLowerCase())
            )
                return false;
            if (s.mission === 'S1A' && !filters.s1a) return false;
            if (s.mission === 'S1C' && !filters.s1c) return false;
            if (s.product === 'SLC' && !filters.slc) return false;
            if (s.product === 'GRD' && !filters.grd) return false;
            if (filters.haveOnly && !s.have) return false;
            return true;
        });
    }, [query, filters]);

    const footprints = useMemo<MapFootprint[]>(() => {
        return filtered
            .filter((s) => s.footprint && s.footprint.length >= 3)
            .map((s) => ({
                id: s.id,
                coords: s.footprint!,
                kind: s.have ? 'have' : 'need',
                label: `${s.mission} ${s.date.slice(0, 10)}`,
                active: selectedSceneId === s.id,
                onClick: () => {
                    setSelectedSceneId(s.id);
                    setSceneModal(s);
                },
            }));
    }, [filtered, selectedSceneId]);

    const allChecked = filtered.length > 0 && filtered.every((s) => checked.has(s.id));
    const toggleAll = () => {
        if (allChecked) {
            setChecked((prev) => {
                const n = new Set(prev);
                filtered.forEach((s) => n.delete(s.id));
                return n;
            });
        } else {
            setChecked((prev) => {
                const n = new Set(prev);
                filtered.forEach((s) => n.add(s.id));
                return n;
            });
        }
    };
    const toggleOne = (id: string) =>
        setChecked((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const handleAdd = (s: HifiScene) => {
        const already = inCart(s.id);
        addToCart(s);
        toast(already ? '이미 장바구니에 있습니다' : `${s.id.slice(0, 32)}… 담음`, {
            tone: already ? 'warning' : 'success',
        });
    };
    const handleAddChecked = () => {
        const toAdd = filtered.filter((s) => checked.has(s.id));
        if (toAdd.length === 0) {
            toast('선택된 scene이 없습니다', { tone: 'warning' });
            return;
        }
        addManyToCart(toAdd);
        toast(`${toAdd.length}개 scene 담음`, { tone: 'success', title: '장바구니 추가' });
        setChecked(new Set());
    };
    const handleAddAll = () => {
        addManyToCart(filtered);
        toast(`${filtered.length}개 scene 담음`, { tone: 'success' });
    };
    const resetFilters = () => {
        setFilters({ ...buildDefaultFilters(), relOrbit: '' });
        setQuery('');
        setChecked(new Set());
        toast('필터 초기화됨');
    };

    const totalGb = filtered.reduce((a, s) => a + parseFloat(s.size), 0);

    const handleDrawEnd = (_tool: MapTool, geometry: DrawnGeometry) => {
        if (geometry.type === 'Polygon') {
            const outer = (geometry.coordinates as number[][][])[0];
            if (outer && outer.length >= 4) {
                const ring = outer.map(([lon, lat]) => [lon, lat] as [number, number]);
                // Drop the duplicated closing vertex for storage
                const open = ring.slice(0, ring.length - 1);
                setAoi(open);
                toast(`AOI 설정됨 (${open.length}개 vertex)`, { tone: 'success' });
                setActiveTool(undefined);
            }
        }
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['홈', '검색']}
                actions={
                    <>
                        <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => toast('ESA 카탈로그 동기화 중…', { tone: 'success' })}
                        >
                            <Icon name="refresh" size={13} /> 최신 새로고침
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => setShpOpen(true)}>
                            <Icon name="upload" size={13} /> SHP 업로드
                        </button>
                    </>
                }
            />
            <div className="split" style={{ flex: 1 }}>
                {/* LEFT filter panel */}
                <aside className="split__side split__side--left" style={{ width: 280 }}>
                    <div className="col gap-4" style={{ padding: 16, overflow: 'auto' }}>
                        <div>
                            <label className="field-label">날짜 범위</label>
                            <div style={{ marginTop: 2 }}>
                                <DateRangePicker
                                    start={filters.startDate}
                                    end={filters.endDate}
                                    maxDate={new Date()}
                                    onChange={(s, e) =>
                                        setFilters((f) => ({ ...f, startDate: s, endDate: e, datePreset: '' }))
                                    }
                                />
                            </div>
                            <div className="row gap-1" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                                {(['1주', '1개월', '3개월', '1년'] as const).map((t) => (
                                    <span
                                        key={t}
                                        className={`chip${filters.datePreset === t ? ' chip--active' : ''}`}
                                        style={{ height: 22, fontSize: 11 }}
                                        onClick={() => {
                                            const [s, e] = presetRange(t);
                                            setFilters((f) => ({ ...f, startDate: s, endDate: e, datePreset: t }));
                                        }}
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="field-label">미션</label>
                            <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                                <span
                                    className={`chip${filters.s1a ? ' chip--active' : ''}`}
                                    onClick={() => setFilters((f) => ({ ...f, s1a: !f.s1a }))}
                                >
                                    Sentinel-1A
                                </span>
                                <span
                                    className={`chip${filters.s1c ? ' chip--active' : ''}`}
                                    onClick={() => setFilters((f) => ({ ...f, s1c: !f.s1c }))}
                                >
                                    Sentinel-1C
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="field-label">제품 타입</label>
                            <div className="col gap-2">
                                {(
                                    [
                                        ['slc', 'SLC', 'Single Look Complex'],
                                        ['grd', 'GRD', 'Ground Range Detected'],
                                        ['ocn', 'OCN', 'Ocean'],
                                        ['raw', 'RAW', 'Raw'],
                                    ] as const
                                ).map(([k, label, desc]) => (
                                    <label key={k} className="row gap-2" style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            className="checkbox"
                                            checked={filters[k]}
                                            onChange={(e) =>
                                                setFilters((f) => ({ ...f, [k]: e.target.checked }))
                                            }
                                        />
                                        <span style={{ fontWeight: 500 }}>{label}</span>
                                        <span className="faint" style={{ fontSize: 11.5 }}>
                                            {desc}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="field-label">편광</label>
                            <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                                {['VV', 'VH', 'HH', 'HV', 'VV+VH'].map((p) => (
                                    <span
                                        key={p}
                                        className={`chip${filters.pol === p ? ' chip--active' : ''}`}
                                        onClick={() => setFilters((f) => ({ ...f, pol: p }))}
                                    >
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="field-label">Pass 방향</label>
                            <div className="segmented" style={{ width: '100%' }}>
                                <button
                                    type="button"
                                    className={filters.pass === 'A' ? 'active' : ''}
                                    style={{ flex: 1 }}
                                    onClick={() => setFilters((f) => ({ ...f, pass: 'A' }))}
                                >
                                    상승 (A)
                                </button>
                                <button
                                    type="button"
                                    className={filters.pass === 'D' ? 'active' : ''}
                                    style={{ flex: 1 }}
                                    onClick={() => setFilters((f) => ({ ...f, pass: 'D' }))}
                                >
                                    하강 (D)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="field-label">상대 궤도 번호</label>
                            <input
                                className="input mono tabular"
                                value={filters.relOrbit}
                                onChange={(e) => setFilters((f) => ({ ...f, relOrbit: e.target.value }))}
                            />
                        </div>

                        <div
                            className="col gap-2"
                            style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
                        >
                            <label className="row gap-2" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={filters.haveOnly}
                                    onChange={(e) => setFilters((f) => ({ ...f, haveOnly: e.target.checked }))}
                                />
                                <span>NAS 보유만 표시</span>
                                <span className="badge badge--success" style={{ marginLeft: 'auto' }}>
                                    빠름
                                </span>
                            </label>
                            <label className="row gap-2" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={filters.esaRefresh}
                                    onChange={(e) => setFilters((f) => ({ ...f, esaRefresh: e.target.checked }))}
                                />
                                <span>ESA 카탈로그 강제 갱신</span>
                            </label>
                        </div>

                        <button
                            type="button"
                            className="btn btn--primary"
                            style={{ width: '100%', marginTop: 8 }}
                            onClick={() => toast(`${filtered.length}개 scene 검색 결과`, { tone: 'success' })}
                        >
                            <Icon name="search" size={13} /> 검색
                            <span
                                className="kbd"
                                style={{
                                    marginLeft: 6,
                                    background: 'rgba(0,0,0,0.25)',
                                    borderColor: 'transparent',
                                    color: 'currentColor',
                                }}
                            >
                                ⏎
                            </span>
                        </button>
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ width: '100%' }}
                            onClick={resetFilters}
                        >
                            필터 초기화
                        </button>
                    </div>
                </aside>

                {/* CENTER map + list — cart is now accessed via the top-nav icon (opens right overlay) */}
                <div className="split__main">
                    <div
                        style={{
                            flex: 1,
                            minHeight: 200,
                            padding: '12px 16px 0',
                            transition: 'min-height 260ms ease',
                        }}
                    >
                        <MapCanvas
                            activeTool={activeTool}
                            onToolSelect={(t) => {
                                if (t === 'upload') {
                                    setShpOpen(true);
                                    return;
                                }
                                setActiveTool((cur) => (cur === t ? undefined : t));
                                toast(`${t} 도구 ${activeTool === t ? '해제' : '선택'}`);
                            }}
                            center={[129.37, 36.02]}
                            zoom={8}
                            footprints={footprints}
                            aoi={aoi}
                            onDrawEnd={handleDrawEnd}
                        >
                            {/* 지도 위 좌측 상단 — 검색 결과 요약 */}
                            <div className="map-stats">
                                <span className="badge badge--accent">
                                    {filtered.length} scenes · {totalGb.toFixed(1)} GB
                                </span>
                                <span className="faint mono" style={{ fontSize: 11 }}>
                                    / 검색 중 184ms
                                </span>
                            </div>
                        </MapCanvas>
                    </div>

                    <div
                        className="col"
                        style={{
                            flex: '0 0 auto',
                            minHeight: 0,
                            padding: resultsOpen ? '12px 16px 16px' : '4px 16px',
                            transition: 'padding 200ms ease',
                        }}
                    >
                        <div
                            className="results-header between"
                            role="button"
                            aria-expanded={resultsOpen}
                            aria-label={resultsOpen ? '결과 접기' : '결과 펼치기'}
                            tabIndex={0}
                            onClick={() => setResultsOpen((v) => !v)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setResultsOpen((v) => !v);
                                }
                            }}
                            style={{ marginBottom: resultsOpen ? 8 : 0 }}
                        >
                            <div className="row gap-2" style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <Icon
                                    name="chevronDown"
                                    size={13}
                                    style={{
                                        transition: 'transform 200ms ease',
                                        transform: resultsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                        opacity: 0.75,
                                    }}
                                />
                                <span className="field-label" style={{ margin: 0 }}>
                                    결과 {filtered.length}
                                </span>
                                <span className="faint" style={{ fontSize: 12 }}>
                                    · 날짜 내림차순
                                </span>
                                {checked.size > 0 ? (
                                    <>
                                        <span className="faint">·</span>
                                        <span className="badge badge--accent">{checked.size} 선택됨</span>
                                        <button
                                            type="button"
                                            className="btn btn--ghost btn--sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setChecked(new Set());
                                                setResultsOpen(true);
                                            }}
                                        >
                                            선택 해제
                                        </button>
                                    </>
                                ) : null}
                            </div>
                            {/* 검색/담기 컨트롤 — 패널이 닫혀 있어도 항상 보이며, 클릭 시 자기 동작 + 패널 오픈. */}
                            <div
                                className="row gap-2"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                            >
                                <div className="segmented" aria-label="결과 보기 모드">
                                    <button
                                        type="button"
                                        className={viewMode === 'table' ? 'active' : ''}
                                        aria-label="테이블"
                                        onClick={() => {
                                            setViewMode('table');
                                            setResultsOpen(true);
                                        }}
                                    >
                                        <Icon name="layers" size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        className={viewMode === 'chart' ? 'active' : ''}
                                        aria-label="차트"
                                        onClick={() => {
                                            setViewMode('chart');
                                            setResultsOpen(true);
                                        }}
                                    >
                                        <Icon name="chart" size={12} />
                                    </button>
                                </div>
                                <input
                                    className="input input--search"
                                    placeholder="scene ID 검색…"
                                    style={{ width: 220, height: 28, fontSize: 12 }}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onFocus={() => setResultsOpen(true)}
                                />
                                {checked.size > 0 ? (
                                    <button
                                        type="button"
                                        className="btn btn--primary btn--sm"
                                        onClick={() => {
                                            handleAddChecked();
                                            setResultsOpen(true);
                                        }}
                                    >
                                        <Icon name="cart" size={12} /> 선택한 {checked.size}개 담기
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn--sm"
                                        onClick={() => {
                                            handleAddAll();
                                            setResultsOpen(true);
                                        }}
                                    >
                                        <Icon name="cart" size={12} /> 전체 담기 ({filtered.length})
                                    </button>
                                )}
                            </div>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateRows: resultsOpen ? '1fr' : '0fr',
                                transition: 'grid-template-rows 260ms ease',
                            }}
                            aria-hidden={!resultsOpen}
                        >
                            <div style={{ minHeight: 0, overflow: 'hidden' }}>
                        <div
                            className="card"
                            style={{ maxHeight: 480, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                        >
                            {filtered.length === 0 ? (
                                <div className="empty" style={{ padding: 60 }}>
                                    <div className="empty__icon">🔍</div>
                                    <div>일치하는 scene이 없습니다</div>
                                    <button type="button" className="btn btn--sm" style={{ marginTop: 12 }} onClick={resetFilters}>
                                        필터 초기화
                                    </button>
                                </div>
                            ) : viewMode === 'chart' ? (
                                <SearchChartView scenes={filtered} />
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th className="checkbox-col">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox"
                                                    checked={allChecked}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            <th>Scene</th>
                                            <th>제품</th>
                                            <th>편광</th>
                                            <th>취득 시각</th>
                                            <th>지역</th>
                                            <th className="num">용량</th>
                                            <th>상태</th>
                                            <th style={{ width: 120 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s) => (
                                            <tr
                                                key={s.id}
                                                className={selectedSceneId === s.id ? 'is-selected' : ''}
                                                onClick={() => setSelectedSceneId(s.id)}
                                            >
                                                <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox"
                                                        checked={checked.has(s.id)}
                                                        onChange={() => toggleOne(s.id)}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="row gap-3">
                                                        <Quicklook sceneId={s.id} size={42} />
                                                        <div className="col" style={{ gap: 2, minWidth: 0 }}>
                                                            <div
                                                                className="mono truncate"
                                                                style={{ fontSize: 11.5, maxWidth: 320 }}
                                                            >
                                                                {s.id}
                                                            </div>
                                                            <div className="row gap-2">
                                                                <span
                                                                    className="badge badge--solid"
                                                                    style={{ fontSize: 10 }}
                                                                >
                                                                    {s.mission}
                                                                </span>
                                                                <span
                                                                    className="faint mono tabular"
                                                                    style={{ fontSize: 11 }}
                                                                >
                                                                    orbit {s.orbit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge badge--neutral">{s.product}</span>
                                                </td>
                                                <td className="mono" style={{ fontSize: 12 }}>
                                                    {s.pol}
                                                </td>
                                                <td
                                                    className="mono tabular"
                                                    style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                                                >
                                                    {s.date}
                                                </td>
                                                <td>{s.region}</td>
                                                <td className="num tabular mono" style={{ fontSize: 12 }}>
                                                    {s.size}
                                                </td>
                                                <td>
                                                    {s.have ? (
                                                        <span className="status status--done">NAS 보유</span>
                                                    ) : (
                                                        <span className="status status--pending">받기 필요</span>
                                                    )}
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <div className="row gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn--ghost btn--icon btn--sm"
                                                            data-tooltip="상세"
                                                            onClick={() => setSceneModal(s)}
                                                        >
                                                            <Icon name="chevronRight" size={13} />
                                                        </button>
                                                        {inCart(s.id) ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn--sm"
                                                                disabled
                                                            >
                                                                <Icon name="check" size={12} /> 담김
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn btn--outline-accent btn--sm"
                                                                onClick={() => handleAdd(s)}
                                                            >
                                                                담기
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <div
                                className="row between"
                                style={{
                                    padding: '10px 14px',
                                    borderTop: '1px solid var(--border-subtle)',
                                    fontSize: 12,
                                    color: 'var(--text-tertiary)',
                                }}
                            >
                                <span>
                                    {filtered.length} / {MOCK_SCENES.length} 표시 중
                                </span>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => toast('데모용 데이터는 여기까지입니다')}
                                >
                                    더 불러오기 <Icon name="chevronDown" size={12} />
                                </button>
                            </div>
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {shpOpen ? <ShapefileUploadModal onClose={() => setShpOpen(false)} /> : null}

            {sceneModal ? (
                <SceneDetailModal
                    scene={sceneModal}
                    inCart={inCart(sceneModal.id)}
                    onClose={() => setSceneModal(null)}
                    onAddToCart={(s) => {
                        addToCart(s);
                        toast('장바구니에 담음', { tone: 'success' });
                        setSceneModal(null);
                    }}
                />
            ) : null}
        </div>
    );
}

interface DetailProps {
    scene: HifiScene;
    onClose: () => void;
    onAddToCart: (s: HifiScene) => void;
    inCart: boolean;
}

function SceneDetailModal({ scene, onClose, onAddToCart, inCart }: DetailProps) {
    const toast = useToast();
    return (
        <Modal
            title="Scene 상세"
            sub={scene.region + ' · ' + scene.date}
            onClose={onClose}
            size="lg"
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>
                        닫기
                    </button>
                    {inCart ? (
                        <button type="button" className="btn" disabled>
                            <Icon name="check" size={13} /> 이미 담김
                        </button>
                    ) : scene.have ? (
                        <button type="button" className="btn btn--primary" onClick={() => onAddToCart(scene)}>
                            <Icon name="download" size={13} /> 즉시 다운로드
                        </button>
                    ) : (
                        <button type="button" className="btn btn--primary" onClick={() => onAddToCart(scene)}>
                            <Icon name="cart" size={13} /> 장바구니 담기
                        </button>
                    )}
                </>
            }
        >
            <div className="row gap-4" style={{ alignItems: 'flex-start' }}>
                <Quicklook sceneId={scene.id} size={200} />
                <div className="col gap-3" style={{ flex: 1, minWidth: 0 }}>
                    <div>
                        <div className="field-label">Scene ID</div>
                        <div
                            className="mono"
                            style={{ fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-all' }}
                        >
                            {scene.id}
                        </div>
                    </div>
                    <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
                        {[
                            ['미션', scene.mission],
                            ['모드', scene.mode ?? '—'],
                            ['제품', scene.product],
                            ['편광', scene.pol ?? '—'],
                            ['Orbit', String(scene.orbit ?? '—')],
                            ['용량', scene.size],
                        ].map(([k, v]) => (
                            <div key={k} className="col" style={{ gap: 2, minWidth: 80 }}>
                                <div className="field-label">{k}</div>
                                <div className="mono tabular" style={{ fontSize: 13 }}>
                                    {v}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="row gap-4">
                        <div className="col" style={{ gap: 2 }}>
                            <div className="field-label">상태</div>
                            {scene.have ? (
                                <span className="status status--done">NAS 보유 · 즉시 이용 가능</span>
                            ) : (
                                <span className="status status--pending">받기 필요 · 약 8분 소요</span>
                            )}
                        </div>
                    </div>
                    {scene.have ? (
                        <div
                            style={{
                                background: 'var(--bg-3)',
                                borderRadius: 8,
                                padding: 12,
                            }}
                        >
                            <div className="field-label">NAS 경로</div>
                            <div className="between" style={{ marginTop: 4 }}>
                                <span className="mono" style={{ fontSize: 11.5 }}>
                                    /nas/sar/{scene.mission}/2026/04/{scene.id.slice(0, 20)}.SAFE.zip
                                </span>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => {
                                        navigator.clipboard?.writeText('/nas/sar/...');
                                        toast('경로를 복사했습니다');
                                    }}
                                >
                                    경로 복사
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </Modal>
    );
}

/**
 * 검색 결과 차트 뷰.
 * - 날짜별 scene 개수 막대그래프 (filtered 범위 내 모든 날짜, 값이 0인 날짜 포함)
 * - 우측 요약 카드: 미션/제품/편광/상태(NAS 보유 vs 받기 필요) 분포
 */
function SearchChartView({ scenes }: { scenes: HifiScene[] }) {
    // 날짜별 scene 수 집계 (YYYY-MM-DD)
    const buckets = new Map<string, number>();
    for (const s of scenes) {
        const d = s.date.slice(0, 10);
        buckets.set(d, (buckets.get(d) ?? 0) + 1);
    }
    const entries = Array.from(buckets.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    const maxCount = entries.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

    const missionCounts = count(scenes, (s) => s.mission);
    const productCounts = count(scenes, (s) => s.product);
    const polCounts = count(scenes, (s) => s.pol ?? '—');
    const haveCount = scenes.filter((s) => s.have).length;
    const needCount = scenes.length - haveCount;
    const totalGb = scenes.reduce((a, s) => a + parseFloat(s.size), 0);

    return (
        <div className="col gap-4" style={{ padding: 16, minWidth: 0 }}>
            <div className="row gap-4" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
                <SummaryStat label="검색 결과" value={`${scenes.length}`} sub={`${totalGb.toFixed(1)} GB`} />
                <SummaryStat label="NAS 보유" value={`${haveCount}`} sub={`${pct(haveCount, scenes.length)}%`} tone="success" />
                <SummaryStat label="받기 필요" value={`${needCount}`} sub={`${pct(needCount, scenes.length)}%`} tone="warning" />
                <SummaryStat
                    label="날짜 범위"
                    value={entries.length > 0 ? `${entries[0][0]} ~ ${entries[entries.length - 1][0]}` : '—'}
                    sub={`${entries.length}일`}
                    wide
                />
            </div>

            <div>
                <div className="field-label">날짜별 scene 수</div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 4,
                        height: 160,
                        padding: '12px 4px',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        overflowX: 'auto',
                    }}
                >
                    {entries.length === 0 ? (
                        <div className="faint" style={{ fontSize: 12, margin: 'auto' }}>
                            집계할 날짜가 없습니다
                        </div>
                    ) : (
                        entries.map(([date, n]) => (
                            <div
                                key={date}
                                className="col"
                                style={{
                                    alignItems: 'center',
                                    minWidth: 22,
                                    height: '100%',
                                    justifyContent: 'flex-end',
                                    gap: 4,
                                }}
                                title={`${date} — ${n}개`}
                            >
                                <span className="faint tabular" style={{ fontSize: 10 }}>
                                    {n}
                                </span>
                                <div
                                    style={{
                                        width: 18,
                                        height: `${(n / maxCount) * 100}%`,
                                        minHeight: 2,
                                        background: 'var(--accent)',
                                        borderRadius: 2,
                                        transition: 'height 200ms ease',
                                    }}
                                />
                                <span
                                    className="faint mono tabular"
                                    style={{ fontSize: 9.5, writingMode: 'vertical-rl', marginTop: 2 }}
                                >
                                    {date.slice(5)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="row gap-4" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
                <BreakdownCard title="미션" items={missionCounts} />
                <BreakdownCard title="제품" items={productCounts} />
                <BreakdownCard title="편광" items={polCounts} />
            </div>
        </div>
    );
}

function SummaryStat({
    label,
    value,
    sub,
    tone,
    wide,
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: 'success' | 'warning';
    wide?: boolean;
}) {
    const color = tone === 'success' ? '#22d3ee' : tone === 'warning' ? '#fbbf24' : 'var(--text-primary)';
    return (
        <div
            className="col"
            style={{
                flex: wide ? '1 1 260px' : '1 1 140px',
                padding: '10px 12px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                gap: 4,
            }}
        >
            <div className="field-label" style={{ margin: 0 }}>
                {label}
            </div>
            <div className="tabular" style={{ fontSize: wide ? 14 : 22, fontWeight: 600, color, lineHeight: 1.15 }}>
                {value}
            </div>
            {sub ? (
                <div className="faint mono tabular" style={{ fontSize: 11 }}>
                    {sub}
                </div>
            ) : null}
        </div>
    );
}

function BreakdownCard({ title, items }: { title: string; items: Array<[string, number]> }) {
    const total = items.reduce((a, [, v]) => a + v, 0) || 1;
    return (
        <div
            className="col"
            style={{
                flex: '1 1 180px',
                padding: 12,
                background: 'var(--bg-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                gap: 6,
            }}
        >
            <div className="field-label" style={{ margin: 0 }}>
                {title}
            </div>
            {items.map(([k, n]) => (
                <div key={k} className="col" style={{ gap: 3 }}>
                    <div className="between" style={{ fontSize: 12 }}>
                        <span>{k}</span>
                        <span className="mono tabular faint">
                            {n} · {pct(n, total)}%
                        </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${(n / total) * 100}%`,
                                height: '100%',
                                background: 'var(--accent)',
                                transition: 'width 200ms ease',
                            }}
                        />
                    </div>
                </div>
            ))}
            {items.length === 0 ? (
                <span className="faint" style={{ fontSize: 11 }}>
                    데이터 없음
                </span>
            ) : null}
        </div>
    );
}

function count<T>(arr: T[], key: (x: T) => string): Array<[string, number]> {
    const m = new Map<string, number>();
    for (const x of arr) {
        const k = key(x);
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => b - a);
}

function pct(n: number, total: number): number {
    if (!total) return 0;
    return Math.round((n / total) * 100);
}
