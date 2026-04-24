# 18. InSAR 분석 산출물 대비 설계

> **Version:** 0.1 (준비 문서) | **최종 수정일:** 2026-04-24
> **상태**: `DInSAR`, `SBAS`는 현재 분석 중으로 **금방 추가 가능**. `PSInSAR`는 후속.
>
> | 버전 | 날짜 | 변경 내용 |
> | --- | --- | --- |
> | 0.1 | 2026-04-24 | 초안 — 향후 도입 대비용 개요 (데이터 모델 · API · 프론트 화면) |

본 문서는 **Sentinel-1 원본 scene을 재료로 생성되는 InSAR 분석 산출물**(DInSAR / SBAS / PSInSAR)을 플랫폼이 수용할 때를 대비한 설계 초안이다. 지금 구현하지 않되, 백엔드 스키마·API·프론트 폴더 구조를 **확장 가능한 모양으로** 미리 잡아 두기 위한 문서다.

---

## 1. 용어와 산출물 특성

| 기법 | 입력 | 핵심 출력 | 데이터 유형 | 공간 표현 |
|------|------|----------|-------------|----------|
| **DInSAR** (Differential InSAR) | SLC 2매 (master/slave) | 위상 간섭도(wrapped), 언랩된 위상, 변위(LOS, mm), 코히런스 | 래스터 (GeoTIFF, 여러 밴드) | 픽셀 단위 2D 격자 |
| **SBAS** (Small Baseline Subset) | SLC N매 (시계열, N ≥ 15 권장) | **픽셀별 시계열 변위**, 평균 속도 맵(mm/yr), RMSE 맵 | 래스터(GeoTIFF 스택) + 픽셀 시계열(NetCDF/Zarr) | 2D 격자 + 각 픽셀마다 시계열 벡터 |
| **PSInSAR** (Persistent Scatterer) | SLC N매 (N ≥ 25 권장) | **희소 포인트**(위·경도·고도·속도·시계열) | 포인트 클라우드 (CSV/GeoJSON/Parquet) | 벡터 포인트 (수만~수백만) |

### 1.1 공통 속성

- **좌표계**: EPSG:4326 (프로덕트 최종). 처리 중간에는 SAR 좌표계(range/azimuth) 또는 UTM → 평면 출력 시 EPSG:4326 래핑
- **LOS 방향 벡터** (incidence, heading angle): 변위 해석 시 필수. 메타에 포함
- **시계열 축**: SBAS/PSInSAR는 `time_series[]` = `{ date, value_mm }` 배열
- **출력 용량**:
  - DInSAR 1세트: ~500MB (한 interferogram, 여러 밴드)
  - SBAS 1세트: ~5-20GB (시계열 stack)
  - PSInSAR 1세트: ~50-500MB (포인트 수에 비례)

---

## 2. 데이터 모델 (DB 스키마 확장 초안)

`02-database-schema.md`에 **추가될 테이블**. 실제 확정 시점까지 이 섹션이 참조 스펙.

### 2.1 `insar_products` (공통 상위 테이블)

```sql
CREATE TABLE insar_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(16) NOT NULL CHECK (product_type IN ('DINSAR', 'SBAS', 'PSINSAR')),
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- 공간 범위 (AOI)
    footprint geometry(Polygon, 4326) NOT NULL,
    bbox geometry(Polygon, 4326) GENERATED ALWAYS AS (ST_Envelope(footprint)) STORED,

    -- 시간 범위
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,

    -- 처리 메타
    mission VARCHAR(4) NOT NULL,            -- 예: 'S1A'
    processing_params JSONB NOT NULL,        -- 기법별 파라미터 (multilook factor, filter window 등)
    los_vector JSONB,                        -- {incidence_deg, heading_deg}

    -- 산출물 저장
    nas_path TEXT NOT NULL,                  -- 기본 데이터 경로 (GeoTIFF stack root)
    quicklook_nas_path TEXT,                 -- 미리보기 PNG (평균 변위)
    total_size_bytes BIGINT NOT NULL DEFAULT 0,

    -- 관계
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 가시성
    is_public BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_insar_products_footprint ON insar_products USING GIST(footprint);
CREATE INDEX idx_insar_products_type_date ON insar_products(product_type, date_from DESC, date_to DESC);
CREATE INDEX idx_insar_products_creator ON insar_products(created_by);
```

