// 운영 사이트 회수 점검(0002 명세 7장 점검 1). JS 없이 HTML을 받아 0001·0002 규칙을 본다.
// 실행: node scripts/reach/check-live.mjs https://election-evidences.vercel.app
// 실패하면 종료 코드 1. 이 점검은 우리 규칙이라 강제한다(점수형 점검과 다르다).
const SITE = (process.argv[2] || process.env.SITE_URL || '').replace(/\/$/, '');
if (!SITE) {
  console.error('사이트 주소가 필요하다');
  process.exit(2);
}
const KB = 1024;
const fails = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);

async function get(path, init = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fetch(SITE + path, { ...init, headers: { 'user-agent': 'desk-reach-check' } });
    } catch (e) {
      if (i) throw e; // 일시적 네트워크 오류는 한 번만 재시도한다.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

function checkPage(path, html, maxBytes) {
  const body = html.slice(html.indexOf('<div id="root">'));
  if (!/<title>[^<]+<\/title>/.test(html)) fail(path, 'title 없음');
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  if (!desc || desc[1].length < 30 || desc[1].length > 160) fail(path, 'description 없음 또는 길이 이상');
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canon) fail(path, 'canonical 없음');
  else if (!canon[1].startsWith(SITE)) fail(path, `canonical이 운영 주소가 아니다: ${canon[1]}`);
  const h1 = (body.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(path, `H1 ${h1}개`);
  if (!/<\/h1><p[^>]*>[^<]{10,}/.test(body)) fail(path, 'H1 바로 뒤 첫 문단 없음');
  const size = Buffer.byteLength(html);
  if (maxBytes && size > maxBytes) fail(path, `HTML ${Math.round(size / KB)}KB, 예산 ${Math.round(maxBytes / KB)}KB 초과`);
  return size;
}

const sizes = {};
const sitemap = await (await get('/sitemap.xml')).text();
const details = [...sitemap.matchAll(/<loc>[^<]*(\/e\/[^<]+)<\/loc>/g)].map((m) => m[1]);
if (!details.length) fail('/sitemap.xml', '상세 주소가 없다');
const recordBudget = 20 * KB + details.length * 0.6 * KB;
const sample = [details[0], details[Math.floor(details.length / 2)], details.at(-1)].filter(Boolean);

for (const [path, max] of [['/', 40 * KB], ['/records', recordBudget], ['/stats', 40 * KB], ['/tips', 40 * KB], ...sample.map((p) => [p, 10 * KB])]) {
  const res = await get(path);
  if (!res.ok) { fail(path, `HTTP ${res.status}`); continue; }
  const html = await res.text();
  sizes[path] = checkPage(path, html, max);
  if (path.startsWith('/e/') && !html.includes('type="text/markdown"')) fail(path, '마크다운 alternate 링크 없음');
}

for (const [from, to] of [['/ledger', '/records'], ['/e/ev-009', '/e/ev-098']]) {
  const res = await get(from, { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  if (![301, 308].includes(res.status) || !loc.endsWith(to)) fail(from, `영구 리다이렉트가 아니다: ${res.status} ${loc}`);
}

const llms = await get('/llms.txt');
const llmsText = llms.ok ? await llms.text() : '';
if (!llmsText.startsWith('# ')) fail('/llms.txt', '없거나 H1로 시작하지 않는다');
if (sample[0]) {
  const md = await get(`${sample[0]}.md`);
  if (!md.ok || !(await md.text()).startsWith('# ')) fail(`${sample[0]}.md`, '마크다운 판이 없다');
  if (!/markdown/.test(md.headers.get('content-type') || '')) fail(`${sample[0]}.md`, `Content-Type: ${md.headers.get('content-type')}`);
}
const robots = await (await get('/robots.txt')).text();
if (!/User-agent: ClaudeBot/.test(robots) || !/Sitemap: /.test(robots)) fail('/robots.txt', 'AI 크롤러 허용 또는 사이트맵 주소가 없다');

const summary = [
  `### 운영 사이트 회수 점검 (${SITE})`,
  '',
  '| 경로 | HTML |',
  '|---|---|',
  ...Object.entries(sizes).map(([p, s]) => `| ${p} | ${Math.round(s / KB)}KB |`),
  '',
  fails.length ? `실패 ${fails.length}건:\n${fails.map((f) => `- ${f}`).join('\n')}` : '모두 통과.',
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
process.exit(fails.length ? 1 : 0);
