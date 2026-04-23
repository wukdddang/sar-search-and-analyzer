# 10. 코드 패턴 & 구조 가이드

> **이 문서의 목적**: 코드 생성 시 일관된 스타일·레이어·명명을 강제하기 위한 **구속력 있는 규칙집**.
>
> **참조 구현**: `C:\Users\USER\dev\home-inventory-manager\backend` — 실제로 검증된 4-Layer Clean Architecture + CQRS 패턴. 본 프로젝트는 이 백엔드의 패턴을 **그대로 계승**한다.
>
> **Claude Code/AI 코드 생성 사용법**: 프로젝트 루트의 `CLAUDE.md`에서 이 문서를 항상 참조하도록 지시한다.

---

## 1. 아키텍처 원칙

### 1.1 4-Layer Clean Architecture

```
┌─────────────────────────────────────────┐
│  Interface   (HTTP Controller, DTO)     │  ← 외부 진입점
├─────────────────────────────────────────┤
│  Business    (얇은 Facade, Context 위임) │
├─────────────────────────────────────────┤
│  Context     (CQRS: CommandBus/QueryBus)│
├─────────────────────────────────────────┤
│  Domain      (Entity, 리포지토리, 규칙) │  ← 가장 안쪽
└─────────────────────────────────────────┘
```

**의존성 방향은 위에서 아래로만**. Domain은 어떤 레이어도 몰라야 한다.

- `Interface → Business → Context → Domain` (역순 import 금지)
- 같은 레이어 내 모듈은 서로 직접 import하지 않는다 (결합 방지)
- `libs/` 공유 모듈은 모든 레이어가 사용 가능

### 1.2 각 레이어의 유일한 책임

| 레이어 | 책임 | 금지 |
|--------|------|------|
| **Interface** | HTTP 파싱, DTO 검증, Guard 적용, Swagger 문서화 | 비즈니스 로직, DB 접근 |
| **Business** | Context 서비스 1개 주입, 단순 위임 | 조건 분기, 트랜잭션 |
| **Context** | `CommandBus`/`QueryBus` 실행, Handler 등록 | HTTP 지식, DB 직접 접근 |
| **Domain** | Entity, Repository 주입, 비즈니스 규칙, 트랜잭션 | HTTP/CQRS 지식 |

### 1.3 모노레포(3개 앱) 적용 규칙

Sentinel은 3개 NestJS 앱으로 나뉘므로 레이어 적용을 차등한다.

#### `apps/api` — 풀 4-Layer

HTTP 진입점이므로 모든 레이어 사용.

```
apps/api/src/
├── main.ts
├── app.module.ts
├── interface/              ← HTTP 컨트롤러
│   ├── scenes/
│   ├── downloads/
│   ├── auth/
│   ├── regions/
│   ├── admin/
│   └── health/
├── business/               ← Context 위임 Facade
│   ├── scenes-business/
│   ├── downloads-business/
│   └── ...
└── context/                ← CQRS 핸들러
    ├── scenes-context/
    ├── downloads-context/
    └── ...
```

#### `apps/worker` — Simplified 2-Layer

HTTP 없음, 스케줄/루프 트리거. Interface/Business 생략, Context+Domain만.

```
apps/worker/src/
├── main.ts
├── worker.module.ts
├── download-loop/          ← 루프 트리거 (OnModuleInit)
└── context/
    └── download-context/
        ├── download-context.service.ts
        └── handlers/
            └── commands/
                ├── process-download-job.handler.ts
                └── ...
```

#### `apps/crawler` — Simplified 2-Layer

스케줄 트리거. worker와 동일 구조.

```
apps/crawler/src/
├── main.ts
├── crawler.module.ts
├── schedule/               ← @Cron 진입점
└── context/
    └── crawl-context/
        └── handlers/
            └── commands/
                ├── crawl-target.handler.ts
                └── ...
```

#### `libs/` — 공유 인프라 + Domain

