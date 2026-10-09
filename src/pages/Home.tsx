// 홈은 입구다. 콘텐츠를 펼치지 않고, 건수를 노출하지 않는다(명세 5장 홈).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Dataset } from '../lib/data';
import { toEvidence, compareLedger, type Evidence } from '../types/evidence';
import { formatOccurred, sourceLabel, SITE_NAME } from '../lib/seo';
import { STATUS_DISCLAIMER } from '../lib/status';
import DeskLayout from '../components/layout/DeskLayout';
import { StatusMark } from '../components/evidence/StatusLegend';
import SvgMap from '../components/map/SvgMap';

const dateOf = (e: Evidence) => (e.occurredAt ? e.occurredAt.slice(0, 10) : null);

function timeOf(e: Evidence): string {
  const t = e.occurredAt?.match(/T(\d{2}:\d{2})/);
  return t ? t[1] : formatOccurred(e.occurredAt);
}

export default function Home({ ds }: { ds: Dataset }) {
  const ledger = useMemo(() => ds.evidence.map(toEvidence).sort(compareLedger), [ds]);
  // "오늘 원장"은 원장에서 가장 최근 발생일이다. 빌드 날짜가 아니다.
  const day = ledger.map(dateOf).find(Boolean) ?? null;
  const today = day ? ledger.filter((e) => dateOf(e) === day) : [];
  const latest = (today.length ? today : ledger).slice(0, 3);
  // 지도에는 좌표가 있는 원장 카드를 모두 찍는다. 피드와 제보는 찍지 않는다.
  const points = ledger
    .filter((e) => e.lat !== null && e.lng !== null)
    .map((e) => ({ id: e.id, lng: e.lng as number, lat: e.lat as number, label: `${e.placeName} · ${e.claim}` }));
  const newest = ledger[0];

  return (
    <DeskLayout>
      <h1>{SITE_NAME}</h1>
      <p className="desk-lead">
        {day ? `${day} 원장. ` : ''}
        {STATUS_DISCLAIMER}
      </p>

      <div className="home-grid">
        <section aria-label="원장 지도">
          <SvgMap points={points} title="원장 카드 위치" />
          <p className="sub">점은 좌표가 있는 원장 카드다. 점을 누르면 카드로 간다. 피드와 제보는 찍지 않는다.</p>
        </section>
        <section aria-label="최근 원장">
          <h2>{day ? `${day} 원장` : '최근 원장'}</h2>
          <ul className="home-latest">
            {latest.map((e) => (
              <li key={e.id}>
                <div className="meta">
                  <span>{timeOf(e)}</span>
                  <span>{e.placeName || '장소 미상'}</span>
                  <StatusMark status={e.status} />
                </div>
                <Link to={`/e/${e.id}`}>{e.claim}</Link>
                <div className="meta">출처 {sourceLabel(e)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="home-doors">
        <section>
          <h2>원장</h2>
          <p>{newest ? `${formatOccurred(newest.occurredAt)} · ${newest.placeName || '장소 미상'}` : '아직 기록이 없다.'}</p>
          <Link to="/ledger">원장 보기</Link>
        </section>
        <section>
          <h2>통계</h2>
          <p>아직 공개한 분석이 없다.</p>
          <Link to="/stats">통계 보기</Link>
        </section>
        <section>
          <h2>피드</h2>
          <p>아직 수집한 소식이 없다.</p>
          <Link to="/feed">피드 보기</Link>
        </section>
        <section>
          <h2>제보</h2>
          <p>아직 공개한 제보가 없다.</p>
          <Link to="/tips">제보 보기</Link>
        </section>
      </div>
    </DeskLayout>
  );
}
