import { useParams, useNavigate, Navigate } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { typeIcon } from '../components/evidence/EvidenceCard';

export default function EvidenceDetailPage({ ds }: { ds: Dataset }) {
  const { evidenceId } = useParams();
  const nav = useNavigate();
  const ev = ds.evidence.find((e) => e.id === evidenceId);
  if (!ev) return <Navigate to="/" replace />;

  const back = () => (window.history.length > 1 ? nav(-1) : nav('/'));

  return (
    <div className="app" style={{ background: 'var(--bg)' }}>
      <header className="appbar">
        <button onClick={back} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          ‹ 뒤로
        </button>
        <span className="brand" style={{ marginLeft: 4 }}>증거 상세</span>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <article style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className={`badge ${ev.evidence_type}`}>{typeIcon(ev.evidence_type)} {ev.evidence_type}</span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{ev.region_wide_label} · {ev.place}</span>
          </div>
          <h1 style={{ fontSize: 22, lineHeight: 1.35, margin: '0 0 14px', color: 'var(--ink)' }}>{ev.title}</h1>

          {/* 미디어 */}
          {ev.photos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '4px 0 20px' }}>
              {ev.photos.map((p, i) =>
                p.view ? (
                  <img key={i} src={p.view} alt={ev.title}
                    style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }} loading="lazy" />
                ) : null
              )}
            </div>
          )}
          {ev.media_other.length > 0 && (
            <div className="note" style={{ marginBottom: 12 }}>
              {ev.media_other.map((m) => (m.kind === 'video' ? '🎬 영상' : '🎧 음성')).join(', ')}{' '}
              원본 {ev.media_other.length}건 — 재생/열람은 미디어 호스팅 연동 후 제공됩니다.
            </div>
          )}
          {ev.withheld > 0 && (
            <div className="note" style={{ marginBottom: 20 }}>
              🔒 개인정보(서명·연락처·이름·대화 내용 등)가 담긴 자료 <b>{ev.withheld}건</b>은
              보호를 위해 <b>비공개</b>했습니다.{' '}
              {ev.photos.length > 0
                ? '물증 사진만 공개합니다.'
                : '이 제보는 공개 가능한 사진이 없어 텍스트 요약만 제공합니다.'}
            </div>
          )}

          {/* 본문 */}
          {ev.description && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', margin: '0 0 24px' }}>
              {ev.description}
            </p>
          )}

          {/* 메타 / 출처 — 신뢰는 출처 노출로 담보 */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '4px 16px' }}>
            {rows(ev).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line-2)', fontSize: 14 }}>
                <div style={{ width: 92, color: 'var(--ink-3)', flex: '0 0 auto' }}>{k}</div>
                <div style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{v}</div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

function rows(ev: Dataset['evidence'][number]): [string, React.ReactNode][] {
  const r: [string, React.ReactNode][] = [
    ['발생 장소', ev.place_raw],
    ['발생 시각', ev.occurred_raw || '미상'],
    ['수집 경로', ev.source],
    ['제보자', ev.reporter],
  ];
  if (ev.source_url)
    r.push(['원본 링크', <a href={ev.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-600)', fontWeight: 600 }}>{ev.source_url}</a>]);
  return r;
}
