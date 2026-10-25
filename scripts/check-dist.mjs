// 빌드 결과물 검사. CLAUDE.md "작업 검증"과 REVIEW.md 1·2·6단계를 기계적으로 확인한다.
// 실행: npm run build 뒤 node scripts/check-dist.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const fails = [];
const fail = (file, msg) => fails.push(`${file}: ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST);
// 검색엔진 소유 확인 파일(google*.html)은 페이지가 아니다. 내용은 구글이 준 한 줄 그대로여야 한다.
const isVerification = (f) => /\/google[0-9a-f]+\.html$/.test(f);
const pages = files.filter((f) => f.endsWith('.html') && !f.endsWith('spa.html') && !isVerification(f));
if (!pages.length) fail('dist', '사전 렌더링된 HTML이 없다');

// 회수 가능성(REVIEW 6): title, description, canonical, H1 하나, 첫 문단.
for (const f of pages) {
  const rel = relative(DIST, f);
  const html = readFileSync(f, 'utf-8');
  const body = html.slice(html.indexOf('<div id="root">'));
  if (!/<title>[^<]+<\/title>/.test(html)) fail(rel, 'title 없음');
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  if (!desc || desc[1].length < 30) fail(rel, 'description 없음 또는 너무 짧음');
  if (desc && desc[1].length > 160) fail(rel, `description ${desc[1].length}자(150자 안팎이어야 한다)`);
  if (!/<link rel="canonical" href="[^"]+"/.test(html)) fail(rel, 'canonical 없음');
  const h1 = (body.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(rel, `H1 ${h1}개(하나여야 한다)`);
  if (!/<\/h1><p[^>]*>[^<]{10,}/.test(body)) fail(rel, 'H1 바로 뒤 첫 문단 없음');
  if (/user-scalable=no|maximum-scale=1/.test(html)) fail(rel, '확대를 막는 뷰포트 메타');
}

// 상세 첫 문단: 날짜, 장소, 상태, 출처가 한 문단에 있다.
for (const f of pages.filter((p) => relative(DIST, p).startsWith('e/'))) {
  const html = readFileSync(f, 'utf-8');
  const lead = html.match(/<\/h1><p[^>]*>([^<]*)<\/p>/)?.[1] ?? '';
  if (!/(\d{4}-\d{2}-\d{2}|날짜 미상)/.test(lead)) fail(relative(DIST, f), `첫 문단에 날짜 없음: ${lead}`);
  if (!/상태 \S/.test(lead)) fail(relative(DIST, f), `첫 문단에 상태 없음: ${lead}`);
  if (!/출처 \S/.test(lead)) fail(relative(DIST, f), `첫 문단에 출처 없음: ${lead}`);
}

// 대표 사례 초안(0010 명세 4장): noindex가 있어야 하고 사이트맵·llms.txt에 없어야 한다.
const sitemapXml = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf-8') : '';
const llmsText = existsSync(join(DIST, 'llms.txt')) ? readFileSync(join(DIST, 'llms.txt'), 'utf-8') : '';
for (const f of pages) {
  const rel = relative(DIST, f);
  const html = readFileSync(f, 'utf-8');
  const noindex = html.includes('<meta name="robots" content="noindex" />');
  const path = '/' + rel.replace(/\.html$/, '').replace(/^index$/, '');
  if (html.includes('승인 전 초안') && !noindex) fail(rel, '대표 사례 초안에 noindex가 없다');
  if (noindex && sitemapXml.includes(`${path}</loc>`)) fail('sitemap.xml', `noindex 페이지가 들어 있다: ${path}`);
  if (html.includes('승인 전 초안')) {
    const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
    if (title && llmsText.includes(title)) fail('llms.txt', `대표 사례 초안이 들어 있다: ${title}`);
  }
}

const recordCount = pages.filter((p) => relative(DIST, p).startsWith('e/')).length;

// 홈(0008 명세 2장, 0011): 수집 건수는 공개 증거 수, 자료 확인 건수는 스냅샷의 자료 확인 수와 같아야 한다. 다른 건수 표현은 두지 않는다.
const home = readFileSync(join(DIST, 'index.html'), 'utf-8');
const homeText = home.slice(home.indexOf('<div id="root">')).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
const counts = [...homeText.matchAll(/(수집|자료 확인|조건에 맞는 증거)?\s*(\d+)\s*건/g)];
const collected = counts.find((m) => m[1] === '수집');
if (!collected) fail('index.html', '홈에 "수집 N건"이 없다');
else if (Number(collected[2]) !== recordCount) fail('index.html', `수집 건수 ${collected[2]}가 공개 증거 수 ${recordCount}와 다르다`);
const checked = counts.find((m) => m[1] === '자료 확인');
// 스냅샷의 옛 값(document, video_confirmed)도 자료 확인으로 센다(src/lib/status.ts normalizeEvidenceStatus).
const snapFile = home.match(/\/snapshot\/[0-9a-f]+\.json/)?.[0];
const snapRows = snapFile ? JSON.parse(readFileSync(join(DIST, snapFile), 'utf-8')).evidence : [];
const checkedCount = snapRows.filter((r) => ['confirmed', 'document', 'video_confirmed'].includes(r.status)).length;
if (!checked) fail('index.html', '홈에 "자료 확인 N건"이 없다');
else if (snapFile && Number(checked[2]) !== checkedCount) fail('index.html', `자료 확인 건수 ${checked[2]}가 스냅샷의 자료 확인 수 ${checkedCount}와 다르다`);
if (/검증 \d+건/.test(homeText)) fail('index.html', '홈에 옛 "검증 N건" 표현이 남아 있다(0011)');
for (const m of counts) if (!m[1]) fail('index.html', `홈 본문에 허용하지 않은 건수 표현: ${m[0]}`);
for (const [a, b] of [['수집', '세 단계'], ['자료 확인', '모은다']]) if (homeText.includes(b)) fail('index.html', `홈에 뺀 문구가 남아 있다: ${b} (${a} 옆)`);
for (const layer of ['/records', '/tips', '/about', '/privacy', '/contact']) {
  if (!home.includes(`href="${layer}"`)) fail('index.html', `${layer} 입구 링크 없음`);
}
for (const gone of ['/stats', '/feed']) {
  if (home.includes(`href="${gone}"`)) fail('index.html', `없앤 층 링크가 남아 있다: ${gone}`);
}

// HTML 예산(0002 명세 1장): 스냅샷과 지도 경계선을 HTML 밖으로 뺐는지 본다.
const KB = 1024;
const budgets = [
  ['index.html', 40 * KB],
  ['en.html', 40 * KB],
  ['records.html', 20 * KB + recordCount * 0.6 * KB],
  ...pages.filter((p) => relative(DIST, p).startsWith('e/')).map((p) => [relative(DIST, p), 10 * KB]),
];
for (const [rel, max] of budgets) {
  const size = statSync(join(DIST, rel)).size;
  if (size > max) fail(rel, `HTML ${Math.round(size / KB)}KB, 예산 ${Math.round(max / KB)}KB 초과`);
}
if (/window\.__DESK__=/.test(home)) fail('index.html', '전체 스냅샷이 HTML 안에 있다');

// 영어 페이지(0007 명세): lang="en"과 언어 짝 hreflang.
// 좌표는 보여 주지 않는다(0008 명세 3장). 상세 HTML 본문과 마크다운에 좌표 줄이 없어야 한다.
for (const f of pages.filter((p) => relative(DIST, p).startsWith('e/'))) {
  const html = readFileSync(f, 'utf-8');
  const body = html.slice(html.indexOf('<div id="root">')).replace(/<script[\s\S]*?<\/script>/g, ' ');
  if (/<dt>좌표<\/dt>|\d{2}\.\d{5},\s*\d{3}\.\d{5}/.test(body)) fail(relative(DIST, f), '상세 본문에 좌표가 있다');
  const md = f.replace(/\.html$/, '.md');
  if (existsSync(md) && /^- 좌표:/m.test(readFileSync(md, 'utf-8'))) fail(relative(DIST, md), '마크다운에 좌표 줄이 있다');
}

for (const [ko, en] of [['index.html', 'en.html'], ['about.html', 'en/about.html']]) {
  for (const rel of [ko, en]) {
    if (!existsSync(join(DIST, rel))) { fail(rel, '파일 없음'); continue; }
    const html = readFileSync(join(DIST, rel), 'utf-8');
    const want = rel === en ? 'en' : 'ko';
    if (!html.includes(`<html lang="${want}">`)) fail(rel, `<html lang="${want}"> 없음`);
    for (const hl of ['ko', 'en', 'x-default']) {
      if (!new RegExp(`<link rel="alternate" hreflang="${hl}" href="[^"]+"`).test(html)) fail(rel, `hreflang ${hl} 없음`);
    }
  }
}
if (!existsSync(join(DIST, 'geo', 'basemap.svg'))) fail('geo/basemap.svg', '지도 경계선 파일이 없다');

