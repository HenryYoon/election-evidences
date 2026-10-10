import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { STATUS_DISCLAIMER } from '../../lib/status';

const LAYERS = [
  { to: '/records', label: '기록' },
  { to: '/stats', label: '통계' },
  { to: '/feed', label: '피드' },
  { to: '/tips', label: '제보' },
];

// 공통 레이아웃: 상단 DESK 표시와 네 층 내비게이션.
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="desk">
      <header className="desk-top">
        <Link to="/" className="mark">DESK</Link>
        <nav aria-label="층">
          {LAYERS.map((l) => (
            <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
          ))}
        </nav>
      </header>
      <main className="desk-main">{children}</main>
    </div>
  );
}

// 홈, 기록, 통계 첫 화면에 고정하는 문장(명세 1장).
export function Disclaimer() {
  return <p className="desk-disclaimer">{STATUS_DISCLAIMER}</p>;
}
