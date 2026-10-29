# 0015 관리자 신청과 두 단계 권한 — 명세

- 의도: `intent/0015-admin-signup.md`

## 1. 역할
| 역할 | 할 수 있는 것 |
|---|---|
| 운영자(`owner`) | 모든 것. 제보 검수·연락처·첨부, 문의, 기록 삭제, 관리자 승인·해제·역할 변경, 초대 코드 |
| 검수자(`reviewer`) | 기록 읽기(비공개 포함)·추가·수정, 상태 변경, 사진 올리기, 공개 HTML 갱신 |
| 승인 대기 | 없음 |

- `admins.role` 기본값은 `owner`다. SQL로 직접 넣는 관리자(운영자)를 위한 값이다. 승인 화면으로 들어온 사람은 `reviewer`로 들어간다.
- 마지막 운영자는 해제하거나 검수자로 내릴 수 없다.

## 2. 신청 흐름
1. 운영자가 관리 화면 "관리자" 탭에서 초대 코드를 만든다(12자, 브라우저가 무작위로 만든다). DB에는 SHA-256 값만 둔다. 코드는 만들 때 한 번만 보인다.
2. 운영자가 방에 `/admin/join` 링크와 코드를 올린다.
3. 신청자가 이름, 이메일, 비밀번호, 초대 코드를 넣는다. 가입 뒤 `request_admin(코드, 이름)`을 부른다. 코드가 틀리면 신청이 들어가지 않는다.
4. 운영자가 "관리자" 탭에서 신청을 승인하거나 거절한다. 승인하면 검수자가 된다.
5. 운영자는 초대 코드를 끌 수 있다. 끄면 새 신청을 받지 않는다.

- 가입 확인 메일이 켜져 있어 바로 로그인되지 않으면, 신청자는 메일 확인 뒤 `/admin`에 로그인해 같은 신청 칸을 채운다.

## 3. DB(마이그레이션 `20261027000000_admin_roles.sql`)
- `admins.role`(`owner` | `reviewer`), `admin_requests`(user_id, name, created_at), `private.admin_invite`(code_hash).
- 함수: `is_owner()`, `my_admin_status()`(owner·reviewer·pending·null), `request_admin`, `set_admin_invite`, `clear_admin_invite`, `list_admin_requests`, `list_admins`, `approve_admin`, `reject_admin`, `set_admin_role`, `revoke_admin`.
- 운영자만: `tips`, `tip_contacts`, `inquiries`, `tip-uploads` 저장소, `finish_tip_review`, `evidence` 삭제.
- 관리자(두 역할): `evidence` 읽기·추가·수정, `evidence-media` 저장소 쓰기, `is_admin()`을 쓰는 `api/rebuild.js`.

## 4. 화면
- `/admin/join`: 신청 폼.
- `/admin` 로그인 뒤: 역할이 없으면 신청 칸 또는 "승인 대기" 안내. 검수자는 기록 탭만 보이고 삭제 버튼이 없다. 운영자는 기록·제보 검수·문의·관리자 탭.

## 5. 처리방침
- 7장 안전성 확보 조치: "관리자 계정은 하나"를 고친다. 제보 원문·연락처·첨부·문의는 운영자만 읽는다고 적는다. 시행일과 변경 내역을 고친다.

## 6. 운영자 설정
- Supabase Authentication에서 신규 가입을 켠다.
- 가입 확인 메일을 켠다(운영자 결정, 2026-10-27). 확인 메일이 신청자에게 가려면 외부 SMTP가 필요하다. Supabase 기본 메일은 프로젝트 팀원에게만 간다.
- URL Configuration: Site URL은 운영 주소, Redirect URLs에 `<운영 주소>/admin`을 넣는다. 가입 화면은 `emailRedirectTo`로 `/admin`을 넘긴다.
- 확인 메일을 켜면 가입 직후 세션이 없다. 신청자는 메일 링크로 `/admin`에 돌아와 신청 칸(이름, 초대 코드)을 다시 채운다.

## 7. 이름 표시와 초대 코드 복사(운영자 결정, 2026-10-29)
- 로그인 아이디는 이메일이다. Supabase 인증은 이메일이나 전화번호가 필요하다. 아이디 로그인(가짜 주소)은 검토 뒤 쓰지 않기로 했다.
- 신청 목록과 관리자 목록에 이름과 이메일을 보인다. `admins.name`을 더하고 승인할 때 신청 이름을 옮긴다(마이그레이션 `20261029000000_admin_names.sql`).
- 초대 코드를 만들면 [코드 복사]와 [링크와 코드 복사] 버튼으로 클립보드에 담는다.
