'use client';

import { MapCanvas, type MapFootprint } from '@/_ui/hifi';

// 포항 AOI + 주변 Sentinel-1 footprint 데모 (EPSG:4326 lon/lat).
// 지도에 지리좌표로 바인딩되어 pan/zoom 시 함께 움직인다.
const AUTH_FOOTPRINTS: MapFootprint[] = [
    {
        id: 'have-1',
        kind: 'have',
        label: 'S1A 20260420',
        coords: [
            [128.88, 35.72],
            [129.28, 35.78],
            [129.18, 36.12],
            [128.78, 36.06],
        ],
    },
    {
        id: 'have-2',
        kind: 'have',
        coords: [
            [128.98, 35.82],
            [129.38, 35.88],
            [129.28, 36.22],
            [128.88, 36.16],
        ],
    },
    {
        id: 'have-3',
        kind: 'have',
        coords: [
            [129.08, 35.92],
            [129.48, 35.98],
            [129.38, 36.32],
            [128.98, 36.26],
        ],
    },
    {
        id: 'need-1',
        kind: 'need',
        coords: [
            [129.28, 35.7],
            [129.7, 35.76],
            [129.6, 36.1],
            [129.18, 36.04],
        ],
    },
];

const AUTH_AOI: Array<[number, number]> = [
    [129.28, 35.96],
    [129.5, 35.98],
    [129.48, 36.12],
    [129.26, 36.1],
];

/** 로그인/회원가입 공통 좌측 히어로 패널 (지도 + 마케팅 문구). */
export function AuthHeroPane() {
    return (
        <div
            style={{
                flex: '1 1 55%',
                position: 'relative',
                overflow: 'hidden',
                borderRight: '1px solid var(--border-subtle)',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(ellipse at 20% 20%, rgba(34,211,238,0.10), transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(129,140,248,0.10), transparent 50%)',
                }}
            />
            <MapCanvas
                showLegend={false}
                showBasemapSwitch={false}
                interactive={false}
                center={[129.2, 36.0]}
                zoom={8}
                footprints={AUTH_FOOTPRINTS}
                aoi={AUTH_AOI}
            />
            {/* basemap 종류와 무관하게 텍스트 가독성 확보 */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 260,
                    background:
                        'linear-gradient(to top, rgba(10,12,16,0.82) 0%, rgba(10,12,16,0.55) 45%, rgba(10,12,16,0) 100%)',
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: 36,
                    left: 36,
                    right: 36,
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}
            >
                <div className="row gap-2" style={{ marginBottom: 12 }}>
                    <div className="topnav__logo-mark" style={{ width: 28, height: 28, fontSize: 13 }}>
                        S1
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>위성검색</span>
                </div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.15,
                        maxWidth: 520,
                    }}
                >
                    한반도 Sentinel-1 SAR 데이터
                    <br />
                    탐색과 분석을 한곳에서
                </div>
                <div
                    style={{
                        fontSize: 14,
                        marginTop: 10,
                        maxWidth: 520,
                        color: 'rgba(255,255,255,0.82)',
                    }}
                >
                    NAS 보유 scene 즉시 다운로드 · AOI 기반 자동 크롤 · DInSAR/SBAS 분석 산출물까지.
                </div>
            </div>
        </div>
    );
}
