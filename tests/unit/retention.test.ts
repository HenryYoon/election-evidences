// 0005 명세 4장: 매일 파기 스크립트. 첨부를 지운 제보만 행 파기에 넘긴다.
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error 타입 선언이 없는 Node 스크립트
import { runRetention } from '../../scripts/retention.mjs';

type Call = [string, RequestInit];

function fakeSupabase(due: string[], files: Record<string, string[]>, failDelete: string[] = []) {
  return vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith('/rest/v1/rpc/retention_due_tips')) return new Response(JSON.stringify(due));
    if (url.includes('/storage/v1/object/list/tip-uploads')) return new Response(JSON.stringify((files[body.prefix] ?? []).map((name) => ({ name }))));
    if (init.method === 'DELETE') {
      const id = String(body.prefixes[0]).split('/')[0];
      return new Response('[]', { status: failDelete.includes(id) ? 500 : 200 });
    }
    if (url.endsWith('/rest/v1/rpc/apply_retention')) return new Response(JSON.stringify({ tips_deleted: body.p_purged.length }));
    return new Response('', { status: 404 });
  });
}

describe('개인정보 파기', () => {
  it('첨부 파일을 지운 뒤 행 파기를 부른다', async () => {
    const f = fakeSupabase(['t1', 't2'], { t1: ['1.jpg', '2.pdf'] });
    const r = await runRetention({ url: 'https://db.example/', key: 'k', fetchImpl: f, log: () => {} });
    expect(r).toMatchObject({ due: 2, files: 2, failed: 0 });
    const del = f.mock.calls.find((c) => (c as unknown as Call)[1].method === 'DELETE') as unknown as Call;
    expect(del[0]).toBe('https://db.example/storage/v1/object/tip-uploads');
    expect(JSON.parse(String(del[1].body))).toEqual({ prefixes: ['t1/1.jpg', 't1/2.pdf'] });
    const apply = f.mock.calls.at(-1) as unknown as Call;
    expect(apply[0]).toBe('https://db.example/rest/v1/rpc/apply_retention');
    expect(JSON.parse(String(apply[1].body))).toEqual({ p_purged: ['t1', 't2'] });
  });
  it('첨부 삭제에 실패한 제보는 행을 남겨 다음 날 다시 시도한다', async () => {
    const f = fakeSupabase(['t1', 't2'], { t1: ['1.jpg'], t2: ['1.jpg'] }, ['t1']);
    const r = await runRetention({ url: 'https://db.example', key: 'k', fetchImpl: f, log: () => {} });
    expect(r.failed).toBe(1);
    const apply = f.mock.calls.at(-1) as unknown as Call;
    expect(JSON.parse(String(apply[1].body))).toEqual({ p_purged: ['t2'] });
  });
  it('비밀 키와 제보 id를 출력하지 않는다', async () => {
    const lines: string[] = [];
    await runRetention({ url: 'https://db.example', key: 'secret-key', fetchImpl: fakeSupabase(['tip-abc'], {}), log: (s: string) => lines.push(s) });
    expect(lines.join('\n')).not.toMatch(/secret-key|tip-abc/);
  });
});
