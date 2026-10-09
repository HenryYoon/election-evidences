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
| `occurred_at` 채우기 | 원본 Drive 폴더 파일 이름의 `MMDD`를 쓴다. 증거 파일이 없으면 제보 시트의 날짜 구간 헤더를 쓴다. 시각은 시트 "발생 시간" 열에서 붙인다 | 파일 190개 중 170개는 업로드 날짜와 같고, 19개는 운영자가 사건 날짜로 앞당겨 적었다. 파일 이름 날짜가 운영자가 판단한 사건 날짜다 |
| 잘린 `claim` 17건 | `title`이 `description` 앞 50자로 잘린 행은 `claim`을 비워 둔다. 운영자가 문안을 승인한 뒤 채운다 | `claim`은 상세 H1이다. 잘린 문장을 H1로 올리지 않는다 |
| 피드 발신처 | 스키마가 `olgung`, `jahyeok` 행을 넣는다. 채널 주소는 운영자가 채운다 | 명세 3장 초기값 |
| 관리자 판별 | `admins` 허용 목록과 `is_admin()` 함수를 둔다. 모든 관리자 정책(기존 `evidence`, 스토리지 포함)은 `authenticated` 전체가 아니라 `is_admin()`을 조건으로 쓴다 | 로그인 계정 전체를 관리자로 보면, Auth 가입 설정이 켜지는 순간 가입자가 `tip_contacts`를 읽는다 |
| 운영 DB 적용 | 스키마 파일 전체가 아니라 `scripts/migrations/0001_ledger_and_admins.sql`(`1b)`, 관리자 정책, `5)`~`11)`)과 `0002_ledger_backfill.sql`(원장 컬럼 채우기)을 순서대로 SQL Editor에서 실행한다. 서비스 키 없이 실행할 수 있어 `migrate_to_ledger.py`를 대신한다 | 운영 버킷 설정(50MB, mp4·오디오 허용)이 스키마 파일 `3)`과 다르다. 파일 전체를 실행하면 영상 업로드가 막힌다 |

### 2단계: 사전 렌더링 기반
1. `src/entry-client.tsx`(hydrateRoot)와 `src/entry-server.tsx`(StaticRouter + renderToString)를 만든다.
2. `scripts/prerender.ts`가 빌드 시 Supabase 공개 데이터를 읽고 `dist/<path>/index.html`을 쓴다.
3. `src/lib/seo.ts`가 경로별 `<title>`, 150자 안팎 `description`, `canonical`을 만든다.
4. `dist/sitemap.xml`(`lastmod`=`updated_at`, `/admin` 제외)과 `dist/robots.txt`를 만든다.
5. MapLibre 컴포넌트는 브라우저에서만 로드한다.
6. `package.json`의 `build`를 `tsc -b && vite build && vite build --ssr src/entry-server.tsx && node prerender`로 바꾼다.
7. `vercel.json`은 정적 파일을 먼저 서빙하고 `/admin`만 SPA로 보낸다.