```
libs/
├── domain/                 ← 모든 앱이 공유하는 엔티티/도메인 서비스
│   ├── _base/              ← BaseEntity, BaseTimestampEntity
│   ├── common/             ← User, Notification (시스템 공통)
│   │   ├── user/
│   │   └── notification/
│   ├── core/               ← SentinelScene, DownloadJob (핵심 비즈니스)
│   │   ├── sentinel-scene/
│   │   └── download-job/
│   └── sub/                ← AdminRegion, CrawlTarget (보조)
│       ├── admin-region/
│       └── crawl-target/
├── common/                 ← 공통 유틸, 예외, DTO 베이스
│   ├── auth/               ← Guard, Strategy, Decorator
│   ├── config/             ← Joi 환경검증 스키마
│   ├── database/           ← DataSource, Migration 설정
│   └── decorators/
├── copernicus/             ← Copernicus API 클라이언트 (Infrastructure)
├── notifications/          ← 알림 디스패처 (Infrastructure)
└── queue/                  ← pgmq 래퍼 (Infrastructure)
```

---

## 2. 파일 & 클래스 명명 규칙

### 2.1 파일명 — kebab-case + suffix

| 유형 | 파일명 | 클래스명 |
|------|--------|---------|
| 엔티티 | `sentinel-scene.entity.ts` | `SentinelScene` |
| 리포지토리 서비스 | `sentinel-scene.service.ts` | `SentinelSceneService` |
| 모듈 | `sentinel-scene.module.ts` | `SentinelSceneModule` |
| Context 서비스 | `scenes-context.service.ts` | `ScenesContextService` |
| Business 서비스 | `scenes-business.service.ts` | `ScenesBusinessService` |
| 컨트롤러 | `scenes.controller.ts` | `ScenesController` |
| 요청 DTO | `search-scenes.dto.ts` | `SearchScenesDto` |
| Command | `create-download-job.handler.ts` 안에 `CreateDownloadJobCommand`, `CreateDownloadJobHandler` |
| Query | `get-scene-list.handler.ts` 안에 `GetSceneListQuery`, `GetSceneListHandler` |
| Result 인터페이스 | `scenes-context.interface.ts` | `SceneResult`, `DownloadJobResult` |
| 가드 | `jwt-auth.guard.ts` | `JwtAuthGuard` |
| 전략 | `jwt.strategy.ts` | `JwtStrategy` |
| 데코레이터 | `current-user.decorator.ts` | `CurrentUser` |
| 마이그레이션 | `1712505600000-CreateScenesTable.ts` | `CreateScenesTable1712505600000` |

### 2.2 메서드 명명 — **한글 snake_case + `한다`**

참조 백엔드의 핵심 컨벤션. 도메인 언어로 읽기 쉽게 유지.

```typescript
// Controller / Business / Context / Domain 모든 레이어의 public 메서드
async 씬_목록을_조회한다(dto: SearchScenesDto): Promise<SceneResult[]> {}
async 씬을_단건_조회한다(id: string): Promise<SceneResult> {}
async 다운로드_잡을_생성한다(user: User, sceneId: string): Promise<DownloadJobResult> {}
async 다운로드_잡을_취소한다(jobId: string): Promise<void> {}
async 크롤_타겟을_스캔한다(target: CrawlTarget): Promise<number> {}
```

**규칙**:
- `{명사}_을/를/이_{동사}한다` 형식
- private 유틸 메서드도 한글 권장. 단, 순수 기술 유틸(예: `private buildFilter`)은 영어 허용
- 클래스명은 **영어 PascalCase 유지** (`ScenesController`, `SceneDomainService`)

### 2.3 DTO 클래스

```typescript
// 요청 DTO: class-validator 데코레이터 필수
export class SearchScenesDto {
    @IsOptional()
    @IsString()
    @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
        message: 'bbox는 minx,miny,maxx,maxy 형식이어야 합니다',
    })
    bbox?: string;

    @IsDateString()
    dateFrom: string;

    @IsDateString()
    dateTo: string;
}

// 응답 타입: *Result 접미사, 순수 타입 (검증 없음)
export class SceneResult {
    id: string;
    productId: string;
    mission: string;
    sensingStart: Date;
    footprint: GeoJSON.Polygon;
    nasPath: string | null;
    downloadStatus: DownloadStatus;
}
```

### 2.4 응답 포맷

**래퍼 없이 raw DTO/Result 반환**. (참조 방식 따름.)

```typescript
@Get()
async 씬_목록을_조회한다(@Query() dto: SearchScenesDto): Promise<SceneSearchResult> {
    return this.sceneBusinessService.씬_목록을_조회한다(dto);
}
```

배열이면 배열, 객체면 객체. `{ data: ..., meta: ... }` 같은 래퍼는 쓰지 않는다.

---

## 3. 레이어별 구현 템플릿

