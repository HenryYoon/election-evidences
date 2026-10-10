# 0002 검색·AI 도달 — 플랜

- 명세: `spec/0002-search-reach.md`
- 기준점: agentic-seo F 37/100, 홈 HTML 138KB(스냅샷 82KB, 지도 경계선 54KB), 기록 목록 119KB (2026-10-10, 실제 데이터 로컬 빌드)

## 결정 사항
| 항목 | 결정 | 근거 |
|---|---|---|
| 스냅샷 분리 | 홈·기록 목록은 `dist/snapshot/<해시>.json`에 쓰고 HTML에는 `window.__DESK_SRC__`와 `<link rel="preload">`만 둔다. 클라이언트는 이 파일을 받은 뒤 하이드레이션한다 | 본문은 사전 렌더링돼 있어 하이드레이션이 늦어도 읽기에 지장이 없다. 해시 이름이라 오래 캐시해도 된다 |
| 지도 경계선 | `SvgMap`이 경계선 경로를 문자열로 내보내고, 프리렌더가 `dist/geo/basemap.svg`로 쓴다. 페이지 SVG는 `<image>`로 그 파일을 깔고 점만 그린다 | 경계선은 모든 페이지에서 같다. 색은 데스크 색(배경·구분선)을 파일에 직접 쓴다 |
| `llms.txt`, 마크다운 | 프리렌더가 서버 엔트리의 `llmsTxt(ds, site)`, `evidenceMarkdown(ev, site)`로 만든다. 문장은 `seo.ts`의 `leadSentence`를 그대로 쓴다 | HTML 첫 문단과 마크다운 첫 문단이 같아야 인용이 어긋나지 않는다 |
| 점검 도구 | `lighthouse@12.8.2`와 `agentic-seo@1.0.0`을 `npx`로 버전 고정해 실행한다 | 운영자가 외부 패키지 실행을 허용했다 |
| 점검 시점 | 주 1회(cron)와 수동 실행. PR CI에는 넣지 않는다 | 운영 사이트를 대상으로 해서 PR 결과와 무관하다. PR 쪽 예산 검사는 `check:dist`가 맡는다 |
| 점수의 강제 여부 | Lighthouse, agentic-seo 점수는 경고만 낸다(`continue-on-error`, `::warning`). 운영 사이트 회수 점검만 실패로 표시한다 | 운영자 결정(2026-10-10). 점수는 도구 버전과 측정 환경에 따라 흔들린다 |
| `llms.txt` 크기 | 최근 20건과 전체 목록 주소만 싣고, 전체 목록은 `/records.md`에 둔다 | 95건을 모두 실으면 9.6K 토큰으로 권장치(5K)를 넘는다 |

## 바뀌는 파일
- 프론트: `src/entry-client.tsx`, `src/entry-server.tsx`, `src/lib/snapshot.tsx`, `src/lib/status.ts`(검증 네 줄 공용화), `src/lib/llms.ts`(새 파일), `src/components/map/SvgMap.tsx`, `src/pages/EvidenceDetailPage.tsx`, `src/styles/desk.css`
- 빌드: `scripts/prerender.mjs`(og 메타, `llms.txt`, `records.md`, 기록별 `.md`, robots.txt), `scripts/check-dist.mjs`, `vercel.json`(`.md`·`llms.txt` Content-Type, 스냅샷 캐시)
- 점검: `scripts/reach/check-live.mjs`, `scripts/reach/report-scores.mjs`, `scripts/reach/baseline.json`, `.github/workflows/reach.yml`(모두 새 파일)
- 테스트: `tests/unit/llms.test.ts`(새 파일), `tests/e2e/smoke.mjs`

## 작업 순서
1. 스냅샷 분리와 지도 경계선 분리. `check:dist`에 HTML 예산을 더한다.
2. `llms.txt`와 기록별 마크다운, 상세의 `alternate` 링크. `check:dist`의 개인정보 검사 대상에 `.md`를 더한다.
3. 인용 복사 버튼과 마크다운 링크. e2e로 확인한다.
4. robots.txt와 `og:` 메타.
5. `scripts/reach/`와 `reach.yml`. 머지 뒤 운영 사이트에서 한 번 돌려 기준값을 이 문서에 적는다.

## 위험
| 위험 | 대응 |
|---|---|
| 스냅샷 파일을 받기 전에 하이드레이션하면 불일치 오류가 난다 | 파일을 받은 뒤에만 `hydrateRoot`를 부른다. 받지 못하면 `createRoot`로 새로 그린다 |
| 마크다운이나 `llms.txt`에 비공개 정보가 섞인다 | 공개 행만 쓴다. `check:dist`가 `.md`, `.txt`도 전화번호와 비밀 키를 검사한다 |
| 운영 사이트 점검이 일시적 네트워크 오류로 실패한다 | 요청마다 한 번 재시도한다. 그래도 실패하면 실패로 둔다 |

## 구현 결과 (2026-10-10, 실제 데이터 95건 로컬 빌드)
| 항목 | 전 | 후 |
|---|---|---|
| 홈 HTML | 138KB | 31KB |
| 기록 목록 HTML | 119KB | 48KB (예산 77KB) |
| agentic-seo | F 37 | D 56 |
| Lighthouse 로컬(성능/접근성/모범 사례/SEO) | 측정 안 함 | 홈 99/100/96/100, 목록 97/100/96/100, 상세 100/100/96/100 |

- 로컬 Lighthouse는 샌드박스에서 외부 요청(Supabase 이미지)이 막힌 상태의 값이다. 운영 기준값은 머지 뒤 첫 주기 점검에서 잡는다.
- agentic-seo의 남은 감점은 대부분 개발 문서용 항목이다(`skill.md`, `AGENTS.md`, 코드 예제, 코드 블록 복사). 명세 제약에 따라 맞추지 않는다.
- "JS가 필요한 페이지"와 "태그 비율" 감점은 상세 본문이 짧아서 생긴다(눈에 보이는 글자 150~230자). 같은 내용의 마크다운 판으로 대신한다.

## 운영 기준값 (2026-10-10, 첫 주기 점검 실행 38028839685)
| 페이지 | 성능 | 접근성 | 모범 사례 | SEO |
|---|---|---|---|---|
| / | 88 | 100 | 96 | 100 |
| /records | 98 | 100 | 96 | 100 |
| /e/ev-002 | 77 | 100 | 96 | 100 |

- 회수 점검: 모두 통과. HTML 크기는 상세 4~6KB.
- agentic-seo(URL 모드): F 20. 로컬 폴더 모드(D 56)보다 낮다. URL 모드는 빌드 폴더를 볼 수 없어 마크다운 판과 `llms.txt` 일부 항목을 확인하지 못한다. 두 모드의 점수를 서로 비교하지 않는다.
- `scripts/reach/baseline.json`에 페이지별 최솟값을 기준으로 적었다.
- 다음 개선 후보: 상세 성능 77. 상세 페이지도 지도 라이브러리(maplibre) CSS와 공통 번들을 받는다. 원인을 측정한 뒤 별도 작업으로 다룬다.
