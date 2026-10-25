// 브라우저 스모크 테스트. vite preview로 dist를 띄우고 공개 경로를 연다.
// 확인: 하이드레이션 오류 없음(홈·기록 목록은 스냅샷 파일을 받은 뒤 하이드레이션), H1 하나, 가로 스크롤 없음(데스크톱·모바일), JS 없이 상세 첫 문장, 클라이언트 내비게이션.
// 로컬에서 브라우저 경로가 다르면 PW_CHROMIUM=/path/to/chrome 으로 넘긴다.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4173;
const B = `http://localhost:${PORT}`;
const PATHS = [
  '/', '/records', '/tips', '/about', '/privacy', '/contact', '/en', '/en/about', '/e/ev-901', '/e/ev-903',
  // 정리 글(0010). CI는 CASE_DRAFTS=1로 빌드해 초안까지 연다.
  ...(process.env.CASE_DRAFTS === '1' ? ['/cases', '/cases/ballot-box-seals'] : []),
];
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

  // 제보 폼(0001 플랜 5단계): 빈 폼은 막고, 채우면 보낸다. CI에는 Supabase 주소가 없어 안내 문구가 나온다.
  const tctx = await browser.newContext();
  const t = await tctx.newPage();
  await t.goto(`${B}/tips`, { waitUntil: 'load' });
  await t.waitForTimeout(300);
  await t.getByRole('button', { name: '제보 보내기' }).click();
  if ((await t.locator('.tip-errors li').count()) < 3) failures.push('빈 제보 폼을 막지 않았다');
  // 첨부 파일(0004): 받지 않는 형식은 막고, 빼면 풀린다.
  const fileInput = t.locator('.tip-files input[type=file]');
  await fileInput.setInputFiles([
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('jpg') },
    { name: 'run.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('exe') },
  ]);
  if ((await t.locator('.tip-file-list li').count()) !== 2) failures.push('고른 파일 목록이 보이지 않는다');
  if (!/run\.exe/.test(await t.locator('.tip-errors').innerText().catch(() => ''))) failures.push('받지 않는 형식을 막지 않았다');
  await t.getByRole('button', { name: 'run.exe 빼기' }).click();
  if ((await t.locator('.tip-file-list li').count()) !== 1 || (await t.locator('.tip-errors').count())) failures.push('파일을 빼도 목록이나 오류가 그대로다');
  await t.getByLabel('장소 (필수)').fill('종로구 테스트 투표소');
  await t.getByLabel('무슨 일이 있었나요 (필수)').fill('테스트용 제보 본문입니다. 열 글자를 넘습니다.');
  await t.getByLabel('개인정보 수집·이용에 동의합니다').check();
  if (await t.getByLabel('개인정보 국외 이전에 동의합니다').count()) failures.push('제보 폼에 국외 이전 동의가 남아 있다(0009)');
  // 0005: 연락처를 적으면 선택 동의가 나타나고, 동의하지 않으면 막는다.
  await t.getByLabel('연락처 (선택)').fill('010-0000-0000');
  await t.getByRole('button', { name: '제보 보내기' }).click();
  if (!/선택 항목/.test(await t.locator('.tip-errors').innerText().catch(() => ''))) failures.push('연락처를 적었는데 선택 동의를 묻지 않았다');
  await t.getByLabel('연락처 (선택)').fill('');
  if (await t.getByLabel('이름·연락처 수집·이용에 동의합니다').count()) failures.push('연락처를 비워도 선택 동의가 남아 있다');
  await t.getByRole('button', { name: '제보 보내기' }).click();
  await t.waitForTimeout(300);
  const tipMsg = (await t.locator('.tip-errors, .tip-done').innerText().catch(() => '')).trim();
  if (!/제보를 받을 수 없습니다|제보를 받았습니다/.test(tipMsg)) failures.push(`제보 전송 결과 안내 없음: ${tipMsg}`);
  await tctx.close();

  // 0006: 문의 폼. 빈 폼은 막고, 회신 이메일을 적으면 선택 동의를 묻는다.
  const qctx = await browser.newContext();
  const cq = await qctx.newPage();
  await cq.goto(`${B}/contact`, { waitUntil: 'load' });
  await cq.waitForTimeout(300);
  await cq.getByRole('button', { name: '문의 보내기' }).click();
  if ((await cq.locator('.tip-errors li').count()) < 4) failures.push('빈 문의 폼을 막지 않았다');
  await cq.getByLabel('종류 (필수)').selectOption('correction');
  await cq.getByLabel('내용 (필수)').fill('테스트용 정정 요청입니다. 열 글자를 넘습니다.');
  await cq.getByLabel('개인정보 수집·이용에 동의합니다').check();
  await cq.getByLabel('개인정보 국외 이전에 동의합니다').check();
  await cq.getByLabel('회신 이메일 (선택)').fill('reader@example.com');
  await cq.getByRole('button', { name: '문의 보내기' }).click();
  if (!/선택 항목/.test(await cq.locator('.tip-errors').innerText().catch(() => ''))) failures.push('회신 이메일을 적었는데 선택 동의를 묻지 않았다');
  await cq.getByLabel('회신 이메일 수집·이용에 동의합니다').check();
  await cq.getByRole('button', { name: '문의 보내기' }).click();
  await cq.waitForTimeout(300);
  const qMsg = (await cq.locator('.tip-errors, .tip-done').innerText().catch(() => '')).trim();
  if (!/문의를 받을 수 없습니다|문의를 받았습니다/.test(qMsg)) failures.push(`문의 전송 결과 안내 없음: ${qMsg}`);
  await qctx.close();

  // 0007: 언어 토글은 짝 페이지로 간다. 영어 페이지는 lang="en"이다.
  const lctx = await browser.newContext();
  const l = await lctx.newPage();
  await l.goto(`${B}/about`, { waitUntil: 'load' });
  await l.getByRole('link', { name: 'EN', exact: true }).click();
  await l.waitForURL(/\/en\/about$/);
  if ((await l.locator('h1').innerText()) !== 'About') failures.push('영어 소개 H1이 다르다');
  if ((await l.evaluate(() => document.documentElement.lang)) !== 'en') failures.push('영어 페이지 html lang이 en이 아니다');
  await l.getByRole('link', { name: '한국어', exact: true }).click();
  await l.waitForURL(/\/about$/);
  if ((await l.evaluate(() => document.documentElement.lang)) !== 'ko') failures.push('한국어로 돌아와도 html lang이 ko가 아니다');
  await l.goto(`${B}/records`, { waitUntil: 'load' });
  await l.getByRole('link', { name: 'EN', exact: true }).click();
  await l.waitForURL(/\/en$/);
  if (!/Status is an investigative classification/.test(await l.locator('.home-disclaimer').innerText())) failures.push('영어 메인 면책 문장이 다르다');
  if (!/collected/.test(await l.locator('.home-counts').innerText())) failures.push('영어 메인에 수집 건수가 없다');
  await lctx.close();

  // 0004: 홈 목적 문장과 소개 페이지.
  const actx = await browser.newContext({ javaScriptEnabled: false });
  const a = await actx.newPage();
  await a.goto(`${B}/`, { waitUntil: 'load' });
  if (!/수집 \d+건/.test(await a.locator('.home-counts').innerText())) failures.push('홈에 수집 건수가 없다');
  if ((await a.locator('h1').innerText()) !== '선거부정진상규명국민신고센터') failures.push('홈 H1이 사이트 이름이 아니다');
  await a.goto(`${B}/about`, { waitUntil: 'load' });
  if ((await a.locator('h1').innerText()) !== '소개' || !(await a.getByRole('heading', { name: '정정과 문의' }).count())) failures.push('소개 페이지 내용이 없다');
  await actx.close();

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
console.log(`e2e 통과: ${PATHS.length}개 경로 × 2개 폭, JS 없는 상세, 지도 미리보기 카드, 제보 폼·첨부 파일·동의, 소개·처리방침·문의, 언어 토글, 인용 복사·마크다운·llms.txt, 클라이언트 내비게이션`);
