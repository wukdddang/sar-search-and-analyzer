# 17. 프론트엔드 IA (Information Architecture)

> **Version:** 1.0 | **최종 수정일:** 2026-04-24
>
> | 버전 | 날짜 | 변경 내용 |
> | --- | --- | --- |
> | 1.0 | 2026-04-24 | 초안 작성 (Lumir-ERP `cms/IA.md` 패턴 적용) |

---

## 범례

| 항목 | 설명 |
| --- | --- |
| **Type** | `Page` = URL이 변경되는 화면 / `Layer` = URL이 변경되지 않는 화면 (모달·팝업·Alert·Drawer 등) |
| **ID** | Screen ID. `SAR_{영역}_{도메인}_{CRUD코드}` 형식 |
| **CRUD 코드** | `_LIST` 목록 · `_DTL` 상세 · `_NEW` 생성 · `_EDIT` 수정 · `_DEL` 삭제 · `_FORM` 생성/수정 공용 · `_MANAGE` 관리 · `_ORDER` 순서 변경 · `_PUB` 공개 전환 · `_APPROVE` 승인 |

**경로 prefix 규칙**: 모든 경로는 `{plan|current}` 접두사 뒤에 붙는다. 예:
- `/plan/sar/user/search` (Mock)
- `/current/sar/user/search` (실 API)

IA 표에서는 경로 예시를 `current` 기준으로 표기한다.

---

