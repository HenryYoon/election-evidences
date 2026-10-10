// 0002 플랜: 점수 기준은 최근 4회 평균으로 자동 갱신한다.
import { describe, expect, it } from 'vitest';
// @ts-expect-error 점검 스크립트는 JS다.
import { baselineFrom, belowBaseline, WINDOW } from '../../scripts/reach/report-scores.mjs';

const run = (performance: number, agenticSeo: number | null = 59) => ({
  lighthouse: { performance, accessibility: 100, 'best-practices': 96, seo: 100 },
  agenticSeo,
});
const fallback = { lighthouse: { performance: 77, accessibility: 100, 'best-practices': 96, seo: 100 }, agenticSeo: 59 };

describe('점수 기준 자동 갱신', () => {
  it('최근 4회만 평균한다', () => {
    const runs = [run(10), run(80), run(90), run(100), run(70)];
    expect(WINDOW).toBe(4);
    expect(baselineFrom(runs, fallback).lighthouse.performance).toBe(85);
  });

  it('값이 없는 회차는 빼고 평균한다', () => {
    const runs = [run(80, null), run(80, 50), run(80, 60)];
    expect(baselineFrom(runs, fallback).agenticSeo).toBe(55);
  });

  it('기록이 2회 미만이면 고정 기준을 쓴다', () => {
    expect(baselineFrom([run(99)], fallback).lighthouse.performance).toBe(77);
  });

  it('허용 폭 안의 하락은 경고하지 않는다', () => {
    expect(belowBaseline(80, 85, 'performance')).toBe(false);
    expect(belowBaseline(79, 85, 'performance')).toBe(true);
    expect(belowBaseline(98, 100, 'seo')).toBe(false);
    expect(belowBaseline(97, 100, 'seo')).toBe(true);
  });
});
