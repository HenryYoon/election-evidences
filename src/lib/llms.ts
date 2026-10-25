// AI 에이전트용 출력물(0002 명세 2·3장): 사이트 색인 llms.txt와 기록별 마크다운.
// 문장은 상세 HTML과 같은 함수(leadSentence)로 만든다. 인용이 HTML과 어긋나지 않게 하기 위해서다.
// 공개 행만 받는다. 제보자 이름, 연락처, 비공개 기록은 여기에 오지 않는다.
import type { Dataset } from './data';
import { toEvidence, compareLedger, type Evidence } from '../types/evidence';
import { ELECTION_NAME, leadSentence, SITE_NAME, SITE_SHORT } from './seo';
import { SITE_PURPOSE } from './site';
import { CASES_PATH, casesDraft, casesVisible } from './cases';
import {
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_LABEL,
  EVIDENCE_STATUS_LEGEND,
  STATUS_DISCLAIMER,
} from './status';

export const markdownPath = (id: string) => `/e/${encodeURIComponent(id)}.md`;

// 마크다운 링크 텍스트와 본문에서 문법 문자가 깨지지 않게 한다.
const inline = (s: string) => s.replace(/\s+/g, ' ').replace(/([\\[\]*_`<>])/g, '\\$1').trim();

export const RECORDS_MD = '/records.md';
// llms.txt는 권장 크기(약 5K 토큰) 안에 두려고 최근 기록만 싣는다. 전체 목록은 RECORDS_MD에 있다.
export const LLMS_RECENT = 20;

const recordLine = (ev: Evidence, site: string) => `- [${inline(ev.claim)}](${site}${markdownPath(ev.id)}): ${inline(leadSentence(ev))}`;

export function llmsTxt(ds: Dataset, site: string): string {
  const records = ds.evidence.map(toEvidence).sort(compareLedger).slice(0, LLMS_RECENT);
  const lines = [
    `# ${SITE_NAME}(${SITE_SHORT})`,
    '',
    `> ${SITE_PURPOSE}`,
    '',
    `${STATUS_DISCLAIMER} 각 증거의 상태는 다음 둘 중 하나입니다.`,
    '',
    ...EVIDENCE_STATUSES.map((s) => `- ${EVIDENCE_STATUS_LABEL[s]}: ${EVIDENCE_STATUS_LEGEND[s]}`),
    '',
    '## 층',
    '',
    `- [${ELECTION_NAME} 증거](${site}/records): 사진, 영상, 문서가 있고 날짜, 장소, 상태, 출처가 붙은 증거 카드.`,
    `- [제보](${site}/tips): 제보 접수 폼. 제보는 공개하지 않고, 운영진 검수를 거쳐 채택한 내용만 증거로 공개합니다.`,
    `- [소개](${site}/about): 목적, 상태의 뜻, 하지 않는 것, 정정 요청 방법.`,
    `- [문의](${site}/contact): 문의, 건의, 증거 정정 요청, 개인정보 요청.`,
    `- [English](${site}/en): 메인과 소개의 영어판. 증거 카드는 아직 한국어입니다.`,
    '- 증거와 제보의 건수를 합치지 않습니다. 제보는 검수를 거쳐야 증거가 됩니다.',
    // 공개한 대표 사례만 싣는다. 초안은 넣지 않는다(0010 명세 4장).
    ...(casesVisible() && !casesDraft() ? [`- [대표 사례](${site}${CASES_PATH}): 제보가 많은 유형별 대표 증거 한 건씩. 사진과 두 줄 설명.`] : []),
    '',
    `## 최근 증거 ${LLMS_RECENT}건`,
    '',
    `전체 증거 목록: [${site}${RECORDS_MD}](${site}${RECORDS_MD})`,
    '',
    '각 줄은 증거 하나입니다. 링크는 마크다운 판이고, 같은 내용의 HTML은 `.md`를 뺀 주소에 있습니다.',
    '',
    ...records.map((ev) => recordLine(ev, site)),
    '',
  ];
  return lines.join('\n');
}

// 전체 기록 목록. 발생 시각 최신순이고 시각 없는 기록은 뒤에 둔다.
export function recordsMarkdown(ds: Dataset, site: string): string {
  const records = ds.evidence.map(toEvidence).sort(compareLedger);
  return [
    `# ${ELECTION_NAME} 증거 | ${SITE_NAME}`,
    '',
    `${ELECTION_NAME} 사전투표, 본투표, 개표 과정의 사진, 영상, 문서 전체 목록입니다. 날짜, 장소, 상태, 출처가 붙어 있습니다. ${STATUS_DISCLAIMER}`,
    '',
    '각 줄은 증거 하나입니다. 링크는 마크다운 판이고, 같은 내용의 HTML은 `.md`를 뺀 주소에 있습니다.',
    '',
    ...records.map((ev) => recordLine(ev, site)),
    '',
    `HTML: ${site}/records`,
    '',
  ].join('\n');
}

export function evidenceMarkdown(ev: Evidence, site: string): string {
  const html = `${site}/e/${encodeURIComponent(ev.id)}`;
  const lines = [
    `# ${inline(ev.claim)}`,
    '',
    inline(leadSentence(ev)),
    '',
    `- 상태: ${EVIDENCE_STATUS_LABEL[ev.status]}. ${EVIDENCE_STATUS_LEGEND[ev.status]}`,
    `- 선거: ${ev.election ?? '미기재'}`,
    `- 유형: ${ev.type}`,
    '',
    '## 출처',
    '',
    ...(ev.sources.length
      ? ev.sources.map((s) => `- ${s.url ? `[${inline(s.title)}](${s.url})` : inline(s.title)}`)
      : ['- 출처 미기재']),
    '',
  ];
  if (ev.description && ev.description !== ev.claim) {
    lines.push('## 제보 내용', '', inline(ev.description), '');
  }
  lines.push('---', '', `${STATUS_DISCLAIMER} HTML: ${html}`, '');
  return lines.join('\n');
}

// JSON-LD(0001 플랜 8단계). 정리용이다. 판정을 뜻하는 ClaimReview는 쓰지 않는다.
// 상태는 조사 분류이지 판정이 아니기 때문이다.
export function jsonLd(ev: Evidence | null, site: string, description: string): Record<string, unknown> {
  if (!ev) {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${site}/`,
      description,
      inLanguage: 'ko',
    };
  }
  const place: Record<string, unknown> = { '@type': 'Place', name: ev.placeName || '장소 미상' };
  if (ev.lat !== null && ev.lng !== null) place.geo = { '@type': 'GeoCoordinates', latitude: ev.lat, longitude: ev.lng };
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: ev.claim.length > 110 ? `${ev.claim.slice(0, 109)}…` : ev.claim,
    description,
    url: `${site}/e/${encodeURIComponent(ev.id)}`,
    inLanguage: 'ko',
    ...(ev.updatedAt ? { dateModified: ev.updatedAt } : {}),
    contentLocation: place,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${site}/` },
    ...(ev.sources.some((s) => s.url) ? { isBasedOn: ev.sources.filter((s) => s.url).map((s) => s.url) } : {}),
    // 상태 이름과 고지 문장을 함께 둔다. 판정으로 읽히지 않게 하기 위해서다.
    genre: `${EVIDENCE_STATUS_LABEL[ev.status]} (${STATUS_DISCLAIMER})`,
  };
}

// <script> 안에 넣을 JSON. </script> 탈출을 막는다.
export function jsonLdScript(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
