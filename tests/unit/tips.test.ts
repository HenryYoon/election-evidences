// 0001 플랜 5단계: 제보 폼 검사, 전송, 채택 초안.
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_TIP, parseLinks, submitTip, validateTip } from '../../src/lib/tips';
import { tipToEvidenceDraft, type TipRow } from '../../src/lib/adminTips';

const ok = { ...EMPTY_TIP, place: '종로구 투표소', body: '투표함 봉인지가 뜯겨 있었습니다.', consent: true };

describe('제보 폼 검사', () => {
  it('필수 항목이 있으면 통과한다', () => {
    expect(validateTip(ok)).toEqual([]);
  });
  it('동의하지 않으면 막는다', () => {
    expect(validateTip({ ...ok, consent: false }).join()).toContain('동의');
  });
  it('본문이 짧으면 막는다', () => {
    expect(validateTip({ ...ok, body: '짧다' })).toHaveLength(1);
  });
  it('링크는 http(s)만, 5개까지 받는다', () => {
    expect(validateTip({ ...ok, links: 'javascript:alert(1)' })).toHaveLength(1);
    expect(validateTip({ ...ok, links: Array(6).fill('https://a.example').join('\n') })).toHaveLength(1);
    expect(parseLinks(' https://a.example \n\n https://b.example ')).toEqual(['https://a.example', 'https://b.example']);
  });
});

describe('제보 전송', () => {
  it('미끼 칸이 채워지면 보내지 않고 성공처럼 끝낸다', async () => {
    const f = vi.fn();
    expect(await submitTip({ ...ok, website: 'spam' }, f as unknown as typeof fetch)).toEqual({ ok: true });
    expect(f).not.toHaveBeenCalled();
  });
  it('submit_tip RPC에 다듬은 값을 보낸다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const f = vi.fn(async () => new Response('"t1"'));
    const r = await submitTip({ ...ok, place: ' 종로구 ', links: 'https://a.example', name: ' ', contact: '010' }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://db.example/rest/v1/rpc/submit_tip');
    expect(JSON.parse(String(init.body))).toEqual({
      p_place: '종로구', p_occurred: '', p_body: ok.body, p_links: ['https://a.example'], p_name: null, p_contact: '010',
    });
    vi.unstubAllEnvs();
  });
  it('DB가 거절하면 그 안내를 보여 준다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const f = vi.fn(async () => new Response(JSON.stringify({ message: '잠시 뒤에 다시 보내 주세요' }), { status: 400 }));
    expect(await submitTip(ok, f as unknown as typeof fetch)).toEqual({ ok: false, message: '잠시 뒤에 다시 보내 주세요' });
    vi.unstubAllEnvs();
  });
});

describe('채택 초안', () => {
  const tip: TipRow = {
    id: 't1', place_name: '종로구 투표소', occurred_text: '6월 3일 오후', links: ['https://v.example/1'], review: 'new',
    created_at: '2026-10-10T00:00:00Z', tip_contacts: { body: '원문 내용입니다.', name: '자리표시', contact: '010-0000-0000' },
  };
  const d = tipToEvidenceDraft(tip, 'ev-x');

  it('비공개·주장 상태로 시작한다', () => {
    expect(d.published).toBe(false);
    expect(d.status).toBe('allegation');
  });
  it('제보자 이름과 연락처를 넣지 않는다', () => {
    const s = JSON.stringify(d);
    expect(s).not.toContain('자리표시');
    expect(s).not.toContain('010-0000-0000');
  });
  it('원문은 설명에, 링크는 출처에 넣는다', () => {
    expect(d.description).toBe('원문 내용입니다.');
    expect(d.sources).toEqual([{ title: '시민 제보', url: null }, { title: '제보 링크 1', url: 'https://v.example/1' }]);
  });
});