#### 2단계 구현 결과 (플랜과 달라진 점)
| 항목 | 구현 | 이유 |
|---|---|---|
| 출력 경로 | 홈은 `dist/index.html`, 그 밖은 `dist/<path>.html`(예: `dist/e/ev-002.html`). `vercel.json`의 `cleanUrls`가 확장자 없는 주소로 서빙한다 | `dist/<path>/index.html`은 슬래시 없는 주소(`/e/ev-002`)에서 SPA 폴백에 밀려 홈 HTML이 나갔다(`vite preview`에서 재현). 하이드레이션 오류(React #418)가 났다. Vercel 문서는 디렉터리 index 처리를 명시하지 않고 `cleanUrls`는 명시한다 |
| 프리렌더 스크립트 | `scripts/prerender.mjs`. 렌더링, SEO, 데이터 로드는 TS로 쓰고 서버 엔트리(`dist-server/entry-server.js`)에 묶는다 | Node의 TS 실행 지원에 기대지 않는다 |
| 데이터 | Supabase 환경변수가 있으면 공개 행을 읽고, 실패하면 빌드를 실패시킨다. 환경변수가 없으면 로컬용 `public/data/evidence.json`을 읽는다 | 빈 사이트를 배포하지 않는다 |
| 스냅샷 | 페이지마다 렌더에 쓴 데이터를 `window.__DESK__`로 심는다. 상세는 그 카드 하나, 홈은 전체. 하이드레이션 뒤 최신 공개 데이터를 다시 읽는다 | 첫 렌더를 서버와 같게 한다(위험 표의 하이드레이션 대응) |
| SPA 셸 | `dist/spa.html`(`noindex`). 파일이 없는 경로는 모두 셸로 보낸다 | `/admin`과 빌드 뒤에 생긴 카드 주소가 404가 되지 않게 한다 |
| 상세 첫 문단 | 2단계에서 상세 H1 아래에 날짜·장소·상태·출처 문단(`leadSentence`)을 넣었다 | 상세 회수 검증을 2단계에서 할 수 있다. 3단계 상세 교체 때 그대로 쓴다 |
| 미사용 페이지 삭제 | 3단계 6번의 삭제를 당겨 했다. `NationMap`, `WideMap`, `BasicDetail`, `RegionExplorer`, `StatsTab`과 함께 그 페이지들만 쓰던 `DetailMap`, `AppBar`도 지웠다 | 라우트에 연결되지 않은 지도 코드가 서버 렌더 범위에 남지 않게 한다 |
| 홈 H1 | 아직 없다 | 홈은 3단계에서 교체한다 |

### 3단계: 홈, 원장 목록, 상세 교체
1. `index.html`에서 `maximum-scale=1.0, user-scalable=no`를 지운다.
2. 공통 레이아웃: 상단 `DESK`와 원장·통계·피드·제보 내비게이션.
3. 홈 `/`: 명세 5장 홈 규칙. 지도는 `public/geo/provinces.geojson` SVG에 오늘 원장 좌표만 점으로 찍는다.
4. 원장 `/ledger`: 기존 `FilterBar`와 `applyFilters`(`src/lib/data.ts`)를 확장한다. 기존 `UnifiedMap` 지도는 "지도 보기" 토글로 옮긴다.
5. 상세 `/e/:id`: 명세 5장 원장 규칙. 빈 검증 줄은 "미기재"로 표시한다. `src/lib/media.ts`와 기존 영상·음성 플레이어를 재사용한다.
6. 쓰지 않는 페이지와 컴포넌트를 지운다.

#### 3단계 구현 결과 (플랜과 달라진 점)
| 항목 | 구현 | 이유 |
|---|---|---|
| "오늘 원장" | 오른쪽 세 줄은 원장에서 가장 최근 발생일의 카드다. 빌드 날짜가 아니다. 지도는 좌표가 있는 원장 카드를 모두 찍는다 | 원장은 선거 기간 기록이라 빌드 날짜 기준이면 홈이 늘 빈다. 지도를 최근 발생일로 거르면 날짜가 없는 동안(운영 DB 마이그레이션 전) 점이 0개가 되고, 날짜가 있어도 하루치만 보인다 |
| 통계·피드·제보 목록 | `StatsList`, `FeedList`, `TipList`를 빈 상태로 먼저 만들었다. 데이터 연결은 4~6단계에서 한다 | 홈의 네 입구와 내비게이션이 404로 가지 않게 한다. 사이트맵에 층 목록이 들어간다 |
| 시각 규칙 | 공개 화면은 `src/styles/desk.css`(색 4개: 배경·글자·구분선·상태)를 쓴다. 보조 정보는 색 대신 크기로 구분한다. 관리자 화면은 `global.css`를 그대로 쓴다 | 명세 시각 규칙. 관리자 화면은 7단계에서 바꾼다 |
| 상세 | 공개면에서 "제보자" 줄을 뺐다. `description`이 주장과 다르면 "제보 내용"으로 둔다 | 명세 상세 구성에 제보자 칸이 없다 |
| 삭제 | `UnifiedMap`, `EvidenceCard`, `BottomSheet`, `useIsMobile`. `typeIcon`은 `src/lib/evidenceType.ts`로 옮겼다 | 홈 교체로 쓰지 않는다 |
| 사이트 이름 | 아직 "선거 증거 아카이브"다(`SITE_NAME`) | 8단계 1번에서 바꾼다 |

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

### CI (GitHub Actions, `.github/workflows/ci.yml`)
- PR과 main 푸시마다 세 작업을 돌린다. 브랜치 보호 규칙에서 세 작업을 필수 검사로 지정해, 통과한 PR만 main에 머지한다. 배포는 Vercel Git 연동이 main 머지 때 한다.
- CI는 합성 데이터(`tests/fixtures/evidence.json`)로만 빌드한다. 실제 제보와 Supabase 키를 CI에 두지 않는다.

| 작업 | 내용 | 위 검증 항목 |
|---|---|---|
| `web` | `npm test`(상태 자동 상향 금지, `[lng, lat]`, 첫 문장, description 길이, 스냅샷 탈출) → `npm run build` → `npm run check:dist`(경로마다 title·description·canonical·H1 하나·첫 문단, 홈 건수 없음, 사이트맵 `/admin` 없음, robots, 전화번호·비밀 키 없음) → `npm run e2e`(데스크톱·모바일에서 하이드레이션 오류, H1, 가로 스크롤, JS 없는 상세, 내비게이션) | 1, 2, 3, 6, 7, 8 |
| `python` | `migrate_to_ledger.py`의 날짜 파싱과 매핑 규칙 | 상태·날짜 매핑 |
| `sql` | 스키마 두 번 적용 + RLS(anon·비관리자·관리자, `tip_contacts` 거부) + 운영 기준 스키마에 마이그레이션 0001, 0002 적용 | 5 |

## 범위 밖
- 스토리지 버킷 MIME 제한(jpeg/png/webp)과 mp4 업로드 불일치.
- `scripts/compress_videos.py`의 Windows 전용 ffmpeg 경로.
