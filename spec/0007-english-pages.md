# 0007 영어 페이지 1단계 — 명세

- 의도: `intent/0007-english-pages.md`

## 1. 주소
| 한국어 | 영어 |
|---|---|
| `/` | `/en` |
| `/about` | `/en/about` |

- 두 영어 페이지는 사전 렌더링한다. `<html lang="en">`으로 낸다. 사이트맵에 넣는다.
- 짝이 있는 페이지는 머리에 `hreflang` 링크 세 개를 둔다: `ko`, `en`, `x-default`(한국어).

## 2. 언어 토글
- 상단 오른쪽에 둔다. 한국어 페이지에서는 "EN", 영어 페이지에서는 "한국어"다.
- 짝이 있으면 짝으로 간다. 짝이 없는 한국어 페이지에서는 `/en`으로 간다.

## 3. 영어 화면
- 영어 메인은 한국어 메인과 구조가 같다: 목적 문장과 면책 문장, 세 단계, 지도, 최근 기록, 네 층 카드.
- 기록의 주장, 장소, 출처는 번역하지 않는다(2단계에서 논의한다). 상태 라벨은 영어로 쓴다.
- 층 링크, 문의, 처리방침은 한국어 페이지로 간다. 링크 옆에 "(in Korean)"을 붙인다.
- 상태 라벨 영어: Document verified, Video verified, Material received, Claim only.
- 면책 문장 영어: "Status is an investigative classification, not a legal conclusion."

## 4. 완료 기준
- [ ] `dist/en.html`, `dist/en/about.html`이 `lang="en"`과 title, description, canonical, H1 하나, 첫 문단을 갖는다.
- [ ] 짝 페이지 네 개에 hreflang 링크가 있다.
- [ ] 토글이 짝 페이지로 이동한다(e2e).