### 2.2 `insar_source_scenes` (원본 scene 연결)

산출물이 사용한 Sentinel-1 scene 목록. 계보(lineage) 추적용.

```sql
CREATE TABLE insar_source_scenes (
    insar_product_id UUID REFERENCES insar_products(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES sentinel_scenes(id) ON DELETE RESTRICT,
    role VARCHAR(16) NOT NULL CHECK (role IN ('MASTER', 'SLAVE', 'STACK')),
    stack_order INT,                         -- SBAS/PSInSAR에서 N번째
    PRIMARY KEY (insar_product_id, scene_id, role)
);
```

### 2.3 `psinsar_points` (PSInSAR 전용 희소 포인트)

```sql
CREATE TABLE psinsar_points (
    id BIGSERIAL PRIMARY KEY,
    insar_product_id UUID NOT NULL REFERENCES insar_products(id) ON DELETE CASCADE,
    location geometry(Point, 4326) NOT NULL,
    elevation_m REAL,
    velocity_mm_yr REAL NOT NULL,            -- 평균 속도 (LOS)
    velocity_std_mm_yr REAL,
    coherence REAL,                          -- 0~1
    -- 시계열은 별도 테이블 또는 JSONB (용량에 따라)
    time_series JSONB                        -- [{t: 'YYYY-MM-DD', v: mm}, ...]
);

CREATE INDEX idx_psinsar_points_location ON psinsar_points USING GIST(location);
CREATE INDEX idx_psinsar_points_product ON psinsar_points(insar_product_id);
CREATE INDEX idx_psinsar_points_velocity ON psinsar_points(insar_product_id, velocity_mm_yr);
```

> **Note:** 포인트 수가 수백만이 넘으면 `time_series`는 별도 파일(Parquet/Zarr)로 빼고 요약값만 DB에 두는 것이 유리. 운영 시점에 결정.

### 2.4 `sbas_timeseries` (SBAS 픽셀 시계열 요약)

SBAS는 픽셀 수가 억 단위일 수 있어 **DB에는 메타와 타일 요약만**. 원본 시계열 stack은 NAS의 NetCDF/Zarr 파일 경로로만 참조한다.

```sql
CREATE TABLE sbas_tile_summaries (
    insar_product_id UUID REFERENCES insar_products(id) ON DELETE CASCADE,
    tile_z INT NOT NULL,
    tile_x INT NOT NULL,
    tile_y INT NOT NULL,
    min_velocity_mm_yr REAL,
    max_velocity_mm_yr REAL,
    mean_coherence REAL,
    PRIMARY KEY (insar_product_id, tile_z, tile_x, tile_y)
);
```

---

## 3. API 확장 초안

`05-api-spec.md`에 **추가될 엔드포인트**. 본 문서는 예정 스펙.

### 3.1 검색·조회

```
GET /api/v1/insar-products
    ?bbox=minx,miny,maxx,maxy
    &product_type=DINSAR,SBAS,PSINSAR
    &date_from=2025-01-01
    &date_to=2026-04-01
    &mission=S1A
    &limit=50&cursor=...
```

응답:
```json
{
  "items": [
    {
      "id": "uuid",
      "product_type": "DINSAR",
      "name": "Pohang subsidence 2025Q4",
      "footprint": { "type": "Polygon", "coordinates": [...] },
      "date_from": "2025-10-01",
      "date_to": "2025-12-30",
      "mission": "S1A",
      "total_size_bytes": 512000000,
      "quicklook_url": "/v1/insar-products/uuid/quicklook",
      "created_at": "2026-01-15T08:00:00Z",
      "source_scene_count": 2
    }
  ],
  "next_cursor": "...",
  "has_more": true
}
```

