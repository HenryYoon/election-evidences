-- 제보 접수·검수 검사(0001 플랜 5단계). 스키마 또는 0004 적용 뒤 실행한다.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
insert into public.admins values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing;

-- 익명 접수
set role anon;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', false);
do $$
declare id text;
begin
  id := public.submit_tip('종로구 테스트 투표소', '6월 3일 오후', '투표함 봉인지가 뜯겨 있었다는 내용입니다.', array['https://example.com/a'], '자리표시', '010-0000-0000');
  if id is null then raise exception '접수 실패'; end if;
  raise notice 'ok: anon 접수';
end $$;
do $$ begin
  perform 1 from public.tips;
  if found then raise exception '접수한 제보가 anon에게 보인다'; end if;
  raise notice 'ok: 접수한 제보는 anon에게 안 보인다';
end $$;
do $$ begin
  perform public.submit_tip('종로구', '', '짧다', '{}', null, null);
  raise exception '짧은 본문을 받았다';
exception when sqlstate '22023' then raise notice 'ok: 본문 길이 검사';
end $$;
do $$ begin
  perform public.submit_tip('종로구', '', '열 글자가 넘는 본문입니다.', array['javascript:alert(1)'], null, null);
  raise exception 'http(s)가 아닌 링크를 받았다';
exception when sqlstate '22023' then raise notice 'ok: 링크 검사';
end $$;
do $$
declare i int;
begin
  for i in 1..4 loop
    perform public.submit_tip('종로구', '', '같은 사람이 여러 번 보낸 제보입니다.', '{}', null, null);
  end loop;
  begin
    perform public.submit_tip('종로구', '', '여섯 번째 제보는 거절되어야 합니다.', '{}', null, null);
    raise exception '비율 제한 실패: 같은 IP의 6번째 제보를 받았다';
  exception when sqlstate 'P0001' then raise notice 'ok: IP당 시간당 5건 제한';
  end;
end $$;
-- 다른 IP는 받는다
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.9"}', false);
do $$ begin
  perform public.submit_tip('종로구', '', '다른 사람이 보낸 제보는 받아야 합니다.', '{}', null, null);
  raise notice 'ok: 다른 IP는 받는다';
end $$;
do $$ begin
  perform public.finish_tip_review('x', 'rejected', null);
  raise exception 'anon이 검수를 마쳤다';
exception when sqlstate '42501' then raise notice 'ok: anon은 검수 마감 불가';
end $$;
reset role;

do $$ begin
  if has_function_privilege('anon', 'public.finish_tip_review(text,text,text)', 'execute') then
    raise exception 'anon에 finish_tip_review 실행 권한이 있다';
  end if;
  raise notice 'ok: anon은 finish_tip_review 실행 권한이 없다';
end $$;
do $$ begin
  if exists (select 1 from public.tips where ip_hash like '%203.0.113.7%') then raise exception 'IP 원문이 저장됐다'; end if;
  raise notice 'ok: IP 원문을 저장하지 않는다';
end $$;

-- 비관리자는 검수를 마칠 수 없다
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  perform public.finish_tip_review((select id from public.tips limit 1), 'rejected', null);
  raise exception '비관리자가 검수를 마쳤다';
exception when sqlstate '42501' then raise notice 'ok: 비관리자는 검수 마감 불가';
end $$;

-- 관리자는 검수를 마치고, 이름·연락처가 지워진다
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare t text;
begin
  select tip_id into t from public.tip_contacts where contact = '010-0000-0000' limit 1;
  perform public.finish_tip_review(t, 'accepted', null);
  if (select review from public.tips where id = t) <> 'accepted' then raise exception '검수 상태 미반영'; end if;
  if (select contact from public.tip_contacts where tip_id = t) is not null then raise exception '연락처가 남았다'; end if;
  if (select body from public.tip_contacts where tip_id = t) is null then raise exception '원문까지 지웠다'; end if;
  raise notice 'ok: 검수 마감 뒤 연락처 삭제, 원문 유지';
end $$;
reset role;
