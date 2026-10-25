// 증거 목록 한 행(0008 명세 3장). 증거 목록과 정리 글(0010)이 같이 쓴다.
import { Link } from 'react-router-dom';
import type { Evidence } from '../../types/evidence';
import { formatOccurred, sourceLabel } from '../../lib/seo';
import { StatusMark } from './StatusLegend';

export default function EvidenceRow({ e }: { e: Evidence }) {
  return (
    <li className="ledger-row">
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
  );
}
