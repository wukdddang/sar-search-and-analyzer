# 09. 프로젝트 셋업 (Phase 0 가이드)

## 전제 스택 (확정)

| 항목 | 선택 |
|------|------|
| 런타임 | Node.js 22 LTS |
| 패키지 매니저 | **pnpm** 9.x |
| 프레임워크 | NestJS 10.x (monorepo 모드) |
| 언어 | TypeScript 5.x |
| ORM | **TypeORM** 0.3.x |
| DB | PostgreSQL 16 + PostGIS 3.4 + **pgmq** 1.x |
| HTTP 클라이언트 | `@nestjs/axios` (검색/메타), `undici` (파일 다운로드 스트리밍) |
| 헬스체크 | `@nestjs/terminus` |
| 메트릭 | `@willsoto/nestjs-prometheus` |
| 로그 | `nestjs-pino` (JSON, stdout) |

## 사전 요구사항

```bash
node --version   # v22.11+
pnpm --version   # 9.x
docker --version
docker compose version
```

pnpm 설치 (Windows PowerShell):
```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

## 디렉터리 구조 (Phase 0 완료 시점)

```
sentinel-platform/
├── apps/
│   ├── api/
│   ├── worker/
│   └── crawler/
├── libs/
│   ├── database/
│   ├── copernicus/
│   ├── notifications/
│   └── common/
├── docker/
│   ├── postgres/
│   │   └── init/
│   │       └── 00-extensions.sql
│   └── docker-compose.yml
├── .env.example
├── .env                    # gitignore
├── .nvmrc
├── .npmrc
├── nest-cli.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── tsconfig.build.json
```

## 셋업 단계별 명령어

### 1. 프로젝트 초기화

```bash
# NestJS CLI 글로벌 설치
pnpm add -g @nestjs/cli

# 프로젝트 생성
nest new sentinel-platform --package-manager pnpm --strict
cd sentinel-platform

# monorepo 모드로 전환 (기본 src/를 apps/api로 재구성)
nest generate app api
nest generate app worker
nest generate app crawler
nest generate library database
nest generate library copernicus
nest generate library notifications
nest generate library common
```

### 2. 의존성 설치

```bash
# 런타임
pnpm add \
  @nestjs/config @nestjs/typeorm typeorm pg \
  @nestjs/axios axios \
  @nestjs/schedule \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  @nestjs/terminus \
  @nestjs/websockets @nestjs/platform-socket.io socket.io \
  @willsoto/nestjs-prometheus prom-client \
  nestjs-pino pino-http pino \
  class-validator class-transformer \
  bcrypt \
  undici \
  p-limit \
  ipaddr.js \
  @nestjs/cache-manager cache-manager

# 타입/개발
pnpm add -D \
  @types/node @types/pg @types/bcrypt @types/passport-jwt \
  @types/geojson \
  eslint prettier husky lint-staged \
  testcontainers \
  typeorm-ts-node-commonjs
