// 사전 렌더링용 서버 엔트리. `scripts/prerender.mjs`가 빌드 결과를 불러 쓴다.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';
import { SnapshotProvider, snapshotScript, snapshotRefScript } from './lib/snapshot';
import type { Dataset } from './lib/data';

export { fetchPublicEvidence } from './lib/data';
export { pageMeta, prerenderPaths, SITE_NAME } from './lib/seo';
export { snapshotScript, snapshotRefScript };
export { basemapSvg, BASEMAP_HREF } from './components/map/SvgMap';
export { llmsTxt, recordsMarkdown, evidenceMarkdown, markdownPath, RECORDS_MD, jsonLd, jsonLdScript } from './lib/llms';
export { toEvidence } from './types/evidence';

export function render(url: string, ds: Dataset): string {
  return renderToString(
    <StrictMode>
      <SnapshotProvider value={ds}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </SnapshotProvider>
    </StrictMode>
  );
}