### 3.2 상세 (메타 + 원본 scene 목록)

```
GET /api/v1/insar-products/{id}
```

```json
{
  "id": "uuid",
  "product_type": "SBAS",
  "name": "Gyeongju SBAS 2024-2025",
  "footprint": { ... },
  "processing_params": {
    "multilook_range": 4,
    "multilook_azimuth": 1,
    "temporal_baseline_max_days": 60,
    "perp_baseline_max_m": 150,
    "coherence_threshold": 0.3
  },
  "los_vector": { "incidence_deg": 39.2, "heading_deg": -169.1 },
  "source_scenes": [
    { "scene_id": "uuid", "product_id": "S1A_...", "sensing_start": "...", "role": "STACK", "stack_order": 1 },
    ...
  ],
  "layers": [
    { "name": "mean_velocity", "url": "/v1/insar-products/uuid/raster/mean_velocity", "unit": "mm/yr", "colormap": "RdBu", "range": [-30, 30] },
    { "name": "coherence", "url": "...", "unit": "", "colormap": "viridis", "range": [0, 1] }
  ]
}
```

### 3.3 래스터 타일 서빙 (DInSAR/SBAS)

```
GET /api/v1/insar-products/{id}/tiles/{layer}/{z}/{x}/{y}.png
    ?colormap=RdBu&vmin=-30&vmax=30
```

- PNG 256x256 타일, on-the-fly rendering
- 서버는 NAS의 GeoTIFF를 titiler 등으로 타일화 (또는 사전 생성)
- 프론트는 OpenLayers `XYZ` 소스로 바로 붙임

### 3.4 PSInSAR 포인트 조회 (viewport 기반)

```
POST /api/v1/insar-products/{id}/points
Body: { bbox: [minx,miny,maxx,maxy], velocity_range?: [min,max], coherence_min?: 0.7, limit: 10000 }
```

응답: GeoJSON `FeatureCollection`.

> **성능 노트**: 포인트가 수십만 넘으면 WebGL 렌더링 필수. 프론트는 `ol/layer/WebGLPoints` 로 처리.

### 3.5 픽셀/포인트 시계열

```
GET /api/v1/insar-products/{id}/timeseries
    ?lng=129.123&lat=35.456
    # 또는
    ?point_id=12345
```

```json
{
  "location": { "lng": 129.123, "lat": 35.456 },
  "coherence": 0.82,
  "series": [
    { "t": "2024-01-05", "v": 0.0 },
    { "t": "2024-01-17", "v": -1.2 },
    ...
  ],
  "unit": "mm",
  "reference_date": "2024-01-05"
}
```

### 3.6 다운로드

```
GET /api/v1/insar-products/{id}/download?format=geotiff|netcdf|csv&layer=mean_velocity
```

쿼터는 원본 scene 다운로드와 **분리된 카운터**로 관리 (InSAR 산출물은 크기가 작음).

### 3.7 생성 요청 (파이프라인 트리거 — 후속)

```
POST /api/v1/admin/insar-jobs
Body: {
  product_type: "DINSAR",
  master_scene_id: "uuid",
  slave_scene_id: "uuid",
  name: "...",
  processing_params: { ... }
}
```

- `insar_jobs` 테이블에 QUEUED 상태로 INSERT
- 별도 처리 워커(`apps/insar-worker`)가 소비
- 완료 시 `insar_products` 레코드 생성 + 알림

---

## 4. 프론트엔드 화면 (IA 확장 초안)

`17-frontend-ia.md`에 **추가될 SAR_INS 영역**.

### 4.1 영역 코드

