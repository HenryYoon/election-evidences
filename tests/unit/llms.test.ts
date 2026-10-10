// 0002 명세 2·3장: llms.txt와 기록별 마크다운.
import { describe, expect, it } from 'vitest';
import { llmsTxt, recordsMarkdown, evidenceMarkdown, markdownPath, LLMS_RECENT } from '../../src/lib/llms';
import { leadSentence } from '../../src/lib/seo';
import { toEvidence, type EvidenceRow } from '../../src/types/evidence';
import fixture from '../fixtures/evidence.json';

const rows = fixture.evidence as unknown as EvidenceRow[];
const SITE = 'https://desk.example';

describe('llms.txt', () => {
  const txt = llmsTxt({ evidence: rows }, SITE);

  it('사이트 이름 H1, 요약 인용 블록, 상태 고지로 시작한다', () => {
    expect(txt.startsWith('# ')).toBe(true);
    expect(txt).toMatch(/\n> .+/);
    expect(txt).toContain('상태는 조사 분류이며 법적 결론이 아니다.');
  });

  it('최근 기록만 싣고 전체 목록 주소를 둔다', () => {
    const many = Array.from({ length: LLMS_RECENT + 5 }, (_, i) => ({ ...rows[0], id: `ev-${700 + i}` }));
    const t = llmsTxt({ evidence: many }, SITE);
    expect(t.match(/\.md\): /g)).toHaveLength(LLMS_RECENT);
    expect(t).toContain(`${SITE}/records.md`);
  });

  it('전체 목록은 공개 기록마다 마크다운 주소와 상세 첫 문장을 한 줄로 둔다', () => {
    const all = recordsMarkdown({ evidence: rows }, SITE);
    for (const r of rows) {
      const ev = toEvidence(r);
      expect(all).toContain(`(${SITE}${markdownPath(ev.id)}): ${leadSentence(ev)}`);
    }
  });

  it('제보 원문 칸(reporter)을 넣지 않는다', () => {
    const withReporter = rows.map((r) => ({ ...r, reporter: '자리표시이름' }));
    expect(llmsTxt({ evidence: withReporter }, SITE)).not.toContain('자리표시이름');
  });
});

describe('기록 마크다운', () => {
  const ev = toEvidence(rows[0]);
  const md = evidenceMarkdown(ev, SITE);

  it('H1은 주장, 첫 문단은 상세 첫 문장과 같다', () => {
    const [h1, , lead] = md.split('\n');
    expect(h1).toBe(`# ${ev.claim}`);
    expect(lead).toBe(leadSentence(ev));
  });

  it('좌표는 위도, 경도 순으로 쓴다', () => {
    expect(md).toContain(`${ev.lat!.toFixed(5)}, ${ev.lng!.toFixed(5)} (위도, 경도)`);
  });

  it('마크다운 문법 문자를 이스케이프한다', () => {
    const tricky = toEvidence({ ...rows[0], claim: '[링크](javascript:x) *굵게*' });
    expect(evidenceMarkdown(tricky, SITE).split('\n')[0]).toBe('# \\[링크\\](javascript:x) \\*굵게\\*');
  });
});

describe('JSON-LD', () => {
  it('홈은 WebSite, 상세는 Article이고 ClaimReview를 쓰지 않는다', async () => {
    const { jsonLd } = await import('../../src/lib/llms');
    expect(jsonLd(null, SITE, '설명')['@type']).toBe('WebSite');
    const a = jsonLd(toEvidence(rows[0]), SITE, '설명');
    expect(a['@type']).toBe('Article');
    expect(JSON.stringify(a)).not.toContain('ClaimReview');
    expect(String(a.genre)).toContain('법적 결론이 아니다');
  });

  it('좌표는 위도·경도를 바르게 넣는다', async () => {
    const { jsonLd } = await import('../../src/lib/llms');
    const ev = toEvidence(rows[0]);
    const place = jsonLd(ev, SITE, '설명').contentLocation as { geo: { latitude: number; longitude: number } };
    expect(place.geo).toEqual({ '@type': 'GeoCoordinates', latitude: ev.lat, longitude: ev.lng });
  });

  it('스크립트 태그 탈출을 막는다', async () => {
    const { jsonLd, jsonLdScript } = await import('../../src/lib/llms');
    const ev = toEvidence({ ...rows[0], claim: '</script><script>alert(1)</script>' });
    expect(jsonLdScript(jsonLd(ev, SITE, 'x')).match(/<\/script>/g)).toHaveLength(1);
  });
});
