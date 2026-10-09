// 브라우저 스모크 테스트. vite preview로 dist를 띄우고 공개 경로를 연다.
// 확인: 하이드레이션 오류 없음, H1 하나, 가로 스크롤 없음(데스크톱·모바일), JS 없이 상세 첫 문장, 클라이언트 내비게이션.
// 로컬에서 브라우저 경로가 다르면 PW_CHROMIUM=/path/to/chrome 으로 넘긴다.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4173;
const B = `http://localhost:${PORT}`;
const PATHS = ['/', '/ledger', '/stats', '/feed', '/tips', '/e/ev-901', '/e/ev-903'];
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

  const ctx = await browser.newContext();
  const q = await ctx.newPage();
  await q.goto(`${B}/ledger`, { waitUntil: 'load' });
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
console.log(`e2e 통과: ${PATHS.length}개 경로 × 2개 폭, JS 없는 상세, 클라이언트 내비게이션`);
