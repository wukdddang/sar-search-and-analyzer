'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import Feature from 'ol/Feature';
import type { Coordinate } from 'ol/coordinate';
import { boundingExtent } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import { MultiPoint, Point, Polygon } from 'ol/geom';
import Draw, { createBox } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Translate from 'ol/interaction/Translate';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import View from 'ol/View';

import { Icon, type IconName } from './Icon';

export type Basemap = 'osm' | 'satellite';

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export type MapTool = 'polygon' | 'bbox' | 'upload';

export type FootprintKind = 'have' | 'need' | 'aoi';

/** Minimal GeoJSON geometry shape — lon/lat. Avoids dependency on `@types/geojson`. */
export type DrawnGeometry =
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: string; coordinates: unknown };

export interface MapFootprint {
    id: string;
    /** Polygon ring as [lon, lat] pairs (EPSG:4326) */
    coords: Array<[number, number]>;
    kind?: FootprintKind;
    label?: string;
    active?: boolean;
    onClick?: () => void;
}

export interface MapPoint {
    id: string;
    coord: [number, number];
    color?: string;
    label?: string;
    onClick?: () => void;
}

interface Props {
    children?: ReactNode;
    showLegend?: boolean;
    legend?: 'default' | 'velocity';
    style?: CSSProperties;
    onToolSelect?: (tool: MapTool) => void;
    activeTool?: MapTool;
    /** 노출할 그리기 도구 목록. 미지정 시 polygon/bbox/upload 모두 표시. */
    tools?: ReadonlyArray<MapTool>;
    /** Initial center in lon/lat (EPSG:4326). Default = Pohang (129.37, 36.02) */
    center?: [number, number];
    /** Initial zoom. Default = 9 */
    zoom?: number;
    /** Scene footprints rendered on the map */
    footprints?: MapFootprint[];
    /** AOI polygon as [lon,lat][] (single ring) */
    aoi?: Array<[number, number]> | null;
    /** Points overlay (used by InSAR time-series) */
    points?: MapPoint[];
    /** Callback when user finishes drawing with the active tool.
     *  `geojson` is a standard GeoJSON geometry object (lon/lat). */
    onDrawEnd?: (tool: MapTool, geojson: DrawnGeometry) => void;
    /** Raw map click (lon/lat). Fires only when no draw tool is active. */
    onMapClick?: (coord: [number, number]) => void;
    /** AOI를 모디파이/이동(translate) 가능하게 하고, 변경 시 호출. 미지정 시 AOI 비편집. */
    onAoiChange?: (coords: Array<[number, number]>) => void;
    /** Default basemap. Can be toggled by the user unless `showBasemapSwitch` is false. */
    basemap?: Basemap;
    /** Show the OSM ↔ Satellite basemap toggle. Default true. */
    showBasemapSwitch?: boolean;
    /** If false, disables all map interactions (pan/zoom/drag) and hides zoom buttons.
     *  Intended for static mini-maps in list cards. Default true. */
    interactive?: boolean;
    /** Change this value to force the view to refit the current footprints/aoi.
     *  When omitted, the map fits only once on first data load. */
    fitKey?: string;
}

const COLORS = {
    have: { stroke: '#22d3ee', fill: 'rgba(34,211,238,0.14)' },
    need: { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.14)' },
    aoi: { stroke: '#818cf8', fill: 'rgba(129,140,248,0.18)' },
} as const;

const TOOLS: ReadonlyArray<[IconName, MapTool, string]> = [
    ['polygon', 'polygon', '폴리곤'],
    ['square', 'bbox', '사각형'],
    ['upload', 'upload', 'SHP 업로드'],
];

function makeBasemapSource(b: Basemap) {
    if (b === 'satellite') {
        // ESRI World Imagery (free for non-commercial visualization; no token required).
        return new XYZ({
            url: SATELLITE_URL,
            crossOrigin: 'anonymous',
            maxZoom: 19,
            attributions: [],
        });
    }
    return new OSM({ crossOrigin: 'anonymous', attributions: [] });
}

function ringToPolygon(coords: Array<[number, number]>) {
    const ring = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
    // Ensure ring is closed
    if (ring.length > 0) {
        const [fx, fy] = ring[0];
        const [lx, ly] = ring[ring.length - 1];
        if (fx !== lx || fy !== ly) ring.push([fx, fy]);
    }
    return new Polygon([ring]);
}

