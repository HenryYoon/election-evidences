// 경로별 title, description, canonical 경로, lastmod.
// 사전 렌더링과 클라이언트 내비게이션이 같은 함수를 쓴다.
import type { Dataset } from './data';
import { toEvidence, type Evidence } from '../types/evidence';
import { EVIDENCE_STATUS_LABEL, STATUS_DISCLAIMER } from './status';
import { CASES_LEAD, SITE_PURPOSE } from './site';
import { COPY, LANG_PAIRS, type Lang } from './i18n';
import { casesDraft, casesVisible } from './cases';

export const SITE_NAME = '선거부정진상규명국민신고센터';
export const SITE_SHORT = '선진국';
// 증거 화면이 드러내는 선거(0008 명세 3장).
export const ELECTION_NAME = '2026 지방선거';
const DESCRIPTION_MAX = 150;

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  lastmod: string | null; // ISO 8601. 사이트맵 lastmod
  lang?: Lang; // 없으면 한국어
  alternates?: { ko: string; en: string }; // 언어 짝이 있는 페이지(0007)
  noindex?: boolean; // 대표 사례 초안(0010 명세 4장). 사이트맵·llms.txt에서도 뺀다
}

// 영어 페이지(0007 명세). description은 한국어판과 같은 150자 상한을 지킨다.
const EN_META: Record<string, { title: string; description: string }> = {
  '/en': {
    title: COPY.en.siteName,
    description: "Photos, videos, and documents from Korea's 2026 local elections, published with date, place, source, and status. Status is not a legal conclusion.",
  },
  '/en/about': {
    title: `About | ${COPY.en.siteName}`,
    description: 'What the Citizen Report Center for Election Integrity collects, how it checks material, what each status means, and what it does not do.',
  },
};

function pairOf(path: string): { ko: string; en: string } | undefined {
  const p = LANG_PAIRS.find(([ko, en]) => ko === path || en === path);
  return p ? { ko: p[0], en: p[1] } : undefined;
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

// 층 목록 페이지와 소개. 키워드를 반복하지 않고 페이지의 성격만 적는다.
const LAYER_META: Record<string, { title: string; description: string }> = {
  '/records': {
    title: `${ELECTION_NAME} 증거`,
    description: `${ELECTION_NAME} 사전투표, 본투표, 개표 과정의 사진, 영상, 문서. 날짜, 장소, 상태, 출처가 붙어 있고 유형, 상태, 지역으로 거를 수 있습니다. ${STATUS_DISCLAIMER}`,
  },
  '/tips': { title: '제보', description: '선거 과정에서 보거나 겪은 일을 제보받습니다. 사진·영상·문서 파일을 함께 보낼 수 있습니다. 운영진 검수를 거쳐 채택한 내용만 공개하고, 이름과 연락처는 공개하지 않습니다.' },
  '/contact': {
    title: '문의',
    description: '문의, 건의, 기록 정정 요청, 개인정보 요청을 받습니다. 보낸 내용은 운영진에게만 전달되고 공개하지 않습니다.',
  },
  '/privacy': {
    title: '개인정보 처리방침',
    description: '제보와 문의를 받는 데 필요한 개인정보의 처리 목적, 항목, 보유 기간, 파기, 처리 위탁과 국외 이전, 정보주체의 권리와 행사 방법, 안전성 확보 조치를 안내합니다.',
  },
  '/about': {
    title: '소개',
    description: `${SITE_PURPOSE} 상태 두 가지의 뜻, 검증 네 줄, 하지 않는 것, 정정 요청 방법을 안내합니다. ${STATUS_DISCLAIMER}`,
  },
};

export function pageMeta(path: string, ds: Dataset): PageMeta | null {
  const en = EN_META[path];
  if (en) {
    return {
      path,
      title: en.title,
      description: clip(en.description),
      lastmod: path === '/en' ? latest(ds.evidence) : null,
      lang: 'en',
      alternates: pairOf(path),
    };
  }
  if (path === '/') {
    return {
      alternates: pairOf(path),
      path,
      title: SITE_NAME,
      description: clip(
        `${SITE_NAME}(${SITE_SHORT}). ${SITE_PURPOSE} ${STATUS_DISCLAIMER}`
      ),
      lastmod: latest(ds.evidence),
    };
  }
  const layer = LAYER_META[path];
  if (layer) {
    return {
      path,
      title: `${layer.title} | ${SITE_NAME}`,
      description: clip(layer.description),
      lastmod: path === '/records' ? latest(ds.evidence) : null,
      alternates: pairOf(path),
    };
  }
  if (path === '/cases' && casesVisible()) {
    return { path, title: `대표 사례 | ${SITE_NAME}`, description: clip(`${ELECTION_NAME} 제보 가운데 유형별 대표 사례. ${CASES_LEAD}`), lastmod: null, noindex: casesDraft() };
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
  return [
    '/',
    ...Object.keys(LAYER_META),
    ...Object.keys(EN_META),
    ...(casesVisible() ? ['/cases'] : []),
    ...ds.evidence.map((e) => `/e/${encodeURIComponent(e.id)}`),
  ];
}
