-- Supabase가 제공하는 역할, 스키마, 함수의 최소 대체물. CI의 순수 Postgres에서 스키마를 돌리기 위해 쓴다.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id serial primary key, bucket_id text);
alter table storage.objects add column if not exists name text;
alter table storage.objects add column if not exists metadata jsonb;
alter table storage.objects add column if not exists created_at timestamptz not null default now();
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage on sequence storage.objects_id_seq to anon, authenticated;
alter table storage.objects enable row level security;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
alter table auth.users add column if not exists email text;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
