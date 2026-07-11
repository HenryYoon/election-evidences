// 데이터 로드 · 밀도 집계 · 필터 유틸
import { useEffect, useState } from 'react';
import type { Evidence } from '../types/evidence';
import { supabase } from './supabase';

export interface GeoFeature {
  type: 'Feature';
  properties: { code: string; name: string; slug: string; wide?: string; center: [number, number]; count?: number };
  geometry: any;
}
export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

let _evidence: Evidence[] | null = null;
let _provinces: GeoCollection | null = null;
let _munis: GeoCollection | null = null;
let _promise: Promise<void> | null = null;

// 공개 증거 로드: Supabase 설정 시 published=true만 조회, 아니면 정적 JSON 폴백
async function loadEvidence(): Promise<Evidence[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('published', true)
      .order('num', { ascending: true });
    if (!error && data) return data as Evidence[];
    if (error) console.warn('Supabase 조회 실패, 정적 폴백:', error.message);
  }
  const ev = await fetch(`${import.meta.env.BASE_URL}data/evidence.json`).then((r) => r.json());
  return (ev.evidence as Evidence[]).filter((e) => e.published !== false);
}

async function loadAll() {
  if (_promise) return _promise;
  _promise = (async () => {
    const [ev, pv, mu] = await Promise.all([
      loadEvidence(),
      // 행정경계는 정적 참조 데이터라 그대로 사용
      fetch(`${import.meta.env.BASE_URL}geo/provinces.geojson`).then((r) => r.json()),
      fetch(`${import.meta.env.BASE_URL}geo/municipalities.geojson`).then((r) => r.json()),
    ]);
    _evidence = ev;
    _provinces = pv as GeoCollection;
    _munis = mu as GeoCollection;
  })();
  return _promise;
}

export interface Dataset {
  evidence: Evidence[];
  provinces: GeoCollection;
  municipalities: GeoCollection;
}

export function useDataset(): Dataset | null {
  const [ds, setDs] = useState<Dataset | null>(null);
  useEffect(() => {
    let alive = true;
    loadAll().then(() => {
      if (alive && _evidence && _provinces && _munis)
        setDs({ evidence: _evidence, provinces: _provinces, municipalities: _munis });
    });
    return () => {
      alive = false;
    };
  }, []);
  return ds;
}

// 특정 시도의 시군구만 추출
export function munisForWide(municipalities: GeoCollection, wide: string): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: municipalities.features.filter((f) => f.properties.wide === wide),
  };
}

// ── 밀도 집계 ─────────────────────────────────────────────
export function countByWide(evidence: Evidence[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of evidence) if (e.region_wide) m[e.region_wide] = (m[e.region_wide] || 0) + 1;
  return m;
}

export function countByBasic(evidence: Evidence[], wide: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of evidence)
    if (e.region_wide === wide && e.region_basic) m[e.region_basic] = (m[e.region_basic] || 0) + 1;
  return m;
}

// geojson 피처 properties에 count 주입 (data-driven 스타일용)
export function withCounts(geo: GeoCollection, counts: Record<string, number>): GeoCollection {
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => ({
      ...f,
      properties: { ...f.properties, count: counts[f.properties.slug] || 0 },
    })),
  };
}

// ── 마커 겹침 방지: id 기반 결정적 지터 ───────────────────
export function jitter(coord: [number, number], seed: string): [number, number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = (h % 360) * (Math.PI / 180);
  const r = 0.0016 * (((h >> 8) & 0xff) / 255); // 최대 ~160m
  return [coord[0] + Math.cos(a) * r, coord[1] + Math.sin(a) * r];
}

// ── 필터 ─────────────────────────────────────────────────
export interface Filters {
  types: Set<string>;    // 비어있으면 전체
  place: string | null;  // 투표소/장소 필터
}

export function applyFilters(list: Evidence[], f: Filters): Evidence[] {
  return list.filter((e) => {
    if (f.types.size && !f.types.has(e.evidence_type)) return false;
    if (f.place && e.place !== f.place) return false;
    return true;
  });
}

export function evidenceForWide(evidence: Evidence[], wide: string): Evidence[] {
  return evidence.filter((e) => e.region_wide === wide);
}

export function evidenceForBasic(evidence: Evidence[], wide: string, basic: string): Evidence[] {
  return evidence.filter((e) => e.region_wide === wide && e.region_basic === basic);
}
