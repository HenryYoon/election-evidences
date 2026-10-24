// 제보 받기(0001 플랜 5단계). 제보는 공개 목록에 올리지 않는다.
// 운영진이 검수해 채택한 제보만 기록 카드로 만들어 기록 층에 공개한다.
// 첨부 파일(0004 명세 3장): 접수 뒤 비공개 버킷에 올린다. 운영진만 본다.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import {
  EMPTY_TIP,
  MAX_TIP_FILES,
  TIP_FILE_ACCEPT,
  submitTip,
  uploadTipFiles,
  validateTip,
  validateTipFiles,
  hasContact,
  type TipForm,
} from '../lib/tips';
import { OPTIONAL_ITEMS, OPTIONAL_PURPOSE, REQUIRED_ITEMS, REQUIRED_PURPOSE, RETENTION, SUPABASE_PROCESSOR as SB } from '../lib/privacy';

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export default function TipList() {
  const [f, setF] = useState<TipForm>(EMPTY_TIP);
  const [errs, setErrs] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const set = <K extends keyof TipForm>(k: K, v: TipForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    setErrs(validateTipFiles(next));
  };
  const removeFile = (i: number) => {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    setErrs(validateTipFiles(next));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = [...validateTip(f), ...validateTipFiles(files)];
    setErrs(v);
    if (v.length) return;
    setState('sending');
    const r = await submitTip(f);
    if (r.ok) {
      setFailedFiles(r.id && files.length ? await uploadTipFiles(r.id, files) : []);
      setState('done');
      setF(EMPTY_TIP);
      setFiles([]);
    } else {
      setState('idle');
      setErrs([r.message]);
    }
  };

  return (
    <DeskLayout>
      <h1>제보</h1>
      <p className="desk-lead">
        2026 지방선거 과정에서 보거나 겪은 일을 보내 주세요. 제보는 바로 공개하지 않습니다. 운영진이 검수해 채택한 내용만 증거로 정리해 공개합니다.
      </p>
      <p className="tip-notes">
        사진·영상·문서 파일 {MAX_TIP_FILES}개(파일당 20MB)까지 함께 보낼 수 있습니다. 이름과 연락처는 선택입니다. 다른 사람의 개인정보는 적지 마세요.
      </p>

      {state === 'done' ? (
        <div className="tip-done" role="status">
          <p>제보를 받았습니다. 검수 뒤 기록으로 정리되면 기록 층에 공개됩니다.</p>
          {failedFiles.length > 0 && (
            <p className="tip-warn">
              파일 {failedFiles.length}개를 올리지 못했습니다: {failedFiles.join(', ')}. 제보 글은 접수됐습니다. 파일은 공유 링크로 제보를 한 번 더 보내 주세요.
            </p>
          )}
          <button type="button" className="linklike" onClick={() => setState('idle')}>제보 하나 더 보내기</button>
        </div>
      ) : (
        <form className="tip-form" onSubmit={send} noValidate>
          <label>
            장소 (필수)
            <input value={f.place} onChange={(e) => set('place', e.target.value)} placeholder="예: 종로구 삼청동 사전투표소" maxLength={200} required />
          </label>
          <label>
            언제 (선택)
            <input value={f.occurred} onChange={(e) => set('occurred', e.target.value)} placeholder="예: 6월 3일 오후 2시쯤" maxLength={200} />
          </label>
          <label>
            무슨 일이 있었나요 (필수)
            <textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={7} maxLength={5000} required />
          </label>
          <label>
            사진·영상 링크 (선택, 줄마다 하나, 5개까지)
            <textarea value={f.links} onChange={(e) => set('links', e.target.value)} rows={3} placeholder="https://" />
          </label>
          <div className="tip-files">
            <label>
              사진·영상·문서 파일 (선택, {MAX_TIP_FILES}개까지, 파일당 20MB)
              <input type="file" multiple accept={TIP_FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <ul className="tip-file-list">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`}>
                    <span>{file.name} · {sizeLabel(file.size)}</span>
                    <button type="button" className="linklike" onClick={() => removeFile(i)} aria-label={`${file.name} 빼기`}>빼기</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="tip-row">
            <label>
              이름 (선택)
              <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={100} autoComplete="name" />
            </label>
            <label>
              연락처 (선택)
              <input value={f.contact} onChange={(e) => set('contact', e.target.value)} maxLength={200} placeholder="전화 또는 이메일" />
            </label>
          </div>
          {/* 미끼 칸: 사람에게는 보이지 않는다 */}
          <label className="tip-trap" aria-hidden="true">
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
          </label>
          {/* 동의 세 칸(0005 명세 2장). 법정 고지 전문은 접힘 안에 둔다(0008 명세 5장). */}
          <fieldset className="tip-consent">
            <label className="tip-check">
              <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
              <span>개인정보 수집·이용에 동의합니다 <span className="sub">(필수. 제보 내용·첨부 파일·접속 기록, 최대 1년 보관)</span></span>
            </label>
            <details className="tip-detail">
              <summary>자세히</summary>
              <dl className="tip-terms">
                <dt>목적</dt><dd>{REQUIRED_PURPOSE}</dd>
                <dt>항목</dt><dd>{REQUIRED_ITEMS}</dd>
                <dt>보유 기간</dt>
                <dd>
                  <ul>{RETENTION.filter(([k]) => k !== '이름·연락처').map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
                </dd>
              </dl>
              <p>동의를 거부할 수 있습니다. 거부하면 이 폼으로 제보할 수 없습니다.</p>
            </details>
          </fieldset>
          <fieldset className="tip-consent">
            <label className="tip-check">
              <input type="checkbox" checked={f.overseasConsent} onChange={(e) => set('overseasConsent', e.target.checked)} />
              <span>개인정보 국외 이전에 동의합니다 <span className="sub">(필수. 저장소가 {SB.country}의 {SB.name}에 있습니다)</span></span>
            </label>
            <details className="tip-detail">
              <summary>자세히</summary>
              <dl className="tip-terms">
                <dt>이전받는 자</dt><dd>{SB.name} ({SB.contact})</dd>
                <dt>이전 국가</dt><dd>{SB.country}</dd>
                <dt>이전 항목</dt><dd>{SB.items}</dd>
                <dt>시기와 방법</dt><dd>{SB.when}</dd>
                <dt>목적과 기간</dt><dd>{SB.task}. 기간은 위 보유 기간과 같습니다.</dd>
              </dl>
              <p>동의를 거부할 수 있습니다. 거부하려면 체크하지 않으면 됩니다. 거부하면 이 폼으로 제보할 수 없습니다.</p>
            </details>
          </fieldset>
          {hasContact(f) && (
            <fieldset className="tip-consent">
              <label className="tip-check">
                <input type="checkbox" checked={f.optionalConsent} onChange={(e) => set('optionalConsent', e.target.checked)} />
                <span>이름·연락처 수집·이용에 동의합니다 <span className="sub">(선택. 사실 확인 연락에만 쓰고 검수 뒤 삭제)</span></span>
              </label>
              <details className="tip-detail">
                <summary>자세히</summary>
                <dl className="tip-terms">
                  <dt>목적</dt><dd>{OPTIONAL_PURPOSE}</dd>
                  <dt>항목</dt><dd>{OPTIONAL_ITEMS}</dd>
                  <dt>보유 기간</dt><dd>{RETENTION[0][1]}</dd>
                </dl>
                <p>동의하지 않아도 제보할 수 있습니다. 동의하지 않으려면 이름과 연락처 칸을 비워 주세요.</p>
              </details>
            </fieldset>
          )}
          <p className="sub">자세한 내용은 <Link to="/privacy">개인정보 처리방침</Link>에 있습니다.</p>
          {errs.length > 0 && (
            <ul className="tip-errors" role="alert">
              {errs.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          <button type="submit" className="tip-submit" disabled={state === 'sending'}>
            {state === 'sending' ? (files.length ? '파일과 함께 보내는 중…' : '보내는 중…') : '제보 보내기'}
          </button>
        </form>
      )}
    </DeskLayout>
  );
}
