-- 0007 개인정보 보유 기간과 파기(spec/0005-privacy-consent.md 1·4장). 두 번 실행해도 결과가 같다.
begin;

-- 검수 마감. 기각하면 원문·이름·연락처를 지우고 장소·시각·링크를 비운다(0005 명세 4장).
-- 채택하면 이름·연락처만 지운다. 첨부 파일은 관리자 화면이 Storage API로 먼저 지운다.
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
  if p_review = 'rejected' then
    delete from public.tip_contacts where tip_id = p_tip;
    update public.tips set place_name = '', occurred_text = '', links = '{}', ip_hash = null where id = p_tip;
  else
    update public.tip_contacts set name = null, contact = null where tip_id = p_tip;
  end if;
end $$;
revoke all on function public.finish_tip_review(text, text, text) from public;
revoke execute on function public.finish_tip_review(text, text, text) from anon;
grant execute on function public.finish_tip_review(text, text, text) to authenticated;

-- 파기 대상 제보: 검수 없이 1년 지난 제보, 기각한 제보, 기록이 사라진 채택 제보.
-- 매일 retention.yml이 이 목록의 첨부 파일을 지운 뒤 apply_retention을 부른다.
create or replace function public.retention_due_tips()
returns setof text language sql stable security definer set search_path = '' as $$
  select t.id from public.tips t
  where (t.review = 'new' and t.created_at < now() - interval '1 year')
     or t.review = 'rejected'
     or (t.review = 'accepted' and not exists (select 1 from public.evidence e where e.id = t.evidence_id))
$$;
revoke all on function public.retention_due_tips() from public;
revoke execute on function public.retention_due_tips() from anon, authenticated;
grant execute on function public.retention_due_tips() to service_role;

-- 보유 기간이 지난 개인정보 파기. p_purged는 첨부 파일을 지운 제보 id다. 그중 아직 파기 대상인 행만 지운다.
create or replace function public.apply_retention(p_purged text[])
returns json language plpgsql security definer set search_path = '' as $$
declare
  n_ip int;
  n_contact int;
  n_tip int;
begin
  update public.tips set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '1 day';
  get diagnostics n_ip = row_count;
  update public.tip_contacts tc set name = null, contact = null
    from public.tips t
    where t.id = tc.tip_id and t.created_at < now() - interval '90 days'
      and (tc.name is not null or tc.contact is not null);
  get diagnostics n_contact = row_count;
  delete from public.tips t
    where t.id = any(coalesce(p_purged, '{}'))
      and t.id in (select public.retention_due_tips());
  get diagnostics n_tip = row_count;
  return json_build_object('ip_cleared', n_ip, 'contacts_cleared', n_contact, 'tips_deleted', n_tip);
end $$;
revoke all on function public.apply_retention(text[]) from public;
revoke execute on function public.apply_retention(text[]) from anon, authenticated;
grant execute on function public.apply_retention(text[]) to service_role;

commit;
