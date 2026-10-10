-- 0002 기록 값 채우기 검사. 0001, 0002 적용 뒤 실행한다.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from public.evidence where status in ('document', 'video_confirmed');
  if n > 0 then raise exception '0002가 상태를 document/video_confirmed로 올렸다: %건', n; end if;
  select count(*) into n from public.evidence where status is null;
  if n > 0 then raise exception 'status가 빈 행 %건', n; end if;
  if (select sources from public.evidence where id = 'ev-015') <> '[]'::jsonb then
    raise exception '입력 오류 출처(ㅣ)가 출처로 들어갔다';
  end if;
  if (select claim from public.evidence where id = 'ev-004') is not null then
    raise exception '잘린 주장(ev-004)을 채웠다';
  end if;
  if (select occurred_at from public.evidence where id = 'ev-002') <> '2026-05-29T14:37:00+09:00' then
    raise exception 'ev-002 occurred_at 매핑 오류';
  end if;
  if (select count(*) from public.admins) <> 1 then raise exception '운영자 관리자 등록 실패'; end if;
  raise notice 'ok: 0001, 0002 적용 결과';
end $$;