// JSON-LD(0001 플랜 8단계): 홈 WebSite, 상세 Article. 파싱되어야 하고 ClaimReview는 쓰지 않는다.
for (const f of pages) {
  const rel = relative(DIST, f);
  const html = readFileSync(f, 'utf-8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const want = rel === 'index.html' ? 'WebSite' : rel.startsWith('e/') ? 'Article' : null;
  if (!want) continue;
  if (blocks.length !== 1) { fail(rel, `JSON-LD ${blocks.length}개(하나여야 한다)`); continue; }
  try {
    const data = JSON.parse(blocks[0]);
    if (data['@type'] !== want) fail(rel, `JSON-LD @type ${data['@type']}, ${want}이어야 한다`);
  } catch (e) {
    fail(rel, `JSON-LD 파싱 실패: ${e.message}`);
  }
  if (/ClaimReview/.test(html)) fail(rel, 'ClaimReview를 쓰지 않는다(상태는 판정이 아니다)');
}

// AI 에이전트용 출력물(0002 명세 2·3·5장).
const llmsPath = join(DIST, 'llms.txt');
if (!existsSync(llmsPath)) fail('llms.txt', '없다');
else {
  const llms = readFileSync(llmsPath, 'utf-8');
  if (!llms.startsWith('# ')) fail('llms.txt', 'H1로 시작하지 않는다');
  if (!llms.includes('법적 결론이 아닙니다')) fail('llms.txt', '상태 고지 문장이 없다');
  if (llms.length > 12000) fail('llms.txt', `${llms.length}자. 색인은 짧게 두고 전체 목록은 records.md에 둔다`);
  if (!existsSync(join(DIST, 'records.md'))) fail('records.md', '전체 기록 목록이 없다');
}
for (const f of pages.filter((p) => relative(DIST, p).startsWith('e/'))) {
  const rel = relative(DIST, f);
  const md = f.replace(/\.html$/, '.md');
  if (!existsSync(md)) fail(rel, '마크다운 판이 없다');
  if (!/<link rel="alternate" type="text\/markdown"/.test(readFileSync(f, 'utf-8'))) fail(rel, '마크다운 alternate 링크가 없다');
}
if (!/User-agent: ClaudeBot/.test(readFileSync(join(DIST, 'robots.txt'), 'utf-8'))) fail('robots.txt', 'AI 크롤러 명시 허용이 없다');

// 사이트맵과 robots.
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf-8');
if (/\/admin/.test(sitemap)) fail('sitemap.xml', '/admin이 들어 있다');
if (!/\/e\/[^<]+<\/loc>/.test(sitemap)) fail('sitemap.xml', '상세 주소가 없다');
if (!sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) fail('sitemap.xml', 'XML 선언으로 시작하지 않는다');
for (const m of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/.test(m[1])) fail('sitemap.xml', `lastmod 형식: ${m[1]}`);
}
if (!/Sitemap: \S+\/sitemap\.xml/.test(readFileSync(join(DIST, 'robots.txt'), 'utf-8'))) fail('robots.txt', '사이트맵 주소 없음');
if (!/noindex/.test(readFileSync(join(DIST, 'spa.html'), 'utf-8'))) fail('spa.html', 'noindex 없음');

