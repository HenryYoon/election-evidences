-- ======================================================================
-- 0015 관리자 신청과 두 단계 권한(spec/0015-admin-signup.md)
-- 운영자(owner)는 전부, 검수자(reviewer)는 기록 편집과 상태 변경만 한다.
-- 신청자는 초대 코드로 신청하고 운영자가 승인해야 검수자가 된다.
-- ======================================================================

-- 역할. 기본값 owner는 SQL로 직접 넣는 관리자(운영자)용이다. 승인 화면은 reviewer로 넣는다.
alter table public.admins add column if not exists role text not null default 'owner';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'reviewer'));

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'owner')
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- 신청과 초대 코드. 둘 다 함수로만 읽고 쓴다.
create table if not exists public.admin_requests (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  created_at  timestamptz not null default now()
);
alter table public.admin_requests enable row level security;
revoke all on public.admin_requests from anon, authenticated;

create schema if not exists private;
create table if not exists private.admin_invite (
  id          int primary key default 1 check (id = 1),
  code_hash   text not null,
  updated_at  timestamptz not null default now()
);
revoke all on private.admin_invite from anon, authenticated;

-- 내 상태: owner, reviewer, pending, 또는 null
create or replace function public.my_admin_status()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role from public.admins where user_id = auth.uid()),
    (select 'pending' from public.admin_requests where user_id = auth.uid())
  )
$$;

create or replace function public.request_admin(p_code text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception '이미 관리자입니다' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 50 then
    raise exception '이름을 1~50자로 적어 주세요' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.admin_invite
    where code_hash = encode(sha256(convert_to(btrim(coalesce(p_code, '')), 'UTF8')), 'hex')
  ) then
    raise exception '초대 코드가 맞지 않습니다' using errcode = '22023';
  end if;
  insert into public.admin_requests (user_id, name) values (auth.uid(), v_name)
    on conflict (user_id) do update set name = excluded.name;
end $$;

create or replace function public.set_admin_invite(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_code, ''))) < 10 then
    raise exception '초대 코드는 10자 이상이어야 합니다' using errcode = '22023';
  end if;
  insert into private.admin_invite (id, code_hash, updated_at)
    values (1, encode(sha256(convert_to(btrim(p_code), 'UTF8')), 'hex'), now())
    on conflict (id) do update set code_hash = excluded.code_hash, updated_at = excluded.updated_at;
end $$;

create or replace function public.clear_admin_invite()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  delete from private.admin_invite;
end $$;

create or replace function public.admin_invite_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner() and exists (select 1 from private.admin_invite)
$$;

create or replace function public.list_admin_requests()
returns table (user_id uuid, email text, name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  return query
    select r.user_id, u.email::text, r.name, r.created_at
    from public.admin_requests r join auth.users u on u.id = r.user_id
    order by r.created_at;
end $$;

create or replace function public.list_admins()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  return query
    select a.user_id, u.email::text, a.role, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end $$;

create or replace function public.approve_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  if not exists (select 1 from public.admin_requests where user_id = p_user) then
    raise exception '신청이 없습니다' using errcode = '22023';
  end if;
  insert into public.admins (user_id, role) values (p_user, 'reviewer') on conflict (user_id) do nothing;
  delete from public.admin_requests where user_id = p_user;
end $$;

create or replace function public.reject_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  delete from public.admin_requests where user_id = p_user;
end $$;

create or replace function public.set_admin_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  if p_role not in ('owner', 'reviewer') then raise exception '역할은 owner 또는 reviewer' using errcode = '22023'; end if;
  if p_role = 'reviewer' and (select count(*) from public.admins where role = 'owner' and user_id <> p_user) = 0 then
    raise exception '마지막 운영자는 내릴 수 없습니다' using errcode = '22023';
  end if;
  update public.admins set role = p_role where user_id = p_user;
end $$;

create or replace function public.revoke_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  if (select count(*) from public.admins where role = 'owner' and user_id <> p_user) = 0 then
    raise exception '마지막 운영자는 해제할 수 없습니다' using errcode = '22023';
  end if;
  delete from public.admins where user_id = p_user;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'my_admin_status()', 'request_admin(text, text)', 'set_admin_invite(text)', 'clear_admin_invite()',
    'admin_invite_active()', 'list_admin_requests()', 'list_admins()', 'approve_admin(uuid)',
    'reject_admin(uuid)', 'set_admin_role(uuid, text)', 'revoke_admin(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('revoke execute on function public.%s from anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 운영자 전용으로 좁힌다: 제보, 제보 연락처·원문, 문의, 제보 첨부, 기록 삭제
drop policy if exists tips_admin_all on public.tips;
create policy tips_admin_all on public.tips
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists tip_contacts_admin_all on public.tip_contacts;
create policy tip_contacts_admin_all on public.tip_contacts
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists inquiries_admin on public.inquiries;
create policy inquiries_admin on public.inquiries
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists tip_upload_admin on storage.objects;
create policy tip_upload_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'tip-uploads' and public.is_owner())
  with check (bucket_id = 'tip-uploads' and public.is_owner());

drop policy if exists evidence_admin_write on public.evidence;
drop policy if exists evidence_admin_insert on public.evidence;
create policy evidence_admin_insert on public.evidence
  for insert to authenticated with check (public.is_admin());
drop policy if exists evidence_admin_update on public.evidence;
create policy evidence_admin_update on public.evidence
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists evidence_owner_delete on public.evidence;
create policy evidence_owner_delete on public.evidence
  for delete to authenticated using (public.is_owner());

create or replace function public.finish_tip_review(p_tip text, p_review text, p_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception '운영자만 검수를 마칠 수 있습니다' using errcode = '42501';
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
