-- 운영 DB를 흉내 내는 마이그레이션 전 행. 내용은 자리표시다.
insert into auth.users values ('00000000-0000-0000-0000-0000000000aa') on conflict do nothing;
insert into public.evidence (id, num, title, source, source_url, media_count, photos, media_other) values
  ('ev-002', 2, '자리표시 2', '카카오톡 제보', '', 1, '[]', '[{"kind":"video"}]'),
  ('ev-004', 4, '자리표시 4(잘린 제목)', '시그널 제보', '', 1, '[{}]', '[]'),
  ('ev-005', 5, '자리표시 5', '언론 보도', 'https://example.com/n', 0, '[]', '[]'),
  ('ev-015', 15, '자리표시 15', 'ㅣ', '', 3, '[{}]', '[]'),
  ('ev-009', 9, 'cctv 가림', '카카오톡 제보', '', 0, '[]', '[]'),
  ('ev-012', 12, '○○○이 이의신청서 제출', '카카오톡 제보', '', 1, '[{}]', '[]'),
  ('ev-025', 25, '부방대의 ○○○로 출근', '카카오톡 제보', '', 1, '[{}]', '[]'),
  ('ev-098', 98, '투표소 CCTV 가림', '카카오톡 제보', '', 2, '[{},{}]', '[]');
update public.evidence set description = title;
update public.evidence set published = true where id in ('ev-009', 'ev-098');