## 1. User — 검색 (SAR_SRH)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 검색 | SRH | 메인 | MAIN | Page | SAR_SRH_MAIN | `/sar/user/search` | 지도 + 필터 + 결과 3분할 메인 검색 화면 | - 로그인 사용자 접근 가능 (viewer 이상)<br>- 좌측 필터 패널(300px, 접기 가능)<br>- 중앙 지도(OpenLayers, OSM 배경), 우측 장바구니(280px, 접기 가능)<br>- 하단 결과 리스트(높이 가변, 드래그 리사이즈)<br>- 지도↔리스트 hover 연동 (동일 sceneId 하이라이트)<br>- 필터·AOI·cursor 변경 시 URL 쿼리 동기화 |
| | | | | 필터 패널 | FILTER | Layer | SAR_SRH_FILTER | — | 좌측 필터 폼 섹션 | - 날짜 range(DatePicker 또는 슬라이더)<br>- 미션 다중 선택(체크박스)<br>- 제품 타입 다중 선택<br>- 지역 선택 드릴다운(level 1→2→3)<br>- `force_refresh` 토글<br>- [검색] 버튼 — 필수값 미입력 시 비활성화<br>- 필터 변경 500ms 디바운스 후 자동 검색 |
| | | | | AOI 그리기 툴바 | DRAW | Layer | SAR_SRH_DRAW | — | 지도 우상단 툴바 | - 도구: bbox / polygon / 지역선택 / **주소검색** / 전체화면<br>- 활성 도구 하이라이트<br>- bbox·polygon 그리기 중 ESC로 취소 가능<br>- 완료 시 AOI 자동 적용 + 자동 검색 트리거<br>- SHP 업로드는 보조 메뉴로 분리 — §[20](./20-vworld-integration.md) |
| | | | | **주소 검색 (VWorld)** | ADDR | Layer | SAR_SRH_ADDR | — | 주소→필지 폴리곤 모달 | - 입력창에 지번/도로명 주소 (예: "동천동 484-20")<br>- `GET /api/v1/geo/search` 로 후보 5건 표시<br>- 후보 선택 → `GET /api/v1/geo/parcel/{pnu}` 로 폴리곤 조회·지도 프리뷰<br>- [이 필지를 AOI로] → 검색 트리거<br>- [여러 필지 합치기] → 지도에서 추가 클릭 시 multi-polygon 합성<br>- VWorld 한도 초과 시 `429 VWORLD_QUOTA_EXHAUSTED` 안내 |
| | | | | ~~SHP 업로드~~ _(DEPRECATED)_ | UPLOAD | Layer | SAR_SRH_UPLOAD | — | SHP zip/파일 드래그앤드롭 모달 | - 기본 AOI 획득은 `SAR_SRH_ADDR` 사용<br>- 비지적 SHP(기상청/행안부 특수 경계 등)용 보조 경로로만 유지<br>- §[20. VWorld API 통합](./20-vworld-integration.md) 참조 |
| | | | | 결과 리스트 | LIST | Layer | SAR_SRH_LIST | — | 하단 결과 테이블 | - 컬럼: 선택(체크박스) · product_id · mission · sensing_start · 크기 · footprint 뱃지 · NAS상태 뱃지<br>- NAS 보유: 초록 뱃지, 다운로드 필요: 노란 뱃지<br>- 행 hover → 지도 footprint 하이라이트<br>- 행 클릭 → SAR_SRH_DTL 우측 패널 슬라이드<br>- cursor 기반 무한 스크롤<br>- 선택된 행 → bg-blue-50 |
| | | | | Scene 상세 | DTL | Layer | SAR_SRH_DTL | — | 우측 슬라이드 상세 패널 | - quicklook PNG 썸네일 (클릭 시 확대 모달)<br>- 메타데이터: product_id, mission, product_type, sensing 구간, file_size, footprint 좌표<br>- 액션: [장바구니 담기] / [즉시 다운로드 요청] (downloader+) / [NAS 경로 복사] (NAS 보유 시) / [바로 받기] (NAS 보유 시)<br>- 지도에서 해당 footprint 빨간 테두리 하이라이트<br>- 패널 [X] 닫기 → 리스트 선택 해제 |
| | | | | quicklook 확대 | QL | Layer | SAR_SRH_QL | — | PNG 확대 모달 | - 썸네일 클릭 시 전체 화면 오버레이<br>- ESC · 배경 클릭 닫기<br>- 다운로드 버튼 |
| | | | | URL 공유 | SHARE | Layer | SAR_SRH_SHARE | — | 현재 검색 상태 URL 복사 | - 필터·bbox·cursor를 URL 쿼리로 직렬화<br>- [복사] 클릭 시 클립보드 복사 + 토스트<br>- URL에 토큰 정보 포함 금지 |
| | | | | 시계열 뷰 | TS | Page | SAR_SRH_TS | `/sar/user/search/timeline` | AOI별 과거 촬영 타임라인 | - 가로축: 시간(월/주), 세로축: 미션<br>- 각 점 클릭 시 해당 scene 상세 |
| | | | | Scene 비교 | CMP | Layer | SAR_SRH_CMP | — | 두 scene quicklook 좌우 스와이프 | - 리스트에서 2개 선택 후 [비교] 버튼<br>- 스와이프 바로 좌/우 영상 비율 조절 |

---

## 2. User — 장바구니 (SAR_CRT)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 장바구니 | CRT | 메인 | MAIN | Page | SAR_CRT_MAIN | `/sar/user/cart` | 선택 scene 목록 + 일괄 다운로드 | - 로컬 스토리지에 영속화<br>- 컬럼: 제거(x) · product_id · mission · 크기 · NAS상태<br>- 상단 요약: 총 개수 · 예상 총 용량 · NAS 보유 개수<br>- [일괄 다운로드] 버튼 — downloader 이상만 활성화<br>- 빈 상태: "검색 화면에서 scene을 담아보세요" + [검색으로] 버튼 |
| | | | | 승인 대기 안내 | APPROVAL | Layer | SAR_CRT_APPROVAL | — | 100개 초과 안내 모달 | - 요청 후 응답에 PENDING_APPROVAL 포함 시 표시<br>- "관리자 승인 후 다운로드가 시작됩니다" 문구 + 승인 대기 잡 수<br>- [내 다운로드 보기] → SAR_DL_MAIN 이동 |
| | | | | 쿼터 초과 | QUOTA | Layer | SAR_CRT_QUOTA | — | 쿼터 초과 모달 | - QUOTA_EXCEEDED 응답 시 표시<br>- 사용량 vs 한도 Progress bar<br>- 재시도 시점 안내 (익일 00시 등) |
| | | | | 비우기 확인 | CLEAR | Layer | SAR_CRT_CLEAR | — | 장바구니 전체 제거 확인 | - "모두 제거하시겠습니까?" 확인 모달<br>- [제거] → 로컬스토리지 초기화 |

