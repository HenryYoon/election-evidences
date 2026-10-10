-- 보안 보강 검사(spec/0003-security-hardening.md). 스키마 또는 0005 적용 뒤 실행한다.
\set ON_ERROR_STOP on

-- x-forwarded-for 첫 값을 바꿔도 cf-connecting-ip가 같으면 같은 사람으로 센다
set role anon;
do $$
declare i int;
begin
  for i in 1..5 loop
    perform set_config('request.headers',
      json_build_object('cf-connecting-ip', '192.0.2.44', 'x-forwarded-for', '10.9.9.' || i || ', 192.0.2.44')::text, false);
    perform public.submit_tip('중구 테스트', '', 'x-forwarded-for를 바꿔 보낸 제보입니다.', '{}', null, null);
  end loop;
  perform set_config('request.headers',
    '{"cf-connecting-ip": "192.0.2.44", "x-forwarded-for": "10.9.9.99, 192.0.2.44"}', false);
  begin
    perform public.submit_tip('중구 테스트', '', '여섯 번째 제보는 거절되어야 합니다.', '{}', null, null);
    raise exception 'x-forwarded-for 위조로 비율 제한을 우회했다';
  exception when sqlstate 'P0001' then raise notice 'ok: 비율 제한은 cf-connecting-ip 기준';
  end;
end $$;
reset role;

do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_public_read') then
    raise exception 'anon이 스토리지 객체 목록을 조회할 수 있다(media_public_read)';
  end if;
  raise notice 'ok: 스토리지 공개 읽기 정책 없음';
end $$;

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'touch_updated_at' and 'search_path=""' = any(proconfig)) then
    raise exception 'touch_updated_at에 search_path가 없다';
  end if;
  raise notice 'ok: touch_updated_at search_path 고정';
end $$;
