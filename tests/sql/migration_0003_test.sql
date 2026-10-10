-- 0003 승인 반영 검사. 0001, 0002, 0003(두 번) 적용 뒤 실행한다.
\set ON_ERROR_STOP on
do $$
declare n int;
begin
  if (select claim from public.evidence where id = 'ev-004') not like '모의테스트(5월 28일)%' then
    raise exception 'ev-004 주장 미반영';
  end if;
  if (select published from public.evidence where id = 'ev-009') then
    raise exception 'ev-009가 아직 공개 상태다';
  end if;
  if (select count(*) from public.evidence where id = 'ev-009') <> 1 then
    raise exception 'ev-009를 지웠다. 비공개로만 돌려야 한다';
  end if;
  if (select occurred_at from public.evidence where id = 'ev-098') <> '2026-05-29T10:59:00+09:00' then
    raise exception 'ev-098 발생 시각 미반영';
  end if;
  if (select claim from public.evidence where id = 'ev-098') <> '사전투표소 내부 CCTV가 가려진 상태로 촬영됐다.' then
    raise exception 'ev-098 주장 미반영';
  end if;
  select count(*) into n from public.evidence
    where id = 'ev-012' and (description like '%○○○%' or title like '%○○○%' or claim like '%○○○%');
  if n > 0 then raise exception 'ev-012 과잉 마스킹이 남았다'; end if;
  if (select description from public.evidence where id = 'ev-025') not like '%○○○%' then
    raise exception 'ev-025는 이름일 수 있어 가린 채로 둬야 한다';
  end if;
  select count(*) into n from public.evidence where status in ('document', 'video_confirmed');
  if n > 0 then raise exception '0003이 상태를 올렸다'; end if;
  raise notice 'ok: 0003 적용 결과';
end $$;
