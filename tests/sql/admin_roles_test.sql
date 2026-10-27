-- 0015 관리자 신청과 두 단계 권한. 운영자(o), 검수자(r), 신청자(p), 가입만 한 계정(x).
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'o@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'r@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'p@example.com'),
  ('00000000-0000-0000-0000-0000000000f4', 'x@example.com')
on conflict (id) do nothing;
delete from public.admins where user_id::text like '00000000-0000-0000-0000-0000000000f%';
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f1');           -- 기본값 owner
insert into public.admins (user_id, role) values ('00000000-0000-0000-0000-0000000000f2', 'reviewer');
insert into public.evidence (id, title, published) values ('ev-role', '역할 검사', false) on conflict do nothing;
insert into public.tips (id, place_name) values ('t-role', '역할 검사') on conflict do nothing;
insert into public.tip_contacts (tip_id, body, name, contact) values ('t-role', '원문', '이름', '010') on conflict do nothing;
insert into public.inquiries (id, kind, body) values ('q-role', 'question', '문의') on conflict do nothing;

create or replace function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got <> want then raise exception '역할 검사 실패: % (기대 %, 실제 %)', label, want, got; end if;
  raise notice 'ok: %', label;
end $$;
create or replace function pg_temp.denied(label text, q text) returns void language plpgsql as $$
begin
  execute q;
  raise exception '역할 검사 실패: % 가 막히지 않았다', label;
exception when insufficient_privilege or invalid_parameter_value then raise notice 'ok: % 거부', label;
end $$;

select pg_temp.expect('기존·직접 추가 관리자는 owner', (select count(*) from public.admins where user_id = '00000000-0000-0000-0000-0000000000f1' and role = 'owner'), 1);

-- 운영자: 초대 코드를 만든다
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.denied('짧은 초대 코드', $q$ select public.set_admin_invite('short') $q$);
select public.set_admin_invite('ABCD-EFGH-JKLM');
select pg_temp.expect('운영자는 초대 코드가 켜진 것을 본다', (select public.admin_invite_active()::int), 1);
reset role;
select pg_temp.expect('초대 코드는 해시로만 저장', (select count(*) from private.admin_invite where code_hash = 'ABCD-EFGH-JKLM'), 0);

-- 익명은 신청 함수를 부를 수 없다
set role anon;
select pg_temp.denied('anon 신청', $q$ select public.request_admin('ABCD-EFGH-JKLM', '익명') $q$);
reset role;

-- 신청자: 틀린 코드는 거부, 맞는 코드는 승인 대기
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select pg_temp.denied('틀린 초대 코드', $q$ select public.request_admin('WRONG-CODE-0000', '신청자') $q$);
select public.request_admin(' ABCD-EFGH-JKLM ', '신청자');
select pg_temp.expect('신청자는 pending', (select (public.my_admin_status() = 'pending')::int), 1);
select pg_temp.expect('신청자는 비공개 기록을 못 본다', (select count(*) from public.evidence where id = 'ev-role'), 0);
select pg_temp.denied('신청자의 승인 목록 조회', $q$ select * from public.list_admin_requests() $q$);
select pg_temp.denied('신청자의 자기 승인', $q$ select public.approve_admin('00000000-0000-0000-0000-0000000000f3') $q$);
do $$ begin
  insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');
  raise exception '역할 검사 실패: 신청자가 admins에 직접 넣었다';
exception when insufficient_privilege then raise notice 'ok: admins 직접 쓰기 거부';
end $$;

-- 가입만 한 계정: 아무 상태 없음, 비공개 데이터 없음
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select pg_temp.expect('가입만 한 계정의 상태는 null', (select (public.my_admin_status() is null)::int), 1);
select pg_temp.expect('가입만 한 계정은 비공개 기록을 못 본다', (select count(*) from public.evidence where id = 'ev-role'), 0);

-- 검수자: 기록 편집은 되고, 제보·연락처·문의·삭제·승인은 안 된다
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.expect('검수자 상태', (select (public.my_admin_status() = 'reviewer')::int), 1);
select pg_temp.expect('검수자는 비공개 기록을 본다', (select count(*) from public.evidence where id = 'ev-role'), 1);
update public.evidence set status = 'confirmed' where id = 'ev-role';
select pg_temp.expect('검수자는 상태를 바꾼다', (select count(*) from public.evidence where id = 'ev-role' and status = 'confirmed'), 1);
delete from public.evidence where id = 'ev-role';
select pg_temp.expect('검수자는 기록을 지우지 못한다', (select count(*) from public.evidence where id = 'ev-role'), 1);
select pg_temp.expect('검수자는 제보를 못 본다', (select count(*) from public.tips where id = 't-role'), 0);
select pg_temp.expect('검수자는 제보 원문·연락처를 못 본다', (select count(*) from public.tip_contacts where tip_id = 't-role'), 0);
select pg_temp.expect('검수자는 문의를 못 본다', (select count(*) from public.inquiries where id = 'q-role'), 0);
select pg_temp.denied('검수자의 검수 마감', $q$ select public.finish_tip_review('t-role', 'rejected', null) $q$);
select pg_temp.denied('검수자의 승인', $q$ select public.approve_admin('00000000-0000-0000-0000-0000000000f3') $q$);
select pg_temp.denied('검수자의 초대 코드 변경', $q$ select public.set_admin_invite('NEWCODE-123456') $q$);

-- 운영자: 신청을 보고 승인한다. 승인된 사람은 검수자다
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.expect('운영자는 신청 목록을 본다', (select count(*) from public.list_admin_requests() where email = 'p@example.com'), 1);
select pg_temp.expect('운영자는 제보 원문·연락처를 본다', (select count(*) from public.tip_contacts where tip_id = 't-role'), 1);
select pg_temp.expect('운영자는 문의를 본다', (select count(*) from public.inquiries where id = 'q-role'), 1);
select public.approve_admin('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect('승인하면 신청이 사라진다', (select count(*) from public.list_admin_requests()), 0);
select pg_temp.expect('승인된 사람은 reviewer', (select count(*) from public.list_admins() where email = 'p@example.com' and role = 'reviewer'), 1);
-- 앞선 검사 파일이 만든 운영자를 치워 f1을 마지막 운영자로 만든다
reset role;
delete from public.admins where role = 'owner' and user_id <> '00000000-0000-0000-0000-0000000000f1';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.denied('마지막 운영자 내리기', $q$ select public.set_admin_role('00000000-0000-0000-0000-0000000000f1', 'reviewer') $q$);
select pg_temp.denied('마지막 운영자 해제', $q$ select public.revoke_admin('00000000-0000-0000-0000-0000000000f1') $q$);
select public.revoke_admin('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect('해제하면 관리자 목록에서 빠진다', (select count(*) from public.list_admins() where email = 'p@example.com'), 0);
select public.clear_admin_invite();
select pg_temp.expect('초대 코드를 끄면 꺼진 상태', (select public.admin_invite_active()::int), 0);
delete from public.evidence where id = 'ev-role';
select pg_temp.expect('운영자는 기록을 지운다', (select count(*) from public.evidence where id = 'ev-role'), 0);

-- 코드를 끈 뒤에는 신청이 들어가지 않는다
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select pg_temp.denied('꺼진 초대 코드로 신청', $q$ select public.request_admin('ABCD-EFGH-JKLM', '늦은 신청') $q$);
reset role;
