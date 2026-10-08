# 선거 증거 데스크 전환 플랜

## Context
- 현재 레포는 "선거 증거 아카이브"다. 레포는 지도 한 화면(`/`)과 상세(`/e/:id`), 관리자(`/admin`)로 된 Vite + React SPA다.
- 기획안(빌드 핸드오프, 2026-10-08)은 같은 도메인 안에 네 층(원장, 피드, 제보, 통계)을 분리해 둔 "선거 증거 데스크"를 요구한다.
- 기획안의 핵심 요구는 두 가지다. 첫째, 층끼리 건수를 합치지 않는다. 둘째, 빌드 결과 HTML에 제목, 설명, H1, 첫 문단이 들어 있어야 한다(검색·생성형 인용 회수).
- 현재 SPA는 `index.html`에 빈 `<div id="root">`만 있다. 따라서 둘째 요구를 충족하려면 빌드 시 경로별 HTML을 만드는 사전 렌더링(prerender)이 필요하다.

## 사용자 답변 반영
| 질문 | 답변 | 플랜 반영 |
|---|---|---|
| 상태 필드 | 꼭 필요한지 의문 | 아래 "결정 필요 1"에 판단을 적음 |
| 피드 수집 | 유튜브/SNS 수집 | 유튜브는 채널 RSS로 자동 수집. X 등은 2차 |
| 제보 접수 | 공개 제보 폼 | 서버 함수 경유 + 비공개 테이블 분리 + 관리자 검수 |
| 통계 데이터 | 있음, 나중에 제공 | 구조와 CSV 적재 스크립트를 먼저 만듦 |

## 결정 필요 1: 상태(status) 필드
- 판단: 상태 필드는 유지하는 편이 맞다. 확신 정도는 중간 이상이다.
- 근거 1: 통계 분석의 모수 정의가 상태에 의존한다. 기획안 그림 9는 "document 상태 카드만 계산"이라고 쓴다. 상태가 없으면 통계의 포함·제외 기준을 쓸 수 없다.
- 근거 2: 기획안의 원장 필터 네 개 중 하나와 상세 첫 문장의 필수 요소가 상태다.
- 근거 3: 현재 코드의 "상태 없이 출처 노출로 신뢰 담보" 방침은 기획안의 "상태는 조사 분류이며 법적 결론이 아니다" 고정 문장과 충돌하지 않는다. 고정 문장이 상태 오독 위험을 막는다.
- 반대 근거: 상태를 매기는 작업은 운영 부담이다. 상태 라벨 자체가 "판정"처럼 읽힐 위험도 있다.
- 기본 매핑 제안(자동 상향 없음):
  - 미디어가 있는 기존 건 → `reported`
  - 미디어가 없는 기존 건 → `allegation`
  - `document`, `video_confirmed` → 관리자가 검증 네 줄을 채운 뒤 수동으로만 지정
- 상태를 빼기로 하면 바뀌는 점: 필터에서 상태 제거, 통계 모수를 "유형=문서"로 대체, 홈 고정 문장 삭제.

## 결정 필요 2: 데이터 갱신 방식
- 사실: 데이터는 Supabase에 있고 관리자가 수시로 고친다. 사전 렌더링 HTML은 빌드 시점의 스냅샷이다.
- 기획안은 갱신 방식을 다루지 않는다. 빠진 고려 사항이다.
- 제안: Vercel Deploy Hook을 둔다. 관리자 저장, 피드 수집, 제보 승인 시 Deploy Hook을 호출해 재빌드한다. 클라이언트는 하이드레이션 후 Supabase에서 최신 값을 다시 읽는다.

## 기획안과 다르게 판단한 부분
- 기획안은 "Google Analytics 선행 설치 금지"라고 쓴다. 현재 레포는 Vercel Analytics를 쓴다. Vercel Analytics는 색인 수단이 아니므로 유지한다.
- 기획안의 "피드 발신처 추가는 데이터만으로"를 `feed_sources` 테이블 행 추가로 구현한다. 코드 수정 없이 발신처를 늘릴 수 있다.

