# @sentinel/web

Sentinel 데이터 플랫폼 프론트엔드. Next.js 15 App Router + OpenLayers + TanStack Query.

## 개발

```bash
pnpm install          # 모노레포 루트에서
pnpm web:dev           # 또는: pnpm --filter @sentinel/web dev
```

기본 포트: <http://localhost:3000> (루트는 `/current/sar/user/search`로 자동 리다이렉트)

## 라우트 구조

`Lumir-ERP` 패턴 계승. 상세는 [`docs/15-frontend-architecture.md`](../../docs/15-frontend-architecture.md) 참조.

```
src/app/
├── (auth)/              # 로그인/회원가입 (인증 전)
├── (planning)/plan/     # Mock 데이터 (기획·와이어프레임)
│   └── (sar)/sar/
│       ├── user/        # 사용자 화면
│       └── admin/       # 관리자 화면 (추가 예정)
└── (current)/current/   # 실제 API 연결 (운영)
    └── (sar)/sar/
        ├── user/
        └── admin/
```

## 도메인 폴더 관례

```
search/
├── page.tsx                 # Next.js 라우트 엔트리
├── _context/                # React Context + API 서비스
├── _ui/                     # .section.tsx / .modal.tsx / .component.tsx
├── _hooks/                  # 도메인 전용 훅
├── _mocks/                  # plan 전용 Mock 데이터
├── _services/               # 헬퍼 서비스
└── _types/                  # 도메인 타입
```

## 환경 변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | API 서버 URL | `http://localhost:3001/api/v1` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `http://localhost:3001` |
| `NEXT_PUBLIC_OSM_TILE_URL` | 대체 타일 서버 (사내망용) | OSM 기본 |

## 참고

- [docs/15-frontend-architecture.md](../../docs/15-frontend-architecture.md)
- [docs/16-frontend-usecases.md](../../docs/16-frontend-usecases.md)
- [docs/17-frontend-ia.md](../../docs/17-frontend-ia.md)
- [docs/19-frontend-scenarios.md](../../docs/19-frontend-scenarios.md)
