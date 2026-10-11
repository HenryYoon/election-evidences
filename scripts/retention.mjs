// 개인정보 파기(0005 명세 4장). retention.yml이 매일 한 번 실행한다.
// 1) retention_due_tips()로 파기할 제보 id를 받는다.
// 2) 제보마다 tip-uploads/<id>/ 첨부 파일을 Storage API로 지운다. SQL로는 저장소 파일을 지울 수 없다.
// 3) 첨부를 다 지운 id만 apply_retention()에 넘긴다. IP 변환값(1일)과 이름·연락처(90일)도 이 함수가 지운다.
// 비밀 키와 제보 내용은 출력하지 않는다. 건수만 출력한다.
const BUCKET = 'tip-uploads';

export async function runRetention({ url, key, fetchImpl = fetch, log = console.log }) {
  const base = url.replace(/\/$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const call = async (path, body) => {
    const res = await fetchImpl(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} 실패: HTTP ${res.status}`);
    return res.json();
  };

  const due = await call('/rest/v1/rpc/retention_due_tips', {});
  const ids = (Array.isArray(due) ? due : []).map((r) => (typeof r === 'string' ? r : r.retention_due_tips)).filter(Boolean);
  const purged = [];
  let files = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const listed = await call(`/storage/v1/object/list/${BUCKET}`, { prefix: id, limit: 100 });
      const names = listed.map((o) => `${id}/${o.name}`);
      if (names.length) {
        const res = await fetchImpl(`${base}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: names }) });
        if (!res.ok) throw new Error(`첨부 삭제 실패: HTTP ${res.status}`);
        files += names.length;
      }
      purged.push(id);
    } catch (e) {
      failed += 1;
      log(`제보 1건의 첨부 파일을 지우지 못했다: ${e.message}`);
    }
  }
  const result = await call('/rest/v1/rpc/apply_retention', { p_purged: purged });
  log(`파기 대상 ${ids.length}건, 첨부 파일 ${files}개 삭제, 실패 ${failed}건. 결과 ${JSON.stringify(result)}`);
  return { due: ids.length, files, failed, result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SERVICE_KEY'].filter(Boolean);
  if (missing.length) {
    console.error(`GitHub Secrets에 ${missing.join(', ')}가 없다. 저장소 Settings → Secrets and variables → Actions에 넣는다.`);
    process.exit(1);
  }
  runRetention({ url, key })
    .then((r) => { if (r.failed) process.exit(1); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
