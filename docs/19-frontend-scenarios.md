# 19. 프론트엔드 End-to-End 시나리오

> **Version:** 1.0 | **최종 수정일:** 2026-04-24
>
> | 버전 | 날짜 | 변경 내용 |
> | --- | --- | --- |
> | 1.0 | 2026-04-24 | 초안 작성 (Lumir-ERP `cms/SCENARIO.md` 패턴) |

사용자·관리자·공통 영역의 End-to-End 시나리오를 정리한다. 각 시나리오는 `16-frontend-usecases.md`의 UC와 `17-frontend-ia.md`의 Screen ID를 연결한다.

---

## 범례

| 항목 | 설명 |
| --- | --- |
| **시나리오 ID** | `SC-{역할코드}-{일련번호}` 형식. 역할코드: `USR`(Downloader/Viewer), `ADM`(Admin) |
| **유즈케이스 ID** | `16-frontend-usecases.md` 참조 |
| **Screen ID** | `17-frontend-ia.md` 참조 |
| **페이지 타입** | `P` = Page (URL 변경) / `L` = Layer (URL 미변경, 모달·팝업·Drawer) |

---

## 1. User — 인증 및 온보딩

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-USR-001 | 신규 가입 후 승인 대기 | Viewer | 계정 생성하고 관리자 승인을 기다린다 | - 사내 IP 허용 목록 내부 | UC-AUTH02 → UC-AUTH03 | SAR_AUTH_REGISTER(P) → SAR_AUTH_PENDING(P) | - 비밀번호 10자+영문/숫자/특수 혼합 실시간 검증<br>- 중복 이메일 `409 Conflict` 시 "이미 가입된 이메일" 문구<br>- 가입 성공 시 `is_active=false`로 생성 후 안내 화면으로 이동<br>- 관리자에게 승인 요청 알림 자동 전송 | - IP 차단: SAR_AUTH_IP로 리다이렉트<br>- 중복 이메일: 이메일 필드 아래 빨간 텍스트<br>- 네트워크 에러: 제출 버튼 유지 + 토스트 재시도 안내 |
| SC-USR-002 | 승인 후 첫 로그인 | Viewer | 관리자 승인 후 로그인하고 검색 화면으로 진입 | - `is_active=true` 상태<br>- 사내 IP 허용 | UC-AUTH01 → UC-AUTH04 → UC-SRH01 | SAR_AUTH_LOGIN(P) → SAR_SRH_MAIN(P) | - 로그인 성공 시 access/refresh 토큰을 HttpOnly 쿠키 + 메모리에 저장<br>- 홈 경로(`/current/sar/user/search`)로 리다이렉트<br>- 상단 헤더에 사용자 이름·역할 뱃지 표시 | - 비밀번호 틀림: 모호한 에러 ("이메일 또는 비밀번호가 올바르지 않습니다")<br>- `is_active=false`: "계정 승인 대기 중입니다" 별도 메시지<br>- IP 차단: SAR_AUTH_IP로 이동 |
| SC-USR-003 | 세션 만료 → 자동 재로그인 유도 | User | 장시간 비활성 후 API 호출 실패 시 로그인 화면으로 부드럽게 이동 | - access 토큰 만료됨 | UC-AUTH04 (실패) → UC-AUTH05 | 임의 화면(P) → SAR_AUTH_EXPIRED(L) → SAR_AUTH_LOGIN(P) | - API 401 응답 시 refresh 자동 시도<br>- refresh 성공: 원래 동작 재시도 (사용자 체감 없음)<br>- refresh 실패: SAR_AUTH_EXPIRED 모달 표시 + 로컬 스토리지 토큰 제거 → 로그인 이동<br>- 모달 [확인] 클릭 시 현재 경로를 `redirect_to` 쿼리로 전달 | - refresh 도난 감지(동일 refresh 재사용): 사용자 모든 토큰 revoke + 강제 로그아웃<br>- 네트워크 오프라인: 오프라인 토스트 + 재시도 큐 (짧은 동작만) |

---

