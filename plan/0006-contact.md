# 0006 문의 페이지 — 플랜

- 명세: `spec/0006-contact.md`

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 저장 경로 | 브라우저 → `submit_inquiry` RPC | 서버 함수를 거치면 Supabase가 보는 IP가 Vercel IP라서 IP당 비율 제한이 무너진다 |
| 발송 경로 | 브라우저 → `/api/contact`(id만) → `claim_inquiry_mail` → Resend | 서버 함수에 service key를 두지 않는다. 같은 문의를 두 번 보내지 않는다 |
| 보낸 사람 주소 | Resend 기본 주소(`onboarding@resend.dev`) | 도메인 인증 없이 Resend 계정 주소로만 보낼 수 있다. 운영자가 계정 이메일로 Resend에 가입한다 |
| 받는 주소 | `CONTACT_TO` 환경변수 | 저장소와 화면에 주소를 쓰지 않는다 |

## 바뀌는 파일
- DB: `scripts/migrations/0008_inquiries.sql`(새 파일), `scripts/supabase_schema.sql`, `tests/sql/inquiry_test.sql`(새 파일), `tests/sql/run.sh`
- 서버: `api/contact.js`(새 파일)
- 프론트: `src/lib/contact.ts`(새 파일), `src/pages/Contact.tsx`(새 파일), `src/lib/privacy.ts`, `src/pages/Privacy.tsx`, `src/pages/About.tsx`, `src/pages/Admin.tsx`, `src/components/layout/DeskLayout.tsx`, `src/App.tsx`, `src/lib/seo.ts`, `src/lib/llms.ts`
- 점검: `scripts/check-dist.mjs`(비밀 키 패턴, `/contact`), `scripts/reach/check-live.mjs`, `tests/unit/contact.test.ts`(새 파일), `tests/e2e/smoke.mjs`

## 작업 순서
1. 0008과 SQL 검사.
2. `/api/contact`와 단위 테스트.
3. 문의 폼, 처리방침·소개 연결, 관리자 탭.
4. 머지 뒤 운영자 작업
   1. 0008을 실행한다.
   2. Resend에 계정 이메일로 가입한다.
   3. Vercel에 `RESEND_API_KEY`, `CONTACT_TO`를 넣고 재배포한다.
   4. 문의를 한 번 보내 메일이 오는지 확인한다.
