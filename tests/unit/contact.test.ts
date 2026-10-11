// 0006: 문의 폼 검사, 전송, 메일 발송 서버 함수.
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_CONTACT, submitContact, validateContact, type ContactForm } from '../../src/lib/contact';
// @ts-expect-error 타입 선언이 없는 서버 함수
import { sendInquiryMail } from '../../api/contact.js';

const ok: ContactForm = { ...EMPTY_CONTACT, kind: 'correction', body: '기록 주소와 틀린 부분입니다.', consent: true, overseasConsent: true };
const ID = '11111111-2222-3333-4444-555555555555';

describe('문의 폼 검사', () => {
  it('종류, 내용, 필수 동의 두 가지를 요구한다', () => {
    expect(validateContact(ok)).toEqual([]);
    expect(validateContact({ ...ok, kind: '' })).toHaveLength(1);
    expect(validateContact({ ...ok, body: '짧다' })).toHaveLength(1);
    expect(validateContact({ ...ok, consent: false, overseasConsent: false })).toHaveLength(2);
  });
  it('회신 이메일은 형식을 보고, 적었을 때만 선택 동의를 요구한다', () => {
    expect(validateContact({ ...ok, replyTo: 'x' }).join()).toContain('형식');
    expect(validateContact({ ...ok, replyTo: 'a@b.kr' }).join()).toContain('선택 항목');
    expect(validateContact({ ...ok, replyTo: 'a@b.kr', optionalConsent: true })).toEqual([]);
  });
});

describe('문의 전송', () => {
  it('RPC로 저장한 뒤 id만 /api/contact에 보낸다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const f = vi.fn(async (url: string) => new Response(url.includes('/rpc/') ? JSON.stringify(ID) : '{}', { status: url.includes('/rpc/') ? 200 : 202 }));
    expect(await submitContact({ ...ok, replyTo: 'a@b.kr', optionalConsent: true }, f as unknown as typeof fetch)).toEqual({ ok: true, mailed: true });
    const [u1, i1] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(u1).toBe('https://db.example/rest/v1/rpc/submit_inquiry');
    expect(JSON.parse(String(i1.body))).toEqual({ p_kind: 'correction', p_body: ok.body, p_reply_to: 'a@b.kr' });
    const [u2, i2] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(u2).toBe('/api/contact');
    expect(JSON.parse(String(i2.body))).toEqual({ id: ID });
    vi.unstubAllEnvs();
  });
  it('선택 동의가 없으면 회신 이메일을 보내지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const f = vi.fn(async () => new Response(JSON.stringify(ID)));
    await submitContact({ ...ok, replyTo: 'a@b.kr' }, f as unknown as typeof fetch);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).p_reply_to).toBeNull();
    vi.unstubAllEnvs();
  });
  it('메일 발송이 실패해도 접수는 성공으로 알린다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(ID), { status: url.includes('/rpc/') ? 200 : 502 }));
    expect(await submitContact(ok, f as unknown as typeof fetch)).toEqual({ ok: true, mailed: false });
    vi.unstubAllEnvs();
  });
});

describe('메일 발송 서버 함수', () => {
  const env = { VITE_SUPABASE_URL: 'https://db.example', VITE_SUPABASE_ANON_KEY: 'anon', RESEND_API_KEY: 're_key', CONTACT_TO: 'op@example.com' };
  const row = { kind: 'correction', body: '틀린 부분', reply_to: 'a@b.kr', created_at: '2026-10-11T00:00:00Z' };

  it('한 번 받은 문의를 운영자에게 보내고 회신 주소를 reply_to로 넣는다', async () => {
    const f = vi.fn(async (url: string) => new Response(url.includes('claim_inquiry_mail') ? JSON.stringify([row]) : '{"id":"m"}'));
    expect(await sendInquiryMail(ID, env, f)).toEqual({ status: 202 });
    const [u, init] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(u).toBe('https://api.resend.com/emails');
    const mail = JSON.parse(String(init.body));
    expect(mail).toMatchObject({ to: ['op@example.com'], reply_to: 'a@b.kr', subject: '[선거 증거 데스크] 정정 요청' });
  });
  it('이미 보냈거나 없는 문의는 메일을 보내지 않는다', async () => {
    const f = vi.fn(async () => new Response('[]'));
    expect((await sendInquiryMail(ID, env, f)).status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('id 형식이 다르거나 설정이 없으면 아무것도 부르지 않는다', async () => {
    const f = vi.fn();
    expect((await sendInquiryMail('../x', env, f)).status).toBe(400);
    expect((await sendInquiryMail(ID, { ...env, CONTACT_TO: '' }, f)).status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });
  it('응답에 운영자 주소나 키를 담지 않는다', async () => {
    const f = vi.fn(async () => new Response('err', { status: 500 }));
    const r = await sendInquiryMail(ID, env, f);
    expect(JSON.stringify(r)).not.toMatch(/op@example|re_key/);
  });
});