| 코드 | 의미 | 경로 |
|------|------|------|
| `INS` | InSAR 분석 산출물 (User) | `/sar/user/insar` |
| `INSA` | InSAR 관리 (Admin, 생성 잡 포함) | `/sar/admin/insar` |

### 4.2 User 화면

| Screen ID | Type | 경로 | 설명 | 비고 |
|-----------|------|------|------|------|
| `SAR_INS_LIST` | Page | `/sar/user/insar` | 산출물 목록 + 지도 footprint 오버레이 | 필터: product_type, bbox, 날짜 |
| `SAR_INS_DTL` | Page | `/sar/user/insar/[id]` | 상세 뷰어 — 지도 + 레이어 선택 + 시계열 패널 | 아래 §4.3 상세 |
| `SAR_INS_TS` | Layer | — | 픽셀/포인트 시계열 차트 모달 | 클릭 시 열림, 여러 점 동시 비교 가능 |
| `SAR_INS_LEGEND` | Layer | — | 컬러맵/범례 토글 패널 | vmin/vmax, colormap 프리셋 |
| `SAR_INS_DL` | Layer | — | 다운로드 포맷 선택 모달 | GeoTIFF / NetCDF / CSV |
| `SAR_INS_SOURCES` | Layer | — | 원본 scene 목록 모달 | 각 scene 상세로 점프 가능 |

### 4.3 상세 뷰어 (`SAR_INS_DTL`) 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  Header (산출물명 · 타입 뱃지 · [다운로드] · [원본 scene])         │
├─────────────┬────────────────────────────────────────────────┤
│  레이어 패널  │   지도 (OpenLayers)                               │
│  - mean_vel │   - 배경 OSM                                      │
│  - coh      │   - 래스터 타일 레이어 (선택 레이어)                   │
│  - cumulat. │   - PSInSAR: WebGLPoints                          │
│             │   - 클릭 시 커서 위치 시계열 요청                     │
│  컬러맵 설정 │                                                 │
│  - preset   │                                                 │
│  - vmin/max │                                                 │
│  - opacity  │                                                 │
├─────────────┴────────────────────────────────────────────────┤
│  시계열 패널 (아래 슬라이드, 높이 가변)                              │
│  - X: 날짜, Y: 변위(mm)                                         │
│  - 여러 점 오버레이 (최대 5개, 색상 구분)                            │
│  - [CSV 내보내기]                                                │
└──────────────────────────────────────────────────────────────┘
```

**인터랙션**:
- 지도 클릭(DInSAR/SBAS 래스터) → 픽셀 시계열 요청 → 시계열 패널에 추가
- 지도 클릭(PSInSAR 포인트) → 포인트 시계열 요청 → 시계열 패널에 추가
- 동일 점 재클릭 시 시계열에서 제거
- 점 색상은 시계열 패널의 legend와 동일

### 4.4 Admin 화면 (후속)

| Screen ID | Type | 경로 | 설명 |
|-----------|------|------|------|
| `SAR_INSA_LIST` | Page | `/sar/admin/insar` | 전체 산출물 목록 + 생성 잡 큐 |
| `SAR_INSA_JOB` | Page | `/sar/admin/insar/jobs` | 생성 잡 상태 모니터링 (QUEUED/RUNNING/DONE/FAILED) |
| `SAR_INSA_NEW` | Layer | — | 신규 DInSAR/SBAS/PSInSAR 잡 생성 모달 (master/slave 또는 stack 선택) |
| `SAR_INSA_PUB` | Layer | — | 공개/비공개 토글 |

---

## 5. 유즈케이스 프리뷰 (16-frontend-usecases.md 확장 초안)

| UC ID | 유즈케이스명 | 역할 |
|-------|-------------|------|
| UC-INS01 | InSAR 산출물 목록 조회 | User |
| UC-INS02 | 산출물 상세 뷰어 진입 | User |
| UC-INS03 | 레이어 전환 (변위/코히런스/누적변위) | User |
| UC-INS04 | 컬러맵·범위·투명도 조정 | User |
| UC-INS05 | 픽셀/포인트 클릭으로 시계열 조회 | User |
| UC-INS06 | 다중 포인트 시계열 비교 | User |
| UC-INS07 | 시계열 CSV 내보내기 | User |
| UC-INS08 | 원본 scene 목록 확인 | User |
| UC-INS09 | 산출물 다운로드 (GeoTIFF/NetCDF/CSV) | Downloader+ |
| UC-INSA01 | 생성 잡 큐 조회 | Admin |
| UC-INSA02 | DInSAR 잡 생성 (master/slave 선택) | Admin |
| UC-INSA03 | SBAS 잡 생성 (stack 선택 + 베이스라인 제약) | Admin |
| UC-INSA04 | PSInSAR 잡 생성 | Admin |
| UC-INSA05 | 산출물 공개/비공개 전환 | Admin |
| UC-INSA06 | 산출물 삭제 | Admin |

---

## 6. 프론트엔드 폴더 구조 (추가될 위치)

```
apps/web/src/app/
├── (planning)/plan/(sar)/sar/user/insar/
│   ├── _context/
│   │   ├── InsarListContext.tsx
│   │   ├── InsarViewerContext.tsx        # 상세 뷰어 전용
│   │   ├── insar-api.service.ts
│   │   └── _services/
│   │       ├── layer-control.state-service.ts
│   │       └── timeseries-panel.state-service.ts
│   ├── _ui/
│   │   ├── InsarListMap.section.tsx
│   │   ├── InsarDetailMap.section.tsx
│   │   ├── LayerPanel.section.tsx
│   │   ├── ColormapLegend.component.tsx
│   │   ├── TimeSeriesChart.section.tsx
│   │   ├── PointSelector.component.tsx
│   │   ├── SourceScenes.modal.tsx
│   │   └── DownloadFormat.modal.tsx
│   ├── _mocks/
│   │   ├── insar-products.mock.ts
│   │   ├── psinsar-points.mock.ts
│   │   └── timeseries.mock.ts
│   ├── _types/
│   │   ├── insar-product.type.ts
│   │   └── timeseries.type.ts
│   ├── page.tsx                           # SAR_INS_LIST
│   └── [id]/page.tsx                      # SAR_INS_DTL
└── (planning)/plan/(sar)/sar/admin/insar/
    ├── _context/
    ├── _ui/
    ├── _mocks/
    ├── page.tsx                           # SAR_INSA_LIST
    └── jobs/page.tsx                      # SAR_INSA_JOB
