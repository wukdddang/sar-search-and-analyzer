# 13. 에러 코드 레지스트리

## 원칙

1. **NestJS 기본 예외가 우선** — `NotFoundException`, `ConflictException`, `ForbiddenException` 등은 별도 `code` 필드 없이 사용 (HTTP status와 메시지만으로 충분)
2. **`code` 필드는 "클라이언트가 분기해야 할 때"만 부여** — 예: 쿼터 초과 시 "언제 리셋되는지" 보여주려면 `code=QUOTA_EXCEEDED` + `details.reset_at` 필요
3. **`code`는 SCREAMING_SNAKE_CASE**, 접두어로 카테고리 표기
4. **프리픽스 6종만 사용** — 새 카테고리 추가는 이 문서 갱신을 동반

## 카테고리 프리픽스

| 프리픽스 | 의미 | 예 |
|----------|------|-----|
| `AUTH_` | 인증/인가 실패 중 "이유가 중요한" 케이스 | `AUTH_ACCOUNT_PENDING` |
| `QUOTA_` | 사용자 쿼터 관련 | `QUOTA_EXCEEDED` |
| `COPERNICUS_` | 외부 Copernicus 장애 | `COPERNICUS_RATELIMIT` |
| `DOWNLOAD_` | 다운로드 잡/파일 문제 | `DOWNLOAD_ALREADY_QUEUED` |
| `SCENE_` | Scene/메타데이터 문제 | `SCENE_EVICTED` |
| `NAS_` | NAS 저장소 | `NAS_UNAVAILABLE` |

## 응답 형식

```json
{
    "statusCode": 429,
    "message": "일일 다운로드 쿼터를 초과했습니다.",
    "error": "Too Many Requests",
    "code": "QUOTA_EXCEEDED",
    "details": {
        "used_bytes": 500000000000,
        "limit_bytes": 500000000000,
        "reset_at": "2026-04-24T00:00:00Z"
    }
}
```

- `statusCode`, `message`, `error`: NestJS 기본 3필드
- `code`: 본 문서에 등록된 값
- `details`: 각 코드별로 명시된 구조 (아래 표)

## 에러 코드 레지스트리

### AUTH_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 로그인 실패 (이메일/비밀번호 불일치) | — | 사용자에게 "이메일 또는 비밀번호가 올바르지 않습니다" |
| `AUTH_ACCOUNT_PENDING` | 401 | 가입 후 관리자 승인 대기 중 | — | "계정 승인 대기 중입니다" 안내 |
| `AUTH_ACCOUNT_DISABLED` | 403 | 관리자가 비활성화한 계정 | — | 로그아웃 처리 |
| `AUTH_REFRESH_REUSED` | 401 | Refresh token 재사용 감지(도난) | `{"revoked_all": true}` | 전체 세션 만료, 재로그인 요구 |
| `AUTH_IP_BLOCKED` | 403 | IP 허용 목록 미포함 | `{"ip": "1.2.3.4"}` | "접근이 허용되지 않은 네트워크입니다" |

> 그 외 일반 401(토큰 만료/무효)은 `code` 없이 NestJS 기본 `UnauthorizedException`. 클라이언트는 `statusCode === 401`만 보고 refresh 시도.

### QUOTA_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `QUOTA_EXCEEDED` | 429 | 일일 사용량 초과 | `{"kind": "scene_count"\|"download_bytes", "used": number, "limit": number, "reset_at": ISO}` | 리셋 시각 표시 |
| `QUOTA_PENDING_APPROVAL` | 202 | 100 scene 초과로 관리자 승인 대기 | `{"job_ids": [uuid], "admin_notified_at": ISO}` | "관리자 승인 대기 중" 배너 |

### COPERNICUS_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `COPERNICUS_UNAVAILABLE` | 503 | CDSE 전체 장애 (DB 캐시만 응답) | `{"cached_until": ISO, "last_success_at": ISO}` | `sync_status.source = "db_cache_stale"` 라벨 |
| `COPERNICUS_RATELIMIT` | 429 | CDSE 429 응답 (내부 세마포어/백오프 내) | `{"retry_after_sec": number}` | 대기 후 재시도 |
| `COPERNICUS_AUTH_FAILED` | 503 | 우리 쪽 CDSE 계정 인증 실패 | `{"username": "m****@example.com"}` (마스킹) | 사용자에겐 "일시적 장애" |

### DOWNLOAD_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `DOWNLOAD_ALREADY_QUEUED` | 202 | 동일 scene에 이미 활성 잡 존재 → 구독자 추가 | `{"job_id": uuid, "status": "RUNNING", "subscribed": true}` | "이미 다운로드 중입니다" + 기존 잡 상태 표시 |
| `DOWNLOAD_SCENE_MISSING` | 404 | scene_id가 DB에 없음 | `{"scene_id": uuid}` | 목록 재조회 유도 |
| `DOWNLOAD_CHECKSUM_MISMATCH` | 500 (내부) | 다운로드 후 체크섬 불일치 | `{"expected": sha, "actual": sha, "retry_count": n}` | 내부 재시도 처리 (클라이언트 노출 X) |
| `DOWNLOAD_MAX_RETRY_EXCEEDED` | — (내부 FAILED) | 재시도 상한 초과 | `{"last_error": string}` | 알림으로 전달 |

