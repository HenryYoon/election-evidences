import type { StyleSpecification } from 'maplibre-gl';
import type { GeoCollection, GeoFeature } from './data';

// 외부 타일 없는 중립 배경 스타일 (폴백)
export const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9edf3' } }],
};

// 실제 배경 지도 타일 스타일.
// VWorld 키(VITE_VWORLD_KEY)가 있으면 VWorld(국토부 공식·한글 디테일),
// 없으면 CARTO Positron(무료·키 불필요·회색조)로 폴백. glyphs 불필요(HTML 마커 사용).
// VWorld 배경 레이어: 'white'(백지도·연함) · 'Base'(풀컬러) · 'midnight'(다크) · 'Hybrid'
const VWORLD_LAYER = 'white';

export function makeBaseStyle(): StyleSpecification {
  const key = import.meta.env.VITE_VWORLD_KEY as string | undefined;
  if (key) {
    return {
      version: 8,
      sources: {
        base: {
          type: 'raster',
          tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${key}/${VWORLD_LAYER}/{z}/{y}/{x}.png`],
          tileSize: 256,
          attribution: '© VWorld (국토지리정보원)',
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#f4f6f9' } },
        { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 0.55 } },
      ],
    };
  }
  // 라벨 없는 타일 사용: OSM의 지명(예: 바다 명칭) 정치적 표기 노출 방지.
  // 한글 지역명은 앱이 직접 렌더링한다. 한글 지명·도로명이 필요하면 VWorld 키 사용.
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map(
          (s) => `https://${s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png`
        ),
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e9edf3' } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 0.9 } },
    ],
  };
}

export type BBox = [number, number, number, number];

export function bboxOfGeometry(geom: any, acc: BBox): BBox {
  const walk = (c: any) => {
    if (typeof c[0] === 'number') {
      if (c[0] < acc[0]) acc[0] = c[0];
      if (c[1] < acc[1]) acc[1] = c[1];
      if (c[0] > acc[2]) acc[2] = c[0];
      if (c[1] > acc[3]) acc[3] = c[1];
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return acc;
}

export function bboxOfCollection(fc: GeoCollection, filter?: (f: GeoFeature) => boolean): BBox {
  const acc: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of fc.features) if (!filter || filter(f)) bboxOfGeometry(f.geometry, acc);
  return acc;
}

export function bboxOfPoints(pts: [number, number][]): BBox {
  const acc: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    if (x < acc[0]) acc[0] = x;
    if (y < acc[1]) acc[1] = y;
    if (x > acc[2]) acc[2] = x;
    if (y > acc[3]) acc[3] = y;
  }
  return acc;
}

// 밀도(개수) → 채도 색상 스텝 (기획: 값이 아니라 "쌓인 개수")
export function densityColor(count: number, max: number): string {
  if (count <= 0) return '#dfe4ee';
  const t = Math.min(1, Math.sqrt(count / Math.max(1, max)));
  // 연한 틸 → 진한 네이비
  const stops: [number, [number, number, number]][] = [
    [0, [200, 224, 224]],
    [0.5, [90, 160, 176]],
    [1, [43, 54, 112]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const f = (hi[0] - lo[0]) === 0 ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
  const c = [0, 1, 2].map((k) => Math.round(lo[1][k] + (hi[1][k] - lo[1][k]) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
