import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, Marker, type MapRef } from 'react-map-gl/maplibre';
import type { GeoFeature } from '../../lib/data';
import type { Evidence } from '../../types/evidence';
import { jitter } from '../../lib/data';
import { makeBaseStyle, bboxOfGeometry, bboxOfPoints, type BBox } from '../../lib/geo';
import { typeIcon } from '../evidence/EvidenceCard';

const BASE_STYLE = makeBaseStyle();
const CLUSTER_PX = 46; // 이 픽셀 반경 내 마커는 하나로 묶음

interface Props {
  district: GeoFeature | null;
  items: Evidence[];          // 이 지역의 위치있는 제보 전체
  visibleIds: Set<string>;    // 현재 필터로 보이는 id
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onPickPlace: (place: string) => void;
}

interface MarkerPt { ev: Evidence; pos: [number, number] }

export default function DetailMap({ district, items, visibleIds, hoverId, onHover, onPickPlace }: Props) {
  const ref = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ver, setVer] = useState(0); // 줌/이동 시 재클러스터 트리거

  const markers = useMemo<MarkerPt[]>(
    () =>
      items
        .filter((e) => e.coordinates)
        .map((e) => ({ ev: e, pos: jitter(e.coordinates as [number, number], e.id) })),
    [items]
  );

  const bbox = useMemo<BBox>(() => {
    if (district) {
      const acc: BBox = [Infinity, Infinity, -Infinity, -Infinity];
      return bboxOfGeometry(district.geometry, acc);
    }
    if (markers.length) return bboxOfPoints(markers.map((m) => m.pos));
    return [126.4, 37.3, 126.8, 37.6];
  }, [district, markers]);

  useEffect(() => {
    const m = ref.current?.getMap();
    if (!m || !loaded || !isFinite(bbox[0])) return;
    m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 300, maxZoom: 15 });
  }, [bbox, loaded]);

  // 현재 줌/뷰포트 기준 픽셀 근접 클러스터링
  const clusters = useMemo(() => {
    const map = ref.current?.getMap();
    if (!loaded || !map) return markers.map((m) => ({ items: [m] }));
    const pts = markers.map((m) => ({ m, s: map.project(m.pos) }));
    const used = new Array(pts.length).fill(false);
    const groups: { items: MarkerPt[] }[] = [];
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const g = [pts[i].m];
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        const dx = pts[i].s.x - pts[j].s.x;
        const dy = pts[i].s.y - pts[j].s.y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) {
          g.push(pts[j].m);
          used[j] = true;
        }
      }
      groups.push({ items: g });
    }
    return groups;
    // ver: 이동/줌마다 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, loaded, ver]);

  const expandCluster = (g: MarkerPt[]) => {
    const map = ref.current?.getMap();
    if (!map) return;
    const bb = bboxOfPoints(g.map((m) => m.pos));
    if (bb[0] === bb[2] && bb[1] === bb[3]) {
      map.easeTo({ center: g[0].pos, zoom: Math.min(17, map.getZoom() + 2), duration: 400 });
    } else {
      map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 90, maxZoom: 17, duration: 400 });
    }
  };

  return (
    <Map
      ref={ref}
      mapStyle={BASE_STYLE}
      initialViewState={{ longitude: 126.65, latitude: 37.45, zoom: 10 }}
      onLoad={() => { setLoaded(true); setVer((v) => v + 1); }}
      onMove={() => setVer((v) => v + 1)}
      dragRotate={false}
      touchZoomRotate={true}
      dragRotate={false}
      pitchWithRotate={false}
    >
      {district && (
        <Source id="district" type="geojson" data={district as any}>
          <Layer id="district-fill" type="fill" paint={{ 'fill-color': '#3a97ad', 'fill-opacity': 0.08 }} />
          <Layer id="district-line" type="line" paint={{ 'line-color': '#2f7d8f', 'line-width': 2, 'line-dasharray': [2, 1] }} />
        </Source>
      )}

      {clusters.map((c, i) => {
        const g = c.items;
        // 클러스터 중심 = 구성원 평균 좌표
        const cx = g.reduce((s, m) => s + m.pos[0], 0) / g.length;
        const cy = g.reduce((s, m) => s + m.pos[1], 0) / g.length;

        if (g.length > 1) {
          const visN = g.filter((m) => visibleIds.size === 0 || visibleIds.has(m.ev.id)).length;
          const dim = visibleIds.size > 0 && visN === 0;
          const size = Math.min(52, 30 + g.length * 2);
          return (
            <Marker key={`c${i}`} longitude={cx} latitude={cy}>
              <div
                onClick={(e) => { e.stopPropagation(); expandCluster(g); }}
                title={`증거 ${g.length}건 — 확대`}
                style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'rgba(43,54,112,0.92)', color: '#fff', border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: 'var(--shadow)',
                  opacity: dim ? 0.35 : 1,
                }}
              >
                {visibleIds.size > 0 ? visN : g.length}
              </div>
            </Marker>
          );
        }

        const { ev, pos } = g[0];
        const dim = visibleIds.size > 0 && !visibleIds.has(ev.id);
        const active = hoverId === ev.id;
        return (
          <Marker key={ev.id} longitude={pos[0]} latitude={pos[1]}>
            <div
              className={`mk ${ev.evidence_type}${active ? ' active' : ''}`}
              style={{ opacity: dim ? 0.3 : 1, transform: `rotate(45deg) scale(${active ? 1.25 : 1})` }}
              title={`${ev.place} · ${ev.evidence_type}`}
              onMouseEnter={() => onHover(ev.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); onPickPlace(ev.place); }}
            >
              <span>{typeIcon(ev.evidence_type)}</span>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