### SCENE_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `SCENE_EVICTED` | 410 | Copernicus에서 eviction_date 지나 삭제됨 | `{"evicted_at": ISO}` | "원본 데이터가 만료됨" 안내 |
| `SCENE_FOOTPRINT_INVALID` | 500 (내부) | 저장된 geometry가 invalid | `{"product_id": string}` | 내부 로그만, 사용자 노출 X |

### NAS_*

| Code | HTTP | 발생 상황 | details 필드 | 클라이언트 대응 |
|------|------|----------|-------------|----------------|
| `NAS_UNAVAILABLE` | 503 | NAS 마운트 실패/I/O 오류 | — | "파일 접근이 일시 불가합니다" |
| `NAS_FILE_NOT_FOUND` | 404 | DB는 READY인데 실제 파일이 없음 | `{"scene_id": uuid, "expected_path": string}` | 재다운로드 큐잉 (관리자 경보) |
| `NAS_DISK_FULL` | 503 | 디스크 95% 초과로 신규 다운로드 차단 | `{"usage_percent": 96}` | 관리자에게만 상세, 일반 사용자는 "일시적 장애" |

## 구현

### 1. 중앙 집중 상수

```typescript
// libs/common/errors/error-codes.ts
export const ErrorCode = {
    AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    AUTH_ACCOUNT_PENDING: 'AUTH_ACCOUNT_PENDING',
    AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
    AUTH_REFRESH_REUSED: 'AUTH_REFRESH_REUSED',
    AUTH_IP_BLOCKED: 'AUTH_IP_BLOCKED',

    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    QUOTA_PENDING_APPROVAL: 'QUOTA_PENDING_APPROVAL',

    COPERNICUS_UNAVAILABLE: 'COPERNICUS_UNAVAILABLE',
    COPERNICUS_RATELIMIT: 'COPERNICUS_RATELIMIT',
    COPERNICUS_AUTH_FAILED: 'COPERNICUS_AUTH_FAILED',

    DOWNLOAD_ALREADY_QUEUED: 'DOWNLOAD_ALREADY_QUEUED',
    DOWNLOAD_SCENE_MISSING: 'DOWNLOAD_SCENE_MISSING',
    DOWNLOAD_CHECKSUM_MISMATCH: 'DOWNLOAD_CHECKSUM_MISMATCH',
    DOWNLOAD_MAX_RETRY_EXCEEDED: 'DOWNLOAD_MAX_RETRY_EXCEEDED',

    SCENE_EVICTED: 'SCENE_EVICTED',
    SCENE_FOOTPRINT_INVALID: 'SCENE_FOOTPRINT_INVALID',

    NAS_UNAVAILABLE: 'NAS_UNAVAILABLE',
    NAS_FILE_NOT_FOUND: 'NAS_FILE_NOT_FOUND',
    NAS_DISK_FULL: 'NAS_DISK_FULL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

### 2. 커스텀 예외 헬퍼

```typescript
// libs/common/errors/coded.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export interface CodedExceptionBody {
    statusCode: number;
    message: string;
    error: string;
    code: ErrorCode;
    details?: Record<string, unknown>;
}

export class CodedException extends HttpException {
    constructor(
        code: ErrorCode,
        message: string,
        statusCode: HttpStatus,
        errorLabel: string,
        details?: Record<string, unknown>,
    ) {
        const body: CodedExceptionBody = {
            statusCode,
            message,
            error: errorLabel,
            code,
            details,
        };
        super(body, statusCode);
    }
}
```

### 3. 도메인별 서브클래스

```typescript
// libs/common/errors/quota-exceeded.exception.ts
import { HttpStatus } from '@nestjs/common';
import { CodedException } from './coded.exception';
import { ErrorCode } from './error-codes';

export class QuotaExceededException extends CodedException {
    constructor(kind: 'scene_count' | 'download_bytes', used: number, limit: number, resetAt: Date) {
        super(
            ErrorCode.QUOTA_EXCEEDED,
            '일일 쿼터를 초과했습니다.',
            HttpStatus.TOO_MANY_REQUESTS,
            'Too Many Requests',
            { kind, used, limit, reset_at: resetAt.toISOString() },
        );
    }
}
```

### 4. 클라이언트 사용 예

```typescript
// 프론트엔드
try {
    await api.post('/downloads', { scene_ids });
} catch (err) {
    if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        const { reset_at } = err.response.data.details;
        showToast(`쿼터 초과. ${reset_at}에 리셋됩니다.`);
    } else if (err.response?.data?.code === 'DOWNLOAD_ALREADY_QUEUED') {
        const { job_id } = err.response.data.details;
        navigate(`/jobs/${job_id}`);
    } else {
        showGenericError();
    }
}
```

## 신규 코드 추가 절차

1. 이 문서의 표에 새 행 추가 (카테고리, code, HTTP, 발생 상황, details, 클라이언트 대응)
2. `error-codes.ts` 상수에 추가
3. 필요 시 전용 Exception 서브클래스 작성
4. 클라이언트팀에 공유 (Slack/PR)

**새 카테고리가 필요하면**: 본 문서 상단 "카테고리 프리픽스" 표 업데이트 + 이유 설명.

## 절대 하지 말 것

- ❌ 같은 code를 여러 의미로 재사용
- ❌ 클라이언트가 보지 않는 내부 예외에 code 부여 (노이즈)
- ❌ details에 민감정보(비밀번호, full token) 포함
- ❌ 로케일 의존 메시지를 code로 대체 (message 필드가 그 역할)
