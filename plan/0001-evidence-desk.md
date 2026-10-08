# 0001 선거 증거 데스크 — 구현 플랜

- 상태: 승인됨 (2026-10-08)
- 의도: `intent/0001-evidence-desk.md`
- 명세: `spec/0001-evidence-desk.md`
- 구현 중 플랜과 달라지면 같은 커밋에서 이 문서를 고친다.

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 사전 렌더링 | Vite SSR 빌드 + 빌드 시 경로별 HTML 생성 | 명세 6장. 현재 `index.html`은 빈 `<div id="root">`다 |
| 상태 필드 | 유지. 기존 건은 미디어 있으면 `reported`, 없으면 `allegation` | 통계 모수, 원장 필터, 상세 첫 문장이 상태에 의존한다. `document`, `video_confirmed`는 관리자가 검증 네 줄을 채운 뒤 수동으로만 지정한다 |
| 데이터 갱신 | Vercel Deploy Hook으로 재빌드 | 사전 렌더링 HTML은 빌드 시점 스냅샷이다. 관리자 저장, 피드 수집, 제보 승인 시 호출한다 |
| 피드 수집 | 유튜브 채널 RSS. X 등은 2차 | RSS는 API 키가 필요 없다. X API는 유료이고 약관 문제가 있다 |
| 제보 접수 | 공개 폼 → 서버 함수 → 비공개 테이블 → 관리자 검수 후 공개 | 제보 원문에 제3자 개인정보가 섞일 수 있다 |
| 홈·통계 지도 | GeoJSON 기반 정적 SVG | SVG는 사전 렌더링된다. MapLibre는 원장 목록의 "지도 보기"에만 남긴다 |
| Analytics | Vercel Analytics 유지 | 명세가 금지한 것은 Google Analytics 선행 설치다. Vercel Analytics는 색인 수단이 아니다 |

## 바뀌는 파일
- 수정: `index.html`, `package.json`, `vercel.json`, `src/App.tsx`, `src/main.tsx`, `src/types/evidence.ts`, `src/lib/data.ts`, `src/pages/EvidenceDetailPage.tsx`, `src/pages/Admin.tsx`, `src/components/evidence/FilterBar.tsx`, `scripts/supabase_schema.sql`
- 신규:
  - 프론트: `src/entry-server.tsx`, `src/lib/seo.ts`, `src/lib/status.ts`, `src/components/map/SvgMap.tsx`, `src/pages/{Home,Ledger,FeedList,FeedSource,TipList,TipDetail,TipForm,StatsList,StatsDetail}.tsx`
  - 빌드: `scripts/prerender.ts`
  - 서버 함수: `api/tip.ts`, `api/rebuild.ts`
  - 데이터: `scripts/{migrate_to_ledger,collect_feeds,load_analysis}.py`
  - CI: `.github/workflows/collect-feeds.yml`
- 삭제: `src/pages/{NationMap,WideMap,BasicDetail,UnifiedMap}.tsx`, `src/components/map/RegionExplorer.tsx`, `src/components/evidence/StatsTab.tsx`

## 작업 순서

### 1단계: 데이터 타입과 상태 상수
1. `src/types/evidence.ts`를 확장한다.
   - 공통: `id`, `layer`, `updatedAt`
   - `Evidence`: `status`, `occurredAt`, `placeName`, `lat`, `lng`(nullable), `claim`, `election`, `type`, `sources[{title,url,archiveUrl?}]`, `verification{seen,where,when,notClaimed}`
   - `FeedItem`, `Tip`(공개 필드만), `Analysis`: 명세 4장 그대로
2. `src/lib/status.ts`에 상태 상수, 한국어 라벨, 범례 문구를 둔다. 페이지 범례는 이 상수만 읽는다.
3. `scripts/supabase_schema.sql`에 마이그레이션을 추가한다.
   - `evidence`에 `status`(check 제약), `claim`, `election`, `occurred_at`, `sources`, `verification` 컬럼
   - 새 테이블: `feed_sources`, `feed_items`, `tips`(공개 필드), `tip_contacts`(관리자 전용 RLS), `analyses`, `analysis_rows`
4. `scripts/migrate_to_ledger.py`를 만든다.
   - `title` → `claim`, `occurred_raw` → `occurred_at`(파싱 실패 시 null), `coordinates` → `lat/lng`, `source/source_url` → `sources[0]`, `election='2026 지방선거'`
   - `--apply` 없이는 변경 내역만 출력한다. `add_missing_evidence.py`의 패턴을 따른다.

