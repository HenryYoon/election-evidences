# -*- coding: utf-8 -*-
"""
상세 페이지용 view 이미지를 원본에서 고해상도로 재생성.
기존 view는 1400px/q82라 이의제기서 등 문서 사진의 글씨 판독이 어려움.

핵심: 원본에서 다시 뽑되 비식별화(블러·회전)를 빠짐없이 재적용한다.
블러 박스는 두 곳에 흩어져 있어(_local-data/pii_findings.json, reintroduce_image.py)
둘을 병합하며, 원본 누락·withhold 혼입이 있으면 fail-closed로 중단한다.

실행:
  python scripts/reencode_view.py            # 로컬 생성만 (_local-data/view2400/)
  python scripts/reencode_view.py --upload   # 검수 후 스토리지 덮어쓰기
"""
import os, sys, json, mimetypes, urllib.request, urllib.error
from PIL import Image, ImageOps, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LD = os.path.join(ROOT, "_local-data")
OUT = os.path.join(LD, "view2400")
BUCKET = "evidence-media"
MAXPX = 2400
QUALITY = 88

sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_evidence as BE


def env():
    e = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            e[k.strip()] = v.strip().strip('"').strip("'")
    return e


def stem_to_source():
    """build_evidence 의 미디어 조인 로직을 그대로 재현해 stem -> 원본 경로."""
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
            if BE.kind_of(fn) == "photo":
                m[f"{rid}_{idx}"] = os.path.join(BE.DATA_DIR, fn)
    return m


def load_boxes():
    """블러 박스 두 소스를 병합. 같은 stem 이 양쪽에 있으면 합집합으로 처리."""
    find = json.load(open(os.path.join(LD, "pii_findings.json"), encoding="utf-8"))
    src = open(os.path.join(ROOT, "scripts", "reintroduce_image.py"), encoding="utf-8").read()
    blk = src.split("BOXES = {", 1)[1].split("\n}", 1)[0]
    reintro = eval("{" + blk + "\n}")

    boxes = {}
    for d in (find["blur"], reintro):
        for stem, bs in d.items():
            boxes.setdefault(stem, [])
            boxes[stem].extend(bs)
    return boxes, set(find.get("rotate180", [])), set(find["withhold"])


def redact(im, box):
    W, H = im.size
    px = (int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H))
    if px[2] <= px[0] or px[3] <= px[1]:
        return
    r = im.crop(px)
    r = r.resize((max(1, r.width // 18), max(1, r.height // 18)), Image.BILINEAR).resize(r.size, Image.NEAREST)
    r = r.filter(ImageFilter.GaussianBlur(6))
    im.paste(r, px)


def storage_stems(url, key):
    rq = urllib.request.Request(
        url + f"/storage/v1/object/list/{BUCKET}",
        data=json.dumps({"prefix": "view/", "limit": 1000}).encode(), method="POST",
        headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    return set(o["name"].replace(".jpg", "") for o in json.loads(urllib.request.urlopen(rq).read()))


def upload(url, key, local, dest):
    body = open(local, "rb").read()
    ctype = mimetypes.guess_type(local)[0] or "image/jpeg"
    rq = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}/{dest}", data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": ctype, "x-upsert": "true"})
    try:
        urllib.request.urlopen(rq)
        return True
    except urllib.error.HTTPError as e:
        print("  ! 업로드 실패", dest, e.code, e.read()[:150])
        return False


def main():
    do_upload = "--upload" in sys.argv
    E = env()
    URL = E["VITE_SUPABASE_URL"].rstrip("/")
    KEY = E["SUPABASE_SERVICE_KEY"]

    src_map = stem_to_source()
    boxes, rot, withhold = load_boxes()
    live = storage_stems(URL, KEY)

    # --- fail-closed 사전 검증 -------------------------------------------
    err = []
    for s in sorted(live):
        if s in withhold:
            err.append(f"{s}: withhold 대상인데 스토리지에 존재")
        p = src_map.get(s)
        if not p or not os.path.exists(p):
            err.append(f"{s}: 원본 파일을 찾을 수 없음")
    if err:
        print("[중단] 사전 검증 실패:")
        for e in err:
            print("  -", e)
        raise SystemExit(1)
    print(f"사전 검증 통과: {len(live)}장 (블러 정의 {len(boxes)} / 회전 {len(rot)})")

    os.makedirs(OUT, exist_ok=True)
    done = 0
    total_bytes = 0
    for s in sorted(live):
        im = ImageOps.exif_transpose(Image.open(src_map[s])).convert("RGB")
        if s in rot:
            im = im.rotate(180, expand=True)
        im.thumbnail((MAXPX, MAXPX))          # 확대는 하지 않음
        for b in boxes.get(s, []):
            redact(im, b)
        dst = os.path.join(OUT, s + ".jpg")
        im.save(dst, "JPEG", quality=QUALITY, optimize=True)
        total_bytes += os.path.getsize(dst)
        done += 1

        if do_upload and not upload(URL, KEY, dst, f"view/{s}.jpg"):
            print("[중단] 업로드 실패 — 이후 작업을 멈춤")
            raise SystemExit(1)

    print(f"\n생성 {done}장, 합계 {total_bytes/1024/1024:.1f}MB "
          f"(평균 {total_bytes/max(1,done)/1024:.0f}KB)")
    print("업로드 완료." if do_upload else "로컬 생성만 완료. 검수 후 --upload 로 반영.")


if __name__ == "__main__":
    main()