```

### 3. `.nvmrc`, `.npmrc`

```
# .nvmrc
22
```

```ini
# .npmrc
engine-strict=true
auto-install-peers=true
```

### 4. `package.json` 필수 필드

```json
{
  "name": "sentinel-platform",
  "private": true,
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "start:api": "nest start api --watch",
    "start:worker": "nest start worker --watch",
    "start:crawler": "nest start crawler --watch",
    "build": "nest build api && nest build worker && nest build crawler",
    "lint": "eslint \"{apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"{apps,libs,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d libs/database/src/data-source.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d libs/database/src/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d libs/database/src/data-source.ts",
    "db:up": "docker compose -f docker/docker-compose.yml up -d postgres",
    "db:logs": "docker compose -f docker/docker-compose.yml logs -f postgres",
    "db:reset": "docker compose -f docker/docker-compose.yml down -v && pnpm db:up",
    "prepare": "husky"
  }
}
```

### 5. `pnpm-workspace.yaml`

NestJS monorepo는 단일 `package.json`으로 운영하므로 워크스페이스 파일은 **만들지 않는다**. (NestJS CLI의 monorepo 모드는 내부 `libs/*`를 TypeScript path mapping으로 해결.)

## `.env.example`

```ini
# ─── Database ──────────────────────────────────────────────
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=sentinel
DATABASE_PASSWORD=changeme
DATABASE_NAME=sentinel
DATABASE_URL=postgresql://sentinel:changeme@localhost:5432/sentinel
DATABASE_POOL_SIZE=10
DATABASE_SSL=false

# ─── Auth ──────────────────────────────────────────────────
JWT_SECRET=replace-with-openssl-rand-base64-48
JWT_ACCESS_EXPIRES=1h
JWT_REFRESH_SECRET=replace-with-another-openssl-rand-base64-48
JWT_REFRESH_EXPIRES=30d
BCRYPT_COST=12

# ─── Copernicus ────────────────────────────────────────────
COPERNICUS_BASE_URL=https://catalogue.dataspace.copernicus.eu
COPERNICUS_DOWNLOAD_URL=https://download.dataspace.copernicus.eu
COPERNICUS_AUTH_URL=https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
COPERNICUS_USERNAME=
COPERNICUS_PASSWORD=
COPERNICUS_CLIENT_ID=cdse-public
COPERNICUS_CONCURRENCY=5

# ─── NAS Storage ───────────────────────────────────────────
NAS_BASE_PATH=/nas/sentinel
NAS_DISK_THRESHOLD_PERCENT=0.85

# ─── Queue (pgmq) ──────────────────────────────────────────
PGMQ_QUEUE_NAME=download_queue
PGMQ_VISIBILITY_TIMEOUT_SEC=300
PGMQ_MAX_READ_COUNT=10

# ─── Worker ────────────────────────────────────────────────
WORKER_CONCURRENCY=3
WORKER_HEARTBEAT_INTERVAL_MS=30000
WORKER_IDLE_POLL_MS=5000

# ─── Crawler ───────────────────────────────────────────────
CRAWLER_CRON=0 */4 * * *
CRAWLER_LOOKBACK_DAYS=7

# ─── Notifications ─────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=sentinel-noreply@example.com

# ─── App ───────────────────────────────────────────────────
NODE_ENV=development
API_PORT=3000
API_CORS_ORIGINS=http://localhost:5173,http://localhost:3001
LOG_LEVEL=info
IP_ALLOWLIST_ENABLED=false
TRUSTED_PROXIES=127.0.0.1
```

JWT secret 생성:
```bash
openssl rand -base64 48
```

## `docker-compose.yml`

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: tembo/pg16-pgmq:latest
    container_name: sentinel-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: sentinel
      TZ: UTC
      PGTZ: UTC
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sentinel -d sentinel"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 선택: 로컬 SMTP 테스트용
  mailpit:
    image: axllent/mailpit:latest
    container_name: sentinel-mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"    # SMTP
      - "8025:8025"    # Web UI
    profiles: ["dev"]

  # 선택: 로컬 메트릭 확인용
  prometheus:
    image: prom/prometheus:latest
    container_name: sentinel-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    profiles: ["monitoring"]

  grafana:
    image: grafana/grafana:latest
    container_name: sentinel-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    profiles: ["monitoring"]

volumes:
  postgres_data:
  grafana_data:
```

> **PostGIS + pgmq 이미지 선택**: `tembo/pg16-pgmq`는 pgmq 제작사 Tembo가 배포하는 공식 이미지지만, PostGIS가 기본 포함되지 않을 수 있음. 확인 후 없으면 아래 커스텀 Dockerfile 사용:

### 대안: 커스텀 Dockerfile (PostGIS + pgmq 같이)

```dockerfile
# docker/postgres/Dockerfile
FROM postgis/postgis:16-3.4

RUN apt-get update && apt-get install -y --no-install-recommends \
      postgresql-16-pgmq \
    && rm -rf /var/lib/apt/lists/*
```

