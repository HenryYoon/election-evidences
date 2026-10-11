// 홈은 입구다. 콘텐츠를 펼치지 않고, 건수를 노출하지 않는다(명세 5장 홈).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { toEvidence, compareLedger, type Evidence } from '../types/evidence';
import { formatOccurred, sourceLabel } from '../lib/seo';
import DeskLayout from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';
import SvgMap from '../components/map/SvgMap';
import { COPY, langPath, type Lang } from '../lib/i18n';

const dateOf = (e: Evidence) => (e.occurredAt ? e.occurredAt.slice(0, 10) : null);

function timeOf(e: Evidence): string {
  const t = e.occurredAt?.match(/T(\d{2}:\d{2})/);
  return t ? t[1] : formatOccurred(e.occurredAt);
}

export default function Home({ ds, lang = 'ko' }: { ds: Dataset; lang?: Lang }) {
  const t = COPY[lang];
  const ko = t.koOnly;
  const ledger = useMemo(() => ds.evidence.map(toEvidence).sort(compareLedger), [ds]);
  // "오늘 기록"은 기록에서 가장 최근 발생일이다. 빌드 날짜가 아니다.
  const day = ledger.map(dateOf).find(Boolean) ?? null;
  const today = day ? ledger.filter((e) => dateOf(e) === day) : [];
  const latest = (today.length ? today : ledger).slice(0, 3);
  // 지도에는 좌표가 있는 기록 카드를 모두 찍는다. 피드와 제보는 찍지 않는다.
  const points = ledger
    .filter((e) => e.lat !== null && e.lng !== null)
    .map((e) => ({
      id: e.id,
      lng: e.lng as number,
      lat: e.lat as number,
      label: `${e.placeName} · ${e.claim}`,
      card: {
        thumb: e.photos.find((p) => p.thumb)?.thumb ?? null,
        claim: e.claim,
        meta: `${formatOccurred(e.occurredAt)} · ${e.placeName || t.home.placeUnknown}`,
        status: t.statusLabel[e.status],
      },
    }));
  const newest = ledger[0];

  return (
    <DeskLayout lang={lang}>
      <h1>{t.siteName}</h1>
      <p className="desk-lead">
        {t.purpose} {t.disclaimer}
      </p>
      <ol className="home-how">
        {t.how.map(([k, v]) => (
          <li key={k}><strong>{k}</strong> {v}</li>
        ))}
      </ol>
      <p className="home-about"><Link to={langPath(lang, '/about')}>{t.home.aboutLink}</Link></p>
      {t.home.translationNote && <p className="sub">{t.home.translationNote}</p>}

      <div className="home-grid">
        <section aria-label={t.home.mapLabel}>
          <SvgMap points={points} title={t.home.mapTitle} />
          <p className="sub">{t.home.mapNote}</p>
        </section>
        <section aria-label={t.home.latestLabel}>
          <h2>{day ? t.home.latestDay(day) : t.home.latestNone}</h2>
          <ul className="home-latest">
            {latest.map((e) => (
              <li key={e.id}>
                <div className="meta">
                  <span>{timeOf(e)}</span>
                  <span lang="ko">{e.placeName || t.home.placeUnknown}</span>
                  <StatusMark status={e.status} lang={lang} />
                </div>
                <Link to={`/e/${e.id}`} lang="ko">{e.claim}</Link>
                <div className="meta">{t.home.source} <span lang="ko">{sourceLabel(e)}</span></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="home-doors">
        <section>
          <h2>{t.nav.records}</h2>
          <p>{t.layers.records}</p>
          <p className="sub">{newest ? `${formatOccurred(newest.occurredAt)} · ${newest.placeName || t.home.placeUnknown}` : t.home.noRecords}</p>
          <Link to="/records">{t.home.view.records}{ko}</Link>
        </section>
        <section>
          <h2>{t.nav.stats}</h2>
          <p>{t.layers.stats}</p>
          <p className="sub">{t.home.noStats}</p>
          <Link to="/stats">{t.home.view.stats}{ko}</Link>
        </section>
        <section>
          <h2>{t.nav.feed}</h2>
          <p>{t.layers.feed}</p>
          <p className="sub">{t.home.noFeed}</p>
          <Link to="/feed">{t.home.view.feed}{ko}</Link>
        </section>
        <section>
          <h2>{t.nav.tips}</h2>
          <p>{t.layers.tips}</p>
          <p className="sub">{t.home.tipsNote}</p>
          <Link to="/tips">{t.home.view.tips}{ko}</Link>
        </section>
      </div>
    </DeskLayout>
  );
}
