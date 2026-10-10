-- 0004 제보 접수·검수(0001 플랜 5단계). 0003 다음에 실행한다. 여러 번 실행해도 결과가 같다.
begin;

alter table public.tips add column if not exists occurred_text text not null default '';
alter table public.tips add column if not exists links text[] not null default '{}';
alter table public.tips add column if not exists review text not null default 'new';
alter table public.tips add column if not exists ip_hash text;
alter table public.tips add column if not exists evidence_id text references public.evidence (id) on delete set null;
alter table public.tips drop constraint if exists tips_review_check;
alter table public.tips add constraint tips_review_check check (review in ('new', 'accepted', 'rejected'));
create index if not exists tips_ip_recent_idx on public.tips (ip_hash, created_at);

-- 익명 읽기를 없앤다. 관리자 정책(tips_admin_all)만 남는다.
drop policy if exists tips_public_read on public.tips;

-- 접수: anon이 부르는 유일한 쓰기 경로. 테이블 쓰기 권한은 주지 않는다.
-- IP는 원문을 저장하지 않고 해시만 비율 제한에 쓴다.
create or replace function public.submit_tip(
  p_place text, p_occurred text, p_body text, p_links text[], p_name text, p_contact text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  ip text;
  h text;
  new_id text;
  l text;
begin
  p_place := btrim(coalesce(p_place, ''));
  p_occurred := btrim(coalesce(p_occurred, ''));
  p_body := btrim(coalesce(p_body, ''));
  p_links := coalesce(p_links, '{}');
  if char_length(p_place) < 2 or char_length(p_place) > 200 then
    raise exception '장소는 2~200자로 적어 주세요' using errcode = '22023';
  end if;
  if char_length(p_body) < 10 or char_length(p_body) > 5000 then
    raise exception '내용은 10~5000자로 적어 주세요' using errcode = '22023';
  end if;
  if char_length(p_occurred) > 200 or char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_contact, '')) > 200 then
    raise exception '입력이 너무 깁니다' using errcode = '22023';
  end if;
  if coalesce(array_length(p_links, 1), 0) > 5 then
    raise exception '링크는 5개까지 받습니다' using errcode = '22023';
  end if;
  foreach l in array p_links loop
    if l !~ '^https?://' or char_length(l) > 500 then
      raise exception '링크는 http(s) 주소여야 합니다' using errcode = '22023';
    end if;
  end loop;

  ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  h := md5('desk-tip:' || coalesce(nullif(ip, ''), 'unknown'));
  if (select count(*) from public.tips where ip_hash = h and created_at > now() - interval '1 hour') >= 5 then
    raise exception '잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tips where created_at > now() - interval '1 hour') >= 100 then
    raise exception '지금은 제보가 많아 잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;

  insert into public.tips (place_name, occurred_text, links, ip_hash, published, review)
    values (p_place, p_occurred, p_links, h, false, 'new')
    returning id into new_id;
  insert into public.tip_contacts (tip_id, body, name, contact)
    values (new_id, p_body, nullif(btrim(coalesce(p_name, '')), ''), nullif(btrim(coalesce(p_contact, '')), ''));
  return new_id;
end $$;
revoke all on function public.submit_tip(text, text, text, text[], text, text) from public;
grant execute on function public.submit_tip(text, text, text, text[], text, text) to anon, authenticated;

-- 검수 마감: 관리자만. 상태를 바꾸고 이름·연락처를 지운다(원문은 남긴다).
create or replace function public.finish_tip_review(p_tip text, p_review text, p_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 검수를 마칠 수 있습니다' using errcode = '42501';
  end if;
  if p_review not in ('accepted', 'rejected') then
    raise exception '검수 결과는 accepted 또는 rejected' using errcode = '22023';
  end if;
  update public.tips set review = p_review, evidence_id = p_evidence where id = p_tip;
  update public.tip_contacts set name = null, contact = null where tip_id = p_tip;
end $$;
revoke all on function public.finish_tip_review(text, text, text) from public;
grant execute on function public.finish_tip_review(text, text, text) to authenticated;

commit;
