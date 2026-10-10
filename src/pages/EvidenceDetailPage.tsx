// 증거 카드 상세(명세 5장 기록).
// 첫 문장: 날짜, 장소, 상태, 출처. 왼쪽: 매체. 오른쪽: 상태, 좌표, 선거, 유형.
// 그 아래 검증 네 줄과 출처 목록.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { toEvidence } from '../types/evidence';
import { leadSentence, sourceLabel } from '../lib/seo';
import { markdownPath } from '../lib/llms';
import { EVIDENCE_STATUS_LEGEND, VERIFICATION_FIELDS } from '../lib/status';
import DeskLayout from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';

export default function EvidenceDetailPage({ ds }: { ds: Dataset }) {
  const { evidenceId } = useParams();
  const row = ds.evidence.find((e) => e.id === evidenceId);
  if (!row) {
    return (
      <DeskLayout>
        <h1>카드를 찾을 수 없다</h1>
        <p className="desk-lead">비공개로 바뀌었거나 없는 주소다. <Link to="/records">기록 목록</Link>에서 찾을 수 있다.</p>
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
          {/* 첫 사진은 화면 첫머리라 바로 받는다(LCP). 나머지는 스크롤할 때 받는다. */}
          {ev.photos.map((p, i) =>
            p.view ? (
              <img key={i} src={p.view} alt={`${ev.placeName} 사진 ${i + 1}`} loading={i ? 'lazy' : 'eager'} decoding="async" {...(i ? {} : { fetchpriority: 'high' })} />
            ) : null
          )}
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
        {VERIFICATION_FIELDS.map(([k, label]) => (
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

      <hr className="rule" />
      <p className="cite-tools">
        <CopyCitation text={`${ev.claim}\n${leadSentence(ev)}\n출처: ${sourceLabel(ev)}`} path={`/e/${encodeURIComponent(ev.id)}`} />
        <a href={markdownPath(ev.id)} type="text/markdown">마크다운 원문</a>
        <Link to="/records">기록 목록으로</Link>
      </p>
    </DeskLayout>
  );
}

// 인용 복사: 주장, 첫 문장, 출처, 주소를 일반 텍스트로 클립보드에 넣는다(0002 명세 4장).
function CopyCitation({ text, path }: { text: string; path: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}${path}`);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className="linklike" onClick={copy} aria-live="polite">
      {done ? '복사했다' : '인용 복사'}
    </button>
  );
}
