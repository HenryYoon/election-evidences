// 증거 카드 데이터 모델 (기획안 5페이지 + 실제 제보 데이터 반영)
// 검증 상태 필드는 두지 않는다 — 신뢰는 source 노출로 담보한다.

export type EvidenceType = '사진' | '영상' | '음성' | '문서';

export interface EvidencePhoto {
  thumb: string | null; // 카드용 썸네일 (~480px)
  view: string | null;  // 상세용 뷰 이미지 (~1400px)
}

export interface EvidenceMediaOther {
  kind: 'video' | 'audio' | 'doc';
  url?: string;  // 스토리지 공개 URL. 원본이 유실된 건은 없음
}

export interface Evidence {
  id: string;                 // URL 키 (ev-002)
  num: number;                // 원본 제보 번호
  title: string;              // 카드 제목 (제보내용 요약)
  description: string;        // 설명 본문
  evidence_type: EvidenceType;
  published: boolean;         // 공개 여부 (관리자 토글)
  region_wide: string | null; // 광역 슬러그 (incheon, seoul, ...)
  region_wide_label: string | null;
  region_basic: string | null; // 기초 슬러그 (인천 자치구)
  place: string;              // 장소 라벨
  place_raw: string;          // 원본 장소 텍스트
  coordinates: [number, number] | null; // [lng, lat]
  located: boolean;           // 지도 표시 가능 여부
  occurred_raw: string;       // 발생 시각(원본 문자열)
  source: string;             // 수집경로 (카카오톡 제보 / 시그널 제보 / 언론 보도 ...)
  source_url: string;         // 원본 링크
  reporter: string;           // 제보자 (익명화됨)
  photos: EvidencePhoto[];
  media_other: EvidenceMediaOther[];
  withheld: number;   // 개인정보로 비공개된 자료 수
  media_count: number;
}

export const EVIDENCE_TYPES: EvidenceType[] = ['사진', '영상', '음성', '문서'];
