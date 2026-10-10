// 시도 경계 GeoJSON을 정적 SVG로 그린다. 서버 렌더와 브라우저 렌더가 같은 결과를 낸다.
// 경계선은 모든 페이지에서 같아서 빌드 때 `dist/geo/basemap.svg`로 따로 쓰고(0002 명세 1장),
// 페이지 SVG에는 그 파일을 깔고 점(기록 링크)만 그린다.
// 좌표 순서는 [lng, lat]이다.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import provincesRaw from '../../../public/geo/provinces.geojson?raw';

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  label: string;
  // 미리보기 카드(마우스를 올리거나 초점을 둘 때). 없으면 label만 쓴다.
  card?: { thumb: string | null; claim: string; meta: string; status: string };
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

export const BASEMAP_HREF = '/geo/basemap.svg';
// 데스크 색(배경·구분선). 외부 SVG 파일에는 CSS 변수가 닿지 않아 값을 직접 쓴다. desk.css와 같아야 한다.
const BASEMAP_FILL = '#faf9f6';
const BASEMAP_STROKE = '#d8d5cd';

export function basemapSvg(): string {
  const paths = PATHS.map((p) => `<path d="${p.d}"><title>${p.name}</title></path>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<g fill="${BASEMAP_FILL}" stroke="${BASEMAP_STROKE}" stroke-width="1">${paths}</g></svg>\n`
  );
}

export default function SvgMap({ points, title }: { points: MapPoint[]; title: string }) {
  const dots = useMemo(() => points.map((p) => ({ ...p, xy: project(p.lng, p.lat) })), [points]);
  // 첫 렌더(서버, 하이드레이션)는 카드 없음이라 결과가 같다.
  const [active, setActive] = useState<string | null>(null);
  const shown = dots.find((d) => d.id === active) ?? null;
  return (
    <div className="svgmap-wrap" onMouseLeave={() => setActive(null)}>
      <svg className="svgmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <title>{title}</title>
        <image href={BASEMAP_HREF} x={0} y={0} width={W} height={H} />
        {dots.map((d) => (
          <Link
            key={d.id}
            to={`/e/${d.id}`}
            aria-label={d.label}
            onMouseEnter={() => setActive(d.id)}
            onFocus={() => setActive(d.id)}
            onBlur={() => setActive((cur) => (cur === d.id ? null : cur))}
          >
            <circle cx={d.xy[0]} cy={d.xy[1]} r={active === d.id ? 6 : 4}>
              <title>{d.label}</title>
            </circle>
          </Link>
        ))}
      </svg>
      {shown?.card && <PreviewCard x={shown.xy[0] / W} y={shown.xy[1] / H} card={shown.card} />}
    </div>
  );
}

// 점 위치(0~1 비율)에 카드를 띄운다. 가장자리에서는 지도 안쪽으로 붙이고, 위쪽 점은 아래에 띄운다.
function PreviewCard({ x, y, card }: { x: number; y: number; card: NonNullable<MapPoint['card']> }) {
  const tx = x < 0.3 ? '-12px' : x > 0.7 ? 'calc(-100% + 12px)' : '-50%';
  const ty = y < 0.4 ? '14px' : 'calc(-100% - 14px)';
  return (
    <div className="map-card" style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(${tx}, ${ty})` }} aria-hidden="true">
      {card.thumb && (
        <img
          src={card.thumb}
          alt=""
          width={72}
          height={72}
          loading="eager"
          decoding="async"
          // 썸네일을 못 받으면 깨진 아이콘 대신 글만 보인다.
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div>
        <div className="map-card-claim">{card.claim}</div>
        <div className="map-card-meta">
          {card.meta} · <span className="status">{card.status}</span>
        </div>
      </div>
    </div>
  );
}
