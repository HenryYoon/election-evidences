# 0007 영어 페이지 1단계 — 플랜

- 명세: `spec/0007-english-pages.md`

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 문구 위치 | `src/lib/i18n.ts`에 한국어·영어 문구를 둔다. 한국어 문구는 기존 상수(`site.ts`, `status.ts`)를 그대로 가리킨다 | 한국어 문구의 출처를 하나로 유지한다 |
| 컴포넌트 | `Home`, `About`, `DeskLayout`이 `lang`을 받는다. 페이지를 복제하지 않는다 | 두 언어 화면의 구조가 어긋나지 않는다 |
| 언어 정보 전달 | `pageMeta`가 `lang`과 짝 주소를 돌려준다. 프리렌더가 `<html lang>`과 hreflang을 쓴다. 클라이언트 내비게이션 때 `useHead`가 `lang`을 바꾼다 | 기존 메타 경로를 그대로 쓴다 |

## 바뀌는 파일
- `src/lib/i18n.ts`(새 파일), `src/lib/site.ts`, `src/lib/seo.ts`, `src/pages/Home.tsx`, `src/pages/About.tsx`, `src/components/layout/DeskLayout.tsx`, `src/components/evidence/StatusLegend.tsx`, `src/App.tsx`, `src/lib/llms.ts`, `scripts/prerender.mjs`, `scripts/check-dist.mjs`, `scripts/reach/check-live.mjs`, `tests/unit/i18n.test.ts`(새 파일), `tests/e2e/smoke.mjs`, `src/styles/desk.css`

## 다음 단계(2단계, 운영자와 논의)
- 기록 상세 번역: 주장 한 줄부터, 기계 번역 뒤 운영자 검수 여부.
- 영어 문의 폼과 처리방침.