## 구현 단계 (기획안 8장 순서를 따름)

### 1단계: 데이터 타입과 상태 상수
- `src/types/evidence.ts`를 `src/types/desk.ts`로 확장한다.
  - 공통: `id`, `layer`, `updatedAt`
  - `Evidence`: `status`, `occurredAt`, `placeName`, `lat`, `lng`(nullable), `claim`, `election`, `type`, `sources[{title,url,archiveUrl?}]`, `verification{seen,where,when,notClaimed}`
  - `FeedItem`: `source`, `sentAt`, `text`, `url`, `evidenceId?`
  - `Tip`(공개 필드만): `status='unverified'`, `placeName`, `sentAt`, `heard`, `notClaimed`
  - `Analysis`: `period`, `universe`, `method`, `sourceTable`, `includedEvidenceIds`, `excluded`, `geo: 'choropleth'|'dots'`, `rows[{place,value,unit}]`
- `src/lib/status.ts`에 상태 상수와 한국어 라벨, 범례 문구를 둔다. 페이지 범례는 이 상수만 읽는다.
- `scripts/supabase_schema.sql`에 마이그레이션을 추가한다.
  - `evidence` 테이블에 `status`, `claim`, `election`, `occurred_at`, `sources`, `verification` 컬럼 추가. `status`에는 check 제약을 건다.
  - 새 테이블: `feed_sources`, `feed_items`, `tips`(공개 필드), `tip_contacts`(이름·연락처, 관리자 전용 RLS), `analyses`, `analysis_rows`
- `scripts/migrate_to_ledger.py`를 만든다. 이 스크립트는 기존 레코드를 원장 필드로 매핑한다.
  - `title` → `claim`, `occurred_raw` → `occurred_at`(파싱 실패 시 null), `coordinates` → `lat/lng`, `source/source_url` → `sources[0]`, `election='2026 지방선거'`
  - `--apply` 없이는 변경 내역만 출력한다(`add_missing_evidence.py` 패턴 재사용).

### 2단계: 사전 렌더링 기반
- Vite SSR 빌드를 추가한다: `src/entry-client.tsx`(hydrateRoot), `src/entry-server.tsx`(StaticRouter + renderToString).
- `scripts/prerender.ts`를 만든다. 이 스크립트는 빌드 시 Supabase에서 공개 데이터를 읽고 경로별 HTML을 `dist/<path>/index.html`로 쓴다.
- 경로마다 `<title>`, 150자 이내 `description`, `canonical`을 넣는다. `src/lib/seo.ts`에 경로별 메타 생성 함수를 둔다.
- `dist/sitemap.xml`과 `dist/robots.txt`를 생성한다. `lastmod`는 `updated_at`이다. `/admin`은 제외한다.
- MapLibre 컴포넌트는 브라우저에서만 로드한다(`React.lazy` + 마운트 후 렌더).
- `package.json`의 `build`를 `tsc -b && vite build && vite build --ssr src/entry-server.tsx && node prerender`로 바꾼다.
- `vercel.json` rewrite는 정적 파일이 먼저 서빙되도록 유지하되, `/admin`만 SPA로 보낸다.

### 3단계: 홈, 원장 목록, 상세 교체
- `index.html`에서 `maximum-scale=1.0, user-scalable=no`를 제거한다.
- 공통 레이아웃: 상단 `DESK` + Ledger·Stats·Feeds·Tips 내비게이션. 페이지당 H1은 하나다.
- 홈 `/` (`src/pages/Home.tsx`)
  - H1은 사이트 이름이다.
  - 상단 한 문장은 날짜와 지역, 고정 문구만 담는다. 건수는 넣지 않는다.
  - 왼쪽 지도는 `public/geo/provinces.geojson`으로 그린 정적 SVG다. SVG는 사전 렌더링이 가능하다. 오늘 원장 좌표만 점으로 찍는다.
  - 오른쪽은 오늘 원장 세 줄(시각, 장소, 상태, 한 줄, 출처)이다.
  - 아래 네 카드는 원장, 통계, 피드, 제보의 최신 한 건과 링크다. 숫자는 없다.
  - 모바일은 같은 순서를 세로로 쌓는다.