---

## 3. User — 다운로드 (SAR_DL)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 다운로드 | DL | 목록 | LIST | Page | SAR_DL_LIST | `/sar/user/downloads` | 내 다운로드 잡 목록 | - 필터: 상태(전체/QUEUED/RUNNING/DONE/FAILED/PENDING_APPROVAL) · 날짜 range<br>- 컬럼: product_id · 상태 뱃지 · progress bar · 생성/완료 시각 · 크기<br>- 상태별 색상: QUEUED=회색, RUNNING=파랑, DONE=초록, FAILED=빨강, PENDING=노랑<br>- 페이지네이션: cursor 기반, 기본 50건<br>- WebSocket으로 상태 실시간 갱신 |
| | | | | 상세 | DTL | Layer | SAR_DL_DTL | — | 우측 상세 패널 | - 타임라인: created → started → completed<br>- 에러 메시지(FAILED 시)<br>- NAS 경로 (DONE 시) + [복사] 버튼<br>- [파일 다운로드] 버튼 (DONE 시)<br>- [재시도] 버튼 (FAILED 시) |
| | | | | 재시도 확인 | RETRY | Layer | SAR_DL_RETRY | — | 재시도 확인 모달 | - "실패한 다운로드를 재시도하시겠습니까?" 확인<br>- 확인 시 새 잡 생성 → 목록 갱신 |
| | | | | 쿼터 위젯 | QUOTA | Layer | SAR_DL_QUOTA | — | 상단 쿼터 사용량 | - 오늘 사용량/한도 ProgressBar<br>- 툴팁: 일일 리셋 시각 안내<br>- 80% 초과 시 주황, 100% 도달 시 빨강 |

---

## 4. User — 공공데이터 (SAR_PDS)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 공공데이터 | PDS | 목록 | LIST | Page | SAR_PDS_LIST | `/sar/user/public-datasets` | 공공데이터셋 목록 | - 탭: 전체(공개) / 내 업로드<br>- 컬럼: 이름 · 업로더 · 공개여부 · 피처 수 · 업로드일<br>- 행 클릭 → 상세 모달<br>- [+ 새 업로드] 버튼 (downloader+) |
| | | | | 상세 | DTL | Layer | SAR_PDS_DTL | — | 데이터셋 상세 모달 | - 지도 미리보기 (폴리곤 오버레이, 자동 fit)<br>- 속성 테이블 상위 10행<br>- 메타: 이름·설명·업로더·공개여부·EPSG·피처 수·업로드일<br>- 액션: [이 영역으로 검색] / [원본 zip 재다운](본인만) / [삭제](본인만) |
| | | | | 업로드 | NEW | Layer | SAR_PDS_NEW | — | SHP zip 업로드 모달 | - 드래그앤드롭 영역<br>- `.zip` 단일 파일, 최대 50MB<br>- `shpjs` 로컬 파싱 → 지도 미리보기<br>- 속성 테이블 프리뷰<br>- 좌표계 자동 감지, 미지원 시 에러 |
| | | | | 저장 폼 | FORM | Layer | SAR_PDS_FORM | — | 이름·설명 입력 후 서버 업로드 | - 업로드 프리뷰 후 표시<br>- 필수: 이름(최대 200자)<br>- 선택: 설명(2행 textarea)<br>- [저장] → multipart 업로드 → 목록 갱신<br>- 업로드 중 진행률 표시 |
| | | | | 삭제 확인 | DEL | Layer | SAR_PDS_DEL | — | 데이터셋 삭제 확인 | - "삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."<br>- 본인 소유만 삭제 가능<br>- [삭제] → 목록 갱신 |

