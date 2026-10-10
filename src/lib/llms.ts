// AI 에이전트용 출력물(0002 명세 2·3장): 사이트 색인 llms.txt와 기록별 마크다운.
// 문장은 상세 HTML과 같은 함수(leadSentence)로 만든다. 인용이 HTML과 어긋나지 않게 하기 위해서다.
// 공개 행만 받는다. 제보자 이름, 연락처, 비공개 기록은 여기에 오지 않는다.
import type { Dataset } from './data';
import { toEvidence, compareLedger, type Evidence } from '../types/evidence';
import { leadSentence, SITE_NAME } from './seo';
import {
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_LABEL,
  EVIDENCE_STATUS_LEGEND,
  STATUS_DISCLAIMER,
  VERIFICATION_FIELDS,
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
    `# ${SITE_NAME}`,
    '',
    '> 2026 지방선거 사전투표, 본투표, 개표 과정에서 나온 사진·영상·문서를 날짜, 장소, 상태, 출처와 함께 정리한 증거 기록이다.',
    '',
    `${STATUS_DISCLAIMER} 각 기록의 상태는 다음 넷 중 하나다.`,
    '',
    ...EVIDENCE_STATUSES.map((s) => `- ${EVIDENCE_STATUS_LABEL[s]}: ${EVIDENCE_STATUS_LEGEND[s]}`),
    '',
    '## 층',
    '',
    `- [기록](${site}/records): 사진, 영상, 문서가 있고 날짜, 장소, 상태, 출처가 붙은 증거 카드.`,
    `- [통계](${site}/stats): 기록과 공식 표를 계산한 분석. 피드와 미확인 제보는 모수에 넣지 않는다.`,
    `- [제보](${site}/tips): 시민 제보. 기본 상태는 미확인이다.`,
    '- 층끼리 건수를 합치지 않는다. 층마다 기록의 성격이 다르다.',
    '',
    `## 최근 기록 ${LLMS_RECENT}건`,
    '',
    `전체 기록 목록: [${site}${RECORDS_MD}](${site}${RECORDS_MD})`,
    '',
    '각 줄은 기록 하나다. 링크는 마크다운 판이고, 같은 내용의 HTML은 `.md`를 뺀 주소에 있다.',
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
    `# 기록 | ${SITE_NAME}`,
    '',
    `사진, 영상, 문서가 있고 날짜, 장소, 상태, 출처가 붙은 증거 카드 전체 목록이다. ${STATUS_DISCLAIMER}`,
    '',
    '각 줄은 기록 하나다. 링크는 마크다운 판이고, 같은 내용의 HTML은 `.md`를 뺀 주소에 있다.',
    '',
    ...records.map((ev) => recordLine(ev, site)),
    '',
    `HTML: ${site}/records`,
    '',
  ].join('\n');
}

export function evidenceMarkdown(ev: Evidence, site: string): string {
  const html = `${site}/e/${encodeURIComponent(ev.id)}`;
  const coord = ev.lat !== null && ev.lng !== null ? `${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)} (위도, 경도)` : '좌표 없음';
  const lines = [
    `# ${inline(ev.claim)}`,
    '',
    inline(leadSentence(ev)),
    '',
    `- 상태: ${EVIDENCE_STATUS_LABEL[ev.status]}. ${EVIDENCE_STATUS_LEGEND[ev.status]}`,
    `- 좌표: ${coord}`,
    `- 선거: ${ev.election ?? '미기재'}`,
    `- 유형: ${ev.type}`,
    '',
    '## 검증',
    '',
    ...VERIFICATION_FIELDS.map(([k, label]) => `- ${label}: ${ev.verification[k] ? inline(ev.verification[k]!) : '미기재'}`),
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
