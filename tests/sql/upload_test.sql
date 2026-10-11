-- 제보 첨부 파일 업로드 검사(spec/0004 3장). 스키마 또는 0006 적용 뒤 실행한다.
\set ON_ERROR_STOP on
create temp table t_tip (id text);
grant all on t_tip to anon;

set role anon;
select set_config('request.headers', '{"cf-connecting-ip": "192.0.2.77"}', false);
insert into t_tip select public.submit_tip('서초구 업로드 테스트', '', '첨부 파일과 함께 보낸 제보입니다.', '{}', null, null);

do $$
declare tip text := (select id from t_tip);
declare i int;
begin
  for i in 1..5 loop
    insert into storage.objects (bucket_id, name) values ('tip-uploads', tip || '/' || i || '.jpg');
  end loop;
  raise notice 'ok: 접수한 제보에 파일 5개';
  begin
    insert into storage.objects (bucket_id, name) values ('tip-uploads', tip || '/6.jpg');
    raise exception '제보당 5개 제한 실패';
  exception when insufficient_privilege then raise notice 'ok: 제보당 5개 제한';
  end;
end $$;

do $$
declare tip text := (select id from t_tip);
declare bad text;
begin
  foreach bad in array array[
    tip || '/1.exe', tip || '/../x.jpg', tip || '/a/1.jpg', 'x/1.jpg',
    '00000000-0000-0000-0000-000000000000/1.jpg'
  ] loop
    begin
      insert into storage.objects (bucket_id, name) values ('tip-uploads', bad);
      raise exception '잘못된 경로를 받았다: %', bad;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'ok: 형식이 다른 경로, 없는 제보는 거절';
end $$;

do $$ begin
  perform 1 from storage.objects where bucket_id = 'tip-uploads';
  if found then raise exception 'anon이 첨부 파일 목록을 본다'; end if;
  raise notice 'ok: anon은 첨부 파일을 읽지 못한다';
end $$;
do $$ begin
  update storage.objects set name = name where bucket_id = 'tip-uploads';
  delete from storage.objects where bucket_id = 'tip-uploads';
  reset role;
  if (select count(*) from storage.objects where bucket_id = 'tip-uploads') <> 5 then
    raise exception 'anon이 첨부 파일을 바꾸거나 지웠다';
  end if;
  raise notice 'ok: anon은 첨부 파일을 바꾸거나 지우지 못한다';
end $$;
reset role;

-- 접수 30분이 지났거나 검수가 끝난 제보에는 올리지 못한다
create temp table t_tip2 (id text);
grant all on t_tip2 to anon;
set role anon;
select set_config('request.headers', '{"cf-connecting-ip": "192.0.2.78"}', false);
insert into t_tip2 select public.submit_tip('서초구 업로드 테스트', '', '두 번째 업로드 테스트 제보입니다.', '{}', null, null);
reset role;
update public.tips set created_at = now() - interval '31 minutes' where id = (select id from t_tip2);
set role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('tip-uploads', (select id from t_tip2) || '/1.png');
  raise exception '30분이 지난 제보에 올렸다';
exception when insufficient_privilege then raise notice 'ok: 접수 30분 뒤 업로드 거절';
end $$;
reset role;
update public.tips set created_at = now(), review = 'rejected' where id = (select id from t_tip2);
set role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('tip-uploads', (select id from t_tip2) || '/1.png');
  raise exception '검수가 끝난 제보에 올렸다';
exception when insufficient_privilege then raise notice 'ok: 검수가 끝난 제보 업로드 거절';
end $$;
reset role;

-- 버킷 전체 상한: 1시간 60개, 누적 500MB
update public.tips set review = 'new' where id = (select id from t_tip2);
insert into storage.objects (bucket_id, name, metadata)
  select 'tip-uploads', 'filler/' || g || '.jpg', '{"size": 1000}' from generate_series(1, 55) g;
set role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('tip-uploads', (select id from t_tip2) || '/1.png');
  raise exception '1시간 60개 상한 실패';
exception when insufficient_privilege then raise notice 'ok: 버킷 1시간 60개 상한';
end $$;
reset role;
update storage.objects set created_at = now() - interval '2 hours' where name like 'filler/%';
update storage.objects set metadata = '{"size": 524288000}' where name = 'filler/1.jpg';
set role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('tip-uploads', (select id from t_tip2) || '/1.png');
  raise exception '누적 500MB 상한 실패';
exception when insufficient_privilege then raise notice 'ok: 버킷 누적 500MB 상한';
end $$;
reset role;
delete from storage.objects where name like 'filler/%';
set role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('tip-uploads', (select id from t_tip2) || '/1.png');
  raise notice 'ok: 상한 아래로 내려가면 다시 받는다';
end $$;
reset role;

-- 관리자는 첨부 파일을 본다
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'tip-uploads') < 6 then raise exception '관리자가 첨부 파일을 못 본다'; end if;
  raise notice 'ok: 관리자는 첨부 파일을 본다';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'tip-uploads') then raise exception '비관리자가 첨부 파일을 본다'; end if;
  raise notice 'ok: 비관리자는 첨부 파일을 못 본다';
end $$;
reset role;
reset request.jwt.claim.sub;
delete from storage.objects where bucket_id = 'tip-uploads';
