// 브라우저 스모크 테스트. vite preview로 dist를 띄우고 공개 경로를 연다.
// 확인: 하이드레이션 오류 없음(홈·기록 목록은 스냅샷 파일을 받은 뒤 하이드레이션), H1 하나, 가로 스크롤 없음(데스크톱·모바일), JS 없이 상세 첫 문장, 클라이언트 내비게이션.
// 로컬에서 브라우저 경로가 다르면 PW_CHROMIUM=/path/to/chrome 으로 넘긴다.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4173;
const B = `http://localhost:${PORT}`;
const PATHS = ['/', '/records', '/stats', '/feed', '/tips', '/e/ev-901', '/e/ev-903'];
// 오프라인 CI에서 나는 외부 요청 실패(지도 타일, Supabase)는 검사 대상이 아니다.
const NOISE = /Failed to load resource|Failed to fetch|net::ERR|WebGL|GL Driver|GroupMarker|공개 데이터 로드 실패|정적 폴백/;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const failures = [];
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(B)).ok) break; } catch {}
    if (i > 50) throw new Error('preview 서버가 뜨지 않았다');
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  for (const width of [1280, 390]) {
    for (const path of PATHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
      await page.goto(B + path, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const h1 = await page.locator('h1').count();
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (errs.length) failures.push(`${width} ${path}: 콘솔 오류 ${JSON.stringify(errs)}`);
      if (h1 !== 1) failures.push(`${width} ${path}: H1 ${h1}개`);
      if (hscroll) failures.push(`${width} ${path}: 가로 스크롤`);
      await ctx.close();
    }
  }
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const p = await nojs.newPage();
  await p.goto(`${B}/e/ev-901`);
  const lead = await p.locator('h1 + p').innerText();
  if (!/2026-06-03 14:37/.test(lead) || !/상태/.test(lead) || !/출처/.test(lead)) failures.push(`JS 없이 상세 첫 문장 부족: ${lead}`);
  await nojs.close();

  // 홈 지도 점 미리보기 카드: 마우스를 올리면 뜨고, 벗어나면 사라진다.
  const hctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const h = await hctx.newPage();
  await h.goto(`${B}/`, { waitUntil: 'load' });
  await h.waitForTimeout(300);
  if (await h.locator('.map-card').count()) failures.push('지도 카드가 처음부터 떠 있다');
  await h.locator('.svgmap circle').first().hover();
  const cardText = (await h.locator('.map-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (!/상태|자료 접수|주장|문서 확인|영상 확인/.test(cardText) || cardText.length < 10) failures.push(`지도 카드 내용 부족: ${cardText}`);
  await h.mouse.move(5, 5);
  await h.waitForTimeout(100);
  if (await h.locator('.map-card').count()) failures.push('마우스를 치워도 지도 카드가 남는다');
  await hctx.close();

  // 0002: 인용 복사 버튼, 마크다운 원문, llms.txt.
  const cctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const c = await cctx.newPage();
  await c.goto(`${B}/e/ev-901`, { waitUntil: 'load' });
  await c.getByRole('button', { name: '인용 복사' }).click();
  const clip = await c.evaluate(() => navigator.clipboard.readText());
  if (!/상태/.test(clip) || !clip.includes('/e/ev-901')) failures.push(`인용 복사 내용 부족: ${clip}`);
  const mdHref = await c.locator('a[type="text/markdown"]').getAttribute('href');
  const md = await (await fetch(B + mdHref)).text();
  if (!md.startsWith('# ')) failures.push(`마크다운 원문 오류: ${mdHref}`);
  if (!(await (await fetch(`${B}/llms.txt`)).text()).includes('/e/ev-901.md')) failures.push('llms.txt에 기록 링크 없음');
  if (!(await (await fetch(`${B}/records.md`)).text()).includes('/e/ev-903.md')) failures.push('records.md에 기록 링크 없음');
  await cctx.close();

  const ctx = await browser.newContext();
  const q = await ctx.newPage();
  await q.goto(`${B}/records`, { waitUntil: 'load' });
  await q.locator('.ledger-row a').first().click();
  await q.waitForURL(/\/e\/ev-901$/);
  if (!(await q.title()).startsWith('테스트 투표소')) failures.push(`내비게이션 뒤 title 미갱신: ${await q.title()}`);
  await browser.close();
} finally {
  server.kill();
}
if (failures.length) {
  console.error(`e2e 실패 ${failures.length}건\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`e2e 통과: ${PATHS.length}개 경로 × 2개 폭, JS 없는 상세, 지도 미리보기 카드, 인용 복사·마크다운·llms.txt, 클라이언트 내비게이션`);
