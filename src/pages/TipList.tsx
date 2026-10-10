// 제보 받기(0001 플랜 5단계). 제보는 공개 목록에 올리지 않는다.
// 운영진이 검수해 채택한 제보만 기록 카드로 만들어 기록 층에 공개한다.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import { EMPTY_TIP, submitTip, validateTip, type TipForm } from '../lib/tips';

export default function TipList() {
  const [f, setF] = useState<TipForm>(EMPTY_TIP);
  const [errs, setErrs] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const set = <K extends keyof TipForm>(k: K, v: TipForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateTip(f);
    setErrs(v);
    if (v.length) return;
    setState('sending');
    const r = await submitTip(f);
    if (r.ok) {
      setState('done');
      setF(EMPTY_TIP);
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
        <li>사진·영상은 지금은 링크로 받습니다. 공유 링크(드라이브, 유튜브 등)를 적어 주세요.</li>
        <li>이름과 연락처는 적지 않아도 됩니다. 적으면 사실 확인 연락에만 쓰고, 검수가 끝나면 지웁니다.</li>
        <li>공개된 기록은 <Link to="/records">기록</Link>에서 볼 수 있습니다.</li>
      </ul>

      {state === 'done' ? (
        <div className="tip-done" role="status">
          <p>제보를 받았습니다. 검수 뒤 기록으로 정리되면 기록 층에 공개됩니다.</p>
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
              수집 항목: 제보 내용, 이름·연락처(적은 경우). 목적: 제보 사실 확인. 보관: 이름과 연락처는 검수가 끝나면 지우고, 제보 내용은
              기록 정리에 씁니다. 이름과 연락처는 어떤 화면에도 공개하지 않습니다.
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
            {state === 'sending' ? '보내는 중…' : '제보 보내기'}
          </button>
        </form>
      )}
    </DeskLayout>
  );
}
