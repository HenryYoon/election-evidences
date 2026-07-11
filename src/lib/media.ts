// 비공개(private) Storage 버킷 대응 — 저장된 공개형 URL을 서명 URL(signed URL)로 치환.
// 버킷을 비공개로 바꾸면 <img>는 공개 URL로 접근 불가(403) → 짧게 만료되는 서명 URL 필요.
// 로컬 경로(/thumbs/..)나 외부 URL은 그대로 통과시킨다.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Evidence } from '../types/evidence';

const BUCKET = 'evidence-media';
const SIGN_TTL = 60 * 60 * 24; // 24시간 — 열람 세션 도중 만료 방지

// Supabase Storage URL(public/sign/authenticated)에서 객체 경로만 추출. 아니면 null.
export function storagePath(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/object\/(?:public|sign|authenticated)\/evidence-media\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// 경로 배열 → { 경로: 서명URL } 맵. 미설정/실패 시 빈 맵(원본 URL 유지).
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || paths.length === 0) return map;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
  if (error || !data) return map;
  for (const d of data) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

// 읽기전용 리스트(공개 앱)용: 사진 URL을 서명 URL로 치환한 새 배열 반환.
// ※ 관리자 편집 화면에서는 쓰지 말 것 — 저장 시 만료되는 서명 URL이 DB에 박힌다.
export async function signEvidencePhotos(list: Evidence[]): Promise<Evidence[]> {
  if (!supabase) return list;
  const paths = new Set<string>();
  for (const e of list)
    for (const p of e.photos ?? []) {
      const a = storagePath(p.thumb);
      if (a) paths.add(a);
      const b = storagePath(p.view);
      if (b) paths.add(b);
    }
  if (paths.size === 0) return list;
  const map = await signPaths([...paths]);
  if (map.size === 0) return list;
  const sub = (u: string | null): string | null => {
    const p = storagePath(u);
    return (p && map.get(p)) || u;
  };
  return list.map((e) => ({
    ...e,
    photos: (e.photos ?? []).map((p) => ({ ...p, thumb: sub(p.thumb), view: sub(p.view) })),
  }));
}

// 관리자 화면용 훅: 저장값은 원본(공개형) URL로 유지하고, 표시할 때만 서명.
// urls가 바뀌면 재서명. 반환 맵은 { 저장경로: 서명URL }.
export function useSignedMap(urls: Array<string | null | undefined>): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const key = urls.filter(Boolean).join('|'); // 안정적 의존성 키
  useEffect(() => {
    const paths = Array.from(
      new Set(urls.map(storagePath).filter((p): p is string => !!p))
    );
    if (!paths.length) {
      setMap(new Map());
      return;
    }
    let alive = true;
    signPaths(paths).then((m) => alive && setMap(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}
