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

-- 1b) 관리자 허용 목록 -------------------------------------------------
--    로그인한 계정 전체가 아니라 admins에 있는 계정만 관리자로 본다.
--    Auth 가입 설정이 나중에 켜져도 가입자는 관리자 권한을 얻지 못한다.
--    관리자 추가: insert into public.admins (user_id)
--                 select id from auth.users where email = '<관리자 이메일>';
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) RLS: 공개는 published=true만 읽기, 쓰기는 관리자(admins)만 -----------
--    공개 앱은 로그인 없음(비식별화로 보호). 관리자(/admin)만 로그인해 편집.
alter table public.evidence enable row level security;

drop policy if exists evidence_public_read on public.evidence;
create policy evidence_public_read on public.evidence
  for select using (published = true);                 -- 익명도 공개분 조회

drop policy if exists evidence_admin_read on public.evidence;
create policy evidence_admin_read on public.evidence
  for select to authenticated using (public.is_admin());  -- 관리자는 비공개도 조회

drop policy if exists evidence_admin_write on public.evidence;
create policy evidence_admin_write on public.evidence
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

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
  using (bucket_id = 'evidence-media' and public.is_admin())
  with check (bucket_id = 'evidence-media' and public.is_admin());

-- 4) 관리자 계정만 생성: 대시보드 → Authentication → Users → Add user.
--    /admin 편집용. 공개 열람자는 계정 불필요(로그인 없음).

-- ======================================================================
-- 0001 선거 증거 데스크 마이그레이션 (plan/0001-evidence-desk.md 1단계)
-- 여러 번 실행해도 결과가 같다. 상태 값은 src/lib/status.ts와 같다.
-- ======================================================================

-- 5) 원장 컬럼 ----------------------------------------------------------
--    status는 기본값 없이 추가한다. 기존 행은 migrate_to_ledger.py가 채운다.
--    document, video_confirmed는 관리자가 수동으로만 지정한다.
alter table public.evidence add column if not exists status text;
alter table public.evidence add column if not exists claim text;          -- 한 문장 주장
alter table public.evidence add column if not exists election text;
alter table public.evidence add column if not exists occurred_at text;    -- ISO 8601. 시각을 모르면 날짜만
alter table public.evidence add column if not exists sources jsonb not null default '[]'::jsonb;
                                                                          -- [{title,url,archiveUrl?}]
alter table public.evidence add column if not exists verification jsonb not null default '{}'::jsonb;
                                                                          -- {seen,where,when,notClaimed}
alter table public.evidence drop constraint if exists evidence_status_check;
alter table public.evidence add constraint evidence_status_check
  check (status is null or status in ('document', 'video_confirmed', 'reported', 'allegation'));
create index if not exists evidence_status_idx on public.evidence (status);

-- migrate_to_ledger.py --apply 로 모든 행에 status가 채워진 뒤 아래를 실행한다.
--   alter table public.evidence alter column status set default 'allegation';
--   alter table public.evidence alter column status set not null;

