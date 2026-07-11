import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { countByWide, withCounts } from '../lib/data';
import AppBar from '../components/layout/AppBar';
import RegionExplorer from '../components/map/RegionExplorer';

export default function NationMap({ ds }: { ds: Dataset }) {
  const nav = useNavigate();
  const counts = useMemo(() => countByWide(ds.evidence), [ds]);
  const geo = useMemo(() => withCounts(ds.provinces, counts), [ds, counts]);
  const total = ds.evidence.length;

  return (
    <div className="app">
      <AppBar crumbs={[{ label: '전국' }]} />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <RegionExplorer
          geo={geo}
          pickable={(slug) => (counts[slug] || 0) > 0}
          onPick={(slug) => nav(`/map/${slug}`)}
        />
        <div style={overlay}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>검증된 제보</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-800)' }}>
            {total}건<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 6 }}>· 지역을 선택하세요</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'absolute', left: 16, top: 16, background: 'rgba(255,255,255,0.94)',
  border: '1px solid var(--line)', borderRadius: 12, padding: '10px 16px', boxShadow: 'var(--shadow)',
  backdropFilter: 'blur(4px)',
};
