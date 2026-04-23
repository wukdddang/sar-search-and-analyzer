# 07. 운영 정책

## NAS 용량 관리

### 예상 용량

| 미션 | 프로덕트 | 평균 크기 | 비고 |
|------|---------|-----------|------|
| Sentinel-1 | SLC | ~4 GB | 간섭계용 |
| Sentinel-1 | GRD | ~1 GB | 일반 활용 |
| Sentinel-2 | L1C | ~700 MB | Top-of-atmosphere |
| Sentinel-2 | L2A | ~800 MB | Bottom-of-atmosphere |

**한반도 커버리지 추정**:
- S1 GRD 1주일치 ≈ 200 scene × 1GB = 200 GB
- S2 L2A 1주일치 ≈ 150 scene × 800MB = 120 GB
- 1년 저장 시 **약 15~20 TB**

### 보관 정책

```typescript
// apps/crawler/src/cleanup/retention-policy.ts
export const RETENTION_POLICIES = {
  recent: {
    criteria: `sensing_start > now() - interval '90 days'`,
    keep: 'always',
  },
  accessed: {
    criteria: `last_accessed_at > now() - interval '180 days'`,
    keep: 'always',
  },
  archive: {
    criteria:
      `sensing_start < now() - interval '90 days' ` +
      `AND last_accessed_at < now() - interval '180 days'`,
    action: 'delete_from_nas_keep_metadata',
  },
} as const;
```

- **최근 90일**: 무조건 보관
- **자주 접근된 scene**: 최근 180일 이내 접근 시 보관
- **위 두 조건 모두 실패**: NAS에서 삭제, DB 메타데이터는 유지 (`nas_path = NULL`)
- 사용자가 다시 요청하면 재다운로드

### 접근 시간 추적

`sentinel_scenes.last_accessed_at`은 초기 스키마([02-database-schema.md](./02-database-schema.md))에 포함됨. 파일 서빙 시 비동기 업데이트:

```typescript
// 응답 발송과 분리해 DB 레이턴시가 사용자 응답을 지연시키지 않도록
void this.sceneRepo.update(sceneId, { lastAccessedAt: new Date() });
```

### Cleanup 잡

Crawler 앱에 `@Cron`으로 추가. 매일 새벽 3시에 실행.

```typescript
// apps/crawler/src/cleanup/cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promises as fs } from 'node:fs';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(SentinelScene)
    private readonly sceneRepo: Repository<SentinelScene>,
  ) {}

  @Cron('0 3 * * *')
  async cleanupOldScenes() {
    while (true) {
      const scenes = await this.sceneRepo.query(`
        SELECT id, nas_path FROM sentinel_scenes
        WHERE nas_path IS NOT NULL
          AND sensing_start < now() - interval '90 days'
          AND (last_accessed_at IS NULL
               OR last_accessed_at < now() - interval '180 days')
        LIMIT 100
      `);

      if (scenes.length === 0) break;

      for (const scene of scenes) {
        try {
          await fs.unlink(scene.nas_path);
          await this.sceneRepo.update(scene.id, {
            nasPath: null,
            downloadStatus: 'NOT_DOWNLOADED',
            fileSizeBytes: null,
          });
        } catch (err) {
          this.logger.error(`Failed to delete ${scene.nas_path}`, err.stack);
        }
      }
    }
  }
}
```

### 디스크 사용률 알람

```typescript
export const USAGE_THRESHOLDS = {
  WARNING: 70,
  CRITICAL: 85,   // 자동 cleanup 강화
  EMERGENCY: 95,  // 신규 다운로드 차단
} as const;
```

## Copernicus 계정 관리

### 단일 계정 운영

**본 프로젝트는 단일 기관 계정만 사용한다.** Legacy(`sar-data-retrieval`)도 단일 계정으로 장기 운영 중이며, 한반도 4시간 주기 크롤링 + 일일 다운로드 수백 scene 수준에서는 단일 계정의 쿼터로 충분하다는 것이 실제 운영에서 확인됨.

**필수 `.env` 키** (09-setup.md `.env.example` 참조):

```ini
COPERNICUS_USERNAME=service@example.com
COPERNICUS_PASSWORD=***
COPERNICUS_CLIENT_ID=cdse-public
COPERNICUS_CONCURRENCY=4
```