### 3.1 Domain Layer

```typescript
// libs/domain/core/sentinel-scene/sentinel-scene.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { BaseTimestampEntity } from '@domain/_base/base-timestamp.entity';

export type DownloadStatus = 'NOT_DOWNLOADED' | 'DOWNLOADING' | 'READY' | 'FAILED';

@Entity('sentinel_scenes')
export class SentinelScene extends BaseTimestampEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'product_id', type: 'text', unique: true })
    productId: string;

    @Column({ type: 'text' })
    mission: string;

    @Column({
        type: 'geometry',
        spatialFeatureType: 'Polygon',
        srid: 4326,
    })
    footprint: GeoJSON.Polygon;

    @Column({
        name: 'download_status',
        type: 'text',
        default: 'NOT_DOWNLOADED',
    })
    downloadStatus: DownloadStatus;

    // ... 나머지 컬럼
}
```

```typescript
// libs/domain/_base/base-timestamp.entity.ts
import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

export abstract class BaseTimestampEntity {
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
    deletedAt: Date | null;
}
```

```typescript
// libs/domain/core/sentinel-scene/sentinel-scene.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { SentinelScene } from './sentinel-scene.entity';

@Injectable()
export class SentinelSceneService {
    constructor(
        @InjectRepository(SentinelScene)
        private readonly sentinelSceneRepository: Repository<SentinelScene>,
    ) {}

    async 씬을_단건_조회한다(id: string, manager?: EntityManager): Promise<SentinelScene> {
        const repo = this.리포지토리를_고른다(manager);
        const scene = await repo.findOne({ where: { id } });
        if (!scene) {
            throw new NotFoundException('씬을 찾을 수 없습니다.');
        }
        return scene;
    }

    async 씬_목록을_bbox로_조회한다(
        bbox: [number, number, number, number],
        dateFrom: Date,
        dateTo: Date,
    ): Promise<SentinelScene[]> {
        return this.sentinelSceneRepository
            .createQueryBuilder('s')
            .where(
                `s.footprint && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)`,
                { minx: bbox[0], miny: bbox[1], maxx: bbox[2], maxy: bbox[3] },
            )
            .andWhere('s.sensingStart BETWEEN :from AND :to', { from: dateFrom, to: dateTo })
            .orderBy('s.sensingStart', 'DESC')
            .getMany();
    }

    private 리포지토리를_고른다(manager?: EntityManager): Repository<SentinelScene> {
        return manager ? manager.getRepository(SentinelScene) : this.sentinelSceneRepository;
    }
}
```

**핵심 포인트**:
- Repository는 항상 `@InjectRepository(Entity)` 패턴
- 외부에서 트랜잭션을 건넬 수 있게 `manager?: EntityManager` 선택 인자
- `리포지토리를_고른다()` 헬퍼로 manager 유무 처리
- 예외는 NestJS 내장 (`NotFoundException`, `ConflictException` 등)

### 3.2 Context Layer (CQRS)

```typescript
// apps/api/src/context/scenes-context/scenes-context.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SentinelSceneModule } from '@domain/core/sentinel-scene/sentinel-scene.module';
import { ScenesContextService } from './scenes-context.service';
import { GetSceneListHandler } from './handlers/queries/get-scene-list.handler';
import { GetSceneDetailHandler } from './handlers/queries/get-scene-detail.handler';

const QueryHandlers = [GetSceneListHandler, GetSceneDetailHandler];
const CommandHandlers = [];

@Module({
    imports: [CqrsModule, SentinelSceneModule],
    providers: [ScenesContextService, ...QueryHandlers, ...CommandHandlers],
    exports: [ScenesContextService],
})
export class ScenesContextModule {}
```

```typescript
// apps/api/src/context/scenes-context/scenes-context.service.ts
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetSceneListQuery } from './handlers/queries/get-scene-list.handler';
import { SceneSearchResult } from './interfaces/scenes-context.interface';

@Injectable()
export class ScenesContextService {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) {}

    async 씬_목록을_조회한다(params: SearchScenesParams): Promise<SceneSearchResult> {
        return this.queryBus.execute(new GetSceneListQuery(params));
    }
}
```

