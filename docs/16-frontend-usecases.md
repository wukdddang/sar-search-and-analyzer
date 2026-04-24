# 16. 프론트엔드 유즈케이스

> **Version:** 1.0 | **최종 수정일:** 2026-04-24
>
> | 버전 | 날짜 | 변경 내용 |
> | --- | --- | --- |
> | 1.0 | 2026-04-24 | 초안 작성 (Lumir-ERP `cms/README.md` 패턴) |

사용자·관리자·공통 영역의 유즈케이스를 도메인별로 정리한다. `UC-{영역코드}{번호}` 형식.

역할 열의 의미:
- **User**: 로그인한 `viewer` 또는 `downloader`
- **Downloader**: `downloader` 이상 (다운로드 권한 필요)
- **Admin**: `admin` 전용

Plan/Current 환경에 따라 `usePlanCurrentPathContext`로 서비스가 분기된다 ([15-frontend-architecture.md](./15-frontend-architecture.md#31-plan-vs-current-분리-원칙-lumir-erp-계승)).

---

## 영역 코드 (Area Code) 정의

| 코드 | 의미 | 경로 |
|------|------|------|
| `AUTH` | 인증 | `/(auth)` |
| `SRH` | 검색/탐색 | `/sar/user/search` |
| `CRT` | 장바구니 | `/sar/user/cart` |
| `DL` | 다운로드 (사용자) | `/sar/user/downloads` |
| `PDS` | 공공데이터 (사용자) | `/sar/user/public-datasets` |
| `NOTI` | 알림 | `/sar/user/notifications` |
| `USR` | 사용자 관리 (관리자) | `/sar/admin/users` |
| `APR` | 다운로드 승인 (관리자) | `/sar/admin/approvals` |
| `AOI` | 크롤 대상 AOI (관리자) | `/sar/admin/crawl-targets` |
| `PDA` | 공공데이터 관리 (관리자) | `/sar/admin/public-datasets` |
| `SYS` | 시스템 대시보드 (관리자) | `/sar/admin/dashboard` |
| `SYNC` | 메타데이터 Sync 모니터 (관리자) | `/sar/admin/sync-monitor` |
| `AUD` | 감사 로그 (관리자) | `/sar/admin/audit-logs` |
| `COM` | 공통 (토스트·확인모달 등) | — |

---

## 1. 인증 (AUTH)

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 인증 | UC-AUTH01 | 로그인 | 이메일·비밀번호로 로그인하고 access/refresh 토큰을 저장한다. | ✔️ | ✔️ | ✔️ |
| | UC-AUTH02 | 회원가입 | 신규 계정 생성. 관리자 승인 전까지 `is_active=false`. | ✔️ | ✔️ | ✔️ |
| | UC-AUTH03 | 승인 대기 안내 | `is_active=false` 로그인 시도 시 "승인 대기" 메시지 표시. | ✔️ | ✔️ | ✔️ |
| | UC-AUTH04 | 토큰 자동 갱신 | access 만료 시 refresh로 재발급. 실패 시 로그아웃. | ✔️ | ✔️ | ✔️ |
| | UC-AUTH05 | 로그아웃 | refresh 토큰 revoke + 로컬 스토리지 정리 후 로그인 화면으로. | ✔️ | ✔️ | ✔️ |
| | UC-AUTH06 | IP 차단 안내 | IP 허용 목록 외부 접근 시 별도 안내 화면. | ✔️ | ✔️ | ✔️ |

---

## 2. 검색/탐색 (SRH)

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 검색 | UC-SRH01 | 지도 기반 메인 검색 진입 | 지도 + 좌측 필터 + 하단 결과 리스트 3분할 화면 진입. | ✔️ | ✔️ | ✔️ |
| | UC-SRH02 | AOI 그리기 (bbox) | 지도에서 사각형을 드래그하여 bbox를 설정한다. | ✔️ | ✔️ | ✔️ |
| | UC-SRH03 | AOI 그리기 (polygon) | 자유 폴리곤을 클릭으로 그린다. | ✔️ | ✔️ | ✔️ |
| | UC-SRH04 | 행정구역 선택 | 한국 시/도·시/군·구·읍/면/동 드릴다운으로 AOI를 지정한다. | ✔️ | ✔️ | ✔️ |
| | UC-SRH05 | SHP 업로드로 AOI 지정 | zip 업로드 → 로컬 파싱 → 지도 미리보기 → AOI로 사용. | ✔️ | ✔️ | ✔️ |
| | UC-SRH06 | 공공데이터셋으로 AOI 지정 | 저장된 공공데이터셋을 선택하여 AOI로 사용한다. | ✔️ | ✔️ | ✔️ |
| | UC-SRH07 | 날짜 범위 필터 | 촬영일 from/to 슬라이더 또는 DatePicker. | ✔️ | ✔️ | ✔️ |
| | UC-SRH08 | 미션 필터 | `S1A,S1C,S2A,S2B` 등 다중 선택. | ✔️ | ✔️ | ✔️ |
| | UC-SRH09 | 제품 타입 필터 | `GRD,SLC,L1C,L2A` 등 다중 선택. | ✔️ | ✔️ | ✔️ |
| | UC-SRH10 | 검색 실행 | 필터를 기반으로 `GET /scenes` 호출, 결과 지도·리스트 갱신. | ✔️ | ✔️ | ✔️ |
| | UC-SRH11 | 강제 재조회 | `force_refresh=true`로 Copernicus 라이브 재조회. | ✔️ | ✔️ | ✔️ |
| | UC-SRH12 | 결과 리스트 페이지네이션 | cursor 기반 무한 스크롤 또는 "더 보기". | ✔️ | ✔️ | ✔️ |
| | UC-SRH13 | Scene 상세 조회 | 리스트 행 클릭 시 우측 상세 패널 슬라이드. quicklook·메타·footprint 표시. | ✔️ | ✔️ | ✔️ |
| | UC-SRH14 | 지도 ↔ 리스트 hover 연동 | 지도 footprint 위 커서 시 리스트 행 하이라이트, 역방향 동일. | ✔️ | ✔️ | ✔️ |
| | UC-SRH15 | NAS 보유 뱃지 표시 | 결과를 `available_in_nas` / `download_required`로 분리 표시. | ✔️ | ✔️ | ✔️ |
| | UC-SRH16 | 검색 상태 URL 공유 | 현재 필터·bbox·cursor를 URL로 직렬화하여 복사 가능. | ✔️ | ✔️ | ✔️ |
| | UC-SRH17 | quicklook 미리보기 | 상세 패널에서 PNG 썸네일 표시, 클릭 시 확대 모달. | ✔️ | ✔️ | ✔️ |
| | UC-SRH18 | 지도 배경 전환 | OSM / 위성 / 흑백 배경 전환 (사내 WMTS 대체 가능). | ✔️ | ✔️ | ✔️ |
| | UC-SRH19 | 전체 화면 토글 | 지도 전체 화면 모드 (필터·리스트 숨김). | ✔️ | ✔️ | ✔️ |

### 고급 기능 (Phase 후반)

| UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|-------|-------------|------|:------:|:----------:|:-----:|
| UC-SRH20 | 시계열 뷰 | 같은 AOI에 대한 과거 촬영 타임라인 (S1 repeat pass 주기 확인). | ✔️ | ✔️ | ✔️ |
| UC-SRH21 | Scene 비교 (Swipe) | 두 scene의 quicklook을 좌우 스와이프 비교. | ✔️ | ✔️ | ✔️ |

---

## 3. 장바구니 (CRT)

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 장바구니 | UC-CRT01 | Scene 추가 | 검색 결과에서 [담기] 클릭 시 로컬 스토리지 장바구니에 추가. | ✔️ | ✔️ | ✔️ |
| | UC-CRT02 | Scene 제거 | 장바구니에서 개별/전체 제거. | ✔️ | ✔️ | ✔️ |
| | UC-CRT03 | 장바구니 요약 | 선택 개수·예상 총 용량·NAS 보유 분리 카운트 표시. | ✔️ | ✔️ | ✔️ |
| | UC-CRT04 | 일괄 다운로드 요청 | 장바구니 전체에 대해 `POST /downloads` 호출. | ❌ | ✔️ | ✔️ |
| | UC-CRT05 | 100개 초과 안내 | 요청 scene 수 > 100 시 "관리자 승인 대기" 안내. | ❌ | ✔️ | ✔️ |
| | UC-CRT06 | 쿼터 초과 안내 | 응답 `QUOTA_EXCEEDED` 시 사용량/한도 표시 모달. | ❌ | ✔️ | ✔️ |
| | UC-CRT07 | 로컬 장바구니 영속화 | localStorage에 저장, 재방문 시 복원. | ✔️ | ✔️ | ✔️ |

---

## 4. 내 다운로드 (DL)

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 다운로드 | UC-DL01 | 내 잡 목록 조회 | 상태 필터(`QUEUED/RUNNING/DONE/FAILED/PENDING_APPROVAL`). | ❌ | ✔️ | ✔️ |
| | UC-DL02 | 잡 상세 | 진행률·시작/완료 시각·에러 메시지 표시. | ❌ | ✔️ | ✔️ |
| | UC-DL03 | 실시간 진행률 갱신 | WebSocket 이벤트로 progress·status 실시간 갱신. | ❌ | ✔️ | ✔️ |
| | UC-DL04 | NAS 파일 다운로드 | 완료된 scene의 원본 파일을 다운로드. | ❌ | ✔️ | ✔️ |
| | UC-DL05 | quicklook 다운로드 | 썸네일 PNG 로컬 저장. | ❌ | ✔️ | ✔️ |
| | UC-DL06 | NAS 경로 복사 | `nas_path`를 클립보드에 복사 (내부망 공유용). | ❌ | ✔️ | ✔️ |
| | UC-DL07 | 실패 잡 재시도 | `FAILED` 상태 잡에 대해 재큐잉 요청 (신규 API 필요 시). | ❌ | ✔️ | ✔️ |
| | UC-DL08 | 쿼터/사용량 위젯 | 오늘 다운로드 용량 vs 한도 시각화. | ❌ | ✔️ | ✔️ |

---

## 5. 공공데이터 (PDS) — 사용자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 공공데이터 | UC-PDS01 | 공공데이터셋 목록 조회 | 본인 업로드 + 공개된 데이터셋 목록. | ✔️ | ✔️ | ✔️ |
| | UC-PDS02 | SHP zip 업로드 | 드래그앤드롭으로 zip 업로드. 로컬 파싱 → 미리보기. | ❌ | ✔️ | ✔️ |
| | UC-PDS03 | 속성 테이블 프리뷰 | 상위 10행의 DBF 속성을 표로 표시. | ❌ | ✔️ | ✔️ |
| | UC-PDS04 | 좌표계 검증 | prj 파일 분석 → EPSG 감지. 미지원 시 에러 안내. | ❌ | ✔️ | ✔️ |
| | UC-PDS05 | 이름·설명 입력 후 저장 | 서버 업로드 → `public_datasets` 저장 → 목록 갱신. | ❌ | ✔️ | ✔️ |
| | UC-PDS06 | 데이터셋 상세 조회 | 지도 미리보기·속성·업로더·공개 여부 표시. | ✔️ | ✔️ | ✔️ |
| | UC-PDS07 | AOI로 사용 | [이 영역으로 검색] 버튼 → 검색 화면으로 이동, AOI 주입. | ✔️ | ✔️ | ✔️ |
| | UC-PDS08 | 원본 zip 재다운 | 업로더 본인만 원본 zip 재다운 가능. | ❌ | ✔️ (본인만) | ✔️ |
| | UC-PDS09 | 내 데이터셋 삭제 | 업로더 본인 소유 데이터셋 삭제. | ❌ | ✔️ (본인만) | ✔️ |

---

## 6. 알림 (NOTI)

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 알림 | UC-NOTI01 | WebSocket 연결 | 로그인 직후 `/ws/notifications` 연결, 재연결 자동. | ✔️ | ✔️ | ✔️ |
| | UC-NOTI02 | 실시간 토스트 | `download_completed/failed`, `approval_granted` 등 이벤트 토스트 표시. | ✔️ | ✔️ | ✔️ |
| | UC-NOTI03 | 누락 알림 replay | 재연결 시 `resume` 이벤트로 마지막 `notification_id` 이후 알림 일괄 수신. | ✔️ | ✔️ | ✔️ |
| | UC-NOTI04 | 알림 히스토리 목록 | 최근 30일 알림 목록, 읽음/안읽음 필터. | ✔️ | ✔️ | ✔️ |
| | UC-NOTI05 | 읽음 처리 | 개별/전체 읽음. | ✔️ | ✔️ | ✔️ |
| | UC-NOTI06 | 알림 상세 이동 | 클릭 시 관련 리소스로 이동 (잡 상세 등). | ✔️ | ✔️ | ✔️ |

---

## 7. 사용자 관리 (USR) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 사용자 | UC-USR01 | 사용자 목록 조회 | 페이지네이션·역할/활성 필터·검색. | ❌ | ❌ | ✔️ |
| | UC-USR02 | 승인 대기 목록 조회 | `is_active=false` 사용자만 필터. | ❌ | ❌ | ✔️ |
| | UC-USR03 | 사용자 승인 | `is_active=true` + 역할 지정(PATCH). | ❌ | ❌ | ✔️ |
| | UC-USR04 | 역할 변경 | viewer ↔ downloader ↔ admin. | ❌ | ❌ | ✔️ |
| | UC-USR05 | 계정 비활성화 | `is_active=false` 전환. 기존 세션 무효화. | ❌ | ❌ | ✔️ |
| | UC-USR06 | 사용자 상세 | 사용 이력·쿼터·최근 로그인 IP. | ❌ | ❌ | ✔️ |

---

## 8. 다운로드 승인 (APR) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 승인 | UC-APR01 | 승인 대기 큐 조회 | 100개 초과 요청 카드 리스트. | ❌ | ❌ | ✔️ |
| | UC-APR02 | 요청 상세 | 요청자·scene 개수·총 용량·AOI 지도 미리보기. | ❌ | ❌ | ✔️ |
| | UC-APR03 | 요청 승인 | QUEUED로 전환 → 워커 처리 시작. | ❌ | ❌ | ✔️ |
| | UC-APR04 | 요청 거절 | 사유 입력 후 거절 → 요청자에게 알림. | ❌ | ❌ | ✔️ |
| | UC-APR05 | 일괄 승인/거절 | 다중 선택 후 일괄 처리 (동일 사유). | ❌ | ❌ | ✔️ |

---

## 9. 크롤 대상 AOI (AOI) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| AOI | UC-AOI01 | 크롤 대상 목록 | 등록된 AOI 리스트 + 지도 전체 오버레이. | ❌ | ❌ | ✔️ |
| | UC-AOI02 | AOI 생성 | 지도에서 폴리곤 그리기 + 이름·미션·주기 입력. | ❌ | ❌ | ✔️ |
| | UC-AOI03 | SHP로 AOI 생성 | 공공데이터셋 또는 SHP zip에서 AOI 생성. | ❌ | ❌ | ✔️ |
| | UC-AOI04 | AOI 수정 | geom·미션·주기·활성 상태 변경. | ❌ | ❌ | ✔️ |
| | UC-AOI05 | AOI 삭제 | 확인 모달 후 삭제. 이력은 유지. | ❌ | ❌ | ✔️ |
| | UC-AOI06 | AOI 활성/비활성 토글 | 임시로 크롤 중단/재개. | ❌ | ❌ | ✔️ |
| | UC-AOI07 | 즉시 크롤 실행 | 주기와 무관하게 1회 트리거. | ❌ | ❌ | ✔️ |
| | UC-AOI08 | 크롤 이력 조회 | AOI별 최근 크롤 시각·신규 scene 수. | ❌ | ❌ | ✔️ |

---

## 10. 공공데이터 관리 (PDA) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 공공데이터 관리 | UC-PDA01 | 전체 데이터셋 목록 | 사용자 업로드 포함 전체 조회. | ❌ | ❌ | ✔️ |
| | UC-PDA02 | 공개/비공개 토글 | 공개 시 모든 사용자가 AOI로 사용 가능. | ❌ | ❌ | ✔️ |
| | UC-PDA03 | 강제 삭제 | 소유자 관계없이 삭제. 연결 이력은 유지. | ❌ | ❌ | ✔️ |
| | UC-PDA04 | 원본 zip 재다운 | 감사용 원본 zip 다운. | ❌ | ❌ | ✔️ |

---

## 11. 시스템 대시보드 (SYS) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 대시보드 | UC-SYS01 | 큐 적체 현황 | pgmq 대기 중 잡 수, 평균 대기 시간. | ❌ | ❌ | ✔️ |
| | UC-SYS02 | 워커 처리율 | 최근 1h/24h 처리 scene/byte 수. | ❌ | ❌ | ✔️ |
| | UC-SYS03 | NAS 사용량 | 총 용량 / 사용량 / 가용 / 전체 scene 수. | ❌ | ❌ | ✔️ |
| | UC-SYS04 | 최근 에러 요약 | `code`별 최근 24h 발생 건수. | ❌ | ❌ | ✔️ |
| | UC-SYS05 | 실시간 이벤트 스트림 | 완료/실패/승인 요청 실시간 타일. | ❌ | ❌ | ✔️ |
| | UC-SYS06 | 사용자별 쿼터 사용 요약 | Top N 사용자. | ❌ | ❌ | ✔️ |

---

## 12. 메타데이터 Sync 모니터 (SYNC) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| Sync | UC-SYNC01 | 마지막 크롤 시각 조회 | AOI별 마지막 sync 시각 및 커버리지 지도. | ❌ | ❌ | ✔️ |
| | UC-SYNC02 | Sync 이력 목록 | 페이지네이션·AOI 필터. | ❌ | ❌ | ✔️ |
| | UC-SYNC03 | 실패 Sync 재시도 | 실패한 크롤 잡 수동 재시도. | ❌ | ❌ | ✔️ |
| | UC-SYNC04 | 커버리지 경고 | 24시간 넘게 sync 안 된 AOI 경고 표시. | ❌ | ❌ | ✔️ |

---

## 13. 감사 로그 (AUD) — 관리자

| 구분 | UC ID | 유즈케이스명 | 설명 | Viewer | Downloader | Admin |
|------|-------|-------------|------|:------:|:----------:|:-----:|
| 감사 | UC-AUD01 | 로그 목록 조회 | cursor 기반, 시간 역순. 필터(user_id, action, code). | ❌ | ❌ | ✔️ |
| | UC-AUD02 | 로그 상세 | payload JSON, IP, UA 표시. | ❌ | ❌ | ✔️ |
| | UC-AUD03 | 로그 CSV 내보내기 | 필터된 결과를 CSV 다운로드 (최대 10만건). | ❌ | ❌ | ✔️ |

---

## 14. 공통 (COM)

| 구분 | UC ID | 유즈케이스명 | 설명 | 모든 역할 |
|------|-------|-------------|------|:---------:|
| 공통 | UC-COM01 | 확인 모달 | 파괴적 동작(삭제·비활성화·승인 등) 전 표준 확인 모달. | ✔️ |
| | UC-COM02 | 토스트 알림 | success/destructive/default 3종 variant. 자동 사라짐. | ✔️ |
| | UC-COM03 | 로딩 오버레이 | RingSpinner + 페이지 전환 안내. | ✔️ |
| | UC-COM04 | Plan/Current 전환 배지 | 상단 헤더에 현재 모드 시각화 (Plan=노랑, Current=파랑). | ✔️ |
| | UC-COM05 | 경로 가드 | 역할별 접근 차단 시 403 안내 + 리다이렉트. | ✔️ |
| | UC-COM06 | 에러 바운더리 | 예기치 않은 에러 시 `error.tsx` 렌더, 재시도 버튼. | ✔️ |
| | UC-COM07 | 세션 만료 안내 | refresh 실패 시 안내 모달 → 로그인 화면. | ✔️ |

---

## 15. API 매핑 요약

| UC 범주 | 주요 백엔드 엔드포인트 |
|---------|---------------------|
| UC-AUTH* | `POST /auth/login`, `/register`, `/refresh`, `/logout` |
| UC-SRH* | `GET /scenes`, `GET /regions`, `GET /scenes/{id}/quicklook` |
| UC-CRT* | (클라이언트 상태) + `POST /downloads` |
| UC-DL* | `GET /downloads`, `GET /downloads/{id}`, `GET /scenes/{id}/file` |
| UC-PDS* | `POST /public-datasets`, `GET /public-datasets`, `GET/DELETE /public-datasets/{id}` ※ 신규 |
| UC-NOTI* | `GET /ws/notifications` (WebSocket), `GET /notifications` (히스토리) |
| UC-USR* | `GET/PATCH /admin/users` |
| UC-APR* | `/admin/jobs/pending`, `/admin/jobs/{id}/approve|reject` |
| UC-AOI* | `GET/POST /admin/crawl-targets`, `PATCH/DELETE /admin/crawl-targets/{id}` |
| UC-PDA* | `PATCH/DELETE /admin/public-datasets/{id}` ※ 신규 |
| UC-SYS* | `GET /admin/stats` |
| UC-SYNC* | `GET /admin/sync-status` ※ 신규 |
| UC-AUD* | `GET /admin/audit-logs` ※ 신규 |

※ 표시는 `05-api-spec.md`에 아직 정의되지 않은 엔드포인트 — 백엔드 확정 필요.

---

## 16. 참고 문서

- [15. 프론트엔드 아키텍처](./15-frontend-architecture.md) — 기술 스택, 폴더 구조, plan/current
- [17. 프론트엔드 IA](./17-frontend-ia.md) — Screen ID 체계, Page/Layer 구분, 정책 상세
- [05. API 명세](./05-api-spec.md) — 백엔드 엔드포인트 정의
- [06. 인증 및 권한](./06-auth.md) — 역할·IP 허용 규칙
