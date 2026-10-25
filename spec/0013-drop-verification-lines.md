# 0013 검증 네 줄 빼기 — 명세

- 의도: `intent/0013-drop-verification-lines.md`

## 1. 빼는 곳
| 위치 | 내용 |
|---|---|
| 증거 상세(`/e/<id>`) | "검증" 소제목과 네 줄 |
| 증거 마크다운(`/e/<id>.md`) | `## 검증` 절 |
| 소개(한국어·영어) | "검증 네 줄" 절, 도움말 문구 |
| 소개 description, llms.txt | "검증 네 줄" 언급 |
| 관리 화면 | 검증 네 줄 입력칸 |

## 2. 남기는 것
- DB 칸 `verification`과 관리 저장 때 빈 값 정리(`normalizeLedgerDraft`).

## 3. 검사
- check-dist: 상세 HTML에 `<h2>검증</h2>`, 마크다운에 `## 검증`이 있으면 실패.
