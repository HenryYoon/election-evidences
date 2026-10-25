// 대표 사례 조회(0010 명세 3·4장).
import { CASES, CASES_STATE, type CaseItem } from '../content/cases';
import type { Evidence } from '../types/evidence';

// 초안은 PR 미리보기(VERCEL_ENV=preview)와 CASE_DRAFTS=1 빌드에서만 보인다. vite.config.ts가 값을 넣는다.
export const SHOW_DRAFTS: boolean = typeof __CASE_DRAFTS__ !== 'undefined' && __CASE_DRAFTS__;
export const CASES_PATH = '/cases';

export function casesVisible(showDrafts = SHOW_DRAFTS, state: 'draft' | 'published' = CASES_STATE): boolean {
  return CASES.length > 0 && (state === 'published' || showDrafts);
}

export const casesDraft = () => CASES_STATE === 'draft';

// 데이터에 있는 대표 증거만 남긴다. 비공개로 바뀐 증거는 빠진다.
export function caseRows(all: readonly Evidence[], items: readonly CaseItem[] = CASES): { item: CaseItem; evidence: Evidence }[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  return items.flatMap((item) => {
    const evidence = byId.get(item.record);
    return evidence ? [{ item, evidence }] : [];
  });
}

// 사전 렌더링이 대표 사례 페이지에 심을 증거 id. 대표 사례 경로가 아니거나 보이지 않으면 null.
export function casePathRecordIds(path: string, showDrafts = SHOW_DRAFTS): string[] | null {
  return path === CASES_PATH && casesVisible(showDrafts) ? CASES.map((c) => c.record) : null;
}
