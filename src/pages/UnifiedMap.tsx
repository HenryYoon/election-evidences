import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import type { BBox } from '../lib/geo';
import { EVIDENCE_TYPES } from '../types/evidence';
import EvidenceMap from '../components/map/EvidenceMap';
import EvidenceCard, { typeIcon } from '../components/evidence/EvidenceCard';
import BottomSheet, { type Snap } from '../components/layout/BottomSheet';
import { useIsMobile } from '../lib/useIsMobile';

const inBbox = (c: [number, number], b: BBox) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];

export default function UnifiedMap({ ds }: { ds: Dataset }) {
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverSrc, setHoverSrc] = useState<'map' | 'card' | null>(null);
  const [view, setView] = useState<{ bbox: BBox; zoom: number } | null>(null);
  const [snap, setSnap] = useState<Snap>('half');

  const located = useMemo(() => ds.evidence.filter((e) => e.coordinates), [ds]);
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of located) m[e.evidence_type] = (m[e.evidence_type] || 0) + 1;
    return m;
  }, [located]);

  const byType = useMemo(
    () => (types.size ? located.filter((e) => types.has(e.evidence_type)) : located),
    [located, types]
  );
  const inView = useMemo(() => {
    if (!view) return byType;
    return byType.filter((e) => inBbox(e.coordinates as [number, number], view.bbox));
  }, [byType, view]);

  const regionLabel = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of inView) { const k = e.region_wide_label || '기타'; c[k] = (c[k] || 0) + 1; }
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
    if (!top.length) return '전국';
    return top.length === 1 ? top[0][0] : `${top[0][0]} 외 ${top.length - 1}개 지역`;
  }, [inView]);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (hoverSrc === 'map' && hoverId) cardRefs.current[hoverId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hoverId, hoverSrc]);

  const setHover = (id: string | null, src: 'map' | 'card') => { setHoverId(id); setHoverSrc(id ? src : null); };
  const pickMarker = (id: string) => { setHover(id, 'map'); if (isMobile) setSnap('half'); };

  const toggleType = (t: string) => {
    const n = new Set(types); n.has(t) ? n.delete(t) : n.add(t); setTypes(n);
  };

  const map = (
    <EvidenceMap
      items={byType}
      hoverId={hoverId}
      onHover={(id) => setHover(id, 'map')}
      onPick={pickMarker}
      onViewport={(bbox, zoom) => setView({ bbox, zoom })}
    />
  );

  const filters = (
    <div className="filterbar">
      {EVIDENCE_TYPES.filter((t) => typeCounts[t]).map((t) => (
        <button key={t} className={`chip${types.has(t) ? ' on' : ''}`} onClick={() => toggleType(t)}>
          {typeIcon(t)} {t} <span style={{ opacity: 0.6 }}>{typeCounts[t]}</span>
        </button>
      ))}
    </div>
  );

  const list = (
    <div style={{ padding: isMobile ? 0 : '10px 14px' }}>
      <div style={{ marginBottom: 10 }}>{filters}</div>
      <div className="list-head">
        <span className="n">현재 화면 <b>{inView.length}</b>건 <span style={{ color: 'var(--ink-3)' }}>· {regionLabel}</span></span>
      </div>
      <div className="list">
        {inView.slice(0, 300).map((e) => (
          <div key={e.id} ref={(el) => (cardRefs.current[e.id] = el)}>
            <EvidenceCard
              ev={e}
              active={hoverId === e.id}
              onClick={() => nav(`/e/${e.id}`)}
              onMouseEnter={() => setHover(e.id, 'card')}
              onMouseLeave={() => setHover(null, 'card')}
            />
          </div>
        ))}
        {!inView.length && <div className="empty">이 화면에는 표시할 증거가 없습니다.<br />지도를 이동하거나 축소해 보세요.</div>}
      </div>
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{regionLabel}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-800)' }}>현재 화면 {inView.length}건</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>전체 {located.length}건</div>
    </div>
  );

  const brand = (
    <header className="appbar">
      <span className="brand">선거 증거 아카이브<small>6·3 지선 · 줌으로 탐색</small></span>
    </header>
  );

  if (isMobile) {
    return (
      <div className="app">
        {brand}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {map}
          <BottomSheet snap={snap} onSnap={setSnap} header={header}>{list}</BottomSheet>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {brand}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px' }}>
        <div style={{ position: 'relative', minWidth: 0 }}>{map}</div>
        <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>{header}</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{list}</div>
        </aside>
      </div>
    </div>
  );
}
