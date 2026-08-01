# -*- coding: utf-8 -*-
"""
비공개(withheld)됐던 이미지를 '일부 블러' 후 다시 공개로 되살리기 (일괄).
_local-data/reintro_manifest.json 의 각 항목(원본 orig, stem, eid)에 대해
BOXES[stem] 영역을 마스킹 → thumb/view 생성 → 스토리지 업로드 → DB 연결.
멱등: 재실행해도 photos 중복 안 됨.
실행: python scripts/reintroduce_image.py
"""
import os, json, mimetypes, urllib.request, urllib.error
from PIL import Image, ImageOps, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LD = os.path.join(ROOT, "_local-data")
BUCKET = "evidence-media"
MANIFEST = os.path.join(LD, "reintro_manifest.json")

# stem → 블러 박스(정규화 0~1). 검수 결과. 빈 리스트면 블러 없이 되살림.
BOXES = {
    "12_0": [[0.005, 0.015, 0.225, 0.108]],
    "16_0": [[0.55, 0.195, 0.72, 0.235], [0.16, 0.772, 0.37, 0.818], [0.56, 0.772, 0.92, 0.818], [0.56, 0.837, 0.87, 0.883]],
    "18_0": [[0.57, 0.12, 0.80, 0.16], [0.27, 0.53, 0.54, 0.575], [0.71, 0.53, 0.95, 0.575]],
    "27_0": [[0.28, 0.525, 0.60, 0.57]],
    "27_2": [[0.49, 0.175, 0.67, 0.215], [0.16, 0.77, 0.46, 0.82], [0.59, 0.77, 0.93, 0.82], [0.59, 0.828, 0.85, 0.87]],
    "36_0": [[0.27, 0.245, 0.46, 0.29], [0.60, 0.845, 0.96, 0.89]],
    "36_1": [[0.63, 0.30, 0.77, 0.35], [0.75, 0.295, 0.95, 0.35]],
    "38_0": [[0.52, 0.85, 0.78, 0.90]],
    "87_0": [[0.34, 0.80, 0.62, 1.0], [0.89, 0.93, 1.0, 1.0]],
    "88_0": [[0.42, 0.70, 1.0, 1.0]],
    "88_1": [],
    "15_2": [[0.72, 0.82, 0.99, 0.99], [0.13, 0.86, 0.58, 1.0]],
    "25_0": [[0.83, 0.63, 1.0, 0.87]],
    "25_1": [[0.41, 0.43, 0.53, 0.52]],
    "31_0": [[0.0, 0.0, 0.35, 0.17], [0.0, 0.61, 0.35, 0.83]],
}


def env():
    e = {}
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1); e[k.strip()] = v.strip()
    return e


E = env()
URL = E["VITE_SUPABASE_URL"].rstrip("/")
KEY = E["SUPABASE_SERVICE_KEY"]


def redact(im, box):
    W, H = im.size
    px = (int(box[0]*W), int(box[1]*H), int(box[2]*W), int(box[3]*H))
    if px[2] <= px[0] or px[3] <= px[1]:
        return
    r = im.crop(px)
    r = r.resize((max(1, r.width//18), max(1, r.height//18)), Image.BILINEAR).resize(r.size, Image.NEAREST)
    r = r.filter(ImageFilter.GaussianBlur(6))
    im.paste(r, px)


def upload(local, dest):
    body = open(local, "rb").read()
    ctype = mimetypes.guess_type(local)[0] or "image/jpeg"
    req = urllib.request.Request(f"{URL}/storage/v1/object/{BUCKET}/{dest}", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": ctype, "x-upsert": "true"})
    try:
        urllib.request.urlopen(req); return True
    except urllib.error.HTTPError as e:
        print("  ! upload fail", dest, e.code, e.read()[:120]); return False


def rest(method, path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(URL + path, data=body, method=method,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"})
    try:
        r = urllib.request.urlopen(req); return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def process(stem, orig, eid, boxes):
    im = ImageOps.exif_transpose(Image.open(orig)).convert("RGB")
    im.thumbnail((1400, 1400))
    for b in boxes:
        redact(im, b)
    vp = os.path.join(LD, "view", stem + ".jpg"); tp = os.path.join(LD, "thumbs", stem + ".jpg")
    im.save(vp, "JPEG", quality=82, optimize=True)
    t = im.copy(); t.thumbnail((480, 480)); t.save(tp, "JPEG", quality=72, optimize=True)
    ok = upload(tp, f"thumbs/{stem}.jpg") and upload(vp, f"view/{stem}.jpg")

    pub = lambda p: f"{URL}/storage/v1/object/public/{BUCKET}/{p}"
    s, b = rest("GET", f"/rest/v1/evidence?id=eq.{eid}&select=photos,withheld,media_count")
    row = json.loads(b)[0]
    photos = row.get("photos") or []
    had = any(f"/{stem}.jpg" in (p.get("thumb") or "") for p in photos)
    photos = [p for p in photos if f"/{stem}.jpg" not in (p.get("thumb") or "")]
    photos.append({"thumb": pub(f"thumbs/{stem}.jpg"), "view": pub(f"view/{stem}.jpg")})
    patch = {"photos": photos}
    if not had:
        patch["withheld"] = max(0, (row.get("withheld") or 0) - 1)
        patch["media_count"] = (row.get("media_count") or 0) + 1
    s, b = rest("PATCH", f"/rest/v1/evidence?id=eq.{eid}", patch)
    print(f"  {eid} {stem}: 업로드 {'OK' if ok else 'FAIL'}, DB {s}, photos={len(photos)}, blur={len(boxes)}")


def main():
    man = json.load(open(MANIFEST, encoding="utf-8"))
    for m in man:
        stem = m["stem"]
        process(stem, m["orig"], m["eid"], BOXES.get(stem, []))
    print("완료:", len(man), "장")


if __name__ == "__main__":
    main()