```typescript
// apps/api/src/context/scenes-context/handlers/queries/get-scene-list.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SentinelSceneService } from '@domain/core/sentinel-scene/sentinel-scene.service';
import { SceneSearchResult, SearchScenesParams } from '../../interfaces/scenes-context.interface';

export class GetSceneListQuery {
    constructor(public readonly params: SearchScenesParams) {}
}

@QueryHandler(GetSceneListQuery)
export class GetSceneListHandler implements IQueryHandler<GetSceneListQuery> {
    constructor(private readonly sentinelSceneService: SentinelSceneService) {}

    async execute(query: GetSceneListQuery): Promise<SceneSearchResult> {
        const scenes = await this.sentinelSceneService.씬_목록을_bbox로_조회한다(
            query.params.bbox,
            query.params.dateFrom,
            query.params.dateTo,
        );

        return {
            total: scenes.length,
            availableInNas: scenes.filter(s => s.downloadStatus === 'READY'),
            downloadRequired: scenes.filter(s => s.downloadStatus !== 'READY'),
        };
    }
}
```

**핵심 포인트**:
- Handler 파일 1개 = Command/Query 클래스 + Handler 클래스 쌍
- Context 서비스는 CommandBus/QueryBus만 주입, 분기 없이 위임
- Domain 서비스는 Handler에서만 주입

### 3.3 Business Layer

```typescript
// apps/api/src/business/scenes-business/scenes-business.module.ts
import { Module } from '@nestjs/common';
import { ScenesContextModule } from '@context/scenes-context/scenes-context.module';
import { ScenesBusinessService } from './scenes-business.service';

@Module({
    imports: [ScenesContextModule],
    providers: [ScenesBusinessService],
    exports: [ScenesBusinessService],
})
export class ScenesBusinessModule {}
```

```typescript
// apps/api/src/business/scenes-business/scenes-business.service.ts
import { Injectable } from '@nestjs/common';
import { ScenesContextService } from '@context/scenes-context/scenes-context.service';

@Injectable()
export class ScenesBusinessService {
    constructor(private readonly scenesContextService: ScenesContextService) {}

    async 씬_목록을_조회한다(params: SearchScenesParams): Promise<SceneSearchResult> {
        return this.scenesContextService.씬_목록을_조회한다(params);
    }
}
```

**Business는 얇은 Facade**. 여러 Context를 조합해야 할 때만 로직이 들어간다.

### 3.4 Interface Layer

```typescript
// apps/api/src/interface/scenes/scenes.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScenesBusinessService } from '@business/scenes-business/scenes-business.service';
import { JwtAuthGuard } from '@common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/auth/guards/roles.guard';
import { Roles } from '@common/auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '@common/auth/decorators/current-user.decorator';
import { SearchScenesDto } from './dto/search-scenes.dto';
import { SceneSearchResult } from '@context/scenes-context/interfaces/scenes-context.interface';

@ApiTags('Scenes')
@ApiBearerAuth()
@Controller('scenes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('viewer', 'downloader', 'admin')
export class ScenesController {
    constructor(private readonly scenesBusinessService: ScenesBusinessService) {}

    @Get()
    async 씬_목록을_조회한다(
        @Query() dto: SearchScenesDto,
        @CurrentUser() user: CurrentUserPayload,
    ): Promise<SceneSearchResult> {
        return this.scenesBusinessService.씬_목록을_조회한다({
            ...dto,
            userId: user.userId,
        });
    }
}
```

---

## 4. 인증 & 인가

### 4.1 Guard 체인

```typescript
@Controller('downloads')
@UseGuards(JwtAuthGuard, RolesGuard)            // 기본: 로그인 + 역할
@Roles('downloader', 'admin')                    // 클래스 기본 역할
export class DownloadsController {
    @Post()
    @Roles('downloader', 'admin')                // 메서드에서 재정의 가능
    async 다운로드를_요청한다(...) {}
}
```

### 4.2 Custom 데코레이터

```typescript
// libs/common/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
    userId: string;
    email: string;
    role: 'viewer' | 'downloader' | 'admin';
}

export const CurrentUser = createParamDecorator(
    (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user: CurrentUserPayload = request.user;
        return data ? user?.[data] : user;
    },
);
```

```typescript
// libs/common/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type Role = 'viewer' | 'downloader' | 'admin';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### 4.3 Passport JWT Strategy

```typescript
// libs/common/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('JWT_SECRET')!,
        });
    }

    async validate(payload: { sub: string; email: string; role: string }) {
        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}
