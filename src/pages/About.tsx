// 소개(0004 명세 2장). 목적, 네 층, 상태, 검증 네 줄, 하지 않는 것, 정정과 문의.
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import { HOW_STEPS, LAYER_LINES, SITE_PURPOSE } from '../lib/site';
import {
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_LABEL,
  EVIDENCE_STATUS_LEGEND,
  STATUS_DISCLAIMER,
  VERIFICATION_FIELDS,
} from '../lib/status';

const VERIFICATION_HELP: Record<(typeof VERIFICATION_FIELDS)[number][0], string> = {
  seen: '사진·영상·문서에 실제로 보이는 것.',
  where: '장소를 무엇으로 확인했는지.',
  when: '시각을 무엇으로 확인했는지.',
  notClaimed: '이 자료만으로는 말할 수 없는 것.',
};

export default function About() {
  return (
    <DeskLayout>
      <h1>소개</h1>
      <p className="desk-lead">
        선거 증거 데스크는 {SITE_PURPOSE} {STATUS_DISCLAIMER}
      </p>

      <section className="about-section">
        <h2>하는 일</h2>
        <ol className="home-how">
          {HOW_STEPS.map(([k, v]) => (
            <li key={k}><strong>{k}</strong> {v}</li>
          ))}
        </ol>
      </section>

      <section className="about-section">
        <h2>네 층</h2>
        <p>층마다 기록의 성격이 다르다. 그래서 층끼리 건수를 합치지 않는다.</p>
        <dl className="about-dl">
          <dt><Link to="/records">기록</Link></dt><dd>{LAYER_LINES.records}</dd>
          <dt><Link to="/stats">통계</Link></dt><dd>{LAYER_LINES.stats}</dd>
          <dt><Link to="/feed">피드</Link></dt><dd>{LAYER_LINES.feed}</dd>
          <dt><Link to="/tips">제보</Link></dt><dd>{LAYER_LINES.tips}</dd>
        </dl>
      </section>

      <section className="about-section">
        <h2>상태</h2>
        <p>기록마다 상태 하나를 붙인다. {STATUS_DISCLAIMER} 문서 확인과 영상 확인은 운영진이 검증 네 줄을 채운 뒤에만 붙인다.</p>
        <dl className="about-dl">
          {EVIDENCE_STATUSES.map((s) => (
            <div key={s}>
              <dt>{EVIDENCE_STATUS_LABEL[s]}</dt>
              <dd>{EVIDENCE_STATUS_LEGEND[s]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h2>검증 네 줄</h2>
        <p>기록 상세 화면에는 아래 네 줄을 적는다. 확인한 것과 확인하지 않은 것을 나누기 위해서다.</p>
        <dl className="about-dl">
          {VERIFICATION_FIELDS.map(([k, label]) => (
            <div key={k}>
              <dt>{label}</dt>
              <dd>{VERIFICATION_HELP[k]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h2>하지 않는 것</h2>
        <ul>
          <li>상태로 위법 여부를 판단하지 않는다.</li>
          <li>확인하지 않은 내용을 확인한 것처럼 쓰지 않는다.</li>
          <li>제보를 검수 없이 공개하지 않는다.</li>
          <li>제보자 이름과 연락처를 어떤 화면에도 공개하지 않는다.</li>
          <li>사진과 영상 속 얼굴, 이름, 연락처는 가린 뒤 공개한다.</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>정정과 문의</h2>
        <p>
          기록에 틀린 내용이 있으면 <Link to="/contact">문의</Link>에서 "정정 요청"을 골라 알려 주세요. 해당 기록의 주소와 틀린 부분을 함께 적어 주세요. 운영진이
          확인한 뒤 기록을 고칩니다. 건의와 그 밖의 문의도 같은 곳에서 받습니다.
        </p>
      </section>
    </DeskLayout>
  );
}
