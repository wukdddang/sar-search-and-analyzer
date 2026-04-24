'use client';

import { useMemo, useState } from 'react';

import { Icon, MapCanvas, PageHeader, useConfirm, useToast, type MapFootprint } from '@/_ui/hifi';

interface Req {
    id: string;
    user: string;
    email: string;
    scenes: number;
    size: string;
    aoi: string;
    waitH: number;
    /** AOI ring [lon, lat][] (EPSG:4326) */
    coords: Array<[number, number]>;
    /** Sample scene footprints inside the AOI (mock — first ~3 scenes) */
    sceneCoords: Array<Array<[number, number]>>;
    center: [number, number];
}

const INITIAL: Req[] = [
    {
        id: 'req-221',
        user: '박지수',
        email: 'park@ksit.re.kr',
        scenes: 148,
        size: '264 GB',
        aoi: 'Gyeongju broad',
        waitH: 1.2,
        coords: [
            [129.1, 35.78],
            [129.34, 35.76],
            [129.36, 35.94],
            [129.12, 35.96],
        ],
        sceneCoords: [
            [
                [129.12, 35.8],
                [129.28, 35.79],
                [129.29, 35.91],
                [129.13, 35.92],
            ],
            [
                [129.16, 35.82],
                [129.32, 35.81],
                [129.33, 35.93],
                [129.17, 35.94],
            ],
        ],
        center: [129.22, 35.86],
    },
    {
        id: 'req-219',
        user: '최윤라',
        email: 'choi@univ.ac.kr',
        scenes: 102,
        size: '178 GB',
        aoi: 'Pohang + Ulsan',
        waitH: 3.4,
        coords: [
            [129.2, 35.45],
            [129.55, 35.43],
            [129.57, 36.13],
            [129.22, 36.15],
        ],
        sceneCoords: [
            [
                [129.25, 35.94],
                [129.5, 35.92],
                [129.51, 36.1],
                [129.26, 36.12],
            ],
            [
                [129.22, 35.5],
                [129.46, 35.48],
                [129.47, 35.66],
                [129.23, 35.68],
            ],
        ],
        center: [129.38, 35.78],
    },
    {
        id: 'req-216',
        user: '이민호',
        email: 'lee@labs.kr',
        scenes: 240,
        size: '412 GB',
        aoi: 'Busan port',
        waitH: 6.1,
        coords: [
            [128.96, 35.07],
            [129.21, 35.05],
            [129.22, 35.22],
            [128.97, 35.24],
        ],
        sceneCoords: [
            [
                [129.0, 35.1],
                [129.18, 35.09],
                [129.19, 35.2],
                [129.01, 35.21],
            ],
        ],
        center: [129.09, 35.15],
    },
    {
        id: 'req-214',
        user: '정소현',
        email: 'jung@ksit.re.kr',
        scenes: 180,
        size: '312 GB',
        aoi: 'Seoul metro',
        waitH: 12.8,
        coords: [
            [126.85, 37.45],
            [127.18, 37.43],
            [127.2, 37.65],
            [126.86, 37.66],
        ],
        sceneCoords: [
            [
                [126.9, 37.48],
                [127.14, 37.46],
                [127.15, 37.62],
                [126.91, 37.64],
            ],
        ],
        center: [127.02, 37.55],
    },
    {
        id: 'req-208',
        user: '김연구원',
        email: 'kim@ksit.re.kr',
        scenes: 220,
        size: '378 GB',
        aoi: '전국 범위',
        waitH: 26.4,
        coords: [
            [125.8, 33.8],
            [129.8, 33.8],
            [130.0, 38.5],
            [126.0, 38.5],
        ],
        sceneCoords: [
            [
                [126.5, 35.5],
                [128.0, 35.5],
                [128.0, 37.0],
                [126.5, 37.0],
            ],
            [
                [128.5, 35.5],
                [129.5, 35.5],
                [129.5, 36.7],
                [128.5, 36.7],
            ],
        ],
        center: [127.8, 36.0],
    },
];

type SortKey = 'FIFO' | '용량 순' | '사용자 순';

const waitColor = (h: number) =>
    h > 24 ? 'var(--danger)' : h > 4 ? 'var(--warning)' : 'var(--text-secondary)';