### 자격증명 관리 원칙

- 평문 저장 금지. `.env`는 gitignore, 운영은 Docker secret / K8s secret / Vault로 주입
- 분기별 비밀번호 교체
- CDSE 정책상 동시 다운로드는 **4개가 상한** → `COPERNICUS_CONCURRENCY`는 1~4 범위
- 실행 중 계정에 문제가 생기면 (rate limit 누적, 일시 정지 등) 운영자가 직접 대응:
  - 로그에서 `COPERNICUS_RATELIMIT` 빈도 확인 → 동시성 낮추거나 크롤 주기 늘림
  - CDSE 대시보드에서 사용량 직접 확인
  - 신규 계정으로 교체 시 `.env` 갱신 + 서비스 재시작만

### 향후 확장 메모

계정 풀이 필요해지는 시점:
- 일일 다운로드 요청이 50~100GB를 넘어 단일 계정 쿼터 소진
- 여러 기관/팀이 같은 플랫폼을 공유해 부하가 증가

그 시점에 재설계 (파일 기반 로드, round-robin + circuit breaker). 지금은 설계하지 않는다 — **YAGNI**.

## 모니터링

### 핵심 지표

**시스템 건강도**:
- API 응답시간 p50, p95, p99
- 에러율 (5xx, 4xx 구분)
- DB 커넥션 풀 사용률

**업무 지표**:
- 큐 적체량 (`QUEUED` 잡 수)
- 처리 속도 (scene/hour)
- 재시도율
- NAS 사용률
- Copernicus API 에러율

**크롤러**:
- 마지막 크롤링 시각 (target별)
- 크롤당 수집 scene 수
- 크롤 실패 횟수

### 알람 기준

| 조건 | 레벨 |
|------|------|
| API 에러율 > 5% (5분) | WARNING |
| 큐 적체 > 1000 (10분) | WARNING |
| 큐 적체 > 5000 | CRITICAL |
| NAS 사용률 > 85% | CRITICAL |
| 크롤러 6시간 이상 미실행 | CRITICAL |
| Worker heartbeat 끊김 | CRITICAL |
| Copernicus 연속 실패 > 10 | WARNING |

### 도구 추천 (현재 규모 기준)

프로젝트 초기 단계에서는 **과잉 도입을 피한다**. 아래 순서로 시작:

| 레이어 | 도구 | 비고 |
|--------|------|------|
| 헬스체크 | `@nestjs/terminus` | `/health` 엔드포인트 — DB/디스크/메모리/Copernicus ping |
| 메트릭 수집 | `@willsoto/nestjs-prometheus` | `/metrics` 엔드포인트 자동 노출 |
| 메트릭 저장/시각화 | Prometheus + Grafana | Docker Compose로 함께 구동 |
| 로그 | `nestjs-pino` | 구조화 JSON 로그 → 초기엔 stdout + `docker logs`만으로 충분 |
| 알람 | Grafana Alerting | Slack/이메일 webhook |
| 에러 추적 | Sentry (선택) | 운영 진입 후 도입 권고 |

**도입 시점 기준**:
- ELK / Loki: 로그 검색 수요가 실제로 생기면 (초기엔 불필요)
- OpenTelemetry: 서비스 수 5개 이상으로 늘 때
- Uptime Kuma: 외부에서 감시할 필요가 생기면 (내부망이면 Grafana로 충분)

