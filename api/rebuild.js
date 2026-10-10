// 공개 HTML 재빌드 요청(0001 플랜 7단계). 관리자만 부를 수 있다.
// 1) 요청의 Supabase 로그인 토큰으로 is_admin()을 호출해 관리자인지 확인한다.
// 2) 서버 환경변수 DEPLOY_HOOK_URL(Vercel Deploy Hook)에 POST한다.
// Deploy Hook 주소는 서버에만 둔다. VITE_ 접두사를 붙이면 프런트 번들에 들어간다.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST만 받는다' });
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const hook = process.env.DEPLOY_HOOK_URL;
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: 'Supabase 환경변수가 없다' });
  if (!hook) return res.status(503).json({ error: 'DEPLOY_HOOK_URL이 설정되지 않았다' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: '로그인 토큰이 없다' });

  // 토큰 주인으로 is_admin()을 부른다. 위조 토큰은 Supabase가 401로 거절한다.
  const check = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!check.ok) return res.status(401).json({ error: '토큰을 확인하지 못했다' });
  if ((await check.json()) !== true) return res.status(403).json({ error: '관리자가 아니다' });

  const deploy = await fetch(hook, { method: 'POST' });
  if (!deploy.ok) return res.status(502).json({ error: `Deploy Hook 실패 ${deploy.status}` });
  return res.status(202).json({ ok: true });
}
