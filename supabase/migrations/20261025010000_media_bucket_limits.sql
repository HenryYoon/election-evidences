-- 0009: evidence-media 버킷 제한을 옛 운영 프로젝트와 맞춘다.
-- 기준 마이그레이션은 10MB·이미지만 허용했지만, 운영 버킷에는 영상 39개와 음성 2개(최대 29MB)가 있다.
update storage.buckets
  set file_size_limit = 52428800,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','audio/mp4','audio/mpeg']
  where id = 'evidence-media';
