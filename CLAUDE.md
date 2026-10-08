# 선거 증거 데스크

선거 증거를 원장, 피드, 제보, 통계 네 층으로 나눠 보여주는 사이트다.

## 작업 흐름
- 변경은 `intent/` → `spec/` → `plan/` 순서로 문서를 커밋한 뒤 구현한다. 파일 이름은 같은 번호(`0001-...`)를 쓴다.
- 우선순위: `spec/`의 원본 PDF > `spec/*.md` > `plan/` > 이 문서 > 스킬.
- 구현이 플랜과 달라지면 같은 커밋에서 `plan/` 문서를 고친다.
- 현재 작업: `plan/0001-evidence-desk.md`

## 명령어
- `npm run dev`: 개발 서버 (5173)
- `npm run build`: 타입 체크 + 빌드
- `npm run preview`: 빌드 결과 미리보기
- `npm run data`: xlsx → `public/data/evidence.json` ETL. 커밋되지 않는 `증거 데이터/` 폴더가 필요하다.
- `python scripts/seed_supabase.py`: Supabase 적재. `.env`의 `SUPABASE_SERVICE_KEY`가 필요하다.

## 구조
- `src/`: Vite + React 18 + react-router 6. 지도는 maplibre-gl + react-map-gl.
- `src/lib/data.ts`: Supabase에서 공개 레코드를 읽고, 실패하면 정적 JSON으로 대체한다.
- `scripts/`: Python ETL과 비식별화(`deident_*`, `reencode_view.py`). SDK 없이 `urllib`로 Supabase REST를 호출한다.
- `scripts/supabase_schema.sql`: 테이블, RLS, 스토리지 버킷 정의.
- 배포: Vercel. 데이터: Supabase(Postgres + Storage).

## 서브에이전트 (ECC 플러그인 `ecc@ecc`)
| 역할 | ECC 에이전트 | 주의 |
|---|---|---|
| 정찰 | `code-explorer`, `code-architect`, `seo-specialist` | 구현 전에 쓴다 |
| 구현 | `tdd-guide` | 커버리지 수치를 맞추려고 의미 없는 테스트를 쓰지 않는다 |
| 원인 분석 | `react-build-resolver`, `build-error-resolver`, `silent-failure-hunter` | 원인과 근거를 먼저 보고한 뒤 수정한다 |
| 테스트 | `e2e-runner` | 테스트를 격리·건너뛰기·비활성화해서 통과시키지 않는다 |
| 리뷰 | `code-reviewer`, `typescript-reviewer`, `react-reviewer`, `security-reviewer`, `database-reviewer` | `REVIEW.md` 기준을 따른다 |

## 디자인
- ECC `frontend-design-direction` 스킬을 따른다. 명세의 시각 규칙이 스킬보다 우선한다.
- 서체는 하나, 색은 배경·글자·구분선·상태 네 가지다.

## Claude가 자주 틀리는 것
- 좌표 순서는 `[lng, lat]`이다.
- 층끼리 건수를 합치거나, 홈에 건수를 크게 노출한다. 둘 다 금지다.
- 상태를 `document`나 `video_confirmed`로 자동으로 올린다. 수동으로만 올린다.
- `public/data/`, `public/thumbs/`, `public/view/`, `_local-data/`를 커밋한다. 비식별화 전 자료가 섞일 수 있어서 커밋 금지다.
- `SUPABASE_SERVICE_KEY`에 `VITE_` 접두사를 붙인다. 붙이면 키가 프론트엔드 번들에 들어간다.
- 공개 경로나 공개 테이블에 제보자 이름, 전화번호, 계정을 넣는다.

## 작업 검증
1. `npm run build`가 통과한다.
2. 화면을 바꿨으면 `npm run preview`를 띄워 Playwright로 해당 경로를 연다. Chromium은 `/opt/pw-browsers`에 있다.
3. 사전 렌더링 이후에는 `dist/<path>/index.html`에 title, description, canonical, H1 하나, 첫 문단이 있는지 확인한다.
4. 변경분을 `REVIEW.md` 기준으로 다시 읽는다.
