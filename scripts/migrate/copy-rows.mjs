// 0009: 옛 시드니 프로젝트의 공개 데이터 행(evidence, feed_sources)을 새 서울 프로젝트로 복사한다.
// 매체 주소 안의 옛 프로젝트 주소를 새 주소로 바꾼다. 같은 id는 덮어쓴다(upsert)라서 다시 실행해도 된다.
// 제보, 첨부, 문의, 관리자는 옮기지 않는다(0009 명세 3장). 키와 행 내용은 출력하지 않는다.
export const TABLES = ['evidence', 'feed_sources'];

const host = (url) => new URL(url).host;

export async function copyRows({ from, to, fetchImpl = fetch, log = console.log }) {
  const src = from.url.replace(/\/$/, '');
  const dst = to.url.replace(/\/$/, '');
  const oldHost = host(src);
  const newHost = host(dst);
  const result = {};
  for (const table of TABLES) {
    const res = await fetchImpl(`${src}/rest/v1/${table}?select=*`, {
      headers: { apikey: from.key, Authorization: `Bearer ${from.key}` },
    });
    if (!res.ok) throw new Error(`${table} 읽기 실패 HTTP ${res.status}`);
    // 문자열 전체에서 옛 주소를 바꾼다. 매체 주소는 photos, media_other, sources 안 여러 곳에 있다.
    const text = (await res.text()).split(oldHost).join(newHost);
    const rows = JSON.parse(text);
    if (rows.length) {
      const put = await fetchImpl(`${dst}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: to.key,
          Authorization: `Bearer ${to.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
      });
      if (!put.ok) throw new Error(`${table} 쓰기 실패 HTTP ${put.status}`);
    }
    result[table] = rows.length;
    log(`${table}: ${rows.length}행 복사`);
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const need = ['OLD_SUPABASE_URL', 'OLD_SUPABASE_SERVICE_KEY', 'NEW_SUPABASE_URL', 'NEW_SUPABASE_SERVICE_KEY'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`GitHub Secrets에 ${missing.join(', ')}가 없다.`);
    process.exit(1);
  }
  copyRows({
    from: { url: env.OLD_SUPABASE_URL, key: env.OLD_SUPABASE_SERVICE_KEY },
    to: { url: env.NEW_SUPABASE_URL, key: env.NEW_SUPABASE_SERVICE_KEY },
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
