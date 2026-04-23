# 12. Legacy 프로젝트 참조 가이드

## 대상

- **Legacy 프로젝트**: `C:\Users\USER\dev\sar-data-retrieval`
- **역할**: Sentinel-1 데이터 수집의 **검증된 참조 구현**. NestJS + TypeORM + CQRS 기반
- **범위**: Sentinel-1만 (S1A/S1B/S1C), SAR 제품(SLC/GRD/RAW)

본 프로젝트(Sentinel 데이터 플랫폼)는 legacy의 **데이터 획득 로직을 계승**하되, 전체 아키텍처(모노레포, pgmq 큐, 4-Layer + 추가 도메인)는 재설계한다. 이 문서는 **어떤 파일을 / 어떻게 / 어디로** 옮길지 명시한다.

## 이관 전략 요약

| Legacy 자산 | 재사용 방식 | 위치 |
|------------|-----------|------|
| `CdseAuthService` | **거의 그대로 복사** | `libs/copernicus/src/copernicus-auth.service.ts` |
| `CdseSearchOptions` (OData $filter 생성) | **로직 계승, 리팩터** | `libs/copernicus/src/copernicus-search.service.ts` |
| `CdseDownloadSemaphoreService` | **p-limit 기반으로 단순화** | `libs/common/concurrency/semaphore.ts` |
| `StoragePathService` | **계승 + Sentinel-2 지원 추가** | `libs/common/storage/storage-path.service.ts` |
| `CdseODataDownloadService` (OData Nodes 재귀) | **undici 스트리밍으로 재작성** | `apps/worker/src/download-loop/scene-downloader.service.ts` |
| `CdseProvidedDataModel` 엔티티 | **새 스키마로 이식** | `libs/domain/core/sentinel-scene/sentinel-scene.entity.ts` |
| `CronJobStateService` | **pgmq로 대체** | (삭제) |
| `start-cron-job.handler` | **pgmq + Cron으로 재설계** | `apps/crawler/src/context/crawl-context/handlers/...` |
| ASF(Alaska) 클라이언트 | **현재 범위 제외** | — (필요 시 Phase 9+) |

## 로직별 상세 이관

### 1. OAuth 토큰 관리 → **거의 그대로**

**Legacy**: `apps/sentinel-retrieval/src/infrastructure/clients/cdse/cdse-auth.service.ts`

**검증된 포인트**:
- `grant_type=password` + `client_id=cdse-public` 조합이 **다운로드까지 가능한 유일한 경로**. `client_credentials`는 카탈로그만 가능
- Content-Type: **`application/x-www-form-urlencoded`** (JSON 불가)
- 만료 60초 전 선제 갱신
- `refreshPromise`로 동시 갱신 중복 제거
- 401 감지 시 `토큰을무효화한다()` 후 즉시 재발급

**재작성 위치**: [03-metadata-sync.md](./03-metadata-sync.md) OAuth 토큰 관리 섹션. 메서드명만 한글 표기로 바꿔 복사.

### 2. OData $filter 생성 → **로직 계승, 확장**

**Legacy**: `CdseSearchOptions.서버옵션으로변환한다()`

**계승할 로직**:
```
filters = [
    "Collection/Name eq 'SENTINEL-1'",
    "contains(Name,'GRD')",
    "ContentDate/Start ge 2026-01-01T00:00:00.000Z",
    "ContentDate/End le 2026-01-31T23:59:59.999Z",
    "OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((...))')"
]
```

**검증된 함정** (Legacy에서 겪고 학습된 것):
- `GeoFootprint` 필드로 검색 시도 시 **400 에러**
- `SRID=4326` 생략 시 좌표계 오류
- 좌표 순서 **(경도, 위도)** — 실수 쉬움
- 폴리곤은 **폐곡선** (시작점 = 끝점)

**확장 사항**:
- Sentinel-2 미션 지원 (`Collection/Name eq 'SENTINEL-2'`)
- L1C / L2A 구분 (파일명 `_MSIL1C_`, `_MSIL2A_`)
- `$skip 10,000` 한계 시 날짜 범위 자동 분할 (Legacy에서 미구현)

**재작성 위치**: [03-metadata-sync.md](./03-metadata-sync.md) "Rate limit 대응 & 페이지네이션" 섹션의 `필터를_생성한다()`.

### 3. 세마포어 → **p-limit로 단순화**

**Legacy**: `CdseDownloadSemaphoreService` (커스텀 스레드풀 방식, ~200줄)

**본 프로젝트**: `p-limit` 라이브러리 래핑(~20줄)로 충분. Legacy가 직접 구현한 이유는 **스레드 ID 로깅** 때문인데, p-limit + pino logger로 대체 가능.

