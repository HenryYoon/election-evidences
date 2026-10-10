// CLAUDE.md "Claude가 자주 틀리는 것"과 명세 4장의 규칙을 코드 수준에서 고정한다.
import { describe, expect, it } from 'vitest';
import { toEvidence, compareLedger, type EvidenceRow } from '../../src/types/evidence';
import { defaultEvidenceStatus, EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL, EVIDENCE_STATUS_LEGEND } from '../../src/lib/status';
import { applyFilters, NO_FILTERS } from '../../src/lib/data';
import { formatOccurred, leadSentence, pageMeta, prerenderPaths } from '../../src/lib/seo';
import { snapshotScript } from '../../src/lib/snapshot';
import fixture from '../fixtures/evidence.json';

const rows = fixture.evidence as unknown as EvidenceRow[];
const row = (over: Partial<EvidenceRow> = {}): EvidenceRow => ({ ...rows[0], ...over });

describe('상태', () => {
  it('기본 상태는 자료 유무만 보고 reported나 allegation만 돌려준다', () => {
    expect(defaultEvidenceStatus(true)).toBe('reported');
    expect(defaultEvidenceStatus(false)).toBe('allegation');
  });

  it('상태가 비어 있는 행을 document나 video_confirmed로 올리지 않는다', () => {
    for (const media_count of [0, 1, 50]) {
      const ev = toEvidence(row({ status: null, media_count, photos: [], media_other: [] }));
      expect(['reported', 'allegation']).toContain(ev.status);
    }
  });

  it('관리자가 수동으로 지정한 상태는 그대로 둔다', () => {
    expect(toEvidence(row({ status: 'video_confirmed' })).status).toBe('video_confirmed');
  });

  it('알 수 없는 상태 값은 기본 규칙으로 되돌린다', () => {
    expect(toEvidence(row({ status: 'confirmed' as never, media_count: 0, photos: [] })).status).toBe('allegation');
  });

  it('모든 상태에 라벨과 범례 문구가 있다', () => {
    for (const s of EVIDENCE_STATUSES) {
      expect(EVIDENCE_STATUS_LABEL[s]).toBeTruthy();
      expect(EVIDENCE_STATUS_LEGEND[s]).toBeTruthy();
    }
  });
});

describe('좌표', () => {
  it('coordinates는 [lng, lat] 순서로 읽는다', () => {
    const ev = toEvidence(row({ coordinates: [126.97942, 37.59895] }));
    expect(ev.lng).toBe(126.97942);
    expect(ev.lat).toBe(37.59895);
  });

  it('좌표가 없으면 lat, lng 모두 null이다', () => {
    const ev = toEvidence(row({ coordinates: null }));
    expect(ev.lat).toBeNull();
    expect(ev.lng).toBeNull();
  });
});

describe('기록 매핑', () => {
  it('claim이 비면 잘리지 않은 description을 쓴다', () => {
    const d = '가'.repeat(80);
    expect(toEvidence(row({ claim: null, title: d.slice(0, 50), description: d })).claim).toBe(d);
  });

  it('sources가 비면 기존 source, source_url에서 만든다', () => {
    const ev = toEvidence(row({ sources: [], source: '언론 보도', source_url: 'https://example.com/a' }));
    expect(ev.sources).toEqual([{ title: '언론 보도', url: 'https://example.com/a' }]);
  });

  it('검증 네 줄은 비어 있으면 null이다', () => {
    expect(toEvidence(row({ verification: {} })).verification).toEqual({ seen: null, where: null, when: null, notClaimed: null });
  });

  it('기록은 발생 시각 최신순이고 시각 없는 카드는 뒤로 간다', () => {
    const sorted = rows.map(toEvidence).sort(compareLedger).map((e) => e.id);
    expect(sorted).toEqual(['ev-901', 'ev-902', 'ev-903']);
  });

  it('필터는 유형, 선거, 상태, 지역을 모두 적용한다', () => {
    const all = rows.map(toEvidence);
    expect(applyFilters(all, NO_FILTERS)).toHaveLength(3);
    expect(applyFilters(all, { ...NO_FILTERS, status: 'allegation' }).map((e) => e.id)).toEqual(['ev-902']);
    expect(applyFilters(all, { ...NO_FILTERS, region: '서울', type: '사진' }).map((e) => e.id)).toEqual(['ev-901']);
  });
});

describe('회수용 문장과 메타', () => {
  it('상세 첫 문장에 날짜, 장소, 상태, 출처가 들어간다', () => {
    const s = leadSentence(toEvidence(rows[0]));
    expect(s).toContain('2026-06-03 14:37');
    expect(s).toContain('종로구 테스트 투표소');
    expect(s).toContain('상태 자료 접수');
    expect(s).toContain('출처 카카오톡 제보');
  });

  it('날짜가 없으면 날짜 미상, 출처가 없으면 출처 미기재로 쓴다', () => {
    const s = leadSentence(toEvidence(rows[2]));
    expect(s).toContain('날짜 미상');
    expect(s).toContain('출처 미기재');
  });

  it('날짜만 있으면 시각을 지어내지 않는다', () => {
    expect(formatOccurred('2026-06-03')).toBe('2026-06-03');
  });

  it('모든 사전 렌더링 경로에 150자 안팎 description이 있고 /admin은 없다', () => {
    const ds = { evidence: rows };
    const paths = prerenderPaths(ds);
    expect(paths).not.toContain('/admin');
    for (const p of paths) {
      const m = pageMeta(p, ds);
      expect(m, p).not.toBeNull();
      expect(m!.description.length, p).toBeLessThanOrEqual(150);
    }
  });

  it('스냅샷 스크립트는 </script> 탈출을 막는다', () => {
    const html = snapshotScript({ evidence: [row({ description: '</script><script>alert(1)</script>' })] });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
