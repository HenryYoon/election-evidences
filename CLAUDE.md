# 선거 증거 데스크

선거부정진상규명국민신고센터(선진국). 2026 지방선거 증거를 증거와 제보 두 층으로 보여주는 사이트다. 통계·피드 층은 없앴다(0008).

## 작업 흐름
- 변경은 `intent/` → `spec/` → `plan/` 순서로 문서를 커밋한 뒤 구현한다. 파일 이름은 같은 번호(`0001-...`)를 쓴다.
- 우선순위: `spec/`의 원본 PDF > `spec/*.md` > `plan/` > 이 문서 > 스킬.
- 구현이 플랜과 달라지면 같은 커밋에서 `plan/` 문서를 고친다.
- 현재 작업: `plan/0014-admin-refresh.md`(0009 리전 이전은 마무리 단계)

## 명령어
- `npm run dev`: 개발 서버 (5173)
- `npm run build`: 타입 체크 + 빌드
- `npm run preview`: 빌드 결과 미리보기
- `npm test`: 단위 테스트(vitest)
- `npm run check:dist`: 빌드 결과물 검사(회수 가능성, 개인정보, 비밀 키)
- `npm run e2e`: Playwright 스모크. 로컬에서는 `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- `bash tests/sql/run.sh`: 스키마·RLS·마이그레이션 검사. 빈 Postgres가 필요하다
- CI용 빌드: `PRERENDER_DATA=tests/fixtures/evidence.json npm run build`
- `npm run data`: xlsx → `public/data/evidence.json` ETL. 커밋되지 않는 `증거 데이터/` 폴더가 필요하다.
- `python scripts/seed_supabase.py`: Supabase 적재. `.env`의 `SUPABASE_SERVICE_KEY`가 필요하다.

## 구조
- `src/`: Vite + React 18 + react-router 6. 지도는 maplibre-gl + react-map-gl.
- `src/lib/data.ts`: Supabase에서 공개 레코드를 읽고, 실패하면 정적 JSON으로 대체한다.
- `scripts/`: Python ETL과 비식별화(`deident_*`, `reencode_view.py`). SDK 없이 `urllib`로 Supabase REST를 호출한다.
- `scripts/supabase_schema.sql`: 테이블, RLS, 스토리지 버킷 정의.
- `supabase/migrations/`: Supabase GitHub 연동이 main 머지 때 서울 프로젝트(`rndprqktwlfdmokzgaab`)에 자동 적용한다. 스키마를 바꾸면 이 폴더에 새 파일을 더하고 `scripts/supabase_schema.sql`도 같은 커밋에서 고친다(0009). `scripts/migrations/`는 옛 시드니 프로젝트 기록이다.
- `api/rebuild.js`: 관리자 "공개 HTML 갱신" 버튼이 부르는 Vercel 함수. 서버 환경변수 `DEPLOY_HOOK_URL`(Vercel Deploy Hook)이 필요하다. `VITE_` 접두사를 붙이지 않는다.
- `api/contact.js`: 문의 메일 발송. 서버 환경변수 `RESEND_API_KEY`, `CONTACT_TO`가 필요하다. `VITE_` 접두사를 붙이지 않는다. 운영자 이메일 주소를 저장소에 쓰지 않는다.
- `scripts/retention.mjs`, `.github/workflows/retention.yml`: 매일 개인정보 파기. GitHub Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`가 필요하다.
- 배포: Vercel. 데이터: Supabase(Postgres + Storage).

## 서브에이전트
- 작업에 맞는 ECC 플러그인(`ecc@ecc`) 에이전트를 골라 위임한다.
- 아래 규칙은 어떤 에이전트를 쓰든 ECC 기본 동작보다 우선한다.
  - 테스트를 격리·건너뛰기·비활성화해서 통과시키지 않는다.
  - 커버리지 수치를 맞추려고 의미 없는 테스트를 쓰지 않는다.
  - 오류는 원인과 근거를 먼저 보고한 뒤 수정한다.
  - 리뷰는 `REVIEW.md` 기준을 따른다.

## 디자인
- ECC `frontend-design-direction` 스킬을 따른다. 명세의 시각 규칙이 스킬보다 우선한다.
- 서체는 하나, 색은 배경·글자·구분선·상태 네 가지다.

## Claude가 자주 틀리는 것
- 좌표 순서는 `[lng, lat]`이다.
- 홈의 건수는 "수집"(공개 증거 수)과 "자료 확인"(`confirmed` 수) 둘뿐이다. 제보 건수를 섞거나 다른 숫자를 더하지 않는다(0008, 0011).
- 상태를 `confirmed`(자료 확인)로 자동으로 올린다. 운영자가 승인한 것만 올린다(0011).
- `public/data/`, `public/thumbs/`, `public/view/`, `_local-data/`를 커밋한다. 비식별화 전 자료가 섞일 수 있어서 커밋 금지다.
- `SUPABASE_SERVICE_KEY`에 `VITE_` 접두사를 붙인다. 붙이면 키가 프론트엔드 번들에 들어간다.
- 공개 경로나 공개 테이블에 제보자 이름, 전화번호, 계정을 넣는다.

## 작업 검증
1. `npm run build`가 통과한다.
2. 화면을 바꿨으면 `npm run preview`를 띄워 Playwright로 해당 경로를 연다. Chromium은 `/opt/pw-browsers`에 있다.
3. 사전 렌더링 이후에는 `dist/index.html`과 `dist/<path>.html`에 title, description, canonical, H1 하나, 첫 문단이 있는지 확인한다.
4. 변경분을 `REVIEW.md` 기준으로 다시 읽는다.