---

## 5. User — 알림 (SAR_NOTI)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 알림 | NOTI | 센터 | CENTER | Page | SAR_NOTI_CENTER | `/sar/user/notifications` | 알림 히스토리 목록 | - 필터: 전체/안읽음/읽음 · 타입<br>- 행: 아이콘 · 메시지 · 관련 리소스 링크 · 시각<br>- 안읽음 → bg-blue-50 + bold<br>- 행 클릭 → 관련 리소스 이동 + 읽음 처리<br>- 일괄 [모두 읽음] 버튼 |
| | | | | 실시간 토스트 | TOAST | Layer | SAR_NOTI_TOAST | — | WebSocket 이벤트 토스트 | - 화면 우하단 스택<br>- 타입별 아이콘·색상<br>- 5초 후 자동 사라짐, hover 시 정지<br>- [자세히] 클릭 → 해당 리소스 이동 |
| | | | | 헤더 드롭다운 | DROPDOWN | Layer | SAR_NOTI_DROPDOWN | — | 헤더 종 아이콘 클릭 시 | - 최근 10건 표시<br>- 안읽음 카운트 뱃지<br>- [모두 보기] → SAR_NOTI_CENTER |

---

## 6. Admin — 사용자 관리 (SAR_USR)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 사용자 관리 | USR | 목록 | LIST | Page | SAR_USR_LIST | `/sar/admin/users` | 전체 사용자 목록 | - 필터: 역할 · 활성 여부 · 승인 대기<br>- 컬럼: 이메일 · 이름 · 역할 뱃지 · 활성 토글 · 가입일 · 최근 로그인<br>- [승인 대기만 보기] 퀵 필터<br>- 페이지네이션 offset 기반 |
| | | | | 상세 | DTL | Layer | SAR_USR_DTL | — | 사용자 상세 모달 | - 프로필 정보<br>- 최근 로그인 IP · UA<br>- 쿼터 사용 현황<br>- 최근 다운로드 잡 수<br>- [역할 변경] / [비활성화] 버튼 |
| | | | | 승인 | APPROVE | Layer | SAR_USR_APPROVE | — | 가입 승인 모달 | - 역할 선택(viewer/downloader)<br>- [승인] → is_active=true + 역할 설정 + 알림 전송<br>- [거절] 사유 입력 후 거절(계정 삭제 또는 유지 정책 선택) |
| | | | | 역할 변경 | ROLE | Layer | SAR_USR_ROLE | — | 역할 변경 모달 | - 현재 역할 → 신규 역할 선택<br>- 확인 문구 + [저장] |
| | | | | 비활성화 | DEACT | Layer | SAR_USR_DEACT | — | 비활성화 확인 모달 | - "이 사용자를 비활성화하시겠습니까? 기존 세션이 무효화됩니다."<br>- [비활성화] → is_active=false + refresh 토큰 전체 revoke |

---

## 7. Admin — 다운로드 승인 (SAR_APR)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 승인 큐 | APR | 목록 | LIST | Page | SAR_APR_LIST | `/sar/admin/approvals` | 승인 대기 요청 카드 리스트 | - 카드: 요청자 · scene 개수 · 총 용량 · 요청 시각 · AOI 미니맵<br>- 오래된 순 정렬 기본<br>- 다중 선택 체크박스<br>- [일괄 승인] / [일괄 거절] |
| | | | | 상세 | DTL | Layer | SAR_APR_DTL | — | 요청 상세 모달 | - 요청자 프로필<br>- scene 리스트(product_id·크기·mission)<br>- AOI 지도 오버레이<br>- NAS 가용 용량 vs 요청 용량 비교<br>- [승인] / [거절] 버튼 |
| | | | | 승인 | APPROVE | Layer | SAR_APR_APPROVE | — | 단건 승인 확인 모달 | - "이 요청을 승인하시겠습니까?"<br>- [승인] → 상태 QUEUED로 전환 + 요청자에게 알림 |
| | | | | 거절 | REJECT | Layer | SAR_APR_REJECT | — | 거절 사유 입력 모달 | - 사유 textarea(필수)<br>- 템플릿 선택(용량 부족 등)<br>- [거절] → 상태 REJECTED + 요청자에게 사유 알림 |

