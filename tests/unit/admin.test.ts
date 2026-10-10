// 0001 플랜 7단계: 관리자 기록 편집 검사와 재빌드 함수의 관리자 확인.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeLedgerDraft, validateLedgerDraft } from '../../src/lib/adminLedger';
// @ts-expect-error 서버 함수는 JS다.
import handler from '../../api/rebuild.js';

const base = { claim: '투표소 CCTV가 가려져 있었다.', status: 'reported' as const, occurred_at: '2026-06-03', sources: [] };

describe('기록 편집 검사', () => {
  it('정상 초안은 통과한다', () => {
    expect(validateLedgerDraft(base)).toEqual([]);
  });

  it('주장이 비면 막는다', () => {
    expect(validateLedgerDraft({ ...base, claim: ' ' })).toHaveLength(1);
  });

  it('발생 시각 형식을 검사한다', () => {
    expect(validateLedgerDraft({ ...base, occurred_at: '2026-06-03T14:37:00+09:00' })).toEqual([]);
    expect(validateLedgerDraft({ ...base, occurred_at: '6월 3일' })).toHaveLength(1);
  });

  it('문서 확인·영상 확인은 검증 네 줄을 모두 채워야 한다', () => {
    const partial = { ...base, status: 'video_confirmed' as const, verification: { seen: '봉인지', where: '', when: null, notClaimed: null } };
    expect(validateLedgerDraft(partial).join()).toContain('장소, 시각, 주장하지 않는 것');
    const full = { ...partial, verification: { seen: '봉인지', where: '종로구', when: '14:37', notClaimed: '조작 여부' } };
    expect(validateLedgerDraft(full)).toEqual([]);
  });

  it('출처 주소는 http(s)만 받는다', () => {
    expect(validateLedgerDraft({ ...base, sources: [{ title: '보도', url: 'javascript:alert(1)' }] })).toHaveLength(1);
  });

  it('저장 전 빈 출처 줄과 빈 값을 정리한다', () => {
    const n = normalizeLedgerDraft({
      ...base,
      election: ' ',
      occurred_at: '',
      sources: [{ title: ' 언론 보도 ', url: '' }, { title: '', url: null }],
      verification: { seen: ' 봉인지 ' },
      photos: [{ thumb: 'a', view: 'a' }],
      media_other: [],
    });
    expect(n.sources).toEqual([{ title: '언론 보도', url: null }]);
    expect(n.verification).toEqual({ seen: '봉인지', where: null, when: null, notClaimed: null });
    expect(n.occurred_at).toBeNull();
    expect(n.election).toBeNull();
    expect(n.media_count).toBe(1);
  });
});

describe('재빌드 함수', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  function call(headers: Record<string, string> = {}, method = 'POST') {
    const res: { code?: number; body?: unknown; setHeader: () => void; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
      setHeader: () => {},
      status(c) { this.code = c; return this; },
      json(b) { this.body = b; return this; },
    };
    return handler({ method, headers }, res).then(() => res);
  }

  function setup(isAdmin: boolean | 'invalid') {
    Object.assign(process.env, { VITE_SUPABASE_URL: 'https://db.example', VITE_SUPABASE_ANON_KEY: 'anon', DEPLOY_HOOK_URL: 'https://hook.example' });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/rpc/is_admin')) {
        return isAdmin === 'invalid' ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(isAdmin));
      }
      return new Response('{}', { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('토큰이 없으면 401이고 Deploy Hook을 부르지 않는다', async () => {
    const f = setup(true);
    expect((await call()).code).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it('관리자가 아니면 403이고 Deploy Hook을 부르지 않는다', async () => {
    const f = setup(false);
    expect((await call({ authorization: 'Bearer t' })).code).toBe(403);
    expect(f.mock.calls.map((c) => c[0])).not.toContain('https://hook.example');
  });

  it('위조 토큰이면 401이다', async () => {
    setup('invalid');
    expect((await call({ authorization: 'Bearer forged' })).code).toBe(401);
  });

  it('관리자면 Deploy Hook을 부르고 202다', async () => {
    const f = setup(true);
    expect((await call({ authorization: 'Bearer t' })).code).toBe(202);
    expect(f.mock.calls.map((c) => c[0])).toContain('https://hook.example');
  });

  it('GET은 405다', async () => {
    setup(true);
    expect((await call({}, 'GET')).code).toBe(405);
  });
});
