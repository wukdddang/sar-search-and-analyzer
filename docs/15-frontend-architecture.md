# 15. 프론트엔드 아키텍처

> **Version:** 1.0 | **최종 수정일:** 2026-04-24
>
> | 버전 | 날짜 | 변경 내용 |
> | --- | --- | --- |
> | 1.0 | 2026-04-24 | 초안 작성 (Lumir-ERP 패턴 적용, OpenLayers 확정) |
> | 1.1 | 2026-04-24 | 검색/InSAR 지도는 **OpenLayers로 통일** 명시, 장바구니는 **헤더 아이콘 → 우측 오버레이 패널** 로 변경 |

Sentinel 데이터 플랫폼의 프론트엔드는 **Next.js App Router 기반 SPA-like** 웹 애플리케이션으로, ASF Vertex(https://search.asf.alaska.edu)를 UX 참조점으로 사용한다. 회사 내부 ERP 프로젝트 `Lumir-ERP`의 폴더·문서 패턴을 그대로 계승한다.

---

## 1. 기술 스택 확정

| 영역 | 선택 | 근거 |
|------|------|------|
| 프레임워크 | **Next.js 15 (App Router)** | Lumir-ERP와 동일. 라우트 그룹으로 `plan`/`current` 분리 자연스러움 |
| 언어 | TypeScript 5 | 백엔드와 동일 |
| 패키지 매니저 | pnpm 9 | 백엔드와 동일 |
| 상태 관리 | **TanStack Query v5** (서버 상태) + React Context (UI 상태) | Lumir-ERP 패턴 계승 |
| 지도 라이브러리 | **OpenLayers 10** | 아래 §2 참조 |
| WebSocket | `socket.io-client` | 백엔드 `@nestjs/websockets` 호환 |
| HTTP | `fetch` + 얇은 wrapper (`_services/api-client.ts`) | 라이브러리 종속성 최소화 원칙 |
| Form | React Hook Form + Zod | 검증 일관성 |
| 스타일 | Tailwind CSS | Lumir-ERP와 동일 |
| 아이콘 | `lucide-react` | Lumir-ERP와 동일 |
| 리치 에디터 | 미사용 (본 프로젝트는 게시글 없음) | — |
| 파일 업로드 | 네이티브 `<input type="file">` + `FormData` | SHP zip 업로드 |
| 테스트 | Vitest + React Testing Library + Playwright (E2E) | — |

**의존성 최소화 원칙**: Copernicus 공공 데이터·위성 정보는 장기 운영이 전제되므로, 벤더 종속 라이브러리(예: Mapbox GL JS 유료 티어)를 피하고 **BSD/MIT·OSGeo 계열만** 사용한다.

---

## 2. 지도 라이브러리 결정: OpenLayers vs MapLibre GL

### MapLibre GL이란?

- **MapLibre GL JS**는 Mapbox GL JS 2.0이 독점 라이선스로 전환될 때(2020) **v1.13 포크**되어 BSD-3로 이어진 OSS
- **WebGL 기반 벡터 타일 렌더링** — GPU로 그려서 줌·회전·3D pitch가 부드럽고 60fps
- 스타일 정의는 JSON (`style.json`) — Mapbox 스타일 스펙 호환
- 장점: 성능, 벡터 타일(MVT) 네이티브, 3D 지형(terrain) 내장
- 단점: **벡터 타일 서버가 필요** (또는 유료 provider). 래스터 타일만 쓸 거면 오버엔지니어링. GeoJSON 수십만 피처는 성능 문제(클러스터 필요). footprint 폴리곤·scene 하이라이트 같은 **전통적 GIS 시맨틱이 약함** (레이어 개념이 타일 위주)

### OpenLayers란?

- 2006년부터 이어진 **OSGeo** 재단의 지도 라이브러리. 현재 v10
- **Canvas 2D + WebGL** 혼합 렌더링. 벡터 레이어는 Canvas 기본, 필요 시 WebGL로 전환
- WMS/WMTS/TMS/XYZ 래스터, GeoJSON/GeoPackage/KML/**Shapefile**(ol/format) 벡터 포맷 모두 내장
- **GIS 시맨틱 풍부**: `Feature`, `Geometry`, `Interaction`(Draw/Modify/Select/Snap), `Projection` (EPSG:4326 ↔ 3857 변환 내장)
- 장점: **라이브러리 단독으로 완결**(추가 플러그인 거의 불필요), Shapefile/GeoJSON 직접 로드, 폴리곤 편집·AOI 드로잉 API 성숙
- 단점: 벡터 타일 성능은 MapLibre보다 낮음, 번들 사이즈 중간(~250KB gzip)

### 비교표 (본 프로젝트 요구사항 기준)

| 요구사항 | OpenLayers | MapLibre GL |
|----------|-----------|-------------|
| Sentinel scene **footprint 폴리곤** 오버레이 (수백~수천개) | ✅ 기본 | ⚠️ GeoJSON source는 되지만 인터랙션 다소 번거로움 |
| **AOI 그리기** (bbox/폴리곤) | ✅ `ol/interaction/Draw` 내장 | ⚠️ `maplibre-gl-draw` 별도 플러그인 필요 |
| **SHP 파일 업로드 후 미리보기** | ✅ `shpjs` + GeoJSON → OL 레이어 | ✅ 가능하나 동일하게 shpjs 필요 |
| **행정구역 폴리곤** (한국 level 1/2/3 수천개) | ✅ Canvas 렌더링 충분 | ✅ 벡터 타일로 올리면 더 빠름 (타일 서버 필요) |
| **래스터 Quicklook** (PNG) 지도 위 위치 고정 표시 | ✅ `ImageLayer` + extent | ⚠️ raster source로 가능하나 기본 설계는 타일 위주 |
| **벤더/토큰 불필요한 배경지도** | ✅ OSM XYZ 직결 | ✅ OSM XYZ 직결 가능하나 기본 스타일은 외부 tile provider 전제 |
| **번들 사이즈** | ~250KB gzip | ~210KB gzip |
| **라이선스** | BSD-2 | BSD-3 |
| **종속성 추가 라이브러리** | 거의 없음 | `@maplibre/maplibre-gl-draw`, `@turf/turf` 등 추가 자주 필요 |

### 결정: **OpenLayers 단독 사용**

- 본 프로젝트는 **GIS 인터랙션 중심**(AOI 그리기, footprint 선택, SHP 업로드) — OpenLayers의 `Interaction`/`Feature`/`Format` API와 정확히 일치
- MapLibre는 "지도 스타일을 예쁘게"가 강점이지만 우리는 **업무용 지오데이터 툴** — 벤더/타일 서버에 의존하지 않는 자급자족 구성이 중요
- 배경지도는 **OSM XYZ** (익명 무상)를 기본으로, 회사망 제한 시 **자체 WMTS** 서버 (MapServer/GeoServer)로 교체 가능

**적용 범위 (구속 규칙)**:
- **검색 (`SAR_SRH_*`)** 지도 — OpenLayers
- **InSAR 뷰어 (`SAR_INS_*`, `SAR_INSA_*`)** 지도 — OpenLayers (DInSAR/SBAS 래스터 타일은 `ol/source/XYZ`, PSInSAR 포인트는 `ol/layer/WebGLPoints`)
- **크롤 AOI 관리 (`SAR_AOI_*`)**, **Sync 모니터 (`SAR_SYNC_*`)**, **승인 상세의 AOI 미니맵 (`SAR_APR_DTL`)**, **공공데이터 미리보기 (`SAR_PDS_*`, `SAR_PDA_*`)** — 모두 OpenLayers
- 다른 지도 라이브러리(MapLibre/Leaflet/Mapbox GL/Cesium) 도입은 **본 문서 §2 하이브리드 예외 조건**(예: SBAS 3D 수요) 외에는 금지

```typescript
// apps/web/_shared/map/createMap.ts — 대표 초기화 예
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

export function 지도를_생성한다(target: HTMLElement) {
    return new Map({
        target,
        layers: [
            new TileLayer({ source: new OSM() }),  // 배경
        ],
        view: new View({
            center: fromLonLat([127.5, 36.5]),  // 한반도 중앙
            zoom: 7,
            projection: 'EPSG:3857',
        }),
    });
}
```

**추가 채택 라이브러리 (OpenLayers 생태계)**:
- `shpjs` — 브라우저에서 SHP zip → GeoJSON 변환 (SHP 업로드 기능용)
- 그 외 없음. AOI 그리기·스타일링·클러스터링 모두 `ol/*` 내장으로 해결

**참조 구현**: `apps/web/src/_ui/hifi/MapCanvas.tsx` — OSM 배경, `ol/interaction/Draw`(Point/Polygon/BBox), 풋프린트 벡터 레이어, 포인트 벡터 레이어, 줌/툴 툴바, 범례 오버레이를 포함한 재사용 컴포넌트. 검색/InSAR 두 화면 모두 이 컴포넌트를 그대로 쓴다.

---

## 3. 프로젝트 구조 (모노레포 배치)

백엔드 NestJS 모노레포에 `apps/web` 형태로 추가한다. 별도 저장소 분리는 현 단계에서 하지 않는다 — 타입(특히 DTO/Result) 공유를 위해 같은 모노레포가 유리.

```
sentinel-platform/
├── apps/
│   ├── api/                    # NestJS HTTP 서버 (기존)
│   ├── worker/                 # NestJS 워커 (기존)
│   ├── crawler/                # NestJS 크롤러 (기존)
│   └── web/                    # ★ Next.js 프론트엔드 (신규)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/              # 로그인·회원가입
│       │   │   ├── (planning)/plan/     # Mock 데이터 (Planning)
│       │   │   │   └── (sar)/sar/
│       │   │   │       ├── admin/       # 관리자 화면 (Mock)
│       │   │   │       └── user/        # 사용자 화면 (Mock)
│       │   │   ├── (current)/current/   # 실제 API 연결 (Current)
│       │   │   │   └── (sar)/sar/
│       │   │   │       ├── admin/
│       │   │   │       └── user/
│       │   │   ├── _shared/             # plan/current 공통 컴포넌트
│       │   │   ├── api/                 # Next.js Route Handler (BFF용, 필요 시)
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx             # 루트: /current/sar/user/search 로 리다이렉트
│       │   │   ├── not-found.tsx
│       │   │   ├── error.tsx
│       │   │   └── global-error.tsx
│       │   ├── _hooks/                  # 전역 훅 (usePlanCurrentPathContext 등)
│       │   ├── _ui/                     # 전역 UI 프리미티브 (Button, Modal 등)
│       │   └── _utils/                  # 전역 유틸 (date, format 등)
│       ├── public/
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
└── libs/
    ├── domain/                 # (기존)
    ├── common/                 # (기존)
    └── api-contract/           # ★ DTO·Result 타입을 web 에서도 import
```

### 3.1 `plan` vs `current` 분리 원칙 (Lumir-ERP 계승)

| 구분 | `(planning)/plan` | `(current)/current` |
|------|-------------------|---------------------|
| 데이터 소스 | **Mock** (`_mocks/*.mock.ts`) | **실제 API** (`apps/api`) |
| 목적 | 기획·와이어프레임·시나리오 검증 | 실제 운영 화면 |
| 라우트 예 | `/plan/sar/user/search` | `/current/sar/user/search` |
| 구현 순서 | **먼저** 구현 → 화면 확정 | plan 확정 후 동일 UX로 API 연결 |
| 컴포넌트 재사용 | `_shared/` 및 `_ui/`의 순수 컴포넌트를 양쪽에서 공용 | 동일 |

**전환 로직**: `usePlanCurrentPathContext()` 훅이 현재 경로에서 `plan`/`current`를 판별하고, 서비스 레이어가 분기한다.

```typescript
// _hooks/usePlanCurrentPathContext.ts
export function usePlanCurrentPathContext(): 'plan' | 'current' {
    const pathname = usePathname();
    return pathname.startsWith('/plan/') ? 'plan' : 'current';
}

// (sar)/sar/user/search/_context/search-api.service.ts
export function useSearchApi() {
    const mode = usePlanCurrentPathContext();
    return mode === 'plan' ? mockSearchApi : realSearchApi;
}
```

### 3.2 도메인 폴더 내부 구조 (Lumir-ERP 계승)

각 도메인(예: `sar/user/search`) 폴더는 다음 하위 폴더로 구성한다:

| 하위 폴더 | 역할 | 파일 예 |
|-----------|------|---------|
| `_context/` | React Context + API 서비스 + 라우트 서비스 | `SearchContext.tsx`, `search-api.service.ts`, `search-route.service.ts` |
| `_context/_services/` | Context 내부 상태 분리 (state-service) | `search-filter.state-service.ts`, `search-results.state-service.ts` |
| `_ui/` | 섹션·모달·컴포넌트 (도메인 전용) | `SearchMap.section.tsx`, `SearchFilter.section.tsx`, `SceneDetail.modal.tsx` |
| `_hooks/` | 도메인 전용 커스텀 훅 | `useSearchDebounce.ts` |
| `_mocks/` | Mock 데이터 (plan 모드 전용) | `scenes.mock.ts`, `regions.mock.ts` |
| `_services/` | 비-Context 서비스 (helpers) | `scene-format.service.ts` |
| `_types/` | 도메인 타입 | `scene.type.ts`, `search-filter.type.ts` |

### 3.3 파일 네이밍 (Lumir-ERP 계승)

| 접미사 | 의미 | 예 |
|--------|------|-----|
| `.section.tsx` | 화면 큰 섹션(페이지 내 주요 블록) | `SearchMap.section.tsx` |
| `.modal.tsx` | 모달/팝업 (URL 미변경 Layer) | `SceneDetail.modal.tsx` |
| `.component.tsx` | 재사용 가능한 작은 컴포넌트 | `FootprintBadge.component.tsx` |
| `.state-service.ts` | Context 내부 상태 서비스 (useState 래퍼) | `search-filter.state-service.ts` |
| `.api.service.ts` | HTTP 호출 레이어 | `search-api.service.ts` |
| `.route.service.ts` | 라우트 전환 헬퍼 | `search-route.service.ts` |
| `.mock.ts` | Mock 데이터 | `scenes.mock.ts` |
| `.type.ts` | 타입 정의 | `scene.type.ts` |
| `.hook.ts` 또는 `useXxx.ts` | 훅 | `useSearchDebounce.ts` |

---

## 4. 사용자/관리자 화면 분리

Lumir-ERP의 `cms/admin`(사무실 관리)과 `cms/user`(내 콘텐츠) 분리 패턴을 그대로 계승한다.

### 4.1 역할 매트릭스

| 역할 | 진입 경로 | 접근 가능 영역 |
|------|-----------|---------------|
| `viewer` | `/current/sar/user/search` | 검색, 장바구니(즉시 다운로드는 불가) |
| `downloader` | `/current/sar/user/*` | 검색·장바구니·다운로드·공공데이터·알림 |
| `admin` | `/current/sar/admin/*` + `user/*` | 전체 |

미들웨어(`middleware.ts`)에서 JWT 파싱 → 역할별 경로 가드.

### 4.2 1 Depth 사이드바 구성

**사용자(`/sar/user`)**:
- 검색 (Search)
- 장바구니 (Cart)
- 내 다운로드 (My Downloads)
- 공공데이터 (Public Datasets) — SHP 업로드 포함
- 알림 (Notifications)

**관리자(`/sar/admin`)**:
- 사용자 관리 (Users)
- 다운로드 승인 큐 (Approvals)
- 크롤 대상 AOI (Crawl Targets)
- 공공데이터 관리 (Public Datasets Admin)
- 시스템 대시보드 (Dashboard)
- 메타데이터 Sync 모니터 (Sync Monitor)
- 감사 로그 (Audit Logs)

---

## 5. 핵심 화면 레이아웃 (2분할 본문 + 우측 오버레이 장바구니)

검색 화면(`SAR_SRH_MAIN`)의 기본 레이아웃:

```
┌───────────────────────────────────────────────────────────────┐
│  Header / 상단 탭바                                              │
│  [로고] [Search] [Downloads] [Public] [Insar] ...  [🔔] [🛒N] [👤] │
├─────────────┬─────────────────────────────────────────────────┤
│             │                                                 │
│  필터 패널    │          지도 (OpenLayers)                         │
│  (좌, 300px) │  (중앙·우측 가변)                                    │
│             │  - 배경: OSM                                         │
│  - 날짜       │  - AOI 드로잉 툴바                                   │
│  - 미션       │  - footprint 레이어(hover 연동)                      │
│  - 제품 타입   │  - 우측 하단: 좌표/줌                                 │
│  - 지역 선택   │                                                 │
│  - 새로고침    │                                                 │
│             │                                                 │
├─────────────┴─────────────────────────────────────────────────┤
│  결과 리스트 (하단, 높이 가변 · 드래그로 조절)                          │
│  - NAS 보유 / 다운로드 필요 뱃지 · 정렬 · 페이지네이션                    │
└───────────────────────────────────────────────────────────────┘

          ▲ [🛒N] 클릭 시 우측에서 슬라이드되는 오버레이 패널
          │       (아래 §5.1 참조)
```

- **hover/선택 연동**: 지도 footprint ↔ 리스트 row ↔ 장바구니 아이템이 같은 `sceneId`로 Context에서 연결
- **AOI 드로잉 툴바**: `bbox`, `polygon`, `지역 선택`, `SHP 업로드`, `전체 화면` 5개 도구
- **검색 상태 URL 직렬화**: 필터·bbox·cursor를 `search_params`에 담아 **공유 URL** 가능 (ASF Vertex 계승)

### 5.1 장바구니 — 상단 탭바 아이콘 + 우측 오버레이 패널

장바구니는 **모든 화면에서 동일하게** 헤더(상단 탭바) **우측 아이콘**으로 접근한다. 검색 화면의 고정 우측 컬럼을 차지하지 않으며, 지도 영역을 최대한 넓게 확보한다.

```
 Header ──────────────────────────────────────── [🔔] [🛒 3] [👤] ──
                                                        │
                                                        ▼ 클릭
 ┌─────────────────────────────────────────┐┌──────────────────────┐
 │                                         ││ 🛒 장바구니  3건   [×] │  ← 오버레이 패널
 │   본문(지도·리스트·현재 화면 그대로)          ││  ─────────────────  │    (width 420px,
 │   어두워짐 (backdrop rgba(0,0,0,.25))      ││  요약: 3건 · 1.2GB   │     모바일 100%,
 │                                         ││  NAS 보유 2 / 필요 1  │     z-index 60)
 │                                         ││  ─────────────────  │
 │                                         ││  ■ S1A_..._abc   [×]  │
 │                                         ││    mission · size   │
 │                                         ││  ■ S1A_..._def   [×]  │
 │                                         ││  ...                │
 │                                         ││  ─────────────────  │
 │                                         ││  [일괄 다운로드]      │
 │                                         ││  [전체 비우기]        │
 └─────────────────────────────────────────┘└──────────────────────┘
```

**동작 규칙**:
- **위치**: 상단 탭바 우측 고정 영역. 순서(좌→우) = `알림 종 아이콘 → 장바구니 🛒 → 사용자 메뉴`
- **뱃지**: 아이콘 우상단에 담긴 개수 표시 (0건이면 뱃지 숨김). 개수는 `localStorage` 기반 장바구니 상태(`cart.store.ts`)와 동기화
- **트리거**: 아이콘 클릭, 또는 단축키 `c`
- **오픈 애니메이션**: 우측에서 슬라이드 인(transform: translateX), 200ms ease-out
- **배경**: 반투명 backdrop(`rgba(0,0,0,0.25)`) — 본문 위에 덮이지만 본문 상호작용은 blocked (스크롤 locked)
- **닫기**: [×] 버튼 / 배경 클릭 / `ESC`
- **URL 비변경**: Layer 성격 (SAR_CRT_PANEL). 브라우저 뒤로가기는 패널만 닫음
- **너비**: 데스크톱 `420px`, 태블릿 `380px`, 모바일 `100vw`
- **장바구니 전체 페이지**(`/sar/user/cart` · `SAR_CRT_MAIN`)는 별도 Page로 유지 — 패널 하단 [전체 화면으로 보기] 링크 제공. 일괄 다운로드 요청 직후 이동 등 Page가 필요한 상황에서 사용
- **검색 이외 화면**(다운로드/공공데이터/알림 등)에서도 동일 아이콘·동일 패널이 뜬다 (전역 컴포넌트 `_ui/header/CartPanel.overlay.tsx`)
- **접근성**: `role="dialog"` + `aria-modal="true"`, 열릴 때 focus를 패널 내부 첫 요소로 이동, 닫힐 때 트리거 아이콘으로 복귀

---

## 6. 공공데이터/SHP 업로드 플로우

사용자가 **공공데이터포털·행정안전부·기상청** 등에서 받은 Shapefile을 업로드하여 AOI로 사용하거나, 공유 데이터셋으로 등록한다.

### 6.1 프론트 측 처리

1. 사용자가 `.zip` (shp+shx+dbf+prj 포함) 드래그앤드롭
2. 브라우저에서 `shpjs` 로 **로컬 파싱** → GeoJSON 변환
3. **지도에 즉시 미리보기** (OpenLayers `VectorSource` + `GeoJSON` format)
4. 속성 테이블 프리뷰 (상위 10행)
5. 사용자가 좌표계 확인 (prj → EPSG 자동 감지, 미지원 시 안내)
6. [AOI로 사용] 버튼 → 검색 화면으로 바로 이동 (현재 선택 영역에 주입)
7. [공용 데이터셋으로 업로드] → 서버로 zip 원본 + 메타(이름/설명) POST

### 6.2 백엔드 측 (신규 API — §7 참조)

- 서버에서 다시 파싱(검증용) → `public_datasets` 테이블 저장 (geom: PostGIS `geometry(MultiPolygon, 4326)`)
- 단일 폴리곤이 아니면 `multi_polygon`로 저장
- 원본 zip은 NAS `/public-datasets/{id}.zip`에 보관 (감사용)

### 6.3 관리자 화면

- 업로드된 공용 데이터셋 전체 목록
- 공개/비공개 토글
- 삭제 (연결된 검색 이력 유지)
- 전체 다운로드 (zip 재다운)

---

## 7. 신규 백엔드 API (본 문서 요구로 추가 필요)

`docs/05-api-spec.md`에 추가해야 할 엔드포인트 목록 — 프론트 설계 후 백엔드 담당자가 스펙 확정한다.

| 엔드포인트 | 용도 | 권한 |
|-----------|------|------|
| `POST /public-datasets` | SHP zip 업로드 (multipart) | `downloader`+ |
| `GET /public-datasets` | 공공데이터셋 목록 (본인 업로드 + 공개된 것) | 인증 |
| `GET /public-datasets/{id}` | 상세 (GeoJSON geom 포함) | 인증 |
| `GET /public-datasets/{id}/download` | 원본 zip 재다운 | 소유자 or admin |
| `PATCH /admin/public-datasets/{id}` | 공개/비공개 토글 | admin |
| `DELETE /admin/public-datasets/{id}` | 삭제 | admin |
| `POST /scenes/search-by-dataset` | `{ dataset_id }` 로 검색 (bbox 대신) | `viewer`+ |
| `GET /admin/audit-logs` | 감사 로그 조회 (cursor 페이지네이션) | admin |
| `GET /admin/sync-status` | 크롤 커버리지·최근 sync 시각 | admin |

---

## 8. 상태 관리 전략

| 상태 종류 | 도구 | 예 |
|----------|------|-----|
| **서버 상태** (scenes, downloads, users) | TanStack Query | `useQuery(['scenes', filter])` |
| **UI 상태** (현재 모달·선택된 scene·필터 폼) | React Context + state-service | `SearchContext` |
| **URL 상태** (검색 조건, 공유 가능) | `useSearchParams` + 직렬화 | `?bbox=...&date_from=...` |
| **WebSocket 이벤트** (알림) | `socket.io-client` + Context | `NotificationContext` |
| **영속 로컬 상태** (장바구니, 마지막 알림 ID) | `localStorage` + 초기화 훅 | `cart.store.ts` |

---

## 9. 에러 처리

- NestJS 표준 응답(`{statusCode, message, error, code?, details?}`)을 `ApiError` 클래스로 래핑
- `code` 필드는 `docs/13-error-codes.md` 레지스트리와 매칭
- 주요 `code` 별 프론트 대응:
  - `QUOTA_EXCEEDED` → 쿼터 모달 (사용량/한도 표시)
  - `APPROVAL_REQUIRED` → "100개 초과 → 승인 대기" 안내 토스트
  - `IP_NOT_ALLOWED` → 로그인 화면으로 리다이렉트 + 안내
  - 그 외 5xx → 에러 바운더리 (`error.tsx`)

---

## 10. 빌드·배포

- `apps/web`는 **Next.js standalone** 모드로 빌드 (`output: 'standalone'`)
- Docker 이미지로 패키징 → `docker-compose.yml`에 추가
- 환경 변수:
  - `NEXT_PUBLIC_API_BASE_URL` — API 서버 base URL
  - `NEXT_PUBLIC_WS_URL` — WebSocket URL
  - `NEXT_PUBLIC_OSM_TILE_URL` — 대체 타일 서버 (사내망용, optional)

---

## 11. 다음 문서

- [16. 프론트엔드 유즈케이스](./16-frontend-usecases.md) — UC 코드 표 (admin/user)
- [17. 프론트엔드 IA](./17-frontend-ia.md) — Screen ID 체계, Page/Layer, 정책
