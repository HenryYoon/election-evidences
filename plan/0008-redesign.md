# 0008 개편 — 플랜

- 명세: `spec/0008-redesign.md`

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 검증 건수 정의 | `status in ('document', 'video_confirmed')` | 명세 1장의 상태 정의와 같다. 검증 네 줄 채움 여부는 쓰지 않는다 |
| 홈 건수 검사 | `check:dist`의 "홈 본문에 건수 금지" 검사를 "수집 건수 = 공개 증거 수" 검사로 바꾼다 | 규칙이 바뀌었다. 숫자가 데이터와 어긋나는 것은 계속 막는다 |
| 통계·피드 코드 | 페이지 파일, 메타, `EXCLUDED_KINDS`, `Layer` 타입의 해당 값을 지운다 | 남겨 두면 다시 메뉴에 들어간다 |
| 동의 접힘 | `<details>` 요소. JS 없이 동작한다 | 사전 렌더링 HTML에서도 접힌다 |
| 이름 상수 | `SITE_NAME`, `SITE_SHORT`를 `seo.ts`에 둔다. 영어는 `i18n.ts` | 한 곳만 고치면 모든 출력이 바뀐다 |

## 바뀌는 파일
- 문구: `src/lib/seo.ts`, `src/lib/site.ts`, `src/lib/i18n.ts`, `src/lib/llms.ts`, `index.html`, `api/contact.js`
- 화면: `src/pages/Home.tsx`, `src/pages/Ledger.tsx`, `src/pages/EvidenceDetailPage.tsx`, `src/pages/About.tsx`, `src/pages/TipList.tsx`, `src/pages/Privacy.tsx`, `src/pages/Admin.tsx`, `src/components/layout/DeskLayout.tsx`, `src/App.tsx`, `src/styles/desk.css`
- 삭제: `src/pages/StatsList.tsx`, `src/pages/FeedList.tsx`
- 설정: `vercel.json`(리다이렉트), `scripts/check-dist.mjs`, `scripts/reach/check-live.mjs`, `tests/e2e/smoke.mjs`, `tests/unit/*`
- 문서: `CLAUDE.md`, `spec/0001-evidence-desk.md` 머리의 운영자 결정

## 작업 순서
1. 이름과 문구 상수.
2. 홈, 증거, 상세, 소개.
3. 통계·피드 제거와 리다이렉트.
4. 제보 폼 축약.
5. 검사 스크립트와 테스트.

## 범위 밖
- 출처 표기 정리("카카오톡 제보" → "시민 제보(메신저)")와 깨진 출처 값 2건은 데이터 작업으로 따로 한다.
- 쟁점 분류, 3단 카드, 사후 경과는 운영자가 내용을 쓸 준비가 되면 0009로 다룬다.