## 2. User — 검색 및 AOI 지정

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-USR-004 | bbox로 scene 검색 | Viewer+ | 지도에서 사각형을 그려 scene 목록을 조회 | - 로그인 상태 | UC-SRH01 → UC-SRH02 → UC-SRH07 → UC-SRH10 → UC-SRH12 | SAR_SRH_MAIN(P) → SAR_SRH_DRAW(L) → SAR_SRH_LIST(L) | - AOI 그리기 완료 시 자동 `GET /scenes` 트리거<br>- 응답 `sync_status.source=db_cache` 시 50ms 이내 결과<br>- `copernicus_live`면 로딩 스피너 2~5초<br>- 결과를 `available_in_nas` / `download_required`로 분리 표시<br>- URL에 bbox·필터·cursor 직렬화 | - bbox 면적 과대(> 1000만 km²): 클라이언트 경고<br>- 결과 0건: Empty View "조건에 맞는 scene이 없습니다"<br>- Copernicus 5xx: `sync_status.source=db_cache` 강제 사용 + 경고 토스트 |
| SC-USR-005 | 행정구역으로 scene 검색 | Viewer+ | 한국 시/도→시/군/구→읍/면/동 드릴다운으로 AOI 지정 | - 로그인 상태 | UC-SRH01 → UC-SRH04 → UC-SRH10 | SAR_SRH_MAIN(P) → SAR_SRH_FILTER(L) | - Level 1→2→3 드릴다운 드롭다운<br>- 지역 코드를 `region_code` 쿼리로 전달<br>- 지도는 해당 지역 폴리곤 하이라이트 + auto-fit<br>- 다른 AOI와 상호 배타적 (하나만 활성) | - 하위 데이터 없는 지역: 하위 드롭다운 비활성화<br>- 지역 데이터 로드 실패: 드롭다운 상단 에러 메시지 |
| SC-USR-006 | SHP 업로드로 AOI 지정 | Downloader+ | 외부에서 받은 Shapefile을 업로드해 AOI로 사용 | - 로그인 상태<br>- `.zip` 파일 준비 (shp+shx+dbf+prj, ≤50MB) | UC-SRH05 → UC-PDS02 → UC-PDS03 → UC-PDS04 → UC-SRH10 | SAR_SRH_DRAW(L) → SAR_SRH_UPLOAD(L) → SAR_SRH_MAIN(P) | - 드래그앤드롭 또는 [파일 선택]<br>- `shpjs` 로컬 파싱 → GeoJSON → 지도 미리보기(파란 폴리곤)<br>- 속성 테이블 상위 10행 프리뷰<br>- `prj` 분석 → EPSG 감지, EPSG:5179(한국 통일원점) 등 자동 변환<br>- [AOI로 사용] → 모달 닫고 지도에 AOI 적용 + 자동 검색 | - 필수 파일 누락(shp만, dbf 없음): "잘못된 SHP 파일" 에러<br>- 좌표계 미감지: EPSG 수동 선택 드롭다운 표시<br>- 50MB 초과: 업로드 전 거부<br>- 멀티폴리곤 아닌 경우: 단일 폴리곤으로 변환, 불가능 시 경고 |
| SC-USR-007 | 공공데이터셋으로 AOI 지정 | Viewer+ | 저장된 공개 데이터셋을 선택해 AOI로 사용 | - 공개 데이터셋 1건 이상 존재 | UC-PDS01 → UC-PDS07 → UC-SRH10 | SAR_PDS_LIST(P) → SAR_PDS_DTL(L) → SAR_SRH_MAIN(P) | - [이 영역으로 검색] 버튼 클릭 시 검색 화면으로 이동 + AOI 주입<br>- 이동 시 현재 검색 조건이 있으면 확인 모달 | - 비공개 데이터셋 본인 외 접근: 403 → 목록으로 리다이렉트 |
| SC-USR-008 | URL 공유 → 동일 검색 상태 복원 | Any | 동료에게 URL 전달 → 필터·AOI·페이지까지 동일 화면 | - 검색 결과가 있는 상태 | UC-SRH16 → (재진입) UC-SRH01 | SAR_SRH_MAIN(P) → SAR_SRH_SHARE(L) | - URL 쿼리: `bbox`, `date_from`, `date_to`, `mission`, `product_type`, `cursor`<br>- [복사] 클릭 시 클립보드 + 토스트<br>- URL에는 토큰/민감 정보 포함 금지<br>- 재진입 시 쿼리로 필터·AOI 자동 복원 후 검색 실행 | - 만료된 cursor: 경고 표시 후 첫 페이지부터 |
| SC-USR-009 | Scene 상세 확인 및 장바구니 담기 | Viewer+ | 관심 scene의 quicklook·메타를 확인하고 장바구니에 담기 | - 검색 결과 존재 | UC-SRH13 → UC-SRH17 → UC-CRT01 | SAR_SRH_LIST(L) → SAR_SRH_DTL(L) → SAR_SRH_QL(L) | - 리스트 행 클릭 시 우측 상세 슬라이드<br>- 상세에서 [장바구니 담기] → 로컬스토리지 저장 + 우측 장바구니 패널 업데이트<br>- 이미 담긴 scene은 [담기] → [담김 ✓]로 토글<br>- quicklook 썸네일 클릭 시 전체 화면 모달 | - quicklook 404 (아직 생성 안됨): placeholder 이미지<br>- 상세 API 실패: 상세 패널 내 에러 + 재시도 버튼 |

