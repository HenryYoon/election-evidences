// 통계 탭 — "선거 통계"(투표율·개표 수치 등 지역 선거 지표).
// 기획안 원칙: 증거 탭과 독립된 데이터셋(region 단위). 증거에서 파생하지 않는다.
// 실제 지표(NEC/선관위 공표치)는 추후 연동. 아래 수치는 레이아웃 확인용 예시(가데이터).
export default function StatsTab({ regionLabel }: { regionLabel: string }) {
  // TODO: 실제 선거 통계 데이터셋 연동 (선거인수·투표수·투표율·무효표 등)
  const sample = [
    { k: '선거인수', v: '—' },
    { k: '투표수', v: '—' },
    { k: '투표율', v: '—' },
    { k: '무효표율', v: '—' },
  ];

  return (
    <div className="stats">
      <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 10 }}>
        {regionLabel} 선거 통계
        <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--ink-3)' }}>· 지역 선거 지표</span>
      </div>
      <div className="kpis">
        {sample.map((s) => (
          <div className="kpi" key={s.k}>
            <div className="v">{s.v}</div>
            <div className="k">{s.k}</div>
          </div>
        ))}
      </div>
      <div className="note">
        📊 통계 탭은 <b>선거 통계(투표율·개표 수치·유권자수 등 지역 선거 지표)</b>를 다루며,
        <b> 증거 데이터와 독립된 데이터셋</b>입니다. 지표 종류·차트와 데이터 출처(NEC/선관위 공표치)는
        추후 확정·연동 예정입니다. 아카이브의 정체성은 <b>증거 탭</b>에 있습니다.
      </div>
    </div>
  );
}