```typescript
// libs/common/concurrency/semaphore.ts — 본 프로젝트
export class Semaphore {
    constructor(max: number) { this.limit = pLimit(max); }
    run<T>(task: () => Promise<T>): Promise<T> { return this.limit(task); }
}
```

**계승 규칙**:
- 최대 동시 다운로드 **4** (CDSE 정책)
- 환경변수로 조정 가능하되 상한 4로 clamp

### 4. NAS 경로 규칙 → **거의 그대로 + Sentinel-2 추가**

**Legacy**: `StoragePathService.경로를생성한다()`

```
{NAS}/{mission}/{productType}/{YYYY}/{MM}/{SAFE_NAME}
```

- `mission`: 파일명 앞 3자 (S1A/S1B/S1C)
- `productType`: 파일명에 `SLC`/`GRD`/`RAW` 포함 여부
- 날짜: 파일명의 `YYYYMMDDTHHMMSS` 패턴 or `ContentDate/Start`

**확장**:
- Sentinel-2 지원 (S2A/S2B, L1C/L2A)
- 파일명 파싱은 복사, 미션·타입 매핑 테이블만 확장

재작성 위치: [04-download-workflow.md](./04-download-workflow.md) NAS 저장 구조 섹션.

### 5. 다운로드 → **재작성 (undici + Range + checksum)**

**Legacy의 약점**:
- ❌ Range header로 **부분 다운로드 재개 미구현**
- ❌ 체크섬 수신만 하고 **검증 미구현**
- ❌ OData `Nodes` 재귀 탐색 방식은 느림 (파일 수십~수백 개 개별 요청)

**본 프로젝트에서 개선**:
- `undici.request` 스트리밍 + `Range: bytes=N-` 헤더 ([04-download-workflow.md](./04-download-workflow.md) 부분 다운로드 재개 섹션)
- 다운로드 후 SHA-256/MD5 체크섬 검증 (CDSE 응답 `Checksum` 필드)
- **OData `$value` 엔드포인트**로 SAFE 전체를 한 번에 (zip 형식) 받는 방식 우선 시도
- 대용량 성능 이슈 시 Phase 9에서 S3 경로 도입

### 6. UPSERT → **새로 구현**

**Legacy**: 단순 INSERT만. 같은 `product_id` 재처리 시 중복 키 오류.

**본 프로젝트**: [02-database-schema.md](./02-database-schema.md)의 `upsertScene()` 패턴 — `ON CONFLICT (product_id) DO UPDATE` + `processing_baseline` 비교로 재처리 감지.

### 7. 스케줄링 → **수동 API → `@Cron` + pgmq**

**Legacy**: HTTP POST `/query-data`로 수동 실행. `CronJobStateService`로 진행 상태 메모리 추적.

**본 프로젝트**:
- 크롤러는 `@Cron(EVERY_4_HOURS)` 자동 실행 ([03-metadata-sync.md](./03-metadata-sync.md))
- 다운로드 잡은 pgmq 큐에서 워커가 pull ([04-download-workflow.md](./04-download-workflow.md))
- 수동 재크롤은 관리자 API로 제공 (`POST /api/v1/admin/crawl-targets/:id/run`)

### 8. Checksum / 부분 다운로드 / Spatial Index → **신규**

Legacy에 **없는 것을 새로 구현**:
- 체크섬 검증 ([04-download-workflow.md](./04-download-workflow.md))
- 부분 다운로드 재개 (동)
- PostGIS spatial index ([02-database-schema.md](./02-database-schema.md), [11-index-strategy.md](./11-index-strategy.md))
- Footprint WKT → GeoJSON 변환 및 GIST 인덱스 활용
- Eviction date 기반 자동 재다운로드 판정
- 다중 사용자 잡 구독 (`job_subscribers`)

## Legacy 함정 체크리스트 (반드시 피할 것)

Legacy를 이식할 때 재발하면 안 되는 **검증된 버그들**:

- [ ] `OData.CSC.Intersects(area=geography'SRID=4326;POLYGON(...)')` 형식 외 사용 금지
- [ ] 좌표 순서 (경도, 위도) — 절대 반대로 넣지 않기
- [ ] SAFE 파일명에 `.SAFE` 접미사 중복 붙이지 말 것 (경로 join 전 정규화)
- [ ] `$skip > 10000` 시 CDSE가 에러 반환 → 날짜 범위 분할 필수
- [ ] 토큰 Content-Type은 `application/x-www-form-urlencoded` (JSON 시 400)
- [ ] 세마포어 상한 4 초과 시 Copernicus rate limit (429)
- [ ] UPSERT 없는 INSERT는 재처리 시 중복 키 에러 — `ON CONFLICT` 필수
- [ ] Footprint를 문자열로만 저장하면 Spatial 검색 불가 — geometry 타입으로

