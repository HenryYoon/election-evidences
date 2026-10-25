// 대표 사례(0010 명세 3장). 유형마다 사진 한 장과 2줄 설명. 상태는 데이터에서 붙인다.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DeskLayout, { Disclaimer } from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';
import type { Dataset } from '../lib/data';
import { toEvidence } from '../types/evidence';
import { formatOccurred } from '../lib/seo';
import { MANUAL_ONLY_STATUSES } from '../lib/status';
import { caseRows, casesDraft } from '../lib/cases';
import { CASES_LEAD } from '../lib/site';

export default function Cases({ ds }: { ds: Dataset }) {
  const rows = useMemo(() => caseRows(ds.evidence.map(toEvidence)), [ds]);
  const checked = rows.some((r) => MANUAL_ONLY_STATUSES.includes(r.evidence.status));
  return (
    <DeskLayout>
      <h1>대표 사례</h1>
      <p className="desk-lead">{CASES_LEAD}</p>
      {casesDraft() && <p className="case-draft">승인 전 초안입니다. 운영 사이트에는 공개되지 않습니다.</p>}
      {!checked && <p className="desk-disclaimer">아래 사례는 운영진이 아직 자료를 확인하지 않은 제보입니다.</p>}
      <Disclaimer />
      <ol className="case-list">
        {rows.map(({ item, evidence: e }) => (
          <li key={item.record} className="case-item">
            <h2>{item.type}</h2>
            <Link to={`/e/${e.id}`} className="case-photo">
              {e.photos[0]?.view ? <img src={e.photos[0].view} alt={item.caption} loading="lazy" /> : <span>{e.type}</span>}
            </Link>
            <p className="case-caption">{item.caption}</p>
            <div className="meta">
              <span>{formatOccurred(e.occurredAt)}</span>
              <span>{e.placeName || '장소 미상'}</span>
              <StatusMark status={e.status} />
              <Link to={`/e/${e.id}`}>증거 보기</Link>
            </div>
          </li>
        ))}
      </ol>
    </DeskLayout>
  );
}
