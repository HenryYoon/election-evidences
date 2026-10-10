// 제보 접수(0001 플랜 5단계). 브라우저가 Supabase RPC submit_tip을 anon 키로 부른다.
// 검사 규칙은 DB 함수와 같다. DB가 최종 검사를 하고, 여기서는 먼저 알려 준다.
export interface TipForm {
  place: string;
  occurred: string;
  body: string;
  links: string;   // 줄마다 하나
  name: string;
  contact: string;
  consent: boolean;
  website: string; // 미끼 칸. 사람에게는 보이지 않는다. 채워져 있으면 보내지 않는다.
}

export const EMPTY_TIP: TipForm = { place: '', occurred: '', body: '', links: '', name: '', contact: '', consent: false, website: '' };

export function parseLinks(s: string): string[] {
  return s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
}

export function validateTip(f: TipForm): string[] {
  const errs: string[] = [];
  const place = f.place.trim();
  const body = f.body.trim();
  if (place.length < 2 || place.length > 200) errs.push('장소를 2~200자로 적어 주세요.');
  if (body.length < 10 || body.length > 5000) errs.push('내용을 10~5000자로 적어 주세요.');
  if (f.occurred.trim().length > 200) errs.push('시각은 200자 안으로 적어 주세요.');
  if (f.name.trim().length > 100 || f.contact.trim().length > 200) errs.push('이름이나 연락처가 너무 깁니다.');
  const links = parseLinks(f.links);
  if (links.length > 5) errs.push('링크는 5개까지 받습니다.');
  if (links.some((l) => !/^https?:\/\//.test(l) || l.length > 500)) errs.push('링크는 http:// 또는 https://로 시작해야 합니다.');
  if (!f.consent) errs.push('개인정보 수집·이용에 동의해야 보낼 수 있습니다.');
  return errs;
}

export type SubmitResult = { ok: true } | { ok: false; message: string };

export async function submitTip(f: TipForm, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  // 미끼 칸이 채워졌으면 봇으로 보고 성공처럼 끝낸다. 봇에게 거절 이유를 알려 주지 않는다.
  if (f.website.trim()) return { ok: true };
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { ok: false, message: '지금은 제보를 받을 수 없습니다. 잠시 뒤에 다시 시도해 주세요.' };
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/submit_tip`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_place: f.place.trim(),
        p_occurred: f.occurred.trim(),
        p_body: f.body.trim(),
        p_links: parseLinks(f.links),
        p_name: f.name.trim() || null,
        p_contact: f.contact.trim() || null,
      }),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    // DB 함수가 낸 한국어 안내(검증, 비율 제한)는 그대로 보여 준다.
    return { ok: false, message: (err as { message?: string }).message || `보내지 못했습니다(${res.status}).` };
  } catch {
    return { ok: false, message: '네트워크 문제로 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' };
  }
}