```

`validate()` 반환값이 `request.user`에 그대로 세팅됨. `@CurrentUser()`가 이를 꺼낸다.

---

## 5. 트랜잭션 패턴

복수 엔티티/복수 서비스 호출이 한 트랜잭션에 묶여야 할 때, **Handler 레벨**에서 `DataSource.transaction()`을 연다.

```typescript
@CommandHandler(CreateDownloadJobCommand)
export class CreateDownloadJobHandler implements ICommandHandler<CreateDownloadJobCommand> {
    constructor(
        private readonly dataSource: DataSource,
        private readonly sceneService: SentinelSceneService,
        private readonly jobService: DownloadJobService,
        private readonly queueRepo: JobQueueRepository,
    ) {}

    async execute(cmd: CreateDownloadJobCommand): Promise<DownloadJobResult> {
        return this.dataSource.transaction(async (manager) => {
            const scene = await this.sceneService.씬을_단건_조회한다(cmd.sceneId, manager);

            const job = await this.jobService.잡을_생성한다(
                { sceneId: scene.id, requestedBy: cmd.userId },
                manager,
            );

            const msgId = await this.queueRepo.enqueue(job.id);
            await this.jobService.pgmq_msg_id를_갱신한다(job.id, msgId, manager);

            return this.jobService.결과로_변환한다(job);
        });
    }
}
```

**규칙**:
- 트랜잭션은 **Handler에서만** 연다 (Domain 서비스는 manager를 받기만)
- Domain 서비스 public 메서드는 모두 `manager?: EntityManager` 선택 인자 제공
- 트랜잭션 바깥에서 pgmq 등 외부 시스템 호출은 피한다 (rollback 불가능)

---

## 6. Exception 처리

### 6.1 원칙: NestJS 내장 우선

```typescript
throw new NotFoundException('씬을 찾을 수 없습니다.');
throw new ForbiddenException('다운로드 권한이 없습니다.');
throw new ConflictException('이미 진행 중인 다운로드 잡이 있습니다.');
throw new BadRequestException('bbox 형식이 올바르지 않습니다.');
throw new UnauthorizedException('인증이 만료되었습니다.');
throw new ServiceUnavailableException('Copernicus API에 일시적으로 접근할 수 없습니다.');
```

### 6.2 도메인 특수 예외만 커스텀

쿼터, Copernicus rate limit 같이 의미가 뚜렷한 경우에만.

```typescript
// libs/common/exceptions/quota-exceeded.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class QuotaExceededException extends HttpException {
    constructor(kind: 'scene_count' | 'download_bytes', details?: Record<string, unknown>) {
        super(
            {
                code: 'QUOTA_EXCEEDED',
                message: `일일 쿼터를 초과했습니다 (${kind})`,
                details,
            },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}
```

### 6.3 전역 Exception Filter

**기본적으로 만들지 않는다**. NestJS 기본 filter가 `HttpException`을 그대로 JSON으로 반환하므로 충분.

로그 포맷 통일이 필요하면 Interceptor 레벨(AuditInterceptor)에서 처리.

---

## 7. 코드 스타일 & 도구

### 7.1 Prettier (참조와 동일)

```json
// .prettierrc
{
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 120,
    "tabWidth": 4,
    "useTabs": false
}
```

### 7.2 ESLint (참조와 동일)

핵심 규칙:
- `@typescript-eslint/no-unused-vars`: `argsIgnorePattern: '^_'` — `_param`은 허용
- `@typescript-eslint/no-explicit-any`: off (현실적 이유)
- `@typescript-eslint/explicit-function-return-type`: off (public 메서드는 명시 권장)
- `@typescript-eslint/interface-name-prefix`: off (I 접두사 금지)

### 7.3 tsconfig paths

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@src/*": ["src/*"],
            "@domain/*": ["libs/domain/src/*"],
            "@context/*": ["apps/api/src/context/*"],
            "@business/*": ["apps/api/src/business/*"],
            "@interface/*": ["apps/api/src/interface/*"],
            "@common/*": ["libs/common/src/*"],
            "@copernicus/*": ["libs/copernicus/src/*"],
            "@notifications/*": ["libs/notifications/src/*"],
            "@queue/*": ["libs/queue/src/*"]
        }
    }
}
```

### 7.4 tsconfig 엄격도 (참조 기준)

- `strictNullChecks: true`
- `strictPropertyInitialization: false` (TypeORM 엔티티 호환)
- `noImplicitAny: false` (과도하게 막지 않음)
- `forceConsistentCasingInFileNames: true`

---

## 8. Swagger / API 문서

### 8.1 설정

```typescript
// apps/api/src/main.ts
const config = new DocumentBuilder()
    .setTitle('Sentinel 데이터 플랫폼 API')
    .setDescription('Copernicus Sentinel 검색 및 다운로드 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### 8.2 컨트롤러 데코레이터

```typescript
@ApiTags('Scenes')
@ApiBearerAuth()
@Controller('scenes')
export class ScenesController {
    @Get()
    @ApiOperation({ summary: '씬 목록 조회' })
    @ApiResponse({ status: 200, type: SceneSearchResult })
    async 씬_목록을_조회한다(...) {}
}
```

DTO 클래스에는 `@ApiProperty()`로 필드 설명 추가 (선택).

### 8.3 URL 규약

- **글로벌 prefix**: `/api/v1`. 파괴적 변경 시 `/api/v2`로 병행 운영 후 점진 이관.
  ```typescript
  app.setGlobalPrefix('api/v1');
  ```
- 리소스는 복수형 (`/scenes`, `/downloads`)
- 중첩 리소스는 2단계까지만 (`/downloads/:jobId/status`)

### 8.4 에러 응답 포맷

**NestJS 기본 HttpException 응답 형식을 그대로 사용**. 커스텀 래퍼 없음.

```json
// NotFoundException('씬을 찾을 수 없습니다.') 발생 시
{
    "statusCode": 404,
    "message": "씬을 찾을 수 없습니다.",
    "error": "Not Found"
}
```

도메인 특수 예외(쿼터 등)만 `code` 필드 추가:

```typescript
throw new HttpException(
    {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: '일일 다운로드 쿼터를 초과했습니다.',
        error: 'Quota Exceeded',
        code: 'QUOTA_EXCEEDED',
        details: { usedBytes, limitBytes },
    },
    HttpStatus.TOO_MANY_REQUESTS,
);
```

---

## 9. 모듈 import 체인 (정석)

Interface 모듈이 "최종 소비자"로서 Business를 끌어오고, 다른 것들은 import하지 않는다.

```typescript
// apps/api/src/interface/scenes/scenes.module.ts
@Module({
    imports: [ScenesBusinessModule],       // ← 이것만
    controllers: [ScenesController],
})
export class ScenesModule {}
```

```typescript
// AppModule은 Interface 모듈들만 import
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        DatabaseModule,
        AuthInfrastructureModule,      // JwtStrategy, Guards 제공
        LoggerModule.forRoot(pinoConfig),
        TerminusModule,
        PrometheusModule.register(),

        // Interface 모듈들 (자체적으로 Business/Context/Domain 의존)
        ScenesModule,
        DownloadsModule,
        AuthModule,
        RegionsModule,
        AdminModule,
        HealthModule,
    ],
})
export class AppModule {}
```

---

## 10. 테스트 패턴

### 10.1 위치

| 테스트 종류 | 위치 | 파일명 |
|------------|------|--------|
| 단위 | 소스 옆 | `*.spec.ts` |
| 통합 (도메인 서비스) | 소스 옆 | `*.integration.spec.ts` |
| E2E | `test/` 루트 | `*.e2e-spec.ts` |

### 10.2 Testcontainers로 실 PostGIS + pgmq

```typescript
// test/base-e2e.spec.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export class BaseE2ETest {
    container: StartedPostgreSqlContainer;
    app: INestApplication;

    async setup() {
        this.container = await new PostgreSqlContainer('tembo/pg16-pgmq:latest')
            .withDatabase('sentinel_test')
            .withUsername('test')
            .withPassword('test')
            .start();

        // extensions + migrations
        await this.runMigrations();
    }

    async teardown() {
        await this.app.close();
        await this.container.stop();
    }

    authenticatedRequest(token: string) {
        return request(this.app.getHttpServer()).set('Authorization', `Bearer ${token}`);
    }
}
```

### 10.3 Jest 설정

```json
// package.json
{
    "jest": {
        "moduleFileExtensions": ["js", "json", "ts"],
        "rootDir": ".",
        "roots": ["<rootDir>/apps", "<rootDir>/libs", "<rootDir>/test"],
        "testRegex": ".*\\.spec\\.ts$",
        "testPathIgnorePatterns": [".e2e-spec.ts$", "base-e2e.spec.ts$"],
        "transform": { "^.+\\.(t|j)s$": "ts-jest" },
        "moduleNameMapper": {
            "^@domain/(.*)$": "<rootDir>/libs/domain/src/$1",
            "^@common/(.*)$": "<rootDir>/libs/common/src/$1"
        }
    }
}
```

---

## 11. 로깅 & 감사

### 11.1 pino 구조화 로그 표준 필드

| 필드 | 의미 | 필수 |
|------|------|------|
| `time` | 타임스탬프 (pino 기본) | ✔ |
| `level` | 로그 레벨 | ✔ |
| `msg` | 메시지 | ✔ |
| `req.id` | 요청 ID (`pino-http`가 자동) | ✔ |
| `userId` | 인증된 사용자 ID | 있으면 |
| `jobId` | 다운로드 잡 처리 시 | 있으면 |
| `sceneId` | scene 관련 작업 시 | 있으면 |

### 11.2 사용 패턴

```typescript
// 서비스 내에서
import { Logger } from '@nestjs/common';

