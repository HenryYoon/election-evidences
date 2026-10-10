import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { useDataset } from './lib/snapshot';
import type { Dataset } from './lib/data';
import { pageMeta } from './lib/seo';
import Home from './pages/Home';
import Ledger from './pages/Ledger';
import StatsList from './pages/StatsList';
import FeedList from './pages/FeedList';
import TipList from './pages/TipList';
import EvidenceDetailPage from './pages/EvidenceDetailPage';
// 관리자 화면(Supabase 클라이언트 포함)은 공개 페이지 번들에서 뺀다. /admin은 사전 렌더링하지 않는다.
const Admin = lazy(() => import('./pages/Admin'));

// 클라이언트 내비게이션 때 head를 경로에 맞춘다. 첫 HTML의 head는 사전 렌더링이 쓴다.
function useHead(ds: Dataset) {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = pageMeta(pathname, ds);
    if (!meta) return;
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = new URL(meta.path, canonical.href).href;
  }, [pathname, ds]);
}

function PublicRoutes({ ds }: { ds: Dataset }) {
  useHead(ds);
  return (
    <Routes>
      <Route path="/" element={<Home ds={ds} />} />
      <Route path="/records" element={<Ledger ds={ds} />} />
      <Route path="/ledger" element={<Navigate to="/records" replace />} />
      <Route path="/e/:evidenceId" element={<EvidenceDetailPage ds={ds} />} />
      <Route path="/stats" element={<StatsList />} />
      <Route path="/feed" element={<FeedList />} />
      <Route path="/tips" element={<TipList />} />
    </Routes>
  );
}

function PublicApp() {
  const ds = useDataset();
  if (!ds) return <div className="desk"><main className="desk-main">불러오는 중…</main></div>;
  return <PublicRoutes ds={ds} />;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* 관리자만 자체 로그인 게이트. 공개 앱은 로그인 없음(비식별화로 보호) */}
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        <Route path="/*" element={<PublicApp />} />
      </Routes>
      <Analytics />
    </>
  );
}
