import { useEffect, useRef, useState, type ReactNode } from 'react';

export type Snap = 'peek' | 'half' | 'full';

// 스냅별 시트 상단 위치(뷰포트 높이 대비 top %) — 작을수록 높이 올라옴
const TOP: Record<Snap, number> = { peek: 0.86, half: 0.45, full: 0.08 };
const ORDER: Snap[] = ['peek', 'half', 'full'];

interface Props {
  snap: Snap;
  onSnap: (s: Snap) => void;
  header: ReactNode; // 손잡이 아래 고정 영역(탭 등)
  children: ReactNode;
}

export default function BottomSheet({ snap, onSnap, header, children }: Props) {
  const [drag, setDrag] = useState<{ startY: number; baseTop: number; cur: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const vh = () => window.innerHeight;

  const topPx = drag ? drag.cur : TOP[snap] * vh();

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const dy = e.clientY - drag.startY;
      const cur = Math.min(vh() * 0.92, Math.max(vh() * 0.06, drag.baseTop + dy));
      setDrag((d) => (d ? { ...d, cur } : d));
    };
    const up = () => {
      const ratio = drag.cur / vh();
      // 가장 가까운 스냅으로
      let best: Snap = 'half', bd = Infinity;
      for (const s of ORDER) { const d = Math.abs(TOP[s] - ratio); if (d < bd) { bd = d; best = s; } }
      onSnap(best);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, onSnap]);

  const startDrag = (e: React.PointerEvent) => {
    setDrag({ startY: e.clientY, baseTop: TOP[snap] * vh(), cur: TOP[snap] * vh() });
  };

  return (
    <div
      ref={sheetRef}
      className="sheet"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        top: topPx, transition: drag ? 'none' : 'top .28s cubic-bezier(.4,0,.2,1)',
        background: 'var(--surface)', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -8px 30px rgba(20,28,60,.16)', display: 'flex', flexDirection: 'column',
        zIndex: 20, touchAction: 'none',
      }}
    >
      <div onPointerDown={startDrag} style={{ padding: '8px 0 4px', flex: '0 0 auto', cursor: 'grab' }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--line)', margin: '0 auto' }} />
      </div>
      <div style={{ flex: '0 0 auto', padding: '4px 14px 10px' }}>{header}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 20px' }}>{children}</div>
    </div>
  );
}
