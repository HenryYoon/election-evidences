# 0003 보안 점검과 보강 — 플랜

- 명세: `spec/0003-security-hardening.md`

## 점검 결과 (2026-10-10)
| 영역 | 확인한 것 | 결과 |
|---|---|---|
| 공개 테이블 | anon으로 `tips`, `tip_contacts`, 비공개 `evidence`를 읽는다 | 0행. RLS 검사(`tests/sql`)가 매 PR에서 확인한다 |
| 함수 권한 | anon이 `finish_tip_review`를 실행한다 | 권한 없음(0004에서 회수) |
| 재빌드 API | `api/rebuild.js` 코드 | 토큰이 없으면 401, `is_admin()`이 거짓이면 403. Deploy Hook 주소는 서버 환경변수에만 있다 |
| 비밀 키 | 저장소와 빌드 결과물 | `.env.example`만 있다. `check:dist`가 매 빌드 검사한다 |
| 공개 데이터 | 전화번호, 이메일, 제보자 이름 | 없음 |
| 스토리지 | anon이 객체 목록을 조회한다 | 가능. 지금은 모든 객체가 공개 기록에 쓰여서 새로 드러나는 것은 없다. 이후 업로드부터 위험하다 → 정책 삭제 |
| 비율 제한 | `x-forwarded-for` 첫 값 | 요청자가 헤더를 보내면 첫 값이 바뀐다 → `cf-connecting-ip` 우선 |
| 보안 헤더 | 응답 헤더 | 없음 → 추가 |
| 의존성 | `npm audit --omit=dev` | 아래 표 |

| 패키지 | 권고 | 이 사이트에서 | 조치 |
|---|---|---|---|
| react-router 6.30.4 | SSR 하이드레이션 `deserializeErrors`(GHSA-337j-9hxr-rhxg) | 데이터 라우터를 쓰지 않는다(`BrowserRouter`, `StaticRouter`). 해당 코드 경로가 없다 | 6.30.6으로 올린다. 7.x 전환은 따로 |
| react-router | `<Link>` 역슬래시 오픈 리다이렉트(GHSA-wrjc-x8rr-h8h6) | 링크 대상이 모두 내부 경로다. 사용자 입력으로 이동하지 않는다 | 7.x 전환 때 함께 |
| maplibre-gl 4.7.1 | `DOM.sanitize` 우회 XSS(GHSA-jrc7-96c5-q579) | `Popup.setHTML`을 쓰지 않고, 지도 스타일을 코드에서 만든다. 외부 HTML이 들어가지 않는다 | maplibre 6, react-map-gl 8 전환은 따로 |

## 바뀌는 파일
- `vercel.json`: 보안 헤더.
- `scripts/migrations/0005_security_hardening.sql`(새 파일), `scripts/supabase_schema.sql`: `submit_tip`, `touch_updated_at`, 스토리지 정책.
- `tests/sql/security_test.sql`(새 파일), `tests/sql/run.sh`.
- `scripts/reach/check-live.mjs`: 헤더 확인.
- `package-lock.json`: react-router 6.30.6.

## 작업 순서
1. 마이그레이션 0005와 SQL 검사.
2. `vercel.json` 헤더와 `check-live` 확인.
3. 머지 뒤 운영자가 0005를 실행하고 Auth 설정 두 가지를 바꾼다.

## 위험
| 위험 | 대응 |
|---|---|
| 정책 삭제 뒤 공개 사진이 안 열린다 | 공개 버킷 주소는 RLS를 거치지 않는다. 적용 뒤 상세 페이지 사진을 연다 |
| `cf-connecting-ip`가 PostgREST까지 오지 않는다 | `x-forwarded-for` 첫 값으로 돌아간다. 지금보다 나빠지지 않는다 |
| `X-Frame-Options: DENY`가 Search Console 미리보기를 막는다 | 미리보기는 렌더링 서버가 직접 받는다. 프레임에 넣지 않는다 |

## 적용 결과 (2026-10-10)
| 항목 | 결과 |
|---|---|
| 보안 헤더 | 운영 회수 점검 통과(실행 38035558195) |
| 0005 | 운영자가 실행. 스토리지 정책은 `media_admin_write`만 남음, `touch_updated_at` search_path 고정, `submit_tip`이 `cf-connecting-ip` 사용 |
| 공개 미디어 | 0005 뒤 운영 점검(실행 38036822443)의 저장소 요청 200 62건, 206 1건, 304 1건. 4xx 없음 |
| Supabase 보안 경고 | `touch_updated_at` 경고 해소. 남은 경고(anon의 `is_admin`·`submit_tip` 실행, `admins` 정책 없음)는 의도한 설정 |
| 유출 비밀번호 차단 | Free 플랜이라 켤 수 없다. 운영자가 비밀번호 기준을 올렸다 |
| 신규 가입 | 꺼져 있음(운영자 확인) |
