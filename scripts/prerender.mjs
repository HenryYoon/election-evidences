// 빌드 뒤 경로별 HTML, sitemap.xml, robots.txt를 만든다.
// 순서: vite build(클라이언트) → vite build --ssr(서버 엔트리) → 이 스크립트.
//
// 데이터: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 있으면 Supabase 공개 행을 읽는다.
//   읽기에 실패하면 빌드를 실패시킨다. 빈 사이트를 배포하지 않기 위해서다.
//   두 값이 없으면 로컬 개발용 public/data/evidence.json을 읽는다(커밋 금지 파일).
// 사이트 주소: SITE_URL → VITE_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL 순서로 찾는다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SERVER = join(ROOT, 'dist-server', 'entry-server.js');

function loadEnv() {
  const env = {};
  const file = join(ROOT, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...env, ...process.env };
}

function siteUrl(env) {
  const raw =
    env.SITE_URL ||
    env.VITE_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  if (!raw) {
    console.warn('[prerender] SITE_URL이 없어 http://localhost:4173 으로 canonical을 만든다.');
    return 'http://localhost:4173';
  }
  return raw.replace(/\/$/, '');
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadDataset(server, env) {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    const evidence = await server.fetchPublicEvidence({
      supabaseUrl: env.VITE_SUPABASE_URL,
      anonKey: env.VITE_SUPABASE_ANON_KEY,
    });
    console.log(`[prerender] Supabase 공개 행 ${evidence.length}개`);
    return { evidence };
  }
  const file = join(ROOT, 'public', 'data', 'evidence.json');
  if (!existsSync(file)) {
    throw new Error('Supabase 환경변수도 public/data/evidence.json도 없다. 사전 렌더링할 데이터가 없다.');
  }
  const evidence = JSON.parse(readFileSync(file, 'utf-8')).evidence.filter((e) => e.published !== false);
  console.log(`[prerender] 정적 JSON 공개 행 ${evidence.length}개 (로컬 개발용)`);
  return { evidence };
}

function headFor(meta, site) {
  return [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(site + meta.path)}" />`,
  ].join('\n    ');
}

// /e/ev-002 → dist/e/ev-002.html. vercel.json의 cleanUrls가 확장자 없는 주소로 서빙한다.
// (디렉터리 index.html은 슬래시 없는 주소에서 SPA 폴백에 밀릴 수 있다.)
function outFile(path) {
  if (path === '/') return join(DIST, 'index.html');
  const segs = path.split('/').filter(Boolean).map(decodeURIComponent);
  return join(DIST, ...segs.slice(0, -1), `${segs.at(-1)}.html`);
}

async function main() {
  const env = loadEnv();
  const site = siteUrl(env);
  const server = await import(pathToFileURL(SERVER).href);
  const template = readFileSync(join(DIST, 'index.html'), 'utf-8');
  if (!template.includes('<!--app-html-->') || !template.includes('<!--app-head-->')) {
    throw new Error('dist/index.html에 <!--app-head--> 또는 <!--app-html--> 자리표시가 없다.');
  }

  // /admin과 빌드 뒤에 생긴 경로용 SPA 셸. 색인하지 않는다.
  writeFileSync(
    join(DIST, 'spa.html'),
    template.replace('<!--app-head-->', '<meta name="robots" content="noindex" />').replace('<!--app-html-->', '')
  );

  const ds = await loadDataset(server, env);
  const paths = server.prerenderPaths(ds);
  const sitemap = [];
  for (const path of paths) {
    const meta = server.pageMeta(path, ds);
    if (!meta) throw new Error(`메타 정보가 없는 경로: ${path}`);
    // 페이지가 그리는 데이터만 심는다. 홈과 원장은 전체, 상세는 그 카드 하나, 나머지 층은 빈 원장.
    // 전체 데이터는 하이드레이션 뒤에 다시 읽는다.
    const slice =
      path === '/' || path === '/ledger'
        ? ds
        : { evidence: ds.evidence.filter((e) => `/e/${encodeURIComponent(e.id)}` === path) };
    const body = server.render(path, slice);
    const html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
      .replace('<!--app-head-->', `${headFor(meta, site)}\n    ${server.snapshotScript(slice)}`)
      .replace('<!--app-html-->', body);
    const file = outFile(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    sitemap.push({ loc: site + meta.path, lastmod: meta.lastmod });
  }

  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemap
        .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}</url>`)
        .join('\n') +
      `\n</urlset>\n`
  );
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${site}/sitemap.xml\n`);

  // 정적 JSON 폴백 데이터가 배포물에 섞이지 않게 지운다(.gitignore와 같은 이유).
  for (const dir of ['data', 'thumbs', 'view']) rmSync(join(DIST, dir), { recursive: true, force: true });
  console.log(`[prerender] HTML ${paths.length}개, sitemap.xml, robots.txt 작성. canonical 기준 ${site}`);
}

main().catch((e) => {
  console.error('[prerender] 실패:', e);
  process.exit(1);
});