export default function ApprovalsPage() {
    const toast = useToast();
    const confirm = useConfirm();
    const [reqs, setReqs] = useState<Req[]>(INITIAL);
    const [sort, setSort] = useState<SortKey>('FIFO');
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string>(INITIAL[0]?.id ?? '');

    const sorted = useMemo(() => {
        const arr = [...reqs];
        if (sort === '용량 순') arr.sort((a, b) => parseInt(b.size) - parseInt(a.size));
        else if (sort === '사용자 순') arr.sort((a, b) => a.user.localeCompare(b.user));
        else arr.sort((a, b) => b.waitH - a.waitH);
        return arr;
    }, [reqs, sort]);

    const active = useMemo(() => sorted.find((r) => r.id === activeId) ?? sorted[0], [sorted, activeId]);

    const allChecked = sorted.length > 0 && sorted.every((r) => sel.has(r.id));
    const toggleAll = () => (allChecked ? setSel(new Set()) : setSel(new Set(sorted.map((r) => r.id))));
    const toggleOne = (id: string) =>
        setSel((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const removeReq = (id: string) => {
        setReqs((prev) => prev.filter((r) => r.id !== id));
        setSel((prev) => {
            const n = new Set(prev);
            n.delete(id);
            return n;
        });
        if (activeId === id) {
            const next = sorted.find((r) => r.id !== id);
            setActiveId(next?.id ?? '');
        }
    };

    const approve = (id: string) => {
        removeReq(id);
        toast(`${id} 승인 완료 — 다운로드 큐에 추가됨`, { tone: 'success' });
    };
    const reject = async (id: string) => {
        const ok = await confirm({
            title: `${id} 거절`,
            body: '요청을 거절합니다. 사용자에게 알림이 전송됩니다.',
            confirmLabel: '거절',
            danger: true,
        });
        if (!ok) return;
        removeReq(id);
        toast(`${id} 거절됨`);
    };
    const bulkApprove = async () => {
        const ok = await confirm({
            title: `${sel.size}건 일괄 승인`,
            body: '선택된 요청을 모두 승인하고 다운로드 큐에 추가합니다.',
            confirmLabel: '승인',
        });
        if (!ok) return;
        setReqs((prev) => prev.filter((r) => !sel.has(r.id)));
        toast(`${sel.size}건 일괄 승인 완료`, { tone: 'success' });
        setSel(new Set());
    };
    const bulkReject = async () => {
        const ok = await confirm({
            title: `${sel.size}건 일괄 거절`,
            body: '선택된 요청을 모두 거절합니다.',
            confirmLabel: '거절',
            danger: true,
        });
        if (!ok) return;
        setReqs((prev) => prev.filter((r) => !sel.has(r.id)));
        toast(`${sel.size}건 일괄 거절됨`);
        setSel(new Set());
    };

    const detailFootprints = useMemo<MapFootprint[]>(() => {
        if (!active) return [];
        const items: MapFootprint[] = [
            { id: `${active.id}-aoi`, coords: active.coords, kind: 'aoi', label: active.aoi, active: true },
        ];
        active.sceneCoords.forEach((coords, i) =>
            items.push({ id: `${active.id}-scene-${i}`, coords, kind: 'need', label: `scene ${i + 1}` }),
        );
        return items;
    }, [active]);

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader
                breadcrumb={['관리자', '승인 큐']}
                actions={
                    <>
                        <span className="badge badge--warning">{reqs.length}건 대기</span>
                        <span className="badge badge--neutral">NAS 여유 17.4 TB</span>
                    </>
                }
            />
            <div className="toolbar">
                <input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} />
                <span className="faint" style={{ fontSize: 12 }}>
                    전체 선택 ({sel.size}/{sorted.length})
                </span>
                <div className="row gap-1" style={{ marginLeft: 12 }}>
                    {(['FIFO', '용량 순', '사용자 순'] as const).map((s) => (
                        <span
                            key={s}
                            className={`chip${sort === s ? ' chip--active' : ''}`}
                            onClick={() => setSort(s)}
                        >
                            {s}
                        </span>
                    ))}
                </div>
                <div className="row gap-2" style={{ marginLeft: 'auto' }}>
                    <button type="button" className="btn btn--sm" disabled={sel.size === 0} onClick={bulkReject}>
                        일괄 거절 {sel.size > 0 ? `(${sel.size})` : ''}
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={sel.size === 0}
                        onClick={bulkApprove}
                    >
                        일괄 승인 {sel.size > 0 ? `(${sel.size})` : ''}
                    </button>
                </div>
            </div>
            <div className="split" style={{ flex: 1, minHeight: 0 }}>
                {/* LEFT — request list */}
                <aside className="split__side split__side--left" style={{ width: 460, overflow: 'auto' }}>
                    {sorted.length === 0 ? (
                        <div className="empty" style={{ padding: 80 }}>
                            <div className="empty__icon">✅</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                대기 중인 승인 요청이 없습니다
                            </div>
                            <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                                사용자가 100건 초과 요청 시 여기로 들어옵니다
                            </div>
                        </div>
                    ) : (
                        <div className="col gap-2" style={{ padding: 12 }}>
                            {sorted.map((r) => {
                                const isActive = r.id === active?.id;
                                const cardFootprints: MapFootprint[] = [
                                    { id: `${r.id}-aoi-mini`, coords: r.coords, kind: 'aoi' },
                                    ...r.sceneCoords.map((coords, i) => ({
                                        id: `${r.id}-mini-${i}`,
                                        coords,
                                        kind: 'need' as const,
                                    })),
                                ];
                                return (
                                    <div
                                        key={r.id}
                                        className="card"
                                        onClick={() => setActiveId(r.id)}
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: isActive
                                                ? 'var(--accent)'
                                                : r.waitH > 24
                                                  ? 'var(--danger-soft)'
                                                  : undefined,
                                            borderWidth: isActive ? 2 : 1,
                                            background: isActive ? 'var(--accent-soft)' : undefined,
                                        }}
                                    >
                                        <div className="card__header">
                                            <div className="row gap-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox"
                                                    checked={sel.has(r.id)}
                                                    onChange={() => toggleOne(r.id)}
                                                />
                                                <div className="col" style={{ gap: 2 }}>
                                                    <div className="row gap-2">
                                                        <span style={{ fontWeight: 600 }}>{r.user}</span>
                                                        <span className="mono faint" style={{ fontSize: 11.5 }}>
                                                            {r.id}
                                                        </span>
                                                    </div>
                                                    <div className="faint mono" style={{ fontSize: 11.5 }}>
                                                        {r.email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className="row gap-2"
                                                style={{ color: waitColor(r.waitH), fontSize: 12 }}
                                            >
                                                <Icon name="clock" size={12} />
                                                <span className="tabular">
                                                    {r.waitH < 1
                                                        ? `${Math.round(r.waitH * 60)}분`
                                                        : `${r.waitH.toFixed(1)}h`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="card__body">
                                            <div className="row gap-4" style={{ marginBottom: 10 }}>
                                                <div className="col" style={{ gap: 2 }}>
                                                    <span className="field-label">Scenes</span>
                                                    <span
                                                        className="mono tabular"
                                                        style={{ fontSize: 16, fontWeight: 600 }}
                                                    >
                                                        {r.scenes}
                                                    </span>
                                                </div>
                                                <div className="col" style={{ gap: 2 }}>
                                                    <span className="field-label">총 용량</span>
                                                    <span
                                                        className="mono tabular"
                                                        style={{ fontSize: 16, fontWeight: 600 }}
                                                    >
                                                        {r.size}
                                                    </span>
                                                </div>
                                                <div className="col" style={{ gap: 2, flex: 1 }}>
                                                    <span className="field-label">AOI</span>
                                                    <span style={{ fontSize: 13 }}>{r.aoi}</span>
                                                </div>
                                            </div>
                                            <div style={{ height: 110, borderRadius: 6, overflow: 'hidden' }}>
                                                <MapCanvas
                                                    interactive={false}
                                                    showLegend={false}
                                                    showBasemapSwitch={false}
                                                    footprints={cardFootprints}
                                                    center={r.center}
                                                    zoom={9}
                                                />
                                            </div>
                                        </div>
                                        <div
                                            className="card__footer row gap-2"
                                            style={{ justifyContent: 'flex-end' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                className="btn btn--danger-ghost btn--sm"
                                                onClick={() => reject(r.id)}
                                            >
                                                거절
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn--primary btn--sm"
                                                onClick={() => approve(r.id)}
                                            >
                                                승인
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </aside>

                {/* RIGHT — large detail map */}
                <div
                    className="split__main"
                    style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
                >
                    {!active ? (
                        <div className="empty" style={{ padding: 80, flex: 1 }}>
                            <div className="empty__icon">🗺</div>
                            <div>왼쪽에서 요청을 선택하면 AOI를 크게 볼 수 있습니다</div>
                        </div>
                    ) : (
                        <>
                            <div
                                className="between"
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-2)',
                                }}
                            >
                                <div className="col" style={{ gap: 2 }}>
                                    <div className="row gap-2">
                                        <span style={{ fontWeight: 600, fontSize: 15 }}>{active.aoi}</span>
                                        <span className="mono faint" style={{ fontSize: 11.5 }}>
                                            {active.id}
                                        </span>
                                    </div>
                                    <div className="row gap-3 faint" style={{ fontSize: 12 }}>
                                        <span>{active.user}</span>
                                        <span>·</span>
                                        <span className="mono tabular">{active.scenes} scenes</span>
                                        <span>·</span>
                                        <span className="mono tabular">{active.size}</span>
                                        <span>·</span>
                                        <span style={{ color: waitColor(active.waitH) }}>
                                            대기 {active.waitH < 1
                                                ? `${Math.round(active.waitH * 60)}분`
                                                : `${active.waitH.toFixed(1)}h`}
                                        </span>
                                    </div>
                                </div>
                                <div className="row gap-2">
                                    <button
                                        type="button"
                                        className="btn btn--danger-ghost btn--sm"
                                        onClick={() => reject(active.id)}
                                    >
                                        거절
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn--primary btn--sm"
                                        onClick={() => approve(active.id)}
                                    >
                                        승인 — 다운로드 큐 추가
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: 16 }}>
                                <MapCanvas
                                    footprints={detailFootprints}
                                    center={active.center}
                                    zoom={9}
                                    fitKey={active.id}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
