# Sentinel 데이터 플랫폼 — 프로젝트 지침

## 🚨 코드 작성 전 필수 확인 문서

**모든 NestJS 백엔드 코드를 생성/수정하기 전에 반드시 아래 문서를 먼저 읽는다**:

- **[docs/10-code-patterns.md](./docs/10-code-patterns.md)** — 4-Layer Clean Architecture + CQRS, 파일/클래스/메서드 명명 규칙, 레이어별 구현 템플릿, 체크리스트

이 문서는 `C:\Users\USER\dev\home-inventory-manager\backend`의 검증된 패턴을 본 프로젝트에 적용한 것이며, **구속력 있는 규칙**이다. 어긋나는 코드 예시가 다른 문서에 있어도 `10-code-patterns.md`가 우선한다.

**데이터 획득(Copernicus)** 관련 코드 작성 전에는 추가로:
- **[docs/12-legacy-reference.md](./docs/12-legacy-reference.md)** — 기존 `sar-data-retrieval` 프로젝트의 검증된 로직과 함정. OAuth/OData/세마포어/NAS 경로는 대부분 해당 파일을 계승한다.

**새 쿼리/인덱스** 추가 시:
- **[docs/11-index-strategy.md](./docs/11-index-strategy.md)** — `EXPLAIN ANALYZE` 검증, 성능 목표표, partial index 우선 원칙.

**에러/로그** 작성 시:
- **[docs/13-error-codes.md](./docs/13-error-codes.md)** — 커스텀 `code`는 반드시 레지스트리에 등록 후 사용
- **[docs/14-logging-standard.md](./docs/14-logging-standard.md)** — pino 구조화 로그, 필수 필드, redact 경로

## 핵심 규칙 요약

1. **레이어**: `Interface → Business → Context(CQRS) → Domain`. 의존성 역방향 금지.
2. **파일명**: kebab-case + suffix (`.controller.ts`, `.service.ts`, `.entity.ts`, `.dto.ts`, `.handler.ts`, `.guard.ts` 등)
3. **클래스명**: PascalCase 영어 (`ScenesController`, `SentinelScene`)
4. **메서드명**: **한글 snake_case + `한다`** (`씬_목록을_조회한다`, `다운로드_잡을_생성한다`)
5. **DTO**: `class-validator` 데코레이터 필수. Create/Update/Search 접두사. 응답 타입은 `...Result`
6. **Exception**: NestJS 내장 우선 (`NotFoundException`, `ConflictException`). 커스텀은 도메인 특수 경우만
7. **Repository**: `@InjectRepository(Entity)` 패턴. 커스텀 Repository 클래스 만들지 않음
8. **트랜잭션**: Handler 레벨에서 `dataSource.transaction()`, Domain 서비스는 `manager?: EntityManager` 받기만
9. **응답**: raw DTO/Result (래퍼 `{data: ...}` 금지). 에러는 NestJS 기본 `{statusCode, message, error}` 형식
10. **API prefix**: `/api/v1` (글로벌 버전). 파괴적 변경 시 `/api/v2` 병행
11. **Prettier**: `singleQuote: true, trailingComma: 'all', printWidth: 120, tabWidth: 4`

## 모노레포 구조

- **apps/api** — 풀 4-Layer (Interface/Business/Context/Domain 모두)
- **apps/worker** — 2-Layer (Context + Domain, HTTP 없음)
- **apps/crawler** — 2-Layer (Context + Domain, 스케줄 트리거)
- **libs/domain** — 모든 앱이 공유하는 엔티티 + 도메인 서비스
- **libs/common** — Guard, Strategy, Decorator, Database 설정
- **libs/copernicus, libs/notifications, libs/queue** — Infrastructure

## 기술 스택 (확정)

Node 22 LTS · pnpm 9 · NestJS 10 · TypeScript 5 · TypeORM 0.3 · PostgreSQL 16 + PostGIS 3.4 + pgmq 1.x · NestJS CQRS · Passport JWT · nestjs-pino · @nestjs/terminus

## 문서 구조