#### 1단계 구현 결과 (플랜과 달라진 점)
| 항목 | 구현 | 이유 |
|---|---|---|
| 타입 이름 | 기존 행 타입을 `EvidenceRow`로 바꾸고, `Evidence`는 명세 4장 원장 레코드로 새로 정의했다. `toEvidence(row)`가 행을 원장 레코드로 바꾼다 | DB 행은 snake_case다. 한 타입에 두 표기를 섞으면 타입이 실제 데이터와 어긋난다. 기존 페이지는 3단계까지 `EvidenceRow`를 쓴다 |
| `lat`, `lng` | 새 컬럼을 만들지 않는다. `toEvidence`가 `coordinates`(`[lng, lat]`)에서 읽는다 | 좌표 원본을 한 곳에만 둔다 |
| `sources[].url` | `string \| null` | 카카오톡 제보처럼 링크가 없는 출처가 있다 |
| `occurred_at` | `text`. ISO 8601이고, 시각을 모르면 날짜만 쓴다. 연도가 없으면 null이다 | 날짜만 아는 건에 자정 시각을 붙이면 시각을 지어낸 셈이다. `occurred_raw`는 그대로 남긴다 |
| `status` 컬럼 | 기본값 없이 추가한다. `migrate_to_ledger.py --apply` 뒤에 `not null`과 기본값 `allegation`을 건다(스키마 파일 주석) | 기본값을 먼저 걸면 기존 행이 모두 `allegation`이 되어 자료 유무 매핑이 불가능하다 |
| 상태 미기재 행 | `toEvidence`가 `migrate_to_ledger.py`와 같은 규칙(`defaultEvidenceStatus`)으로 `reported`나 `allegation`을 채운다 | 정적 JSON 대체 경로와 마이그레이션 전 행도 상태를 가진다 |
| `Analysis` | 명세 필드에 `title`, `question`을 더했다 | 명세 3장(H1은 분석 제목)과 5장(질문 하나)이 요구한다 |
| `Tip.status` | 값은 `unverified` 하나다 | 명세가 정한 값이 하나뿐이다. 값을 더하려면 명세를 먼저 고친다 |
| 통계 제외 항목 | `excluded`는 `feed`, `unverified_tip`, `no_coordinates`, `allegation_only` 키 배열이다. 라벨은 `src/lib/status.ts`에 있다 | 범례가 상수만 읽게 한다 |
| 피드 발신처 | 스키마가 `olgung`, `jahyeok` 행을 넣는다. 채널 주소는 운영자가 채운다 | 명세 3장 초기값 |

### 2단계: 사전 렌더링 기반
1. `src/entry-client.tsx`(hydrateRoot)와 `src/entry-server.tsx`(StaticRouter + renderToString)를 만든다.
2. `scripts/prerender.ts`가 빌드 시 Supabase 공개 데이터를 읽고 `dist/<path>/index.html`을 쓴다.
3. `src/lib/seo.ts`가 경로별 `<title>`, 150자 안팎 `description`, `canonical`을 만든다.
4. `dist/sitemap.xml`(`lastmod`=`updated_at`, `/admin` 제외)과 `dist/robots.txt`를 만든다.
5. MapLibre 컴포넌트는 브라우저에서만 로드한다.
6. `package.json`의 `build`를 `tsc -b && vite build && vite build --ssr src/entry-server.tsx && node prerender`로 바꾼다.
7. `vercel.json`은 정적 파일을 먼저 서빙하고 `/admin`만 SPA로 보낸다.

### 3단계: 홈, 원장 목록, 상세 교체
1. `index.html`에서 `maximum-scale=1.0, user-scalable=no`를 지운다.
2. 공통 레이아웃: 상단 `DESK`와 원장·통계·피드·제보 내비게이션.
3. 홈 `/`: 명세 5장 홈 규칙. 지도는 `public/geo/provinces.geojson` SVG에 오늘 원장 좌표만 점으로 찍는다.
4. 원장 `/ledger`: 기존 `FilterBar`와 `applyFilters`(`src/lib/data.ts`)를 확장한다. 기존 `UnifiedMap` 지도는 "지도 보기" 토글로 옮긴다.
5. 상세 `/e/:id`: 명세 5장 원장 규칙. 빈 검증 줄은 "미기재"로 표시한다. `src/lib/media.ts`와 기존 영상·음성 플레이어를 재사용한다.
6. 쓰지 않는 페이지와 컴포넌트를 지운다.