---

## 8. Admin — 크롤 대상 AOI (SAR_AOI)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 크롤 AOI | AOI | 목록 | LIST | Page | SAR_AOI_LIST | `/sar/admin/crawl-targets` | AOI 관리 지도 + 리스트 | - 좌측: AOI 리스트(이름·미션·주기·활성·최근 크롤)<br>- 중앙: 지도 전체 AOI 오버레이, 선택 시 해당 AOI fit<br>- [+ 새 AOI] 버튼 |
| | | | | 생성 | NEW | Layer | SAR_AOI_NEW | — | AOI 생성 모달 | - 이름(필수) · 설명<br>- geom 지정: 지도 그리기 / SHP 업로드 / 공공데이터셋 선택 / 행정구역 선택<br>- 미션 다중 선택<br>- 크롤 주기(시간 단위, 기본 4h)<br>- 활성 토글<br>- [저장] → 목록 갱신 |
| | | | | 수정 | EDIT | Layer | SAR_AOI_EDIT | — | AOI 수정 모달 | - 기존 값 프리필<br>- geom 변경 시 경고 (기존 크롤 이력과 연결 관계 유지)<br>- [저장] → 목록 갱신 |
| | | | | 삭제 | DEL | Layer | SAR_AOI_DEL | — | 삭제 확인 모달 | - "이 AOI를 삭제하시겠습니까? 크롤 이력은 유지됩니다."<br>- [삭제] → 목록 갱신 |
| | | | | 활성 토글 | ACTIVE | Layer | SAR_AOI_ACTIVE | — | 활성/비활성 확인 모달 | - 비활성화 시 "크롤이 중단됩니다" 안내<br>- 즉시 반영 |
| | | | | 즉시 크롤 | RUN | Layer | SAR_AOI_RUN | — | 수동 크롤 실행 확인 | - "지금 1회 크롤을 실행하시겠습니까?"<br>- [실행] → 백엔드 수동 트리거 API 호출 |
| | | | | 크롤 이력 | HISTORY | Layer | SAR_AOI_HISTORY | — | 해당 AOI 크롤 이력 | - 시간 역순 목록: 시각 · 신규 scene 수 · 에러 여부<br>- 상세: 크롤 로그 |

---

## 9. Admin — 공공데이터 관리 (SAR_PDA)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 공공데이터 관리 | PDA | 목록 | LIST | Page | SAR_PDA_LIST | `/sar/admin/public-datasets` | 전체 데이터셋 관리 | - User PDS와 동일 컬럼 + 소유자·파일 크기<br>- 필터: 공개여부 · 업로더 · 업로드 일자<br>- 검색: 이름<br>- 행 클릭 → 상세 |
| | | | | 상세 | DTL | Layer | SAR_PDA_DTL | — | 관리자 상세 모달 | - User PDS 상세와 동일 + 관리자 액션<br>- 액션: [공개 토글] / [강제 삭제] / [원본 zip 재다운] |
| | | | | 공개 토글 | PUB | Layer | SAR_PDA_PUB | — | 공개/비공개 전환 확인 | - 공개: "모든 사용자가 이 데이터셋을 AOI로 사용할 수 있게 됩니다."<br>- 비공개: "소유자만 사용할 수 있게 됩니다."<br>- 확인 후 즉시 반영 |
| | | | | 강제 삭제 | DEL | Layer | SAR_PDA_DEL | — | 강제 삭제 확인 | - 소유자 관계없이 삭제<br>- 경고 문구 + 이중 확인 |

---

