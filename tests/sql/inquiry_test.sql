-- 문의 검사(spec/0006 2·3장). 스키마 또는 0008 적용 뒤 실행한다.
\set ON_ERROR_STOP on
create temp table t_inq (id text);
grant all on t_inq to anon;

set role anon;
select set_config('request.headers', '{"cf-connecting-ip": "192.0.2.90"}', false);
insert into t_inq select public.submit_inquiry('correction', '기록 주소와 틀린 부분을 적은 정정 요청입니다.', 'reader@example.com');
do $$ begin
  perform 1 from public.inquiries;
  raise exception 'anon이 문의를 읽었다';
exception when insufficient_privilege then raise notice 'ok: anon은 문의 테이블을 읽지 못한다';
end $$;
do $$ begin
  perform public.submit_inquiry('spam', '열 글자가 넘는 내용입니다.', null);
  raise exception '없는 종류를 받았다';
exception when sqlstate '22023' then raise notice 'ok: 종류 검사';
end $$;
do $$ begin
  perform public.submit_inquiry('question', '열 글자가 넘는 내용입니다.', 'not-an-email');
  raise exception '잘못된 이메일을 받았다';
exception when sqlstate '22023' then raise notice 'ok: 회신 이메일 형식 검사';
end $$;
do $$ begin
  perform public.submit_inquiry('question', '두 번째 문의 내용입니다.', null);
  perform public.submit_inquiry('question', '세 번째 문의 내용입니다.', null);
  begin
    perform public.submit_inquiry('question', '네 번째 문의는 거절되어야 합니다.', null);
    raise exception '문의 비율 제한 실패';
  exception when sqlstate 'P0001' then raise notice 'ok: IP당 1시간 3건 제한';
  end;
end $$;

-- 메일 발송용 조회는 한 번만 내용을 돌려준다
do $$
declare r record;
declare n int;
begin
  select * into r from public.claim_inquiry_mail((select id from t_inq));
  if r.kind <> 'correction' or r.reply_to <> 'reader@example.com' then raise exception '발송용 조회 내용이 다르다'; end if;
  select count(*) into n from public.claim_inquiry_mail((select id from t_inq));
  if n <> 0 then raise exception '같은 문의를 두 번 돌려줬다'; end if;
  select count(*) into n from public.claim_inquiry_mail('00000000-0000-0000-0000-000000000000');
  if n <> 0 then raise exception '없는 문의를 돌려줬다'; end if;
  raise notice 'ok: 발송용 조회는 한 번만';
end $$;
reset role;

update public.inquiries set created_at = now() - interval '11 minutes', mailed_at = null where id = (select id from t_inq);
set role anon;
do $$ begin
  if (select count(*) from public.claim_inquiry_mail((select id from t_inq))) <> 0 then raise exception '10분 지난 문의를 돌려줬다'; end if;
  raise notice 'ok: 접수 10분 뒤에는 발송용 조회 불가';
end $$;
reset role;

-- 관리자만 읽는다
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if exists (select 1 from public.inquiries) then raise exception '비관리자가 문의를 읽었다'; end if;
  raise notice 'ok: 비관리자는 문의를 읽지 못한다';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from public.inquiries) < 3 then raise exception '관리자가 문의를 못 읽는다'; end if;
  update public.inquiries set handled = true;
  raise notice 'ok: 관리자는 문의를 읽고 처리 표시한다';
end $$;
reset role;
reset request.jwt.claim.sub;

-- 보유 기간: IP 변환값 1일, 문의 1년
update public.inquiries set created_at = now() - interval '2 days' where id = (select id from t_inq);
insert into public.inquiries (kind, body, created_at) values ('question', '1년 넘은 문의', now() - interval '13 months');
do $$
declare r json := public.apply_retention('{}');
begin
  if (select ip_hash from public.inquiries where id = (select id from t_inq)) is not null then raise exception '1일 지난 문의 IP가 남았다'; end if;
  if exists (select 1 from public.inquiries where body = '1년 넘은 문의') then raise exception '1년 지난 문의가 남았다'; end if;
  if not exists (select 1 from public.inquiries where id = (select id from t_inq)) then raise exception '1년이 안 된 문의를 지웠다'; end if;
  raise notice 'ok: 문의 IP 1일, 문의 1년 보관 %', r;
end $$;
delete from public.inquiries;
