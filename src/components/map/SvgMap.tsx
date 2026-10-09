// 시도 경계 GeoJSON을 정적 SVG로 그린다. 서버 렌더와 브라우저 렌더가 같은 결과를 낸다.
// 좌표 순서는 [lng, lat]이다.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import provincesRaw from '../../../public/geo/provinces.geojson?raw';

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

const W = 400;
const PAD = 8;
const provinces = JSON.parse(provincesRaw) as { features: { properties: { slug: string; name: string }; geometry: { type: string; coordinates: any } }[] };

// 단순 등장방형 투영. 위도에 따른 가로 축소만 반영한다(한반도 범위에서 충분하다).
function makeProjection() {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const walk = (c: any) => {
    if (typeof c[0] === 'number') {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    } else c.forEach(walk);
  };
  provinces.features.forEach((f) => walk(f.geometry.coordinates));
  const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const scale = (W - PAD * 2) / ((maxX - minX) * kx);
  const H = Math.round((maxY - minY) * scale + PAD * 2);
  const project = (lng: number, lat: number): [number, number] => [
    Math.round(((lng - minX) * kx * scale + PAD) * 10) / 10,
    Math.round(((maxY - lat) * scale + PAD) * 10) / 10,
  ];
  return { project, H };
}

const { project, H } = makeProjection();

function ringPath(ring: [number, number][]): string {
  return ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${project(lng, lat).join(' ')}`).join('') + 'Z';
}

const PATHS = provinces.features.map((f) => {
  const polys: [number, number][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return { slug: f.properties.slug, name: f.properties.name, d: polys.map((p) => p.map(ringPath).join('')).join('') };
});

export default function SvgMap({ points, title }: { points: MapPoint[]; title: string }) {
  const dots = useMemo(() => points.map((p) => ({ ...p, xy: project(p.lng, p.lat) })), [points]);
  return (
    <svg className="svgmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      {PATHS.map((p) => (
        <path key={p.slug} d={p.d}>
          <title>{p.name}</title>
        </path>
      ))}
      {dots.map((d) => (
        <Link key={d.id} to={`/e/${d.id}`} aria-label={d.label}>
          <circle cx={d.xy[0]} cy={d.xy[1]} r={4}>
            <title>{d.label}</title>
          </circle>
        </Link>
      ))}
    </svg>
  );
}
