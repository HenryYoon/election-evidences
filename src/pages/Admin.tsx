import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EvidenceRow, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPES } from '../types/evidence';
import { typeIcon } from '../lib/evidenceType';
import { storagePath, useSignedMap } from '../lib/media';
import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL, EVIDENCE_STATUS_LEGEND, normalizeEvidenceStatus } from '../lib/status';
import { confirmBlockers, normalizeLedgerDraft, validateLedgerDraft } from '../lib/adminLedger';
import '../styles/admin.css';
import { tipToEvidenceDraft, type TipRow } from '../lib/adminTips';
import { INQUIRY_KINDS } from '../lib/contact';

interface InquiryRow { id: string; kind: string; body: string; reply_to: string | null; handled: boolean; created_at: string }
const KIND_LABEL: Record<string, string> = Object.fromEntries(INQUIRY_KINDS);
import type { EvidenceSource } from '../types/evidence';
import type { EvidenceStatus } from '../lib/status';

const BUCKET = 'evidence-media';
// 제보 첨부 파일 버킷(0004 명세 3장). 비공개라 서명 주소로만 연다.
const TIP_BUCKET = 'tip-uploads';

async function listTipFiles(tipId: string): Promise<string[]> {
  const { data } = await supabase!.storage.from(TIP_BUCKET).list(tipId);
  return (data ?? []).map((o) => `${tipId}/${o.name}`);
}

// 제보 첨부 파일. 이미지는 작게 보이고, 나머지는 링크로 연다.
function TipFiles({ tipId }: { tipId: string }) {
  const [files, setFiles] = useState<{ path: string; url: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const paths = await listTipFiles(tipId);
      if (!paths.length) { if (alive) setFiles([]); return; }
      const { data } = await supabase!.storage.from(TIP_BUCKET).createSignedUrls(paths, 60 * 60);
      if (alive) setFiles((data ?? []).flatMap((d) => (d.signedUrl ? [{ path: d.path ?? '', url: d.signedUrl }] : [])));
    })();
    return () => { alive = false; };
  }, [tipId]);
  if (!files) return <div className="adm-help">첨부 파일을 확인하고 있습니다…</div>;
  if (!files.length) return <div className="adm-help">첨부 파일이 없습니다.</div>;
  return (
    <div className="adm-files">
      {files.map((f) => (
        <a key={f.path} href={f.url} target="_blank" rel="noreferrer noopener">
          {/\.(jpg|png|webp)$/.test(f.path) ? <img src={f.url} alt={f.path} /> : `첨부 ${f.path.split('/').pop()}`}
        </a>
      ))}
    </div>
  );
}
const blank = (): Partial<EvidenceRow> => ({
  id: `ev-${Date.now().toString(36)}`, num: 0, title: '', description: '',
  evidence_type: '사진', published: true, region_wide: null, region_wide_label: null,
  region_basic: null, place: '', place_raw: '', coordinates: null, located: false,
  occurred_raw: '', source: '', source_url: '', reporter: '익명 제보자',
  photos: [], media_other: [], withheld: 0, media_count: 0,
  // 기록 필드. 새 카드는 제보 상태로 시작한다. 자료 확인은 관리자만 올린다.
  status: 'reported', claim: '', election: '2026 지방선거', occurred_at: null,
  sources: [], verification: {},
});

