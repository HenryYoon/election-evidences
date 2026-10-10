// 데이터 모델. 명세 4장(`spec/0001-evidence-desk.md`)을 따른다.
// - EvidenceRow: Supabase `evidence` 테이블 행 그대로(snake_case). 기존 페이지가 쓴다.
// - Evidence, FeedItem, Tip, Analysis: 층별 공개 레코드(camelCase). 새 페이지가 쓴다.
// 상태 값과 라벨은 `src/lib/status.ts`에 있다.
import type { EvidenceStatus, TipStatus, ExcludedKind } from '../lib/status';
import { defaultEvidenceStatus, EVIDENCE_STATUSES } from '../lib/status';

export type EvidenceType = '사진' | '영상' | '음성' | '문서';

export interface EvidencePhoto {
  thumb: string | null; // 카드용 썸네일 (~480px)
  view: string | null;  // 상세용 뷰 이미지 (~1400px)
}

export interface EvidenceMediaOther {
  kind: 'video' | 'audio' | 'doc';
  url?: string;  // 스토리지 공개 URL. 원본이 유실된 건은 없음
}

export interface EvidenceSource {
  title: string;
  url: string | null;      // 카카오톡 제보처럼 링크가 없는 출처는 null
  archiveUrl?: string;
}

// 검증 네 줄. 비어 있으면 화면에 "미기재"로 표시한다.
export interface EvidenceVerification {
  seen: string | null;       // 보인 것
  where: string | null;      // 장소
  when: string | null;       // 시각
  notClaimed: string | null; // 주장하지 않는 것
}

// ── Supabase `evidence` 행 ────────────────────────────────
export interface EvidenceRow {
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
  // 기록 컬럼. 마이그레이션 전 행과 정적 JSON에는 없다.
  status?: EvidenceStatus | null;
  claim?: string | null;
  election?: string | null;
  occurred_at?: string | null; // ISO 8601. 시각을 모르면 날짜만(YYYY-MM-DD)
  sources?: EvidenceSource[] | null;
  verification?: Partial<EvidenceVerification> | null;
  created_at?: string;
  updated_at?: string;
}

// ── 층별 공개 레코드 ──────────────────────────────────────
export type Layer = 'ledger' | 'feed' | 'tip' | 'stats';

interface LayerRecord {
  id: string;
  layer: Layer;
  updatedAt: string | null;
}

export interface Evidence extends LayerRecord {
  layer: 'ledger';
  status: EvidenceStatus;
  occurredAt: string | null;  // ISO 8601. 날짜만 있을 수 있다
  placeName: string;
  lat: number | null;
  lng: number | null;
  claim: string;              // 한 문장
  election: string | null;
  type: EvidenceType;
  sources: EvidenceSource[];
  verification: EvidenceVerification;
  // 상세 화면의 매체 칸과 기록 지역 필터용
  description: string;
  regionWide: string | null;
  regionWideLabel: string | null;
  regionBasic: string | null;
  photos: EvidencePhoto[];
  mediaOther: EvidenceMediaOther[];
}

export interface FeedItem extends LayerRecord {
  layer: 'feed';
  source: string;            // feed_sources.id (olgung, jahyeok, ...)
  sentAt: string;
  text: string;
  url: string;
  evidenceId?: string;       // 기록으로 승격된 경우에만
}

// 공개 필드만 둔다. 제보자 이름, 전화, 계정은 `tip_contacts`에만 있다.
export interface Tip extends LayerRecord {
  layer: 'tip';
  status: TipStatus;
  placeName: string;
  sentAt: string;
  heard: string;             // 들은 내용 한 줄
  notClaimed: string;        // 확인하지 않은 항목 한 줄
}

export interface AnalysisRow {
  area: string;              // 구역 또는 장소
  value: number;
  unit: string;
}

export interface Analysis extends LayerRecord {
  layer: 'stats';
  title: string;
  question: string;
  period: string;
  universe: string;          // 모수
  method: [string, string, string, string]; // 방법 네 줄
  sourceTable: string;
  includedEvidenceIds: string[];
  excluded: ExcludedKind[];
  geo: 'choropleth' | 'dots'; // 한 분석에 하나만
  rows: AnalysisRow[];
}

export const EVIDENCE_TYPES: EvidenceType[] = ['사진', '영상', '음성', '문서'];

// 기록 정렬: 발생 시각 최신순, 시각이 없으면 뒤로. 같으면 id 역순.
export function compareLedger(a: Evidence, b: Evidence): number {
  if (a.occurredAt && b.occurredAt && a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
  if (!!a.occurredAt !== !!b.occurredAt) return a.occurredAt ? -1 : 1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

const blankVerification: EvidenceVerification = { seen: null, where: null, when: null, notClaimed: null };

// 행을 기록 레코드로 바꾼다. 기록 컬럼이 비어 있으면
// `scripts/migrate_to_ledger.py`와 같은 규칙으로 기존 컬럼에서 채운다.
export function toEvidence(row: EvidenceRow): Evidence {
  const coords = row.coordinates;
  const legacySource: EvidenceSource[] =
    row.source || row.source_url ? [{ title: row.source || row.source_url, url: row.source_url || null }] : [];
  const status =
    row.status && EVIDENCE_STATUSES.includes(row.status) ? row.status : defaultEvidenceStatus(hasMedia(row));
  return {
    id: row.id,
    layer: 'ledger',
    updatedAt: row.updated_at ?? null,
    status,
    occurredAt: row.occurred_at ?? null,
    placeName: row.place,
    lng: coords ? coords[0] : null,
    lat: coords ? coords[1] : null,
    claim: row.claim || legacyClaim(row),
    election: row.election ?? null,
    type: row.evidence_type,
    sources: row.sources?.length ? row.sources : legacySource,
    verification: { ...blankVerification, ...row.verification },
    description: row.description,
    regionWide: row.region_wide,
    regionWideLabel: row.region_wide_label,
    regionBasic: row.region_basic,
    photos: row.photos ?? [],
    mediaOther: row.media_other ?? [],
  };
}

// claim이 비어 있을 때의 대체 문장. 기존 title은 description 앞 50자를 자른 값이라
// 문장 중간에서 끊긴다. 잘린 경우에는 description 전체를 쓴다.
function legacyClaim(row: EvidenceRow): string {
  const d = (row.description ?? '').replace(/\s+/g, ' ').trim();
  const t = (row.title ?? '').trim();
  return d.length > t.length && d.startsWith(t) ? d : t;
}

function hasMedia(row: EvidenceRow): boolean {
  return (row.media_count ?? 0) > 0 || (row.photos?.length ?? 0) > 0 || (row.media_other?.length ?? 0) > 0;
}
