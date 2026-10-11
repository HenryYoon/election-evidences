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
  type TipForm,
} from '../lib/tips';

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
        선거 과정에서 보거나 겪은 일을 보내 주세요. 제보는 바로 공개하지 않습니다. 운영진이 검수해 채택한 내용만 기록으로 정리해 공개합니다.
      </p>
      <ul className="tip-notes">
        <li>사진·영상·문서 파일을 {MAX_TIP_FILES}개까지 함께 보낼 수 있습니다. 파일 하나는 20MB까지입니다. 더 큰 영상은 공유 링크(드라이브, 유튜브 등)로 보내 주세요.</li>
        <li>파일은 운영진만 봅니다. 공개할 때는 얼굴, 이름, 연락처를 가립니다.</li>
        <li>이름과 연락처는 적지 않아도 됩니다. 적으면 사실 확인 연락에만 쓰고, 검수가 끝나면 지웁니다.</li>
        <li>공개된 기록은 <Link to="/records">기록</Link>에서 볼 수 있습니다.</li>
      </ul>

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
          <fieldset className="tip-consent">
            <legend>개인정보 수집·이용 동의 (필수)</legend>
            <p>
              수집 항목: 제보 내용, 첨부 파일(파일 속 촬영 위치·시각 정보 포함), 이름·연락처(적은 경우). 목적: 제보 사실 확인. 보관: 이름과
              연락처는 검수가 끝나면 지웁니다. 채택하지 않은 제보의 첨부 파일은 검수가 끝나면 지웁니다. 제보 내용과 채택한 파일은 기록 정리에
              씁니다. 파일은 얼굴, 이름, 연락처를 가린 뒤에만 공개합니다. 이름과 연락처는 어떤 화면에도 공개하지 않습니다.
            </p>
            <label className="tip-check">
              <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /> 위 내용에 동의합니다
            </label>
          </fieldset>
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
