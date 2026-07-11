# -*- coding: utf-8 -*-
"""
비식별화 결과를 Supabase에 반영.
1) blur 12장: 마스킹된 thumb/view를 스토리지에 덮어쓰기(같은 경로 upsert)
2) withhold 4장: 스토리지 객체 삭제 + DB 레코드 photos[]에서 제외(withheld +1)
로컬 _local-data/data/evidence.json 도 동일하게 갱신.
실행: python scripts/deident_apply.py    (.env 의 SUPABASE_SERVICE_KEY 사용)
"""
import os, json, mimetypes, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LD = os.path.join(ROOT, "_local-data")
FIND = json.load(open(os.path.join(LD, "pii_findings.json"), encoding="utf-8"))
EVJSON = os.path.join(LD, "data", "evidence.json")
BUCKET = "evidence-media"


def load_dotenv():
    env = {}
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_env = load_dotenv()
URL = (os.environ.get("VITE_SUPABASE_URL") or _env.get("VITE_SUPABASE_URL", "")).rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or _env.get("SUPABASE_SERVICE_KEY", "")
if not URL or not KEY:
    raise SystemExit("URL/KEY 미설정(.env 확인)")


def req(method, path, data=None, headers=None, raw=False):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if headers:
        h.update(headers)
    body = data if raw else (json.dumps(data).encode() if data is not None else None)
    r = urllib.request.Request(URL + path, data=body, method=method, headers=h)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def upload(local, dest):
    with open(local, "rb") as f:
        body = f.read()
    ctype = mimetypes.guess_type(local)[0] or "image/jpeg"
    s, b = req("POST", f"/storage/v1/object/{BUCKET}/{dest}", data=body, raw=True,
               headers={"Content-Type": ctype, "x-upsert": "true"})
    return s < 300


def delete_obj(dest):
    s, b = req("DELETE", f"/storage/v1/object/{BUCKET}/{dest}")
    return s < 300


def rid_of(stem):
    return int(stem.split("_")[0])


def main():
    # 1) 블러 + 회전 이미지 재업로드
    print("1) 수정 이미지 재업로드")
    stems = list(FIND["blur"]) + list(FIND.get("rotate180", []))
    ok = 0
    for stem in stems:
        a = upload(os.path.join(LD, "thumbs", stem + ".jpg"), f"thumbs/{stem}.jpg")
        b = upload(os.path.join(LD, "view", stem + ".jpg"), f"view/{stem}.jpg")
        ok += (a and b)
    print(f"   {ok}/{len(stems)}장 덮어쓰기 완료")

    # 2) withhold: 스토리지 삭제
    print("2) 대화캡처 스토리지 삭제")
    for stem in FIND["withhold"]:
        delete_obj(f"thumbs/{stem}.jpg")
        delete_obj(f"view/{stem}.jpg")
    print(f"   {len(FIND['withhold'])}장 삭제")

    # 3) withhold: DB 레코드 photos[]에서 제외
    print("3) DB 레코드 갱신(withhold 제외)")
    by_rec = {}
    for stem in FIND["withhold"]:
        by_rec.setdefault(rid_of(stem), []).append(stem)
    for rid, stems in by_rec.items():
        eid = f"ev-{rid:03d}"
        s, b = req("GET", f"/rest/v1/evidence?id=eq.{eid}&select=photos,withheld,media_count")
        rows = json.loads(b or b"[]")
        if not rows:
            print("   ! 레코드 없음", eid); continue
        row = rows[0]
        photos = row.get("photos") or []
        keep = [p for p in photos
                if not any(f"/{st}.jpg" in (p.get("thumb") or "") for st in stems)]
        removed = len(photos) - len(keep)
        patch = {"photos": keep,
                 "withheld": (row.get("withheld") or 0) + removed,
                 "media_count": max(0, (row.get("media_count") or 0) - removed)}
        s, b = req("PATCH", f"/rest/v1/evidence?id=eq.{eid}", data=patch,
                   headers={"Content-Type": "application/json", "Prefer": "return=minimal"})
        print(f"   {eid}: {removed}장 제외 (HTTP {s})")

    # 4) 로컬 evidence.json 동기화
    if os.path.exists(EVJSON):
        doc = json.load(open(EVJSON, encoding="utf-8"))
        wh = set(FIND["withhold"])
        for e in doc["evidence"]:
            before = e.get("photos") or []
            after = [p for p in before
                     if not any(f"/{st}.jpg" in (p.get("thumb") or "") for st in wh)]
            if len(after) != len(before):
                e["photos"] = after
                e["withheld"] = (e.get("withheld") or 0) + (len(before) - len(after))
                e["media_count"] = max(0, (e.get("media_count") or 0) - (len(before) - len(after)))
        json.dump(doc, open(EVJSON, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("4) 로컬 evidence.json 동기화 완료")

    print("완료.")


if __name__ == "__main__":
    main()