---

## 3. User — 다운로드 플로우

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-USR-010 | 장바구니 일괄 다운로드 (<100개) | Downloader+ | 장바구니 scene 전체를 큐에 등록 | - 장바구니 1~100 scene | UC-CRT03 → UC-CRT04 → UC-DL01 → UC-NOTI02 | SAR_CRT_MAIN(P) → SAR_DL_LIST(P) | - [일괄 다운로드] 버튼 클릭 → `POST /downloads`<br>- 응답 즉시 jobs 반환 → 장바구니 초기화<br>- `already_available` scene은 NAS에서 바로 접근 안내<br>- SAR_DL_LIST로 이동, WebSocket으로 progress 실시간 갱신<br>- 완료 시 실시간 토스트 | - QUOTA_EXCEEDED: SAR_CRT_QUOTA 모달<br>- 쿠키/토큰 만료: SC-USR-003 플로우 |
| SC-USR-011 | 100개 초과 요청 → 승인 대기 | Downloader+ | 대량 요청 시 관리자 승인을 기다린 뒤 다운로드 | - 장바구니 scene > 100 | UC-CRT04 → UC-CRT05 → UC-DL01 (PENDING) → (관리자 승인) → UC-NOTI02 | SAR_CRT_MAIN(P) → SAR_CRT_APPROVAL(L) → SAR_DL_LIST(P) | - 응답 `PENDING_APPROVAL` 시 안내 모달 표시<br>- 모달 [내 다운로드 보기] → SAR_DL_LIST 이동<br>- 잡 상태는 `PENDING_APPROVAL`, 진행률 표시 안 함<br>- 관리자 승인 시 `QUEUED`로 전환, WebSocket `approval_granted` 이벤트 → 토스트<br>- 관리자 거절 시 `REJECTED`, 사유 표시 | - 관리자 응답 없음: 상태 유지, 사용자가 수동 취소 가능 (옵션 기능)<br>- 거절됨: 토스트 + 상세에 사유 |
| SC-USR-012 | 쿼터 초과 안내 | Downloader+ | 일일 쿼터 초과로 요청이 거부될 때 안내 | - 쿼터 사용률 ≥ 100% | UC-CRT04 (실패) → UC-CRT06 | SAR_CRT_MAIN(P) → SAR_CRT_QUOTA(L) | - `429 QUOTA_EXCEEDED` 응답 시 모달 표시<br>- 사용량/한도 Progress bar, 리셋 시각 (한국 시간 익일 00시)<br>- [확인] → 장바구니 유지 | - 부분 실패(일부만 초과): 백엔드가 all-or-nothing으로 처리, 모두 거부됨 |
| SC-USR-013 | 다운로드 진행률 실시간 확인 | Downloader+ | 잡 상태와 진행률을 실시간으로 확인 | - 로그인 + 활성 잡 존재 | UC-DL01 → UC-DL02 → UC-DL03 | SAR_DL_LIST(P) → SAR_DL_DTL(L) | - WebSocket `progress_updated` 이벤트로 progress 갱신 (1초 디바운스)<br>- 상태 전환 애니메이션: QUEUED → RUNNING → DONE<br>- DONE 시 [파일 다운로드] / [NAS 경로 복사] 활성화<br>- 하단 쿼터 위젯 실시간 갱신 | - WebSocket 끊김: exponential backoff 재연결 (1s→2s→4s→…→30s)<br>- 재연결 후 `resume` 이벤트로 누락 이벤트 replay |
| SC-USR-014 | 실패한 다운로드 재시도 | Downloader+ | FAILED 잡을 수동 재시도 | - FAILED 상태 잡 존재 | UC-DL02 → UC-DL07 | SAR_DL_LIST(P) → SAR_DL_DTL(L) → SAR_DL_RETRY(L) | - 상세의 [재시도] 버튼 → 확인 모달<br>- 확인 시 동일 scene에 대한 새 잡 생성<br>- 원본 잡은 FAILED 상태 유지 (이력 보존)<br>- 재시도 시에도 쿼터 카운트 적용 | - 동일 scene에 이미 RUNNING 잡 존재: 중복 방지 409<br>- 원본 파일이 Copernicus에서도 삭제됨: 재시도도 실패 |
| SC-USR-015 | NAS 보유 scene 즉시 사용 | Downloader+ | 이미 NAS에 있는 scene의 파일·경로를 바로 사용 | - `available_in_nas` 목록에 scene 존재 | UC-SRH15 → UC-DL04 / UC-DL06 | SAR_SRH_DTL(L) | - 상세에서 [바로 받기] / [NAS 경로 복사] 버튼 노출<br>- [바로 받기]: `GET /scenes/{id}/file` → 302 리다이렉트 또는 스트림<br>- [NAS 경로 복사]: 사내망 SMB 경로 클립보드 복사 + 토스트 | - NAS 파일 실제로는 없음 (DB와 불일치): 404 → "파일이 삭제된 것 같습니다" 안내 |

