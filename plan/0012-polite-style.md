# 0012 합니다체 통일 — 플랜

- 명세: `spec/0012-polite-style.md`

## 순서
| 단계 | 할 일 |
|---|---|
| 1 | 명세 1장 파일의 문장 어미를 바꾼다 |
| 2 | 면책 문장을 검사하는 테스트(`tests/unit/llms.test.ts`, `scripts/check-dist.mjs`)를 같은 커밋에서 고친다 |
| 3 | 홈 입구 링크의 `sub` 클래스와 `.home-doors a.sub` 규칙을 지운다 |
| 4 | 빌드, 단위, check-dist, e2e. 홈 하단을 Playwright로 열어 세 링크의 계산된 굵기·크기를 비교한다 |
