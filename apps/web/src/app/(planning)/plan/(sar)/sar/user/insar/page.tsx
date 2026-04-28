'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

import {
    DateRangePicker,
    Icon,
    InfoTip,
    MapCanvas,
    Modal,
    PageHeader,
    Quicklook,
    useToast,
    type MapFootprint,
    type MapPoint,
    type MapTool,
} from '@/_ui/hifi';

// ────────────────────────────────────────────────────────────────────────────
// 결과(완료된 산출물) 모킹 데이터
// ────────────────────────────────────────────────────────────────────────────

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
    '25-10', '25-11', '25-12', '26-01', '26-02', '26-03',
    '26-04', '26-05', '26-06', '26-07', '26-08', '26-09',
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

// ────────────────────────────────────────────────────────────────────────────
// 분석 요청 (request) 모델
// ────────────────────────────────────────────────────────────────────────────

type Tab = 'request' | 'results';

type AnalysisType = 'DInSAR' | 'PSInSAR' | 'SBAS';

const ANALYSIS_META: Record<
    AnalysisType,
    { label: string; sub: string; minScenes: number; sceneRequirement: string }
> = {
    DInSAR: {
        label: 'DInSAR',
        sub: 'Differential — 두 시점 간 변위(이벤트 기반)',
        minScenes: 2,
        sceneRequirement: 'scene 2개 (master + slave)',
    },
    PSInSAR: {
        label: 'PSInSAR',
        sub: 'Persistent Scatterer — 도시·구조물 장기 변위',
        minScenes: 20,
        sceneRequirement: 'scene 20개 이상',
    },
    SBAS: {
        label: 'SBAS',
        sub: 'Small Baseline Subset — 분산형 산란체 시계열',
        minScenes: 15,
        sceneRequirement: 'scene 15개 이상',
    },
};

interface RequestForm {
    name: string;
    type: AnalysisType;
    nwLat: string;
    nwLon: string;
    seLat: string;
    seLon: string;
    startDate: Date;
    endDate: Date;
    s1a: boolean;
    s1c: boolean;
    polarization: string;
    layers: Set<string>;
    coherenceMin: number;
    temporalBaselineMaxDays: number;
    spatialBaselineMaxM: number;
    minScenes: number;
    referenceLon: string;
    referenceLat: string;
    priority: 'normal' | 'urgent';
}

function buildDefaultRequest(): RequestForm {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setMonth(end.getMonth() - 6);
    return {
        name: '',
        type: 'DInSAR',
        nwLat: '36.10',
        nwLon: '129.30',
        seLat: '35.95',
        seLon: '129.45',
        startDate: start,
        endDate: end,
        s1a: true,
        s1c: false,
        polarization: 'VV+VH',
        layers: new Set(['mean_velocity', 'coherence']),
        coherenceMin: 0.3,
        temporalBaselineMaxDays: 60,
        spatialBaselineMaxM: 200,
        minScenes: 20,
        referenceLon: '',
        referenceLat: '',
        priority: 'normal',
    };
}

function parseAoiFromForm(f: RequestForm): Array<[number, number]> | null {
    const nlat = parseFloat(f.nwLat);
    const nlon = parseFloat(f.nwLon);
    const slat = parseFloat(f.seLat);
    const slon = parseFloat(f.seLon);
    if (![nlat, nlon, slat, slon].every(Number.isFinite)) return null;
    if (nlat <= slat || slon <= nlon) return null;
    return [
        [nlon, nlat],
        [slon, nlat],
        [slon, slat],
        [nlon, slat],
        [nlon, nlat],
    ];
}

/**
 * 두 풋프린트(폴리곤 ring) 의 겹침 비율을 bbox 근사로 계산.
 * 결과 = (교집합 면적 / 더 작은 쪽 풋프린트 면적) × 100. 0 ~ 100.
 *
 * DInSAR 가이드라인:
 *   ≥80% — 안정적 (동일 트랙/궤도 기준 일반적)
 *   70~80% — 권장 하한선
 *   <70% — 분석 가용 면적이 좁아 권장하지 않음
 * (단, 본 UI 에서는 정보로만 표시하고 제출을 막지는 않음.)
 */
function bboxOverlapPercent(
    a: Array<[number, number]>,
    b: Array<[number, number]>,
): number {
    if (!a.length || !b.length) return 0;
    const bb = (ring: Array<[number, number]>) => {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
        return { minLon, maxLon, minLat, maxLat };
    };
    const A = bb(a);
    const B = bb(b);
    const ix0 = Math.max(A.minLon, B.minLon);
    const ix1 = Math.min(A.maxLon, B.maxLon);
    const iy0 = Math.max(A.minLat, B.minLat);
    const iy1 = Math.min(A.maxLat, B.maxLat);
    if (ix1 <= ix0 || iy1 <= iy0) return 0;
    const inter = (ix1 - ix0) * (iy1 - iy0);
    const aArea = (A.maxLon - A.minLon) * (A.maxLat - A.minLat);
    const bArea = (B.maxLon - B.minLon) * (B.maxLat - B.minLat);
    if (aArea <= 0 || bArea <= 0) return 0;
    return (inter / Math.min(aArea, bArea)) * 100;
}

/**
 * 여러 풋프린트(축 정렬 bbox 가정)의 공통 교집합을 폴리곤 ring 으로 반환.
 * 어느 한 쌍이라도 교차하지 않으면 null.
 */
function computeFootprintsIntersection(
    footprints: Array<Array<[number, number]>>,
): Array<[number, number]> | null {
    if (footprints.length === 0) return null;
    let minLon = -Infinity, maxLon = Infinity, minLat = -Infinity, maxLat = Infinity;
    for (const fp of footprints) {
        if (!fp.length) return null;
        let fMinLon = Infinity, fMaxLon = -Infinity, fMinLat = Infinity, fMaxLat = -Infinity;
        for (const [lon, lat] of fp) {
            if (lon < fMinLon) fMinLon = lon;
            if (lon > fMaxLon) fMaxLon = lon;
            if (lat < fMinLat) fMinLat = lat;
            if (lat > fMaxLat) fMaxLat = lat;
        }
        minLon = Math.max(minLon, fMinLon);
        maxLon = Math.min(maxLon, fMaxLon);
        minLat = Math.max(minLat, fMinLat);
        maxLat = Math.min(maxLat, fMaxLat);
    }
    if (maxLon <= minLon || maxLat <= minLat) return null;
    return [
        [minLon, maxLat],
        [maxLon, maxLat],
        [maxLon, minLat],
        [minLon, minLat],
        [minLon, maxLat],
    ];
}

function aoiCenter(aoi: Array<[number, number]> | null): [number, number] | null {
    if (!aoi || aoi.length < 3) return null;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lon, lat] of aoi) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }
    return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

interface AvailableScene {
    id: string;
    date: string;
    isoDate: string;
    mission: 'S1A' | 'S1C';
    pass: 'ASC' | 'DESC';
    /** 가상 perpendicular baseline (m), -200~+200 범위 */
    perpBaseline: number;
    footprint: Array<[number, number]>;
}

/**
 * AOI + 기간 + 미션 선택을 기반으로 모킹된 사용 가능한 scene 리스트를 생성한다.
 * 실제로는 카탈로그에서 fetch, 여기서는 12-day(혹은 6-day) cadence 로 생성.
 */