---

## 4. User — 공공데이터 관리

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-USR-016 | SHP 업로드 → 내 데이터셋 저장 | Downloader+ | 업로드한 Shapefile을 서버에 영구 저장 | - 유효한 `.zip` 파일 | UC-PDS02 → UC-PDS05 → UC-PDS01 | SAR_PDS_LIST(P) → SAR_PDS_NEW(L) → SAR_PDS_FORM(L) | - 로컬 파싱 후 [공용 데이터셋으로 저장] 선택 시 폼 표시<br>- 이름 필수, 설명 선택<br>- `POST /public-datasets` multipart 업로드 + 진행률 표시<br>- 업로드 중 다른 모달 전환 금지 (업로드 취소 버튼만)<br>- 업로드 완료 시 목록 갱신 + 토스트<br>- 기본 `is_public=false` (관리자 승격 필요) | - 업로드 도중 브라우저 새로고침: 업로드 중단 경고<br>- 서버 검증 실패(좌표계 등): 폼 상단 에러, 파일 재선택 유도<br>- 네트워크 중단: 재시도 버튼 |
| SC-USR-017 | 내 데이터셋 상세 확인 및 AOI로 사용 | Viewer+ | 저장된 데이터셋을 검색 AOI로 활용 | - 본인 또는 공개 데이터셋 존재 | UC-PDS06 → UC-PDS07 | SAR_PDS_LIST(P) → SAR_PDS_DTL(L) → SAR_SRH_MAIN(P) | - 행 클릭 시 상세 모달<br>- 지도 미리보기(폴리곤, auto-fit)<br>- [이 영역으로 검색] → SAR_SRH_MAIN 이동, AOI 주입 후 자동 검색 | - 대형 geom(> 10000 피처): 경량화 버전 먼저 로드, "더 보기" 버튼으로 full geom 요청 |
| SC-USR-018 | 내 데이터셋 삭제 | Downloader+ | 불필요한 업로드 삭제 | - 본인 소유 데이터셋 | UC-PDS09 | SAR_PDS_DTL(L) → SAR_PDS_DEL(L) | - 본인 소유만 삭제 가능 ([삭제] 버튼 본인에게만 노출)<br>- 확인 모달 "이 작업은 되돌릴 수 없습니다"<br>- 삭제 성공 시 상세 모달 닫고 목록 갱신<br>- 원본 zip은 30일 cleanup 대상 (즉시 삭제 X) | - 관리자가 공개로 전환한 후 소유자가 삭제 시도: 허용 (공개 해제 + 삭제) |

---

