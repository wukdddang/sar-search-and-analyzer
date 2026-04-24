# 05. API 명세

## 공통 사항

- **Base URL**: `https://api.example.com/api/v1`
- **인증**: `Authorization: Bearer <JWT>` 헤더
- **콘텐츠 타입**: `application/json`
- **타임스탬프**: ISO 8601 UTC (예: `2026-04-23T14:30:00Z`)
- **좌표**: EPSG:4326 경위도 (경도, 위도 순)
- **응답 포맷**: raw DTO/Result (래퍼 없음)
- **필드 명명**: snake_case (`sensing_start`, `nas_path`)

## 에러 응답 포맷

**NestJS 기본 `HttpException` 형식을 그대로 사용**. 커스텀 래퍼 없음.

```json
// 일반 케이스 — NotFoundException, ConflictException 등
{
    "statusCode": 404,
    "message": "씬을 찾을 수 없습니다.",
    "error": "Not Found"
}
```

```json
// 검증 실패 (ValidationPipe) — message가 배열
{
    "statusCode": 400,
    "message": [
        "bbox는 minx,miny,maxx,maxy 형식이어야 합니다",
        "date_from은 유효한 ISO 날짜여야 합니다"
    ],
    "error": "Bad Request"
}
```

```json
// 도메인 특수 (QUOTA_EXCEEDED 등) — code, details 필드 확장
{
    "statusCode": 429,
    "message": "일일 다운로드 쿼터를 초과했습니다.",
    "error": "Quota Exceeded",
    "code": "QUOTA_EXCEEDED",
    "details": { "used_bytes": 50000000000, "limit_bytes": 50000000000 }
}
```

| HTTP | 의미 |
|------|------|
| 400 | 파라미터 오류 |
| 401 | 미인증 |
| 403 | 권한 부족 또는 IP 차단 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 요청 등) |
| 429 | 쿼터 초과 |
| 500 | 서버 오류 |
| 503 | 외부 시스템(Copernicus/NAS) 장애 |

---

## 인증

### `POST /auth/register`

**권한**: 공개 (IP 허용 목록만 통과하면 됨)

```json
// Request
{
    "email": "user@example.com",
    "password": "StrongP@ssw0rd!",
    "display_name": "홍길동"
}

// Response 201
{
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "홍길동",
    "role": "viewer",
    "is_active": false,
    "created_at": "2026-04-23T10:00:00Z",
    "message": "관리자 승인 후 로그인할 수 있습니다."
}
```

**동작**:
- `is_active = false` 로 생성 → 관리자 승인 대기
- 비밀번호 정책: 최소 10자, 영문+숫자+특수문자 혼합 ([06-auth.md](./06-auth.md))
- 중복 이메일은 `409 Conflict`
- 관리자에게 승인 요청 알림 발송
- 응답 시 `password_hash`는 절대 노출하지 않음

### `POST /auth/login`

```json
// Request
{ "email": "user@example.com", "password": "..." }

// Response 200
{
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 3600,
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "role": "downloader"
    }
}
```

**실패 케이스**:
- 이메일/비밀번호 불일치 → `401 Unauthorized` (메시지는 모호하게: "이메일 또는 비밀번호가 올바르지 않습니다")
- `is_active = false` → `401 Unauthorized` + 별도 메시지 ("계정 승인 대기 중입니다")

### `POST /auth/refresh`

```json
// Request
{ "refresh_token": "eyJ..." }

// Response 200
{ "access_token": "eyJ...", "expires_in": 3600 }
```

