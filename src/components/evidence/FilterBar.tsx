import { useMemo } from 'react';
import type { Evidence } from '../../types/evidence';
import type { Filters } from '../../lib/data';
import { EVIDENCE_TYPES } from '../../types/evidence';
import { typeIcon } from './EvidenceCard';

interface Props {
  all: Evidence[]; // 이 지역 전체(필터 전) — 유형/장소 목록 산출용
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function FilterBar({ all, filters, onChange }: Props) {
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of all) m[e.evidence_type] = (m[e.evidence_type] || 0) + 1;
    return m;
  }, [all]);

  const places = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of all) m[e.place] = (m[e.place] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [all]);

  const toggleType = (t: string) => {
    const types = new Set(filters.types);
    types.has(t) ? types.delete(t) : types.add(t);
    onChange({ ...filters, types });
  };
  const pickPlace = (p: string) => {
    onChange({ ...filters, place: filters.place === p ? null : p });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="filterbar">
        {EVIDENCE_TYPES.filter((t) => typeCounts[t]).map((t) => (
          <button key={t} className={`chip${filters.types.has(t) ? ' on' : ''}`} onClick={() => toggleType(t)}>
            {typeIcon(t)} {t} <span style={{ opacity: 0.6 }}>{typeCounts[t]}</span>
          </button>
        ))}
      </div>
      {places.length > 1 && (
        <div className="filterbar">
          {filters.place && (
            <button className="chip place on" onClick={() => pickPlace(filters.place!)}>✕ {filters.place}</button>
          )}
          {!filters.place &&
            places.map(([p, n]) => (
              <button key={p} className="chip place" onClick={() => pickPlace(p)}>
                {p} <span style={{ opacity: 0.6 }}>{n}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
