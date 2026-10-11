# 0004 사이트 목적 안내와 제보 파일 업로드 — 플랜

- 명세: `spec/0004-purpose-and-tip-upload.md`

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 업로드 권한 | Storage RLS insert 정책 하나. 조건 검사는 SECURITY DEFINER 함수 `tip_upload_ok(name)`가 한다 | 서버 함수에 service key를 두지 않는다. 키가 새는 경로를 늘리지 않는다 |
| 제보와 파일 연결 | 경로 첫 폴더가 제보 id(UUID)다. DB 열을 더하지 않는다 | UUID라 남의 제보에 파일을 붙이기 어렵다. 관리자는 폴더 목록으로 본다 |
| 용량 보호 | 파일당 20MB(버킷 제한), 제보당 5개, 버킷 1시간 60개, 누적 500MB | Free 1GB 중 공개 버킷이 218MB를 쓴다. 최악의 경우에도 1GB를 넘지 않는다 |
| 기각 시 삭제 | 관리자 화면이 Storage API로 지운 뒤 `finish_tip_review`를 부른다 | Supabase는 SQL로 storage.objects를 지우는 것을 막는다 |
| 홈 문장 | 목적 문장을 `src/lib/site.ts` 한 곳에 두고 홈, description, `llms.txt`가 함께 쓴다 | 화면과 검색 설명, AI 색인의 문장이 어긋나지 않는다 |

## 바뀌는 파일
- DB: `scripts/migrations/0006_tip_uploads.sql`(새 파일), `scripts/supabase_schema.sql`, `tests/sql/supabase_stub.sql`, `tests/sql/upload_test.sql`(새 파일), `tests/sql/run.sh`
- 프론트: `src/lib/site.ts`(새 파일), `src/pages/Home.tsx`, `src/pages/About.tsx`(새 파일), `src/components/layout/DeskLayout.tsx`, `src/App.tsx`, `src/lib/seo.ts`, `src/lib/llms.ts`, `src/lib/tips.ts`, `src/pages/TipList.tsx`, `src/pages/Admin.tsx`, `src/styles/desk.css`
- 점검: `scripts/reach/check-live.mjs`(`/about`), `tests/unit/tips.test.ts`, `tests/e2e/smoke.mjs`

## 작업 순서
1. 0006 마이그레이션과 SQL 검사.
2. 홈 문장, 소개 페이지.
3. 제보 폼 업로드, 관리자 첨부 보기와 기각 시 삭제.
4. 머지 뒤 운영자가 0006을 실행한다.

## 위험
| 위험 | 대응 |
|---|---|
| 업로드로 저장 용량을 채운다 | 위 용량 보호 네 겹. 넘으면 업로드만 거절되고 제보 글은 접수된다 |
| 악성 파일 | 형식을 버킷이 제한한다. 파일은 비공개라 다른 사람에게 배포되지 않는다. 관리자는 서명 주소로 브라우저에서만 연다 |
| 제보자 위치 노출 | 파일은 관리자만 본다. 공개는 비식별화 뒤에만 한다(기존 절차) |
