// 기록 필터: 유형, 선거, 상태, 지역. 선택지는 기록에 실제로 있는 값만 보인다.
import type { Evidence } from '../../types/evidence';
import { EVIDENCE_TYPES } from '../../types/evidence';
import { EVIDENCE_STATUSES, EVIDENCE_STATUS_LABEL } from '../../lib/status';
import { NO_FILTERS, type LedgerFilters } from '../../lib/data';

interface Props {
  all: Evidence[];
  value: LedgerFilters;
  onChange: (f: LedgerFilters) => void;
}

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'ko'));

export default function FilterBar({ all, value, onChange }: Props) {
  const types = EVIDENCE_TYPES.filter((t) => all.some((e) => e.type === t));
  const elections = uniq(all.map((e) => e.election));
  const statuses = EVIDENCE_STATUSES.filter((s) => all.some((e) => e.status === s));
  const regions = uniq(all.map((e) => e.regionWideLabel));
  const set = (k: keyof LedgerFilters) => (ev: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...value, [k]: ev.target.value });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="filters">
      <label>유형
        <select value={value.type} onChange={set('type')}>
          <option value="">전체</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>선거
        <select value={value.election} onChange={set('election')}>
          <option value="">전체</option>
          {elections.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label>상태
        <select value={value.status} onChange={set('status')}>
          <option value="">전체</option>
          {statuses.map((s) => <option key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <label>지역
        <select value={value.region} onChange={set('region')}>
          <option value="">전체</option>
          {regions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {active && <button type="button" onClick={() => onChange(NO_FILTERS)}>조건 지우기</button>}
    </div>
  );
}