## 10. Admin — 시스템 대시보드 (SAR_SYS)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 대시보드 | SYS | 메인 | MAIN | Page | SAR_SYS_MAIN | `/sar/admin/dashboard` | 시스템 전반 대시보드 | - 상단 KPI 카드: 큐 적체 · 오늘 처리량 · NAS 사용률 · 실패율<br>- 차트: 최근 24h 처리 scene 라인, 최근 7일 실패 stacked bar<br>- 실시간 이벤트 타일(WebSocket)<br>- 30초 폴링으로 KPI 갱신 |
| | | | | 큐 상세 | QUEUE | Layer | SAR_SYS_QUEUE | — | pgmq 적체 상세 모달 | - 대기 잡 수 · 평균 대기 시간 · 가장 오래된 잡<br>- 워커별 처리량 표 |
| | | | | NAS 상세 | NAS | Layer | SAR_SYS_NAS | — | NAS 사용량 상세 | - 총 용량 / 사용량 / 가용<br>- mission별 점유율<br>- 오래된 scene cleanup 안내(>90d) |
| | | | | 에러 요약 | ERR | Layer | SAR_SYS_ERR | — | 최근 에러 요약 | - `code`별 24h 발생 건수 표<br>- 행 클릭 → 감사 로그로 이동(필터 적용) |

---

## 11. Admin — Sync 모니터 (SAR_SYNC)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | Sync 모니터 | SYNC | 메인 | MAIN | Page | SAR_SYNC_MAIN | `/sar/admin/sync-monitor` | 메타데이터 sync 상태 | - 지도: AOI별 마지막 sync 시각 색상 표현(녹색<6h, 노랑<24h, 빨강>24h)<br>- 리스트: AOI · 마지막 sync · 커버리지 · 상태<br>- 24h 이상 미동기 AOI 경고 뱃지 |
| | | | | 이력 | LOG | Layer | SAR_SYNC_LOG | — | Sync 이력 모달 | - AOI별 sync 이력 페이지네이션<br>- 컬럼: 시각 · 신규/갱신 scene 수 · 에러 메시지 · 소요 시간 |
| | | | | 재시도 | RETRY | Layer | SAR_SYNC_RETRY | — | 실패 Sync 재시도 확인 | - "실패한 sync를 재시도하시겠습니까?"<br>- [재시도] → 수동 트리거 |

---

## 12. Admin — 감사 로그 (SAR_AUD)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 감사 로그 | AUD | 목록 | LIST | Page | SAR_AUD_LIST | `/sar/admin/audit-logs` | 감사 로그 조회 | - 필터: user_id · action · code · 기간<br>- 컬럼: 시각 · user · action · code · IP · 요약<br>- cursor 기반 무한 스크롤<br>- 행 클릭 → 상세 |
| | | | | 상세 | DTL | Layer | SAR_AUD_DTL | — | 로그 상세 모달 | - 전체 payload JSON (pretty)<br>- UA · IP · request_id<br>- 관련 리소스 링크 |
| | | | | CSV 내보내기 | EXPORT | Layer | SAR_AUD_EXPORT | — | CSV 다운로드 확인 | - 현재 필터 기준 최대 10만건<br>- 10만 초과 시 분할 안내<br>- [다운로드] → 서버 스트림 CSV |

---

## 13. 인증 (SAR_AUTH)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 인증 | AUTH | 로그인 | LOGIN | Page | SAR_AUTH_LOGIN | `/login` | 로그인 화면 | - 이메일·비밀번호 입력<br>- [로그인] → 토큰 저장 + 홈 리다이렉트<br>- [회원가입] 링크<br>- 실패 메시지는 모호하게 ("이메일 또는 비밀번호가 올바르지 않습니다") |
| | | | | 회원가입 | REGISTER | Page | SAR_AUTH_REGISTER | `/register` | 회원가입 화면 | - 이메일·비밀번호·이름<br>- 비밀번호 정책 실시간 검증(10자+혼합)<br>- 가입 후 "승인 대기" 안내 화면 |
| | | | | 승인 대기 | PENDING | Page | SAR_AUTH_PENDING | `/pending` | 승인 대기 안내 | - 가입 직후 또는 승인 전 로그인 시도 시 표시<br>- "관리자 승인 후 이용 가능합니다"<br>- [로그인으로] 버튼 |
| | | | | IP 차단 | IP | Page | SAR_AUTH_IP | `/blocked` | IP 허용 목록 외부 접근 안내 | - 사내 IP 접속 안내 문구 + 연락처<br>- 재시도 버튼 |
| | | | | 세션 만료 | EXPIRED | Layer | SAR_AUTH_EXPIRED | — | 세션 만료 모달 | - refresh 실패 시 표시<br>- "다시 로그인이 필요합니다" → 로그인 이동 |

