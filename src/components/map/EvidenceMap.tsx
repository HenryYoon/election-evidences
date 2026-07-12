import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre';
import type { Evidence } from '../../types/evidence';
import { jitter } from '../../lib/data';
import { makeBaseStyle, bboxOfPoints, type BBox } from '../../lib/geo';
import { typeIcon } from '../evidence/EvidenceCard';

const BASE_STYLE = makeBaseStyle();
const CLUSTER_PX = 48;

interface Props {
  items: Evidence[];        // 지도에 표시할(필터 통과) 위치있는 제보
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;              // 단일 마커 클릭
  onViewport: (bbox: BBox, zoom: number) => void; // 이동 종료 시 현재 화면 범위
  fitKey?: number;          // 값이 바뀌면 전체 마커에 맞춰 리핏
}

interface MarkerPt { ev: Evidence; pos: [number, number] }

export default function EvidenceMap({ items, hoverId, onHover, onPick, onViewport, fitKey }: Props) {
  const ref = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ver, setVer] = useState(0);

  const markers = useMemo<MarkerPt[]>(
    () => items.filter((e) => e.coordinates).map((e) => ({ ev: e, pos: jitter(e.coordinates as [number, number], e.id) })),
    [items]
  );

  const report = () => {
    const m = ref.current?.getMap();
    if (!m) return;
    const b = m.getBounds();
    onViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], m.getZoom());
  };

  // 전체 마커에 맞춰 초기/리핏
  const allBbox = useMemo<BBox>(
    () => (markers.length ? bboxOfPoints(markers.map((m) => m.pos)) : [125.8, 33.9, 129.6, 38.6]),
    [markers]
  );
  useEffect(() => {
    const m = ref.current?.getMap();
    if (!m || !loaded || !isFinite(allBbox[0])) return;
    m.fitBounds([[allBbox[0], allBbox[1]], [allBbox[2], allBbox[3]]], { padding: 60, duration: 400, maxZoom: 12 });
    // 리핏 후 뷰포트 보고는 moveend에서 자동
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fitKey]);

  // 픽셀 근접 클러스터링
  const clusters = useMemo(() => {
    const map = ref.current?.getMap();
    if (!loaded || !map) return markers.map((m) => [m]);
    const pts = markers.map((m) => ({ m, s: map.project(m.pos) }));
    const used = new Array(pts.length).fill(false);
    const groups: MarkerPt[][] = [];
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const g = [pts[i].m];
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        const dx = pts[i].s.x - pts[j].s.x, dy = pts[i].s.y - pts[j].s.y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) { g.push(pts[j].m); used[j] = true; }
      }
      groups.push(g);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, loaded, ver]);

  const expand = (g: MarkerPt[]) => {
    const map = ref.current?.getMap();
    if (!map) return;
    const bb = bboxOfPoints(g.map((m) => m.pos));
    if (bb[0] === bb[2] && bb[1] === bb[3]) map.easeTo({ center: g[0].pos, zoom: Math.min(17, map.getZoom() + 2), duration: 400 });
    else map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 100, maxZoom: 17, duration: 400 });
  };

  return (
    <Map
      ref={ref}
      mapStyle={BASE_STYLE}
      initialViewState={{ longitude: 127.8, latitude: 36.3, zoom: 6.4 }}
      onLoad={() => { setLoaded(true); setVer((v) => v + 1); report(); }}
      onMove={() => setVer((v) => v + 1)}
      onMoveEnd={report}
      dragRotate={false}
      touchZoomRotate={true}
      dragRotate={false}
      pitchWithRotate={false}
    >
      {clusters.map((g, i) => {
        if (g.length > 1) {
          const cx = g.reduce((s, m) => s + m.pos[0], 0) / g.length;
          const cy = g.reduce((s, m) => s + m.pos[1], 0) / g.length;
          const size = Math.min(56, 30 + g.length * 1.6);
          return (
            <Marker key={`c${i}`} longitude={cx} latitude={cy}>
              <div
                onClick={(e) => { e.stopPropagation(); expand(g); }}
                title={`증거 ${g.length}건 — 확대`}
                style={{
                  width: size, height: size, borderRadius: '50%', background: 'rgba(43,54,112,0.92)',
                  color: '#fff', border: '2px solid #fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: 'var(--shadow)',
                }}
              >
                {g.length}
              </div>
            </Marker>
          );
        }
        const { ev, pos } = g[0];
        const active = hoverId === ev.id;
        return (
          <Marker key={ev.id} longitude={pos[0]} latitude={pos[1]}>
            <div
              className={`mk ${ev.evidence_type}${active ? ' active' : ''}`}
              style={{ transform: `rotate(45deg) scale(${active ? 1.25 : 1})` }}
              title={`${ev.place} · ${ev.evidence_type}`}
              onMouseEnter={() => onHover(ev.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); onPick(ev.id); }}
            >
              <span>{typeIcon(ev.evidence_type)}</span>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
