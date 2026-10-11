-- 0008 문의(spec/0006-contact.md 2·3장). 두 번 실행해도 결과가 같다.
begin;

-- 문의(0006 명세). 공개 화면 어디에도 나오지 않는다. 관리자만 읽는다.
create table if not exists public.inquiries (
  id         text primary key default gen_random_uuid()::text,
  kind       text not null check (kind in ('question', 'suggestion', 'correction', 'privacy')),
  body       text not null,
  reply_to   text,                 -- 선택 동의한 경우에만 저장하는 회신 이메일
  ip_hash    text,                 -- 비율 제한용. 1일 뒤 파기
  mailed_at  timestamptz,          -- 운영자에게 메일을 보낸 시각. 한 번만 보낸다
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
-- Supabase 기본 권한으로 anon에 붙은 테이블 권한을 회수한다. 접수는 submit_inquiry로만 한다.
revoke all on public.inquiries from anon;
drop policy if exists inquiries_admin on public.inquiries;
create policy inquiries_admin on public.inquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.submit_inquiry(p_kind text, p_body text, p_reply_to text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  hdr json;
  ip text;
  h text;
  new_id text;
begin
  p_body := btrim(coalesce(p_body, ''));
  p_reply_to := nullif(btrim(coalesce(p_reply_to, '')), '');
  if p_kind is null or p_kind not in ('question', 'suggestion', 'correction', 'privacy') then
    raise exception '문의 종류를 골라 주세요' using errcode = '22023';
  end if;
  if char_length(p_body) < 10 or char_length(p_body) > 5000 then
    raise exception '내용은 10~5000자로 적어 주세요' using errcode = '22023';
  end if;
  if p_reply_to is not null and (char_length(p_reply_to) > 200 or p_reply_to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception '회신 이메일 형식이 맞지 않습니다' using errcode = '22023';
  end if;

  -- cf-connecting-ip는 Cloudflare가 덮어써서 요청자가 위조하지 못한다. 없으면 x-forwarded-for 첫 값.
  hdr := coalesce(current_setting('request.headers', true), '{}')::json;
  ip := coalesce(nullif(btrim(hdr ->> 'cf-connecting-ip'), ''),
                 btrim(split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1)));
  h := md5('desk-inquiry:' || coalesce(nullif(ip, ''), 'unknown'));
  if (select count(*) from public.inquiries where ip_hash = h and created_at > now() - interval '1 hour') >= 3 then
    raise exception '잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;
  if (select count(*) from public.inquiries where created_at > now() - interval '1 hour') >= 50 then
    raise exception '지금은 문의가 많아 잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;

  insert into public.inquiries (kind, body, reply_to, ip_hash) values (p_kind, p_body, p_reply_to, h)
    returning id into new_id;
  return new_id;
end $$;
revoke all on function public.submit_inquiry(text, text, text) from public;
grant execute on function public.submit_inquiry(text, text, text) to anon, authenticated;

-- 메일 발송용. 접수 10분 안이고 아직 보내지 않은 문의만 한 번 돌려준다. id(UUID)는 접수한 사람만 안다.
create or replace function public.claim_inquiry_mail(p_id text)
returns table (kind text, body text, reply_to text, created_at timestamptz)
language sql security definer set search_path = '' as $$
  update public.inquiries i set mailed_at = now()
    where i.id = p_id and i.mailed_at is null and i.created_at > now() - interval '10 minutes'
    returning i.kind, i.body, i.reply_to, i.created_at
$$;
revoke all on function public.claim_inquiry_mail(text) from public;
grant execute on function public.claim_inquiry_mail(text) to anon, authenticated;

-- 보유 기간이 지난 개인정보 파기. p_purged는 첨부 파일을 지운 제보 id다. 그중 아직 파기 대상인 행만 지운다.
-- 문의(0006): IP 변환값 1일, 문의 내용과 회신 이메일 1년.
create or replace function public.apply_retention(p_purged text[])
returns json language plpgsql security definer set search_path = '' as $$
declare
  n_ip int;
  n_contact int;
  n_tip int;
  n_inq_ip int;
  n_inq int;
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
  update public.inquiries set ip_hash = null
    where ip_hash is not null and created_at < now() - interval '1 day';
  get diagnostics n_inq_ip = row_count;
  delete from public.inquiries where created_at < now() - interval '1 year';
  get diagnostics n_inq = row_count;
  return json_build_object('ip_cleared', n_ip, 'contacts_cleared', n_contact, 'tips_deleted', n_tip,
                           'inquiry_ip_cleared', n_inq_ip, 'inquiries_deleted', n_inq);
end $$;
revoke all on function public.apply_retention(text[]) from public;
revoke execute on function public.apply_retention(text[]) from anon, authenticated;
grant execute on function public.apply_retention(text[]) to service_role;

commit;
