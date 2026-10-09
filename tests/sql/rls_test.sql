-- RLS 검사(REVIEW.md 3단계). 기대와 다르면 예외를 던져 psql이 실패한다.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.admins values ('00000000-0000-0000-0000-000000000001');
insert into public.evidence (id, title, published) values ('ev-pub', '공개', true), ('ev-priv', '비공개', false);
insert into public.tips (id, place_name, published) values ('t-pub', '공개 제보', true), ('t-priv', '검수 전', false);
insert into public.tip_contacts (tip_id, body, name, contact) values ('t-priv', '원문', '이름', '010-0000-0000');
insert into public.analyses (id, title, question, period, universe, method, source_table, geo, published)
  values ('a-priv', 't', 'q', 'p', 'u', '["1","2","3","4"]', 's', 'choropleth', false);
insert into public.analysis_rows (analysis_id, area, value, unit) values ('a-priv', '구역', 1, '건');

create function pg_temp.expect(label text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got <> want then raise exception 'RLS 실패: % (기대 %, 실제 %)', label, want, got; end if;
  raise notice 'ok: %', label;
end $$;

-- 익명
set role anon;
select pg_temp.expect('anon은 공개 원장만 본다', (select count(*) from public.evidence), 1);
select pg_temp.expect('anon은 공개 제보만 본다', (select count(*) from public.tips), 1);
select pg_temp.expect('anon은 비공개 분석의 행을 못 본다', (select count(*) from public.analysis_rows), 0);
do $$ begin
  perform 1 from public.tip_contacts;
  raise exception 'RLS 실패: anon이 tip_contacts를 조회했다';
exception when insufficient_privilege then raise notice 'ok: anon은 tip_contacts 조회 거부';
end $$;
do $$ begin
  insert into public.tips (place_name) values ('anon 쓰기');
  raise exception 'RLS 실패: anon이 tips에 썼다';
exception when insufficient_privilege then raise notice 'ok: anon은 tips 쓰기 거부';
end $$;
reset role;

-- 로그인했지만 admins에 없는 계정
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect('비관리자는 tip_contacts를 못 본다', (select count(*) from public.tip_contacts), 0);
select pg_temp.expect('비관리자는 비공개 원장을 못 본다', (select count(*) from public.evidence where not published), 0);
do $$ begin
  update public.evidence set status = 'document' where id = 'ev-pub';
  if found then raise exception 'RLS 실패: 비관리자가 상태를 바꿨다'; end if;
  raise notice 'ok: 비관리자는 원장 수정 불가';
end $$;
do $$ begin
  perform 1 from public.admins;
  raise exception 'RLS 실패: 비관리자가 admins를 조회했다';
exception when insufficient_privilege then raise notice 'ok: admins 직접 조회 거부';
end $$;

-- 관리자
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.expect('관리자는 tip_contacts를 본다', (select count(*) from public.tip_contacts), 1);
select pg_temp.expect('관리자는 비공개 원장도 본다', (select count(*) from public.evidence), 2);
reset role;

-- 제약
do $$ begin
  update public.evidence set status = 'confirmed' where id = 'ev-pub';
  raise exception '제약 실패: 정의되지 않은 상태가 저장됐다';
exception when check_violation then raise notice 'ok: status check 제약';
end $$;