@Injectable()
export class DownloadWorkerService {
    private readonly logger = new Logger(DownloadWorkerService.name);

    async 잡을_처리한다(job: DownloadJob) {
        this.logger.log({ jobId: job.id, sceneId: job.sceneId }, '다운로드 시작');
        // ...
    }
}
```

---

## 12. 코드 생성 체크리스트

**새 기능(예: "북한 지역 크롤 타겟 추가") 구현 시 AI/Claude Code는 다음 순서로 생성한다**:

- [ ] **1. Domain Entity** — `libs/domain/{common|core|sub}/{feature}/{feature}.entity.ts`
- [ ] **2. Domain Service** — `{feature}.service.ts` (Repository 주입, 한글 메서드)
- [ ] **3. Domain Module** — `{feature}.module.ts` (`TypeOrmModule.forFeature`)
- [ ] **4. Migration** — `libs/common/database/migrations/{timestamp}-{desc}.ts`
- [ ] **5. Context Interface** — `interfaces/{feature}-context.interface.ts` (DTO, Result 타입)
- [ ] **6. Handler(s)** — `handlers/commands/*.handler.ts` 또는 `queries/*.handler.ts`
- [ ] **7. Context Service** — `{feature}-context.service.ts` (CommandBus/QueryBus 위임)
- [ ] **8. Context Module** — CqrsModule + 핸들러 등록
- [ ] **9. Business Service & Module** — 얇은 Facade
- [ ] **10. Interface DTO** — `dto/{action}-{feature}.dto.ts` (class-validator)
- [ ] **11. Controller** — Guards, Roles, 한글 메서드, raw 응답
- [ ] **12. Interface Module** — Business 모듈 import
- [ ] **13. AppModule** — Interface 모듈 추가
- [ ] **14. Swagger** — `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- [ ] **15. Test** — Domain service unit + Handler integration + Controller e2e

**전역 규칙**:
- [ ] 파일명은 **kebab-case**
- [ ] 클래스명은 **PascalCase**, 메서드명은 **한글 snake_case + `한다`**
- [ ] DTO는 Create/Update/Search 접두사 + `class-validator`
- [ ] Result 타입에는 `Dto` 아닌 `Result` 접미사
- [ ] Exception은 NestJS 내장 우선, 도메인 특수 경우만 커스텀
- [ ] 트랜잭션은 Handler 레벨에서 `dataSource.transaction()`
- [ ] Repository는 `@InjectRepository(Entity)` (커스텀 Repository 클래스 만들지 않음)
- [ ] 응답 래퍼(`{data: ...}`) 만들지 않음 — raw 반환
- [ ] import 방향: Interface → Business → Context → Domain (역순 금지)
- [ ] 같은 레이어 모듈끼리 import 금지
- [ ] Prettier: singleQuote, trailingComma=all, printWidth=120, tabWidth=4

---

## 13. 참조

- 원본 패턴: `C:\Users\USER\dev\home-inventory-manager\backend` (실제 검증된 구현)
- NestJS CQRS: https://docs.nestjs.com/recipes/cqrs
- TypeORM: https://typeorm.io
- pgmq: https://github.com/tembo-io/pgmq

**이 문서는 본 프로젝트의 모든 코드 생성 작업에서 준수해야 하는 구속력 있는 규칙**이다. 어긋나는 기존 예시 코드(문서 01–09)가 있다면 이 문서가 우선한다.
