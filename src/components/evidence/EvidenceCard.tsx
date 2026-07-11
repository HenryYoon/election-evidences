import type { Evidence } from '../../types/evidence';

const TYPE_ICON: Record<string, string> = { 사진: '🖼', 영상: '▶', 음성: '🎧', 문서: '📄' };

export function typeIcon(t: string) {
  return TYPE_ICON[t] ?? '•';
}

interface Props {
  ev: Evidence;
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function EvidenceCard({ ev, active, onClick, onMouseEnter, onMouseLeave }: Props) {
  const thumb = ev.photos[0]?.thumb ?? null;
  return (
    <div
      className={`card${active ? ' active' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="thumb">
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{typeIcon(ev.evidence_type)}</span>}
      </div>
      <div className="body">
        <div className="title">{ev.title}</div>
        <div className="meta">
          <span className={`badge ${ev.evidence_type}`}>{typeIcon(ev.evidence_type)} {ev.evidence_type}</span>
          {ev.media_count > 1 && <span>+{ev.media_count - 1}</span>}
        </div>
        <div className="meta">
          <span className="place">{ev.place}</span>
          {ev.occurred_raw && <><span>·</span><span>{ev.occurred_raw}</span></>}
        </div>
        <div className="meta"><span>{ev.source}</span></div>
      </div>
    </div>
  );
}