### `/health` 엔드포인트 구성

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthCheck,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthCheck,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.disk.checkStorage('nas', { path: '/nas/sentinel', thresholdPercent: 0.95 }),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
```

Worker/Crawler는 HTTP 서버가 없으므로 `/health` 대신 `worker_heartbeats` 테이블로 대체. Grafana가 `last_heartbeat_at`을 쿼리해 알람.

## 백업

### DB 백업

- **daily full backup** + **continuous WAL archiving**
- 7일 로컬 + 30일 오프사이트
- **복구 테스트**: 월 1회

```bash
pg_basebackup -h primary -D /backup/base -Fp -X stream
```

### NAS 백업

- 원본 파일은 Copernicus에서 재다운로드 가능하므로 **backup 불필요**
- 단, quicklook/derived 파일은 백업 대상

## 주기 cleanup 잡

Crawler 앱에 추가. 각 항목은 `@Cron`으로 독립 스케줄링.

| 대상 | 조건 | 주기 |
|------|------|------|
| NAS 파일 | 보관 정책 (위 `cleanupOldScenes`) | 매일 03:00 |
| `pgmq.a_download_queue` (archive) | `archived_at < now() - interval '30 days'` | 매주 일요일 04:00 |
| `audit_log` | `created_at < now() - interval '6 months'` | 매주 일요일 04:30 |
| `refresh_tokens` | `expires_at < now() - interval '30 days'` | 매일 04:00 |
| `metadata_sync_log` | `synced_at < now() - interval '30 days'` | 매일 04:15 |
| `notifications` | `read_at IS NOT NULL AND read_at < now() - interval '30 days'` | 매일 04:20 |

### pgmq archive 정리

```typescript
@Cron('0 4 * * 0')  // 매주 일요일 04:00
async pruneQueueArchive() {
  // pgmq는 archive 테이블을 a_<queue_name>으로 생성
  await this.dataSource.query(`
    DELETE FROM pgmq.a_download_queue
    WHERE archived_at < now() - interval '30 days'
  `);
}
```

### audit_log 파티셔닝(대안)

감사 로그가 월 수백만 row를 넘으면 `created_at` 기준 월별 파티셔닝 + 오래된 파티션 DROP이 DELETE보다 효율적.

## 장애 대응 플레이북

### Copernicus API 전체 장애

- Layer 2 (live passthrough) 실패 → DB 캐시만으로 응답
- 사용자에게 `sync_status.source = "db_cache_stale"` 플래그 전달
- 다운로드 잡은 `QUEUED` 유지, 지수 백오프로 재시도

### NAS 마운트 실패

- Download Worker 전체 일시정지 (잡은 `QUEUED` 유지)
- API 서버는 정상 동작 (메타데이터 응답 계속)
- 파일 접근 요청은 503 반환

### DB 마스터 장애

- 읽기 복제본이 있으면 승격 후 장애 복구
- API는 Read-only 모드로 전환 (검색은 가능, 다운로드 요청 불가)

## 배포

### 환경 분리

- **dev**: 로컬 개발용, Docker Compose로 PostGIS 컨테이너 실행 (SQLite는 PostGIS 불가)
- **staging**: 운영과 동일 구성, 축소 데이터
- **prod**: 실운영

### 배포 전략

- **API Server**: rolling deploy (무중단)
- **Download Worker**: graceful shutdown (현재 처리 중인 잡 완료 후 종료)
- **Crawler**: 중단 가능 (다음 cycle에 catch-up)

### 무중단 DB 마이그레이션

1. 새 컬럼은 nullable로 추가
2. 애플리케이션 배포 (쓰기 시 새 컬럼 채움)
3. 백필 스크립트로 기존 데이터 채움
4. NOT NULL 제약 추가
5. 구 컬럼 제거 (필요 시)

TypeORM migration 사용. 각 단계를 별도 마이그레이션 파일로 분리:

```bash
# 신규 마이그레이션 생성
npm run typeorm migration:create -- -n AddColumnX

# 실행
npm run typeorm migration:run

# 롤백
npm run typeorm migration:revert
```

PostGIS DDL(GIST 인덱스 등)은 `synchronize: false` 설정 후 마이그레이션에만 기재.

## 비용 관리

추적 항목:
- Copernicus API 호출 수 (quota 소진 속도)
- NAS 스토리지 비용
- 네트워크 egress (외부 API 접근 시)
- 서버 인스턴스 비용

월별 대시보드로 관리.

## 문서화 유지

- API 변경 시 `05-api-spec.md` 업데이트 (PR과 함께)
- DB 스키마 변경 시 migration 파일 + ERD 업데이트
- 장애 발생 시 post-mortem 작성 → `docs/incidents/`

## 성능 벤치마크 목표

- API 검색 (캐시 히트): **p95 < 200ms**
- API 검색 (live): **p95 < 5s**
- 다운로드 요청 등록: **p95 < 100ms**
- Worker 평균 처리: **1 scene / 2~3분** (네트워크 의존)
- 크롤러 한 사이클: **< 10분**
