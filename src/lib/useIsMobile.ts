import { useEffect, useState } from 'react';

export function useIsMobile(bp = 860) {
  // 서버 렌더와 하이드레이션 첫 렌더가 같도록 false로 시작하고, 마운트 뒤 실제 폭을 읽는다.
  const [m, setM] = useState(false);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [bp]);
  return m;
}
