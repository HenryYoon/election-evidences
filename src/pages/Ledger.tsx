// 기록 목록. 행: 사진 칸, 시각, 장소, 상태, 한 줄, 출처(명세 5장 기록).
import { lazy, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applyFilters, NO_FILTERS, type Dataset, type LedgerFilters } from '../lib/data';
import { toEvidence, compareLedger } from '../types/evidence';
import { formatOccurred, sourceLabel } from '../lib/seo';
import DeskLayout, { Disclaimer } from '../components/layout/DeskLayout';
import FilterBar from '../components/evidence/FilterBar';
import StatusLegend, { StatusMark } from '../components/evidence/StatusLegend';
import ClientOnly from '../components/ClientOnly';

// MapLibre는 window를 참조한다. "지도 보기"를 켰을 때 브라우저에서만 불러온다.
const EvidenceMap = lazy(() => import('../components/map/EvidenceMap'));

export default function Ledger({ ds }: { ds: Dataset }) {
  const nav = useNavigate();
  const all = useMemo(() => ds.evidence.map(toEvidence).sort(compareLedger), [ds]);
  const [filters, setFilters] = useState<LedgerFilters>(NO_FILTERS);
  const [showMap, setShowMap] = useState(false);
  const rows = useMemo(() => applyFilters(all, filters), [all, filters]);
  const filtered = rows.length !== all.length;
  const mapItems = useMemo(() => {
    const ids = new Set(rows.map((e) => e.id));
    return ds.evidence.filter((r) => ids.has(r.id) && r.coordinates);
  }, [ds, rows]);

  return (
    <DeskLayout>
      <h1>기록</h1>
      <p className="desk-lead">사진, 영상, 문서가 있고 날짜, 장소, 상태, 출처가 붙은 증거 카드를 발생 시각 최신순으로 둔다.</p>
      <Disclaimer />

      <FilterBar all={all} value={filters} onChange={setFilters} />
      <StatusLegend />
      <p className="sub">
        {filtered ? `조건에 맞는 카드 ${rows.length}건. ` : ''}
        <button type="button" className="linklike" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
          {showMap ? '지도 닫기' : '지도 보기'}
        </button>
      </p>

      {showMap && (
        <div className="ledger-map">
          <ClientOnly>
            <EvidenceMap items={mapItems} hoverId={null} onHover={() => {}} onPick={(id) => nav(`/e/${id}`)} onViewport={() => {}} />
          </ClientOnly>
        </div>
      )}

      <ul className="ledger-rows">
        {rows.map((e) => (
          <li key={e.id} className="ledger-row">
            <div className="ledger-thumb">
              {e.photos[0]?.thumb ? <img src={e.photos[0].thumb} alt="" loading="lazy" /> : e.type}
            </div>
            <div>
              <div className="meta">
                <span>{formatOccurred(e.occurredAt)}</span>
                <span>{e.placeName || '장소 미상'}</span>
                <StatusMark status={e.status} />
              </div>
              <Link className="claim" to={`/e/${e.id}`}>{e.claim}</Link>
              <div className="meta">출처 {sourceLabel(e)}</div>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && <p>조건에 맞는 카드가 없다.</p>}
    </DeskLayout>
  );
}
