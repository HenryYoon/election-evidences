# 0005 개인정보 동의와 처리방침 — 플랜

- 명세: `spec/0005-privacy-consent.md`

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 자동 파기 위치 | GitHub Actions 매일 1회 + service_role 전용 RPC | Supabase는 SQL로 저장소 파일을 지우지 못하게 막는다(`protect_delete`). 파일은 Storage API로만 지울 수 있다 |
| 기각 제보 행 | 기각할 때 원문·연락처를 지운다. 행 자체는 다음 파기 실행 때 지운다 | 첨부 파일 삭제가 실패하면 다음 날 다시 시도할 수 있게 id를 남긴다 |
| 국외 이전 근거 | 별도 동의(제28조의8 제1항 제1호) | 제보는 계약 이행이 아니라서 다른 근거를 쓰기 어렵다 |
| Vercel 접속 기록 | 처리방침에 공개만 한다 | 모든 방문자에게 생기는 전송 기록이다. 제보 폼 동의 대상이 아니다 |
| 보호책임자 | "선거 증거 데스크 운영자". 요청 창구는 제보 폼. 운영자가 이메일을 정하면 바꾼다 | 운영자 연락처 공개 여부가 아직 정해지지 않았다 |

## 바뀌는 파일
- DB: `scripts/migrations/0007_retention.sql`(새 파일), `scripts/supabase_schema.sql`, `tests/sql/retention_test.sql`(새 파일), `tests/sql/run.sh`
- 파기: `scripts/retention.mjs`(새 파일), `.github/workflows/retention.yml`(새 파일)
- 프론트: `src/lib/privacy.ts`(새 파일, 보유 기간·위탁 표), `src/pages/Privacy.tsx`(새 파일), `src/pages/TipList.tsx`, `src/lib/tips.ts`, `src/components/layout/DeskLayout.tsx`(아래 링크), `src/App.tsx`, `src/lib/seo.ts`, `src/styles/desk.css`
- 점검: `scripts/check-dist.mjs`, `scripts/reach/check-live.mjs`, `tests/unit/tips.test.ts`, `tests/e2e/smoke.mjs`

## 작업 순서
1. 0007과 SQL 검사.
2. 파기 스크립트와 워크플로.
3. 동의 폼과 처리방침.
4. 머지 뒤 운영자가 0007을 실행하고 GitHub Secrets에 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`를 넣는다. 수동 실행으로 확인한다.

## 위험
| 위험 | 대응 |
|---|---|
| 비밀 키가 GitHub Actions 로그에 찍힌다 | 스크립트는 키를 출력하지 않는다. 결과는 건수만 출력한다 |
| 파기 작업이 실패해도 아무도 모른다 | 워크플로가 실패로 끝난다. GitHub가 실패 메일을 보낸다 |
| Secrets 없이 실행된다 | 실패로 끝내고 무엇이 없는지 적는다 |