```

### 6.1 지도 렌더링 구현 노트

- **DInSAR/SBAS 래스터 레이어**: `ol/source/XYZ` + `/insar-products/{id}/tiles/{layer}/{z}/{x}/{y}.png` URL 템플릿
- **PSInSAR 포인트 레이어**: `ol/source/Vector` + **수십만 포인트 시 `ol/layer/WebGLPoints`** 로 전환 (Canvas는 1만 이상 성능 저하)
- **컬러맵**: 서버에서 PNG로 미리 렌더하거나, 클라이언트 셰이더(WebGL)에서 `colorramp` + `value` → `rgba` 계산
- **3D 필요성 재검토**: SBAS 시계열을 3D로 보는 수요가 생기면 `15-frontend-architecture.md §2`의 하이브리드 방안(해당 화면만 MapLibre) 재검토

### 6.2 시계열 차트 라이브러리

- 후보: `recharts`, `visx`, `uplot`
- **uplot** 추천: 점 수천 × 시계열 여러 개 그려도 매끄럽다. 번들 작음(~40KB)
- 종속성 추가는 **InSAR 뷰어 도입 시점**에 결정 (지금은 확정 X)

---

## 7. 백엔드 처리 파이프라인 (초안)

- 새 NestJS 앱: **`apps/insar-worker`**
  - HTTP 없음, `createApplicationContext`
  - `pgmq.insar_queue`에서 pull
  - 내부적으로 외부 툴 호출: **SNAP GPT / MintPy / StaMPS / ISCE2** (Docker 이미지로 감싸서 exec)
  - 결과물을 NAS에 배치 + DB 등록 + 알림
- **중요**: 처리 시간이 길다(DInSAR 30분~수시간, SBAS 수시간~수일). 잡 상태 중간 percent 갱신 필수.

| 단계 | 기술 후보 |
|------|----------|
| 전처리·coregistration | SNAP GPT (Graph Processing Tool), CLI |
| 간섭도 생성 | SNAP 또는 ISCE2 |
| 언래핑 | SNAPHU |
| 시계열 분석 (SBAS/PSInSAR) | MintPy (GUI 없이 python API) 또는 StaMPS |
| 결과 변환 | GDAL (GeoTIFF), xarray (NetCDF) |

본 문서는 **프로덕트 레이어 설계**에 집중하고, 파이프라인 세부는 도입 시점에 별도 문서로.

---

## 8. 도입 순서 제안

| 단계 | 범위 | 의존성 |
|------|------|-------|
| **Step 1** — DInSAR 조회만 | DB 스키마(2.1, 2.2) + API(3.1, 3.2, 3.3, 3.6) + 화면(SAR_INS_LIST, SAR_INS_DTL 래스터 전용) | 없음 (외부 파이프라인으로 이미 만든 산출물을 등록하는 수준) |
| **Step 2** — SBAS 시계열 추가 | 3.5 시계열 API + 시계열 패널 UI | Step 1 완료 |
| **Step 3** — PSInSAR 추가 | 2.3 포인트 테이블 + 3.4 포인트 API + WebGL 렌더 | Step 2 완료 |
| **Step 4** — 생성 잡 트리거 | `insar_jobs` 큐 + `apps/insar-worker` + SAR_INSA_* 화면 | 사내 파이프라인 Docker화 필요 |

**DInSAR·SBAS가 금방 추가될 수 있다는 점**을 고려해, 다음은 **지금 당장 반영**해 두면 후속 비용이 준다:
- `insar_products` / `insar_source_scenes` 테이블만 마이그레이션에 미리 만들어 두기 (비어 있어도 무방)
- `16-frontend-usecases.md`에 `UC-INS01~INS09`를 **플레이스홀더로 등록** (아직 구현 X, 문서만)
- `17-frontend-ia.md`에 `SAR_INS_LIST`/`SAR_INS_DTL` **ID 예약**

---

## 9. 열린 질문

- **좌표계**: 내부 저장은 UTM / WGS84 중 무엇이 주력? (보통 UTM이 SAR 해석에 유리)
- **파일 포맷**: GeoTIFF / COG / NetCDF / Zarr 중 주력? (OGC COG는 클라우드 네이티브에 유리)
- **재참조 (reference point)**: SBAS의 reference date·point를 사용자가 바꿀 수 있게 할 것인가? (서버 재계산 필요)
- **좌표 기반 시계열 vs 포인트 ID 기반**: 클릭 지점이 PSInSAR 포인트가 아닌 경우 어떻게 응답? (가장 가까운 포인트? 보간?)
- **쿼터**: 원본 scene 다운로드와 분리된 카운터 필요 여부

---

## 10. 참고 문서

- [02. 데이터베이스 스키마](./02-database-schema.md) — 스키마 확장 예정 위치
- [05. API 명세](./05-api-spec.md) — 엔드포인트 확장 예정 위치
- [15. 프론트엔드 아키텍처](./15-frontend-architecture.md) — 지도 라이브러리 결정 맥락
- [16. 프론트엔드 유즈케이스](./16-frontend-usecases.md) — UC-INS* 확장 예정
- [17. 프론트엔드 IA](./17-frontend-ia.md) — SAR_INS_*/SAR_INSA_* 확장 예정
