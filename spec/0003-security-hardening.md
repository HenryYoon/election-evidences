# 0003 보안 점검과 보강 — 명세

- 의도: `intent/0003-security-hardening.md`

## 1. 보안 헤더
- 모든 경로에 다음 헤더를 보낸다.
  | 헤더 | 값 |
  |---|---|
  | `X-Content-Type-Options` | `nosniff` |
  | `Referrer-Policy` | `strict-origin-when-cross-origin` |
  | `X-Frame-Options` | `DENY` |
  | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
  | `Content-Security-Policy` | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` |
- CSP는 스크립트 출처를 제한하지 않는다. 사전 렌더링 HTML에 인라인 스크립트(스냅샷, JSON-LD)가 있어서 해시 관리가 먼저 필요하다. 이후 작업으로 둔다.
- 주기 점검(`check-live`)은 홈에서 `X-Content-Type-Options`와 `X-Frame-Options`를 확인한다.

## 2. 제보 비율 제한의 IP
- `submit_tip`은 `cf-connecting-ip` 헤더를 먼저 쓴다. Cloudflare가 이 헤더를 덮어쓰므로 요청자가 위조하지 못한다.
- `cf-connecting-ip`가 없으면 `x-forwarded-for`의 첫 값을 쓴다.
- IP 원문은 저장하지 않는다(기존과 같다).

## 3. 스토리지 목록 조회
- `evidence-media` 버킷의 공개 읽기 정책(`media_public_read`)을 지운다.
- 버킷은 공개(public)로 둔다. 공개 버킷의 `/object/public/` 주소는 정책 없이 열린다.
- anon은 객체 목록을 조회하지 못한다. 관리자는 `media_admin_write`로 계속 읽고 쓴다.

## 4. 함수 search_path
- `touch_updated_at`에 `search_path = ''`를 둔다.

## 5. 운영자가 할 일
- Supabase Auth의 비밀번호 기준을 올린다(최소 12자, 숫자·대소문자·기호). 유출 비밀번호 차단(leaked password protection)은 Pro 플랜 기능이라 Free 플랜에서 켤 수 없다. 계정이 관리자뿐이므로 강한 고유 비밀번호로 대신한다.
- Supabase Auth의 신규 가입(Allow new users to sign up)이 꺼져 있는지 확인한다.