function makeFootprintStyle(kind: FootprintKind, active: boolean, label?: string) {
    const c = COLORS[kind];
    return new Style({
        stroke: new Stroke({
            color: c.stroke,
            width: active ? 2.5 : 1.5,
            lineDash: kind === 'aoi' ? [6, 4] : undefined,
        }),
        fill: new Fill({ color: c.fill }),
        text: label
            ? new Text({
                  text: label,
                  font: '500 11px var(--font-mono, monospace)',
                  fill: new Fill({ color: c.stroke }),
                  backgroundFill: new Fill({ color: 'rgba(22,23,26,0.82)' }),
                  backgroundStroke: new Stroke({ color: c.stroke + '55', width: 1 }),
                  padding: [2, 4, 2, 4],
                  offsetY: -12,
                  overflow: true,
              })
            : undefined,
    });
}

function makePointStyle(color: string, label?: string) {
    return new Style({
        image: new Circle({
            radius: 8,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#16171a', width: 2 }),
        }),
        text: label
            ? new Text({
                  text: label,
                  font: '600 11px var(--font-sans, sans-serif)',
                  fill: new Fill({ color: '#fff' }),
              })
            : undefined,
    });
}

export function MapCanvas({
    children,
    showLegend = true,
    legend = 'default',
    style = {},
    onToolSelect,
    activeTool,
    tools,
    center = [129.37, 36.02],
    zoom = 9,
    footprints,
    aoi,
    points,
    onDrawEnd,
    onMapClick,
    onAoiChange,
    basemap: initialBasemap = 'osm',
    showBasemapSwitch = true,
    interactive = true,
    fitKey,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<Map | null>(null);
    const baseLayerRef = useRef<TileLayer | null>(null);
    const [basemap, setBasemap] = useState<Basemap>(initialBasemap);
    const [legendOpen, setLegendOpen] = useState(true);
    const footprintSourceRef = useRef<VectorSource | null>(null);
    const aoiSourceRef = useRef<VectorSource | null>(null);
    const drawSourceRef = useRef<VectorSource | null>(null);
    const pointSourceRef = useRef<VectorSource | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const modifyInteractionRef = useRef<Modify | null>(null);
    const translateInteractionRef = useRef<Translate | null>(null);
    // Latest callbacks in refs so event handlers don't need to rebind.
    const onDrawEndRef = useRef(onDrawEnd);
    const onMapClickRef = useRef(onMapClick);
    const onAoiChangeRef = useRef(onAoiChange);
    onDrawEndRef.current = onDrawEnd;
    onMapClickRef.current = onMapClick;
    onAoiChangeRef.current = onAoiChange;

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const footprintSource = new VectorSource();
        const aoiSource = new VectorSource();
        const drawSource = new VectorSource();
        const pointSource = new VectorSource();
        footprintSourceRef.current = footprintSource;
        aoiSourceRef.current = aoiSource;
        drawSourceRef.current = drawSource;
        pointSourceRef.current = pointSource;

        // preload: 0 + useInterimTilesOnError: false → don't fall back to old-zoom tiles
        const baseLayer = new TileLayer({
            source: makeBasemapSource(initialBasemap),
            preload: 0,
            useInterimTilesOnError: false,
        });
        baseLayerRef.current = baseLayer;

        const map = new Map({
            target: containerRef.current,
            controls: [], // we render our own zoom buttons; no default attribution
            interactions: interactive ? undefined : [], // static mini-maps disable all interactions
            layers: [
                baseLayer,
                new VectorLayer({
                    source: footprintSource,
                    style: (feature) =>
                        makeFootprintStyle(
                            (feature.get('kind') ?? 'have') as FootprintKind,
                            Boolean(feature.get('active')),
                            feature.get('label'),
                        ),
                }),
                new VectorLayer({
                    source: aoiSource,
                    style: (feature) => {
                        const c = COLORS.aoi;
                        const editable = Boolean(onAoiChangeRef.current);
                        const styles: Style[] = [
                            new Style({
                                stroke: new Stroke({
                                    color: c.stroke,
                                    width: editable ? 2.5 : 1.5,
                                    lineDash: [6, 4],
                                }),
                                fill: new Fill({ color: c.fill }),
                            }),
                        ];
                        if (editable) {
                            styles.push(
                                new Style({
                                    image: new Circle({
                                        radius: 6,
                                        fill: new Fill({ color: '#ffffff' }),
                                        stroke: new Stroke({ color: c.stroke, width: 2 }),
                                    }),
                                    geometry: (f) => {
                                        const geom = f.getGeometry();
                                        if (!geom || geom.getType() !== 'Polygon') return undefined;
                                        const ring = (geom as Polygon).getCoordinates()[0];
                                        if (!ring || ring.length === 0) return undefined;
                                        // Polygon ring is closed (last == first); strip the duplicate.
                                        const corners = ring.slice(0, -1);
                                        return new MultiPoint(corners);
                                    },
                                }),
                            );
                        }
                        return styles;
                    },
                }),
                new VectorLayer({
                    source: drawSource,
                    style: makeFootprintStyle('aoi', true, undefined),
                }),
                new VectorLayer({
                    source: pointSource,
                    style: (feature) =>
                        makePointStyle(
                            (feature.get('color') as string) ?? '#22d3ee',
                            feature.get('label') as string | undefined,
                        ),
                }),
            ],
            view: new View({
                center: fromLonLat(center),
                zoom,
                minZoom: 3,
                maxZoom: 18,
            }),
        });

        // Click → footprint.onClick / point.onClick / onMapClick
        // 'click' 사용: 'singleclick'은 dblclick과 구분하려고 ~250ms 지연되어 모달이 늦게 뜬다.
        map.on('click', (evt) => {
            // AOI가 편집 가능하면, AOI 위 클릭은 AOI 인터랙션(Translate/Modify)에 양보 —
            // 뒤에 깔린 풋프린트의 onClick이 발화되지 않도록 차단한다.
            if (onAoiChangeRef.current) {
                let aoiHit = false;
                map.forEachFeatureAtPixel(
                    evt.pixel,
                    (feature) => {
                        if (feature.get('kind') === 'aoi') {
                            aoiHit = true;
                            return true;
                        }
                        return undefined;
                    },
                    { hitTolerance: 4 },
                );
                if (aoiHit) return;
            }

            let handled = false;
            map.forEachFeatureAtPixel(
                evt.pixel,
                (feature) => {
                    const cb = feature.get('onClick') as (() => void) | undefined;
                    if (cb) {
                        cb();
                        handled = true;
                        return true;
                    }
                    return undefined;
                },
                { hitTolerance: 4 },
            );
            if (!handled && onMapClickRef.current) {
                const [lon, lat] = toLonLat(evt.coordinate);
                onMapClickRef.current([lon, lat]);
            }
        });

        // Cursor changes on hover over clickable features
        map.on('pointermove', (evt) => {
            if (evt.dragging) return;
            const hit = map.hasFeatureAtPixel(evt.pixel, { hitTolerance: 4 });
            const target = map.getTargetElement();
            if (target) target.style.cursor = hit ? 'pointer' : '';
        });

        mapRef.current = map;

        return () => {
            map.setTarget(undefined);
            mapRef.current = null;
        };
        // Initial view only — subsequent center/zoom changes would disrupt user's pan/zoom.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep footprints in sync
    useEffect(() => {
        const src = footprintSourceRef.current;
        if (!src) return;
        src.clear();
        for (const fp of footprints ?? []) {
            const f = new Feature({ geometry: ringToPolygon(fp.coords) });
            f.setId(fp.id);
            f.set('kind', fp.kind ?? 'have');
            f.set('label', fp.label);
            f.set('active', fp.active ?? false);
            f.set('onClick', fp.onClick);
            src.addFeature(f);
        }
    }, [footprints]);

    // Keep AOI in sync
    useEffect(() => {
        const src = aoiSourceRef.current;
        if (!src) return;
        src.clear();
        if (aoi && aoi.length >= 3) {
            const f = new Feature({ geometry: ringToPolygon(aoi) });
            f.set('kind', 'aoi');
            src.addFeature(f);
        }
    }, [aoi]);

    // Keep points in sync
    useEffect(() => {
        const src = pointSourceRef.current;
        if (!src) return;
        src.clear();
        for (const p of points ?? []) {
            const f = new Feature({ geometry: new Point(fromLonLat(p.coord)) });
            f.setId(p.id);
            f.set('color', p.color ?? '#22d3ee');
            f.set('label', p.label);
            f.set('onClick', p.onClick);
            src.addFeature(f);
        }
    }, [points]);

    // Swap base tile layer when basemap toggles.
    // Setting a new source on the existing layer leaves the old tile cache intact,
    // so during zoom the previous basemap bleeds through. Replacing the entire layer
    // guarantees a clean cut: old tiles are discarded before new tiles render.
    useEffect(() => {
        const map = mapRef.current;
        const oldLayer = baseLayerRef.current;
        if (!map) return;
        const newLayer = new TileLayer({
            source: makeBasemapSource(basemap),
            preload: 0,
            useInterimTilesOnError: false,
        });
        const layers = map.getLayers();
        if (oldLayer) {
            const idx = layers.getArray().indexOf(oldLayer);
            if (idx >= 0) layers.setAt(idx, newLayer);
            else layers.insertAt(0, newLayer);
            oldLayer.dispose();
        } else {
            layers.insertAt(0, newLayer);
        }
        baseLayerRef.current = newLayer;
    }, [basemap]);

    // AOI 편집 인터랙션 (Modify + Translate). 콜백이 있을 때만 부착.
    useEffect(() => {
        const map = mapRef.current;
        const aoiSource = aoiSourceRef.current;
        if (!map || !aoiSource) return;
        if (!onAoiChange) return;

        const readRing = (feature: Feature): Array<[number, number]> | null => {
            const geom = feature.getGeometry();
            if (!geom || geom.getType() !== 'Polygon') return null;
            const polygon = geom as Polygon;
            const ring3857 = polygon.getCoordinates()[0];
            if (!ring3857) return null;
            return ring3857.map((c) => {
                const [lon, lat] = toLonLat(c);
                return [lon, lat] as [number, number];
            });
        };

        // 4-코너 ring([NW,NE,SE,SW,NW]) 표준 정규화. 드래그 종료 후 다음 드래그가
        // 일관된 인덱스 의미(0=NW, 2=SE)로 시작하도록.
        const normalizeBboxRing = (ring: Array<[number, number]>): Array<[number, number]> => {
            let minLon = Infinity;
            let maxLon = -Infinity;
            let minLat = Infinity;
            let maxLat = -Infinity;
            for (const [lo, la] of ring) {
                if (lo < minLon) minLon = lo;
                if (lo > maxLon) maxLon = lo;
                if (la < minLat) minLat = la;
                if (la > maxLat) maxLat = la;
            }
            return [
                [minLon, maxLat],
                [maxLon, maxLat],
                [maxLon, minLat],
                [minLon, minLat],
                [minLon, maxLat],
            ];
        };

        // cursor 가 인덱스 movedIdx 에, anchor(대각)가 (movedIdx+2)%4 에 위치하는 직사각형 ring 을
        // 만든다. Modify 가 드래그하는 vertex 가 ring 에서 같은 인덱스를 유지해야 핸들이 커서를
        // 따라가므로, bbox 좌표를 인덱스에 단순 정렬(NW/NE/SE/SW)하지 않고 이렇게 회전시켜 배치한다.
        const buildRectangleRing = (
            cursor: [number, number],
            anchor: [number, number],
            movedIdx: number,
        ): Array<[number, number]> => {
            // 원래 ring 이 [NW,NE,SE,SW] 표준 순서일 때 인접 vertex 와 공유하는 축:
            //   0(NW)↔1(NE) 같은 lat / 0(NW)↔3(SW) 같은 lon — 즉 짝수 인덱스의 +1 이웃은 같은 lat.
            const sharedLat: [number, number] = [anchor[0], cursor[1]]; // cursor 와 같은 lat
            const sharedLon: [number, number] = [cursor[0], anchor[1]]; // cursor 와 같은 lon
            const r: Array<[number, number]> = [cursor, cursor, cursor, cursor];
            r[movedIdx] = cursor;
            r[(movedIdx + 2) % 4] = anchor;
            if (movedIdx % 2 === 0) {
                r[(movedIdx + 1) % 4] = sharedLat;
                r[(movedIdx + 3) % 4] = sharedLon;
            } else {
                r[(movedIdx + 1) % 4] = sharedLon;
                r[(movedIdx + 3) % 4] = sharedLat;
            }
            return [r[0]!, r[1]!, r[2]!, r[3]!, r[0]!];
        };

        let beforeModifyRing: Array<[number, number]> | null = null;
        let activeFeature: Feature | null = null;
        let movedCornerIdx: number | null = null;
        let suppressGeomChange = false;

        // 드래그 중 폴리곤이 사다리꼴을 거치지 않고 항상 직사각형을 유지하도록,
        // geometry change 마다 cursor/anchor 로 bbox 를 재구성해 즉시 setCoordinates 로 덮어쓴다.
        // 어떤 vertex 가 드래그되는지(movedCornerIdx)는 첫 변경 이벤트에서 한 번 결정한 뒤
        // 드래그 종료까지 고정 — 사용자가 대각선을 넘겨 끌어도 핸들이 같은 인덱스에 머무르도록.
        const onGeomChange = () => {
            if (suppressGeomChange || !activeFeature || !beforeModifyRing) return;
            const geom = activeFeature.getGeometry();
            if (!geom || geom.getType() !== 'Polygon') return;
            const polygon = geom as Polygon;
            const ring3857 = polygon.getCoordinates()[0];
            if (!ring3857 || ring3857.length < 4) return;
            const ringLonLat: Array<[number, number]> = ring3857.map((c) => {
                const [lon, lat] = toLonLat(c);
                return [lon, lat];
            });

            if (movedCornerIdx === null) {
                let maxD = -1;
                let idx = 0;
                for (let i = 0; i < 4; i++) {
                    const a = ringLonLat[i]!;
                    const b = beforeModifyRing[i]!;
                    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
                    if (d > maxD) {
                        maxD = d;
                        idx = i;
                    }
                }
                if (maxD <= 0) return; // 변동 없음 — 인덱스 락 보류.
                movedCornerIdx = idx;
            }

            const cursor = ringLonLat[movedCornerIdx]!;
            const anchor = beforeModifyRing[(movedCornerIdx + 2) % 4]!;
            const nextLonLat = buildRectangleRing(cursor, anchor, movedCornerIdx);
            const next3857 = nextLonLat.map(([lo, la]) => fromLonLat([lo, la]));

            let same = next3857.length === ring3857.length;
            if (same) {
                for (let i = 0; i < next3857.length; i++) {
                    const a = next3857[i]!;
                    const b = ring3857[i]!;
                    if (Math.abs(a[0] - b[0]) > 1e-3 || Math.abs(a[1] - b[1]) > 1e-3) {
                        same = false;
                        break;
                    }
                }
            }
            if (same) return;
            suppressGeomChange = true;
            polygon.setCoordinates([next3857]);
            suppressGeomChange = false;
        };

        const modify = new Modify({
            source: aoiSource,
            // 변(edge) 중간을 클릭해 새 정점을 끼워 넣는 동작 비활성 — 사각형 유지.
            insertVertexCondition: () => false,
        });
        modify.on('modifystart', (evt) => {
            const f = evt.features.getArray()[0] as Feature | undefined;
            if (!f) return;
            activeFeature = f;
            beforeModifyRing = readRing(f);
            movedCornerIdx = null;
            f.getGeometry()?.on('change', onGeomChange);
        });
        modify.on('modifyend', (evt) => {
            const f = evt.features.getArray()[0] as Feature | undefined;
            if (activeFeature) {
                activeFeature.getGeometry()?.un('change', onGeomChange);
            }
            activeFeature = null;
            movedCornerIdx = null;
            if (!f) {
                beforeModifyRing = null;
                return;
            }
            const ring = readRing(f);
            beforeModifyRing = null;
            if (!ring) return;
            // 다음 드래그가 [NW,NE,SE,SW] 표준 인덱스로 시작하도록 정규화해서 부모로 전달.
            onAoiChangeRef.current?.(normalizeBboxRing(ring));
        });

        const translate = new Translate({
            filter: (feature) => feature.get('kind') === 'aoi',
        });
        translate.on('translateend', (evt) => {
            const f = evt.features.getArray()[0] as Feature | undefined;
            if (!f) return;
            const ring = readRing(f);
            if (!ring) return;
            // 이동만 한 경우 bbox 그대로 정규화.
            let minLon = Infinity;
            let maxLon = -Infinity;
            let minLat = Infinity;
            let maxLat = -Infinity;
            for (const [lo, la] of ring) {
                if (lo < minLon) minLon = lo;
                if (lo > maxLon) maxLon = lo;
                if (la < minLat) minLat = la;
                if (la > maxLat) maxLat = la;
            }
            onAoiChangeRef.current?.([
                [minLon, maxLat],
                [maxLon, maxLat],
                [maxLon, minLat],
                [minLon, minLat],
                [minLon, maxLat],
            ]);
        });

        // 추가 순서 주의: OpenLayers 는 마지막에 추가된 인터랙션을 먼저 처리한다.
        // Modify 가 먼저 이벤트를 받아서 vertex 위에서는 핸들을 잡고, vertex 가 아닌 곳에서만
        // Translate 로 흘러가도록 translate → modify 순으로 등록.
        map.addInteraction(translate);
        map.addInteraction(modify);
        modifyInteractionRef.current = modify;
        translateInteractionRef.current = translate;

        return () => {
            map.removeInteraction(modify);
            map.removeInteraction(translate);
            if (modifyInteractionRef.current === modify) modifyInteractionRef.current = null;
            if (translateInteractionRef.current === translate)
                translateInteractionRef.current = null;
        };
    }, [onAoiChange]);

    // Swap draw interaction when activeTool changes
    useEffect(() => {
        const map = mapRef.current;
        const src = drawSourceRef.current;
        if (!map || !src) return;

        if (drawInteractionRef.current) {
            map.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (!activeTool || activeTool === 'upload') return;

        const type = activeTool === 'bbox' ? 'Circle' : 'Polygon';
        const draw = new Draw({
            source: src,
            type,
            geometryFunction: activeTool === 'bbox' ? createBox() : undefined,
        });
        draw.on('drawstart', () => src.clear());
        draw.on('drawend', (evt) => {
            const format = new GeoJSON();
            const geojson = format.writeGeometryObject(evt.feature.getGeometry()!, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857',
            });
            onDrawEndRef.current?.(activeTool, geojson as DrawnGeometry);
        });
        map.addInteraction(draw);
        drawInteractionRef.current = draw;

        return () => {
            map.removeInteraction(draw);
            if (drawInteractionRef.current === draw) drawInteractionRef.current = null;
        };
    }, [activeTool]);

    // Fit view to footprints + aoi.
    // - Without `fitKey`: fit once on first meaningful data, then never again (keeps
    //   the user's pan/zoom intact).
    // - With `fitKey`: refit whenever the key changes (parent signals a new selection).
    const fitSignature = useMemo(() => {
        const parts: string[] = [];
        if (aoi) parts.push('aoi:' + aoi.length);
        if (footprints?.length) parts.push('fp:' + footprints.map((f) => f.id).join(','));
        return parts.join('|');
    }, [aoi, footprints]);
    const didFitRef = useRef(false);
    const lastFitKeyRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const keyChanged = fitKey !== undefined && fitKey !== lastFitKeyRef.current;
        if (!keyChanged && didFitRef.current) return;
        if (!fitSignature) return;
        const coords: Coordinate[] = [];
        for (const fp of footprints ?? []) {
            for (const [lon, lat] of fp.coords) coords.push(fromLonLat([lon, lat]));
        }
        if (aoi) for (const [lon, lat] of aoi) coords.push(fromLonLat([lon, lat]));
        if (coords.length >= 2) {
            const extent = boundingExtent(coords);
            map.getView().fit(extent, {
                padding: [40, 40, 40, 40],
                maxZoom: 13,
                duration: keyChanged ? 350 : 0,
            });
            didFitRef.current = true;
            lastFitKeyRef.current = fitKey;
        }
    }, [fitSignature, footprints, aoi, fitKey]);

    const handleZoom = (delta: number) => {
        const view = mapRef.current?.getView();
        if (!view) return;
        const z = view.getZoom() ?? zoom;
        view.animate({ zoom: z + delta, duration: 200 });
    };

    return (
        <div className="map-stage" style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
            {children}
            {interactive && onToolSelect ? (
                <div className="map-tools">
                    {TOOLS.filter(([, k]) => !tools || tools.includes(k)).map(([ic, k, t]) => (
                        <button
                            key={k}
                            type="button"
                            data-tooltip={t}
                            data-tooltip-pos="right"
                            aria-label={t}
                            className={`map-tools__btn${activeTool === k ? ' map-tools__btn--active' : ''}`}
                            onClick={() => onToolSelect(k)}
                        >
                            <Icon name={ic} size={16} />
                        </button>
                    ))}
                </div>
            ) : null}
            {interactive ? (
                <div className="map-zoom">
                    <button type="button" onClick={() => handleZoom(1)}>
                        ＋
                    </button>
                    <button type="button" onClick={() => handleZoom(-1)}>
                        −
                    </button>
                </div>
            ) : null}
            {interactive && showBasemapSwitch ? (
                <div className="map-basemap" role="group" aria-label="배경 지도 선택">
                    <button
                        type="button"
                        className={basemap === 'osm' ? 'active' : ''}
                        onClick={() => setBasemap('osm')}
                    >
                        지도
                    </button>
                    <button
                        type="button"
                        className={basemap === 'satellite' ? 'active' : ''}
                        onClick={() => setBasemap('satellite')}
                    >
                        위성
                    </button>
                </div>
            ) : null}
            {showLegend ? (
                <div className={`map-legend${legendOpen ? '' : ' map-legend--collapsed'}`}>
                    <button
                        type="button"
                        className="map-legend__header"
                        aria-expanded={legendOpen}
                        onClick={() => setLegendOpen((v) => !v)}
                    >
                        <span>{legend === 'velocity' ? '평균 속도 (mm/yr)' : 'Footprint'}</span>
                        <Icon
                            name="chevronDown"
                            size={12}
                            style={{
                                transition: 'transform 120ms',
                                transform: legendOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                opacity: 0.7,
                            }}
                        />
                    </button>
                    {legendOpen ? (
                        legend === 'velocity' ? (
                            <>
                                <div
                                    style={{
                                        height: 10,
                                        borderRadius: 2,
                                        background:
                                            'linear-gradient(to right, #2563eb, #60a5fa, #f1f5f9, #fb923c, #dc2626)',
                                        border: '1px solid var(--border-default)',
                                    }}
                                />
                                <div
                                    className="between tabular"
                                    style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}
                                >
                                    <span>−30</span>
                                    <span>0</span>
                                    <span>+30</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="map-legend__row">
                                    <div
                                        className="map-legend__swatch"
                                        style={{ borderColor: 'var(--map-have)', background: 'rgba(34,211,238,0.14)' }}
                                    />
                                    <span>NAS 보유</span>
                                </div>
                                <div className="map-legend__row">
                                    <div
                                        className="map-legend__swatch"
                                        style={{ borderColor: 'var(--map-need)', background: 'rgba(251,191,36,0.14)' }}
                                    />
                                    <span>받기 필요</span>
                                </div>
                                <div className="map-legend__row">
                                    <div
                                        className="map-legend__swatch"
                                        style={{
                                            borderColor: 'var(--map-aoi)',
                                            background: 'rgba(129,140,248,0.14)',
                                            borderStyle: 'dashed',
                                        }}
                                    />
                                    <span>AOI</span>
                                </div>
                            </>
                        )
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/* ─── Backward-compat: the old absolute-positioned Footprint div.
   Kept so pages that still pass <Footprint x/y/w/h> continue to work
   (admin crawl-targets / approvals mini-maps). New code should use
   the `footprints` prop on <MapCanvas>. */
interface FootprintProps {
    x: number;
    y: number;
    w: number;
    h: number;
    rot?: number;
    kind?: FootprintKind;
    label?: string;
    active?: boolean;
    onClick?: () => void;
    style?: CSSProperties;
}

export function Footprint({ x, y, w, h, rot = -15, kind = 'have', label, active, onClick, style = {} }: FootprintProps) {
    const c = COLORS[kind];
    return (
        <div
            onClick={onClick}
            style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: `${w}%`,
                height: `${h}%`,
                transform: `rotate(${rot}deg)`,
                transformOrigin: 'center',
                border: `${active ? '2px' : '1.5px'} ${kind === 'aoi' ? 'dashed' : 'solid'} ${c.stroke}`,
                background: c.fill,
                boxShadow: active ? `0 0 0 3px ${c.stroke}33` : undefined,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'box-shadow 120ms, border-width 120ms',
                pointerEvents: onClick ? 'auto' : 'none',
                zIndex: 2,
                ...style,
            }}
        >
            {label ? (
                <span
                    style={{
                        position: 'absolute',
                        top: -18,
                        left: 0,
                        fontSize: 10,
                        fontWeight: 500,
                        fontFamily: 'var(--font-mono)',
                        color: c.stroke,
                        background: 'var(--bg-2)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        border: `1px solid ${c.stroke}33`,
                        whiteSpace: 'nowrap',
                        transform: `rotate(${-rot}deg)`,
                        transformOrigin: 'left center',
                    }}
                >
                    {label}
                </span>
            ) : null}
        </div>
    );
}
