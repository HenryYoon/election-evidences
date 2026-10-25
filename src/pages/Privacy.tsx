// 개인정보 처리방침(0005 명세 3장). 개인정보 보호법 제30조, 시행령 제31조 항목을 담는다.
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import {
  INQUIRY_ITEMS,
  INQUIRY_OPTIONAL_ITEMS,
  INQUIRY_PURPOSE,
  INQUIRY_RETENTION,
  OPTIONAL_ITEMS,
  OPTIONAL_PURPOSE,
  PRIVACY_EFFECTIVE_DATE,
  REQUIRED_ITEMS,
  REQUIRED_PURPOSE,
  RESEND_PROCESSOR,
  RETENTION,
  SUPABASE_INQUIRY,
  SUPABASE_PROCESSOR,
  VERCEL_PROCESSOR,
  type Processor,
} from '../lib/privacy';

const REMEDIES: readonly (readonly [string, string])[] = [
  ['개인정보 분쟁조정위원회', '1833-6972, www.kopico.go.kr'],
  ['개인정보침해 신고센터(한국인터넷진흥원)', '국번 없이 118, privacy.kisa.or.kr'],
  ['대검찰청', '국번 없이 1301, www.spo.go.kr'],
  ['경찰청', '국번 없이 182, ecrm.police.go.kr'],
];

function ProcessorRows({ p, overseas = false }: { p: Processor; overseas?: boolean }) {
  return (
    <>
      <dt>{p.name}</dt>
      <dd>
        {overseas
          ? `${p.task}. 이전 국가: ${p.country}. 이전 항목: ${p.items}. 시기와 방법: ${p.when}. 연락처: ${p.contact}.`
          : `${p.task}. 처리 위치: ${p.country}. 항목: ${p.items}. 연락처: ${p.contact}.`}
      </dd>
    </>
  );
}

