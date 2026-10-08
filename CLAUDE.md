# 선거 증거 데스크

기획 기준은 `선거 증거 데스크` 빌드 핸드오프(2026-10-08)다. 구현 플랜은 `docs/desk-plan.md`다. 기획안이 이 문서와 스킬보다 우선한다.

## 서브에이전트 (ECC 플러그인 `ecc@ecc`)
| 역할 | ECC 에이전트 | 주의 |
|---|---|---|
| 정찰 | `code-explorer`, `code-architect`, `seo-specialist` | 구현 전에 쓴다 |
| 구현 | `tdd-guide` | 테스트 커버리지 수치를 맞추려고 의미 없는 테스트를 쓰지 않는다 |
| 원인 분석 | `react-build-resolver`, `build-error-resolver`, `silent-failure-hunter` | 원인과 근거를 먼저 보고한 뒤 수정한다 |
| 테스트 | `e2e-runner` | 테스트를 격리·건너뛰기·비활성화해서 통과시키지 않는다 |
| 리뷰 | `code-reviewer`, `typescript-reviewer`, `react-reviewer`, `security-reviewer`, `database-reviewer` | 변경 파일 종류에 맞는 리뷰어를 고른다 |

## 디자인
- ECC `frontend-design-direction` 스킬을 따른다.
- 기획안의 시각 규칙이 스킬보다 우선한다. 서체는 하나다. 색은 배경, 글자, 구분선, 상태 네 가지다.
- 홈과 원장에 건수 숫자를 크게 노출하지 않는다. 페이지당 H1은 하나다.

## 개인정보
- 공개 경로와 공개 테이블에 제보자 이름, 전화번호, 계정을 넣지 않는다.
- `SUPABASE_SERVICE_KEY`에 `VITE_` 접두사를 붙이지 않는다.
