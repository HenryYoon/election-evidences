import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/global.css';
import App from './App';
import { SnapshotProvider, SNAPSHOT_GLOBAL } from './lib/snapshot';

const root = document.getElementById('root')!;
const snapshot = window[SNAPSHOT_GLOBAL] ?? null;

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
else ReactDOM.createRoot(root).render(app);
