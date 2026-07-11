import { Routes, Route } from 'react-router-dom';
import { useDataset } from './lib/data';
import { AuthGate } from './components/AuthGate';
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
      {/* 관리자는 데이터셋 로딩과 무관하게 진입(자체 로그인 게이트 있음) */}
      <Route path="/admin" element={<Admin />} />
      {/* 공개 앱도 로그인 필요 — 비식별화 완료 전 클로즈드 운영 */}
      <Route
        path="/*"
        element={
          <AuthGate>
            <PublicApp />
          </AuthGate>
        }
      />
    </Routes>
  );
}
