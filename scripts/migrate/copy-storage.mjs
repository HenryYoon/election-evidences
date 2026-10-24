// 0009: 옛 시드니 프로젝트의 evidence-media 파일을 새 서울 프로젝트로 복사한다. copy-storage.yml이 한 번 실행한다.
// 1) 옛 버킷의 모든 파일을 폴더째 훑는다.
// 2) 새 버킷에 같은 경로·같은 크기의 파일이 있으면 건너뛴다. 다시 실행해도 된다.
// 3) 없으면 내려받아 같은 경로, 같은 형식으로 올린다.
// 비밀 키와 파일 내용은 출력하지 않는다. 건수와 실패한 경로만 출력한다.
export const BUCKET = 'evidence-media';

const enc = (path) => path.split('/').map(encodeURIComponent).join('/');

function client(url, key, fetchImpl) {
  const base = url.replace(/\/$/, '');
  const auth = { apikey: key, Authorization: `Bearer ${key}` };
  return {
    async list(prefix) {
      const out = [];
      for (let offset = 0; ; offset += 1000) {
        const res = await fetchImpl(`${base}/storage/v1/object/list/${BUCKET}`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (!res.ok) throw new Error(`목록 조회 실패 HTTP ${res.status}`);
        const page = await res.json();
        out.push(...page);
        if (page.length < 1000) return out;
      }
    },
    async download(path) {
      const res = await fetchImpl(`${base}/storage/v1/object/${BUCKET}/${enc(path)}`, { headers: auth });
      if (!res.ok) throw new Error(`내려받기 실패 HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async upload(path, body, type) {
      const res = await fetchImpl(`${base}/storage/v1/object/${BUCKET}/${enc(path)}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': type, 'x-upsert': 'true', 'cache-control': '3600' },
        body,
      });
      if (!res.ok) throw new Error(`올리기 실패 HTTP ${res.status}`);
    },
  };
}

// 폴더(id가 null)는 안으로 들어가고, 파일은 { path, size, type }로 모은다.
async function walk(c, prefix = '') {
  const files = [];
  for (const e of await c.list(prefix)) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null || e.id === undefined) files.push(...(await walk(c, path)));
    else files.push({ path, size: Number(e.metadata?.size ?? -1), type: e.metadata?.mimetype || 'application/octet-stream' });
  }
  return files;
}

export async function copyStorage({ from, to, fetchImpl = fetch, log = console.log }) {
  const src = client(from.url, from.key, fetchImpl);
  const dst = client(to.url, to.key, fetchImpl);
  const files = await walk(src);
  const have = new Map((await walk(dst)).map((f) => [f.path, f.size]));
  let copied = 0;
  let skipped = 0;
  const failed = [];
  for (const f of files) {
    if (have.get(f.path) === f.size) { skipped += 1; continue; }
    try {
      await dst.upload(f.path, await src.download(f.path), f.type);
      copied += 1;
    } catch (e) {
      failed.push(f.path);
      log(`실패: ${f.path} (${e.message})`);
    }
  }
  log(`옛 버킷 ${files.length}개, 복사 ${copied}개, 이미 있음 ${skipped}개, 실패 ${failed.length}개`);
  return { total: files.length, copied, skipped, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const need = ['OLD_SUPABASE_URL', 'OLD_SUPABASE_SERVICE_KEY', 'NEW_SUPABASE_URL', 'NEW_SUPABASE_SERVICE_KEY'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`GitHub Secrets에 ${missing.join(', ')}가 없다.`);
    process.exit(1);
  }
  copyStorage({
    from: { url: env.OLD_SUPABASE_URL, key: env.OLD_SUPABASE_SERVICE_KEY },
    to: { url: env.NEW_SUPABASE_URL, key: env.NEW_SUPABASE_SERVICE_KEY },
  })
    .then((r) => { if (r.failed.length) process.exit(1); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
