// 문의(0006 명세 1·2장). 브라우저가 submit_inquiry RPC로 저장하고, /api/contact에 id만 보내 메일을 부른다.
// 검사 규칙은 DB 함수와 같다. DB가 최종 검사를 한다.
export const INQUIRY_KINDS = [
  ['question', '문의'],
  ['suggestion', '건의'],
  ['correction', '정정 요청'],
  ['privacy', '개인정보 요청'],
] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number][0];

export interface ContactForm {
  kind: InquiryKind | '';
  body: string;
  replyTo: string;
  consent: boolean;          // 필수: 수집·이용
  overseasConsent: boolean;  // 필수: 국외 이전
  optionalConsent: boolean;  // 선택: 회신 이메일. 적은 경우에만 요구한다
  website: string;           // 미끼 칸
}

export const EMPTY_CONTACT: ContactForm = {
  kind: '', body: '', replyTo: '', consent: false, overseasConsent: false, optionalConsent: false, website: '',
};

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateContact(f: ContactForm): string[] {
  const errs: string[] = [];
  const body = f.body.trim();
  const reply = f.replyTo.trim();
  if (!f.kind) errs.push('문의 종류를 골라 주세요.');
  if (body.length < 10 || body.length > 5000) errs.push('내용을 10~5000자로 적어 주세요.');
  if (reply && (reply.length > 200 || !EMAIL_RE.test(reply))) errs.push('회신 이메일 형식이 맞지 않습니다.');
  if (!f.consent) errs.push('개인정보 수집·이용에 동의해야 보낼 수 있습니다.');
  if (!f.overseasConsent) errs.push('개인정보 국외 이전에 동의해야 보낼 수 있습니다.');
  if (reply && !f.optionalConsent) errs.push('회신 이메일을 적었다면 선택 항목 수집·이용에 동의해 주세요. 동의하지 않으려면 칸을 비워 주세요.');
  return errs;
}

export type ContactResult = { ok: true; mailed: boolean } | { ok: false; message: string };

export async function submitContact(f: ContactForm, fetchImpl: typeof fetch = fetch): Promise<ContactResult> {
  if (f.website.trim()) return { ok: true, mailed: true };
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { ok: false, message: '지금은 문의를 받을 수 없습니다. 잠시 뒤에 다시 시도해 주세요.' };
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/submit_inquiry`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_kind: f.kind,
        p_body: f.body.trim(),
        // 선택 동의가 없으면 회신 이메일을 보내지 않는다.
        p_reply_to: (f.optionalConsent && f.replyTo.trim()) || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: (err as { message?: string }).message || `보내지 못했습니다(${res.status}).` };
    }
    const id = await res.json().catch(() => null);
    if (typeof id !== 'string') return { ok: true, mailed: false };
    // 메일 발송이 실패해도 문의는 저장돼 있다. 관리자 화면에서 본다.
    const mail = await fetchImpl('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    return { ok: true, mailed: Boolean(mail?.ok) };
  } catch {
    return { ok: false, message: '네트워크 문제로 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' };
  }
}
