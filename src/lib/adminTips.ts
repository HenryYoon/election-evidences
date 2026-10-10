// 제보 검수(0001 플랜 5단계): 채택한 제보로 비공개 기록 초안을 만든다.
// 원문에는 이름·연락처 같은 개인정보가 섞일 수 있다. 그래서 초안은 비공개로 시작하고,
// 관리자가 편집 창에서 주장과 설명을 다듬은 뒤 공개한다. 제보자 이름·연락처는 초안에 넣지 않는다.
import type { EvidenceRow } from '../types/evidence';

export interface TipRow {
  id: string;
  place_name: string;
  occurred_text: string;
  links: string[];
  review: 'new' | 'accepted' | 'rejected';
  created_at: string;
  tip_contacts: { body: string; name: string | null; contact: string | null } | null;
}

export function tipToEvidenceDraft(tip: TipRow, id: string): Partial<EvidenceRow> {
  const body = tip.tip_contacts?.body ?? '';
  const links = tip.links ?? [];
  return {
    id,
    num: 0,
    title: body.replace(/\s+/g, ' ').slice(0, 50),
    description: body,
    evidence_type: links.length ? '영상' : '문서',
    published: false,
    region_wide: null,
    region_wide_label: null,
    region_basic: null,
    place: tip.place_name,
    place_raw: tip.place_name,
    coordinates: null,
    located: false,
    occurred_raw: tip.occurred_text,
    source: '시민 제보',
    source_url: '',
    reporter: '익명 제보자',
    photos: [],
    media_other: [],
    withheld: 0,
    media_count: 0,
    // 자료(사진·영상)가 저장소에 없으므로 주장 상태로 시작한다. 상태는 관리자만 올린다.
    status: 'allegation',
    claim: '',
    election: '2026 지방선거',
    occurred_at: null,
    sources: [{ title: '시민 제보', url: null }, ...links.map((url, i) => ({ title: `제보 링크 ${i + 1}`, url }))],
    verification: {},
  };
}