docker-compose에서:
```yaml
postgres:
  build:
    context: ./postgres
    dockerfile: Dockerfile
  # ... 나머지 동일
```

`postgresql-16-pgmq` 패키지가 배포판에 없으면 Tembo 공식 빌드 지침 또는 `pgxn` 경유 수동 설치 필요. 셋업 시 `docker compose up -d postgres` 후 `docker exec -it sentinel-postgres psql -U sentinel -c "CREATE EXTENSION pgmq"`로 반드시 사전 검증.

### 초기 extension 로드

```sql
-- docker/postgres/init/00-extensions.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- 잡 큐 생성
SELECT pgmq.create('download_queue');
```

## 환경변수 검증 (Joi)

`@nestjs/config`의 `validationSchema`로 앱 부팅 시 필수 환경변수를 검증한다. 누락/타입 오류면 **부팅 실패**.

```typescript
// libs/common/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    // App
    NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
    API_PORT: Joi.number().port().default(3000),
    LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),
    API_CORS_ORIGINS: Joi.string().allow('').default(''),
    TRUSTED_PROXIES: Joi.string().allow('').default('127.0.0.1'),

    // Database
    DATABASE_HOST: Joi.string().required(),
    DATABASE_PORT: Joi.number().port().default(5432),
    DATABASE_USER: Joi.string().required(),
    DATABASE_PASSWORD: Joi.string().required(),
    DATABASE_NAME: Joi.string().required(),
    DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),
    DATABASE_POOL_SIZE: Joi.number().integer().min(1).default(10),
    DATABASE_SSL: Joi.boolean().default(false),

    // Auth
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES: Joi.string().default('1h'),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_EXPIRES: Joi.string().default('30d'),
    BCRYPT_COST: Joi.number().integer().min(10).max(14).default(12),
    IP_ALLOWLIST_ENABLED: Joi.boolean().default(true),

    // Copernicus
    COPERNICUS_BASE_URL: Joi.string().uri().required(),
    COPERNICUS_DOWNLOAD_URL: Joi.string().uri().required(),
    COPERNICUS_AUTH_URL: Joi.string().uri().required(),
    COPERNICUS_USERNAME: Joi.string().email().required(),
    COPERNICUS_PASSWORD: Joi.string().required(),
    COPERNICUS_CLIENT_ID: Joi.string().default('cdse-public'),
    COPERNICUS_CONCURRENCY: Joi.number().integer().min(1).max(4).default(4),

    // NAS
    NAS_BASE_PATH: Joi.string().required(),
    NAS_DISK_THRESHOLD_PERCENT: Joi.number().min(0).max(1).default(0.85),

    // pgmq
    PGMQ_QUEUE_NAME: Joi.string().default('download_queue'),
    PGMQ_VISIBILITY_TIMEOUT_SEC: Joi.number().integer().min(60).default(300),
    PGMQ_MAX_READ_COUNT: Joi.number().integer().min(1).default(10),

    // Worker
    WORKER_CONCURRENCY: Joi.number().integer().min(1).default(3),
    WORKER_HEARTBEAT_INTERVAL_MS: Joi.number().integer().min(1000).default(30000),
    WORKER_IDLE_POLL_MS: Joi.number().integer().min(100).default(5000),

    // Crawler
    CRAWLER_CRON: Joi.string().default('0 */4 * * *'),
    CRAWLER_LOOKBACK_DAYS: Joi.number().integer().min(1).default(7),

    // Notifications (선택)
    SMTP_HOST: Joi.string().optional(),
    SMTP_PORT: Joi.number().port().optional(),
    SMTP_USER: Joi.string().optional(),
    SMTP_PASSWORD: Joi.string().optional(),
    SMTP_FROM: Joi.string().email().optional(),
});
```

**등록**:

```typescript
// apps/api/src/app.module.ts
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '@common/config/env.validation';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: envValidationSchema,
            validationOptions: {
                abortEarly: false,         // 모든 오류 한 번에 보고
                allowUnknown: true,        // 정의되지 않은 env 허용 (시스템 변수)
            },
        }),
        // ...
    ],
})
export class AppModule {}
```

