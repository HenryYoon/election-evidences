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

-- 2) RLS: 로그인(authenticated)만 읽기·쓰기 — 클로즈드 운영 -------------
--    ※ 익명(anon) 읽기 정책 없음 → 로그인 없이는 데이터 접근 불가.
--    ※ 회원가입은 대시보드 Authentication에서 반드시 Disable(외부인 계정 생성 차단).
alter table public.evidence enable row level security;

-- 이전 버전의 익명 공개 읽기 정책 제거(클로즈드 전환)
drop policy if exists evidence_public_read on public.evidence;

drop policy if exists evidence_admin_read on public.evidence;
create policy evidence_admin_read on public.evidence
  for select to authenticated using (true);            -- 로그인 사용자만 조회(비공개 포함)

drop policy if exists evidence_admin_write on public.evidence;
create policy evidence_admin_write on public.evidence
  for all to authenticated using (true) with check (true);

-- 3) 미디어 스토리지 버킷 (비공개 — 서명 URL로만 열람) ------------------
insert into storage.buckets (id, name, public)
values ('evidence-media', 'evidence-media', false)
on conflict (id) do nothing;

-- 이미 public=true로 만들어진 버킷을 비공개로 전환 + 업로드 제한(하드닝)
update storage.buckets
  set public = false,
      file_size_limit = 10485760,                       -- 10MB
      allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'evidence-media';

-- 이전 공개 읽기 정책 제거 → 로그인 사용자만 읽기(클라이언트가 서명 URL 생성)
drop policy if exists media_public_read on storage.objects;
drop policy if exists media_auth_read on storage.objects;
create policy media_auth_read on storage.objects
  for select to authenticated using (bucket_id = 'evidence-media');

drop policy if exists media_admin_write on storage.objects;
create policy media_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'evidence-media') with check (bucket_id = 'evidence-media');

-- 4) 계정: 대시보드 → Authentication → Users → Add user 로 생성.
--    열람자·관리자 모두 이 계정으로 로그인. 회원가입(Sign-ups)은 Disable 유지.
--    (신뢰된 소수 그룹 전제 — 열람자도 쓰기 권한이 있으므로 아는 사람에게만 계정 발급.)
