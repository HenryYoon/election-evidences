import { describe, expect, it } from 'vitest';
import { CASES } from '../../src/content/cases';
import { casePathRecordIds, caseRows, casesVisible } from '../../src/lib/cases';
import type { Evidence } from '../../src/types/evidence';

const ev = (id: string) => ({ id, status: 'reported' }) as Evidence;

describe('대표 사례 데이터(0010 명세 2장)', () => {
  it('대표 유형은 3개이고 유형마다 증거 1건이다', () => {
    expect(CASES).toHaveLength(3);
    expect(new Set(CASES.map((c) => c.type)).size).toBe(3);
    expect(new Set(CASES.map((c) => c.record)).size).toBe(3);
  });
  it('설명은 2줄 이내(60자 이하)이고 제보임을 밝힌다', () => {
    for (const c of CASES) {
      expect(c.caption.length, c.type).toBeLessThanOrEqual(60);
      expect(c.caption, c.type).toMatch(/제보\.$/);
    }
  });
  it('검증 상태를 설명에 손으로 적지 않는다', () => {
    for (const c of CASES) expect(c.caption).not.toMatch(/문서 확인|영상 확인|검증|사실로 확인/);
  });
});

describe('초안 공개 조건(0010 명세 4장)', () => {
  it('운영 빌드에서는 초안을 빼고, 미리보기에서는 넣는다', () => {
    expect(casesVisible(false, 'draft')).toBe(false);
    expect(casesVisible(true, 'draft')).toBe(true);
    expect(casesVisible(false, 'published')).toBe(true);
  });
  it('대표 사례 경로에만 증거를 심는다', () => {
    expect(casePathRecordIds('/cases', true)).toEqual(CASES.map((c) => c.record));
    expect(casePathRecordIds('/records', true)).toBeNull();
  });
});

describe('대표 증거 찾기', () => {
  it('데이터에 없는 증거는 뺀다', () => {
    const rows = caseRows([ev(CASES[0].record), ev(CASES[2].record)]);
    expect(rows.map((r) => r.item.record)).toEqual([CASES[0].record, CASES[2].record]);
  });
});
