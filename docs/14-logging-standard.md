# 14. 로깅 표준

## 원칙

1. **구조화 JSON 로그만** (stdout). 문자열 포맷 로그 금지
2. **`nestjs-pino` + `pino-http`** — NestJS Logger 인터페이스 유지하면서 pino 출력
3. **필수 필드는 모든 로그에 자동 주입** (`ClsService` + AsyncLocalStorage)
4. **민감정보는 pino redact로 필터** — 비밀번호/토큰/헤더 값
5. 개발 환경에서만 `pino-pretty`, 그 외는 raw JSON

## 필드 표준

### 자동 주입(모든 로그)

| 필드 | 출처 | 예 | 비고 |
|------|------|-----|------|
| `time` | pino 기본 | `"2026-04-23T10:00:00.123Z"` | ISO 8601, UTC |
| `level` | pino 기본 | `30` (info) | 숫자. 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal |
| `pid` | pino 기본 | `1234` | 프로세스 ID |
| `hostname` | pino 기본 | `"api-pod-a"` | |
| `app` | base context | `"api"` \| `"worker"` \| `"crawler"` | 3개 앱 구분 |
| `env` | base context | `"production"` | NODE_ENV |
| `version` | base context | `"1.2.3"` | package.json |
| `msg` | 로깅 호출 | `"씬 목록 조회 완료"` | 사람이 읽는 메시지 |

### Request 스코프(HTTP 요청마다)

| 필드 | 출처 | 예 | 비고 |
|------|------|-----|------|
| `req.id` | pino-http | `"req-abc123"` | **X-Request-Id** 헤더 있으면 그 값, 없으면 UUID 생성 |
| `req.method` | pino-http | `"POST"` | |
| `req.url` | pino-http | `"/api/v1/downloads"` | 쿼리스트링 포함 |
| `req.remoteAddress` | pino-http | `"10.0.0.5"` | trust proxy 적용 후 |
| `res.statusCode` | pino-http | `200` | 응답 시 |
| `responseTime` | pino-http | `42` | ms, 응답 시 |
| `trace_id` | OpenTelemetry (선택) | `"4bf92f3577b34da6..."` | W3C `traceparent` 헤더 파싱 |
| `user_id` | AuthInterceptor | `"uuid"` | 인증된 사용자만 |
| `user_role` | AuthInterceptor | `"downloader"` | |

### 도메인 컨텍스트(해당 작업 중만)

| 필드 | 언제 | 예 |
|------|------|-----|
| `job_id` | 다운로드 잡 처리 중 | `"uuid"` |
| `scene_id` | 씬 관련 작업 | `"uuid"` |
| `product_id` | 씬 메타데이터 작업 | `"S1A_IW_GRDH_..."` |
| `target_id` | 크롤 타겟 처리 중 | `123` |
| `mission` | Copernicus 요청 | `"S1A"` |
| `worker_id` | 워커 프로세스 로그 | `"api-pod-a-1234"` |

### 에러 로그(`err` 필드)

pino의 기본 `err` 시리얼라이저를 사용하면 다음이 자동 포함됨:
```json
{
    "err": {
        "type": "Error",
        "message": "...",
        "stack": "...",
        "code": "QUOTA_EXCEEDED"
    }
}
```

## 레벨 사용 가이드

| Level | 숫자 | 사용처 | 운영 노출 |
|-------|------|--------|----------|
| `fatal` | 60 | 프로세스 종료를 초래하는 오류 (DB 연결 불가, 치명적 상태) | PagerDuty |
| `error` | 50 | 작업 실패했으나 서비스는 계속 | Slack |
| `warn` | 40 | 성능 저하/재시도/비정상 경로 | Slack (심각 시) |
| `info` | 30 | 정상 작업 완료, 상태 전이 | stdout만 |
| `debug` | 20 | 로컬 개발 | off in prod |
| `trace` | 10 | 상세 내부 흐름 | off in prod |

**`LOG_LEVEL` 환경변수**로 제어. 기본 `info`.

## 구현

### 1. `pino` 설정

```typescript
// libs/common/logging/pino.config.ts
import { Params } from 'nestjs-pino';

export function buildPinoConfig(appName: 'api' | 'worker' | 'crawler'): Params {
    const isProd = process.env.NODE_ENV === 'production';

    return {
        pinoHttp: {
            level: process.env.LOG_LEVEL ?? 'info',

            // 기본 컨텍스트 (모든 로그에 주입)
            base: {
                app: appName,
                env: process.env.NODE_ENV,
                version: process.env.npm_package_version,
            },

            // pretty print (개발용)
            transport: isProd
                ? undefined
                : {
                      target: 'pino-pretty',
                      options: { colorize: true, singleLine: false, translateTime: 'SYS:HH:MM:ss.l' },
                  },

            // Request ID: 헤더 우선, 없으면 UUID
            genReqId: (req, res) => {
                const existing = req.headers['x-request-id'];
                const id = (Array.isArray(existing) ? existing[0] : existing) ?? crypto.randomUUID();
                res.setHeader('X-Request-Id', id);
                return id;
            },

            // 민감정보 마스킹
            redact: {
                paths: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'req.headers["x-api-key"]',
                    'req.body.password',
                    'req.body.refresh_token',
                    'res.headers["set-cookie"]',
                    '*.password',
                    '*.passwordHash',
                    '*.accessToken',
                    '*.refreshToken',
                ],
                censor: '[REDACTED]',
            },

            // HTTP 자동 로그 필터
            autoLogging: {
                ignore: (req) => req.url === '/api/v1/health' || req.url === '/metrics',
            },

            // 응답 직렬화 최소화
            serializers: {
                req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    remoteAddress: req.remoteAddress,
                }),
                res: (res) => ({ statusCode: res.statusCode }),
            },
        },
    };
}
```