## 5. User — 알림

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-USR-019 | 다운로드 완료 실시간 알림 | Downloader+ | 잡 완료 시 실시간 토스트로 인지 | - WebSocket 연결 활성 | UC-NOTI01 → UC-NOTI02 | (임의 화면) → SAR_NOTI_TOAST(L) | - 화면 우하단 토스트 스택 (최대 5개, 오래된 것부터 fade)<br>- success variant + [자세히] 링크 → SAR_DL_DTL 이동<br>- 읽음 처리는 클릭 시 자동<br>- 로컬 `lastNotificationId` 갱신 | - 토스트 5개 초과: 가장 오래된 것 제거<br>- 페이지 비활성: Web Notification API로 OS 알림 (권한 동의 시) |
| SC-USR-020 | 재연결 후 누락 알림 replay | User | 오프라인이었던 시간 동안의 알림 수신 | - 이전 세션에서 `lastNotificationId` 저장됨 | UC-NOTI01 → UC-NOTI03 | (임의 화면) | - WebSocket `connect` 이벤트 후 `resume` emit<br>- 서버가 `lastNotificationId` 이후 30일 내 알림을 일괄 전송<br>- 받은 알림은 히스토리에 추가, 토스트는 표시 X (대량 방지) + "N건 누락 알림을 불러왔습니다" 단일 토스트 | - 30일 초과: "마지막 확인 후 30일이 지나 일부 알림이 없을 수 있습니다"<br>- 서버에서 lastId 찾을 수 없음(revoke 등): 전체 replay 생략 |
| SC-USR-021 | 알림 히스토리 조회 | User | 최근 알림을 시간순으로 조회하고 읽음 처리 | - 로그인 상태 | UC-NOTI04 → UC-NOTI05 → UC-NOTI06 | SAR_NOTI_CENTER(P) | - 안읽음 / 전체 필터<br>- 행 클릭 시 관련 리소스 이동 + 자동 읽음<br>- [모두 읽음] 버튼 | - 리소스 없음(삭제된 잡 등): "관련 리소스를 찾을 수 없습니다" 토스트 |

---

## 6. Admin — 사용자 관리

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-ADM-001 | 가입 승인 | Admin | 승인 대기 사용자를 활성화하고 역할 부여 | - `is_active=false` 사용자 존재 | UC-USR02 → UC-USR03 | SAR_USR_LIST(P) → SAR_USR_APPROVE(L) | - [승인 대기만 보기] 퀵 필터<br>- 승인 모달에서 역할 선택(viewer/downloader)<br>- 승인 시 `PATCH /admin/users/{id}` + 사용자에게 이메일 + WebSocket 알림<br>- 목록에서 해당 행 즉시 사라짐 | - 승인 사이 사용자 삭제됨: 404 토스트 + 목록 새로고침<br>- 권한 외 작업: 403 (미들웨어에서 차단) |
| SC-ADM-002 | 역할 변경 | Admin | 기존 사용자의 역할을 변경 | - 활성 사용자 존재 | UC-USR04 | SAR_USR_LIST(P) → SAR_USR_DTL(L) → SAR_USR_ROLE(L) | - 역할 변경 시 확인 모달 + 이유 선택 (선택)<br>- downloader→admin 승격은 이중 확인<br>- 변경 즉시 해당 사용자 JWT에 반영 (다음 refresh 시)<br>- 감사 로그 기록 | - 본인 역할 변경 시도(admin 자기 자신): 방지 |
| SC-ADM-003 | 사용자 비활성화 | Admin | 탈퇴·휴직 사용자 계정 비활성 | - 활성 사용자 존재 | UC-USR05 | SAR_USR_DTL(L) → SAR_USR_DEACT(L) | - 비활성화 확인 모달 + 경고<br>- 확인 시 `is_active=false` + 모든 refresh 토큰 revoke<br>- 기존 RUNNING 다운로드 잡은 그대로 완료까지 유지<br>- 새 요청은 즉시 차단 | - 마지막 admin 비활성화 시도: 방지 (최소 1명 admin 유지) |

---

## 7. Admin — 다운로드 승인

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-ADM-004 | 단건 다운로드 승인 | Admin | 100개 초과 요청을 검토 후 승인 | - PENDING_APPROVAL 잡 존재 | UC-APR01 → UC-APR02 → UC-APR03 | SAR_APR_LIST(P) → SAR_APR_DTL(L) → SAR_APR_APPROVE(L) | - 상세 모달에서 요청자·scene 수·용량·AOI 미니맵 확인<br>- NAS 가용 용량 vs 요청 용량 경고 배지<br>- [승인] → 모든 잡 `QUEUED`로 전환 + 요청자 알림<br>- 승인 후 카드 목록에서 즉시 사라짐 | - NAS 가용 부족: 승인 시 경고 이중 확인<br>- 동시 다른 admin이 승인/거절: 409 → 최신 상태로 갱신 |
| SC-ADM-005 | 일괄 거절 | Admin | 규모가 큰 요청 여러 건을 사유와 함께 거절 | - PENDING_APPROVAL 잡 ≥ 2 | UC-APR01 → UC-APR05 → UC-APR04 | SAR_APR_LIST(P) → SAR_APR_REJECT(L) | - 체크박스 다중 선택 → [일괄 거절]<br>- 사유 필수 입력 (공통 사유)<br>- 템플릿 선택 가능 (NAS 용량 부족, 기간 외 등)<br>- 거절 시 요청자에게 사유 포함 알림<br>- 잡 상태 REJECTED | - 일부 실패: 실패 건만 카드 유지, 에러 토스트 |

