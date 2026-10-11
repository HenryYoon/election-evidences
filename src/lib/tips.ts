// 제보 접수(0001 플랜 5단계). 브라우저가 Supabase RPC submit_tip을 anon 키로 부른다.
// 검사 규칙은 DB 함수와 같다. DB가 최종 검사를 하고, 여기서는 먼저 알려 준다.
// 첨부 파일(0004 명세 3장)은 접수 뒤 Storage REST로 비공개 버킷 tip-uploads에 올린다.
export interface TipForm {
  place: string;
  occurred: string;
  body: string;
  links: string;   // 줄마다 하나
  name: string;
  contact: string;
  consent: boolean;          // 필수: 개인정보 수집·이용
  overseasConsent: boolean;  // 필수: 국외 이전
  optionalConsent: boolean;  // 선택: 이름·연락처. 적은 경우에만 요구한다
  website: string; // 미끼 칸. 사람에게는 보이지 않는다. 채워져 있으면 보내지 않는다.
}

export const EMPTY_TIP: TipForm = {
  place: '', occurred: '', body: '', links: '', name: '', contact: '',
  consent: false, overseasConsent: false, optionalConsent: false, website: '',
};

export const hasContact = (f: Pick<TipForm, 'name' | 'contact'>) => Boolean(f.name.trim() || f.contact.trim());

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
  if (!f.overseasConsent) errs.push('개인정보 국외 이전에 동의해야 보낼 수 있습니다.');
  if (hasContact(f) && !f.optionalConsent) errs.push('이름이나 연락처를 적었다면 선택 항목 수집·이용에 동의해 주세요. 동의하지 않으려면 두 칸을 비워 주세요.');
  return errs;
}

export type SubmitResult = { ok: true; id?: string } | { ok: false; message: string };

// ── 첨부 파일 ─────────────────────────────────────────────
// 버킷 제한(scripts/migrations/0006_tip_uploads.sql)과 같은 값이다. DB 정책이 최종 검사를 한다.
export const TIP_UPLOAD_BUCKET = 'tip-uploads';
export const MAX_TIP_FILES = 5;
export const MAX_TIP_FILE_BYTES = 20 * 1024 * 1024;
const TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf',
};
const EXT_ALIAS: Record<string, string> = { jpeg: 'jpg', qt: 'mov' };
const EXT_BY_TYPE: Record<string, string> = Object.fromEntries(Object.entries(TYPE_BY_EXT).map(([e, t]) => [t, e]));
export const TIP_FILE_ACCEPT = Object.keys(TYPE_BY_EXT).map((e) => `.${e}`).concat('.jpeg', ...new Set(Object.values(TYPE_BY_EXT))).join(',');

interface FileLike { name: string; type: string; size: number }

// 저장할 확장자. 파일 이름의 확장자를 먼저 보고, 없으면 MIME 형식을 본다. 받지 않는 형식이면 null.
export function tipFileExt(f: FileLike): string | null {
  const raw = f.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const ext = EXT_ALIAS[raw] ?? raw;
  if (TYPE_BY_EXT[ext]) return ext;
  return EXT_BY_TYPE[f.type] ?? null;
}

export function validateTipFiles(files: FileLike[]): string[] {
  const errs: string[] = [];
  if (files.length > MAX_TIP_FILES) errs.push(`파일은 ${MAX_TIP_FILES}개까지 올릴 수 있습니다.`);
  const bad = files.filter((f) => !tipFileExt(f));
  if (bad.length) errs.push(`받지 않는 형식입니다: ${bad.map((f) => f.name).join(', ')}. 사진(JPG, PNG, WebP, HEIC), 영상(MP4, MOV), PDF만 받습니다.`);
  const big = files.filter((f) => f.size > MAX_TIP_FILE_BYTES);
  if (big.length) errs.push(`20MB가 넘는 파일입니다: ${big.map((f) => f.name).join(', ')}. 큰 영상은 공유 링크로 보내 주세요.`);
  return errs;
}

// 저장 경로: <제보 id>/<순번>.<확장자>. 원래 파일 이름은 쓰지 않는다(이름에 개인정보가 섞일 수 있다).
export const tipUploadPath = (tipId: string, i: number, ext: string) => `${tipId}/${i + 1}.${ext}`;

// 파일을 하나씩 올리고 실패한 파일 이름을 돌려준다.
export async function uploadTipFiles(tipId: string, files: File[], fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return files.map((f) => f.name);
  const failed: string[] = [];
  for (const [i, f] of files.entries()) {
    const ext = tipFileExt(f);
    if (!ext) { failed.push(f.name); continue; }
    try {
      const res = await fetchImpl(`${url.replace(/\/$/, '')}/storage/v1/object/${TIP_UPLOAD_BUCKET}/${tipUploadPath(tipId, i, ext)}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': TYPE_BY_EXT[ext], 'x-upsert': 'false' },
        body: f,
      });
      if (!res.ok) failed.push(f.name);
    } catch {
      failed.push(f.name);
    }
  }
  return failed;
}

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
        // 선택 동의가 없으면 이름·연락처를 보내지 않는다.
        p_name: (f.optionalConsent && f.name.trim()) || null,
        p_contact: (f.optionalConsent && f.contact.trim()) || null,
      }),
    });
    if (res.ok) {
      const id = await res.json().catch(() => null);
      return typeof id === 'string' ? { ok: true, id } : { ok: true };
    }
    const err = await res.json().catch(() => ({}));
    // DB 함수가 낸 한국어 안내(검증, 비율 제한)는 그대로 보여 준다.
    return { ok: false, message: (err as { message?: string }).message || `보내지 못했습니다(${res.status}).` };
  } catch {
    return { ok: false, message: '네트워크 문제로 보내지 못했습니다. 잠시 뒤에 다시 시도해 주세요.' };
  }
}