### 4단계: 피드
1. `/feed`, `/feed/:source` 페이지를 만든다.
2. `scripts/collect_feeds.py`가 `feed_sources`를 읽고, `platform='youtube'`이면 채널 RSS를 읽어 새 항목만 upsert한 뒤 Deploy Hook을 호출한다.
3. GitHub Actions cron(30분 간격)으로 수집을 돌린다.
4. 관리자 화면에 "원장으로 승격" 버튼을 둔다. 승격은 새 원장 카드를 만들고 `evidenceId`를 연결한다.

### 5단계: 제보
1. `/tips`, `/tips/:id` 페이지를 만든다.
2. `/tips/new` 폼은 `api/tip.ts`로 보낸다. 서비스 키는 서버 함수만 가진다.
3. Cloudflare Turnstile과 IP당 요청 제한으로 스팸을 막는다.
4. 원문과 연락처는 `tip_contacts`에, 공개 행은 `published=false`로 `tips`에 저장한다.
5. 관리자가 공개용 `heard`, `notClaimed`를 직접 쓴 뒤 공개한다.

### 6단계: 통계
1. `/stats`, `/stats/:id` 페이지를 만든다. 지도는 `public/geo/municipalities.geojson` SVG다.
2. `scripts/load_analysis.py`가 공식 표 CSV를 `analyses`, `analysis_rows`에 적재한다. 데이터가 오기 전에는 목록이 비어 있다.

### 7단계: 관리자
1. `Admin.tsx`에 원장·피드·제보·통계 탭을 추가한다.
2. 저장 성공 시 `api/rebuild.ts`로 Deploy Hook을 호출한다.

### 8단계: 정리
1. 사이트 제목을 "선거 증거 데스크"로 바꾼다.
2. JSON-LD와 `llms.txt`를 정리용으로 추가한다.
3. 배포 후 운영자가 Search Console에 등록한다.

## 위험
| 위험 | 대응 |
|---|---|
| MapLibre가 SSR에서 `window`를 참조해 빌드가 깨진다 | 지도 컴포넌트를 클라이언트 전용으로 지연 로드한다 |
| 하이드레이션 불일치 (빌드 시점 데이터와 런타임 데이터가 다름) | 첫 렌더는 빌드 시점 데이터로 하고, 최신 데이터는 하이드레이션 뒤에 반영한다 |
| 관리자 수정이 재빌드 전까지 공개 HTML에 반영되지 않는다 | 저장 시 Deploy Hook. 재빌드 지연은 수 분 단위로 감수한다 |
| 공개 제보 폼이 스팸이나 개인정보 유입 경로가 된다 | Turnstile, 요청 제한, 비공개 테이블 분리, 관리자 검수 |
| 기존 레코드 매핑이 상태를 잘못 올린다 | 매핑은 `reported`, `allegation`만 쓴다. `--apply` 전 변경 내역을 출력해 확인한다 |
| 유튜브 RSS 형식이 바뀐다 | 수집 실패를 Actions 실패로 드러낸다. 조용히 넘어가지 않는다 |

## 검증
1. `npm run build`가 통과하고 `dist/`에 경로별 `index.html`이 생긴다.
2. `dist/e/<id>/index.html`에 H1, 첫 문단(날짜·장소·상태·출처), `canonical`이 있다. JS 없이도 보인다.
3. 홈 HTML에 네 층 입구가 있고 건수 숫자가 없다.
4. 통계 상세 HTML의 지도 범례에 모수와 제외 항목이 있다.
5. 제보 공개 HTML과 anon 조회 결과에 이름·연락처가 없다. anon 키로 `tip_contacts`를 조회하면 거부된다.
6. `sitemap.xml`에 상세·분석 주소가 있고 `/admin`이 없다. `robots.txt`에 사이트맵 주소가 있다.
7. 모바일 뷰포트에서 핀치 줌이 된다.
8. Playwright로 `npm run preview`를 띄워 각 경로를 열고, 페이지마다 H1이 하나인지 확인한다.

## 범위 밖
- 스토리지 버킷 MIME 제한(jpeg/png/webp)과 mp4 업로드 불일치.
- `scripts/compress_videos.py`의 Windows 전용 ffmpeg 경로.
