// 운영 사이트를 폴더로 내려받는다. agentic-seo는 URL 모드에서 10개 점검 중 2개(llms.txt,
// agent-permissions)만 원격으로 확인하고 나머지는 0점으로 둔다. 그래서 운영 사이트를
// 내려받아 폴더 모드로 감사한다(0002 명세 7장 점검 3).
// 실행: node scripts/reach/mirror-live.mjs <사이트 주소> <출력 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE = (process.argv[2] || '').replace(/\/$/, '');
const OUT = process.argv[3];
if (!SITE || !OUT) {
  console.error('사용법: mirror-live.mjs <사이트 주소> <출력 폴더>');
  process.exit(2);
}

async function save(path, file) {
  const res = await fetch(SITE + path, { headers: { 'user-agent': 'desk-reach-mirror' } });
  if (!res.ok) return false;
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

let n = 0;
for (const f of ['robots.txt', 'llms.txt', 'sitemap.xml', 'records.md']) if (await save(`/${f}`, f)) n++;
const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
for (const p of paths) {
  // 빌드 결과와 같은 파일 배치: / → index.html, /e/ev-002 → e/ev-002.html
  if (await save(p, p === '/' ? 'index.html' : `${p.slice(1)}.html`)) n++;
  if (p.startsWith('/e/') && (await save(`${p}.md`, `${p.slice(1)}.md`))) n++;
}
console.log(`내려받은 파일 ${n}개 (${SITE})`);
