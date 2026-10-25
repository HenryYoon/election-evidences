// 0007: 언어 짝 주소와 문구. 한국어 문구는 기존 상수와 같아야 한다.
import { describe, expect, it } from 'vitest';
import { COPY, counterpart, langOf, langPath } from '../../src/lib/i18n';
import { SITE_NAME } from '../../src/lib/seo';
import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL, STATUS_DISCLAIMER } from '../../src/lib/status';
import { pageMeta, prerenderPaths } from '../../src/lib/seo';

const ds = { evidence: [] } as unknown as Parameters<typeof pageMeta>[1];

describe('언어 짝', () => {
  it('짝이 있으면 짝으로, 없으면 다른 언어 메인으로 간다', () => {
    expect(counterpart('/')).toBe('/en');
    expect(counterpart('/en')).toBe('/');
    expect(counterpart('/about')).toBe('/en/about');
    expect(counterpart('/en/about')).toBe('/about');
    expect(counterpart('/records')).toBe('/en');
    expect(counterpart('/e/ev-1')).toBe('/en');
  });
  it('주소로 언어를 안다', () => {
    expect(langOf('/en')).toBe('en');
    expect(langOf('/en/about')).toBe('en');
    expect(langOf('/entry')).toBe('ko');
    expect(langPath('en', '/')).toBe('/en');
    expect(langPath('ko', '/about')).toBe('/about');
  });
});

describe('문구', () => {
  it('한국어 문구는 기존 상수와 같다', () => {
    expect(COPY.ko.siteName).toBe(SITE_NAME);
    expect(COPY.ko.disclaimer).toBe(STATUS_DISCLAIMER);
    expect(COPY.ko.statusLabel).toEqual(EVIDENCE_STATUS_LABEL);
  });
  it('영어 문구는 모든 상태와 검증 줄을 덮는다', () => {
    for (const s of EVIDENCE_STATUSES) {
      expect(COPY.en.statusLabel[s]).toBeTruthy();
      expect(COPY.en.statusLegend[s]).toBeTruthy();
    }
  });
});

describe('메타', () => {
  it('영어 페이지는 lang과 언어 짝을 갖고, 사전 렌더링 목록에 있다', () => {
    expect(pageMeta('/en', ds)).toMatchObject({ lang: 'en', alternates: { ko: '/', en: '/en' } });
    expect(pageMeta('/about', ds)?.alternates).toEqual({ ko: '/about', en: '/en/about' });
    expect(pageMeta('/records', ds)?.alternates).toBeUndefined();
    expect(prerenderPaths(ds)).toEqual(expect.arrayContaining(['/en', '/en/about']));
  });
});
