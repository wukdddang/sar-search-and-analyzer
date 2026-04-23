# 11. 인덱스 & 쿼리 성능 전략

## 왜 필요한가

PostGIS + 수백만 row의 `sentinel_scenes` + 복합 조건 쿼리 조합은 **인덱스 없이 쓰면 p95가 수 초로 치솟는다**. 이 문서는:

1. 각 핵심 쿼리의 **성능 목표**
2. 인덱스가 실제로 **타는지 검증하는 절차**
3. **정기 점검** 방법

## 핵심 쿼리 성능 목표 (p95)

검색/다운로드 경로의 hot path. 부팅 후 2주간 `pg_stat_statements`로 검증.

| 쿼리 | 목표 p95 | 타야 할 인덱스 |
|------|----------|----------------|
| bbox + 기간 + mission 검색 | **< 100 ms** | `idx_scenes_footprint` (GIST) + `idx_scenes_mission` |
| 행정구역 기반 검색 (JOIN) | **< 200 ms** | `idx_regions_geom` + `idx_scenes_footprint` |
| 캐시 히트 판정 (`sync_log`) | **< 20 ms** | `idx_sync_bbox` (GIST) + `idx_sync_recent` |
| pgmq pull | **< 10 ms** | pgmq 내부 인덱스 |
| 잡 상태 조회 (user별) | **< 30 ms** | `idx_jobs_user` |
| 활성 잡 조회 (scene 중복 방지) | **< 20 ms** | `uq_jobs_scene_active` (partial) |
| 씬 단건 조회 | **< 5 ms** | PK |
| 감사 로그 조회 (user, 최근) | **< 100 ms** | `idx_audit_user_time` |

## 인덱스 점검 절차

### 단계 1: `EXPLAIN (ANALYZE, BUFFERS)` 로 실제 실행 계획 확인

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, product_id, sensing_start
FROM sentinel_scenes
WHERE footprint && ST_MakeEnvelope(126.8, 37.4, 127.2, 37.7, 4326)
  AND ST_Intersects(footprint, ST_MakeEnvelope(126.8, 37.4, 127.2, 37.7, 4326))
  AND sensing_start BETWEEN '2026-04-01' AND '2026-04-30'
  AND mission IN ('S1A', 'S1C')
ORDER BY sensing_start DESC
LIMIT 100;
```

**좋은 계획**:
```
Limit (cost=... rows=100)
  -> Sort (... key: sensing_start DESC)
       -> Bitmap Heap Scan on sentinel_scenes
            Recheck Cond: (footprint && ...)
            Filter: (sensing_start BETWEEN ... AND mission = ANY (...))
            -> Bitmap Index Scan on idx_scenes_footprint
                 Index Cond: (footprint && ...)
```
- ✅ `Bitmap Index Scan on idx_scenes_footprint` — GIST 인덱스 타고 있음
- ✅ `Recheck Cond` — GIST 특성 (bbox 먼저 거르고 실제 기하 검사)

**나쁜 계획**:
```
-> Seq Scan on sentinel_scenes
     Filter: (footprint && ...)
```
- ❌ `Seq Scan` — 전체 테이블 스캔. 인덱스 미적용. 즉시 수정 필요

### 단계 2: BUFFERS 수치 확인

```
Buffers: shared hit=1234 read=567
```
- `shared hit`: 캐시 히트 블록 수
- `shared read`: 디스크에서 읽은 블록 수
- `read`가 크면 데이터가 캐시 외 영역. 쿼리 자체 문제는 아님

### 단계 3: `pg_stat_statements`로 실제 운영 쿼리 수집

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 자주 호출되면서 느린 쿼리 상위 20개
SELECT
    substring(query, 1, 80) AS short_query,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct
FROM pg_stat_statements
WHERE query ILIKE '%sentinel_scenes%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

운영 2주 뒤 이 결과의 p95를 목표치와 비교. 벗어나면 원인 분석.

## 인덱스별 검증 SQL

각 인덱스가 실제로 **사용되고 있는지** 확인.

```sql
-- 인덱스 사용 통계
SELECT
    schemaname,
    relname AS table,
    indexrelname AS index,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

- `idx_scan = 0`인 인덱스 → **사용 안 됨, DROP 고려**
- `idx_tup_fetch / idx_tup_read` 비율이 낮으면 **선택도 나쁨** (인덱스가 너무 많은 row 리턴)

## PostGIS GIST 인덱스 주의사항

1. **GIST는 `&&`(overlap) / `ST_Intersects` / `ST_DWithin`에만 탄다**
   ```sql
   -- ✅ GIST 사용
   WHERE footprint && ST_MakeEnvelope(...)
   WHERE ST_Intersects(footprint, ST_MakeEnvelope(...))
   WHERE ST_DWithin(footprint, point, 1000)

   -- ❌ GIST 못 탐 — Seq Scan
   WHERE ST_Area(footprint) > 1000000
   WHERE ST_IsValid(footprint) = false
   ```

