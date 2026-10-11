-- 보유 기간과 파기 검사(spec/0005 1·4장). 스키마 또는 0007 적용 뒤 실행한다.
\set ON_ERROR_STOP on

do $$ begin
  if has_function_privilege('anon', 'public.retention_due_tips()', 'execute')
     or has_function_privilege('authenticated', 'public.retention_due_tips()', 'execute')
     or has_function_privilege('anon', 'public.apply_retention(text[])', 'execute')
     or has_function_privilege('authenticated', 'public.apply_retention(text[])', 'execute') then
    raise exception 'anon이나 authenticated가 파기 함수를 부를 수 있다';
  end if;
  if not has_function_privilege('service_role', 'public.apply_retention(text[])', 'execute') then
    raise exception 'service_role이 파기 함수를 못 부른다';
  end if;
  raise notice 'ok: 파기 함수는 service_role만 부른다';
end $$;

-- 기각하면 원문·이름·연락처를 지우고 장소·시각·링크를 비운다
insert into public.tips (id, place_name, occurred_text, links, ip_hash, review)
  values ('r-reject', '중구 기각 테스트', '오후', array['https://a.example'], 'h', 'new');
insert into public.tip_contacts (tip_id, body, name, contact) values ('r-reject', '기각할 원문', '자리표시', '010');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.finish_tip_review('r-reject', 'rejected', null);
reset role;
reset request.jwt.claim.sub;
do $$ begin
  if exists (select 1 from public.tip_contacts where tip_id = 'r-reject') then raise exception '기각한 제보의 원문이 남았다'; end if;
  if exists (select 1 from public.tips where id = 'r-reject' and (place_name <> '' or occurred_text <> '' or links <> '{}' or ip_hash is not null)) then
    raise exception '기각한 제보의 장소·시각·링크가 남았다';
  end if;
  raise notice 'ok: 기각하면 원문과 연락처를 지운다';
end $$;

-- 보유 기간별 제보
insert into public.tips (id, place_name, ip_hash, review, created_at, evidence_id) values
  ('r-fresh', '방금', 'h1', 'new', now(), null),
  ('r-2days', '이틀 전', 'h2', 'new', now() - interval '2 days', null),
  ('r-100days', '100일 전', null, 'new', now() - interval '100 days', null),
  ('r-2years', '2년 전', null, 'new', now() - interval '2 years', null),
  ('r-acc-gone', '기록 삭제됨', null, 'accepted', now() - interval '10 days', null),  -- 기록을 지우면 on delete set null
  ('r-acc-live', '기록 있음', null, 'accepted', now() - interval '10 days', (select id from public.evidence limit 1));
insert into public.tip_contacts (tip_id, body, name, contact) values
  ('r-fresh', '원문', '이름', '연락처'),
  ('r-100days', '원문', '이름', '연락처'),
  ('r-2years', '원문', '이름', '연락처');

do $$
declare due text[] := array(select public.retention_due_tips());
begin
  if (select id from public.evidence limit 1) is null then raise exception '검사용 기록이 없다'; end if;
  if not (due @> array['r-reject', 'r-2years', 'r-acc-gone']) then raise exception '파기 대상 누락: %', due; end if;
  if due && array['r-fresh', 'r-2days', 'r-100days', 'r-acc-live'] then raise exception '파기 대상이 아닌 제보가 들어갔다: %', due; end if;
  raise notice 'ok: 파기 대상은 기각, 1년 지난 미검수, 기록이 사라진 채택';
end $$;

do $$
declare r json := public.apply_retention(array['r-reject', 'r-2years', 'r-acc-gone', 'r-fresh']);
begin
  if exists (select 1 from public.tips where id in ('r-reject', 'r-2years', 'r-acc-gone')) then raise exception '파기 대상 행이 남았다'; end if;
  if exists (select 1 from public.tip_contacts where tip_id = 'r-2years') then raise exception '파기한 제보의 원문이 남았다'; end if;
  if not exists (select 1 from public.tips where id = 'r-fresh') then raise exception '파기 대상이 아닌 제보를 지웠다'; end if;
  raise notice 'ok: 첨부를 지운 파기 대상만 지운다 %', r;
end $$;

do $$ begin
  if (select ip_hash from public.tips where id = 'r-fresh') is null then raise exception '1일이 안 된 IP 변환값을 지웠다'; end if;
  if (select ip_hash from public.tips where id = 'r-2days') is not null then raise exception '1일 지난 IP 변환값이 남았다'; end if;
  raise notice 'ok: IP 변환값은 1일 보관';
  if (select name from public.tip_contacts where tip_id = 'r-fresh') is null then raise exception '90일이 안 된 연락처를 지웠다'; end if;
  if exists (select 1 from public.tip_contacts where tip_id = 'r-100days' and (name is not null or contact is not null)) then
    raise exception '90일 지난 연락처가 남았다';
  end if;
  if (select body from public.tip_contacts where tip_id = 'r-100days') is null then raise exception '90일 지난 미검수 제보의 원문까지 지웠다'; end if;
  raise notice 'ok: 이름·연락처는 90일 보관, 원문은 1년';
end $$;

delete from public.tips where id like 'r-%';
