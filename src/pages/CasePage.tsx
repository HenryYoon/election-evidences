// 정리 글 하나(0010 명세 3장). 검증 상태는 연결 증거에서 계산한다. 글에 손으로 적지 않는다.
import { Fragment, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import DeskLayout, { Disclaimer } from '../components/layout/DeskLayout';
import EvidenceRow from '../components/evidence/EvidenceRow';
import type { Dataset } from '../lib/data';
import { toEvidence } from '../types/evidence';
import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL } from '../lib/status';
import { caseEvidence, caseStats, findCase, recordNumber } from '../lib/cases';

export default function CasePage({ ds }: { ds: Dataset }) {
  const { slug = '' } = useParams();
  const c = findCase(slug);
  const all = useMemo(() => ds.evidence.map(toEvidence), [ds]);
  if (!c) return <Navigate to="/cases" replace />;
  const evidence = caseEvidence(c, all);
  const present = new Set(evidence.map((e) => e.id));
  const stats = caseStats(evidence);
  const breakdown = EVIDENCE_STATUSES.filter((s) => stats.byStatus[s]).map((s) => `${EVIDENCE_STATUS_LABEL[s]} ${stats.byStatus[s]}`).join(', ');

  return (
    <DeskLayout>
      <h1>{c.title}</h1>
      <p className="desk-lead">{c.summary}</p>
      {c.state === 'draft' && <p className="case-draft">승인 전 초안입니다. 운영 사이트에는 공개되지 않습니다.</p>}
      <section className="case-status" aria-label="검증 상태">
        <p>{`연결 증거 ${stats.total}개. ${breakdown || '없음'}. 운영진 검증(문서 확인·영상 확인) ${stats.verified}개.`}</p>
        {stats.verified === 0 && <p><strong>운영진이 확인한 내용은 아직 없습니다. 아래는 제보 내용을 정리한 것입니다.</strong></p>}
        <Disclaimer />
      </section>

      {c.sections.map((s) => (
        <section key={s.heading} className="about-section">
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => {
            const refs = p.records.filter((id) => present.has(id));
            return (
              <p key={p.text}>
                {p.text}
                {refs.length > 0 && (
                  <span className="case-refs">
                    {' 증거 '}
                    {refs.map((id, i) => (
                      <Fragment key={id}>
                        {i > 0 && ', '}
                        <Link to={`/e/${id}`}>{recordNumber(id)}</Link>
                      </Fragment>
                    ))}
                  </span>
                )}
              </p>
            );
          })}
        </section>
      ))}

      <section className="about-section">
        <h2>확인하지 못한 것</h2>
        <ul>{c.unconfirmed.map((u) => <li key={u}>{u}</li>)}</ul>
      </section>

      {c.excluded.length > 0 && (
        <section className="about-section">
          <h2>옮기지 않은 내용</h2>
          <ul>{c.excluded.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      )}

      <section className="about-section">
        <h2>{`연결된 증거 ${evidence.length}개`}</h2>
      </section>
      <ul className="ledger-rows">
        {evidence.map((e) => <EvidenceRow key={e.id} e={e} />)}
      </ul>

      <p className="sub">
        {`${c.updated} 갱신. 틀린 내용이 있으면 `}
        <Link to="/contact">문의</Link>
        {'에서 "정정 요청"으로 알려 주세요.'}
      </p>
    </DeskLayout>
  );
}
