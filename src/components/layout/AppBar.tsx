import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

export default function AppBar({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <header className="appbar">
      <Link to="/" className="brand">
        선거 증거 아카이브<small>6·3 지선 제보</small>
      </Link>
      <nav className="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className="sep">›</span>}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="cur">{c.label}</span>}
          </span>
        ))}
      </nav>
    </header>
  );
}
