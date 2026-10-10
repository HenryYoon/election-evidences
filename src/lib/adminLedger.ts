// 관리자 기록 편집의 검사와 정리(0001 플랜 7단계). 화면과 분리해 단위 테스트한다.
import type { EvidenceRow, EvidenceSource, EvidenceVerification } from '../types/evidence';
import { EVIDENCE_STATUSES, MANUAL_ONLY_STATUSES, VERIFICATION_FIELDS } from './status';

// 날짜만(YYYY-MM-DD) 또는 KST 오프셋을 붙인 시각.
const OCCURRED_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z))?$/;

export function validateLedgerDraft(d: Partial<EvidenceRow>): string[] {
  const errs: string[] = [];
  if (!(d.claim ?? '').trim()) errs.push('주장을 한 문장으로 적어야 한다.');
  if (d.status && !EVIDENCE_STATUSES.includes(d.status)) errs.push(`알 수 없는 상태: ${d.status}`);
  const occurred = (d.occurred_at ?? '').trim();
  if (occurred && !OCCURRED_RE.test(occurred)) errs.push('발생 시각은 2026-06-03 또는 2026-06-03T14:37:00+09:00 형식이어야 한다.');
  for (const [i, s] of (d.sources ?? []).entries()) {
    if (!s.title.trim() && !(s.url ?? '').trim()) continue; // 빈 줄은 저장 때 버린다
    if (!s.title.trim()) errs.push(`출처 ${i + 1}: 이름이 없다.`);
    if (s.url && !/^https?:\/\//.test(s.url.trim())) errs.push(`출처 ${i + 1}: 주소는 http(s)로 시작해야 한다.`);
  }
  // 문서 확인·영상 확인은 검증 네 줄을 채운 뒤에만 고를 수 있다(status.ts).
  if (d.status && MANUAL_ONLY_STATUSES.includes(d.status)) {
    const v = d.verification ?? {};
    const missing = VERIFICATION_FIELDS.filter(([k]) => !(v[k] ?? '').toString().trim()).map(([, label]) => label);
    if (missing.length) errs.push(`이 상태는 검증 네 줄을 모두 채워야 한다. 빈 줄: ${missing.join(', ')}`);
  }
  return errs;
}

// 저장 전 정리: 빈 출처 줄을 버리고, 빈 검증 줄과 빈 시각은 null로 둔다.
export function normalizeLedgerDraft(d: Partial<EvidenceRow>): Partial<EvidenceRow> {
  const sources: EvidenceSource[] = (d.sources ?? [])
    .map((s) => ({ ...s, title: s.title.trim(), url: (s.url ?? '').trim() || null }))
    .filter((s) => s.title || s.url);
  const verification = Object.fromEntries(
    VERIFICATION_FIELDS.map(([k]) => [k, ((d.verification ?? {})[k] ?? '').toString().trim() || null])
  ) as unknown as EvidenceVerification;
  return {
    ...d,
    claim: (d.claim ?? '').trim(),
    election: (d.election ?? '').trim() || null,
    occurred_at: (d.occurred_at ?? '').trim() || null,
    sources,
    verification,
    media_count: (d.photos?.length ?? 0) + (d.media_other?.length ?? 0),
  };
}
