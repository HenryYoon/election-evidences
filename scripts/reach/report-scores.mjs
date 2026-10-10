// 점수형 점검 요약(0002 명세 7장 점검 2·3). Lighthouse와 agentic-seo 결과를 표로 남긴다.
// 점수는 방향 지표라 실패로 막지 않는다. 기준보다 떨어지면 경고만 낸다.
// 실행: node scripts/reach/report-scores.mjs <결과 폴더>
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
const baseline = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'baseline.json'), 'utf-8'));
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const lines = ['### 점수형 점검 (경고만, 머지를 막지 않는다)', '', '| 페이지 | 성능 | 접근성 | 모범 사례 | SEO |', '|---|---|---|---|---|'];
const warns = [];

for (const f of readdirSync(dir).filter((n) => n.startsWith('lh-') && n.endsWith('.json')).sort()) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
  const page = new URL(r.finalDisplayedUrl || r.requestedUrl).pathname;
  const scores = CATS.map((c) => Math.round((r.categories[c]?.score ?? 0) * 100));
  lines.push(`| ${page} | ${scores.join(' | ')} |`);
  CATS.forEach((c, i) => {
    const min = baseline.lighthouse[c];
    if (min != null && scores[i] < min) warns.push(`Lighthouse ${page} ${c} ${scores[i]} < 기준 ${min}`);
  });
}

const aeoFile = join(dir, 'agentic-seo.json');
let a = null;
try {
  if (existsSync(aeoFile)) a = JSON.parse(readFileSync(aeoFile, 'utf-8'));
} catch {
  warns.push('agentic-seo 결과를 읽지 못했다');
}
if (a) {
  lines.push('', `agentic-seo: ${a.grade} ${a.score}/${a.maxScore} (${a.percentage}%)`);
  if (baseline.agenticSeo != null && a.percentage < baseline.agenticSeo) warns.push(`agentic-seo ${a.percentage}% < 기준 ${baseline.agenticSeo}%`);
}
lines.push('', warns.length ? `기준 미달 ${warns.length}건:\n${warns.map((w) => `- ${w}`).join('\n')}` : '기준 미달 없음.', '');

const out = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
for (const w of warns) console.log(`::warning title=점수 기준 미달::${w}`);
console.log(out);
