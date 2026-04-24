# 20. VWorld API 통합 — 주소/지번 기반 AOI 획득

**역할**: 한국 국토지리정보원(VWorld, 공간정보 오픈플랫폼)의 공식 오픈 API를 통해 **주소 → 지번(PNU) → 필지 폴리곤 GeoJSON** 을 실시간 질의하고, 이를 검색 AOI 또는 크롤 대상 폴리곤으로 사용한다.

> **정책 전환 (2026-04-24)**
>
> 기존에는 사용자가 직접 Shapefile(`.shp/.dbf/.prj/.cpg/.shx`)을 업로드해 속성 테이블까지 DB에 저장하는 흐름([15-frontend-architecture.md §6](./15-frontend-architecture.md#6-공공데이터shp-업로드-플로우))을 준비했으나,
> 필요 데이터(연속지적도 LT_C_LDREG)가 이미 VWorld 공개 API로 질의 가능하고, 대량 정적 Shapefile을 앱 DB에 적재할 유스케이스는 희박하다고 판단.
> **기본 경로: VWorld 질의형 조회**. SHP 업로드는 _비지적 데이터(기상청/행안부 특수 경계 등)_ 용 **보조 경로**로만 유지.

---

## 1. 왜 VWorld인가

| 항목 | SHP 업로드 (구) | **VWorld API (신)** |
|-----|----------------|-------------------|
| 데이터 출처 | 사용자가 다운로드한 연속지적도 | 국토부 공식 실시간 DB (동일 데이터셋) |
| 전달 경로 | 파일 업로드 → 서버 파싱 → DB 적재 | HTTPS GET (프론트 or BFF) |
| 최신성 | 파일 업로드 시점(월 갱신) | 거의 실시간 |
| 용량 | 지역당 수 MB~수십 MB | 필지당 수 KB JSON |
| 인증 | 앱 내부 권한 | **VWorld 인증키** 1개 (앱 공용) |
| 커버리지 | 대한민국 (지역별 파일 필요) | 대한민국 전역 |
| 주소 → 폴리곤 | SQL/공간 쿼리 필요 | 2-step API로 완결 |
| 좌표계 | 원본 EPSG:5186 등 | 요청 시 EPSG:4326 지정 가능 |
| 프론트 파싱 복잡도 | DBF 인코딩/SHP 바이너리 | **JSON만 파싱** |

**Naver 지도 API와 차이**: Naver Map은 지번 필지 경계를 "화면에 그릴 수" 있지만 **API로 폴리곤 좌표를 반환하지 않는다.** (Naver의 지적도는 내부적으로 VWorld 타일을 오버레이한 것이며 데이터 API로 공개되지 않음.) 공식 API는 VWorld가 유일.

---

## 2. 필요한 VWorld API

모든 엔드포인트는 `https://api.vworld.kr/` 아래에 위치하며 쿼리스트링 `key` 파라미터로 인증.

### 2.1 주소 검색 API (Address Search)

```
GET https://api.vworld.kr/req/address
  ?service=address
  &request=getcoord
  &type=parcel            # 지번 주소 (또는 'road' 도로명)
  &address=경기도 용인시 수지구 동천동 484-20
  &format=json
  &key={VWORLD_API_KEY}
```

**응답 핵심 필드**:
```json
{
    "response": {
        "status": "OK",
        "result": {
            "point": { "x": "127.081234", "y": "37.322000" },
            "structure": {
                "level0": "대한민국",
                "level1": "경기도",
                "level2": "용인시",
                "level3": "수지구",
                "level4L": "동천동",
                "detail": "484-20"
            },
            "refined": {
                "text": "경기도 용인시 수지구 동천동 484-20"
            }
        }
    }
}
```

- 이 단계는 **주소 → 점 좌표**만 반환. 폴리곤은 §2.2에서 획득.
- 검색 결과가 여러 개일 때는 `simple=true` + `size=20`으로 목록 반환.

### 2.2 필지 폴리곤 조회 WFS (LT_C_LDREG / 연속지적도)

```
GET https://api.vworld.kr/req/data
  ?service=data
  &request=GetFeature
  &data=LT_C_LDREG
  &geomFilter=POINT(127.081234 37.322000)     # §2.1의 좌표를 찍어 포함하는 필지
  &geometry=true
  &attribute=true
  &crs=EPSG:4326
  &format=json
  &size=1
  &key={VWORLD_API_KEY}
```

**응답 핵심 필드** (GeoJSON FeatureCollection 호환):
```json
{
    "response": {
        "status": "OK",
        "result": {
            "featureCollection": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "pnu": "4146510800104840020",
                            "jibun": "484-20",
                            "addr": "경기도 용인시 수지구 동천동",
                            "ag_geom": "POLYGON"
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[ [127.0801, 37.3215], ... ]]
                        }
                    }
                ]
            }
        }
    }
}
```

**대체 질의 방식**:
- **PNU 직접**: `attrFilter=pnu:=:4146510800104840020` — PNU를 이미 알고 있을 때
- **bbox**: `geomFilter=BOX(127.07,37.31,127.10,37.33)` — 영역 내 모든 필지
- **폴리곤**: `geomFilter=POLYGON((...))` — AOI 내 모든 필지

### 2.3 건물(선택) — LT_C_SPBD

연속지적도 대신 건물 윤곽이 필요할 때(예: 산업시설 모니터링) `data=LT_C_SPBD` 레이어 사용. 속성: `buld_se_cd`, `gro_flo_co`, `uld_flo_co` 등.

### 2.4 지오코딩 역방향(선택)

점 좌표 → 지번: `request=getAddress`. 지도 클릭 → 필지 추론에 사용.

---

## 3. 앱 통합 아키텍처

```
[브라우저]                             [백엔드 BFF]                [VWorld]
   │                                        │                        │
   │ 1. 주소 입력 ("동천동 484-20")            │                        │
   │ ─────────────▶ GET /api/v1/geo/search   │                        │
   │                │                        │                        │
   │                │ 2. 주소→좌표 프록시      │ ─── getcoord ────────▶ │
   │                │                        │ ◀────── JSON ───────── │
   │                │                        │                        │
   │                │ 3. 좌표→필지 프록시      │ ─── GetFeature ──────▶ │
   │                │                        │ ◀────── GeoJSON ────── │
   │                │                        │                        │
   │ ◀─── GeoJSON + PNU + 지번 메타 ─────────│                        │
   │                                        │                        │
   │ 4. 지도에 폴리곤 표시, [AOI로 사용] 버튼  │                        │
   │                                        │                        │
```

**BFF(프록시) 이유**:
- VWorld 인증키를 **서버에만 보관**(브라우저 노출 방지).
- 호출 빈도 제한(레이어별 1일 10,000회 정도) 및 요금 관리.
- 응답 캐싱 (`pnu` → `geometry`는 거의 불변 → 장기 캐시 가능).
- 여러 API 스텝을 한 번의 클라이언트 요청으로 합성.

---

## 4. 백엔드 API 스펙 (신규)

상세는 [docs/05-api-spec.md](./05-api-spec.md) §지번/필지 참조.

### `GET /api/v1/geo/search`

**권한**: 인증 (`viewer`+)

**Query**:
- `q`: 주소 문자열 (필수)
- `type`: `parcel`(기본) | `road`
- `limit`: 1~20 (기본 5)

**응답 200** (프론트에 바로 표시 가능한 합성 형태):
```json
{
    "query": "동천동 484-20",
    "candidates": [
        {
            "pnu": "4146510800104840020",
            "jibun": "484-20",
            "address": "경기도 용인시 수지구 동천동 484-20",
            "center": [127.0812, 37.322],
            "bbox": [127.0801, 37.3215, 127.0825, 37.3228]
        }
    ]
}
```

### `GET /api/v1/geo/parcel/{pnu}`

**권한**: 인증

**응답 200**:
```json
{
    "pnu": "4146510800104840020",
    "jibun": "484-20",
    "address": "경기도 용인시 수지구 동천동 484-20",
    "geometry": { "type": "Polygon", "coordinates": [[...]] },
    "bbox": [127.0801, 37.3215, 127.0825, 37.3228],
    "area_m2": 2345.6,
    "source": "VWorld:LT_C_LDREG",
    "fetched_at": "2026-04-24T12:30:00Z"
}
```

**캐시 정책**:
- 서버 응답 헤더 `Cache-Control: public, max-age=2592000` (30일)
- Redis/Postgres에 `pnu → geometry` 캐시 (`geo_parcels` 테이블, §5).
- 캐시 미스 시 VWorld 호출.

### `POST /api/v1/aois/from-parcel`

**권한**: `viewer`+

**Body**:
```json
{
    "pnu": "4146510800104840020",
    "name": "용인 동천동 484-20 (선택)"
}
```

**동작**: 해당 PNU 폴리곤을 가져와 사용자 AOI로 저장하고 `id`, `geometry`를 반환. 검색 페이지의 AOI 드로잉 결과와 동일한 형태.

### `POST /api/v1/aois/from-parcels` (Batch)

여러 PNU를 모아 multi-polygon 하나로 합치거나 개별 폴리곤 묶음으로 저장. 면·동 전체를 AOI로 쓸 때 사용.

---

## 5. DB 스키마 (신규 추가)

### `geo_parcels` — VWorld 응답 캐시

```sql
CREATE TABLE geo_parcels (
    pnu            char(19) PRIMARY KEY,
    jibun          text NOT NULL,
    address        text NOT NULL,
    geometry       geometry(Polygon, 4326) NOT NULL,
    area_m2        double precision,
    source         text NOT NULL DEFAULT 'VWorld:LT_C_LDREG',
    fetched_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz
);

CREATE INDEX ix_geo_parcels_geometry ON geo_parcels USING gist (geometry);
CREATE INDEX ix_geo_parcels_fetched  ON geo_parcels (fetched_at);
```

**정책**:
- `pnu` 는 19자리 고정(시군구 10 + 지목 1 + 본번 4 + 부번 4).
- 캐시 만료는 `fetched_at` 기준 30일 — 경계 변경은 드물지만 재적재로 갱신.
- bbox 질의로 폴리곤을 받았을 때도 필지 단위로 쪼개 저장.

### `user_aois` (기존 설계 유지)

AOI 저장 테이블은 [02-database-schema.md](./02-database-schema.md)에서 정의. `source` 컬럼에 `'vworld:parcel'` / `'draw'` / `'shp-upload'`(레거시) 값을 구분해 기록한다.

---

## 6. 프론트엔드 UX (목업 기준)

### 검색 페이지 — AOI 드로잉 툴바 개편

기존 5개 도구(bbox / polygon / 지역선택 / SHP업로드 / 전체화면)에서 **SHP 업로드 → "주소 검색"** 으로 변경.

```
┌──────────────────────────────────────────────────┐
│  [bbox] [polygon] [지역선택] [주소검색] [전체]   │
└──────────────────────────────────────────────────┘
```

### "주소 검색" 모달 플로우

1. 입력창에 "동천동 484-20" 등 지번 입력 (자동완성 후보는 VWorld 검색 API)
2. 후보 리스트 (5개) — 각 항목에 미니 위치 뱃지(시군구)
3. 선택 → **필지 폴리곤이 지도에 즉시 표시** (`/api/v1/geo/parcel/{pnu}` 호출)
4. [이 필지를 AOI로] 버튼 → 검색 AOI로 세팅하고 검색 트리거
5. [보조] 여러 필지 합치기 — 지도에서 추가 클릭하여 `AOI 합성 모드`

### 크롤 AOI 관리 (admin)

- 기존 "SHP 업로드" → **"주소/PNU로 AOI 추가"** 로 대체
- 주소 일괄 입력(CSV/한 줄씩) → 모두 조회해 multi-polygon AOI로 저장

자세한 화면 ID/유즈케이스는 [17-frontend-ia.md](./17-frontend-ia.md) · [16-frontend-usecases.md](./16-frontend-usecases.md) 의 개정 항목 참조.

---

## 7. 운영

### 7.1 인증키

- VWorld 회원가입 → "인증키 발급" 메뉴에서 발급 (무료, 도메인 등록 필요 없음 — 서버 호출).
- 환경변수: `VWORLD_API_KEY`
- 개발/스테이징/프로덕션 각 키를 분리(사용량 추적).

### 7.2 호출 한도와 대응

- 레이어당 1일 10,000회가 일반적(계정·레이어별 차이 있음).
- 캐시 적중률이 높도록 `geo_parcels` 테이블에 장기 보관.
- 한도 초과 시 `429 Too Many Requests` 또는 VWorld가 `status: "ERROR"` 반환 → 앱에서 에러 코드 `VWORLD_QUOTA_EXHAUSTED` ([13-error-codes.md](./13-error-codes.md) 등록 필요)로 변환.

### 7.3 장애

- VWorld 다운 시: 캐시 히트는 정상, 미스는 `503 Service Unavailable` + `code: "VWORLD_UPSTREAM_DOWN"`.
- 사용자에게는 "일시적 지적도 조회 지연" 안내하고 bbox/polygon 수동 드로잉 폴백 유도.

### 7.4 로깅

[14-logging-standard.md](./14-logging-standard.md) 필수 필드에 `vworld.layer`, `vworld.request_id`, `vworld.cache_hit` 추가.

---

## 8. 마이그레이션: SHP → VWorld

| 대상 | 처리 |
|-----|------|
| 프론트 `ShapefileUploadModal` | 유지 (비지적 SHP 보조 경로). 기본 AOI 획득 플로우에서는 숨김 처리. |
| `UC-SRH05 SHP 업로드로 AOI 지정` | **DEPRECATED** → `UC-SRH09 주소 검색으로 AOI 지정` 로 교체 |
| `UC-PDS0*` 공공데이터(SHP) 업로드 | DEPRECATED — 별도 필요 발생 시 재개 |
| `UC-AOI03 SHP로 AOI 생성` | DEPRECATED → `UC-AOI09 주소/PNU로 AOI 생성` |
| `POST /public-datasets` (SHP 업로드) | **보류**. 필요시 유지하되 1차 스프린트 범위에서 제외 |
| `SAR_SRH_UPLOAD` 화면 ID | **DEPRECATED** → `SAR_SRH_ADDR` (주소 검색 레이어)로 대체 |

**로드맵 영향**: [docs/08-roadmap.md](./08-roadmap.md) Phase에 `VWorld 프록시 BFF 구현` 태스크 추가 필요(추정: 백엔드 2~3일 + 프론트 2일 + 캐시 1일).

---

## 9. 보안/약관

- VWorld 이용약관: "국토지리정보원 Open API 이용약관" 동의 필수 (상업적 재배포 제한 조항 확인 — 본 앱의 사내 연구 용도에는 해당 없음).
- 키 노출 금지: **절대 프론트 번들에 포함하지 않는다.** `.env` → 백엔드에서만 사용.
- 응답 내 주소·PNU는 공개 데이터지만 사용자 AOI 조합 기록은 개인 연구 이력이므로 [06-auth.md](./06-auth.md) 권한 모델을 따른다.

---

## 10. 참고 링크

- VWorld 개발자센터: https://www.vworld.kr/dev/v4dv.do
- 주소검색 API: https://www.vworld.kr/dev/v4dv_geocoderguide2_s001.do
- 데이터 API (WFS): https://www.vworld.kr/dev/v4dv_data2_s001.do
- 연속지적도 레이어: `LT_C_LDREG` (상세 스펙은 개발자센터 "데이터 상품")
