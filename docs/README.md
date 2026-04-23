# Sentinel 데이터 플랫폼

Copernicus Sentinel 위성 데이터를 회사 NAS에 저장하고, bbox/행정구역/기간 기반으로 검색·다운로드를 제공하는 백엔드 플랫폼.

## 문서 구성

- [01. 아키텍처 개요](./01-architecture.md) — 시스템 구조, 컴포넌트, 데이터 흐름
- [02. 데이터베이스 스키마](./02-database-schema.md) — PostgreSQL + PostGIS + pgmq 테이블 설계
- [03. 메타데이터 동기화 전략](./03-metadata-sync.md) — 크롤러 + 라이브 패스스루 하이브리드
- [04. 다운로드 워크플로우](./04-download-workflow.md) — pgmq 잡 큐, 워커, 알림
- [05. API 명세](./05-api-spec.md) — 엔드포인트 정의
- [06. 인증 및 권한](./06-auth.md) — IP 허용 + 사용자 역할
- [07. 운영 정책](./07-ops-policy.md) — 쿼터, NAS 관리, 모니터링
- [08. 구현 로드맵](./08-roadmap.md) — 기존 서버 마이그레이션 순서
- [09. 프로젝트 셋업](./09-setup.md) — Phase 0 실행 가이드 (`.env`, docker-compose, pnpm)
- [10. 코드 패턴 & 구조 가이드](./10-code-patterns.md) — **코드 생성 시 구속력 있는 규칙집** (4-Layer + CQRS, 한글 메서드명, 파일 구조)
- [11. 인덱스 & 쿼리 성능 전략](./11-index-strategy.md) — EXPLAIN ANALYZE, GIST/partial 인덱스, p95 목표
- [12. Legacy 프로젝트 참조](./12-legacy-reference.md) — `sar-data-retrieval`에서 이관할 자산과 개선점
- [13. 에러 코드 레지스트리](./13-error-codes.md) — `code` 필드 열거 + 클라이언트 대응 매트릭스
- [14. 로깅 표준](./14-logging-standard.md) — pino 구조화 로그, 필드 표준, Loki 전환 경로

## 핵심 결정 사항

| 항목 | 결정 |
|------|------|
| 공간 좌표계 | EPSG:4326 통일 |
| 행정구역 | 한국만 지원 (스키마는 전 세계 확장 가능) |
| 요청당 scene 상한 | 100개 (그 이상 관리자 승인) |
| 권한 | 회사 IP + 역할 기반 (viewer/downloader/admin) |
| 메타데이터 동기화 | 4시간 크롤러 + 최근 24시간 라이브 패스스루 |
| 잡 큐 | **pgmq** (PostgreSQL extension) + `download_jobs` 상태 테이블 |
| 서버 분리 | Data API / Download Worker / Metadata Crawler |

## 기술 스택 (확정)

- **런타임**: Node.js 22 LTS
- **패키지 매니저**: pnpm 9.x
- **백엔드 프레임워크**: NestJS 10.x (monorepo 모드)
- **DB**: PostgreSQL 16 + PostGIS 3.4 + pgmq 1.x
- **ORM**: TypeORM 0.3.x (raw SQL은 `dataSource.query`)
- **큐**: pgmq (visibility timeout, archive)
- **HTTP**: `@nestjs/axios` (메타), `undici` (파일 스트리밍)
- **헬스/메트릭**: `@nestjs/terminus` + `@willsoto/nestjs-prometheus` + Grafana
- **로그**: `nestjs-pino` (JSON, stdout)
- **인증**: JWT (`@nestjs/jwt`, `@nestjs/passport`)
- **배포**: Docker Compose 우선, 필요 시 Kubernetes
- **테스트**: Jest + Testcontainers (PostGIS + pgmq 실컨테이너)

## NestJS 애플리케이션 구성

3개의 NestJS 애플리케이션으로 분리 (monorepo 권장):

- `apps/api` — Data API 서버 (HTTP 요청 처리)
- `apps/worker` — Download Worker (잡 큐 소비)
- `apps/crawler` — Metadata Crawler (스케줄 기반)

공통 로직은 `libs/`에 모듈로 분리:

- `libs/database` — TypeORM 엔티티, 마이그레이션, 리포지토리
- `libs/copernicus` — Copernicus API 클라이언트
- `libs/notifications` — 알림 발송 로직
- `libs/common` — 공통 DTO, 예외, 유틸

## 빠른 시작 순서

1. [01-architecture.md](./01-architecture.md) — 시스템 구조 파악
2. [09-setup.md](./09-setup.md) — 로컬 환경 셋업 (Phase 0)
3. [02-database-schema.md](./02-database-schema.md) — DB 초기화 및 마이그레이션
4. [08-roadmap.md](./08-roadmap.md) — Phase 1부터 실행
