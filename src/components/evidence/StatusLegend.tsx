import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL, EVIDENCE_STATUS_LEGEND, type EvidenceStatus } from '../../lib/status';

export function StatusMark({ status }: { status: EvidenceStatus }) {
  return <span className="status">{EVIDENCE_STATUS_LABEL[status]}</span>;
}

// 페이지 범례. 문구는 src/lib/status.ts 상수만 읽는다.
export default function StatusLegend() {
  return (
    <ul className="legend" aria-label="상태 범례">
      {EVIDENCE_STATUSES.map((s) => (
        <li key={s}>
          <StatusMark status={s} /> {EVIDENCE_STATUS_LEGEND[s]}
        </li>
      ))}
    </ul>
  );
}
