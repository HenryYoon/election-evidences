import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Evidence, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPES } from '../types/evidence';
import { typeIcon } from '../components/evidence/EvidenceCard';
import { storagePath, useSignedMap } from '../lib/media';

const BUCKET = 'evidence-media';
const blank = (): Partial<Evidence> => ({
  id: `ev-${Date.now().toString(36)}`, num: 0, title: '', description: '',
  evidence_type: '사진', published: true, region_wide: null, region_wide_label: null,
  region_basic: null, place: '', place_raw: '', coordinates: null, located: false,
  occurred_raw: '', source: '', source_url: '', reporter: '익명 제보자',
  photos: [], media_other: [], withheld: 0, media_count: 0,
});

export default function Admin() {
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Evidence[]>([]);
  const [editing, setEditing] = useState<Partial<Evidence> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('evidence').select('*').order('num', { ascending: true });
    if (error) setErr(error.message); else setRows((data as Evidence[]) || []);
  };
  useEffect(() => { if (session) load(); }, [session]);

  // 비공개 버킷: 목록 썸네일은 서명 URL로 표시(저장값은 원본 URL 유지)
  const signed = useSignedMap(rows.flatMap((r) => (r.photos ?? []).flatMap((p) => [p.thumb, p.view])));
  const disp = (u?: string | null) => { const p = storagePath(u); return (p && signed.get(p)) || u || ''; };

  if (!supabase) return <Center>Supabase가 설정되지 않았습니다. <code>.env</code>에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 넣어주세요.</Center>;
  if (!ready) return <Center>불러오는 중…</Center>;
  if (!session) return <Login onErr={setErr} err={err} />;

  const setPublished = async (e: Evidence, v: boolean) => {
    if (e.published === v) return;
    await supabase!.from('evidence').update({ published: v }).eq('id', e.id);
    load();
  };
  const remove = async (e: Evidence) => {
    if (!confirm(`"${e.title}" 삭제할까요?`)) return;
    await supabase!.from('evidence').delete().eq('id', e.id);
    load();
  };

  return (
    <div className="app" style={{ background: 'var(--bg)' }}>
      <header className="appbar" style={{ justifyContent: 'space-between' }}>
        <span className="brand">증거 아카이브 · 관리자</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="chip" onClick={() => setEditing(blank())}>+ 새 제보</button>
          <button className="chip" onClick={() => supabase!.auth.signOut()}>로그아웃</button>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
        {err && <div className="note" style={{ marginBottom: 12 }}>⚠ {err}</div>}
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>총 {rows.length}건 · 공개 {rows.filter((r) => r.published).length}건</div>
          {rows.map((e, i) => (
            <div key={e.id} style={{ ...rowStyle, cursor: 'pointer' }} onClick={() => setEditing({ ...e })} title="클릭하면 상세 보기">
              <div style={{ width: 28, textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700 }}>{i + 1}</div>
              <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flex: '0 0 auto',
                background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-3)', fontSize: 20 }}>
                {e.photos[0]?.thumb ? <img src={disp(e.photos[0].thumb)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : typeIcon(e.evidence_type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {e.region_wide_label ?? '미상'} · {e.place} · {e.evidence_type}
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>#{e.num}{e.withheld ? ` · 비공개자료 ${e.withheld}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', flex: '0 0 auto' }} onClick={(ev) => ev.stopPropagation()}>
                <button onClick={() => setPublished(e, true)}
                  style={{ ...segStyle, background: e.published ? 'var(--teal-600)' : '#fff', color: e.published ? '#fff' : 'var(--ink-3)' }}>공개</button>
                <button onClick={() => setPublished(e, false)}
                  style={{ ...segStyle, borderLeft: '1px solid var(--line)', background: !e.published ? '#b4533a' : '#fff', color: !e.published ? '#fff' : 'var(--ink-3)' }}>비공개</button>
              </div>
              <button className="chip" onClick={(ev) => { ev.stopPropagation(); remove(e); }} style={{ color: '#b4533a' }}>삭제</button>
            </div>
          ))}
        </div>
      </div>
      {editing && <EditModal draft={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditModal({ draft, onClose, onSaved }: { draft: Partial<Evidence>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Partial<Evidence>>(draft);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // 비공개 버킷: 미리보기는 서명 URL, 저장값(d.photos)은 원본 URL 유지
  const signed = useSignedMap((d.photos ?? []).flatMap((p) => [p.thumb, p.view]));
  const disp = (u?: string | null) => { const p = storagePath(u); return (p && signed.get(p)) || u || ''; };
  const set = (k: keyof Evidence, v: unknown) => setD((p) => ({ ...p, [k]: v }));
  const lng = d.coordinates?.[0] ?? '';
  const lat = d.coordinates?.[1] ?? '';
  const setCoord = (i: 0 | 1, v: string) => {
    const c: [number, number] = [Number(d.coordinates?.[0] ?? 0), Number(d.coordinates?.[1] ?? 0)];
    c[i] = Number(v);
    set('coordinates', v === '' && !d.coordinates ? null : c);
    set('located', true);
  };

  const uploadPhoto = async (file: File) => {
    if (!supabase) return;
    setBusy(true);
    const path = `admin/${d.id}_${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { setMsg(error.message); setBusy(false); return; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photos = [...(d.photos ?? []), { thumb: data.publicUrl, view: data.publicUrl }];
    set('photos', photos);
    setBusy(false);
  };

  const save = async () => {
    if (!supabase) return;
    setBusy(true);
    const row = { ...d, media_count: (d.photos?.length ?? 0) + (d.media_other?.length ?? 0) };
    const { error } = await supabase.from('evidence').upsert(row);
    setBusy(false);
    if (error) setMsg(error.message); else onSaved();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px' }}>{draft.title ? '제보 수정' : '새 제보'}</h3>
        {msg && <div className="note" style={{ marginBottom: 10 }}>⚠ {msg}</div>}
        <Field label="제목"><input style={inp} value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="설명"><textarea style={{ ...inp, height: 80 }} value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <Row>
          <Field label="유형">
            <select style={inp} value={d.evidence_type} onChange={(e) => set('evidence_type', e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="공개">
            <select style={inp} value={d.published ? '1' : '0'} onChange={(e) => set('published', e.target.value === '1')}>
              <option value="1">공개</option><option value="0">비공개</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="광역 슬러그"><input style={inp} value={d.region_wide ?? ''} onChange={(e) => set('region_wide', e.target.value || null)} /></Field>
          <Field label="광역명"><input style={inp} value={d.region_wide_label ?? ''} onChange={(e) => set('region_wide_label', e.target.value || null)} /></Field>
        </Row>
        <Row>
          <Field label="기초 슬러그"><input style={inp} value={d.region_basic ?? ''} onChange={(e) => set('region_basic', e.target.value || null)} /></Field>
          <Field label="장소"><input style={inp} value={d.place ?? ''} onChange={(e) => set('place', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="경도(lng)"><input style={inp} value={lng} onChange={(e) => setCoord(0, e.target.value)} /></Field>
          <Field label="위도(lat)"><input style={inp} value={lat} onChange={(e) => setCoord(1, e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="수집경로"><input style={inp} value={d.source ?? ''} onChange={(e) => set('source', e.target.value)} /></Field>
          <Field label="발생시각"><input style={inp} value={d.occurred_raw ?? ''} onChange={(e) => set('occurred_raw', e.target.value)} /></Field>
        </Row>
        <Field label="원본 링크"><input style={inp} value={d.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} /></Field>

        <Field label={`물증 사진 (${d.photos?.length ?? 0}) · 클릭 시 원본`}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(d.photos ?? []).map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <a href={disp(p.view ?? p.thumb) || undefined} target="_blank" rel="noreferrer">
                  <img src={disp(p.thumb)} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                </a>
                <button onClick={() => set('photos', (d.photos ?? []).filter((_, j) => j !== i))}
                  title="사진 제거"
                  style={{ position: 'absolute', top: -7, right: -7, border: 0, borderRadius: '50%', width: 20, height: 20, background: '#b4533a', color: '#fff', cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <label className="chip" style={{ cursor: 'pointer', height: 100, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              + 업로드
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </label>
          </div>
          {(d.withheld ?? 0) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
              🔒 개인정보로 비공개된 원본 자료 {d.withheld}건은 여기 표시되지 않습니다.
            </div>
          )}
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="chip" onClick={onClose}>취소</button>
          <button className="chip" onClick={save} disabled={busy}
            style={{ background: 'var(--navy-800)', color: '#fff', borderColor: 'var(--navy-800)' }}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Login({ onErr, err }: { onErr: (s: string) => void; err: string }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); onErr('');
    const { error } = await supabase!.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) onErr(error.message);
  };
  return (
    <Center>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-800)', textAlign: 'center' }}>관리자 로그인</div>
        <input style={inp} placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={inp} type="password" placeholder="비밀번호" value={pw}
          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <div style={{ color: '#b4533a', fontSize: 13 }}>{err}</div>}
        <button className="chip" onClick={submit} disabled={busy}
          style={{ background: 'var(--navy-800)', color: '#fff', borderColor: 'var(--navy-800)', padding: '9px' }}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </div>
    </Center>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="loading" style={{ flexDirection: 'column', padding: 24, textAlign: 'center' }}>{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'block', marginBottom: 10, flex: 1 }}>
    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>{children}
  </label>
);
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'flex', gap: 10 }}>{children}</div>;

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' };
const segStyle: React.CSSProperties = { border: 0, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20,28,60,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', zIndex: 100 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 20, width: 'min(560px, 100%)', boxShadow: 'var(--shadow-lg)' };