3개 앱 모두 동일 스키마 공유. worker/crawler는 JWT 관련 키를 쓰지 않지만, 단일 `.env`를 공유하는 monorepo 구조라 전체 검증한다.

설치:
```bash
pnpm add joi
```

## TypeORM `DataSource` 설정

```typescript
// libs/database/src/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === 'true',
  entities: [join(__dirname, 'entities/**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/**/*.{ts,js}')],
  synchronize: false,   // 반드시 false — 마이그레이션만 사용
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});
```

## NestJS 앱 등록 시 주의

### `apps/api/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppDataSource } from '@lib/database';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    TypeOrmModule.forRoot(AppDataSource.options),
    TerminusModule,
    PrometheusModule.register(),
    // ... 도메인 모듈
  ],
})
export class AppModule {}
```

### `apps/api/src/main.ts`

```typescript
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');                  // ← /api/v1
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.enableCors({
        origin: (process.env.API_CORS_ORIGINS ?? '').split(',').filter(Boolean),
        credentials: true,
    });
    app.set('trust proxy', (process.env.TRUSTED_PROXIES ?? '').split(','));
    app.enableShutdownHooks();

    // Swagger
    const config = new DocumentBuilder()
        .setTitle('Sentinel 데이터 플랫폼 API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(Number(process.env.API_PORT ?? 3000));
}
bootstrap();
```

## Husky + lint-staged

```bash
pnpm dlx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

## ESLint / Prettier 기본

NestJS CLI가 자동 생성. `eslint.config.mjs`에 TypeORM entity 관련 `@typescript-eslint/no-inferrable-types` 등 필요에 따라 완화.

## `.gitignore` 필수 항목

```
node_modules/
dist/
coverage/
.env
.env.*.local
*.log
.DS_Store
.vscode/
.idea/
```

## Phase 0 완료 검증 체크리스트

아래가 모두 성공하면 Phase 0 완료:

- [ ] `pnpm install` 성공
- [ ] `docker compose up -d postgres` 컨테이너 healthy
- [ ] `psql -h localhost -U sentinel -d sentinel -c "\dx"`에 `postgis`, `pgmq` 표시
- [ ] `SELECT pgmq.create('download_queue')` 성공
- [ ] `pnpm migration:run`으로 초기 스키마 반영
- [ ] `pnpm start:api` → `GET http://localhost:3000/v1/health` 200 응답
- [ ] `pnpm start:worker` → `worker_heartbeats`에 row 삽입 확인
- [ ] `pnpm start:crawler` → 프로세스 유지되고 로그 출력됨
- [ ] 3개 앱 모두 `pnpm build` 성공

## 자주 부딪히는 이슈

### Windows에서 `bcrypt` 설치 실패
Node-gyp 컴파일러 필요. 대안으로 `bcryptjs` 사용 고려 (순수 JS, 성능은 약간 낮음).

### `pgmq` extension 로드 실패
`postgresql-XX-pgmq` 패키지가 없는 이미지라면 위의 커스텀 Dockerfile 사용. 또는 Tembo CloudNativePG 이미지 사용.

### TypeORM이 PostGIS geometry 컬럼 synchronize 시도
반드시 `synchronize: false`. 마이그레이션에서 `CREATE EXTENSION postgis`를 최초 마이그레이션 첫 줄에 배치.

### `DATABASE_URL` vs 개별 필드 충돌
둘 다 `.env`에 있으면 라이브러리에 따라 우선순위 달라짐. 하나만 유지 (권장: 개별 필드가 가독성 좋음, `DATABASE_URL`은 배포 환경에서 오버라이드용).

## 다음 단계

Phase 0 완료 후 [08-roadmap.md](./08-roadmap.md) Phase 1 (NAS 스캔 → 메타데이터 적재) 진행.