2. **`&&`를 먼저 거르고 `ST_Intersects`를 뒤에** — GIST는 bbox 근사로 1차 필터 후 정밀 검사. `ST_Intersects` 단독은 내부적으로 이미 이렇게 하지만, 명시하면 플래너가 더 공격적으로 GIST 활용.

3. **`ST_MakeValid`로 전처리된 geometry만 저장** — self-intersect된 poly는 `ST_Intersects`에서 오답/에러 발생 가능.

4. **antimeridian(경도 180도) 주의** — 한국은 해당 안 되지만 전역 확장 시 MULTIPOLYGON 분리 필요.

## Partial Index 활용

**빈도가 극히 낮은 상태만 조회한다면 partial index가 전체 index보다 효율적**.

```sql
-- 활성 잡만 인덱싱 (전체 download_jobs 중 < 1%)
CREATE UNIQUE INDEX uq_jobs_scene_active
    ON download_jobs (scene_id)
    WHERE status IN ('QUEUED', 'PENDING_APPROVAL', 'RUNNING');

-- 미다운로드 씬만 인덱싱
CREATE INDEX idx_scenes_status
    ON sentinel_scenes (download_status)
    WHERE download_status != 'READY';

-- 안 읽은 알림만 인덱싱
CREATE INDEX idx_notif_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;
```

인덱스 크기가 1/100으로 줄고 pull/조회 p95가 극적으로 개선됨.

## VACUUM / ANALYZE 정책

PostgreSQL은 autovacuum을 기본 실행하지만 **대량 INSERT/UPDATE 직후**는 통계가 뒤처진다.

```sql
-- 크롤링 직후 (대량 upsert 뒤) 통계 갱신
ANALYZE sentinel_scenes;
ANALYZE metadata_sync_log;

-- 다운로드 잡 테이블은 UPDATE가 많음 — 블로트 체크
SELECT
    schemaname,
    relname,
    n_dead_tup,
    n_live_tup,
    round(100 * n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE relname IN ('download_jobs', 'sentinel_scenes')
ORDER BY n_dead_tup DESC;
```

- `dead_pct > 20%` → `VACUUM (ANALYZE) download_jobs`
- 수동 VACUUM은 운영 시간 외 (UTC 18시 이후 등)
- `pg_repack`으로 락 없이 테이블 재구성 가능 (심한 블로트)

## Cluster / 테이블 파티셔닝 (Phase 9)

### `audit_log` 파티셔닝 후보

월 수백만 row 쌓이면 DELETE가 느려짐. `created_at` 기준 월별 파티션:

```sql
-- 월별 파티션 테이블로 재구성
CREATE TABLE audit_log (
    id BIGSERIAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_04 PARTITION OF audit_log
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 오래된 파티션 DROP만 하면 수초로 6개월치 제거
DROP TABLE audit_log_2025_10;
```

파티션은 `pg_partman` 확장으로 자동 관리 권장.

### `sentinel_scenes` 파티셔닝?

**권장 안 함**. 수천만 row 넘어야 이득. 한반도 10년치도 수백만 수준이면 불필요.

## 체크리스트: 새 쿼리를 추가할 때

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` 결과 확인
- [ ] `Seq Scan`이 아니라 `Index Scan` / `Bitmap Index Scan` 타는지
- [ ] `rows` 추정이 실제와 크게 빗나가지 않는지 (빗나가면 `ANALYZE` 부족)
- [ ] 응답 시간이 위 목표표 범위인지
- [ ] 새 인덱스가 필요하면 **partial index 우선** 검토
- [ ] 마이그레이션에 인덱스 추가 시 `CONCURRENTLY` 옵션 (운영 테이블):
  ```sql
  CREATE INDEX CONCURRENTLY idx_... ON ... (...);
  ```

## 정기 점검 루틴

| 주기 | 작업 |
|------|------|
| 매일 | Grafana로 p95 쿼리 시간 확인 |
| 매주 | `pg_stat_statements`로 Top 20 느린 쿼리 리뷰 |
| 매주 | `pg_stat_user_indexes`로 미사용 인덱스 확인 |
| 매월 | 블로트 체크, 필요 시 VACUUM / pg_repack |
| 분기 | 인덱스 전체 REINDEX (락 없이: `REINDEX INDEX CONCURRENTLY`) |

## 개발 환경에서 실행 계획 비교

새 쿼리나 인덱스 추가 시, **PR에 `EXPLAIN ANALYZE` 결과 첨부 규칙**을 팀 컨벤션으로.

```bash
# docker-compose로 PostGIS + pgmq 띄운 상태에서
psql -h localhost -U sentinel -d sentinel < query.sql
```

- 시드 데이터 10,000 건 이상으로 재생 (너무 적으면 Seq Scan이 빠를 수도)
- 로컬/stg/prod의 pg 버전·확장 버전 일치 확인

## 참고

- PostGIS 인덱스 가이드: https://postgis.net/docs/using_postgis_dbmanagement.html#gist_indexes
- pg_stat_statements: https://www.postgresql.org/docs/current/pgstatstatements.html
- pg_partman: https://github.com/pgpartman/pg_partman
