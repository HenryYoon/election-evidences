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
// 성능 점수의 원인을 보려고 핵심 지표와 개선 후보 상위 3개를 함께 남긴다.
const METRICS = [['first-contentful-paint', 'FCP'], ['largest-contentful-paint', 'LCP'], ['total-blocking-time', 'TBT'], ['cumulative-layout-shift', 'CLS']];
const details = [];

for (const f of readdirSync(dir).filter((n) => n.startsWith('lh-') && n.endsWith('.json')).sort()) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
  const page = new URL(r.finalDisplayedUrl || r.requestedUrl).pathname;
  const scores = CATS.map((c) => Math.round((r.categories[c]?.score ?? 0) * 100));
  lines.push(`| ${page} | ${scores.join(' | ')} |`);
  const metrics = METRICS.map(([id, label]) => `${label} ${r.audits[id]?.displayValue ?? '-'}`).join(', ');
  const opps = Object.values(r.audits)
    .filter((a) => a.details?.type === 'opportunity' && (a.details.overallSavingsMs ?? 0) > 0)
    .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
    .slice(0, 3)
    .map((a) => `${a.title} (${Math.round(a.details.overallSavingsMs)}ms)`);
  const lcpEl = r.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet;
  details.push(`- ${page}: ${metrics}${lcpEl ? `. LCP 요소 \`${lcpEl.slice(0, 80)}\`` : ''}${opps.length ? `. 개선 후보: ${opps.join('; ')}` : ''}`);
  CATS.forEach((c, i) => {
    const min = baseline.lighthouse[c];
    if (min != null && scores[i] < min) warns.push(`Lighthouse ${page} ${c} ${scores[i]} < 기준 ${min}`);
  });
}

if (details.length) lines.push('', 'Lighthouse 세부:', ...details);

// agentic-seo 두 방식. 내려받기+폴더 모드가 주 지표(경고 기준), URL 모드는 참고다.
// URL 모드는 원격 파일 점검 3개만 하고 페이지 점검 5개(60점)는 0점이 된다.
const readJson = (name) => {
  try {
    const f = join(dir, name);
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf-8')) : null;
  } catch {
    warns.push(`${name}을 읽지 못했다`);
    return null;
  }
};
const a = readJson('agentic-seo.json');
const u = readJson('agentic-seo-url.json');
if (a) {
  lines.push('', `agentic-seo(내려받기, 주 지표): ${a.grade} ${a.score}/${a.maxScore} (${a.percentage}%)`);
  if (baseline.agenticSeo != null && a.percentage < baseline.agenticSeo) warns.push(`agentic-seo ${a.percentage}% < 기준 ${baseline.agenticSeo}%`);
}
if (u) lines.push(`agentic-seo(URL 모드, 참고): ${u.grade} ${u.score}/${u.maxScore} (${u.percentage}%)`);
lines.push('', warns.length ? `기준 미달 ${warns.length}건:\n${warns.map((w) => `- ${w}`).join('\n')}` : '기준 미달 없음.', '');

const out = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
for (const w of warns) console.log(`::warning title=점수 기준 미달::${w}`);
console.log(out);
