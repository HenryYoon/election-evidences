-- 선거 증거 아카이브 — Supabase 스키마
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.

-- 1) 증거 테이블 ---------------------------------------------------------
create table if not exists public.evidence (
  id                 text primary key,      -- ev-002
  num                int,
  title              text not null,
  description        text,
  evidence_type      text,                  -- 사진/영상/음성/문서
  published          boolean not null default true,   -- 공개/비공개 토글
  region_wide        text,
  region_wide_label  text,
  region_basic       text,
  place              text,
  place_raw          text,
  coordinates        jsonb,                 -- [lng, lat] or null
  located            boolean default false,
  occurred_raw       text,
  source             text,
  source_url         text,
  reporter           text,
  photos             jsonb default '[]'::jsonb,       -- [{thumb,view}]
  media_other        jsonb default '[]'::jsonb,       -- [{kind}]
  withheld           int default 0,
  media_count        int default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists evidence_published_idx on public.evidence (published);
create index if not exists evidence_region_idx on public.evidence (region_wide, region_basic);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists evidence_touch on public.evidence;
create trigger evidence_touch before update on public.evidence
  for each row execute function public.touch_updated_at();

-- 2) RLS: 공개는 published=true만 읽기, 쓰기는 로그인 관리자만 -----------
--    공개 앱은 로그인 없음(비식별화로 보호). 관리자(/admin)만 로그인해 편집.
alter table public.evidence enable row level security;

drop policy if exists evidence_public_read on public.evidence;
create policy evidence_public_read on public.evidence
  for select using (published = true);                 -- 익명도 공개분 조회

drop policy if exists evidence_admin_read on public.evidence;
create policy evidence_admin_read on public.evidence
  for select to authenticated using (true);            -- 관리자는 비공개도 조회

drop policy if exists evidence_admin_write on public.evidence;
create policy evidence_admin_write on public.evidence
  for all to authenticated using (true) with check (true);

-- 3) 미디어 스토리지 버킷 (공개 읽기) -----------------------------------
insert into storage.buckets (id, name, public)
values ('evidence-media', 'evidence-media', true)
on conflict (id) do nothing;

-- 혹시 비공개로 바뀌었으면 공개로 복구 + 업로드 제한(하드닝)
update storage.buckets
  set public = true,
      file_size_limit = 10485760,                       -- 10MB
      allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'evidence-media';

drop policy if exists media_auth_read on storage.objects;
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'evidence-media');     -- 익명도 이미지 열람

drop policy if exists media_admin_write on storage.objects;
create policy media_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'evidence-media') with check (bucket_id = 'evidence-media');

-- 4) 관리자 계정만 생성: 대시보드 → Authentication → Users → Add user.
--    /admin 편집용. 공개 열람자는 계정 불필요(로그인 없음).
