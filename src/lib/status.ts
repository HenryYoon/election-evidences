// 상태 상수, 한국어 라벨, 범례 문구. 페이지 범례는 이 파일만 읽는다.
// 상태는 조사 분류다. 법적 결론이 아니다.
// `scripts/supabase_schema.sql`의 check 제약과 `scripts/migrate_to_ledger.py`가 같은 값을 쓴다.

export const STATUS_DISCLAIMER = '상태는 조사 분류이며 법적 결론이 아닙니다.';

// ── 기록 상태(0011: 두 단계) ───────────────────────────────
export const EVIDENCE_STATUSES = ['confirmed', 'reported'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  confirmed: '자료 확인',
  reported: '제보',
};

export const EVIDENCE_STATUS_LEGEND: Record<EvidenceStatus, string> = {
  confirmed: '운영진이 사진·영상·문서를 보고, 장소가 투표소·개표소 단위로 특정된 것을 확인했습니다. 자료의 진위나 위법 여부를 판단한 것은 아닙니다.',
  reported: '자료가 없거나 장소가 특정되지 않은 제보입니다. 운영진이 아직 자료를 확인하지 않았습니다.',
};

// 운영자가 승인한 뒤에만 붙이는 상태. 코드는 이 상태로 올리지 않는다.
export const MANUAL_ONLY_STATUSES: readonly EvidenceStatus[] = ['confirmed'];

// 옛 상태 값(0001)과 빈 값을 두 단계로 옮긴다. 문서 확인·영상 확인은 운영자가 붙였던 값이라 자료 확인으로 간다.
// 그 밖의 값은 모두 제보다. 자료 유무로 자료 확인을 만들지 않는다.
export function normalizeEvidenceStatus(raw: string | null | undefined): EvidenceStatus {
  if (raw === 'confirmed' || raw === 'document' || raw === 'video_confirmed') return 'confirmed';
  return 'reported';
}

// ── 제보 상태 ─────────────────────────────────────────────
export const TIP_STATUSES = ['unverified'] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

export const TIP_STATUS_LABEL: Record<TipStatus, string> = {
  unverified: '미확인',
};

export const TIP_STATUS_LEGEND: Record<TipStatus, string> = {
  unverified: '시민이 보낸 제보입니다. 운영자가 내용을 확인하지 않았습니다.',
};

// 검증 네 줄. 상세 화면과 마크다운이 같은 순서와 이름을 쓴다.
export const VERIFICATION_FIELDS = [
  ['seen', '보인 것'],
  ['where', '장소'],
  ['when', '시각'],
  ['notClaimed', '주장하지 않는 것'],
] as const;