---

## 8. Admin — 크롤 대상 AOI

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-ADM-006 | 지도에서 AOI 생성 | Admin | 새 크롤 대상 영역을 지도 폴리곤으로 등록 | - 로그인 + admin | UC-AOI01 → UC-AOI02 | SAR_AOI_LIST(P) → SAR_AOI_NEW(L) | - 지도에서 폴리곤 그리기 또는 bbox 드래그<br>- 이름·미션 다중·주기(기본 4h)·활성 토글<br>- [저장] → `POST /admin/crawl-targets`<br>- 저장 즉시 목록 갱신 + 지도 오버레이 반영 | - 중복 이름: 서버 검증 → 에러 토스트<br>- 주기 < 1시간: 경고 (과도한 크롤 방지) |
| SC-ADM-007 | SHP로 AOI 생성 | Admin | 공공데이터셋 또는 SHP에서 AOI 생성 | - 업로드 가능한 SHP 또는 저장된 데이터셋 | UC-AOI03 | SAR_AOI_NEW(L) | - geom 지정 탭에서 [SHP 업로드] / [공공데이터셋 선택]<br>- 미리보기 후 저장 | - SHP 파싱 실패: 동일한 에러 처리 (SC-USR-006) |
| SC-ADM-008 | 즉시 크롤 실행 | Admin | 주기와 무관하게 AOI를 수동 크롤 | - 활성 AOI | UC-AOI07 | SAR_AOI_LIST(P) → SAR_AOI_RUN(L) | - [즉시 실행] 버튼 → 확인 모달<br>- `POST /admin/crawl-targets/{id}/trigger` → 202 + job_id<br>- 잡 상태는 Sync 모니터에서 확인<br>- 중복 실행 방지: 이미 RUNNING이면 버튼 비활성 | - 실행 중 네트워크 오류: 재시도 제안 |
| SC-ADM-009 | 비활성 AOI로 크롤 중단 | Admin | 일시적으로 특정 AOI의 정기 크롤을 멈춤 | - 활성 AOI | UC-AOI06 | SAR_AOI_LIST(P) → SAR_AOI_ACTIVE(L) | - 토글 클릭 시 확인 모달<br>- 비활성 시 다음 주기부터 크롤 안 함<br>- 기존 예약 잡은 취소되지 않음 (완료까지) | - 재활성화 시 즉시 크롤 옵션 제안 |

---

## 9. Admin — 공공데이터 관리

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-ADM-010 | 데이터셋 공개 승격 | Admin | 사용자 업로드 데이터셋을 전체 공개로 전환 | - is_public=false 데이터셋 | UC-PDA01 → UC-PDA02 | SAR_PDA_LIST(P) → SAR_PDA_DTL(L) → SAR_PDA_PUB(L) | - 공개 전환 확인 모달 + 공개 후 영향 안내<br>- 전환 시 모든 사용자 목록에 즉시 노출<br>- 원 업로더에게 알림 (옵션) | - 소유자 계정 비활성 상태: 여전히 공개 가능 |
| SC-ADM-011 | 데이터셋 강제 삭제 | Admin | 부적절한 업로드를 삭제 | - 삭제 대상 존재 | UC-PDA03 | SAR_PDA_LIST(P) → SAR_PDA_DEL(L) | - 이중 확인 모달 (삭제 사유 옵션 입력)<br>- 원 업로더에게 알림<br>- 원본 zip은 30일 cleanup | - 현재 사용 중인 검색이 있어도 삭제 진행 (검색은 캐시된 결과 유지) |

---

