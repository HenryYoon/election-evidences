-- 0015 명세 7장: 관리자 이름. 승인할 때 신청 이름을 옮긴다.
alter table public.admins add column if not exists name text;

create or replace function public.approve_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  select name into v_name from public.admin_requests where user_id = p_user;
  if not found then
    raise exception '신청이 없습니다' using errcode = '22023';
  end if;
  insert into public.admins (user_id, role, name) values (p_user, 'reviewer', v_name) on conflict (user_id) do nothing;
  delete from public.admin_requests where user_id = p_user;
end $$;

-- 반환 열이 바뀌어 지우고 다시 만든다.
drop function if exists public.list_admins();
create function public.list_admins()
returns table (user_id uuid, email text, name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception '운영자만 할 수 있습니다' using errcode = '42501'; end if;
  return query
    select a.user_id, u.email::text, a.name, a.role, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id
    order by a.created_at;
end $$;
revoke all on function public.list_admins() from public;
revoke execute on function public.list_admins() from anon;
grant execute on function public.list_admins() to authenticated;
