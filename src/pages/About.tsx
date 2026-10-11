// 소개(0004 명세 2장, 영어판 0007). 목적, 네 층, 상태, 검증 네 줄, 하지 않는 것, 정정과 문의.
import { Link } from 'react-router-dom';
import DeskLayout from '../components/layout/DeskLayout';
import { COPY, type Lang } from '../lib/i18n';
import { EVIDENCE_STATUSES, VERIFICATION_FIELDS } from '../lib/status';

export default function About({ lang = 'ko' }: { lang?: Lang }) {
  const t = COPY[lang];
  const a = t.about;
  const [before, after] = a.contact();
  return (
    <DeskLayout lang={lang}>
      <h1>{a.title}</h1>
      <p className="desk-lead">{a.lead}</p>

      <section className="about-section">
        <h2>{a.whatWeDo}</h2>
        <ol className="home-how">
          {t.how.map(([k, v]) => (
            <li key={k}><strong>{k}</strong> {v}</li>
          ))}
        </ol>
      </section>

      <section className="about-section">
        <h2>{a.layersTitle}</h2>
        <p>{a.layersNote}</p>
        <dl className="about-dl">
          <dt><Link to="/records">{t.nav.records}</Link></dt><dd>{t.layers.records}{t.koOnly}</dd>
          <dt><Link to="/stats">{t.nav.stats}</Link></dt><dd>{t.layers.stats}{t.koOnly}</dd>
          <dt><Link to="/feed">{t.nav.feed}</Link></dt><dd>{t.layers.feed}{t.koOnly}</dd>
          <dt><Link to="/tips">{t.nav.tips}</Link></dt><dd>{t.layers.tips}{t.koOnly}</dd>
        </dl>
      </section>

      <section className="about-section">
        <h2>{a.statusTitle}</h2>
        <p>{a.statusNote}</p>
        <dl className="about-dl">
          {EVIDENCE_STATUSES.map((s) => (
            <div key={s}>
              <dt>{t.statusLabel[s]}</dt>
              <dd>{t.statusLegend[s]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h2>{a.verificationTitle}</h2>
        <p>{a.verificationNote}</p>
        <dl className="about-dl">
          {VERIFICATION_FIELDS.map(([k]) => (
            <div key={k}>
              <dt>{t.verificationLabel[k]}</dt>
              <dd>{t.verificationHelp[k]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="about-section">
        <h2>{a.dontTitle}</h2>
        <ul>
          {a.dont.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </section>

      <section className="about-section">
        <h2>{a.contactTitle}</h2>
        <p>
          {before}<Link to="/contact">{t.nav.contact}{t.koOnly}</Link>{after}
        </p>
      </section>
    </DeskLayout>
  );
}
