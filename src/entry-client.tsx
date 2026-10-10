import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/global.css';
import './styles/desk.css';
import App from './App';
import { SnapshotProvider, SNAPSHOT_GLOBAL, SNAPSHOT_SRC_GLOBAL } from './lib/snapshot';
import type { Dataset } from './lib/data';

const root = document.getElementById('root')!;

// 스냅샷은 HTML에 심겨 있거나(상세), 별도 파일로 있다(홈, 기록 목록).
// 파일은 받은 뒤에만 하이드레이션한다. 못 받으면 새로 그린다.
async function loadSnapshot(): Promise<Dataset | null> {
  const inline = window[SNAPSHOT_GLOBAL];
  if (inline) return inline;
  const src = window[SNAPSHOT_SRC_GLOBAL];
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as Dataset;
  } catch (e) {
    console.warn('스냅샷 로드 실패:', e);
    return null;
  }
}

function boot(snapshot: Dataset | null) {
  const app = (
    <React.StrictMode>
      <SnapshotProvider value={snapshot}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SnapshotProvider>
    </React.StrictMode>
  );
  // 사전 렌더링된 페이지는 하이드레이션, SPA 셸(/admin, 빌드 뒤에 생긴 경로)은 새로 렌더링한다.
  if (snapshot && root.hasChildNodes()) ReactDOM.hydrateRoot(root, app);
  else {
    root.textContent = '';
    ReactDOM.createRoot(root).render(app);
  }
}

loadSnapshot().then(boot);
