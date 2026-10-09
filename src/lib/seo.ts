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
  return ['/', ...ds.evidence.map((e) => `/e/${encodeURIComponent(e.id)}`)];
}
