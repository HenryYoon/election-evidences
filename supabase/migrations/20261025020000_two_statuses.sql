-- 0011 상태 두 단계: confirmed(자료 확인), reported(제보).
-- 문서 확인·영상 확인은 운영자가 붙였던 값이라 자료 확인으로 옮긴다. 나머지와 빈 값은 제보다.
-- 자료 유무로 자료 확인을 만들지 않는다. 자료 확인은 운영자가 승인한 뒤에만 붙인다.
alter table public.evidence drop constraint if exists evidence_status_check;
update public.evidence set status = 'confirmed' where status in ('document', 'video_confirmed');
update public.evidence set status = 'reported' where status is null or status not in ('confirmed', 'reported');
alter table public.evidence alter column status set default 'reported';
alter table public.evidence alter column status set not null;
alter table public.evidence add constraint evidence_status_check check (status in ('confirmed', 'reported'));
