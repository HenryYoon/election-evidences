// 문의 메일 발송(0006 명세 2장). 브라우저가 submit_inquiry로 저장한 뒤 id만 보낸다.
// 1) claim_inquiry_mail(id)로 접수 10분 안, 아직 보내지 않은 문의를 한 번만 받는다.
// 2) Resend로 운영자에게 보낸다. 받는 주소(CONTACT_TO)와 키(RESEND_API_KEY)는 서버 환경변수에만 둔다.
// Supabase service key는 쓰지 않는다. 운영자 주소와 문의 내용은 응답과 로그에 남기지 않는다.
export const KIND_LABEL = { question: '문의', suggestion: '건의', correction: '정정 요청', privacy: '개인정보 요청' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function sendInquiryMail(id, env, fetchImpl = fetch) {
  if (typeof id !== 'string' || !UUID.test(id)) return { status: 400, error: 'id 형식이 맞지 않는다' };
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, RESEND_API_KEY: key, CONTACT_TO: to } = env;
  if (!url || !anon || !key || !to) return { status: 503, error: '메일 설정이 없다' };

  const claim = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/rpc/claim_inquiry_mail`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  if (!claim.ok) return { status: 502, error: `문의 조회 실패 ${claim.status}` };
  const rows = await claim.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  // 없는 id, 이미 보낸 문의, 10분 지난 문의는 같은 응답을 준다.
  if (!row) return { status: 404, error: '보낼 문의가 없다' };

  const label = KIND_LABEL[row.kind] ?? row.kind;
  const mail = {
    from: '선거 증거 데스크 <onboarding@resend.dev>',
    to: [to],
    subject: `[선거 증거 데스크] ${label}`,
    text: `${label}\n접수 ${row.created_at}\n회신 이메일 ${row.reply_to ?? '없음'}\n\n${row.body}\n\n이 문의는 관리자 화면 문의 탭에도 있습니다. 보유 기간(1년)이 지나면 메일함 사본도 지워 주세요.`,
    ...(row.reply_to ? { reply_to: row.reply_to } : {}),
  };
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail),
  });
  if (!res.ok) return { status: 502, error: `메일 발송 실패 ${res.status}` };
  return { status: 202 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST만 받는다' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const r = await sendInquiryMail(body.id, process.env);
  return res.status(r.status).json(r.error ? { error: r.error } : { ok: true });
}
