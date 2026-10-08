// 상태 상수, 한국어 라벨, 범례 문구. 페이지 범례는 이 파일만 읽는다.
// 상태는 조사 분류다. 법적 결론이 아니다.
// `scripts/supabase_schema.sql`의 check 제약과 `scripts/migrate_to_ledger.py`가 같은 값을 쓴다.

export const STATUS_DISCLAIMER = '상태는 조사 분류이며 법적 결론이 아니다.';

// ── 원장 상태 ─────────────────────────────────────────────
export const EVIDENCE_STATUSES = ['document', 'video_confirmed', 'reported', 'allegation'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  document: '문서 확인',
  video_confirmed: '영상 확인',
  reported: '자료 접수',
  allegation: '주장',
};

export const EVIDENCE_STATUS_LEGEND: Record<EvidenceStatus, string> = {
  document: '공문서나 공식 기록으로 내용을 확인했다.',
  video_confirmed: '원본 영상에서 장소와 시각을 확인했다.',
  reported: '사진이나 영상 자료가 있다. 장소와 시각은 아직 확인하지 않았다.',
  allegation: '자료 없이 주장만 있다.',
};

// 관리자가 검증 네 줄을 채운 뒤 수동으로만 지정하는 상태. 코드는 이 상태로 올리지 않는다.
export const MANUAL_ONLY_STATUSES: readonly EvidenceStatus[] = ['document', 'video_confirmed'];

// 상태가 비어 있는 기존 레코드의 기본값. 자료 유무만 본다.
// `document`, `video_confirmed`는 돌려주지 않는다.
export function defaultEvidenceStatus(hasMedia: boolean): EvidenceStatus {
  return hasMedia ? 'reported' : 'allegation';
}

// ── 제보 상태 ─────────────────────────────────────────────
export const TIP_STATUSES = ['unverified'] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

export const TIP_STATUS_LABEL: Record<TipStatus, string> = {
  unverified: '미확인',
};

export const TIP_STATUS_LEGEND: Record<TipStatus, string> = {
  unverified: '시민이 보낸 제보다. 운영자가 내용을 확인하지 않았다.',
};

// ── 통계 제외 항목 ────────────────────────────────────────
// 통계 모수와 지도에 넣지 않는 기록. 통계 범례에 그대로 적는다.
export const EXCLUDED_KINDS = ['feed', 'unverified_tip', 'no_coordinates', 'allegation_only'] as const;
export type ExcludedKind = (typeof EXCLUDED_KINDS)[number];

export const EXCLUDED_LABEL: Record<ExcludedKind, string> = {
  feed: '피드',
  unverified_tip: '미확인 제보',
  no_coordinates: '좌표 없는 카드',
  allegation_only: '주장만 있는 카드',
};
