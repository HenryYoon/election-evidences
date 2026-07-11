import { useMemo } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { countByBasic, withCounts, evidenceForWide, munisForWide } from '../lib/data';
import AppBar from '../components/layout/AppBar';
import RegionExplorer from '../components/map/RegionExplorer';

export default function WideMap({ ds }: { ds: Dataset }) {
  const { wide } = useParams();
  const nav = useNavigate();
  const prov = ds.provinces.features.find((f) => f.properties.slug === wide);
  const wideLabel = prov?.properties.name ?? wide ?? '';
  const list = useMemo(() => (wide ? evidenceForWide(ds.evidence, wide) : []), [ds, wide]);

  const counts = useMemo(() => (wide ? countByBasic(ds.evidence, wide) : {}), [ds, wide]);
  const munis = useMemo(() => (wide ? munisForWide(ds.municipalities, wide) : null), [ds, wide]);
  const geo = useMemo(() => (munis ? withCounts(munis, counts) : null), [munis, counts]);

  if (!prov || !geo) return <Navigate to="/" replace />;

  const crumbs = [{ label: '전국', to: '/' }, { label: wideLabel }];
  const unit = wide === 'sejong' ? '' : '시·군·구';

  return (
    <div className="app">
      <AppBar crumbs={crumbs} />
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <RegionExplorer
          geo={geo}
          fitOnlyCounted
          pickable={(slug) => (counts[slug] || 0) > 0}
          onPick={(basic) => nav(`/map/${wide}/${basic}`)}
        />
        <div style={overlay}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{wideLabel} · {unit}를 선택하세요</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-800)' }}>제보 {list.length}건</div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'absolute', left: 16, top: 16, background: 'rgba(255,255,255,0.94)',
  border: '1px solid var(--line)', borderRadius: 12, padding: '10px 16px', boxShadow: 'var(--shadow)',
};
