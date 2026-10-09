// 경로별 title, description, canonical 경로, lastmod.
// 사전 렌더링과 클라이언트 내비게이션이 같은 함수를 쓴다.
import type { Dataset } from './data';
import { toEvidence, type Evidence } from '../types/evidence';
import { EVIDENCE_STATUS_LABEL, STATUS_DISCLAIMER } from './status';

export const SITE_NAME = '선거 증거 아카이브';
const DESCRIPTION_MAX = 150;

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  lastmod: string | null; // ISO 8601. 사이트맵 lastmod
}

// 2026-06-03T14:37:00+09:00 → "2026-06-03 14:37". 날짜만 있으면 날짜만.
export function formatOccurred(iso: string | null): string {
  if (!iso) return '날짜 미상';
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return '날짜 미상';
  return m[2] ? `${m[1]} ${m[2]}` : m[1];
}

export function sourceLabel(ev: Evidence): string {
  return ev.sources.length ? ev.sources.map((s) => s.title).join(', ') : '출처 미기재';
}

// 상세 첫 문단. 날짜, 장소, 상태, 출처가 한 문단에 들어간다(명세 6장 인용 단위).
export function leadSentence(ev: Evidence): string {
  return `${formatOccurred(ev.occurredAt)}, ${ev.placeName || '장소 미상'}. 상태 ${EVIDENCE_STATUS_LABEL[ev.status]}. 출처 ${sourceLabel(ev)}.`;
}

function clip(s: string, max = DESCRIPTION_MAX): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function latest(rows: { updated_at?: string }[]): string | null {
  let best: string | null = null;
  for (const r of rows) if (r.updated_at && (!best || r.updated_at > best)) best = r.updated_at;
  return best;
}

// 층 목록 페이지. 키워드를 반복하지 않고 층의 성격만 적는다.
const LAYER_META: Record<string, { title: string; description: string }> = {
  '/ledger': {
    title: '원장',
    description: `사진, 영상, 문서가 있고 날짜, 장소, 상태, 출처가 붙은 증거 카드 목록. 유형, 선거, 상태, 지역으로 거른다. ${STATUS_DISCLAIMER}`,
  },
  '/stats': {
    title: '통계',
    description: `원장과 공식 표를 계산한 분석 목록. 피드, 미확인 제보, 좌표 없는 카드는 모수와 지도에 넣지 않는다. ${STATUS_DISCLAIMER}`,
  },
  '/feed': { title: '피드', description: '외부 발신처의 소식 목록. 피드는 증거가 아니며, 원장 카드가 된 소식에만 원장 링크를 단다.' },
  '/tips': { title: '제보', description: '시민 제보 목록. 기본 상태는 미확인이며, 제보자의 이름과 연락처는 공개하지 않는다.' },
};

export function pageMeta(path: string, ds: Dataset): PageMeta | null {
  if (path === '/') {
    return {
      path,
      title: SITE_NAME,
      description: clip(
        `${SITE_NAME}. 2026 지방선거 사전투표, 본투표, 개표 과정의 사진·영상·문서를 날짜, 장소, 상태, 출처와 함께 기록한 증거 원장. ${STATUS_DISCLAIMER}`
      ),
      lastmod: latest(ds.evidence),
    };
  }
  const layer = LAYER_META[path];
  if (layer) return { path, title: `${layer.title} | ${SITE_NAME}`, description: clip(layer.description), lastmod: path === '/ledger' ? latest(ds.evidence) : null };
  const m = path.match(/^\/e\/([^/]+)$/);
  if (m) {
    const row = ds.evidence.find((e) => e.id === decodeURIComponent(m[1]));
    if (!row) return null;
    const ev = toEvidence(row);
    return {
      path,
      title: `${clip(ev.claim, 60)} | ${SITE_NAME}`,
      description: clip(`${leadSentence(ev)} ${ev.claim}`),
      lastmod: row.updated_at ?? null,
    };
  }
  return null;
}

// 빌드 때 HTML을 만드는 경로. /admin은 넣지 않는다.
export function prerenderPaths(ds: Dataset): string[] {
  return ['/', ...Object.keys(LAYER_META), ...ds.evidence.map((e) => `/e/${encodeURIComponent(e.id)}`)];
}