- [docs/README.md](./docs/README.md) — 인덱스
- [docs/01-architecture.md](./docs/01-architecture.md) — 시스템 구조
- [docs/02-database-schema.md](./docs/02-database-schema.md) — DB 스키마 (PostGIS + pgmq)
- [docs/03-metadata-sync.md](./docs/03-metadata-sync.md) — 크롤러 + 라이브 패스스루
- [docs/04-download-workflow.md](./docs/04-download-workflow.md) — pgmq 잡 큐, 워커
- [docs/05-api-spec.md](./docs/05-api-spec.md) — API 엔드포인트
- [docs/06-auth.md](./docs/06-auth.md) — IP 허용 + JWT + 역할
- [docs/07-ops-policy.md](./docs/07-ops-policy.md) — NAS, 모니터링, cleanup
- [docs/08-roadmap.md](./docs/08-roadmap.md) — Phase 0~9 구현 로드맵
- [docs/09-setup.md](./docs/09-setup.md) — 로컬 셋업 (.env, docker-compose)
- **[docs/10-code-patterns.md](./docs/10-code-patterns.md)** — **코드 생성 구속 규칙**
- [docs/11-index-strategy.md](./docs/11-index-strategy.md) — 인덱스/쿼리 성능 전략
- [docs/12-legacy-reference.md](./docs/12-legacy-reference.md) — `sar-data-retrieval` 이관 가이드
- [docs/13-error-codes.md](./docs/13-error-codes.md) — 에러 코드 레지스트리 (`code` 필드)
- [docs/14-logging-standard.md](./docs/14-logging-standard.md) — 로그 표준 필드, pino 설정
- [docs/15-frontend-architecture.md](./docs/15-frontend-architecture.md) — 프론트엔드 아키텍처 (OpenLayers, plan/current, 폴더 구조)
- [docs/16-frontend-usecases.md](./docs/16-frontend-usecases.md) — 프론트엔드 유즈케이스 (UC 코드)
- [docs/17-frontend-ia.md](./docs/17-frontend-ia.md) — 프론트엔드 IA (Screen ID, Page/Layer)
- [docs/18-insar-products.md](./docs/18-insar-products.md) — InSAR 산출물 대비 설계 (DInSAR/SBAS/PSInSAR)
- [docs/19-frontend-scenarios.md](./docs/19-frontend-scenarios.md) — 프론트엔드 E2E 시나리오
- [docs/20-vworld-integration.md](./docs/20-vworld-integration.md) — VWorld API 통합 (주소→필지 폴리곤, SHP 업로드 대체)

## 한글 주석 및 커뮤니케이션

- 코드 내 주석은 한국어 또는 영어 모두 허용, 일관성 유지
- 커밋 메시지는 한국어 또는 영어 자유
- PR 설명은 한국어 권장

## 실행 체크

작업 완료 전 반드시:
```bash
pnpm lint
pnpm build
pnpm test
```

## 🐳 프론트엔드(`apps/web`) 변경 후 필수 절차

**`apps/web` 하위 파일을 수정/추가/삭제했다면, 작업 완료 보고 전에 반드시 Docker 이미지 재생성 + 컨테이너 재기동까지 수행한다.** `pnpm dev` / `next dev`는 사용하지 않는다 (포트 충돌 및 stale HMR 방지).

레포 루트(`C:\Users\USER\dev\sar-search-and-analyzer`)에서:

```bash
# 1) 이미지 재빌드 + 컨테이너 재생성 (포트 3333)
pnpm web:docker:up            # 권장 — 호스트 LAN IP 자동 감지 후 HOST_LAN_IP 주입
# 또는: docker compose up --build -d web  (HOST_LAN_IP 주입 없이)
# 강제 fresh: pnpm web:docker:rebuild

# 2) 헬스 확인
docker ps --filter name=sentinel-web --format "{{.Status}}"   # (healthy) 여야 함
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3333/   # 200 기대

# 3) 문제 시 로그
docker compose logs --tail=100 web
```

- 컨테이너 이름: `sentinel-web`, 이미지 태그: `sentinel/web:latest`, 포트: `3333:3333`
- 빌드가 실패하면 원인을 수정한 뒤 다시 `docker compose up --build -d web` — 실패 상태로 "완료" 보고 금지
- `docker compose down` / `pnpm web:docker:down`으로 정지
- 3001/3333 포트에 `pnpm dev` 등 다른 리스너가 떠 있으면 먼저 kill 후 재기동
- 이 규칙은 `apps/web`에만 해당. 백엔드(`apps/api`, `apps/worker`, `apps/crawler`)는 아직 컨테이너화 범위 밖.