### 2. AppModule 등록

```typescript
// apps/api/src/app.module.ts
import { LoggerModule } from 'nestjs-pino';
import { buildPinoConfig } from '@common/logging/pino.config';

@Module({
    imports: [
        LoggerModule.forRoot(buildPinoConfig('api')),
        // ...
    ],
})
export class AppModule {}
```

### 3. 도메인 컨텍스트 주입: `ClsModule` + AsyncLocalStorage

request 스코프를 넘는 컨텍스트(워커 잡 처리 등)에도 `user_id`, `job_id`를 자동 주입하려면 [`nestjs-cls`](https://github.com/Papooch/nestjs-cls)를 사용한다.

```typescript
// apps/worker/src/worker.module.ts
import { ClsModule } from 'nestjs-cls';

@Module({
    imports: [
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        LoggerModule.forRoot(buildPinoConfig('worker')),
    ],
})
export class WorkerModule {}
```

```typescript
// apps/worker/src/download-loop/download-worker.service.ts
async processMessage(msg: PulledMessage) {
    await this.cls.runWith({ jobId: msg.jobId, workerId: this.workerId }, async () => {
        // 이 블록 안의 모든 로그에 jobId, workerId 자동 주입
        this.logger.log('다운로드 시작');
        await this.download(...);
        this.logger.log('다운로드 완료');
    });
}
```

pino 설정에 CLS 컨텍스트 주입 hook 추가:

```typescript
mixin() {
    return this.cls.get() ?? {};
}
```

### 4. 인증 사용자 주입

JWT Guard 이후 실행되는 Interceptor에서 CLS에 `user_id`, `user_role` 세팅:

```typescript
// libs/common/logging/user-context.interceptor.ts
@Injectable()
export class UserContextInterceptor implements NestInterceptor {
    constructor(private readonly cls: ClsService) {}

    intercept(ctx: ExecutionContext, next: CallHandler) {
        const req = ctx.switchToHttp().getRequest();
        if (req.user) {
            this.cls.set('user_id', req.user.userId);
            this.cls.set('user_role', req.user.role);
        }
        return next.handle();
    }
}
```

`AppModule`에 전역 인터셉터로 등록.

## 로그 샘플

### 정상 요청

```json
{
    "level": 30,
    "time": "2026-04-23T10:00:00.123Z",
    "pid": 1234,
    "hostname": "api-pod-a",
    "app": "api",
    "env": "production",
    "version": "1.2.3",
    "req": {
        "id": "req-abc123",
        "method": "POST",
        "url": "/api/v1/downloads",
        "remoteAddress": "10.0.0.5"
    },
    "res": { "statusCode": 202 },
    "responseTime": 42,
    "user_id": "uuid-of-user",
    "user_role": "downloader",
    "msg": "request completed"
}
```

### 워커 잡 처리

```json
{
    "level": 30,
    "time": "2026-04-23T10:00:12.456Z",
    "app": "worker",
    "worker_id": "worker-pod-a-1234",
    "job_id": "uuid-of-job",
    "scene_id": "uuid-of-scene",
    "product_id": "S1A_IW_GRDH_...",
    "mission": "S1A",
    "msg": "씬 다운로드 시작"
}
```

### 에러

```json
{
    "level": 50,
    "time": "2026-04-23T10:05:00.789Z",
    "app": "worker",
    "job_id": "uuid",
    "err": {
        "type": "Error",
        "message": "Copernicus rate limit",
        "stack": "...",
        "code": "COPERNICUS_RATELIMIT"
    },
    "retry_count": 2,
    "msg": "다운로드 재시도 예정"
}
```

## 수집·검색 전략 (단계별)

| 규모 | 도구 | 비고 |
|------|------|------|
| Phase 0~6 | `docker logs` + `grep/jq` | 초기엔 이 정도로 충분 |
| 로그 검색 수요 발생 | **Loki** + Grafana | Docker log driver (`loki-docker-driver`)로 자동 수집, 별도 agent 불필요 |
| 다중 서버/분산 | Loki + Promtail | 파일 테일링 |
| 엔터프라이즈 | Elastic/Datadog | 현재 범위 외 |

Loki 도입 시 `job`, `service`, `app` 라벨만 지정하면 LogQL로 검색 가능:

```logql
{app="worker"} | json | job_id="..."
{app="api"} | json | level>=40 | user_id="..."
```

## 운영 지표와의 관계

로그는 **이벤트**, 메트릭은 **집계**. 혼용 금지.

- 잡 처리량 → Prometheus counter (`downloads_completed_total`)
- 개별 잡 처리 상세 → 로그 (`job_id` 필드)
- Grafana는 두 개를 한 화면에서 보여줌 (메트릭 그래프 + Loki 로그 패널)

## 금지 사항

- ❌ `console.log` 사용 (pino logger만)
- ❌ 평문 비밀번호/토큰 로깅 (redact 경로 누락)
- ❌ 전체 요청 body를 `req` 시리얼라이저에 포함 (큰 JSON은 성능 저하)
- ❌ 로그 포맷 문자열 (`logger.info("User ${id} logged in")`) — 필드로 분리
- ❌ PII를 `msg`에 섞기 (이메일, 전화번호는 별도 필드로)

## 참고

- nestjs-pino: https://github.com/iamolegga/nestjs-pino
- pino: https://getpino.io
- nestjs-cls: https://papooch.github.io/nestjs-cls
- Loki: https://grafana.com/docs/loki/latest/
