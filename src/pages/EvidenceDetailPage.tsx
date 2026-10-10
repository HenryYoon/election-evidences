// 증거 카드 상세(명세 5장 원장).
// 첫 문장: 날짜, 장소, 상태, 출처. 왼쪽: 매체. 오른쪽: 상태, 좌표, 선거, 유형.
// 그 아래 검증 네 줄과 출처 목록.
import { Link, useParams } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { toEvidence, type EvidenceVerification } from '../types/evidence';
import { leadSentence } from '../lib/seo';
import { EVIDENCE_STATUS_LEGEND } from '../lib/status';
import DeskLayout from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';

const VERIFICATION: [keyof EvidenceVerification, string][] = [
  ['seen', '보인 것'],
  ['where', '장소'],
  ['when', '시각'],
  ['notClaimed', '주장하지 않는 것'],
];

export default function EvidenceDetailPage({ ds }: { ds: Dataset }) {
  const { evidenceId } = useParams();
  const row = ds.evidence.find((e) => e.id === evidenceId);
  if (!row) {
    return (
      <DeskLayout>
        <h1>카드를 찾을 수 없다</h1>
        <p className="desk-lead">비공개로 바뀌었거나 없는 주소다. <Link to="/ledger">원장 목록</Link>에서 찾을 수 있다.</p>
      </DeskLayout>
    );
  }
  const ev = toEvidence(row);
  const playable = ev.mediaOther.filter((m) => m.url);
  const lost = ev.mediaOther.filter((m) => !m.url);

  return (
    <DeskLayout>
      <h1>{ev.claim}</h1>
      <p className="desk-lead">{leadSentence(ev)}</p>

      <div className="detail-grid">
        <section aria-label="매체" className="detail-media">
          {ev.photos.map((p, i) => (p.view ? <img key={i} src={p.view} alt={`${ev.placeName} 사진 ${i + 1}`} loading="lazy" /> : null))}
          {playable.map((m, i) =>
            m.kind === 'video' ? (
              <video key={i} src={m.url} controls preload="metadata" playsInline />
            ) : (
              <audio key={i} src={m.url} controls preload="metadata" style={{ width: '100%' }} />
            )
          )}
          {lost.length > 0 && <p className="sub">원본이 유실되어 재생할 수 없는 매체 {lost.length}개.</p>}
          {row.withheld > 0 && (
            <p className="sub">개인정보(서명, 연락처, 이름, 대화 내용)가 담긴 자료 {row.withheld}개는 공개하지 않는다.</p>
          )}
          {!ev.photos.some((p) => p.view) && !playable.length && <p className="sub">공개한 매체가 없다.</p>}
        </section>

        <section aria-label="분류">
          <dl className="facts">
            <dt>상태</dt>
            <dd>
              <StatusMark status={ev.status} />
              <br />
              <small>{EVIDENCE_STATUS_LEGEND[ev.status]}</small>
            </dd>
            <dt>좌표</dt>
            <dd>{ev.lat !== null && ev.lng !== null ? `${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)}` : '좌표 없음'}</dd>
            <dt>선거</dt>
            <dd>{ev.election ?? '미기재'}</dd>
            <dt>유형</dt>
            <dd>{ev.type}</dd>
          </dl>
        </section>
      </div>

      <hr className="rule" />
      <h2>검증</h2>
      <dl className="facts">
        {VERIFICATION.map(([k, label]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{label}</dt>
            <dd>{ev.verification[k] || '미기재'}</dd>
          </div>
        ))}
      </dl>

      <hr className="rule" />
      <h2>출처</h2>
      {ev.sources.length ? (
        <ol className="sources">
          {ev.sources.map((s, i) => (
            <li key={i}>
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
              {s.archiveUrl && <> · <a href={s.archiveUrl} target="_blank" rel="noreferrer">보관본</a></>}
            </li>
          ))}
        </ol>
      ) : (
        <p>출처 미기재</p>
      )}

      {ev.description && ev.description !== ev.claim && (
        <>
          <hr className="rule" />
          <h2>제보 내용</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>
        </>
      )}

      <p style={{ marginTop: 32 }}>
        <Link to="/ledger">원장 목록으로</Link>
      </p>
    </DeskLayout>
  );
}
