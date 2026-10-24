# 0009 Supabase 서울 리전 이전과 저장소 연동 — 명세

- 의도: `intent/0009-seoul-region.md`

## 1. 새 프로젝트
- 프로젝트: `election-evidence`(ref `rndprqktwlfdmokzgaab`), 리전 ap-northeast-2.
- GitHub 연동: 작업 디렉터리 `.`, 운영 브랜치 `main`, "Deploy to production" 켬.

## 2. 저장소 구조
- `supabase/config.toml`: `supabase init`(CLI 2.122.0)이 만든 기본값. `project_id`만 바꾸고 시드는 끈다. 버킷은 선언하지 않는다(마이그레이션 SQL이 만든다).
- `supabase/migrations/20261025000000_baseline.sql`: 0001~0008이 반영된 `scripts/supabase_schema.sql`과 같은 내용.
- 앞으로의 스키마 변경은 `supabase/migrations/<UTC 시각>_<이름>.sql`로 더하고, 같은 커밋에서 `scripts/supabase_schema.sql`도 고친다. `scripts/migrations/`는 기존 시드니 프로젝트 기록으로만 남긴다.
- SQL 검사(`tests/sql/run.sh`)는 `supabase/migrations`를 순서대로 적용한 DB에서도 전체 검사를 돌린다.

## 3. 데이터 이전
| 대상 | 방법 |
|---|---|
| 증거, 피드 발신처 | 기존 프로젝트에서 읽어 새 프로젝트에 넣는다(MCP). 사진 주소의 프로젝트 주소를 새 주소로 바꾼다 |
| 저장소 파일(evidence-media) | 일회성 GitHub Actions 작업이 옛 프로젝트에서 받아 새 프로젝트에 올린다. 키는 GitHub Secrets에만 둔다 |
| 관리자 | 운영자가 새 프로젝트에 계정을 만든다. `admins`에 그 id를 넣는다 |
| 제보, 첨부, 문의 | 옮기지 않는다(제보 0건, 문의는 시험 3건) |
| Auth 설정 | 운영자가 다시 설정한다(가입 끄기, 비밀번호 기준) |

## 4. 전환
- Vercel 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`와 GitHub Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`를 새 프로젝트 값으로 바꾸고 재배포한다.
- 재배포 전까지는 옛 프로젝트가 응답한다.

## 5. 전환 뒤 코드
- 제보 폼에서 국외 이전 동의 칸과 검사를 뺀다.
- 처리방침: Supabase를 국내 처리 위탁으로 옮기고 국가를 대한민국(서울)으로 쓴다. 문의(Resend), 접속 기록(Vercel)의 국외 이전은 그대로 둔다.

## 6. 완료 기준
- [ ] 새 프로젝트의 마이그레이션 기록에 baseline이 있고 보안 경고가 기존과 같다.
- [ ] 증거 수와 저장소 파일 수가 옛 프로젝트와 같다.
- [ ] 운영 사이트에서 사진이 새 프로젝트 주소로 열린다.
- [ ] 제보·업로드, 문의, 관리자 로그인, Retention이 동작한다.