## 실제 파일 매핑표

| Legacy 파일 | 새 프로젝트 위치 | 비고 |
|-----------|--------------|------|
| `infrastructure/clients/cdse/cdse-auth.service.ts` | `libs/copernicus/src/copernicus-auth.service.ts` | 메서드명 한글로, 거의 그대로 |
| `infrastructure/clients/cdse/cdse-sentinel-client.ts` (검색) | `libs/copernicus/src/copernicus-search.service.ts` | Sentinel-2 지원 추가, $skip 분할 |
| `infrastructure/clients/cdse/cdse-odata-download.service.ts` | `apps/worker/src/download-loop/scene-downloader.service.ts` | undici + Range + checksum으로 재작성 |
| `infrastructure/clients/cdse/cdse-s3-download.service.ts` | `libs/copernicus/src/copernicus-s3.service.ts` (Phase 9) | 향후 도입 |
| `infrastructure/clients/cdse/cdse-download-semaphore.service.ts` | `libs/common/concurrency/semaphore.ts` | p-limit 래퍼로 단순화 |
| `infrastructure/clients/cdse/dto/cdse-search-options.ts` | `libs/copernicus/src/dto/copernicus-search-options.ts` | 거의 그대로 |
| `infrastructure/clients/cdse/dto/cdse-odata-product.ts` | `libs/copernicus/src/dto/copernicus-product.dto.ts` | Sentinel-2 필드 추가 |
| `domain/sentinel/services/storage-path.service.ts` | `libs/common/storage/storage-path.service.ts` | Sentinel-2 확장 |
| `domain/sentinel/entities/cdse_provided_data.entity.ts` | `libs/domain/core/sentinel-scene/sentinel-scene.entity.ts` | 새 스키마 ([02](./02-database-schema.md)) |
| `domain/sentinel/repositories/cdse-provided-data.repository.ts` | `libs/domain/core/sentinel-scene/sentinel-scene.service.ts` | UPSERT 로직 추가, CQRS 하에 재배치 |
| `context/sentinel-data-collection-context/handlers/*` | `apps/crawler/src/context/crawl-context/handlers/*` | pgmq 연동으로 재구성 |
| `context/sentinel-data-collection-context/services/cron-job-state.service.ts` | — | pgmq로 대체, 삭제 |
| `context/sentinel-data-collection-context/services/sentinel-retrieval-operations.service.ts` | `apps/crawler/src/context/crawl-context/handlers/commands/crawl-target.handler.ts` | 날짜 건너뛰기 대신 pgmq 재시도 |
| `infrastructure/clients/asf/*` | — (제외) | ASF는 현재 범위 밖 |

## Phase별 적용 순서

- **Phase 0**: 없음 (셋업만)
- **Phase 1 (NAS 인덱싱)**: `StoragePathService` 로직 먼저 포팅 → 기존 NAS 파일 스캔
- **Phase 2 (API 읽기 전용)**: Copernicus 클라이언트 필요 없음
- **Phase 3 (Crawler)**:
  - `CdseAuthService` 포팅
  - `CdseSearchOptions` 포팅
  - 페이지네이션/$skip 분할 추가
- **Phase 4 (Live passthrough)**: Crawler와 동일 클라이언트 재사용
- **Phase 5 (Download Worker)**:
  - Download 서비스는 **Legacy 로직 참고하되 새로 작성** (undici + Range + checksum)
  - 세마포어는 p-limit로 단순화
- **Phase 9+**: S3 경로 도입 검토

## 참고 명령 (탐색용)

Legacy 코드를 빠르게 훑어볼 때:

```bash
# OAuth 구현 위치
rg "grant_type" "C:\\Users\\USER\\dev\\sar-data-retrieval"

# OData filter 조립 위치
rg "OData.CSC.Intersects" "C:\\Users\\USER\\dev\\sar-data-retrieval"

# 세마포어 진입점
rg "semaphore|concurrency" "C:\\Users\\USER\\dev\\sar-data-retrieval/apps"

# 경로 규칙
rg "경로를생성|StoragePathService" "C:\\Users\\USER\\dev\\sar-data-retrieval"
```

## 마이그레이션 할 필요 없는 것

- 수동 `POST /query-data` API
- `CronJobStateService` — pgmq archive 테이블로 대체
- `failedDates` 메모리 추적 — DB(`audit_log` + `metadata_sync_log`)로 대체
- ASF 클라이언트
- AI processing 앱 (`apps/ai-processing`) — 본 프로젝트는 데이터 플랫폼 전용

새 도메인(권한, 쿼터, 승인, 알림, WebSocket, 행정구역 검색)은 legacy에 없으니 전부 **신규 구현**이다.
