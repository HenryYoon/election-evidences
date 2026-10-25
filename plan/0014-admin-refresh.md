# 0014 관리 화면 정리 — 플랜

- 명세: `spec/0014-admin-refresh.md`

## 순서
| 단계 | 할 일 |
|---|---|
| 1 | `src/lib/adminLedger.ts`에 `confirmBlockers(row)`(자료 확인을 막는 이유 목록) 추가, 단위 테스트 |
| 2 | `src/styles/admin.css` 작성, `Admin.tsx` 인라인 스타일을 클래스로 바꿈 |
| 3 | 목록에 상태 두 칸 버튼, 요약, 상태 거르기 |
| 4 | 문구 합니다체 |
| 5 | 빌드·단위·e2e. Playwright로 `/admin`을 열어 Supabase 요청을 가짜 응답으로 바꾸고 목록·편집 창·로그인 화면을 본다 |

## 진행 기록
- 2026-10-25: 관리 화면에 오류를 띄우는 서버 함수 메시지(`api/rebuild.js`, `api/contact.js`)도 합니다체로 바꿨다. 관리 화면 "실패했습니다: …" 뒤에 그대로 붙기 때문이다.
- 2026-10-25: Playwright로 `/admin`을 열어 Supabase 요청을 가짜 응답으로 바꿔 확인했다. 장소·매체가 없는 기록은 자료 확인 버튼이 막히고, 있는 기록은 `{"status":"confirmed"}` 요청이 나간다. 390px 폭에서 가로 스크롤이 없다. `admin.css`는 관리 화면 청크(`Admin-*.css`)에만 들어간다.