- 원장 목록 `/ledger` (`src/pages/Ledger.tsx`)
  - 행: 사진 칸, 시각, 장소, 상태, 한 줄, 출처.
  - 필터: 유형, 선거, 상태, 지역. 기존 `FilterBar`, `applyFilters`(`src/lib/data.ts`)를 확장해 재사용한다.
  - 상단 집계 숫자는 두지 않는다.
  - 기존 `UnifiedMap`의 MapLibre 지도는 원장 목록의 "지도 보기" 토글로 옮긴다. 이 지도는 클라이언트 전용이다.
- 상세 `/e/:id` (`EvidenceDetailPage.tsx` 개편)
  - H1은 한 줄 주장이다.
  - 첫 문단은 날짜, 장소, 상태, 출처를 한 문단에 담는다. 이 문단이 인용 단위다.
  - 왼쪽은 매체와 아카이브 시각, 오른쪽은 상태, 좌표, 선거, 유형이다.
  - 아래는 검증 네 줄과 출처 목록이다. 미입력 검증 줄은 "미기재"로 표시한다.
  - 기존 `media.ts`의 서명 URL, 영상·음성 플레이어는 재사용한다.
- 미사용 페이지 `NationMap`, `WideMap`, `BasicDetail`, `RegionExplorer`를 삭제한다.

### 4단계: 피드 경로와 수집
- `/feed`, `/feed/:source` 페이지를 만든다. 행: 발신 시각, 발신처, 원문 링크, 한 줄. `evidenceId`가 있을 때만 원장 링크를 단다.
- 홈에서는 피드를 발신처별로 나누지 않는다.
- `scripts/collect_feeds.py`를 만든다.
  - 이 스크립트는 `feed_sources` 행을 읽는다. 초기 행은 `olgung`, `jahyeok`이다.
  - `platform='youtube'`이면 채널 RSS(`youtube.com/feeds/videos.xml?channel_id=`)를 읽는다. API 키가 필요 없다.
  - 새 항목만 `feed_items`에 upsert하고 Deploy Hook을 호출한다.
  - X·인스타그램은 공식 API 비용과 약관 문제가 있어 2차로 미룬다. 확신 정도: 높음.
- GitHub Actions cron(예: 30분 간격)으로 수집 스크립트를 돌린다.
- 관리자 화면에 "피드 → 원장 승격" 버튼을 둔다. 승격은 새 원장 카드를 만들고 `evidenceId`를 연결한다.

### 5단계: 제보 경로와 공개 폼
- `/tips`, `/tips/:id` 페이지를 만든다. 목록은 미확인 라벨, 장소, 시각만 보인다. 상세 H1은 장소와 시각이다. 상세 본문은 들은 내용 한 줄과 확인하지 않은 항목 한 줄이다.
- `/tips/new` 공개 제보 폼을 만든다.
  - 폼은 Vercel 서버 함수 `api/tip.ts`로 보낸다. 서버 함수만 서비스 키를 가진다.
  - Cloudflare Turnstile로 스팸을 막고, IP당 요청 수를 제한한다.
  - 원문과 연락처는 `tip_contacts`(관리자 전용)에 저장한다. `tips` 행은 `published=false`로 만든다.
- 관리자가 원문을 읽고 공개용 `heard`, `notClaimed` 문장을 직접 쓴 뒤 공개한다. 제보 원문에는 제3자 개인정보가 섞일 수 있으므로 자동 공개는 하지 않는다.
- 제보는 홈 본문에 두지 않고 지도에도 찍지 않는다.

