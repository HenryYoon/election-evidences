# -*- coding: utf-8 -*-
"""
제보 영상(mp4)을 웹 재생용으로 압축하고 Supabase Storage에 올린다.

원본 41개 약 517MB는 파일당 최대 170MB라 모바일에서 사실상 재생 불가이고
버킷 상한(10MB)에도 걸린다. 720p/H.264/CRF 26 으로 줄이고 faststart 를 넣어
스트리밍 시작이 빠르도록 만든다.

실행:
  python scripts/compress_videos.py            # 로컬 압축만 (_local-data/video/)
  python scripts/compress_videos.py --upload   # 확인 후 업로드 + DB 연결
"""
import os, sys, json, subprocess, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LD = os.path.join(ROOT, "_local-data")
OUT = os.path.join(LD, "video")
BUCKET = "evidence-media"

CRF = "26"
HEIGHT = 720
ABR = "96k"

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_evidence as BE

FFDIR = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
                     "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
                     "ffmpeg-9.0-full_build", "bin")


def ff(name):
    """PATH 에 없으면 winget 설치 경로를 쓴다."""
    p = os.path.join(FFDIR, name + ".exe")
    return p if os.path.exists(p) else name


def env():
    e = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            e[k.strip()] = v.strip().strip('"').strip("'")
    return e


def stem_to_video():
    """build_evidence 의 조인 로직 그대로. 사진과 같은 인덱스 규칙을 쓴다."""
    recs = BE.load_records()
    media = BE.media_by_num()
    m = {}
    for r in recs:
        rid = r["id"]
        wide = BE.parse_wide(r["place"] or "")
        files = []
        for f in (media.get(r["evref"], []) if r["evref"] else []):
            fw = BE.parse_wide(f)
            if wide and fw and fw != wide:
                continue
            files.append(f)
        for idx, fn in enumerate(files):
            if BE.kind_of(fn) == "video":
                m[f"{rid}_{idx}"] = os.path.join(BE.DATA_DIR, fn)
    return m


def compress(src, dst):
    cmd = [ff("ffmpeg"), "-y", "-i", src,
           "-vf", f"scale=-2:'min({HEIGHT},ih)'",
           "-c:v", "libx264", "-preset", "medium", "-crf", CRF,
           "-profile:v", "high", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", ABR, "-ac", "2",
           "-movflags", "+faststart", dst]
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode != 0:
        print("   ! ffmpeg 실패:", p.stderr.decode("utf-8", "replace")[-300:])
        return False
    return True


def upload(url, key, local, dest):
    body = open(local, "rb").read()
    rq = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}/{dest}", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "video/mp4", "x-upsert": "true"})
    try:
        urllib.request.urlopen(rq)
        return True
    except urllib.error.HTTPError as e:
        print("   ! 업로드 실패", dest, e.code, e.read()[:200])
        return False


def rest(url, key, method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    rq = urllib.request.Request(url + path, data=body, method=method,
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    try:
        r = urllib.request.urlopen(rq)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    do_upload = "--upload" in sys.argv
    E = env()
    URL = E["VITE_SUPABASE_URL"].rstrip("/")
    KEY = E["SUPABASE_SERVICE_KEY"]

    vids = stem_to_video()
    missing = [s for s, p in vids.items() if not os.path.exists(p)]
    if missing:
        print("[중단] 원본 없음:", missing)
        raise SystemExit(1)
    print(f"대상 영상 {len(vids)}개")

    os.makedirs(OUT, exist_ok=True)
    src_total = out_total = 0
    made = []
    for i, (stem, src) in enumerate(sorted(vids.items()), 1):
        dst = os.path.join(OUT, stem + ".mp4")
        ssz = os.path.getsize(src)
        src_total += ssz
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            print(f"[{i}/{len(vids)}] {stem} 이미 있음, 건너뜀")
        else:
            print(f"[{i}/{len(vids)}] {stem}  {ssz/1048576:.1f}MB 압축 중…", flush=True)
            if not compress(src, dst):
                continue
        osz = os.path.getsize(dst)
        out_total += osz
        made.append((stem, dst, osz))
        print(f"        -> {osz/1048576:.1f}MB ({osz/max(1,ssz)*100:.0f}%)")

    print(f"\n압축 완료 {len(made)}개: {src_total/1048576:.0f}MB -> {out_total/1048576:.0f}MB")
    if not do_upload:
        print("로컬 생성만 완료. 확인 후 --upload 로 반영.")
        return

    pub = lambda p: f"{URL}/storage/v1/object/public/{BUCKET}/{p}"
    for stem, dst, _ in made:
        if not upload(URL, KEY, dst, f"video/{stem}.mp4"):
            print("[중단] 업로드 실패 — 이후 작업을 멈춤")
            raise SystemExit(1)
        eid = f"ev-{int(stem.split('_')[0]):03d}"
        s, b = rest(URL, KEY, "GET", f"/rest/v1/evidence?id=eq.{eid}&select=media_other")
        rows = json.loads(b or b"[]")
        if not rows:
            print(f"   ! 레코드 없음 {eid}")
            continue
        others = rows[0].get("media_other") or []
        u = pub(f"video/{stem}.mp4")
        others = [o for o in others if o.get("url") != u]
        placed = False
        for o in others:                      # url 없는 video 항목에 먼저 채운다
            if o.get("kind") == "video" and not o.get("url"):
                o["url"] = u
                placed = True
                break
        if not placed:
            others.append({"kind": "video", "url": u})
        s, _ = rest(URL, KEY, "PATCH", f"/rest/v1/evidence?id=eq.{eid}", {"media_other": others})
        print(f"   {eid} {stem}: DB {s}")
    print("업로드 완료.")


if __name__ == "__main__":
    main()
