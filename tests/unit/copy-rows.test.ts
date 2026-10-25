// 0009: 행 복사. 옛 프로젝트 주소를 새 주소로 바꾸고 upsert로 올린다.
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error 타입 선언이 없는 Node 스크립트
import { copyRows } from '../../scripts/migrate/copy-rows.mjs';

const OLD = 'https://old.supabase.co';
const NEW = 'https://new.supabase.co';

describe('행 복사', () => {
  it('매체 주소의 옛 프로젝트 주소를 새 주소로 바꿔 upsert한다', async () => {
    const ev = [{ id: 'ev-1', photos: [{ thumb: `${OLD}/storage/v1/object/public/evidence-media/t/1.jpg` }], claim: '주장' }];
    const writes: { url: string; prefer: string; body: unknown }[] = [];
    const f = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') {
        writes.push({ url, prefer: (init.headers as Record<string, string>).Prefer, body: JSON.parse(String(init.body)) });
        return new Response('', { status: 201 });
      }
      return new Response(JSON.stringify(url.includes('/evidence?') ? ev : [{ id: 'olgung' }]));
    });
    const r = await copyRows({ from: { url: OLD, key: 'o' }, to: { url: `${NEW}/`, key: 'n' }, fetchImpl: f, log: () => {} });
    expect(r).toEqual({ evidence: 1, feed_sources: 1 });
    expect(writes[0].url).toBe(`${NEW}/rest/v1/evidence`);
    expect(writes[0].prefer).toContain('merge-duplicates');
    expect(JSON.stringify(writes[0].body)).not.toContain('old.supabase.co');
    expect((writes[0].body as typeof ev)[0].photos[0].thumb).toBe(`${NEW}/storage/v1/object/public/evidence-media/t/1.jpg`);
  });

  it('쓰기가 실패하면 멈춘다', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit = {}) => (init.method === 'POST' ? new Response('', { status: 400 }) : new Response('[{"id":"x"}]')));
    await expect(copyRows({ from: { url: OLD, key: 'o' }, to: { url: NEW, key: 'n' }, fetchImpl: f, log: () => {} })).rejects.toThrow('evidence 쓰기 실패');
  });
});
