-- 0005 보안 보강(spec/0003-security-hardening.md). 두 번 실행해도 결과가 같다.
begin;

-- 1) 제보 비율 제한: cf-connecting-ip를 먼저 쓴다.
create or replace function public.submit_tip(
  p_place text, p_occurred text, p_body text, p_links text[], p_name text, p_contact text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  hdr json;
  ip text;
  h text;
  new_id text;
  l text;
begin
  p_place := btrim(coalesce(p_place, ''));
  p_occurred := btrim(coalesce(p_occurred, ''));
  p_body := btrim(coalesce(p_body, ''));
  p_links := coalesce(p_links, '{}');
  if char_length(p_place) < 2 or char_length(p_place) > 200 then
    raise exception '장소는 2~200자로 적어 주세요' using errcode = '22023';
  end if;
  if char_length(p_body) < 10 or char_length(p_body) > 5000 then
    raise exception '내용은 10~5000자로 적어 주세요' using errcode = '22023';
  end if;
  if char_length(p_occurred) > 200 or char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_contact, '')) > 200 then
    raise exception '입력이 너무 깁니다' using errcode = '22023';
  end if;
  if coalesce(array_length(p_links, 1), 0) > 5 then
    raise exception '링크는 5개까지 받습니다' using errcode = '22023';
  end if;
  foreach l in array p_links loop
    if l !~ '^https?://' or char_length(l) > 500 then
      raise exception '링크는 http(s) 주소여야 합니다' using errcode = '22023';
    end if;
  end loop;

  -- cf-connecting-ip는 Cloudflare가 덮어써서 요청자가 위조하지 못한다. 없으면 x-forwarded-for 첫 값.
  hdr := coalesce(current_setting('request.headers', true), '{}')::json;
  ip := coalesce(nullif(btrim(hdr ->> 'cf-connecting-ip'), ''),
                 btrim(split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1)));
  h := md5('desk-tip:' || coalesce(nullif(ip, ''), 'unknown'));
  if (select count(*) from public.tips where ip_hash = h and created_at > now() - interval '1 hour') >= 5 then
    raise exception '잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tips where created_at > now() - interval '1 hour') >= 100 then
    raise exception '지금은 제보가 많아 잠시 뒤에 다시 보내 주세요' using errcode = 'P0001';
  end if;

  insert into public.tips (place_name, occurred_text, links, ip_hash, published, review)
    values (p_place, p_occurred, p_links, h, false, 'new')
    returning id into new_id;
  insert into public.tip_contacts (tip_id, body, name, contact)
    values (new_id, p_body, nullif(btrim(coalesce(p_name, '')), ''), nullif(btrim(coalesce(p_contact, '')), ''));
  return new_id;
end $$;
revoke all on function public.submit_tip(text, text, text, text[], text, text) from public;
grant execute on function public.submit_tip(text, text, text, text[], text, text) to anon, authenticated;

-- 2) updated_at 트리거 함수의 search_path 고정.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- 3) 스토리지: anon의 객체 목록 조회를 막는다. 공개 버킷 주소(/object/public/)는 정책 없이 열린다.
drop policy if exists media_public_read on storage.objects;

commit;
