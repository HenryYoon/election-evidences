// 점수형 점검 요약(0002 명세 7장 점검 2·3). Lighthouse와 agentic-seo 결과를 표로 남긴다.
// 점수는 방향 지표라 실패로 막지 않는다. 기준보다 떨어지면 경고만 낸다.
// 기준은 최근 측정 평균으로 자동 갱신한다(운영자 결정, 2026-10-10):
//   범주마다 회차별 페이지 최솟값의 최근 4회 평균을 내고, 허용 폭을 뺀 값보다 낮으면 경고한다.
//   기록이 2회 미만이면 baseline.json을 쓴다.
// 실행: node scripts/reach/report-scores.mjs <결과 폴더> [기록 파일]
//   기록 파일을 주면 이번 회차를 덧붙여 저장한다.
import { readFileSync, readdirSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WINDOW = 4;
export const TOLERANCE = { performance: 5, accessibility: 2, 'best-practices': 2, seo: 2, agenticSeo: 3 };
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const METRICS = [['first-contentful-paint', 'FCP'], ['largest-contentful-paint', 'LCP'], ['total-blocking-time', 'TBT'], ['cumulative-layout-shift', 'CLS']];

// 최근 기록으로 기준을 만든다. 범주마다 값이 있는 회차만 평균한다.
export function baselineFrom(runs, fallback) {
  const recent = runs.slice(-WINDOW);
  const avg = (pick) => {
    const xs = recent.map(pick).filter((x) => typeof x === 'number');
    return xs.length >= 2 ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const out = { lighthouse: {}, agenticSeo: null, source: 'history' };
  for (const c of CATS) out.lighthouse[c] = avg((r) => r.lighthouse?.[c]);
  out.agenticSeo = avg((r) => r.agenticSeo);
  // 기록이 모자란 범주는 고정 기준을 쓴다.
  for (const c of CATS) if (out.lighthouse[c] == null) out.lighthouse[c] = fallback.lighthouse?.[c] ?? null;
  if (out.agenticSeo == null) out.agenticSeo = fallback.agenticSeo ?? null;
  return out;
}

// 현재 값이 "기준 - 허용 폭"보다 낮으면 경고다.
export function belowBaseline(value, base, key) {
  return base != null && value < base - TOLERANCE[key];
}

function main() {
  const [dir, historyFile] = process.argv.slice(2);
  const here = dirname(fileURLToPath(import.meta.url));
  const fallback = JSON.parse(readFileSync(join(here, 'baseline.json'), 'utf-8'));
  const seed = JSON.parse(readFileSync(join(here, 'history-seed.json'), 'utf-8'));
  const history = historyFile && existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf-8')) : seed;
  const base = baselineFrom(history.runs ?? [], fallback);

  const lines = [
    '### 점수형 점검 (경고만, 머지를 막지 않는다)',
    '',
    `기준: 최근 ${WINDOW}회 평균(허용 폭: 성능 ${TOLERANCE.performance}점, 나머지 ${TOLERANCE.seo}점, agentic-seo ${TOLERANCE.agenticSeo}점)`,
    `- 성능 ${base.lighthouse.performance}, 접근성 ${base.lighthouse.accessibility}, 모범 사례 ${base.lighthouse['best-practices']}, SEO ${base.lighthouse.seo}, agentic-seo ${base.agenticSeo ?? '-'}`,
    '',
    '| 페이지 | 성능 | 접근성 | 모범 사례 | SEO |',
    '|---|---|---|---|---|',
  ];
  const warns = [];
  const details = [];
  const mins = {};

  for (const f of readdirSync(dir).filter((n) => n.startsWith('lh-') && n.endsWith('.json')).sort()) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    const page = new URL(r.finalDisplayedUrl || r.requestedUrl).pathname;
    const scores = CATS.map((c) => Math.round((r.categories[c]?.score ?? 0) * 100));
    lines.push(`| ${page} | ${scores.join(' | ')} |`);
    CATS.forEach((c, i) => {
      mins[c] = Math.min(mins[c] ?? 100, scores[i]);
      if (belowBaseline(scores[i], base.lighthouse[c], c)) warns.push(`Lighthouse ${page} ${c} ${scores[i]} < 기준 ${base.lighthouse[c]} - ${TOLERANCE[c]}`);
    });
    const metrics = METRICS.map(([id, label]) => `${label} ${r.audits[id]?.displayValue ?? '-'}`).join(', ');
    const opps = Object.values(r.audits)
      .filter((a) => a.details?.type === 'opportunity' && (a.details.overallSavingsMs ?? 0) > 0)
      .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
      .slice(0, 3)
      .map((a) => `${a.title} (${Math.round(a.details.overallSavingsMs)}ms)`);
    const lcpEl = r.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet;
    details.push(`- ${page}: ${metrics}${lcpEl ? `. LCP 요소 \`${lcpEl.slice(0, 80)}\`` : ''}${opps.length ? `. 개선 후보: ${opps.join('; ')}` : ''}`);
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
    if (belowBaseline(a.percentage, base.agenticSeo, 'agenticSeo')) warns.push(`agentic-seo ${a.percentage}% < 기준 ${base.agenticSeo} - ${TOLERANCE.agenticSeo}`);
  }
  if (u) lines.push(`agentic-seo(URL 모드, 참고): ${u.grade} ${u.score}/${u.maxScore} (${u.percentage}%)`);
  lines.push('', warns.length ? `기준 미달 ${warns.length}건:\n${warns.map((w) => `- ${w}`).join('\n')}` : '기준 미달 없음.', '');

  if (historyFile && Object.keys(mins).length) {
    const entry = {
      run: Number(process.env.GITHUB_RUN_ID) || null,
      date: new Date().toISOString(),
      lighthouse: mins,
      agenticSeo: a?.percentage ?? null,
      agenticSeoUrl: u?.percentage ?? null,
    };
    writeFileSync(historyFile, JSON.stringify({ ...history, runs: [...(history.runs ?? []), entry] }, null, 2) + '\n');
  }

  const out = lines.join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
  for (const w of warns) console.log(`::warning title=점수 기준 미달::${w}`);
  console.log(out);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
