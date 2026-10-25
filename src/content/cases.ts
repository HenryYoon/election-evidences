// 대표 사례(0010 명세 2장). 대표 유형 3개와 유형마다 대표 증거 1건(운영자 결정, 2026-10-25).
// 설명은 사진에 보이는 사실만 2줄 이내로 쓰고 "~라는 제보"로 끝낸다. 검증 상태는 적지 않는다(데이터에서 붙인다).
// 승인 전에는 CASES_STATE를 'draft'로 둔다. 초안은 운영 빌드에 나오지 않는다.

export interface CaseItem {
  type: string; // 유형 이름
  record: string; // 대표 증거 id
  caption: string; // 2줄 이내(60자 이하)
}

export const CASES_STATE: 'draft' | 'published' = 'published';
export const CASES_UPDATED = '2026-10-25';

export const CASES: readonly CaseItem[] = [
  {
    type: '투표함 봉인지 이상',
    record: 'ev-094',
    caption: '같은 투표함의 개폐부와 투입구에 붙은 봉인지 서명인이 서로 다르다는 제보.',
  },
  {
    type: '접히지 않은 투표지 다발',
    record: 'ev-100',
    caption: '사용 흔적 없이 빳빳하게 묶인 투표지 다발이 개표소에서 다량 나왔다는 제보.',
  },
  {
    type: '잘린 일련번호',
    record: 'ev-072',
    caption: '개표소에서 투표지에서 잘려 나간 일련번호 조각들이 발견됐다는 제보.',
  },
];
