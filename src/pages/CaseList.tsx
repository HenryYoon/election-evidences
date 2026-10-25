// 정리 글 목록(0010 명세 1장).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DeskLayout, { Disclaimer } from '../components/layout/DeskLayout';
import type { Dataset } from '../lib/data';
import { toEvidence } from '../types/evidence';
import { caseEvidence, casePath, visibleCases } from '../lib/cases';
import { CASES_LEAD } from '../lib/site';

export default function CaseList({ ds }: { ds: Dataset }) {
  const all = useMemo(() => ds.evidence.map(toEvidence), [ds]);
  const cases = visibleCases();
  return (
    <DeskLayout>
      <h1>정리</h1>
      <p className="desk-lead">{CASES_LEAD}</p>
      <Disclaimer />
      <ul className="ledger-rows">
        {cases.map((c) => (
          <li key={c.slug} className="case-row">
            <Link className="claim" to={casePath(c)}>{c.state === 'draft' ? `[초안] ${c.title}` : c.title}</Link>
            <p>{c.summary}</p>
            <div className="meta">{`연결 증거 ${caseEvidence(c, all).length}개 · ${c.updated} 갱신`}</div>
          </li>
        ))}
      </ul>
    </DeskLayout>
  );
}