-- 6) 피드 --------------------------------------------------------------
create table if not exists public.feed_sources (
  id           text primary key,                -- olgung, jahyeok
  name         text not null,
  platform     text not null,                   -- youtube, ...
  channel_url  text,
  feed_url     text,                            -- 유튜브 채널 RSS
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.feed_items (
  id           text primary key,                -- 플랫폼 항목 ID
  source       text not null references public.feed_sources (id),
  sent_at      timestamptz not null,
  text         text not null,                   -- 한 줄
  url          text not null unique,
  evidence_id  text references public.evidence (id) on delete set null,  -- 원장 승격 시에만
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists feed_items_source_idx on public.feed_items (source, sent_at desc);

-- 7) 제보 --------------------------------------------------------------
--    tips는 공개 필드만 둔다. 원문과 연락처는 tip_contacts(관리자 전용)에 둔다.
create table if not exists public.tips (
  id           text primary key default gen_random_uuid()::text,
  status       text not null default 'unverified' check (status in ('unverified')),
  place_name   text not null default '',
  sent_at      timestamptz not null default now(),
  heard        text not null default '',        -- 관리자가 쓴 공개용 한 줄
  not_claimed  text not null default '',        -- 관리자가 쓴 공개용 한 줄
  published    boolean not null default false,  -- 관리자 검수 후 공개
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.tip_contacts (
  tip_id       text primary key references public.tips (id) on delete cascade,
  body         text not null,                   -- 제보 원문
  name         text,
  contact      text,                            -- 전화, 이메일, 계정
  created_at   timestamptz not null default now()
);

-- 8) 통계 --------------------------------------------------------------
create table if not exists public.analyses (
  id                     text primary key,
  title                  text not null,
  question               text not null,
  period                 text not null,
  universe               text not null,                 -- 모수
  method                 jsonb not null check (jsonb_typeof(method) = 'array' and jsonb_array_length(method) = 4),
  source_table           text not null,
  included_evidence_ids  text[] not null default '{}',
  excluded               text[] not null default '{feed,unverified_tip,no_coordinates,allegation_only}'
    check (excluded <@ array['feed', 'unverified_tip', 'no_coordinates', 'allegation_only']),
  geo                    text not null check (geo in ('choropleth', 'dots')),
  published              boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.analysis_rows (
  id           bigint generated always as identity primary key,
  analysis_id  text not null references public.analyses (id) on delete cascade,
  position     int not null default 0,
  area         text not null,                   -- 구역 또는 장소
  value        numeric not null,
  unit         text not null
);
create index if not exists analysis_rows_analysis_idx on public.analysis_rows (analysis_id, position);

-- 9) updated_at 자동 갱신 ---------------------------------------------
drop trigger if exists feed_sources_touch on public.feed_sources;
create trigger feed_sources_touch before update on public.feed_sources
  for each row execute function public.touch_updated_at();
drop trigger if exists feed_items_touch on public.feed_items;
create trigger feed_items_touch before update on public.feed_items
  for each row execute function public.touch_updated_at();
drop trigger if exists tips_touch on public.tips;
create trigger tips_touch before update on public.tips
  for each row execute function public.touch_updated_at();
drop trigger if exists analyses_touch on public.analyses;
create trigger analyses_touch before update on public.analyses
  for each row execute function public.touch_updated_at();

-- 10) RLS -------------------------------------------------------------
--    공개 테이블: 익명은 공개 행만 읽는다. 쓰기는 관리자(admins)만.
--    tip_contacts: 익명 정책을 두지 않는다. 관리자(admins)와 서버 함수(service_role)만 접근한다.
alter table public.feed_sources  enable row level security;
alter table public.feed_items    enable row level security;
alter table public.tips          enable row level security;
alter table public.tip_contacts  enable row level security;
alter table public.analyses      enable row level security;
alter table public.analysis_rows enable row level security;

drop policy if exists feed_sources_public_read on public.feed_sources;
create policy feed_sources_public_read on public.feed_sources
  for select using (true);
drop policy if exists feed_sources_admin_write on public.feed_sources;
create policy feed_sources_admin_write on public.feed_sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists feed_items_public_read on public.feed_items;
create policy feed_items_public_read on public.feed_items
  for select using (published = true);
drop policy if exists feed_items_admin_all on public.feed_items;
create policy feed_items_admin_all on public.feed_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tips_public_read on public.tips;
create policy tips_public_read on public.tips
  for select using (published = true);
drop policy if exists tips_admin_all on public.tips;
create policy tips_admin_all on public.tips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tip_contacts_admin_all on public.tip_contacts;
create policy tip_contacts_admin_all on public.tip_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.tip_contacts from anon;

drop policy if exists analyses_public_read on public.analyses;
create policy analyses_public_read on public.analyses
  for select using (published = true);
drop policy if exists analyses_admin_all on public.analyses;
create policy analyses_admin_all on public.analyses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists analysis_rows_public_read on public.analysis_rows;
create policy analysis_rows_public_read on public.analysis_rows
  for select using (
    exists (select 1 from public.analyses a where a.id = analysis_id and a.published = true)
  );
drop policy if exists analysis_rows_admin_all on public.analysis_rows;
create policy analysis_rows_admin_all on public.analysis_rows
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 11) 피드 발신처 초기값. 발신처 추가는 이 테이블에 행을 넣는 것으로 끝난다.
--     채널 주소는 운영자가 채운다.
insert into public.feed_sources (id, name, platform) values
  ('olgung', '올공', 'youtube'),
  ('jahyeok', '자혁', 'youtube')
on conflict (id) do nothing;