### 6단계: 통계 한 편
- `/stats`, `/stats/:id` 페이지를 만든다. 목록은 분석 제목과 기간만 보인다.
- 분석 페이지: H1은 분석 제목, 첫 문장은 기간·모수·계산·출처다.
- 지도는 색면(choropleth) 또는 점(dots) 하나만 쓴다. `public/geo/municipalities.geojson` 기반 SVG로 그린다. 시간대 비교는 같은 축척의 작은 지도를 나란히 둔다.
- 오른쪽은 방법 네 줄과 표, 지도 아래는 사용한 원장 카드 링크다. 범례에 모수와 제외 항목(피드, 미확인 제보, 좌표 없는 카드)을 적는다.
- `scripts/load_analysis.py`를 만든다. 이 스크립트는 사용자가 줄 공식 표 CSV를 `analyses`, `analysis_rows`에 적재한다. 데이터가 오기 전에는 분석 목록이 비어 있다.
- 기존 `StatsTab`, `countByWide`는 홈과 원장에서 쓰지 않는다.

### 7단계: 관리자 확장
- `Admin.tsx`에 탭을 추가한다: 원장(상태·검증 네 줄·출처 편집), 피드(승격), 제보(검수·공개), 통계(조회).
- 저장 성공 시 Deploy Hook을 호출한다. Hook URL은 서버 함수 `api/rebuild.ts`가 가진다.

### 8단계: 정리
- 사이트 제목을 "선거 증거 데스크"로 바꾼다.
- JSON-LD와 `llms.txt`는 마지막에 정리용으로만 추가한다.
- Search Console 등록은 배포 후 사용자가 직접 한다.

## 주요 수정 파일
- 수정: `index.html`, `package.json`, `vercel.json`, `src/App.tsx`, `src/main.tsx`, `src/types/evidence.ts`, `src/lib/data.ts`, `src/pages/EvidenceDetailPage.tsx`, `src/pages/Admin.tsx`, `src/components/evidence/FilterBar.tsx`, `scripts/supabase_schema.sql`
- 신규: `src/entry-server.tsx`, `scripts/prerender.ts`, `src/lib/seo.ts`, `src/lib/status.ts`, `src/pages/{Home,Ledger,FeedList,FeedSource,TipList,TipDetail,TipForm,StatsList,StatsDetail}.tsx`, `src/components/map/SvgMap.tsx`, `api/tip.ts`, `api/rebuild.ts`, `scripts/{migrate_to_ledger,collect_feeds,load_analysis}.py`, `.github/workflows/collect-feeds.yml`
- 삭제: `src/pages/{NationMap,WideMap,BasicDetail,UnifiedMap}.tsx`, `src/components/map/RegionExplorer.tsx`, `src/components/evidence/StatsTab.tsx`

## 검증 (기획안 9장 완료 기준)
1. `npm run build`가 성공하고 `dist/`에 경로별 `index.html`이 생긴다.
2. `curl`로 `dist/e/<id>/index.html`을 열면 H1, 첫 문단(날짜·장소·상태·출처), `canonical`이 들어 있다. JS 없이도 보인다.
3. 홈 HTML에 네 층 입구가 있고 건수 숫자가 없다.
4. 통계 상세 HTML의 지도 범례에 모수와 제외 항목이 있다.
5. 제보 공개 HTML과 Supabase anon 조회 결과에 이름·연락처가 없다. anon 키로 `tip_contacts`를 조회하면 거부된다.
6. `sitemap.xml`에 상세·분석 주소가 있고 `/admin`이 없다. `robots.txt`에 사이트맵 주소가 있다.
7. 모바일 뷰포트에서 핀치 줌이 된다.
8. Playwright로 `npm run preview`를 띄워 홈, 원장, 상세, 피드, 제보, 통계를 순서대로 열고 H1이 페이지마다 하나인지 확인한다.

## 범위 밖으로 따로 남길 것
- 스토리지 버킷 MIME 제한(jpeg/png/webp)과 mp4 업로드 불일치.
- `compress_videos.py`의 Windows 전용 ffmpeg 경로.
