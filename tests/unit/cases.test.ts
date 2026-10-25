import { describe, expect, it } from 'vitest';
import { CASES, type CaseFile } from '../../src/content/cases';
import { caseEvidence, casePathRecordIds, caseStats, recordNumber, visibleCases } from '../../src/lib/cases';
import type { Evidence } from '../../src/types/evidence';

const ev = (id: string, status: Evidence['status']) => ({ id, status }) as Evidence;

describe('정리 글 데이터(0010 명세 2장)', () => {
  it('slug가 겹치지 않고 주소에 쓸 수 있다', () => {
    const slugs = CASES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });
  it('문단의 근거 증거는 모두 연결 증거 목록에 있다', () => {
    for (const c of CASES) {
      const ids = new Set(c.records);
      for (const s of c.sections) for (const p of s.paragraphs) {
        expect(p.records.length).toBeGreaterThan(0);
        for (const id of p.records) expect(ids.has(id), `${c.slug}: ${id}`).toBe(true);
      }
    }
  });
  it('연결 증거는 모두 본문 어딘가에서 근거로 쓰인다', () => {
    for (const c of CASES) {
      const cited = new Set(c.sections.flatMap((s) => s.paragraphs.flatMap((p) => p.records)));
      for (const id of c.records) expect(cited.has(id), `${c.slug}: ${id}`).toBe(true);
    }
  });
  it('요약은 description 길이(150자) 안이다', () => {
    for (const c of CASES) expect(c.summary.length).toBeLessThanOrEqual(150);
  });
  it('검증 상태를 글에 손으로 적지 않는다', () => {
    for (const c of CASES) {
      const text = JSON.stringify(c.sections);
      expect(text).not.toMatch(/문서 확인|영상 확인|검증됐|사실로 확인/);
    }
  });
});

describe('초안 공개 조건(0010 명세 4장)', () => {
  const draft = { ...CASES[0], slug: 'd', state: 'draft' } as CaseFile;
  const pub = { ...CASES[0], slug: 'p', state: 'published' } as CaseFile;
  it('운영 빌드에서는 초안을 빼고, 미리보기에서는 넣는다', () => {
    expect(visibleCases(false, [draft, pub]).map((c) => c.slug)).toEqual(['p']);
    expect(visibleCases(true, [draft, pub]).map((c) => c.slug)).toEqual(['d', 'p']);
  });
  it('보이지 않는 초안 경로에는 증거를 심지 않는다', () => {
    const slug = CASES[0].slug;
    expect(casePathRecordIds(`/cases/${slug}`, CASES[0].state === 'published')).toEqual(CASES[0].state === 'published' ? [...CASES[0].records] : null);
    expect(casePathRecordIds(`/cases/${slug}`, true)).toEqual([...CASES[0].records]);
    expect(casePathRecordIds('/records', true)).toBeNull();
  });
});

describe('검증 상태 집계(0010 명세 3장)', () => {
  it('데이터에 없는 증거는 빼고 상태별로 센다', () => {
    const c = { ...CASES[0], records: ['ev-1', 'ev-2', 'ev-3', 'ev-gone'] } as CaseFile;
    const list = caseEvidence(c, [ev('ev-1', 'reported'), ev('ev-2', 'document'), ev('ev-3', 'allegation')]);
    expect(list.map((e) => e.id)).toEqual(['ev-1', 'ev-2', 'ev-3']);
    const s = caseStats(list);
    expect(s.total).toBe(3);
    expect(s.verified).toBe(1);
    expect(s.byStatus.reported).toBe(1);
  });
  it('증거 번호를 화면 번호로 바꾼다', () => {
    expect(recordNumber('ev-014')).toBe('14');
    expect(recordNumber('ev-100')).toBe('100');
  });
});
