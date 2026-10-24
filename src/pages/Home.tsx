// 홈(0008 명세 2장): 이름, 수집·검증 건수, 면책 한 줄, 지도, 최근 증거, 입구 링크 두 개.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { toEvidence, compareLedger, type Evidence } from '../types/evidence';
import { formatOccurred, sourceLabel } from '../lib/seo';
import DeskLayout from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';
import SvgMap from '../components/map/SvgMap';
import { COPY, langPath, type Lang } from '../lib/i18n';
import { MANUAL_ONLY_STATUSES } from '../lib/status';

const dateOf = (e: Evidence) => (e.occurredAt ? e.occurredAt.slice(0, 10) : null);

function timeOf(e: Evidence): string {
  const t = e.occurredAt?.match(/T(\d{2}:\d{2})/);
  return t ? t[1] : formatOccurred(e.occurredAt);
}

export default function Home({ ds, lang = 'ko' }: { ds: Dataset; lang?: Lang }) {
  const t = COPY[lang];
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

  // 검증 건수: 상태가 문서 확인 또는 영상 확인인 증거(0008 플랜). 0건이어도 그대로 보여 준다.
  const verified = ledger.filter((e) => (MANUAL_ONLY_STATUSES as readonly string[]).includes(e.status)).length;

  return (
    <DeskLayout lang={lang}>
      <header className="home-hero">
        <h1>{t.siteName}</h1>
        <p className="home-tagline">{t.tagline}</p>
        <p className="home-counts">
          <span>{t.home.collected(ledger.length)}</span>
          <span>{t.home.verified(verified)}</span>
        </p>
        <p className="home-disclaimer">{t.disclaimer}</p>
      </header>
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
            {!latest.length && <li>{t.home.noRecords}</li>}
          </ul>
        </section>
      </div>

      <p className="home-doors">
        <Link to="/records">{t.home.view.records}{t.koOnly}</Link>
        <Link to="/tips">{t.home.view.tips}{t.koOnly}</Link>
        <Link to={langPath(lang, '/about')} className="sub">{t.home.aboutLink}</Link>
      </p>
    </DeskLayout>
  );
}
