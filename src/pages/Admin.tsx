import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EvidenceRow, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPES } from '../types/evidence';
import { typeIcon } from '../lib/evidenceType';
import { storagePath, useSignedMap } from '../lib/media';
import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL, EVIDENCE_STATUS_LEGEND, MANUAL_ONLY_STATUSES, VERIFICATION_FIELDS } from '../lib/status';
import { normalizeLedgerDraft, validateLedgerDraft } from '../lib/adminLedger';
import { tipToEvidenceDraft, type TipRow } from '../lib/adminTips';
import type { EvidenceSource } from '../types/evidence';
import type { EvidenceStatus } from '../lib/status';

const BUCKET = 'evidence-media';
const blank = (): Partial<EvidenceRow> => ({
  id: `ev-${Date.now().toString(36)}`, num: 0, title: '', description: '',
  evidence_type: '사진', published: true, region_wide: null, region_wide_label: null,
  region_basic: null, place: '', place_raw: '', coordinates: null, located: false,
  occurred_raw: '', source: '', source_url: '', reporter: '익명 제보자',
  photos: [], media_other: [], withheld: 0, media_count: 0,
  // 기록 필드. 새 카드는 비공개·주장 상태로 시작한다. 상태는 관리자만 올린다.
  status: 'allegation', claim: '', election: '2026 지방선거', occurred_at: null,
  sources: [], verification: {},
});