export default function Admin() {
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [editing, setEditing] = useState<Partial<EvidenceRow> | null>(null);
  const [err, setErr] = useState('');
  const [rebuild, setRebuild] = useState('');
  const [tab, setTab] = useState<'records' | 'tips' | 'inquiries'>('records');
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | ''>('');
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
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
  const loadInquiries = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, kind, body, reply_to, handled, created_at')
      .order('created_at', { ascending: false });
    if (error) setErr(error.message); else setInquiries((data as InquiryRow[]) || []);
  };
  const markHandled = async (q: InquiryRow) => {
    const { error } = await supabase!.from('inquiries').update({ handled: !q.handled }).eq('id', q.id);
    if (error) setErr(error.message);
    loadInquiries();
  };
  useEffect(() => { if (session) { load(); loadTips(); loadInquiries(); } }, [session]);

  const finishTip = async (tip: TipRow, review: 'accepted' | 'rejected', evidenceId: string | null) => {
    const { error } = await supabase!.rpc('finish_tip_review', { p_tip: tip.id, p_review: review, p_evidence: evidenceId });
    if (error) setErr(error.message);
    loadTips();
  };
  const adopt = (tip: TipRow) => {
    setAdopting(tip);
    setEditing(tipToEvidenceDraft(tip, `ev-${Date.now().toString(36)}`));
  };
  const reject = async (tip: TipRow) => {
    if (!confirm('이 제보를 기각할까요? 이름·연락처와 첨부 파일이 지워집니다.')) return;
    // 첨부 파일을 먼저 지운다. Supabase는 SQL로 저장소 파일을 지우지 못하게 막는다.
    const paths = await listTipFiles(tip.id);
    if (paths.length) {
      const { error } = await supabase!.storage.from(TIP_BUCKET).remove(paths);
      if (error) { setErr(`첨부 파일을 지우지 못했습니다: ${error.message}`); return; }
    }
    finishTip(tip, 'rejected', null);
  };

  // 비공개 버킷: 목록 썸네일은 서명 URL로 표시(저장값은 원본 URL 유지)
  const signed = useSignedMap(rows.flatMap((r) => (r.photos ?? []).flatMap((p) => [p.thumb, p.view])));
  const disp = (u?: string | null) => { const p = storagePath(u); return (p && signed.get(p)) || u || ''; };

  if (!supabase) return <Center>Supabase가 설정되지 않았습니다. <code>.env</code>에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</Center>;
  if (!ready) return <Center>불러오는 중입니다…</Center>;
  if (!session) return <Login onErr={setErr} err={err} />;

  const setPublished = async (e: EvidenceRow, v: boolean) => {
    if (e.published === v) return;
    const { error } = await supabase!.from('evidence').update({ published: v }).eq('id', e.id);
    if (error) setErr(error.message);
    load();
  };
  // 목록에서 상태 바꾸기(0014 명세 1장). 자료 확인은 편집 창과 같은 조건을 검사한다.
  const setStatus = async (e: EvidenceRow, s: EvidenceStatus) => {
    if (normalizeEvidenceStatus(e.status) === s) return;
    if (s === 'confirmed') {
      const blockers = confirmBlockers(e);
      if (blockers.length) { setErr(`#${e.num}: ${blockers.join(' ')}`); return; }
    }
    setErr('');
    const { error } = await supabase!.from('evidence').update({ status: s }).eq('id', e.id);
    if (error) setErr(error.message);
    load();
  };
  // 공개 HTML 갱신: 사전 렌더링 본문(검색·AI가 읽는 HTML)을 최신 DB로 다시 만든다.
  // 화면 자체는 하이드레이션 뒤 최신 데이터를 다시 읽으므로 버튼 전에도 반영된다.
  const requestRebuild = async () => {
    setRebuild('요청하고 있습니다…');
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setRebuild('로그인이 필요합니다.'); return; }
    try {
      const res = await fetch('/api/rebuild', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      setRebuild(res.ok ? '다시 빌드하도록 요청했습니다. 몇 분 뒤 공개 HTML에 반영됩니다.' : `실패했습니다: ${body.error ?? res.status}`);
    } catch (e) {
      setRebuild(`실패했습니다: ${(e as Error).message}`);
    }
  };
  const remove = async (e: EvidenceRow) => {
    if (!confirm(`"${e.title}" 기록을 삭제할까요?`)) return;
    await supabase!.from('evidence').delete().eq('id', e.id);
    load();
  };

  const confirmedCount = rows.filter((r) => normalizeEvidenceStatus(r.status) === 'confirmed').length;
  const shown = statusFilter ? rows.filter((r) => normalizeEvidenceStatus(r.status) === statusFilter) : rows;

  return (
    <div className="desk adm">
      <header className="adm-bar">
        <span className="mark">선진국 · 관리자</span>
        <div className="adm-actions">
          <button className="adm-btn" onClick={() => setEditing(blank())}>+ 새 기록</button>
          <button className="adm-btn" onClick={requestRebuild} title="사전 렌더링 HTML을 최신 DB로 다시 만듭니다">공개 HTML 갱신</button>
          <button className="adm-btn" onClick={() => supabase!.auth.signOut()}>로그아웃</button>
        </div>
      </header>
      <main className="adm-main">
        {err && <div className="adm-note error">{err}</div>}
        {rebuild && <div className="adm-note">{rebuild}</div>}
        <div className="adm-tabs">
          <button className="adm-btn" aria-pressed={tab === 'records'} onClick={() => setTab('records')}>기록</button>
          <button className="adm-btn" aria-pressed={tab === 'tips'} onClick={() => setTab('tips')}>제보 검수 ({tips.length})</button>
          <button className="adm-btn" aria-pressed={tab === 'inquiries'} onClick={() => setTab('inquiries')}>문의 ({inquiries.filter((q) => !q.handled).length})</button>
        </div>

        {tab === 'tips' && (
          <>
            <p className="adm-help">
              새 제보 {tips.length}건입니다. 채택하면 비공개 기록 초안이 열립니다. 초안을 저장하거나 기각하면 이름·연락처가 지워집니다. 기각하면 첨부 파일도
              지워집니다. 채택한 제보의 파일은 비식별화한 뒤 기록 사진으로 올립니다.
            </p>
            <ul className="adm-list">
              {tips.length === 0 && <li className="adm-row">검수할 새 제보가 없습니다.</li>}
              {tips.map((t) => (
                <li key={t.id} className="adm-row stack">
                  <div className="meta">
                    {new Date(t.created_at).toLocaleString('ko-KR')} 접수 · {t.place_name}{t.occurred_text ? ` · ${t.occurred_text}` : ''}
                  </div>
                  <div className="adm-body">{t.tip_contacts?.body}</div>
                  {(t.links ?? []).map((l) => (
                    <a key={l} href={l} target="_blank" rel="noreferrer noopener" className="meta">{l}</a>
                  ))}
                  <TipFiles tipId={t.id} />
                  <div className="meta">
                    연락처(비공개): {t.tip_contacts?.name || '이름 없음'} · {t.tip_contacts?.contact || '연락처 없음'}
                  </div>
                  <div className="adm-actions">
                    <button className="adm-btn" onClick={() => adopt(t)}>채택 → 기록 초안</button>
                    <button className="adm-btn danger" onClick={() => reject(t)}>기각</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'inquiries' && (
          <>
            <p className="adm-help">문의는 접수 후 1년이 지나면 자동으로 지워집니다. 메일함의 사본도 같은 기간 뒤 지워 주세요.</p>
            <ul className="adm-list">
              {inquiries.length === 0 && <li className="adm-row">문의가 없습니다.</li>}
              {inquiries.map((q) => (
                <li key={q.id} className={`adm-row stack${q.handled ? ' done' : ''}`}>
                  <div className="meta">
                    {new Date(q.created_at).toLocaleString('ko-KR')} · {KIND_LABEL[q.kind] ?? q.kind}
                    {q.reply_to ? ` · 회신 ${q.reply_to}` : ' · 회신 이메일 없음'}
                  </div>
                  <div className="adm-body">{q.body}</div>
                  <button className="adm-btn" onClick={() => markHandled(q)}>{q.handled ? '처리 취소' : '처리 완료'}</button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'records' && (
          <>
            <div className="adm-summary">
              <span>총 {rows.length}건 · 공개 {rows.filter((r) => r.published).length}건 · 자료 확인 {confirmedCount}건</span>
              <label>
                상태{' '}
                <select className="adm-input" style={{ width: 'auto', padding: '3px 6px', fontSize: 13 }} value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as EvidenceStatus | '')}>
                  <option value="">전체</option>
                  {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</option>)}
                </select>
              </label>
            </div>
            <ul className="adm-list">
              {shown.map((e) => {
                const status = normalizeEvidenceStatus(e.status);
                return (
                  <li key={e.id} className="adm-row">
                    <div className="no">{e.num}</div>
                    <div className="adm-thumb">
                      {e.photos[0]?.thumb ? <img src={disp(e.photos[0].thumb)} alt="" /> : typeIcon(e.evidence_type)}
                    </div>
                    <div className="main" onClick={() => setEditing({ ...e })} title="누르면 편집합니다">
                      <div className="title">{e.claim || e.title}</div>
                      <div className="meta">
                        {e.occurred_at ?? '날짜 미상'} · {e.place || '장소 없음'} · {e.evidence_type}
                        {` · ${mediaSummary(e)}`}
                      </div>
                    </div>
                    <div className="adm-seg" role="group" aria-label={`#${e.num} 상태`}>
                      {EVIDENCE_STATUSES.map((s) => (
                        <button key={s} aria-pressed={status === s} onClick={() => setStatus(e, s)}>{EVIDENCE_STATUS_LABEL[s]}</button>
                      ))}
                    </div>
                    <div className="adm-seg" role="group" aria-label={`#${e.num} 공개`}>
                      <button aria-pressed={e.published} onClick={() => setPublished(e, true)}>공개</button>
                      <button className="danger" aria-pressed={!e.published} onClick={() => setPublished(e, false)}>비공개</button>
                    </div>
                    <button className="adm-btn danger" onClick={() => remove(e)}>삭제</button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
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
  const signed = useSignedMap([...(d.photos ?? []).flatMap((p) => [p.thumb, p.view]), ...(d.media_other ?? []).map((m) => m.url)]);
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
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{draft.title || draft.claim ? '기록 수정' : '새 기록'}</h3>
        {msg && <div className="adm-note error">{msg}</div>}
        <Field label="제목"><input className="adm-input" value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="설명(상세의 제보 내용)"><textarea className="adm-input" style={{ height: 80 }} value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="주장(상세 H1, 한 문장)"><textarea className="adm-input" style={{ height: 56 }} value={d.claim ?? ''} onChange={(e) => set('claim', e.target.value)} /></Field>
        <Row>
          <Field label="상태">
            <select className="adm-input" value={normalizeEvidenceStatus(d.status)} onChange={(e) => set('status', e.target.value as EvidenceStatus)}>
              {EVIDENCE_STATUSES.map((s) => <option key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="선거"><input className="adm-input" value={d.election ?? ''} onChange={(e) => set('election', e.target.value)} /></Field>
        </Row>
        <p className="adm-help">
          {EVIDENCE_STATUS_LEGEND[normalizeEvidenceStatus(d.status)]}
          {normalizeEvidenceStatus(d.status) === 'confirmed' && ' 장소와 사진·영상·문서가 있어야 저장됩니다.'}
        </p>
        <Field label="발생 시각(2026-06-03 또는 2026-06-03T14:37:00+09:00)"><input className="adm-input" value={d.occurred_at ?? ''} onChange={(e) => set('occurred_at', e.target.value)} /></Field>
        <Field label="출처(이름, 주소)">
          {(d.sources ?? []).map((src, i) => (
            <div key={i} className="adm-pair" style={{ marginBottom: 6 }}>
              <input className="adm-input" placeholder="이름" value={src.title} onChange={(e) => setSource(i, { ...src, title: e.target.value })} />
              <input className="adm-input" placeholder="https://" value={src.url ?? ''} onChange={(e) => setSource(i, { ...src, url: e.target.value })} />
              <button className="adm-btn danger" onClick={() => set('sources', (d.sources ?? []).filter((_, j) => j !== i))}>삭제</button>
            </div>
          ))}
          <button className="adm-btn" onClick={() => set('sources', [...(d.sources ?? []), { title: '', url: null }])}>+ 출처</button>
        </Field>
        <Row>
          <Field label="유형">
            <select className="adm-input" value={d.evidence_type} onChange={(e) => set('evidence_type', e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="공개">
            <select className="adm-input" value={d.published ? '1' : '0'} onChange={(e) => set('published', e.target.value === '1')}>
              <option value="1">공개</option><option value="0">비공개</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="광역 슬러그"><input className="adm-input" value={d.region_wide ?? ''} onChange={(e) => set('region_wide', e.target.value || null)} /></Field>
          <Field label="광역명"><input className="adm-input" value={d.region_wide_label ?? ''} onChange={(e) => set('region_wide_label', e.target.value || null)} /></Field>
        </Row>
        <Row>
          <Field label="기초 슬러그"><input className="adm-input" value={d.region_basic ?? ''} onChange={(e) => set('region_basic', e.target.value || null)} /></Field>
          <Field label="장소"><input className="adm-input" value={d.place ?? ''} onChange={(e) => set('place', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="경도(lng)"><input className="adm-input" value={lng} onChange={(e) => setCoord(0, e.target.value)} /></Field>
          <Field label="위도(lat)"><input className="adm-input" value={lat} onChange={(e) => setCoord(1, e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="수집 경로"><input className="adm-input" value={d.source ?? ''} onChange={(e) => set('source', e.target.value)} /></Field>
          <Field label="발생 시각(원문)"><input className="adm-input" value={d.occurred_raw ?? ''} onChange={(e) => set('occurred_raw', e.target.value)} /></Field>
        </Row>
        <Field label="원본 링크"><input className="adm-input" value={d.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} /></Field>

        <Field label={`사진 ${d.photos?.length ?? 0}장 · 누르면 원본이 열립니다`}>
          <div className="adm-photos">
            {(d.photos ?? []).map((p, i) => (
              <div key={i} className="adm-photo">
                <a href={disp(p.view ?? p.thumb) || undefined} target="_blank" rel="noreferrer">
                  <img src={disp(p.thumb)} alt="" />
                </a>
                <button onClick={() => set('photos', (d.photos ?? []).filter((_, j) => j !== i))} title="사진 빼기" aria-label="사진 빼기">×</button>
              </div>
            ))}
            <label className="adm-btn adm-upload">
              + 올리기
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </label>
          </div>
        </Field>

        {/* 영상·음성(0014 명세 4장). 관리 화면에서 바로 재생한다. */}
        <Field label={`영상·음성 ${d.media_other?.length ?? 0}개`}>
          {(d.media_other ?? []).length === 0 && <p className="adm-help">영상·음성이 없습니다.</p>}
          <div className="adm-media">
            {(d.media_other ?? []).map((m, i) => (
              <div key={i} className="adm-media-item">
                {!m.url ? (
                  <p className="adm-help">{m.kind === 'audio' ? '음성' : m.kind === 'doc' ? '문서' : '영상'} 원본이 없습니다(유실).</p>
                ) : m.kind === 'video' ? (
                  <video src={disp(m.url)} controls preload="metadata" />
                ) : m.kind === 'audio' ? (
                  <audio src={disp(m.url)} controls preload="metadata" />
                ) : (
                  <a href={disp(m.url)} target="_blank" rel="noreferrer">문서 열기</a>
                )}
                <button className="adm-btn danger" onClick={() => set('media_other', (d.media_other ?? []).filter((_, j) => j !== i))}>빼기</button>
              </div>
            ))}
          </div>
        </Field>
        {(d.withheld ?? 0) > 0 && (
          <p className="adm-help">개인정보 때문에 공개하지 않은 원본 자료 {d.withheld}건은 저장소에 올리지 않아 여기 보이지 않습니다.</p>
        )}

        <div className="adm-foot">
          <button className="adm-btn" onClick={onClose}>취소</button>
          <button className="adm-btn primary" onClick={save} disabled={busy}>{busy ? '저장하고 있습니다…' : '저장'}</button>
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
      <div className="adm-login">
        <h1>관리자 로그인</h1>
        <input className="adm-input" placeholder="이메일" aria-label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="adm-input" type="password" placeholder="비밀번호" aria-label="비밀번호" value={pw}
          onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <div className="adm-error">{err}</div>}
        <button className="adm-btn primary" onClick={submit} disabled={busy}>{busy ? '로그인하고 있습니다…' : '로그인'}</button>
      </div>
    </Center>
  );
}

// 목록 한 줄 요약: 사진·영상·음성 수와 비공개 원본 수.
function mediaSummary(e: EvidenceRow): string {
  const other = e.media_other ?? [];
  const parts = [`사진 ${(e.photos ?? []).length}`, `영상 ${other.filter((m) => m.kind === 'video').length}`];
  const audio = other.filter((m) => m.kind === 'audio').length;
  if (audio) parts.push(`음성 ${audio}`);
  if (e.withheld) parts.push(`비공개 원본 ${e.withheld}`);
  return parts.join(' · ');
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="desk adm-center">{children}</div>;
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="adm-field"><span>{label}</span>{children}</label>
);
const Row = ({ children }: { children: React.ReactNode }) => <div className="adm-pair">{children}</div>;
