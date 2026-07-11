// 전체 사이트 로그인 게이트 — 비식별화가 끝나기 전 클로즈드 운영용.
// Supabase가 설정돼 있으면 로그인 세션이 있어야 앱(지도/상세)을 볼 수 있다.
// RLS에서 익명(anon) 읽기 정책을 제거했으므로, 로그인 없이는 데이터도 못 읽는다.
// 계정은 Supabase 대시보드 → Authentication → Users 에서 관리자가 직접 생성(회원가입은 비활성).
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Supabase 미설정 = 로컬 정적 모드(개발). 게이트 없이 통과.
  if (!supabase) return <>{children}</>;
  if (!ready) return <div className="loading">불러오는 중…</div>;
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!supabase) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr(error.message);
    // 성공 시 onAuthStateChange가 세션을 채워 자동 진입.
  };
  return (
    <div className="loading" style={{ flexDirection: 'column', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-800)', textAlign: 'center' }}>
          선거 증거 아카이브
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>
          비공개 열람 — 승인된 계정으로 로그인하세요.
        </div>
        <input style={inp} placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          style={inp}
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <div style={{ color: '#b4533a', fontSize: 13 }}>{err}</div>}
        <button
          className="chip"
          onClick={submit}
          disabled={busy}
          style={{ background: 'var(--navy-800)', color: '#fff', borderColor: 'var(--navy-800)', padding: '9px' }}
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
};