function generateAvailableScenes(form: RequestForm): AvailableScene[] {
    const aoi = parseAoiFromForm(form);
    if (!aoi) return [];
    const missions: ('S1A' | 'S1C')[] = [];
    if (form.s1a) missions.push('S1A');
    if (form.s1c) missions.push('S1C');
    if (missions.length === 0) return [];
    const day = 24 * 60 * 60 * 1000;
    // 고정 anchor 기준 cadence — startDate 가 바뀌어도 각 scene 의 절대 위치(t, id, perp, offset)
    // 는 불변. 사이드바/핸들로 기간을 줄이면 양 끝에서 scene 만 잘려나가고, 안쪽 마커는 그대로 유지.
    const ANCHOR = new Date(2024, 0, 1).getTime();
    const stepMs = (12 / missions.length) * day;
    const startT = form.startDate.getTime();
    const endT = form.endDate.getTime();
    const firstIdx = Math.max(0, Math.ceil((startT - ANCHOR) / stepMs));
    const lastIdx = Math.floor((endT - ANCHOR) / stepMs);
    const out: AvailableScene[] = [];
    for (let i = firstIdx; i <= lastIdx && out.length < 400; i++) {
        const t = ANCHOR + i * stepMs;
        const m = missions[i % missions.length]!;
        const d = new Date(t);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const perp = Math.round(Math.sin(i * 1.7) * 180);
        const offsetLon = ((i % 7) - 3) * 0.006;
        const offsetLat = ((i % 5) - 2) * 0.004;
        const fp: Array<[number, number]> = aoi.map(
            ([lon, lat]) => [lon + offsetLon, lat + offsetLat] as [number, number],
        );
        out.push({
            id: `${m}_IW_SLC__1SDV_${yyyy}${mm}${dd}T211515_${i}`,
            date: `${yyyy}-${mm}-${dd}`,
            isoDate: `${yyyy}-${mm}-${dd}`,
            mission: m,
            pass: i % 2 === 0 ? 'ASC' : 'DESC',
            perpBaseline: perp,
            footprint: fp,
        });
    }
    return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────────────────

export default function InsarPage() {
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('request');

    // 결과 모드 상태
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

    // 요청 모드 상태
    const [request, setRequest] = useState<RequestForm>(() => buildDefaultRequest());
    const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(() => new Set());
    const [submitting, setSubmitting] = useState(false);
    const [activeTool, setActiveTool] = useState<MapTool | undefined>(undefined);
    const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);
    // 기간/AOI/미션이 바뀌면 사용 가능한 scene 을 다시 가져오는 척 — 지도 위에 로딩 오버레이.
    // 핸들 드래그처럼 deps 가 빠르게 연속 변하는 동안에는 오버레이가 깜빡이지 않아야 하므로
    // 마지막 변경 후 300ms 동안 잠잠해야 비로소 로딩이 떠야 한다 (debounce on entry).
    const [fetchingScenes, setFetchingScenes] = useState(false);
    const fetchEnterRef = useRef<number | null>(null);
    const fetchExitRef = useRef<number | null>(null);
    const fetchInitialRef = useRef(true);
    useEffect(() => {
        if (fetchInitialRef.current) {
            fetchInitialRef.current = false;
            return;
        }
        // deps 가 다시 바뀌었으면 진행 중인 entry/exit 타이머 모두 취소하고 표시도 끔.
        if (fetchEnterRef.current) window.clearTimeout(fetchEnterRef.current);
        if (fetchExitRef.current) window.clearTimeout(fetchExitRef.current);
        setFetchingScenes(false);
        fetchEnterRef.current = window.setTimeout(() => {
            fetchEnterRef.current = null;
            setFetchingScenes(true);
            fetchExitRef.current = window.setTimeout(() => {
                fetchExitRef.current = null;
                setFetchingScenes(false);
            }, 500);
        }, 300);
        return () => {
            if (fetchEnterRef.current) {
                window.clearTimeout(fetchEnterRef.current);
                fetchEnterRef.current = null;
            }
            if (fetchExitRef.current) {
                window.clearTimeout(fetchExitRef.current);
                fetchExitRef.current = null;
            }
        };
    }, [
        request.startDate,
        request.endDate,
        request.s1a,
        request.s1c,
        request.nwLat,
        request.nwLon,
        request.seLat,
        request.seLon,
    ]);

    const product = useMemo(() => PRODUCTS.find((p) => p.id === selected) ?? PRODUCTS[0]!, [selected]);
    const filteredProducts = PRODUCTS.filter((p) => typeFilter === '전체' || p.type === typeFilter);

    const requestAoi = useMemo(() => parseAoiFromForm(request), [
        request.nwLat, request.nwLon, request.seLat, request.seLon,
    ]);
    const availableScenes = useMemo(() => generateAvailableScenes(request), [
        request.startDate, request.endDate, request.s1a, request.s1c,
        request.nwLat, request.nwLon, request.seLat, request.seLon,
    ]);

    // DInSAR 모드 + 2개 선택 시 master/slave 풋프린트 겹침 비율 (정보용).
    const dinsarOverlap = useMemo<number | null>(() => {
        if (request.type !== 'DInSAR') return null;
        if (selectedSceneIds.size !== 2) return null;
        const ids = Array.from(selectedSceneIds);
        const a = availableScenes.find((s) => s.id === ids[0]);
        const b = availableScenes.find((s) => s.id === ids[1]);
        if (!a || !b) return null;
        return bboxOverlapPercent(a.footprint, b.footprint);
    }, [request.type, selectedSceneIds, availableScenes]);

    // 유형 변경 / scene 목록 변경 시 선택을 재조정
    const toggleSceneSelection = (id: string) => {
        setSelectedSceneIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                return next;
            }
            // DInSAR: 정확히 2개 유지. 이미 2개가 선택돼 있으면 가장 마지막에 선택했던 scene 을
            // 새로 누른 scene 으로 대체 (Set 의 삽입 순서 마지막 항목을 제거).
            if (request.type === 'DInSAR' && next.size >= 2) {
                const arr = Array.from(next);
                const lastId = arr[arr.length - 1];
                if (lastId !== undefined) next.delete(lastId);
            }
            next.add(id);
            return next;
        });
    };
    const clearSelectedScenes = () => setSelectedSceneIds(new Set());

    /** 빠른 전체 선택 — DInSAR 면 첫/마지막 scene 으로 페어, 그 외는 모든 가용 scene. */
    const selectAllScenes = () => {
        if (availableScenes.length === 0) {
            toast('선택할 scene 이 없습니다', { tone: 'warning' });
            return;
        }
        if (request.type === 'DInSAR') {
            const first = availableScenes[0]!;
            const last = availableScenes[availableScenes.length - 1]!;
            if (first.id === last.id) {
                toast('DInSAR 는 두 scene 이 필요합니다 (현재 1개만 가용)', { tone: 'warning' });
                return;
            }
            setSelectedSceneIds(new Set([first.id, last.id]));
            toast(`첫/마지막 scene 페어 선택 (${first.date} → ${last.date})`, { tone: 'success' });
            return;
        }
        setSelectedSceneIds(new Set(availableScenes.map((s) => s.id)));
        toast(`${availableScenes.length}개 scene 모두 선택`, { tone: 'success' });
    };

    // 지도 중심: 첫 진입 시점만 사용 (MapCanvas 가 prop 변경 시 view 를 옮기지 않음)
    const initialCenter: [number, number] = requestAoi
        ? aoiCenter(requestAoi) ?? [129.37, 36.02]
        : [129.37, 36.02];

    // 지도 위 footprint — 시각적 노이즈를 최소화하기 위해 후보 outline 은 표시하지 않고,
    //   • 선택 scene 0~1개: 그 한 장의 footprint 를 라벨과 함께 부각
    //   • 선택 scene 2개 이상: 개별 footprint 는 흐리게(fill 없는 cyan outline) 깔고
    //                         그 위에 모든 footprint 의 교집합을 "공통 커버리지"(green)로 강조 + 라벨
    //   • timeline hover: 해당 scene footprint 만 cyan(fill+stroke)로 1장 추가 표시
    const selectedScenes = useMemo(
        () => availableScenes.filter((s) => selectedSceneIds.has(s.id)),
        [availableScenes, selectedSceneIds],
    );
    const commonCoverage = useMemo(() => {
        if (selectedScenes.length < 2) return null;
        return computeFootprintsIntersection(selectedScenes.map((s) => s.footprint));
    }, [selectedScenes]);

    const requestFootprints = useMemo<MapFootprint[]>(() => {
        const out: MapFootprint[] = [];
        if (selectedScenes.length === 1) {
            // 단일 선택 — 그대로 cyan + 라벨
            const s = selectedScenes[0]!;
            out.push({
                id: s.id,
                coords: s.footprint,
                kind: 'have',
                label: `${s.date} · ${s.mission}`,
                active: true,
                onClick: () => toggleSceneSelection(s.id),
            });
        } else if (selectedScenes.length >= 2) {
            // 다중 선택 — 개별 footprint 는 흐리게(candidate 스타일), 공통 커버리지를 강조
            for (const s of selectedScenes) {
                out.push({
                    id: s.id,
                    coords: s.footprint,
                    kind: 'candidate',
                    onClick: () => toggleSceneSelection(s.id),
                });
            }
            if (commonCoverage) {
                out.push({
                    id: '__common-coverage',
                    coords: commonCoverage,
                    kind: 'common',
                    label: `공통 관측 영역 · ${selectedScenes.length} scenes`,
                    active: true,
                });
            }
        }
        // hover 한 scene 이 있고, 아직 선택되지 않았다면 단일 cyan 으로 추가 (가장 위)
        if (hoveredSceneId) {
            const s = availableScenes.find((x) => x.id === hoveredSceneId);
            if (s && !selectedSceneIds.has(s.id)) {
                out.push({
                    id: `${s.id}__hover`,
                    coords: s.footprint,
                    kind: 'have',
                    label: `${s.date} · ${s.mission}`,
                    onClick: () => toggleSceneSelection(s.id),
                });
            }
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableScenes, selectedScenes, commonCoverage, hoveredSceneId, selectedSceneIds]);

    const resultsPoints = useMemo<MapPoint[]>(
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

    const mapAoi = tab === 'request' ? requestAoi : null;
    const mapFootprints = tab === 'request' ? requestFootprints : [];
    const mapPointsList = tab === 'results' ? resultsPoints : [];
    const mapOnClick = tab === 'results' ? (coord: [number, number]) => addPointAt(coord[0], coord[1]) : undefined;

    // ── 요청 모드: 지도에서 AOI 그리기/편집 ───────────────────────────────
    /** 폴리곤 ring 으로부터 bbox 를 구해 form 의 NW/SE 좌표 4개를 갱신. */
    const applyAoiFromRing = (ring: Array<[number, number]>) => {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
        if (!Number.isFinite(minLon)) return;
        setRequest((f) => ({
            ...f,
            nwLat: maxLat.toFixed(4),
            nwLon: minLon.toFixed(4),
            seLat: minLat.toFixed(4),
            seLon: maxLon.toFixed(4),
        }));
        // AOI 를 새로 잡으면 기존 scene 선택은 의미 없으므로 초기화.
        setSelectedSceneIds(new Set());
    };
    const handleMapDrawEnd = (
        _tool: MapTool,
        geom: { type: string; coordinates: unknown },
    ) => {
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
            const ring = (geom.coordinates as number[][][])[0];
            if (ring && ring.length >= 3) {
                const coords = ring.map(([lon, lat]) => [lon, lat] as [number, number]);
                applyAoiFromRing(coords);
                toast('AOI 적용됨', { tone: 'success' });
            }
        }
        setActiveTool(undefined);
    };
    const handleMapAoiEdit = (coords: Array<[number, number]>) => {
        applyAoiFromRing(coords);
    };

    // ESC 로 draw 모드 취소
    useEffect(() => {
        if (activeTool !== 'bbox' && activeTool !== 'polygon') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActiveTool(undefined);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [activeTool]);

    // ── 결과 모드: 점 시계열 ─────────────────────────────────────────────
    const nextPointId = () => {
        const used = new Set(points.map((p) => p.id));
        for (const L of 'ABCDEFGH') if (!used.has(L)) return L;
        return 'Z';
    };
    function addPointAt(lon: number, lat: number) {
        if (points.length >= 8) {
            toast('최대 8개 점까지 선택할 수 있습니다', { tone: 'warning' });
            return;
        }
        const id = nextPointId();
        const seed = Math.floor(Math.abs(lon * lat * 1000));
        const color = POINT_COLORS[points.length % POINT_COLORS.length]!;
        setPoints((prev) => [...prev, { id, lon, lat, color, series: simulateSeries(seed) }]);
        toast(`점 ${id} 추가 — 시계열 계산 중…`, { tone: 'success' });
    }
    function removePoint(id: string) {
        setPoints((prev) => prev.filter((p) => p.id !== id));
        toast(`점 ${id} 제거됨`);
    }
    const clearPoints = () => {
        setPoints([]);
        toast('모든 점 해제됨');
    };
    const exportCsv = () => {
        if (points.length === 0) {
            toast('내보낼 점이 없습니다', { tone: 'warning' });
            return;
        }
        const header = 'date,' + points.map((p) => p.id).join(',') + '\n';
        const rows = TIMESERIES_DATES.map(
            (d, i) => d + ',' + points.map((p) => p.series[i] ?? '').join(','),
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `insar-${product.id}-timeseries.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`${points.length}개 점 시계열 CSV로 내보냄`, { tone: 'success' });
    };

    // ── 요청 모드: 폼 조작/제출 ─────────────────────────────────────────
    const updateRequest = <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => {
        setRequest((f) => ({ ...f, [key]: value }));
    };
    const setRequestType = (t: AnalysisType) => {
        setRequest((f) => {
            const base = { ...f, type: t };
            if (t === 'DInSAR') return { ...base, minScenes: 2, coherenceMin: 0.5 };
            if (t === 'PSInSAR') return { ...base, minScenes: 20, coherenceMin: 0.7 };
            return { ...base, minScenes: 15, coherenceMin: 0.3 };
        });
        // DInSAR 로 전환 시 선택을 2개 초과면 잘라낸다.
        if (t === 'DInSAR') {
            setSelectedSceneIds((prev) => {
                if (prev.size <= 2) return prev;
                const arr = Array.from(prev).slice(0, 2);
                return new Set(arr);
            });
        }
    };
    const toggleRequestLayer = (k: string) => {
        setRequest((f) => {
            const next = new Set(f.layers);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return { ...f, layers: next };
        });
    };
    const validateRequest = (): string | null => {
        if (!request.name.trim()) return '분석 이름을 입력해주세요';
        if (!requestAoi) return 'AOI 좌표를 확인해주세요 (NW 가 SE 보다 북서쪽이어야 합니다)';
        if (!request.s1a && !request.s1c) return '미션을 하나 이상 선택해주세요';
        if (request.layers.size === 0) return '산출 레이어를 하나 이상 선택해주세요';
        const minSel = ANALYSIS_META[request.type].minScenes;
        if (selectedSceneIds.size < minSel) {
            return `${request.type} 는 최소 ${minSel}개 scene 이 필요합니다 (현재 ${selectedSceneIds.size}개)`;
        }
        if (request.type === 'PSInSAR' && (!request.referenceLon || !request.referenceLat)) {
            return 'PSInSAR 는 reference point 가 필요합니다';
        }
        return null;
    };
    const submitRequest = () => {
        const err = validateRequest();
        if (err) {
            toast(err, { tone: 'warning' });
            return;
        }
        setSubmitting(true);
        window.setTimeout(() => {
            setSubmitting(false);
            toast(
                `${request.type} "${request.name}" — ${selectedSceneIds.size}개 scene 으로 요청 접수`,
                { tone: 'success', title: '요청 접수' },
            );
            setSelectedSceneIds(new Set());
            setTab('results');
        }, 700);
    };
    const resetRequest = () => {
        setRequest(buildDefaultRequest());
        setSelectedSceneIds(new Set());
        toast('요청 폼 초기화됨');
    };

    return (
        <div className="col" style={{ flex: 1, minHeight: 0 }}>
            <PageHeader breadcrumb={['홈', 'InSAR 분석']} />
            <div className="split" style={{ flex: 1 }}>
                <aside
                    className="split__side split__side--left"
                    style={{ width: 320, display: 'flex', flexDirection: 'column' }}
                >
                    <SidebarTabs tab={tab} onChange={setTab} />
                    {tab === 'request' ? (
                        <RequestSidebar
                            form={request}
                            onChangeField={updateRequest}
                            onChangeType={setRequestType}
                            onToggleLayer={toggleRequestLayer}
                            selectedCount={selectedSceneIds.size}
                            availableCount={availableScenes.length}
                            submitting={submitting}
                            onSubmit={submitRequest}
                            onReset={resetRequest}
                            dinsarOverlap={dinsarOverlap}
                        />
                    ) : (
                        <ResultsSidebar
                            products={filteredProducts}
                            allCount={PRODUCTS.length}
                            typeFilter={typeFilter}
                            onTypeFilter={setTypeFilter}
                            selected={selected}
                            onSelect={setSelected}
                            layer={layer}
                            onLayerChange={setLayer}
                            colormap={colormap}
                            onColormapChange={setColormap}
                            opacity={opacity}
                            onOpacityChange={setOpacity}
                            rangeMin={rangeMin}
                            rangeMax={rangeMax}
                            onRangeMinChange={setRangeMin}
                            onRangeMaxChange={setRangeMax}
                            currentProduct={product}
                            onShowScenes={() => setShowScenes(true)}
                            onDownload={() =>
                                toast(`${product.name} 다운로드 시작`, { tone: 'success' })
                            }
                            points={points}
                            onClearPoints={clearPoints}
                            onRemovePoint={removePoint}
                        />
                    )}
                </aside>

                <div className="split__main">
                    <div style={{ flex: 1, position: 'relative', minHeight: 200 }}>
                        <MapCanvas
                            center={initialCenter}
                            zoom={10}
                            aoi={mapAoi}
                            footprints={mapFootprints}
                            points={mapPointsList}
                            onMapClick={mapOnClick}
                            showLegend={tab === 'results'}
                            legend="velocity"
                            tools={tab === 'request' ? ['bbox'] : []}
                            activeTool={tab === 'request' ? activeTool : undefined}
                            onToolSelect={tab === 'request' ? setActiveTool : undefined}
                            onDrawEnd={tab === 'request' ? handleMapDrawEnd : undefined}
                            onAoiChange={tab === 'request' ? handleMapAoiEdit : undefined}
                        >
                            {tab === 'request' ? (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 56,
                                        padding: '6px 10px',
                                        background: 'var(--bg-2)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        boxShadow: 'var(--shadow-md)',
                                        pointerEvents: 'none',
                                        zIndex: 3,
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 4,
                                        lineHeight: 1.3,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: 18,
                                                height: 0,
                                                borderTop: '1.5px dashed #818cf8',
                                            }}
                                        />
                                        <span>AOI 영역</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: 18,
                                                height: 0,
                                                borderTop: '1.5px solid #10b981',
                                            }}
                                        />
                                        <span>공통 커버리지</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                width: 18,
                                                height: 0,
                                                borderTop: '1.5px solid #22d3ee',
                                            }}
                                        />
                                        <span>선택/hover scene</span>
                                    </div>
                                </div>
                            ) : (
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
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <Icon name="mapPin" size={11} style={{ marginRight: 6, opacity: 0.6 }} />
                                    {layer} · {opacity}% · 지도 클릭 → 시계열 점 추가
                                </div>
                            )}
                            {tab === 'request' && activeTool === 'bbox' ? (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        padding: '8px 14px',
                                        background: 'var(--accent)',
                                        color: '#fff',
                                        borderRadius: 6,
                                        fontSize: 12.5,
                                        fontWeight: 500,
                                        boxShadow: 'var(--shadow-md)',
                                        zIndex: 5,
                                        pointerEvents: 'none',
                                    }}
                                >
                                    지도에서 드래그해 사각형 AOI 를 그리세요 · ESC 로 취소
                                </div>
                            ) : null}
                        </MapCanvas>
                        {/* scene 가져오기 로딩 오버레이 — 검색 페이지와 동일 패턴, request 탭에서만. */}
                        <div
                            aria-live="polite"
                            aria-hidden={!(tab === 'request' && fetchingScenes)}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(15, 18, 22, 0.45)',
                                backdropFilter:
                                    tab === 'request' && fetchingScenes ? 'blur(2px)' : 'blur(0px)',
                                zIndex: 10,
                                opacity: tab === 'request' && fetchingScenes ? 1 : 0,
                                pointerEvents: tab === 'request' && fetchingScenes ? 'all' : 'none',
                                transition: 'opacity 220ms ease, backdrop-filter 220ms ease',
                            }}
                        >
                            <div
                                className="row gap-2"
                                style={{
                                    background: 'var(--bg-2)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 6,
                                    padding: '10px 16px',
                                    fontSize: 13,
                                    boxShadow: 'var(--shadow-md)',
                                    alignItems: 'center',
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        display: 'inline-block',
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        border: '2px solid var(--accent)',
                                        borderTopColor: 'transparent',
                                        animation: 'spin 0.8s linear infinite',
                                    }}
                                />
                                <span>사용 가능한 scene 가져오는 중…</span>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            // request 모드는 타임라인 콘텐츠에 딱 맞춰 높이가 결정되도록
                            // height 를 auto 로 두고, results 모드만 차트 공간을 위해 260px 고정.
                            ...(tab === 'request' ? {} : { height: 260 }),
                            flexShrink: 0,
                            borderTop: '1px solid var(--border-subtle)',
                            background: 'var(--bg-2)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {tab === 'request' ? (
                            <RequestTimelinePanel
                                scenes={availableScenes}
                                selected={selectedSceneIds}
                                onToggle={toggleSceneSelection}
                                onClear={clearSelectedScenes}
                                onSelectAll={selectAllScenes}
                                analysisType={request.type}
                                rangeStart={request.startDate}
                                rangeEnd={request.endDate}
                                onRangeChange={(s, e) =>
                                    setRequest((f) => ({ ...f, startDate: s, endDate: e }))
                                }
                                hoveredId={hoveredSceneId}
                                onHover={setHoveredSceneId}
                            />
                        ) : (
                            <ResultsBottomPanel
                                points={points}
                                onExport={exportCsv}
                            />
                        )}
                    </div>
                </div>
            </div>
            {showScenes && tab === 'results' ? (
                <ScenesModal product={product} onClose={() => setShowScenes(false)} />
            ) : null}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 사이드바 탭
// ────────────────────────────────────────────────────────────────────────────

function SidebarTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
    const items: [Tab, string][] = [
        ['request', '분석 요청'],
        ['results', '결과'],
    ];
    return (
        <div
            className="row"
            style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-1)',
                padding: '0 12px',
                gap: 4,
                flexShrink: 0,
            }}
        >
            {items.map(([k, label]) => {
                const active = tab === k;
                return (
                    <button
                        key={k}
                        type="button"
                        onClick={() => onChange(k)}
                        style={{
                            flex: 1,
                            padding: '12px 8px',
                            background: 'none',
                            border: 0,
                            borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            fontWeight: active ? 600 : 500,
                            fontSize: 13,
                            cursor: 'pointer',
                            marginBottom: -1,
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 분석 요청 — 사이드바 (폼)
// ────────────────────────────────────────────────────────────────────────────

interface RequestSidebarProps {
    form: RequestForm;
    onChangeField: <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => void;
    onChangeType: (t: AnalysisType) => void;
    onToggleLayer: (k: string) => void;
    selectedCount: number;
    availableCount: number;
    submitting: boolean;
    onSubmit: () => void;
    onReset: () => void;
    dinsarOverlap: number | null;
}

function RequestSidebar({
    form,
    onChangeField,
    onChangeType,
    onToggleLayer,
    selectedCount,
    availableCount,
    submitting,
    onSubmit,
    onReset,
    dinsarOverlap,
}: RequestSidebarProps) {
    const minSel = ANALYSIS_META[form.type].minScenes;
    const ready = selectedCount >= minSel;
    return (
        <>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Section title="분석 유형">
                    <div className="col gap-2">
                        {(Object.keys(ANALYSIS_META) as AnalysisType[]).map((t) => {
                            const meta = ANALYSIS_META[t];
                            const active = form.type === t;
                            return (
                                <div
                                    key={t}
                                    onClick={() => onChangeType(t)}
                                    style={{
                                        padding: '10px 12px',
                                        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-default)'}`,
                                        borderRadius: 6,
                                        background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                                        <span
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                border: `3px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                                                background: active ? '#fff' : 'transparent',
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                                            {meta.label}
                                        </span>
                                        <span className={`badge ${typeBadge(t)}`} style={{ fontSize: 10 }}>
                                            {t}
                                        </span>
                                    </div>
                                    <div className="faint" style={{ fontSize: 11, lineHeight: 1.4, marginTop: 4 }}>
                                        {meta.sub}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 6,
                                            fontSize: 10.5,
                                            color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <Icon name="square" size={9} style={{ opacity: 0.7 }} />
                                        필요 {meta.sceneRequirement}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>

                <Section title="분석 이름">
                    <input
                        className="input"
                        value={form.name}
                        placeholder="예: Pohang subsidence 2026Q1"
                        onChange={(e) => onChangeField('name', e.target.value)}
                        style={{ width: '100%' }}
                    />
                </Section>

                <Section title="AOI (관심 영역)" hint="WGS84 위경도. 향후 지도 그리기/지번 검색 지원 예정.">
                    <div className="col gap-2">
                        <div className="row gap-2">
                            <LabeledInput
                                label="NW lat"
                                value={form.nwLat}
                                onChange={(v) => onChangeField('nwLat', v)}
                            />
                            <LabeledInput
                                label="NW lon"
                                value={form.nwLon}
                                onChange={(v) => onChangeField('nwLon', v)}
                            />
                        </div>
                        <div className="row gap-2">
                            <LabeledInput
                                label="SE lat"
                                value={form.seLat}
                                onChange={(v) => onChangeField('seLat', v)}
                            />
                            <LabeledInput
                                label="SE lon"
                                value={form.seLon}
                                onChange={(v) => onChangeField('seLon', v)}
                            />
                        </div>
                    </div>
                </Section>

                <Section title="기간">
                    <DateRangePicker
                        start={form.startDate}
                        end={form.endDate}
                        maxDate={new Date()}
                        onChange={(s, e) => {
                            onChangeField('startDate', s);
                            onChangeField('endDate', e);
                        }}
                    />
                </Section>

                <Section title="미션">
                    <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                        <span
                            className={`chip${form.s1a ? ' chip--active' : ''}`}
                            onClick={() => onChangeField('s1a', !form.s1a)}
                        >
                            Sentinel-1A
                        </span>
                        <span
                            className={`chip${form.s1c ? ' chip--active' : ''}`}
                            onClick={() => onChangeField('s1c', !form.s1c)}
                        >
                            Sentinel-1C
                        </span>
                    </div>
                </Section>

                <Section title="편광">
                    <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                        {['VV', 'VH', 'HH', 'HV', 'VV+VH'].map((p) => (
                            <span
                                key={p}
                                className={`chip${form.polarization === p ? ' chip--active' : ''}`}
                                onClick={() => onChangeField('polarization', p)}
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                </Section>

                {form.type === 'DInSAR' ? (
                    <Section title="DInSAR 파라미터">
                        <div className="col gap-3">
                            <NumberField
                                label="최소 코히어런스"
                                value={form.coherenceMin}
                                step={0.05}
                                min={0}
                                max={1}
                                onChange={(v) => onChangeField('coherenceMin', v)}
                                hint="0–1, 0.5 권장"
                            />
                            <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                                Master/Slave 쌍은 아래 타임라인에서 직접 두 scene 을 선택하세요.
                            </div>
                        </div>
                    </Section>
                ) : null}

                {form.type === 'PSInSAR' ? (
                    <Section title="PSInSAR 파라미터">
                        <div className="col gap-3">
                            <NumberField
                                label="최소 scene 수"
                                value={form.minScenes}
                                step={1}
                                min={5}
                                onChange={(v) => onChangeField('minScenes', v)}
                                hint="20개 이상 권장"
                            />
                            <NumberField
                                label="PS 코히어런스 임계값"
                                value={form.coherenceMin}
                                step={0.05}
                                min={0}
                                max={1}
                                onChange={(v) => onChangeField('coherenceMin', v)}
                                hint="0.7 권장"
                            />
                            <div className="row gap-2">
                                <LabeledInput
                                    label="reference lat"
                                    value={form.referenceLat}
                                    onChange={(v) => onChangeField('referenceLat', v)}
                                />
                                <LabeledInput
                                    label="reference lon"
                                    value={form.referenceLon}
                                    onChange={(v) => onChangeField('referenceLon', v)}
                                />
                            </div>
                            <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                                Reference point 는 변위 0 으로 가정하는 안정 지반 좌표입니다.
                            </div>
                        </div>
                    </Section>
                ) : null}

                {form.type === 'SBAS' ? (
                    <Section title="SBAS 파라미터">
                        <div className="col gap-3">
                            <NumberField
                                label="최대 시간 베이스라인 (일)"
                                value={form.temporalBaselineMaxDays}
                                step={6}
                                min={6}
                                onChange={(v) => onChangeField('temporalBaselineMaxDays', v)}
                                hint="60일 권장"
                            />
                            <NumberField
                                label="최대 공간 베이스라인 (m)"
                                value={form.spatialBaselineMaxM}
                                step={50}
                                min={50}
                                onChange={(v) => onChangeField('spatialBaselineMaxM', v)}
                                hint="200m 권장"
                            />
                            <NumberField
                                label="최소 코히어런스"
                                value={form.coherenceMin}
                                step={0.05}
                                min={0}
                                max={1}
                                onChange={(v) => onChangeField('coherenceMin', v)}
                                hint="0.3 권장"
                            />
                        </div>
                    </Section>
                ) : null}

                <Section title="산출 레이어">
                    <div className="col gap-2">
                        {(
                            [
                                ['mean_velocity', 'mean_velocity', 'mm/yr'],
                                ['coherence', 'coherence', '0–1'],
                                ['cumulative_disp', 'cumulative_disp', 'mm'],
                                ['wrapped_phase', 'wrapped_phase', 'rad'],
                            ] as const
                        ).map(([k, label, unit]) => {
                            const on = form.layers.has(k);
                            return (
                                <label
                                    key={k}
                                    className="row gap-2"
                                    style={{ cursor: 'pointer', alignItems: 'center' }}
                                >
                                    <input
                                        type="checkbox"
                                        className="checkbox"
                                        checked={on}
                                        onChange={() => onToggleLayer(k)}
                                    />
                                    <span className="mono" style={{ fontSize: 12, fontWeight: on ? 600 : 400 }}>
                                        {label}
                                    </span>
                                    <span className="faint" style={{ fontSize: 11, marginLeft: 'auto' }}>
                                        {unit}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </Section>

                <Section title="우선순위">
                    <div className="row gap-1">
                        <span
                            className={`chip${form.priority === 'normal' ? ' chip--active' : ''}`}
                            onClick={() => onChangeField('priority', 'normal')}
                        >
                            보통
                        </span>
                        <span
                            className={`chip${form.priority === 'urgent' ? ' chip--active' : ''}`}
                            onClick={() => onChangeField('priority', 'urgent')}
                        >
                            긴급
                        </span>
                        <InfoTip text="긴급은 워커 큐에서 우선 배치되지만, 처리 시간을 보장하지는 않습니다." />
                    </div>
                </Section>
            </div>

            <div
                style={{
                    flexShrink: 0,
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-1)',
                    padding: 12,
                }}
            >
                <div
                    className="between"
                    style={{ marginBottom: 8, fontSize: 11.5 }}
                >
                    <span className="faint">
                        scene 선택 <span className="mono tabular" style={{ color: ready ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {selectedCount}/{minSel}
                        </span>
                    </span>
                    <span className="faint mono tabular">사용 가능 {availableCount}</span>
                </div>
                {dinsarOverlap !== null ? (
                    (() => {
                        const pct = Math.round(dinsarOverlap);
                        const tone =
                            pct >= 80
                                ? { color: 'var(--success)', label: '안정' }
                                : pct >= 70
                                  ? { color: 'var(--warning)', label: '권장 하한' }
                                  : { color: 'var(--danger)', label: '낮음' };
                        return (
                            <div
                                className="between"
                                style={{
                                    marginBottom: 8,
                                    padding: '6px 8px',
                                    fontSize: 11.5,
                                    background: 'var(--bg-2)',
                                    border: `1px solid ${tone.color}`,
                                    borderRadius: 4,
                                    alignItems: 'center',
                                }}
                            >
                                <span className="row gap-2" style={{ alignItems: 'center' }}>
                                    <span className="faint">master/slave 겹침</span>
                                    <span
                                        className="mono tabular"
                                        style={{ color: tone.color, fontWeight: 600 }}
                                    >
                                        {pct}%
                                    </span>
                                    <span style={{ color: tone.color, fontSize: 10.5 }}>
                                        · {tone.label}
                                    </span>
                                </span>
                                <InfoTip text="DInSAR 권장 겹침: ≥80% 안정 / 70~80% 권장 하한 / <70% 분석 가용 면적이 좁음. 정보용이며 제출은 가능합니다." />
                            </div>
                        );
                    })()
                ) : null}
                <div className="row gap-2">
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={onReset}
                        disabled={submitting}
                    >
                        <Icon name="refresh" size={12} />
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary"
                        style={{ flex: 1 }}
                        onClick={onSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span
                                    aria-hidden
                                    style={{
                                        display: 'inline-block',
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        border: '2px solid currentColor',
                                        borderTopColor: 'transparent',
                                        animation: 'spin 0.8s linear infinite',
                                        marginRight: 6,
                                        verticalAlign: '-2px',
                                    }}
                                />
                                요청 접수 중…
                            </>
                        ) : (
                            <>
                                <Icon name="plus" size={13} /> 분석 요청
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 결과 — 사이드바
// ────────────────────────────────────────────────────────────────────────────

interface ResultsSidebarProps {
    products: InsarProduct[];
    allCount: number;
    typeFilter: '전체' | InsarProduct['type'];
    onTypeFilter: (t: '전체' | InsarProduct['type']) => void;
    selected: string;
    onSelect: (id: string) => void;
    layer: Layer;
    onLayerChange: (l: Layer) => void;
    colormap: Colormap;
    onColormapChange: (c: Colormap) => void;
    opacity: number;
    onOpacityChange: (n: number) => void;
    rangeMin: number;
    rangeMax: number;
    onRangeMinChange: (n: number) => void;
    onRangeMaxChange: (n: number) => void;
    currentProduct: InsarProduct;
    onShowScenes: () => void;
    onDownload: () => void;
    points: Point[];
    onClearPoints: () => void;
    onRemovePoint: (id: string) => void;
}

function ResultsSidebar({
    products,
    allCount,
    typeFilter,
    onTypeFilter,
    selected,
    onSelect,
    layer,
    onLayerChange,
    colormap,
    onColormapChange,
    opacity,
    onOpacityChange,
    rangeMin,
    rangeMax,
    onRangeMinChange,
    onRangeMaxChange,
    currentProduct,
    onShowScenes,
    onDownload,
    points,
    onClearPoints,
    onRemovePoint,
}: ResultsSidebarProps) {
    return (
        <>
            <div className="toolbar" style={{ borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                    {(['전체', 'DInSAR', 'SBAS', 'PSInSAR'] as const).map((t) => (
                        <span
                            key={t}
                            className={`chip${typeFilter === t ? ' chip--active' : ''}`}
                            onClick={() => onTypeFilter(t)}
                        >
                            {t}
                        </span>
                    ))}
                    <span className="faint mono tabular" style={{ fontSize: 11, marginLeft: 'auto' }}>
                        {products.length}/{allCount}
                    </span>
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {products.length === 0 ? (
                        <div className="empty" style={{ padding: 32, fontSize: 12 }}>
                            해당 타입의 산출물이 없습니다
                        </div>
                    ) : (
                        products.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => onSelect(p.id)}
                                style={{
                                    padding: '12px 14px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: selected === p.id ? 'var(--accent-soft)' : undefined,
                                    borderLeft:
                                        selected === p.id
                                            ? '3px solid var(--accent)'
                                            : '3px solid transparent',
                                    cursor: 'pointer',
                                }}
                            >
                                <div className="between">
                                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}</div>
                                    <span className={`badge ${typeBadge(p.type)}`} style={{ fontSize: 10 }}>
                                        {p.type}
                                    </span>
                                </div>
                                <div className="mono tabular faint" style={{ fontSize: 11, marginTop: 3 }}>
                                    {p.range}
                                </div>
                                <div className="row gap-2" style={{ marginTop: 5, fontSize: 11 }}>
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

                <Section title="레이어">
                    <div className="col gap-1">
                        {(Object.entries(LAYER_META) as [Layer, { unit: string; label: string }][]).map(
                            ([k, meta]) => {
                                const on = layer === k;
                                return (
                                    <div
                                        key={k}
                                        onClick={() => onLayerChange(k)}
                                        className="between"
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: 5,
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
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: 50,
                                                    background: on
                                                        ? 'var(--accent)'
                                                        : 'var(--text-tertiary)',
                                                }}
                                            />
                                            <span
                                                className="mono"
                                                style={{ fontSize: 11.5, fontWeight: on ? 600 : 400 }}
                                            >
                                                {k}
                                            </span>
                                        </span>
                                        <span className="faint" style={{ fontSize: 10.5 }}>
                                            {meta.unit}
                                        </span>
                                    </div>
                                );
                            },
                        )}
                    </div>
                </Section>

                <Section title="컬러맵">
                    <div className="segmented" style={{ display: 'flex', width: '100%' }}>
                        {(['RdBu', 'viridis', 'magma'] as const).map((cm) => (
                            <button
                                key={cm}
                                type="button"
                                className={colormap === cm ? 'active' : ''}
                                style={{ flex: 1 }}
                                onClick={() => onColormapChange(cm)}
                            >
                                {cm}
                            </button>
                        ))}
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            height: 12,
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
                </Section>

                <Section title={`범위 (${LAYER_META[layer].unit})`}>
                    <div className="input-group">
                        <input
                            className="input mono tabular"
                            type="number"
                            value={rangeMin}
                            onChange={(e) => onRangeMinChange(+e.target.value)}
                        />
                        <input
                            className="input mono tabular"
                            type="number"
                            value={rangeMax}
                            onChange={(e) => onRangeMaxChange(+e.target.value)}
                        />
                    </div>
                </Section>

                <Section
                    title={`투명도 — ${opacity}%`}
                >
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={opacity}
                        onChange={(e) => onOpacityChange(+e.target.value)}
                        style={{ width: '100%', accentColor: 'var(--accent)' }}
                    />
                </Section>

                <Section title={`선택된 점 (${points.length}/8)`}>
                    {points.length === 0 ? (
                        <div className="faint" style={{ fontSize: 11.5 }}>
                            지도 클릭하여 시계열 점 추가
                        </div>
                    ) : (
                        <div className="col gap-2">
                            {points.map((p) => (
                                <div
                                    key={p.id}
                                    className="row gap-2"
                                    style={{ padding: '5px 7px', borderRadius: 4, background: 'var(--bg-3)' }}
                                >
                                    <span
                                        style={{
                                            width: 13,
                                            height: 13,
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
                                        onClick={() => onRemovePoint(p.id)}
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                style={{ alignSelf: 'flex-start' }}
                                onClick={onClearPoints}
                            >
                                전체 해제
                            </button>
                        </div>
                    )}
                </Section>
            </div>

            <div
                style={{
                    flexShrink: 0,
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-1)',
                    padding: 12,
                }}
            >
                <div className="mono faint" style={{ fontSize: 11, marginBottom: 8, lineHeight: 1.45 }}>
                    {currentProduct.name} · {currentProduct.scenes} scenes · LOS inc=39.2°
                </div>
                <div className="row gap-2">
                    <button
                        type="button"
                        className="btn btn--sm"
                        onClick={onShowScenes}
                        style={{ flex: 1 }}
                    >
                        원본 scene
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={onDownload}
                        style={{ flex: 1 }}
                    >
                        <Icon name="download" size={13} /> 다운로드
                    </button>
                </div>
            </div>
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 분석 요청 — 하단 scene 타임라인
// ────────────────────────────────────────────────────────────────────────────

interface RequestTimelineProps {
    scenes: AvailableScene[];
    selected: Set<string>;
    onToggle: (id: string) => void;
    onClear: () => void;
    onSelectAll: () => void;
    analysisType: AnalysisType;
    rangeStart: Date;
    rangeEnd: Date;
    onRangeChange: (start: Date, end: Date) => void;
    hoveredId: string | null;
    onHover: (id: string | null) => void;
}

function RequestTimelinePanel({
    scenes,
    selected,
    onToggle,
    onClear,
    onSelectAll,
    analysisType,
    rangeStart,
    rangeEnd,
    onRangeChange,
    hoveredId,
    onHover,
}: RequestTimelineProps) {
    const minScenes = ANALYSIS_META[analysisType].minScenes;
    const ready = selected.size >= minScenes;
    const requirement = ANALYSIS_META[analysisType].sceneRequirement;

    return (
        <>
            <div
                className="between"
                style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}
            >
                <div className="row gap-3" style={{ alignItems: 'center' }}>
                    <Icon name="chart" size={14} />
                    <span style={{ fontWeight: 600 }}>사용 가능한 scene 타임라인</span>
                    <span className="faint" style={{ fontSize: 12 }}>
                        {scenes.length}개 사용 가능
                    </span>
                    <span
                        className="badge"
                        style={{
                            background: ready
                                ? 'color-mix(in srgb, var(--success) 18%, transparent)'
                                : 'var(--bg-3)',
                            color: ready ? 'var(--success)' : 'var(--text-secondary)',
                        }}
                    >
                        {selected.size}/{minScenes} 선택
                    </span>
                </div>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <span className={`badge ${typeBadge(analysisType)}`} style={{ fontSize: 10 }}>
                        {analysisType}
                    </span>
                    <span className="faint" style={{ fontSize: 11 }}>
                        필요 {requirement}
                    </span>
                    <span
                        className="faint"
                        style={{ fontSize: 10.5, paddingLeft: 8, borderLeft: '1px solid var(--border-subtle)' }}
                    >
                        휠로 줌 · Shift+휠로 이동 · 드래그로 이동
                    </span>
                    {/* 빠른 선택 — 가용 scene 이 있고 아직 모두 선택되지 않은 경우 노출 */}
                    {scenes.length > 0 &&
                    !(
                        analysisType === 'DInSAR'
                            ? selected.size === 2 && scenes.length >= 2
                            : selected.size >= scenes.length
                    ) ? (
                        <button
                            type="button"
                            className="btn btn--sm"
                            style={{ height: 22, padding: '0 8px', fontSize: 11 }}
                            onClick={onSelectAll}
                            title={
                                analysisType === 'DInSAR'
                                    ? '첫/마지막 scene 으로 master/slave 페어 자동 선택 (최대 시간 베이스라인)'
                                    : '가용 scene 모두 선택'
                            }
                        >
                            <Icon name="plus" size={11} />{' '}
                            {analysisType === 'DInSAR'
                                ? '첫/마지막 페어'
                                : `전체 (${scenes.length})`}
                        </button>
                    ) : null}
                    {selected.size > 0 ? (
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            style={{ height: 22, padding: '0 8px', fontSize: 11 }}
                            onClick={onClear}
                        >
                            전체 해제
                        </button>
                    ) : null}
                </div>
            </div>

            {scenes.length === 0 ? (
                <div
                    className="empty"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                        fontSize: 12,
                        minHeight: 80,
                    }}
                >
                    AOI · 기간 · 미션 조건을 확인해주세요 — 사용 가능한 scene 이 없습니다
                </div>
            ) : (
                <SceneTimelineGraph
                    scenes={scenes}
                    selected={selected}
                    onToggle={onToggle}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onRangeChange={onRangeChange}
                    hoveredId={hoveredId}
                    onHover={onHover}
                />
            )}
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// edsc/timeline 스타일 — 두 줄 시간축 (year/month band) + 미션별 lane,
// 드래그로 pan, +/- 로 zoom. NASA Earthdata Search 의 timeline 과 유사.
// ────────────────────────────────────────────────────────────────────────────

const MISSION_COLOR: Record<'S1A' | 'S1C', string> = {
    S1A: '#22d3ee',
    S1C: '#a855f7',
};

const MONTH_ABBR_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

/** 줌 단계별 화면에 보이는 시간 범위(일). 1=가장 넓음(10년), 5=가장 좁음(1개월). */
const ZOOM_DAYS: Record<number, number> = {
    1: 365 * 10,
    2: 365 * 3,
    3: 365,
    4: 90,
    5: 30,
};

interface SceneTimelineGraphProps {
    scenes: AvailableScene[];
    selected: Set<string>;
    onToggle: (id: string) => void;
    /** 현재 사이드바의 기간 — 핸들 표시 + drag 시 이 값을 갱신. */
    rangeStart: Date;
    rangeEnd: Date;
    onRangeChange: (start: Date, end: Date) => void;
    hoveredId: string | null;
    onHover: (id: string | null) => void;
}

function SceneTimelineGraph({
    scenes,
    selected,
    onToggle,
    rangeStart,
    rangeEnd,
    onRangeChange,
    hoveredId,
    onHover,
}: SceneTimelineGraphProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [containerW, setContainerW] = useState(900);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        setContainerW(el.clientWidth);
        const ro = new ResizeObserver((entries) => {
            const e = entries[0];
            if (e) setContainerW(e.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const day = 24 * 60 * 60 * 1000;

    const sceneTimes = useMemo(
        () => scenes.map((s) => new Date(s.isoDate).getTime()),
        [scenes],
    );
    const minSceneT = sceneTimes.length ? Math.min(...sceneTimes) : Date.now();
    const maxSceneT = sceneTimes.length ? Math.max(...sceneTimes) : Date.now();

    // scene 범위에 따른 초기 zoom 단계
    const initialZoom = useMemo(() => {
        const targetSpan = (maxSceneT - minSceneT) * 1.2;
        if (targetSpan <= 30 * day) return 5;
        if (targetSpan <= 90 * day) return 4;
        if (targetSpan <= 365 * day) return 3;
        if (targetSpan <= 365 * 3 * day) return 2;
        return 1;
    }, [minSceneT, maxSceneT, day]);

    const [zoom, setZoom] = useState(initialZoom);
    const [centerMs, setCenterMs] = useState((minSceneT + maxSceneT) / 2);

    // 첫 scene 데이터가 들어오는 그 1회만 자동 fit. 이후엔 range 핸들/pan 결과를 보존.
    const didFitRef = useRef(false);
    useEffect(() => {
        if (scenes.length === 0) {
            didFitRef.current = false;
            return;
        }
        if (didFitRef.current) return;
        setCenterMs((minSceneT + maxSceneT) / 2);
        setZoom(initialZoom);
        didFitRef.current = true;
    }, [scenes.length, minSceneT, maxSceneT, initialZoom]);

    const spanMs = ZOOM_DAYS[zoom]! * day;
    const startMs = centerMs - spanMs / 2;
    const endMs = centerMs + spanMs / 2;

    // 레이아웃
    const PAD_LEFT = 64;
    const PAD_RIGHT = 16;
    const YEAR_H = 22;
    const MONTH_H = 18;
    const HEADER_H = YEAR_H + MONTH_H;
    const LANE_H = 30;

    const missions = useMemo(() => {
        const set = new Set<'S1A' | 'S1C'>();
        scenes.forEach((s) => set.add(s.mission));
        const out: ('S1A' | 'S1C')[] = [];
        if (set.has('S1A')) out.push('S1A');
        if (set.has('S1C')) out.push('S1C');
        return out;
    }, [scenes]);

    const lanesH = Math.max(missions.length, 1) * LANE_H;
    const totalH = HEADER_H + lanesH;
    const innerW = Math.max(containerW - PAD_LEFT - PAD_RIGHT, 200);

    const xFor = (t: number) => PAD_LEFT + ((t - startMs) / spanMs) * innerW;

    // 연(年) cell — 화면에 걸친 year 들 전체
    const yearCells = useMemo(() => {
        const out: { year: number; x1: number; x2: number }[] = [];
        const startYear = new Date(startMs).getFullYear();
        const endYear = new Date(endMs).getFullYear();
        for (let y = startYear; y <= endYear; y++) {
            const yStart = new Date(y, 0, 1).getTime();
            const yEnd = new Date(y + 1, 0, 1).getTime();
            out.push({ year: y, x1: xFor(yStart), x2: xFor(yEnd) });
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startMs, endMs, innerW]);

    // 월 cell — zoom 3 이상에서만 의미 있음. 그 이하는 비워둔다.
    const monthCells = useMemo(() => {
        if (zoom < 3) return [];
        const out: { x1: number; x2: number; month: number; year: number }[] = [];
        const cursor = new Date(startMs);
        cursor.setDate(1);
        cursor.setHours(0, 0, 0, 0);
        cursor.setMonth(cursor.getMonth() - 1); // safety pad
        const last = new Date(endMs);
        last.setMonth(last.getMonth() + 1);
        while (cursor.getTime() <= last.getTime()) {
            const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getTime();
            const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime();
            out.push({
                x1: xFor(mStart),
                x2: xFor(mEnd),
                month: cursor.getMonth(),
                year: cursor.getFullYear(),
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startMs, endMs, innerW, zoom]);

    // 드래그 pan / range 핸들 drag
    const dragRef = useRef<{ x: number; center: number } | null>(null);
    const draggedRef = useRef(false);
    const [grabbing, setGrabbing] = useState(false);
    const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

    /** 화면 X 좌표 → timestamp 로 환산. SVG 의 boundingRect 필요. */
    const xToTime = (clientX: number, svgEl: SVGSVGElement): number => {
        const rect = svgEl.getBoundingClientRect();
        const x = clientX - rect.left;
        return startMs + ((x - PAD_LEFT) / innerW) * spanMs;
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (draggingHandle) return;
        dragRef.current = { x: e.clientX, center: centerMs };
        draggedRef.current = false;
        setGrabbing(true);
    };
    const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        // range 핸들 drag 가 활성이면 그쪽이 우선.
        if (draggingHandle) {
            const t = xToTime(e.clientX, e.currentTarget);
            const minSpan = 6 * day;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayMs = today.getTime();
            if (draggingHandle === 'start') {
                const maxStart = rangeEnd.getTime() - minSpan;
                const snapped = startOfDay(Math.min(t, maxStart));
                if (snapped !== rangeStart.getTime()) {
                    onRangeChange(new Date(snapped), rangeEnd);
                }
            } else {
                const minEnd = rangeStart.getTime() + minSpan;
                const clampedToToday = Math.min(t, todayMs);
                const snapped = startOfDay(Math.max(clampedToToday, minEnd));
                if (snapped !== rangeEnd.getTime()) {
                    onRangeChange(rangeStart, new Date(snapped));
                }
            }
            return;
        }
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 3) draggedRef.current = true;
        const msPerPx = spanMs / innerW;
        setCenterMs(d.center - dx * msPerPx);
    };
    const endDrag = () => {
        if (draggingHandle) setDraggingHandle(null);
        dragRef.current = null;
        setGrabbing(false);
        // 다음 click 까지 draggedRef 유지 → 0ms 후 리셋
        window.setTimeout(() => {
            draggedRef.current = false;
        }, 0);
    };

    const onHandleMouseDown = (which: 'start' | 'end') =>
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setDraggingHandle(which);
            draggedRef.current = true; // 이 직후 click 으로 scene 토글되는 것을 막기 위함
        };

    // React 의 onWheel 은 passive 라 preventDefault 가 무시되므로 네이티브 리스너로 부착해
    // 페이지 스크롤이 새지 않게 한다. Shift + 휠 → 가로 pan, 그 외엔 줌 (deltaY 기준).
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onNativeWheel = (e: WheelEvent) => {
            if (e.shiftKey) {
                const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
                if (dx === 0) return;
                e.preventDefault();
                const msPerPx = spanMs / innerW;
                setCenterMs((c) => c + dx * msPerPx);
            } else {
                if (e.deltaY === 0) return;
                e.preventDefault();
                setZoom((z) => Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 1 : -1))));
            }
        };
        el.addEventListener('wheel', onNativeWheel, { passive: false });
        return () => el.removeEventListener('wheel', onNativeWheel);
    }, [spanMs, innerW]);

    const handleSceneClick = (s: AvailableScene) => {
        if (draggedRef.current) return;
        onToggle(s.id);
    };

    const selectedOrder = useMemo(() => {
        const m = new Map<string, number>();
        Array.from(selected).forEach((id, i) => m.set(id, i + 1));
        return m;
    }, [selected]);

    return (
        <div
            ref={containerRef}
            style={{
                // height 를 콘텐츠(SVG 의 totalH)에 정확히 맞춰서 lane 수가 늘어날 때만 패널이 커지도록.
                height: totalH,
                flexShrink: 0,
                position: 'relative',
                background: 'var(--bg-2)',
                overflow: 'hidden',
            }}
        >
            <svg
                ref={svgRef}
                width={containerW}
                height={totalH}
                style={{
                    display: 'block',
                    cursor: grabbing ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
            >
                <defs>
                    <clipPath id="edsc-track-clip">
                        <rect x={PAD_LEFT} y={0} width={innerW} height={totalH} />
                    </clipPath>
                </defs>

                {/* 좌측 라벨 거터 */}
                <rect x={0} y={0} width={PAD_LEFT} height={totalH} fill="var(--bg-1)" />

                {/* 클립된 메인 트랙 */}
                <g clipPath="url(#edsc-track-clip)">
                    {/* 연(year) band */}
                    {yearCells.map((c) => {
                        const cw = c.x2 - c.x1;
                        const cx = (Math.max(c.x1, PAD_LEFT) + Math.min(c.x2, PAD_LEFT + innerW)) / 2;
                        return (
                            <g key={`y-${c.year}`}>
                                <rect
                                    x={c.x1}
                                    y={0}
                                    width={cw}
                                    height={YEAR_H}
                                    fill={c.year % 2 === 0 ? 'var(--bg-3)' : 'var(--bg-1)'}
                                    stroke="var(--border-default)"
                                    strokeWidth={0.5}
                                />
                                {cw >= 36 ? (
                                    <text
                                        x={cx}
                                        y={YEAR_H / 2 + 4}
                                        fontSize={11}
                                        fontWeight={700}
                                        fill="var(--text-secondary)"
                                        textAnchor="middle"
                                        fontFamily="var(--font-mono)"
                                    >
                                        {c.year}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}

                    {/* 월(month) band */}
                    {monthCells.map((c, i) => {
                        const cw = c.x2 - c.x1;
                        const cx = (c.x1 + c.x2) / 2;
                        return (
                            <g key={`m-${i}`}>
                                <rect
                                    x={c.x1}
                                    y={YEAR_H}
                                    width={cw}
                                    height={MONTH_H}
                                    fill="var(--bg-2)"
                                    stroke="var(--border-subtle)"
                                    strokeWidth={0.5}
                                />
                                {cw >= 28 ? (
                                    <text
                                        x={cx}
                                        y={YEAR_H + MONTH_H / 2 + 3.5}
                                        fontSize={9.5}
                                        fill="var(--text-tertiary)"
                                        textAnchor="middle"
                                        fontFamily="var(--font-mono)"
                                    >
                                        {MONTH_ABBR_KO[c.month]}
                                    </text>
                                ) : cw >= 14 ? (
                                    <text
                                        x={cx}
                                        y={YEAR_H + MONTH_H / 2 + 3.5}
                                        fontSize={9}
                                        fill="var(--text-tertiary)"
                                        textAnchor="middle"
                                        fontFamily="var(--font-mono)"
                                    >
                                        {c.month + 1}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}

                    {/* lane 배경 */}
                    {missions.map((m, i) => (
                        <rect
                            key={`bg-${m}`}
                            x={PAD_LEFT}
                            y={HEADER_H + i * LANE_H}
                            width={innerW}
                            height={LANE_H}
                            fill={i % 2 === 0 ? 'var(--bg-2)' : 'var(--bg-1)'}
                        />
                    ))}

                    {/* 월 vertical gridline (트랙 안쪽으로 연장) */}
                    {monthCells.map((c, i) => (
                        <line
                            key={`g-m-${i}`}
                            x1={c.x1}
                            x2={c.x1}
                            y1={HEADER_H}
                            y2={totalH}
                            stroke="var(--border-subtle)"
                            strokeWidth={0.5}
                        />
                    ))}

                    {/* 연 vertical gridline 강조 */}
                    {yearCells.map((c) => (
                        <line
                            key={`g-y-${c.year}`}
                            x1={c.x1}
                            x2={c.x1}
                            y1={HEADER_H}
                            y2={totalH}
                            stroke="var(--border-default)"
                            strokeWidth={1}
                        />
                    ))}

                    {/* 오늘 marker */}
                    {(() => {
                        const now = Date.now();
                        if (now < startMs || now > endMs) return null;
                        const x = xFor(now);
                        return (
                            <g>
                                <line
                                    x1={x}
                                    x2={x}
                                    y1={0}
                                    y2={totalH}
                                    stroke="var(--success)"
                                    strokeWidth={1}
                                    strokeDasharray="3,3"
                                />
                                <text
                                    x={x + 4}
                                    y={HEADER_H + 10}
                                    fontSize={9}
                                    fill="var(--success)"
                                    fontFamily="var(--font-mono)"
                                >
                                    today
                                </text>
                            </g>
                        );
                    })()}

                </g>

                {/* 좌측 거터 (lane 라벨) — 클립 밖에서 항상 표시 */}
                <rect
                    x={0}
                    y={0}
                    width={PAD_LEFT}
                    height={HEADER_H}
                    fill="var(--bg-1)"
                    stroke="var(--border-default)"
                    strokeWidth={0.5}
                />
                <line
                    x1={PAD_LEFT}
                    x2={PAD_LEFT}
                    y1={0}
                    y2={totalH}
                    stroke="var(--border-default)"
                    strokeWidth={1}
                />
                {missions.map((m, i) => {
                    const yTop = HEADER_H + i * LANE_H;
                    const yMid = yTop + LANE_H / 2;
                    return (
                        <g key={`lbl-${m}`}>
                            <rect
                                x={0}
                                y={yTop}
                                width={PAD_LEFT}
                                height={LANE_H}
                                fill={i % 2 === 0 ? 'var(--bg-2)' : 'var(--bg-1)'}
                                stroke="var(--border-subtle)"
                                strokeWidth={0.5}
                            />
                            <rect
                                x={4}
                                y={yMid - 5}
                                width={3}
                                height={10}
                                fill={MISSION_COLOR[m]}
                                rx={1}
                            />
                            <text
                                x={14}
                                y={yMid + 4}
                                fontSize={11}
                                fontWeight={600}
                                fill="var(--text-primary)"
                                fontFamily="var(--font-mono)"
                            >
                                {m}
                            </text>
                            <text
                                x={PAD_LEFT - 6}
                                y={yMid + 4}
                                fontSize={9.5}
                                fill="var(--text-tertiary)"
                                textAnchor="end"
                                fontFamily="var(--font-mono)"
                            >
                                {scenes.filter((s) => s.mission === m).length}
                            </text>
                        </g>
                    );
                })}

                {/* 헤더/lane 경계 라인 */}
                <line
                    x1={0}
                    x2={containerW}
                    y1={YEAR_H}
                    y2={YEAR_H}
                    stroke="var(--border-default)"
                    strokeWidth={0.5}
                />
                <line
                    x1={0}
                    x2={containerW}
                    y1={HEADER_H}
                    y2={HEADER_H}
                    stroke="var(--border-default)"
                    strokeWidth={1}
                />

                {/* 마지막 그룹 — scene 마커 + dim overlay + range 핸들. 헤더/lane 보더 위에 그려진다. */}
                <g clipPath="url(#edsc-track-clip)">
                    {/* scene marker — 좁은 vertical bar (border 위) */}
                    {scenes.map((s) => {
                        const t = new Date(s.isoDate).getTime();
                        if (t < startMs - day || t > endMs + day) return null;
                        const x = xFor(t);
                        const laneIdx = missions.indexOf(s.mission);
                        if (laneIdx < 0) return null;
                        const yTop = HEADER_H + laneIdx * LANE_H + 5;
                        const h = LANE_H - 10;
                        const isSel = selected.has(s.id);
                        const isHov = hoveredId === s.id;
                        const order = selectedOrder.get(s.id);
                        const color = MISSION_COLOR[s.mission];
                        const w = isSel ? 6 : isHov ? 5 : 4;
                        return (
                            <g
                                key={s.id}
                                onClick={() => handleSceneClick(s)}
                                onMouseEnter={() => onHover(s.id)}
                                onMouseLeave={() => onHover(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                <title>
                                    {`${s.date} · ${s.mission}/${s.pass} · perp ${s.perpBaseline >= 0 ? '+' : ''}${s.perpBaseline}m${isSel ? ` · 선택#${order}` : ''}`}
                                </title>
                                <rect
                                    x={x - 7}
                                    y={yTop - 2}
                                    width={14}
                                    height={h + 4}
                                    fill="transparent"
                                />
                                <rect
                                    x={x - w / 2}
                                    y={yTop}
                                    width={w}
                                    height={h}
                                    fill={color}
                                    fillOpacity={isSel ? 1 : isHov ? 0.85 : 0.55}
                                    stroke={isSel || isHov ? '#fff' : 'transparent'}
                                    strokeWidth={isSel ? 1.5 : isHov ? 1 : 0}
                                    rx={1}
                                />
                                {isSel && order ? (
                                    <>
                                        <circle
                                            cx={x}
                                            cy={yTop - 4}
                                            r={6.5}
                                            fill="var(--accent)"
                                            stroke="var(--bg-2)"
                                            strokeWidth={1.2}
                                        />
                                        <text
                                            x={x}
                                            y={yTop - 1.5}
                                            fontSize={9}
                                            fontWeight={700}
                                            fill="#fff"
                                            textAnchor="middle"
                                            fontFamily="var(--font-mono)"
                                        >
                                            {order}
                                        </text>
                                    </>
                                ) : null}
                            </g>
                        );
                    })}

                    {(() => {
                        const xS = xFor(rangeStart.getTime());
                        const xE = xFor(rangeEnd.getTime());
                        const leftDimW = Math.max(0, Math.min(xS, PAD_LEFT + innerW) - PAD_LEFT);
                        const rightDimX = Math.max(PAD_LEFT, xE);
                        const rightDimW = Math.max(0, PAD_LEFT + innerW - rightDimX);
                        return (
                            <g style={{ pointerEvents: 'none' }}>
                                {leftDimW > 0 ? (
                                    <rect
                                        x={PAD_LEFT}
                                        y={HEADER_H}
                                        width={leftDimW}
                                        height={lanesH}
                                        fill="rgba(15,18,22,0.42)"
                                    />
                                ) : null}
                                {rightDimW > 0 ? (
                                    <rect
                                        x={rightDimX}
                                        y={HEADER_H}
                                        width={rightDimW}
                                        height={lanesH}
                                        fill="rgba(15,18,22,0.42)"
                                    />
                                ) : null}
                                {xE > xS ? (
                                    <rect
                                        x={Math.max(xS, PAD_LEFT)}
                                        y={HEADER_H}
                                        width={Math.max(0, Math.min(xE, PAD_LEFT + innerW) - Math.max(xS, PAD_LEFT))}
                                        height={lanesH}
                                        fill="transparent"
                                        stroke="var(--accent)"
                                        strokeWidth={1}
                                        strokeOpacity={0.5}
                                    />
                                ) : null}
                            </g>
                        );
                    })()}

                    {(['start', 'end'] as const).map((which) => {
                        const t = which === 'start' ? rangeStart.getTime() : rangeEnd.getTime();
                        const x = xFor(t);
                        const dateStr = formatYmd(which === 'start' ? rangeStart : rangeEnd);
                        const isActive = draggingHandle === which;
                        return (
                            <g
                                key={`handle-${which}`}
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={onHandleMouseDown(which)}
                            >
                                <title>{`${which === 'start' ? '시작' : '종료'}: ${dateStr} (드래그로 조절)`}</title>
                                <rect
                                    x={x - 8}
                                    y={0}
                                    width={16}
                                    height={totalH}
                                    fill="transparent"
                                />
                                <rect
                                    x={x - 2}
                                    y={0}
                                    width={4}
                                    height={totalH}
                                    fill="var(--accent)"
                                    fillOpacity={isActive ? 1 : 0.85}
                                />
                                <rect
                                    x={x - 5}
                                    y={HEADER_H - 10}
                                    width={10}
                                    height={20}
                                    fill="var(--accent)"
                                    rx={2}
                                />
                                <line
                                    x1={x - 1.5}
                                    x2={x - 1.5}
                                    y1={HEADER_H - 6}
                                    y2={HEADER_H + 6}
                                    stroke="#fff"
                                    strokeWidth={0.7}
                                    strokeOpacity={0.85}
                                />
                                <line
                                    x1={x + 1.5}
                                    x2={x + 1.5}
                                    y1={HEADER_H - 6}
                                    y2={HEADER_H + 6}
                                    stroke="#fff"
                                    strokeWidth={0.7}
                                    strokeOpacity={0.85}
                                />
                                <rect
                                    x={x - 38}
                                    y={totalH - 16}
                                    width={76}
                                    height={14}
                                    fill="var(--accent)"
                                    rx={2}
                                />
                                <text
                                    x={x}
                                    y={totalH - 5.5}
                                    fontSize={9.5}
                                    fontWeight={700}
                                    fill="#fff"
                                    textAnchor="middle"
                                    fontFamily="var(--font-mono)"
                                >
                                    {dateStr}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
}

function formatYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** 임의의 timestamp 를 자정(00:00) 으로 스냅. */
function startOfDay(ts: number): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

// ────────────────────────────────────────────────────────────────────────────
// 결과 — 하단 시계열 패널
// ────────────────────────────────────────────────────────────────────────────

function ResultsBottomPanel({ points, onExport }: { points: Point[]; onExport: () => void }) {
    return (
        <>
            <div
                className="between"
                style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}
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
                <button type="button" className="btn btn--ghost btn--sm" onClick={onExport}>
                    <Icon name="download" size={11} /> CSV 내보내기
                </button>
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
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 폼/사이드바 공용 헬퍼
// ────────────────────────────────────────────────────────────────────────────

function Section({
    title,
    hint,
    children,
}: {
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-subtle)',
            }}
        >
            <div className="col" style={{ gap: 2, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{title}</span>
                {hint ? (
                    <span className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                        {hint}
                    </span>
                ) : null}
            </div>
            {children}
        </div>
    );
}

function LabeledInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <label className="col" style={{ gap: 4, flex: 1 }}>
            <span className="faint" style={{ fontSize: 10.5 }}>
                {label}
            </span>
            <input
                className="input mono tabular"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ height: 30, fontSize: 12 }}
            />
        </label>
    );
}

function NumberField({
    label,
    value,
    onChange,
    step,
    min,
    max,
    hint,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    max?: number;
    hint?: string;
}) {
    return (
        <div className="col" style={{ gap: 3 }}>
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, flex: 1 }}>{label}</span>
                <input
                    type="number"
                    className="input mono tabular"
                    value={value}
                    step={step}
                    min={min}
                    max={max}
                    onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) onChange(v);
                    }}
                    style={{ width: 88, height: 28, fontSize: 12 }}
                />
            </div>
            {hint ? (
                <span className="faint" style={{ fontSize: 10.5, lineHeight: 1.45 }}>
                    {hint}
                </span>
            ) : null}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// 결과 — 시계열 차트
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// 결과 — 원본 scene 모달
// ────────────────────────────────────────────────────────────────────────────

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
