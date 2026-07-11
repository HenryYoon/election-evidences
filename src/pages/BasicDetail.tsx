import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import type { Dataset, Filters } from '../lib/data';
import { evidenceForBasic, applyFilters } from '../lib/data';
import AppBar from '../components/layout/AppBar';
import DetailMap from '../components/map/DetailMap';
import EvidenceCard from '../components/evidence/EvidenceCard';
import FilterBar from '../components/evidence/FilterBar';
import StatsTab from '../components/evidence/StatsTab';
import BottomSheet, { type Snap } from '../components/layout/BottomSheet';
import { useIsMobile } from '../lib/useIsMobile';

type Tab = '증거' | '통계';

export default function BasicDetail({ ds }: { ds: Dataset }) {
  const { wide, basic } = useParams();
  const nav = useNavigate();
  const isMobile = useIsMobile();

  const prov = ds.provinces.features.find((f) => f.properties.slug === wide);
  const wideLabel = prov?.properties.name ?? wide ?? '';
  const district =
    ds.municipalities.features.find(
      (f) => f.properties.wide === wide && f.properties.slug === basic
    ) ?? null;
  const districtName = district?.properties.name ?? basic ?? '';

  const all = useMemo(
    () => (wide && basic ? evidenceForBasic(ds.evidence, wide, basic) : []),
    [ds, wide, basic]
  );

  const [filters, setFilters] = useState<Filters>({ types: new Set(), place: null });
  const [tab, setTab] = useState<Tab>('증거');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverSrc, setHoverSrc] = useState<'map' | 'card' | null>(null);
  const [snap, setSnap] = useState<Snap>('half');

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const visibleIds = useMemo(() => new Set(filtered.map((e) => e.id)), [filtered]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 마커 hover → 카드 자동 스크롤
  useEffect(() => {
    if (hoverSrc === 'map' && hoverId) {
      cardRefs.current[hoverId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [hoverId, hoverSrc]);

  if (!prov || !district) return <Navigate to={`/map/${wide}`} replace />;

  const setHover = (id: string | null, src: 'map' | 'card') => {
    setHoverId(id);
    setHoverSrc(id ? src : null);
  };
  const pickPlace = (place: string) => {
    setFilters((f) => ({ ...f, place: f.place === place ? null : place }));
    if (isMobile) setSnap('half');
  };
  const openTab = (t: Tab) => {
    setTab(t);
    if (isMobile && t === '통계') setSnap('full');
  };

  const map = (
    <DetailMap
      district={district}
      items={all}
      visibleIds={visibleIds}
      hoverId={hoverId}
      onHover={(id) => setHover(id, 'map')}
      onPickPlace={pickPlace}
    />
  );

  const tabs = (
    <div className="tabbar">
      {(['증거', '통계'] as Tab[]).map((t) => (
        <button key={t} className={tab === t ? 'active' : ''} onClick={() => openTab(t)}>{t}</button>
      ))}
    </div>
  );

  const panelBody =
    tab === '통계' ? (
      <StatsTab regionLabel={districtName} />
    ) : (
      <div style={{ padding: isMobile ? 0 : '12px 14px' }}>
        <div style={{ marginBottom: 10 }}>
          <FilterBar all={all} filters={filters} onChange={setFilters} />
        </div>
        <div className="list-head">
          <span className="n"><b>{filtered.length}</b> / {all.length}건</span>
          {(filters.types.size > 0 || filters.place) && (
            <button className="chip" onClick={() => setFilters({ types: new Set(), place: null })}>필터 초기화</button>
          )}
        </div>
        <div className="list" ref={listRef}>
          {filtered.map((e) => (
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
          {!filtered.length && <div className="empty">조건에 맞는 제보가 없습니다.</div>}
        </div>
      </div>
    );

  const crumbs = [
    { label: '전국', to: '/' },
    { label: wideLabel, to: `/map/${wide}` },
    { label: districtName },
  ];

  // ── 모바일: 지도 우선 + Bottom Sheet ──────────────
  if (isMobile) {
    return (
      <div className="app">
        <AppBar crumbs={crumbs} />
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {map}
          <BottomSheet
            snap={snap}
            onSnap={setSnap}
            header={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {tabs}
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>증거 {all.length}건</span>
              </div>
            }
          >
            {panelBody}
          </BottomSheet>
        </div>
      </div>
    );
  }

  // ── 데스크톱: 지도 + 패널 2단 ─────────────────────
  return (
    <div className="app">
      <AppBar crumbs={crumbs} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 420px' }}>
        <div style={{ position: 'relative', minWidth: 0 }}>{map}</div>
        <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {tabs}
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>증거 {all.length}건</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{panelBody}</div>
        </aside>
      </div>
    </div>
  );
}