## 10. Admin — 시스템 운영

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-ADM-012 | 대시보드 실시간 모니터링 | Admin | 시스템 전반 상태 파악 | - admin 로그인 | UC-SYS01 → UC-SYS02 → UC-SYS03 → UC-SYS05 | SAR_SYS_MAIN(P) | - 상단 KPI 카드 30초 폴링<br>- 실시간 이벤트 타일 WebSocket 구독<br>- 차트 hover 시 상세 수치 툴팁<br>- NAS 80% 초과: 주황, 95% 초과: 빨강 | - API 실패: 카드별 에러 상태 표시, 나머지는 정상 렌더 |
| SC-ADM-013 | 실패 Sync 재시도 | Admin | 실패한 sync 잡을 수동 재시도 | - failing 상태 AOI 존재 | UC-SYNC01 → UC-SYNC02 → UC-SYNC03 | SAR_SYNC_MAIN(P) → SAR_SYNC_LOG(L) → SAR_SYNC_RETRY(L) | - failing AOI는 지도에서 빨강 + 경고 뱃지<br>- 이력 모달에서 실패 로그 확인 후 [재시도]<br>- 재시도 시 `POST /admin/sync-logs/{id}/retry` → 202 | - 외부 Copernicus 장애 지속: 재시도도 실패 → 알림 |
| SC-ADM-014 | 감사 로그 조회 및 CSV 내보내기 | Admin | 보안 감사 또는 사건 분석을 위해 로그 검토 | - 로그 데이터 존재 | UC-AUD01 → UC-AUD02 → UC-AUD03 | SAR_AUD_LIST(P) → SAR_AUD_DTL(L) → SAR_AUD_EXPORT(L) | - 필터: user_id, action, code, 기간<br>- 행 클릭 시 payload JSON 확인<br>- [CSV 내보내기] → 현재 필터 기준 스트리밍 다운로드<br>- 최대 10만건, 초과 시 분할 쿼리 안내 | - 결과 0건: Empty View<br>- 10만 초과 export: SAR_AUD_EXPORT에 경고 + 분할 안내 |
| SC-ADM-015 | 에러 스파이크 추적 | Admin | 특정 code 에러 급증 원인 확인 | - 최근 에러 발생 | UC-SYS04 → UC-AUD01 | SAR_SYS_MAIN(P) → SAR_SYS_ERR(L) → SAR_AUD_LIST(P) | - 대시보드 에러 요약 모달 → 특정 code 행 클릭 → 감사 로그(필터 적용)로 이동<br>- 필터 자동 적용(`code=...`, 최근 24h) | - 감사 로그에 관련 payload가 부족하면 추가 로깅 개선 과제로 기록 |

---

## 11. 공통

| 시나리오 ID | 시나리오명 | 역할 | 목적 | 전제 조건 | 유즈케이스 흐름 | 관련 페이지/모달 | 주요 정책 | 예외 처리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SC-COM-001 | Plan ↔ Current 모드 전환 확인 | Any | 개발 중 Mock / 실제 API 구분을 명시 | - 로그인 | UC-COM04 | 모든 화면 | - 헤더 우측 배지: Plan=노랑, Current=파랑<br>- Plan에서 실제 영향이 있는 버튼은 시뮬레이션 토스트<br>- 경로 변경(`/plan` ↔ `/current`)으로 모드 전환 | - Plan에서 브라우저 히스토리 상 Current 진입 시 로그인 상태 유지 |
| SC-COM-002 | 경로 가드 403 처리 | Any | 권한 외 경로 접근 시 차단 | - 접근 권한 부족 | UC-COM05 | 임의 경로 → SAR_COM_ERROR(P) | - middleware에서 JWT 파싱 → 역할 검사<br>- 권한 부족 시 403 페이지 + 홈 버튼<br>- 원래 시도한 경로는 `redirect_to`로 보존 | - 토큰 파싱 실패: 로그인으로 리다이렉트 |
| SC-COM-003 | 글로벌 에러 처리 | Any | 예기치 않은 런타임 에러로부터 사용자 복구 | - 에러 발생 | UC-COM06 | 임의 화면 → SAR_COM_ERROR(P) | - `error.tsx` 바운더리가 컴포넌트 트리 에러 캐치<br>- Sentry에 에러 전송 (request_id 포함)<br>- 재시도 / 홈으로 2개 버튼 | - 에러 바운더리 내부 실패: `global-error.tsx`로 에스컬레이션 |

---

## 12. 시나리오 ↔ UC ↔ Screen ID 매트릭스 (요약)

