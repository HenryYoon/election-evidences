-- 0006 제보 첨부 파일 업로드(spec/0004-purpose-and-tip-upload.md 3장). 두 번 실행해도 결과가 같다.
begin;

-- 제보 첨부 파일 버킷: 비공개. 파일당 20MB, 사진·영상·PDF만.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tip-uploads', 'tip-uploads', false, 20971520,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 업로드 허용 검사. API로 노출되지 않는 private 스키마에 둔다.
-- 경로: <제보 id>/<순번>.<확장자>. 접수 30분 안, 검수 전, 제보당 5개, 버킷 1시간 60개, 누적 500MB.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
create or replace function private.tip_upload_ok(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  tip text;
begin
  if p_name is null
     or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,2}\.(jpg|png|webp|heic|heif|mp4|mov|pdf)$' then
    return false;
  end if;
  tip := split_part(p_name, '/', 1);
  if not exists (select 1 from public.tips t
                 where t.id = tip and t.review = 'new' and t.created_at > now() - interval '30 minutes') then
    return false;
  end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'tip-uploads' and o.name like tip || '/%') >= 5 then
    return false;
  end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'tip-uploads' and o.created_at > now() - interval '1 hour') >= 60 then
    return false;
  end if;
  if (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where o.bucket_id = 'tip-uploads') >= 524288000 then
    return false;
  end if;
  return true;
end $$;
revoke all on function private.tip_upload_ok(text) from public;
grant execute on function private.tip_upload_ok(text) to anon, authenticated;

-- anon은 조건을 만족할 때 올리기만 한다. 읽기·목록·덮어쓰기·삭제 정책은 두지 않는다.
drop policy if exists tip_upload_insert on storage.objects;
create policy tip_upload_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'tip-uploads' and private.tip_upload_ok(name));

-- 관리자는 첨부 파일을 보고 지운다.
drop policy if exists tip_upload_admin on storage.objects;
create policy tip_upload_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'tip-uploads' and public.is_admin())
  with check (bucket_id = 'tip-uploads' and public.is_admin());

commit;
