// 정리 글 조회와 검증 상태 집계(0010 명세 3·4장).
import { CASES, type CaseFile } from '../content/cases';
import { EVIDENCE_STATUSES, MANUAL_ONLY_STATUSES, type EvidenceStatus } from './status';
import type { Evidence } from '../types/evidence';

// 초안은 PR 미리보기(VERCEL_ENV=preview)와 CASE_DRAFTS=1 빌드에서만 보인다. vite.config.ts가 값을 넣는다.
export const SHOW_DRAFTS: boolean = typeof __CASE_DRAFTS__ !== 'undefined' && __CASE_DRAFTS__;

export function visibleCases(showDrafts = SHOW_DRAFTS, all: readonly CaseFile[] = CASES): CaseFile[] {
  return all.filter((c) => c.state === 'published' || showDrafts);
}

export function findCase(slug: string, showDrafts = SHOW_DRAFTS): CaseFile | undefined {
  return visibleCases(showDrafts).find((c) => c.slug === slug);
}

export const casePath = (c: Pick<CaseFile, 'slug'>) => `/cases/${c.slug}`;

export interface CaseStats {
  total: number;
  verified: number; // 문서 확인 + 영상 확인
  byStatus: Record<EvidenceStatus, number>;
}

// 데이터에 있는 증거만 센다. 비공개로 바뀐 증거는 빠진다.
export function caseEvidence(c: CaseFile, all: readonly Evidence[]): Evidence[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  return c.records.map((id) => byId.get(id)).filter((e): e is Evidence => Boolean(e));
}

export function caseStats(evidence: readonly Evidence[]): CaseStats {
  const byStatus = Object.fromEntries(EVIDENCE_STATUSES.map((s) => [s, 0])) as Record<EvidenceStatus, number>;
  for (const e of evidence) byStatus[e.status] += 1;
  const verified = MANUAL_ONLY_STATUSES.reduce((n, s) => n + byStatus[s], 0);
  return { total: evidence.length, verified, byStatus };
}

// 증거 id → 화면 번호. ev-014 → 14
export const recordNumber = (id: string) => id.replace(/^ev-0*/, '');

// 사전 렌더링이 정리 페이지에 심을 증거 id. 정리 경로가 아니면 null.
export function casePathRecordIds(path: string, showDrafts = SHOW_DRAFTS): string[] | null {
  if (path === '/cases') return [...new Set(visibleCases(showDrafts).flatMap((c) => c.records))];
  const m = path.match(/^\/cases\/([^/]+)$/);
  const c = m ? findCase(decodeURIComponent(m[1]), showDrafts) : undefined;
  return c ? [...c.records] : null;
}
