// 공개 데이터 로드 · 필터 유틸
// 사전 렌더링(node)과 브라우저가 같은 함수로 공개 레코드를 읽는다.
import type { Evidence, EvidenceRow } from '../types/evidence';

export interface GeoFeature {
  type: 'Feature';
  properties: { code: string; name: string; slug: string; wide?: string; center: [number, number]; count?: number };
  geometry: any;
}
export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface Dataset {
  evidence: EvidenceRow[];
}

export interface PublicSource {
  supabaseUrl?: string;
  anonKey?: string;
}

// Supabase REST로 공개 행(published=true)만 읽는다. supabase-js 없이 fetch만 써서
// 사전 렌더링 스크립트에서도 그대로 돈다. 실패하면 예외를 던진다.
export async function fetchPublicEvidence({ supabaseUrl, anonKey }: Required<PublicSource>): Promise<EvidenceRow[]> {
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/evidence?select=*&published=eq.true&order=num.asc`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
  );
  if (!res.ok) throw new Error(`Supabase 조회 실패 HTTP ${res.status}`);
  return (await res.json()) as EvidenceRow[];
}

// 브라우저용: Supabase 설정이 있으면 Supabase, 없거나 실패하면 정적 JSON.
export async function loadPublicEvidence(): Promise<EvidenceRow[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (supabaseUrl && anonKey) {
    try {
      return await fetchPublicEvidence({ supabaseUrl, anonKey });
    } catch (e) {
      console.warn('Supabase 조회 실패, 정적 폴백:', e);
    }
  }
  const ev = await fetch(`${import.meta.env.BASE_URL}data/evidence.json`).then((r) => r.json());
  return (ev.evidence as EvidenceRow[]).filter((e) => e.published !== false);
}

// ── 마커 겹침 방지: id 기반 결정적 지터 ───────────────────
export function jitter(coord: [number, number], seed: string): [number, number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = (h % 360) * (Math.PI / 180);
  const r = 0.0016 * (((h >> 8) & 0xff) / 255); // 최대 ~160m
  return [coord[0] + Math.cos(a) * r, coord[1] + Math.sin(a) * r];
}

// ── 원장 필터: 유형, 선거, 상태, 지역 ─────────────────────
export interface LedgerFilters {
  type: string;     // 빈 문자열이면 전체
  election: string;
  status: string;
  region: string;   // 광역 라벨
}

export const NO_FILTERS: LedgerFilters = { type: '', election: '', status: '', region: '' };

export function applyFilters(list: Evidence[], f: LedgerFilters): Evidence[] {
  return list.filter(
    (e) =>
      (!f.type || e.type === f.type) &&
      (!f.election || e.election === f.election) &&
      (!f.status || e.status === f.status) &&
      (!f.region || e.regionWideLabel === f.region)
  );
}
