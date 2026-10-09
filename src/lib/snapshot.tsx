// 빌드 시점 데이터 스냅샷.
// 사전 렌더링은 스냅샷으로 HTML을 만들고, 같은 스냅샷을 HTML에 심는다.
// 브라우저는 심긴 스냅샷으로 첫 렌더를 해서 하이드레이션 불일치를 막는다.
// 최신 데이터는 하이드레이션 뒤에 읽어 반영한다.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Dataset } from './data';
import { loadPublicEvidence } from './data';

export const SNAPSHOT_GLOBAL = '__DESK__';

declare global {
  interface Window {
    [SNAPSHOT_GLOBAL]?: Dataset;
  }
}

const SnapshotContext = createContext<Dataset | null>(null);

export function SnapshotProvider({ value, children }: { value: Dataset | null; children: ReactNode }) {
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

// 첫 렌더는 스냅샷, 마운트 뒤에는 최신 공개 데이터. 스냅샷이 없으면(SPA 셸) 로드 완료 전까지 null.
export function useDataset(): Dataset | null {
  const snapshot = useContext(SnapshotContext);
  const [ds, setDs] = useState<Dataset | null>(snapshot);
  useEffect(() => {
    let alive = true;
    loadPublicEvidence().then(
      (evidence) => {
        if (alive && evidence.length) setDs({ evidence });
      },
      (e) => console.warn('공개 데이터 로드 실패:', e)
    );
    return () => {
      alive = false;
    };
  }, []);
  return ds;
}

const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g');
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g');

// HTML에 심을 스크립트. `<`와 줄 구분 문자를 이스케이프해 </script> 탈출을 막는다.
export function snapshotScript(ds: Dataset): string {
  const json = JSON.stringify(ds)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
  return `<script>window.${SNAPSHOT_GLOBAL}=${json}</script>`;
}