export default function Privacy() {
  return (
    <DeskLayout>
      <h1>개인정보 처리방침</h1>
      <p className="desk-lead">
        선거부정진상규명국민신고센터(선진국)는 제보와 문의를 받는 데 필요한 최소한의 개인정보만 처리합니다. 이 방침은 무엇을 왜 얼마 동안 처리하는지와 정보주체가 요청할 수 있는 것을 적습니다.
      </p>

      <section className="about-section">
        <h2>1. 처리 목적과 항목</h2>
        <dl className="about-dl">
          <dt>제보(필수)</dt><dd>목적: {REQUIRED_PURPOSE}. 항목: {REQUIRED_ITEMS}.</dd>
          <dt>제보(선택)</dt><dd>목적: {OPTIONAL_PURPOSE}. 항목: {OPTIONAL_ITEMS}. 적은 경우에만 처리합니다.</dd>
          <dt>문의(필수)</dt><dd>목적: {INQUIRY_PURPOSE}. 항목: {INQUIRY_ITEMS}.</dd>
          <dt>문의(선택)</dt><dd>목적: 문의에 대한 답장. 항목: {INQUIRY_OPTIONAL_ITEMS}. 적은 경우에만 처리합니다.</dd>
          <dt>사이트 접속</dt><dd>목적: 사이트 전송과 장애·공격 대응. 항목: {VERCEL_PROCESSOR.items}.</dd>
        </dl>
        <p>제보 폼에 정치적 견해 같은 민감정보와 다른 사람의 개인정보를 적지 말아 달라고 안내합니다. 들어오더라도 공개하는 기록에는 넣지 않습니다.</p>
      </section>

      <section className="about-section">
        <h2>2. 보유 기간</h2>
        <dl className="about-dl">
          {RETENTION.map(([k, v]) => (
            <div key={k}><dt>제보: {k}</dt><dd>{v}</dd></div>
          ))}
          {INQUIRY_RETENTION.map(([k, v]) => (
            <div key={`i-${k}`}><dt>문의: {k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p>사이트 접속 기록은 Vercel의 보관 정책에 따릅니다.</p>
      </section>

      <section className="about-section">
        <h2>3. 파기 절차와 방법</h2>
        <p>
          보유 기간이 지난 정보는 매일 한 번 자동으로 파기합니다. 데이터베이스의 행은 지우고, 첨부 파일은 저장소에서 지웁니다. 지운 정보는 되살릴 수
          없습니다. 기각한 제보는 검수를 마칠 때 바로 지웁니다.
        </p>
      </section>

      <section className="about-section">
        <h2>4. 제3자 제공</h2>
        <p>개인정보를 제3자에게 제공하지 않습니다. 공개하는 기록에는 제보자 이름과 연락처가 들어가지 않습니다. 사진과 영상 속 얼굴, 이름, 연락처는 가린 뒤 공개합니다.</p>
      </section>

      <section className="about-section">
        <h2>5. 처리 위탁과 국외 이전</h2>
        <p>아래 업체에 처리를 맡깁니다. 제보와 문의는 국내(서울)에 있는 저장소에 둡니다.</p>
        <dl className="about-dl">
          <ProcessorRows p={SUPABASE_PROCESSOR} />
          <ProcessorRows p={{ ...SUPABASE_INQUIRY, name: `${SUPABASE_INQUIRY.name}(문의)` }} />
        </dl>
        <p>아래 업체는 국외에 있습니다. 문의 메일 전달과 사이트 전송을 위해 정보가 국외로 이전됩니다.</p>
        <dl className="about-dl">
          <ProcessorRows p={RESEND_PROCESSOR} overseas />
          <ProcessorRows p={VERCEL_PROCESSOR} overseas />
        </dl>
        <p>
          보유 기간은 2장과 같습니다. 문의 정보의 국외 이전은 보낼 때 별도 동의를 받습니다. 거부하려면 문의 폼의 국외 이전 동의를 체크하지 않으면 됩니다.
          거부하면 문의 폼을 쓸 수 없습니다. 사이트 접속 기록의 이전을 피하려면 사이트에 접속하지 않아야 합니다.
        </p>
      </section>

      <section className="about-section">
        <h2>6. 정보주체의 권리와 행사 방법</h2>
        <p>
          정보주체는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 동의를 철회할 수도 있습니다. 요청은 <Link to="/contact">문의</Link>에서 "개인정보
          요청"을 골라 보내 주세요. 본인 확인에 필요한 만큼만 확인한 뒤 10일 안에 처리합니다.
        </p>
      </section>

      <section className="about-section">
        <h2>7. 안전성 확보 조치</h2>
        <ul>
          <li>제보 원문, 연락처, 첨부 파일, 문의는 공개되지 않는 저장소에 두고 관리자만 읽게 합니다(행 수준 보안).</li>
          <li>모든 전송은 HTTPS로 암호화합니다.</li>
          <li>관리자 계정은 하나이며 강한 비밀번호 기준을 씁니다. 신규 가입은 막혀 있습니다.</li>
          <li>접속 IP는 원문으로 저장하지 않고 변환값만 1일 보관합니다.</li>
          <li>운영자 이메일 주소와 메일 발송 키는 서버에만 두고 화면에 공개하지 않습니다.</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>8. 자동 수집 장치</h2>
        <p>공개 페이지는 쿠키를 쓰지 않습니다. 방문 통계(Vercel Analytics)는 쿠키 없이 집계합니다. 관리자 로그인 정보만 관리자 브라우저 저장소에 둡니다.</p>
      </section>

      <section className="about-section">
        <h2>9. 개인정보 보호책임자</h2>
        <p>선진국 운영자가 보호책임자를 맡습니다. 연락은 <Link to="/contact">문의</Link> 페이지로 받습니다. 보낸 내용은 보호책임자의 이메일로 바로 전달됩니다.</p>
      </section>

      <section className="about-section">
        <h2>10. 권익침해 구제</h2>
        <p>개인정보 침해에 대한 상담이나 신고는 아래 기관에 할 수 있습니다.</p>
        <dl className="about-dl">
          {REMEDIES.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h2>11. 시행일</h2>
        <p>이 방침은 {PRIVACY_EFFECTIVE_DATE}부터 적용합니다. 바뀌면 이 페이지에 바뀐 날짜와 내용을 적습니다.</p>
        <ul>
          <li>2026-10-25: 제보·문의 저장소를 호주(시드니)에서 대한민국(서울)으로 옮겼습니다. 제보는 더 이상 국외로 이전하지 않습니다.</li>
          <li>2026-10-11: 처음 시행.</li>
        </ul>
      </section>
    </DeskLayout>
  );
}