Refresh token rotation 적용 — 매번 새 refresh token도 함께 발급, 기존 토큰은 `replaced_by` 체인 기록 후 revoke. 이미 `replaced_by`가 있는 토큰 재제출 시 **도난 감지**로 해당 사용자의 모든 refresh 토큰 revoke ([06-auth.md](./06-auth.md), [02-database-schema.md](./02-database-schema.md#refresh_tokens)).

### `POST /auth/logout`

```json
// Request (헤더에 Bearer access_token)
{ "refresh_token": "eyJ..." }

// Response 204 No Content
```

해당 refresh token을 revoke. access token은 자연 만료.

---

## Scene 검색

### `GET /scenes`

Sentinel scene 메타데이터 검색. **다운로드는 트리거하지 않음**.

**쿼리 파라미터**:

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `bbox` | string | bbox 또는 region_code 중 하나 | `minx,miny,maxx,maxy` (경위도) |
| `region_code` | string | 위와 동일 | 행정구역 코드 (한국 한정) |
| `date_from` | ISO date | 필수 | 시작일 (촬영일 기준) |
| `date_to` | ISO date | 필수 | 종료일 |
| `mission` | string | 옵션 | 콤마 구분 (예: `S1A,S1C,S2A`). 기본 전체 |
| `product_type` | string | 옵션 | `GRD`, `SLC`, `L1C`, `L2A` 등 |
| `limit` | int | 옵션 | 기본 100, 최대 1000 |
| `offset` | int | 옵션 | 페이지네이션 |
| `force_refresh` | bool | 옵션 | `true` 시 Copernicus 강제 조회 |

**응답 예시**:

```json
{
  "total": 42,
  "limit": 100,
  "offset": 0,
  "sync_status": {
    "source": "db_cache",
    "last_synced_at": "2026-04-23T08:00:00Z"
  },
  "available_in_nas": [
    {
      "id": "uuid",
      "product_id": "S1A_IW_GRDH_1SDV_20260415T093245_...",
      "mission": "S1A",
      "product_type": "GRD",
      "sensing_start": "2026-04-15T09:32:45Z",
      "sensing_end": "2026-04-15T09:33:15Z",
      "footprint": { "type": "Polygon", "coordinates": [...] },
      "file_size_bytes": 987654321,
      "quicklook_url": "/v1/scenes/uuid/quicklook"
    }
  ],
  "download_required": [
    {
      "id": "uuid",
      "product_id": "S1A_...",
      "mission": "S1A",
      "sensing_start": "2026-04-18T09:30:00Z",
      "estimated_size_bytes": 980000000,
      "footprint": { ... }
    }
  ]
}
```

**주요 동작**:
- `sync_status.source`: `db_cache` | `copernicus_live` | `copernicus_forced`
- 결과는 `available_in_nas`와 `download_required`로 분리
- 응답 시간: 캐시 히트 ~50ms, live 조회 ~2-5초

---

## 다운로드

### `POST /downloads`

선택한 scene들의 다운로드를 큐에 등록.

**권한**: `downloader` 또는 `admin`

```json
// Request
{
  "scene_ids": ["uuid1", "uuid2", "uuid3"]
}

// Response 202 (승인 불필요)
{
  "jobs": [
    { "job_id": "uuid", "scene_id": "uuid1", "status": "QUEUED" },
    { "job_id": "uuid", "scene_id": "uuid2", "status": "QUEUED" }
  ],
  "already_available": ["uuid3"],
  "estimated_total_size_bytes": 1960000000
}

// Response 202 (승인 필요, 100개 초과)
{
  "jobs": [
    { "job_id": "uuid", "status": "PENDING_APPROVAL" }
  ],
  "message": "Approval required for requests over 100 scenes"
}

// Response 429
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily quota exceeded",
    "details": { "used_bytes": 50000000000, "limit_bytes": 50000000000 }
  }
}
```

### `GET /downloads/{job_id}`

개별 잡 상태 조회.

```json
{
  "job_id": "uuid",
  "scene_id": "uuid",
  "status": "RUNNING",
  "progress_percent": 45,
  "created_at": "2026-04-23T10:00:00Z",
  "started_at": "2026-04-23T10:00:12Z",
  "completed_at": null,
  "error_message": null
}
```

### `GET /downloads`

사용자의 잡 목록.

**쿼리 파라미터**: `status` (선택), `limit`, `offset`

---

## 파일 접근

### `GET /scenes/{scene_id}/file`

NAS에 있는 파일 다운로드 (프리사인드 URL 또는 스트리밍).

**권한**: `downloader` 이상

**응답**: 302 리다이렉트 또는 파일 스트림. NAS에 없으면 404.

### `GET /scenes/{scene_id}/quicklook`

썸네일 PNG 반환.

---

## 행정구역 (한국)

### `GET /regions`

행정구역 목록.

**쿼리 파라미터**:
- `country_code`: 기본 `KR`
- `admin_level`: 1, 2, 3 중 하나
- `parent_code`: 상위 지역 필터
- `q`: 이름 검색

```json
{
  "regions": [
    {
      "code": "4113500000",
      "name_local": "성남시",
      "name_en": "Seongnam-si",
      "admin_level": 2,
      "parent_code": "41000"
    }
  ]
}
```

---

## 관리자 API

권한: `admin`

### `GET /admin/users`

사용자 목록 조회.

### `PATCH /admin/users/{user_id}`

```json
{ "role": "downloader", "is_active": true }
```

### `GET /admin/jobs/pending`

승인 대기 중인 다운로드 요청 목록.

### `POST /admin/jobs/{job_id}/approve`

### `POST /admin/jobs/{job_id}/reject`

```json
{ "reason": "Request size exceeds available NAS capacity" }
```

### `GET /admin/crawl-targets`

### `POST /admin/crawl-targets`

```json
{
  "name": "Jeju Island",
  "geom": { "type": "Polygon", "coordinates": [...] },
  "missions": ["S1A", "S2A"],
  "interval_hours": 4
}
```

### `GET /admin/stats`

시스템 전반 통계 (큐 적체, 처리 속도, NAS 사용량 등).

---

## 알림 (WebSocket)

### `GET /ws/notifications`

WebSocket 연결. JWT를 `?token=...` 쿼리 또는 헤더로 전달.

**서버 → 클라이언트 이벤트**:

```json
{
  "type": "download_completed",
  "timestamp": "2026-04-23T10:15:00Z",
  "data": {
    "job_id": "uuid",
    "scene_id": "uuid",
    "product_id": "S1A_...",
    "nas_path": "/nas/sentinel/S1A/2026/04/23/..."
  }
}

{
  "type": "download_failed",
  "data": { "job_id": "uuid", "error": "Checksum mismatch" }
}
```

---

## 지번/필지 조회 (VWorld API 프록시)

> **기본 AOI 획득 경로** — 자세한 정책 배경은 [20. VWorld API 통합](./20-vworld-integration.md) 참조.

국토지리정보원 VWorld 공개 API를 백엔드 BFF가 프록시하여, 주소 → 필지 폴리곤(GeoJSON)을 반환한다. 프론트는 VWorld 인증키를 직접 다루지 않는다.

### `GET /api/v1/geo/search`

**권한**: `viewer`+

**Query**:
- `q` (필수): 주소 문자열 — 지번/도로명 모두 허용
- `type`: `parcel` (기본, 지번) | `road`
- `limit`: 1~20 (기본 5)

**응답 200**:
```json
{
    "query": "동천동 484-20",
    "candidates": [
        {
            "pnu": "4146510800104840020",
            "jibun": "484-20",
            "address": "경기도 용인시 수지구 동천동 484-20",
            "center": [127.0812, 37.322],
            "bbox": [127.0801, 37.3215, 127.0825, 37.3228]
        }
    ]
}
```

### `GET /api/v1/geo/parcel/{pnu}`

**권한**: `viewer`+

PNU(19자리 필지고유번호)로 필지 폴리곤을 조회. 서버는 `geo_parcels` 캐시 테이블을 먼저 확인하고, 미스 시 VWorld `LT_C_LDREG` WFS 호출.

**응답 200**:
```json
{
    "pnu": "4146510800104840020",
    "jibun": "484-20",
    "address": "경기도 용인시 수지구 동천동 484-20",
    "geometry": { "type": "Polygon", "coordinates": [[...]] },
    "bbox": [127.0801, 37.3215, 127.0825, 37.3228],
    "area_m2": 2345.6,
    "source": "VWorld:LT_C_LDREG",
    "fetched_at": "2026-04-24T12:30:00Z"
}
```

**에러**:
- `404 PARCEL_NOT_FOUND` — PNU 해당 필지 없음
- `429 VWORLD_QUOTA_EXHAUSTED` — 일일 호출 한도 초과 (캐시 히트만 응답)
- `503 VWORLD_UPSTREAM_DOWN` — VWorld 장애, 캐시 미스

### `POST /api/v1/aois/from-parcel`

**권한**: `viewer`+

PNU 폴리곤을 사용자 AOI로 저장.

**Body**:
```json
{
    "pnu": "4146510800104840020",
    "name": "용인 동천동 484-20"
}
```

**응답 201**: 기존 AOI 생성 응답과 동일 형태 + `source: "vworld:parcel"`.

### `POST /api/v1/aois/from-parcels`

여러 PNU → 단일 multi-polygon AOI 또는 개별 폴리곤 묶음으로 저장(`merge: true|false`).

---

## 공공데이터셋 (SHP 업로드) — DEPRECATED

> **1차 스프린트 범위에서 제외.** 연속지적도(LT_C_LDREG) 데이터는 VWorld API로 대체되었으며 ([20. VWorld API 통합](./20-vworld-integration.md)), SHP 업로드 경로는 비지적 경계(기상청 특보 영역, 행안부 특수 행정구역 등)가 필요할 때만 재개한다.
>
> 아래 스펙은 향후 보조 경로 재도입 시 참고용으로 보존.

사용자가 공공데이터포털·행안부·기상청 등에서 받은 Shapefile을 업로드해 AOI 후보로 저장. 상세 배경은 [15. 프론트엔드 아키텍처 §6](./15-frontend-architecture.md#6-공공데이터shp-업로드-플로우-deprecated) 참조.

### `POST /public-datasets`

**권한**: `downloader` 이상
**Content-Type**: `multipart/form-data`

| 파트 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | file | 필수 | `.zip` (shp+shx+dbf+prj). 최대 50MB |
| `name` | string | 필수 | 표시명. 최대 200자 |
| `description` | string | 옵션 | 2행 설명. 최대 1000자 |

**응답 201**:
```json
{
    "id": "uuid",
    "name": "성남시 행정동 경계",
    "description": "2025 행안부 공고",
    "geom": { "type": "MultiPolygon", "coordinates": [...] },
    "bbox": [127.07, 37.33, 127.22, 37.49],
    "feature_count": 42,
    "srid_source": "EPSG:5179",
    "size_bytes": 324000,
    "is_public": false,
    "uploaded_by": "uuid",
    "created_at": "2026-04-24T09:00:00Z"
}
```

**동작**:
- 서버가 zip 검증 → `shp` 파싱 (예: `shapefile` npm + `proj4`) → EPSG:4326으로 변환 → `public_datasets.geom` 저장
- 피처가 많거나 복잡하면 `ST_Simplify`로 경량화 버전을 별도 컬럼에 병행 저장 (지도 표시용)
- 원본 zip은 NAS `/public-datasets/{id}.zip`에 감사용 보관
- 좌표계 자동 감지 실패 시 `400 Bad Request` + `code: "UNSUPPORTED_SRID"`
- 크기/개수 한도 초과 시 `413 Payload Too Large`

### `GET /public-datasets`

**권한**: 인증

**쿼리 파라미터**:
- `scope`: `mine` (내가 업로드한 것만) / `public` / `all` (기본: `all`)
- `q`: 이름 검색
- `limit`, `offset`: 기본 offset 페이지네이션

```json
{
    "items": [
        {
            "id": "uuid",
            "name": "...",
            "bbox": [..., ..., ..., ...],
            "feature_count": 42,
            "is_public": true,
            "uploaded_by_display_name": "홍길동",
            "created_at": "..."
        }
    ],
    "total": 12,
    "limit": 50,
    "offset": 0,
    "has_more": false
}
```

### `GET /public-datasets/{id}`

**권한**: 인증 (public 또는 본인 업로드만 200, 그 외 403)

응답에 **GeoJSON** 전체 포함 (지도 미리보기용). 경량화 버전을 먼저 반환하고 `?full=true` 로 원본 geom 요청 가능.

### `GET /public-datasets/{id}/download`

**권한**: 본인 업로드 또는 `admin`

원본 zip 파일 스트리밍 또는 프리사인드 URL 302 리다이렉트.

### `DELETE /public-datasets/{id}`

**권한**: 본인 업로드 또는 `admin`

연결된 검색 이력은 유지, 원본 zip은 즉시 삭제하지 않고 30일 cleanup 대상.

### `POST /scenes/search-by-dataset`

데이터셋 geom을 AOI로 사용해 scene 검색.

```json
// Request
{ "dataset_id": "uuid", "date_from": "...", "date_to": "...", "mission": "S1A,S2A" }
```

응답은 `GET /scenes`와 동일 포맷.

**동작**: 서버가 `dataset.geom`에서 bbox 추출 또는 `ST_Intersects`로 직접 필터. `limit/cursor`는 쿼리 파라미터로 이어받는다.

---

## 관리자 API (추가)

### `PATCH /admin/public-datasets/{id}`

```json
// Request
{ "is_public": true }
```

공개 전환. 공개 시 모든 인증 사용자가 `GET /public-datasets`에서 조회 가능.

### `DELETE /admin/public-datasets/{id}`

소유자 관계없이 강제 삭제. 연결 이력은 유지.

### `GET /admin/audit-logs`

감사 로그 조회. **Cursor 기반 페이지네이션**.

**쿼리 파라미터**:
- `user_id`, `action`, `code`, `date_from`, `date_to`, `limit`, `cursor`

```json
{
    "items": [
        {
            "id": "uuid",
            "at": "2026-04-24T09:10:00Z",
            "user_id": "uuid",
            "user_email": "holder@example.com",
            "action": "download.request",
            "code": null,
            "ip": "10.0.1.42",
            "user_agent": "Mozilla/...",
            "request_id": "...",
            "payload": { "scene_ids": [...] }
        }
    ],
    "next_cursor": "...",
    "has_more": true
}
```

### `GET /admin/audit-logs/export.csv`

현재 필터 조건 기준 CSV 스트리밍. **최대 10만건**. 10만 초과 시 `413` + `code: "EXPORT_LIMIT_EXCEEDED"` 및 분할 쿼리 안내 메시지.

### `GET /admin/sync-status`

메타데이터 sync 현황.

```json
{
    "aois": [
        {
            "crawl_target_id": "uuid",
            "name": "한반도",
            "last_synced_at": "2026-04-24T08:00:00Z",
            "last_success": true,
            "new_scenes_last_24h": 42,
            "avg_duration_ms": 12000,
            "status": "healthy"            // healthy | stale | failing
        }
    ],
    "overall": {
        "oldest_sync_at": "2026-04-24T06:00:00Z",
        "stale_aoi_count": 0,
        "failing_aoi_count": 0
    }
}
```

`status` 기준:
- `healthy`: 마지막 sync < 6시간
- `stale`: 6~24시간
- `failing`: 최근 2회 이상 연속 실패 또는 24시간 초과

### `POST /admin/crawl-targets/{id}/trigger`

AOI 즉시 크롤 수동 실행.

**응답 202**:
```json
{ "job_id": "uuid", "message": "Crawl queued" }
```

쿼터 없음, `admin`만.

### `POST /admin/sync-logs/{id}/retry`

실패한 sync 잡 재시도. `202` + `job_id` 응답.

---

## InSAR 분석 산출물 API (Phase 후속, 상세는 [18-insar-products.md](./18-insar-products.md))

> **상태**: 플레이스홀더. DInSAR/SBAS는 곧 추가 예정, PSInSAR는 후속.

| 메서드 | 경로 | 권한 | 용도 |
|--------|------|------|------|
| GET | `/insar-products` | 인증 | 목록 (bbox/타입/날짜/미션 필터, cursor) |
| GET | `/insar-products/{id}` | 인증 | 상세 (메타 + 원본 scene + 레이어 목록) |
| GET | `/insar-products/{id}/quicklook` | 인증 | 평균 변위 PNG |
| GET | `/insar-products/{id}/tiles/{layer}/{z}/{x}/{y}.png` | 인증 | XYZ 타일 (DInSAR/SBAS 래스터) |
| POST | `/insar-products/{id}/points` | 인증 | PSInSAR 포인트 viewport 기반 조회 |
| GET | `/insar-products/{id}/timeseries` | 인증 | 픽셀/포인트 시계열 (lng/lat 또는 point_id) |
| GET | `/insar-products/{id}/download` | downloader+ | GeoTIFF/NetCDF/CSV 다운로드 (포맷/레이어 지정) |
| POST | `/admin/insar-jobs` | admin | 신규 생성 잡 등록 |
| GET | `/admin/insar-jobs` | admin | 잡 큐 조회 |
| GET | `/admin/insar-jobs/{id}` | admin | 잡 상태 상세 |
| PATCH | `/admin/insar-products/{id}` | admin | 공개/비공개 토글 등 |
| DELETE | `/admin/insar-products/{id}` | admin | 삭제 |

쿼터: 원본 scene 다운로드와 **분리된 카운터** 적용 예정 (산출물은 용량이 작음).

---

## Rate Limit

| 엔드포인트 | 한도 |
|-----------|------|
| `GET /scenes` | 60 req/min per user |
| `POST /downloads` | 10 req/min per user |
| `GET /downloads/*` | 300 req/min per user |
| `POST /public-datasets` | 5 req/min per user (업로드 과다 방지) |
| `GET /public-datasets/*` | 120 req/min per user |
| `POST /insar-products/*/points` | 30 req/min per user |
| `GET /insar-products/*/timeseries` | 60 req/min per user |
| `GET /ws/notifications` | 5 동시 연결 per user |

초과 시 `429` 응답 + `Retry-After` 헤더.

---

## 페이지네이션 규칙

### 두 가지 방식

| 방식 | 언제 쓰는가 | 엔드포인트 예 |
|------|------------|--------------|
| **Offset 기반** | 결과 건수가 작고(≤ 수천) `total` 표시가 필요한 경우 | `GET /regions`, `GET /admin/users`, `GET /admin/jobs/pending` |
| **Cursor 기반** | 결과 건수가 크거나 실시간 삽입이 있는 시계열 | `GET /scenes`, `GET /downloads`, `GET /admin/audit-logs` |

### Offset 기반 요청/응답

```
GET /api/v1/regions?limit=50&offset=100
```

| 파라미터 | 기본 | 최대 | 비고 |
|---------|------|------|------|
| `limit` | 100 | 1000 | 초과 시 `400 Bad Request` |
| `offset` | 0 | 10,000 | 10,000 초과는 cursor 방식 권장 |

```json
{
    "items": [...],
    "total": 234,
    "limit": 50,
    "offset": 100,
    "has_more": true
}
```

- `total`은 **O(1)에 가까운 경우에만** 포함. `sentinel_scenes` 같은 대형 테이블에는 포함하지 않음(COUNT가 비쌈)
- `has_more`는 `offset + limit < total` 또는 다음 쿼리에서 추가 row가 있는지로 판단

### Cursor 기반 요청/응답

```
GET /api/v1/scenes?limit=100&cursor=eyJzZW5zaW5nX3N0YXJ0IjoiMjAyNi0wNC0xNSIsImlkIjoidXVpZCJ9
```

| 파라미터 | 기본 | 최대 | 비고 |
|---------|------|------|------|
| `limit` | 100 | 1000 | |
| `cursor` | — | — | opaque base64url 문자열, 마지막 row의 정렬 키 기반 |

```json
{
    "items": [...],
    "limit": 100,
    "next_cursor": "eyJzZW5zaW5nX3N0YXJ0IjoiMjAyNi0wNC0xMCIsImlkIjoidXVpZC0yIn0",
    "has_more": true
}
```

**Cursor 내용** (서버에서 base64url로 인코딩):
```json
{
    "sensing_start": "2026-04-10T09:32:45Z",
    "id": "uuid"
}
```

쿼리는 항상 **정렬 키 + PK**로 안정 정렬:
```sql
WHERE (sensing_start, id) < (:cursor_start, :cursor_id)
ORDER BY sensing_start DESC, id DESC
LIMIT :limit + 1;  -- +1로 has_more 판정
```

### 공통 규칙

- `limit` 최대값 초과 시 `400 Bad Request`
- 응답 헤더 `X-RateLimit-*` 포함 (rate limit 적용 엔드포인트)
- 첫 페이지는 `cursor` 없이 호출. 응답의 `next_cursor`를 다음 호출에 그대로 전달
- Cursor는 **불투명(opaque)** — 클라이언트가 파싱하지 않도록 보장

---

## WebSocket 재연결 & 하트비트

### 서버 설정 (`socket.io`)

```typescript
@WebSocketGateway({
    namespace: '/ws/notifications',
    cors: { origin: '*' },
    pingInterval: 25000,   // 25초마다 서버 → 클라이언트 ping
    pingTimeout: 60000,    // 60초 내 pong 없으면 연결 종료
})
```

### 클라이언트 권장 동작

| 이벤트 | 동작 |
|--------|------|
| 최초 연결 | `io('/ws/notifications', { auth: { token: accessToken } })` |
| `connect` | `last_notification_id`를 서버에 전송 → 서버가 누락분 replay |
| `disconnect` | 이유에 따라 재연결 결정 (아래 표) |
| 재연결 시도 | **exponential backoff** (1s → 2s → 4s → 8s → 최대 30s). `reconnectionDelayMax: 30000` |
| 토큰 만료 | 재연결 전 `/auth/refresh` 호출해 새 access token 발급 후 연결 |
| `ping` | socket.io 프로토콜이 자동 처리. 앱 레벨 ping 불필요 |
| 90초 무응답 | 클라이언트가 연결을 끊고 재연결 시도 |

### disconnect 사유별 대응

| 사유 | 재연결? |
|------|---------|
| `io server disconnect` (서버가 명시적 종료) | ❌ 하지 않음. 사용자 액션 필요 |
| `io client disconnect` (사용자 로그아웃 등) | ❌ |
| `ping timeout`, `transport close`, `transport error` | ✅ 재연결 |

### 누락 알림 replay

재연결 직후 클라이언트가 마지막으로 수신한 `notification_id`를 보내면 서버가 그 이후 알림을 일괄 전송:

```typescript
// 클라이언트
socket.emit('resume', { last_notification_id: localStorage.getItem('lastNotifId') });

// 서버 (gateway)
@SubscribeMessage('resume')
async onResume(@MessageBody() data: { last_notification_id?: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const missed = await this.notificationService.읽지_않은_알림을_조회한다(userId, data.last_notification_id);
    for (const notif of missed) {
        client.emit(notif.type, { data: notif.payload });
    }
}
```

**보관 기간**: 알림은 30일 후 cleanup되므로 오프라인 30일 넘으면 일부 소실 가능. 사용자에게 "마지막 확인" UI로 안내.

## 필드 명명 규칙

- snake_case (`sensing_start`, `nas_path`)
- 불리언은 `is_`, `has_` 접두사
- 날짜 필드는 `_at` 접미사 (timestamp), `_date` (date only)
- 크기는 `_bytes` 접미사 명시
