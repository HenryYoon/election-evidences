import { Routes, Route } from 'react-router-dom';
import { useDataset } from './lib/data';
import UnifiedMap from './pages/UnifiedMap';
import EvidenceDetailPage from './pages/EvidenceDetailPage';
import Admin from './pages/Admin';

function PublicApp() {
  const ds = useDataset();
  if (!ds) return <div className="loading">아카이브를 불러오는 중…</div>;
  return (
    <Routes>
      <Route path="/" element={<UnifiedMap ds={ds} />} />
      <Route path="/e/:evidenceId" element={<EvidenceDetailPage ds={ds} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      {/* 관리자만 자체 로그인 게이트. 공개 앱은 로그인 없음(비식별화로 보호) */}
      <Route path="/admin" element={<Admin />} />
      <Route path="/*" element={<PublicApp />} />
    </Routes>
  );
}
