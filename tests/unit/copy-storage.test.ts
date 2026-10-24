// 0009: 저장소 복사. 폴더를 훑고, 같은 크기의 파일은 건너뛰고, 형식을 유지한다.
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error 타입 선언이 없는 Node 스크립트
import { copyStorage } from '../../scripts/migrate/copy-storage.mjs';

type Entry = { name: string; id: string | null; metadata?: { size: number; mimetype: string } };

function fake(trees: Record<string, Record<string, Entry[]>>, failUpload: string[] = []) {
  const uploads: { url: string; type: string; upsert: string }[] = [];
  const f = vi.fn(async (url: string, init: RequestInit = {}) => {
    const host = new URL(url).host;
    const tree = trees[host];
    if (url.includes('/object/list/')) {
      const { prefix, offset } = JSON.parse(String(init.body));
      return new Response(JSON.stringify(offset ? [] : tree[prefix] ?? []));
    }
    if (init.method === 'POST') {
      const h = init.headers as Record<string, string>;
      if (failUpload.some((p) => url.endsWith(p))) return new Response('', { status: 400 });
      uploads.push({ url, type: h['Content-Type'], upsert: h['x-upsert'] });
      return new Response('{}');
    }
    return new Response(new Uint8Array([1, 2, 3]));
  });
  return { f, uploads };
}

const file = (name: string, size: number, mimetype: string): Entry => ({ name, id: name, metadata: { size, mimetype } });

describe('저장소 복사', () => {
  const old = {
    '': [{ name: 'thumbs', id: null }, { name: 'video', id: null }],
    thumbs: [file('ev-1.jpg', 10, 'image/jpeg'), file('ev-2.jpg', 20, 'image/jpeg')],
    video: [file('ev-3.mp4', 30, 'video/mp4')],
  };

  it('폴더를 훑어 없는 파일만 같은 경로·형식으로 올린다', async () => {
    const { f, uploads } = fake({ 'old.example': old, 'new.example': { '': [{ name: 'thumbs', id: null }], thumbs: [file('ev-1.jpg', 10, 'image/jpeg')] } });
    const r = await copyStorage({ from: { url: 'https://old.example', key: 'o' }, to: { url: 'https://new.example/', key: 'n' }, fetchImpl: f, log: () => {} });
    expect(r).toMatchObject({ total: 3, copied: 2, skipped: 1, failed: [] });
    expect(uploads.map((u) => [u.url, u.type, u.upsert])).toEqual([
      ['https://new.example/storage/v1/object/evidence-media/thumbs/ev-2.jpg', 'image/jpeg', 'true'],
      ['https://new.example/storage/v1/object/evidence-media/video/ev-3.mp4', 'video/mp4', 'true'],
    ]);
  });

  it('크기가 다르면 다시 올린다', async () => {
    const { f, uploads } = fake({ 'old.example': old, 'new.example': { '': [{ name: 'thumbs', id: null }], thumbs: [file('ev-1.jpg', 9, 'image/jpeg')] } });
    await copyStorage({ from: { url: 'https://old.example', key: 'o' }, to: { url: 'https://new.example', key: 'n' }, fetchImpl: f, log: () => {} });
    expect(uploads).toHaveLength(3);
  });

  it('실패한 경로를 모으고 키는 출력하지 않는다', async () => {
    const lines: string[] = [];
    const { f } = fake({ 'old.example': old, 'new.example': {} }, ['ev-3.mp4']);
    const r = await copyStorage({ from: { url: 'https://old.example', key: 'secret-old' }, to: { url: 'https://new.example', key: 'secret-new' }, fetchImpl: f, log: (s: string) => lines.push(s) });
    expect(r.failed).toEqual(['video/ev-3.mp4']);
    expect(lines.join('\n')).not.toMatch(/secret-/);
  });
});