---

## 14. 공통 (SAR_COM)

| 1 Depth | Code | 2 Depth | Code | 3 Depth | Code | Type | ID | 경로 | 설명 | 정책 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SAR | SAR | 공통 | COM | 확인 모달 | CONFIRM | Layer | SAR_COM_CONFIRM | — | 표준 확인 모달 | - 반투명 배경(50% 검정)<br>- ESC·배경 클릭 닫기(로딩 중 제외)<br>- 스프링 애니메이션 (Lumir-ERP와 동일 사양) |
| | | | | 토스트 | TOAST | Layer | SAR_COM_TOAST | — | 알림 토스트 | - variant: default / success / destructive<br>- 자동 사라짐 4s, hover 시 정지 |
| | | | | 로딩 오버레이 | LOADING | Layer | SAR_COM_LOADING | — | 페이지 전환 오버레이 | - RingSpinner + 안내 문구<br>- popstate 디바운스 400ms |
| | | | | 모드 배지 | MODE | Layer | SAR_COM_MODE | — | Plan/Current 시각 표시 | - 헤더 우측 배지<br>- Plan=노랑, Current=파랑 |
| | | | | 에러 바운더리 | ERROR | Page | SAR_COM_ERROR | `/error` | 예기치 않은 에러 화면 | - `error.tsx` 렌더<br>- [재시도] · [홈으로] 버튼<br>- Sentry 전송 |
| | | | | 404 | NF | Page | SAR_COM_NF | `/not-found` | Not Found | - "찾는 페이지가 없습니다"<br>- [홈으로] 버튼 |

---

## 15. Screen ID 색인 (요약)

### User 영역 (11개 Page + 다수 Layer)

- Search: `SAR_SRH_MAIN`, `SAR_SRH_TS`
- Cart: `SAR_CRT_MAIN`
- Downloads: `SAR_DL_LIST`
- Public Datasets: `SAR_PDS_LIST`
- Notifications: `SAR_NOTI_CENTER`

### Admin 영역 (8개 Page + 다수 Layer)

- Users: `SAR_USR_LIST`
- Approvals: `SAR_APR_LIST`
- Crawl AOI: `SAR_AOI_LIST`
- Public Datasets Admin: `SAR_PDA_LIST`
- Dashboard: `SAR_SYS_MAIN`
- Sync Monitor: `SAR_SYNC_MAIN`
- Audit Logs: `SAR_AUD_LIST`

### 인증 (4개 Page)

- `SAR_AUTH_LOGIN`, `SAR_AUTH_REGISTER`, `SAR_AUTH_PENDING`, `SAR_AUTH_IP`

---

## 16. 다음 단계

- **시나리오 문서(`18-frontend-scenarios.md`)** — UC를 연결한 End-to-End 시나리오 (SC-USR-xxx, SC-ADM-xxx)
- **컴포넌트 라이브러리 문서(`19-frontend-components.md`)** — 공통 UI 프리미티브 spec
- **Storybook 셋업** — 개별 `.section`/`.modal`/`.component` 단위 visual test

---

## 17. 참고 문서

- [15. 프론트엔드 아키텍처](./15-frontend-architecture.md)
- [16. 프론트엔드 유즈케이스](./16-frontend-usecases.md)
- [05. API 명세](./05-api-spec.md)
- [06. 인증 및 권한](./06-auth.md)
- [13. 에러 코드 레지스트리](./13-error-codes.md)