export default function Admin() {
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [editing, setEditing] = useState<Partial<EvidenceRow> | null>(null);
  const [err, setErr] = useState('');
  const [rebuild, setRebuild] = useState('');
  const [tab, setTab] = useState<'records' | 'tips'>('records');
  const [tips, setTips] = useState<TipRow[]>([]);
  // 채택 중인 제보. 기록 초안을 저장하면 검수를 마치고 연락처를 지운다.
  const [adopting, setAdopting] = useState<TipRow | null>(null);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('evidence').select('*').order('num', { ascending: true });
    if (error) setErr(error.message); else setRows((data as EvidenceRow[]) || []);
  };
  const loadTips = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('tips')
      .select('id, place_name, occurred_text, links, review, created_at, tip_contacts(body, name, contact)')
      .eq('review', 'new')
      .order('created_at', { ascending: false });
    if (error) setErr(error.message); else setTips((data as unknown as TipRow[]) || []);
  };
  useEffect(() => { if (session) { load(); loadTips(); } }, [session]);

  const finishTip = async (tip: TipRow, review: 'accepted' | 'rejected', evidenceId: string | null) => {
    const { error } = await supabase!.rpc('finish_tip_review', { p_tip: tip.id, p_review: review, p_evidence: evidenceId });
    if (error) setErr(error.message);
    loadTips();
  };
  const adopt = (tip: TipRow) => {
    setAdopting(tip);
    setEditing(tipToEvidenceDraft(tip, `ev-${Date.now().toString(36)}`));
  };
  const reject = (tip: TipRow) => {
    if (!confirm('이 제보를 기각할까요? 이름과 연락처는 지워집니다.')) return;
    finishTip(tip, 'rejected', null);
  };

  // 비공개 버킷: 목록 썸네일은 서명 URL로 표시(저장값은 원본 URL 유지)
  const signed = useSignedMap(rows.flatMap((r) => (r.photos ?? []).flatMap((p) => [p.thumb, p.view])));
  const disp = (u?: string | null) => { const p = storagePath(u); return (p && signed.get(p)) || u || ''; };

  if (!supabase) return <Center>Supabase가 설정되지 않았습니다. <code>.env</code>에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 넣어주세요.</Center>;
  if (!ready) return <Center>불러오는 중…</Center>;
  if (!session) return <Login onErr={setErr} err={err} />;

  const setPublished = async (e: EvidenceRow, v: boolean) => {
    if (e.published === v) return;
    await supabase!.from('evidence').update({ published: v }).eq('id', e.id);
    load();
  };
  // 공개 HTML 갱신: 사전 렌더링 본문(검색·AI가 읽는 HTML)을 최신 DB로 다시 만든다.
  // 화면 자체는 하이드레이션 뒤 최신 데이터를 다시 읽으므로 버튼 전에도 반영된다.
  const requestRebuild = async () => {
    setRebuild('요청 중…');
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setRebuild('로그인이 필요하다'); return; }
    try {
      const res = await fetch('/api/rebuild', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      setRebuild(res.ok ? '재빌드를 요청했다. 수 분 뒤 공개 HTML에 반영된다.' : `실패: ${body.error ?? res.status}`);
    } catch (e) {
      setRebuild(`실패: ${(e as Error).message}`);
    }
  };
  const remove = async (e: EvidenceRow) => {
    if (!confirm(`"${e.title}" 삭제할까요?`)) return;
    await supabase!.from('evidence').delete().eq('id', e.id);
    load();
  };

  return (
    <div className="app" style={{ background: 'var(--bg)' }}>
      <header className="appbar" style={{ justifyContent: 'space-between' }}>
        <span className="brand">선거 증거 데스크 · 관리자</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="chip" onClick={() => setEditing(blank())}>+ 새 기록</button>
          <button className="chip" onClick={requestRebuild} title="사전 렌더링 HTML을 최신 DB로 다시 만든다">공개 HTML 갱신</button>
          <button className="chip" onClick={() => supabase!.auth.signOut()}>로그아웃</button>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }}>
        {err && <div className="note" style={{ marginBottom: 12 }}>⚠ {err}</div>}
        {rebuild && <div className="note" style={{ marginBottom: 12 }}>{rebuild}</div>}
        <div style={{ maxWidth: 1000, margin: '0 auto 12px', display: 'flex', gap: 8 }}>
          <button className="chip" onClick={() => setTab('records')} style={tab === 'records' ? activeTab : undefined}>기록</button>
          <button className="chip" onClick={() => setTab('tips')} style={tab === 'tips' ? activeTab : undefined}>제보 검수 ({tips.length})</button>
        </div>
        {tab === 'tips' && (
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              새 제보 {tips.length}건. 채택하면 비공개 기록 초안이 열린다. 초안을 저장하거나 기각하면 이름·연락처가 지워진다.
            </div>
            {tips.length === 0 && <div style={rowStyle}>검수할 새 제보가 없다.</div>}
            {tips.map((t) => (
              <div key={t.id} style={{ ...rowStyle, alignItems: 'flex-start', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {new Date(t.created_at).toLocaleString('ko-KR')} 접수 · {t.place_name}{t.occurred_text ? ` · ${t.occurred_text}` : ''}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{t.tip_contacts?.body}</div>
                {(t.links ?? []).map((l) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13 }}>{l}</a>
                ))}
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  연락처(비공개): {t.tip_contacts?.name || '이름 없음'} · {t.tip_contacts?.contact || '연락처 없음'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="chip" onClick={() => adopt(t)}>채택 → 기록 초안</button>
                  <button className="chip" onClick={() => reject(t)} style={{ color: '#b4533a' }}>기각</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'records' && (
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
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.claim || e.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {e.status ? EVIDENCE_STATUS_LABEL[e.status] : '상태 없음'} · {e.occurred_at ?? '날짜 미상'} · {e.place} · {e.evidence_type}
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
        )}
      </div>
      {editing && (
        <EditModal
          draft={editing}
          onClose={() => { setEditing(null); setAdopting(null); }}
          onSaved={async () => {
            const saved = editing;
            setEditing(null);
            if (adopting) {
              await finishTip(adopting, 'accepted', saved.id ?? null);
              setAdopting(null);
            }
            load();
          }}
        />
      )}
    </div>
  );
}

function EditModal({ draft, onClose, onSaved }: { draft: Partial<EvidenceRow>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Partial<EvidenceRow>>(draft);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // 비공개 버킷: 미리보기는 서명 URL, 저장값(d.photos)은 원본 URL 유지
  const signed = useSignedMap((d.photos ?? []).flatMap((p) => [p.thumb, p.view]));
  const disp = (u?: string | null) => { const p = storagePath(u); return (p && signed.get(p)) || u || ''; };
  const set = (k: keyof EvidenceRow, v: unknown) => setD((p) => ({ ...p, [k]: v }));
  const setSource = (i: number, src: EvidenceSource) => set('sources', (d.sources ?? []).map((s, j) => (j === i ? src : s)));
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
    const errs = validateLedgerDraft(d);
    if (errs.length) { setMsg(errs.join(' ')); return; }
    setBusy(true);
    const row = normalizeLedgerDraft(d);
    const { error } = await supabase.from('evidence').upsert(row);
    setBusy(false);
    if (error) setMsg(error.message); else onSaved();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px' }}>{draft.title || draft.claim ? '기록 수정' : '새 기록'}</h3>
        {msg && <div className="note" style={{ marginBottom: 10 }}>⚠ {msg}</div>}
        <Field label="제목"><input style={inp} value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="설명(상세의 제보 내용)"><textarea style={{ ...inp, height: 80 }} value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="주장(상세 H1, 한 문장)"><textarea style={{ ...inp, height: 56 }} value={d.claim ?? ''} onChange={(e) => set('claim', e.target.value)} /></Field>
        <Row>
          <Field label="상태">
            <select style={inp} value={d.status ?? 'allegation'} onChange={(e) => set('status', e.target.value as EvidenceStatus)}>
              {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="선거"><input style={inp} value={d.election ?? ''} onChange={(e) => set('election', e.target.value)} /></Field>
        </Row>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '-4px 0 10px' }}>
          {EVIDENCE_STATUS_LEGEND[(d.status ?? 'allegation') as EvidenceStatus]}
          {MANUAL_ONLY_STATUSES.includes((d.status ?? 'allegation') as EvidenceStatus) && ' 이 상태는 아래 검증 네 줄을 모두 채워야 저장된다.'}
        </div>
        <Field label="발생 시각(2026-06-03 또는 2026-06-03T14:37:00+09:00)"><input style={inp} value={d.occurred_at ?? ''} onChange={(e) => set('occurred_at', e.target.value)} /></Field>
        <Field label="검증 네 줄">
          {VERIFICATION_FIELDS.map(([k, label]) => (
            <input key={k} style={{ ...inp, marginBottom: 6 }} placeholder={label} value={(d.verification ?? {})[k] ?? ''}
              onChange={(e) => set('verification', { ...(d.verification ?? {}), [k]: e.target.value })} />
          ))}
        </Field>
        <Field label="출처(이름, 주소)">
          {(d.sources ?? []).map((src, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input style={inp} placeholder="이름" value={src.title} onChange={(e) => setSource(i, { ...src, title: e.target.value })} />
              <input style={inp} placeholder="https://" value={src.url ?? ''} onChange={(e) => setSource(i, { ...src, url: e.target.value })} />
              <button className="chip" onClick={() => set('sources', (d.sources ?? []).filter((_, j) => j !== i))}>삭제</button>
            </div>
          ))}
          <button className="chip" onClick={() => set('sources', [...(d.sources ?? []), { title: '', url: null }])}>+ 출처</button>
        </Field>
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
const activeTab: React.CSSProperties = { background: 'var(--navy-800)', color: '#fff', borderColor: 'var(--navy-800)' };
const segStyle: React.CSSProperties = { border: 0, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20,28,60,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', zIndex: 100 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 20, width: 'min(560px, 100%)', boxShadow: 'var(--shadow-lg)' };
