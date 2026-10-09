import { Suspense, useEffect, useState, type ReactNode } from 'react';

// 브라우저에서 마운트된 뒤에만 children을 그린다.
// 서버 렌더와 하이드레이션 첫 렌더는 fallback으로 같으므로 불일치가 없다.
// MapLibre처럼 window를 참조하는 컴포넌트를 lazy import와 함께 감싼다.
export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