// 개인정보·비밀 키(REVIEW 1·2): 배포물 어디에도 없어야 한다.
// 공개 데이터는 HTML 스냅샷에만 들어간다. 압축된 라이브러리 JS의 숫자열은 오탐이라 전화번호 검사에서 뺀다.
const PHONE = /(?<![\d.])01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?![\d.])/;
const SECRET = /SUPABASE_SERVICE_KEY|service_role|sb_secret_|DEPLOY_HOOK_URL|api\.vercel\.com\/v1\/integrations\/deploy|RESEND_API_KEY|CONTACT_TO|\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/;
for (const f of files.filter((p) => /\.(html|js|json|xml|txt|md)$/.test(p))) {
  const text = readFileSync(f, 'utf-8');
  const rel = relative(DIST, f);
  if (SECRET.test(text)) fail(rel, `비밀 키 흔적: ${text.match(SECRET)[0]}`);
  if (!f.endsWith('.js') && PHONE.test(text)) fail(rel, `전화번호 형식 문자열: ${text.match(PHONE)[0]}`);
}
for (const dir of ['data', 'thumbs', 'view']) {
  if (existsSync(join(DIST, dir))) fail(dir, '커밋 금지 데이터 폴더가 배포물에 있다');
}

if (fails.length) {
  console.error(`check-dist 실패 ${fails.length}건\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-dist 통과: HTML ${pages.length}개, 파일 ${files.length}개 검사`);
