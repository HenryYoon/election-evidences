# 0002 검색·AI 도달 — 플랜

- 명세: `spec/0002-search-reach.md`
- 기준점: agentic-seo F 37/100, 홈 HTML 138KB(스냅샷 82KB, 지도 경계선 54KB), 기록 목록 119KB (2026-10-10, 실제 데이터 로컬 빌드)

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 스냅샷 분리 | 홈·기록 목록은 `dist/snapshot/<해시>.json`에 쓰고 HTML에는 `window.__DESK_SRC__`와 `<link rel="preload">`만 둔다. 클라이언트는 이 파일을 받은 뒤 하이드레이션한다 | 본문은 사전 렌더링돼 있어 하이드레이션이 늦어도 읽기에 지장이 없다. 해시 이름이라 오래 캐시해도 된다 |
| 지도 경계선 | `SvgMap`이 경계선 경로를 문자열로 내보내고, 프리렌더가 `dist/geo/basemap.svg`로 쓴다. 페이지 SVG는 `<image>`로 그 파일을 깔고 점만 그린다 | 경계선은 모든 페이지에서 같다. 색은 데스크 색(배경·구분선)을 파일에 직접 쓴다 |
| `llms.txt`, 마크다운 | 프리렌더가 서버 엔트리의 `llmsTxt(ds, site)`, `evidenceMarkdown(ev, site)`로 만든다. 문장은 `seo.ts`의 `leadSentence`를 그대로 쓴다 | HTML 첫 문단과 마크다운 첫 문단이 같아야 인용이 어긋나지 않는다 |
| 점검 도구 | Lighthouse는 `@lhci/cli`, AEO는 `agentic-seo`를 `npx`로 버전 고정해 실행한다 | 운영자가 외부 패키지 실행을 허용했다 |
| 점검 시점 | 주 1회(cron)와 수동 실행. PR CI에는 넣지 않는다 | 운영 사이트를 대상으로 해서 PR 결과와 무관하다. PR 쪽 예산 검사는 `check:dist`가 맡는다 |

## 바뀌는 파일
- 프론트: `src/entry-client.tsx`, `src/entry-server.tsx`, `src/lib/snapshot.tsx`, `src/lib/seo.ts`, `src/lib/llms.ts`(새 파일), `src/components/map/SvgMap.tsx`, `src/pages/EvidenceDetailPage.tsx`, `src/App.tsx`(og 메타)
- 빌드: `scripts/prerender.mjs`, `scripts/check-dist.mjs`
- 점검: `scripts/check-live.mjs`(새 파일), `.github/workflows/reach.yml`(새 파일), `lighthouserc.json`(새 파일)
- 테스트: `tests/unit/llms.test.ts`(새 파일), `tests/e2e/smoke.mjs`

## 작업 순서
1. 스냅샷 분리와 지도 경계선 분리. `check:dist`에 HTML 예산을 더한다.
2. `llms.txt`와 기록별 마크다운, 상세의 `alternate` 링크. `check:dist`의 개인정보 검사 대상에 `.md`를 더한다.
3. 인용 복사 버튼과 마크다운 링크. e2e로 확인한다.
4. robots.txt와 `og:` 메타.
5. `check-live.mjs`와 `reach.yml`. 머지 뒤 운영 사이트에서 한 번 돌려 기준값을 이 문서에 적는다.

## 위험
| 위험 | 대응 |
|---|---|
| 스냅샷 파일을 받기 전에 하이드레이션하면 불일치 오류가 난다 | 파일을 받은 뒤에만 `hydrateRoot`를 부른다. 받지 못하면 `createRoot`로 새로 그린다 |
| 마크다운이나 `llms.txt`에 비공개 정보가 섞인다 | 공개 행만 쓴다. `check:dist`가 `.md`, `.txt`도 전화번호와 비밀 키를 검사한다 |
| 운영 사이트 점검이 일시적 네트워크 오류로 실패한다 | 요청마다 한 번 재시도한다. 그래도 실패하면 실패로 둔다 |