| SC ID | 주요 UC | 주요 Screen ID | 페이지 타입 |
|-------|--------|----------------|-------------|
| SC-USR-001 | UC-AUTH02, UC-AUTH03 | SAR_AUTH_REGISTER, SAR_AUTH_PENDING | P → P |
| SC-USR-002 | UC-AUTH01, UC-SRH01 | SAR_AUTH_LOGIN, SAR_SRH_MAIN | P → P |
| SC-USR-003 | UC-AUTH04, UC-AUTH05 | SAR_AUTH_EXPIRED, SAR_AUTH_LOGIN | L → P |
| SC-USR-004 | UC-SRH02, UC-SRH07, UC-SRH10 | SAR_SRH_MAIN, SAR_SRH_DRAW | P + L |
| SC-USR-005 | UC-SRH04 | SAR_SRH_MAIN, SAR_SRH_FILTER | P + L |
| SC-USR-006 | UC-SRH05, UC-PDS02~04 | SAR_SRH_UPLOAD | L |
| SC-USR-007 | UC-PDS06~07 | SAR_PDS_DTL → SAR_SRH_MAIN | L → P |
| SC-USR-008 | UC-SRH16 | SAR_SRH_SHARE | L |
| SC-USR-009 | UC-SRH13, UC-CRT01 | SAR_SRH_DTL, SAR_SRH_QL | L |
| SC-USR-010 | UC-CRT04, UC-DL03 | SAR_CRT_MAIN → SAR_DL_LIST | P → P |
| SC-USR-011 | UC-CRT05, UC-DL01 | SAR_CRT_APPROVAL | L |
| SC-USR-012 | UC-CRT06 | SAR_CRT_QUOTA | L |
| SC-USR-013 | UC-DL03 | SAR_DL_LIST, SAR_DL_DTL | P + L |
| SC-USR-014 | UC-DL07 | SAR_DL_RETRY | L |
| SC-USR-015 | UC-DL04, UC-DL06 | SAR_SRH_DTL | L |
| SC-USR-016 | UC-PDS02, UC-PDS05 | SAR_PDS_NEW, SAR_PDS_FORM | L |
| SC-USR-017 | UC-PDS06, UC-PDS07 | SAR_PDS_DTL | L |
| SC-USR-018 | UC-PDS09 | SAR_PDS_DEL | L |
| SC-USR-019 | UC-NOTI02 | SAR_NOTI_TOAST | L |
| SC-USR-020 | UC-NOTI03 | (background) | — |
| SC-USR-021 | UC-NOTI04~06 | SAR_NOTI_CENTER | P |
| SC-ADM-001 | UC-USR02, UC-USR03 | SAR_USR_APPROVE | L |
| SC-ADM-002 | UC-USR04 | SAR_USR_ROLE | L |
| SC-ADM-003 | UC-USR05 | SAR_USR_DEACT | L |
| SC-ADM-004 | UC-APR02, UC-APR03 | SAR_APR_DTL, SAR_APR_APPROVE | L |
| SC-ADM-005 | UC-APR04, UC-APR05 | SAR_APR_REJECT | L |
| SC-ADM-006 | UC-AOI02 | SAR_AOI_NEW | L |
| SC-ADM-007 | UC-AOI03 | SAR_AOI_NEW | L |
| SC-ADM-008 | UC-AOI07 | SAR_AOI_RUN | L |
| SC-ADM-009 | UC-AOI06 | SAR_AOI_ACTIVE | L |
| SC-ADM-010 | UC-PDA02 | SAR_PDA_PUB | L |
| SC-ADM-011 | UC-PDA03 | SAR_PDA_DEL | L |
| SC-ADM-012 | UC-SYS01~05 | SAR_SYS_MAIN | P |
| SC-ADM-013 | UC-SYNC03 | SAR_SYNC_RETRY | L |
| SC-ADM-014 | UC-AUD01~03 | SAR_AUD_LIST, SAR_AUD_EXPORT | P + L |
| SC-ADM-015 | UC-SYS04 + UC-AUD01 | SAR_SYS_ERR → SAR_AUD_LIST | L → P |
| SC-COM-001 | UC-COM04 | 전체 | — |
| SC-COM-002 | UC-COM05 | SAR_COM_ERROR | P |
| SC-COM-003 | UC-COM06 | SAR_COM_ERROR | P |

---

## 13. 참고 문서

- [15. 프론트엔드 아키텍처](./15-frontend-architecture.md)
- [16. 프론트엔드 유즈케이스](./16-frontend-usecases.md)
- [17. 프론트엔드 IA](./17-frontend-ia.md)
- [18. InSAR 산출물 대비 설계](./18-insar-products.md) — 후속 도입 시 시나리오 확장 예정
- [05. API 명세](./05-api-spec.md)
- [13. 에러 코드 레지스트리](./13-error-codes.md)
