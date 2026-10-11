// 문의(0006 명세 1장). 내용은 운영자 메일로 전달되고 관리자 화면에도 남는다. 공개하지 않는다.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import { EMPTY_CONTACT, INQUIRY_KINDS, submitContact, validateContact, type ContactForm } from '../lib/contact';
import {
  INQUIRY_ITEMS,
  INQUIRY_OPTIONAL_ITEMS,
  INQUIRY_OPTIONAL_PURPOSE,
  INQUIRY_PURPOSE,
  INQUIRY_RETENTION,
  RESEND_PROCESSOR,
  SUPABASE_INQUIRY,
} from '../lib/privacy';

export default function Contact() {
  const [f, setF] = useState<ContactForm>(EMPTY_CONTACT);
  const [errs, setErrs] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [mailed, setMailed] = useState(true);
  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateContact(f);
    setErrs(v);
    if (v.length) return;
    setState('sending');
    const r = await submitContact(f);
    if (r.ok) {
      setMailed(r.mailed);
      setState('done');
      setF(EMPTY_CONTACT);
    } else {
      setState('idle');
      setErrs([r.message]);
    }
  };

  return (
    <DeskLayout>
      <h1>문의</h1>
      <p className="desk-lead">
        문의, 건의, 기록 정정 요청, 개인정보 요청을 받습니다. 보내신 내용은 운영진에게만 전달되고 공개하지 않습니다. 선거 과정에서 보거나 겪은 일은{' '}
        <Link to="/tips">제보</Link>로 보내 주세요.
      </p>
      <ul className="tip-notes">
        <li>정정 요청은 해당 기록의 주소와 틀린 부분을 함께 적어 주세요.</li>
        <li>답장을 받으려면 회신 이메일을 적어 주세요. 적지 않아도 보낼 수 있습니다.</li>
        <li>정치적 견해 같은 민감정보와 다른 사람의 개인정보는 적지 마세요.</li>
      </ul>

      {state === 'done' ? (
        <div className="tip-done" role="status">
          <p>문의를 받았습니다.{mailed ? '' : ' 운영진 알림이 늦을 수 있지만 내용은 저장됐습니다.'}</p>
          <button type="button" className="linklike" onClick={() => setState('idle')}>문의 하나 더 보내기</button>
        </div>
      ) : (
        <form className="tip-form" onSubmit={send} noValidate>
          <label>
            종류 (필수)
            <select value={f.kind} onChange={(e) => set('kind', e.target.value as ContactForm['kind'])} required>
              <option value="">고르세요</option>
              {INQUIRY_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>
            내용 (필수)
            <textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={8} maxLength={5000} required />
          </label>
          <label>
            회신 이메일 (선택)
            <input type="email" value={f.replyTo} onChange={(e) => set('replyTo', e.target.value)} maxLength={200} autoComplete="email" />
          </label>
          <label className="tip-trap" aria-hidden="true">
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
          </label>
          <fieldset className="tip-consent">
            <legend>개인정보 수집·이용 동의 (필수)</legend>
            <dl className="tip-terms">
              <dt>목적</dt><dd>{INQUIRY_PURPOSE}</dd>
              <dt>항목</dt><dd>{INQUIRY_ITEMS}</dd>
              <dt>보유 기간</dt>
              <dd><ul>{INQUIRY_RETENTION.map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul></dd>
            </dl>
            <p>동의를 거부할 수 있습니다. 거부하면 이 폼으로 문의할 수 없습니다.</p>
            <label className="tip-check">
              <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /> 개인정보 수집·이용에 동의합니다
            </label>
          </fieldset>
          <fieldset className="tip-consent">
            <legend>개인정보 국외 이전 동의 (필수)</legend>
            <dl className="tip-terms">
              {[SUPABASE_INQUIRY, RESEND_PROCESSOR].map((p) => (
                <div key={p.name} style={{ display: 'contents' }}>
                  <dt>{p.name}</dt>
                  <dd>{p.task}. 국가: {p.country}. 항목: {p.items}. {p.when}. 연락처: {p.contact}.</dd>
                </div>
              ))}
            </dl>
            <p>기간은 위 보유 기간과 같습니다. 동의를 거부할 수 있습니다. 거부하려면 체크하지 않으면 됩니다. 거부하면 이 폼으로 문의할 수 없습니다.</p>
            <label className="tip-check">
              <input type="checkbox" checked={f.overseasConsent} onChange={(e) => set('overseasConsent', e.target.checked)} /> 개인정보 국외 이전에 동의합니다
            </label>
          </fieldset>
          {f.replyTo.trim() && (
            <fieldset className="tip-consent">
              <legend>선택 항목 수집·이용 동의 (회신 이메일을 적은 경우)</legend>
              <dl className="tip-terms">
                <dt>목적</dt><dd>{INQUIRY_OPTIONAL_PURPOSE}</dd>
                <dt>항목</dt><dd>{INQUIRY_OPTIONAL_ITEMS}</dd>
                <dt>보유 기간</dt><dd>{INQUIRY_RETENTION[0][1]}</dd>
              </dl>
              <p>동의하지 않아도 문의할 수 있습니다. 동의하지 않으려면 회신 이메일 칸을 비워 주세요.</p>
              <label className="tip-check">
                <input type="checkbox" checked={f.optionalConsent} onChange={(e) => set('optionalConsent', e.target.checked)} /> 회신 이메일 수집·이용에 동의합니다
              </label>
            </fieldset>
          )}
          <p className="sub">자세한 내용은 <Link to="/privacy">개인정보 처리방침</Link>에 있습니다.</p>
          {errs.length > 0 && (
            <ul className="tip-errors" role="alert">
              {errs.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          <button type="submit" className="tip-submit" disabled={state === 'sending'}>
            {state === 'sending' ? '보내는 중…' : '문의 보내기'}
          </button>
        </form>
      )}
    </DeskLayout>
  );
}
