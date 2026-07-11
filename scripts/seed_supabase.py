# -*- coding: utf-8 -*-
"""
evidence.json + 썸네일/뷰 이미지를 Supabase(DB + Storage)로 이전(시딩).

사전 준비:
  1) supabase_schema.sql 을 SQL Editor에서 실행 (테이블·버킷·RLS 생성)
  2) 환경변수 설정:
       SUPABASE_URL=https://xxxx.supabase.co
       SUPABASE_SERVICE_KEY=<service_role 키>   (대시보드 → Project Settings → API)
실행:  python scripts/seed_supabase.py
"""
import os, json, mimetypes, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV_JSON = os.path.join(ROOT, "public", "data", "evidence.json")
PUBLIC = os.path.join(ROOT, "public")
BUCKET = "evidence-media"


def load_dotenv():
    """.env 파일을 읽어 dict로 반환(간단 파서)."""
    env = {}
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_env = load_dotenv()


def cfg(*keys):
    for k in keys:
        v = os.environ.get(k) or _env.get(k)
        if v:
            return v
    return ""


# URL은 공개용 VITE_SUPABASE_URL 재사용 가능. 키는 반드시 service_role(비공개).
URL = cfg("SUPABASE_URL", "VITE_SUPABASE_URL").rstrip("/")
KEY = cfg("SUPABASE_SERVICE_KEY")
if not URL or not KEY:
    raise SystemExit(
        "URL/KEY 미설정. .env에 다음을 넣으세요(또는 셸 환경변수):\n"
        "  VITE_SUPABASE_URL=https://xxxx.supabase.co   (이미 있음)\n"
        "  SUPABASE_SERVICE_KEY=<legacy service_role 키>  ← VITE_ 접두어 금지"
    )


def upload_file(local_path, dest_path):
    with open(local_path, "rb") as f:
        body = f.read()
    ctype = mimetypes.guess_type(local_path)[0] or "application/octet-stream"
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/{BUCKET}/{dest_path}",
        data=body, method="POST",
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": ctype,
            "x-upsert": "true",
        },
    )
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print("  ! upload fail", dest_path, e.code, e.read()[:120])
        return False


def public_url(dest_path):
    return f"{URL}/storage/v1/object/public/{BUCKET}/{dest_path}"


def upload_dir(subdir):
    """public/<subdir>/*.jpg → 버킷 <subdir>/ 로 업로드."""
    src = os.path.join(PUBLIC, subdir)
    if not os.path.isdir(src):
        return
    files = [f for f in os.listdir(src) if f.lower().endswith(".jpg")]
    for i, fn in enumerate(files, 1):
        upload_file(os.path.join(src, fn), f"{subdir}/{fn}")
        if i % 20 == 0:
            print(f"  {subdir}: {i}/{len(files)}")
    print(f"  {subdir}: {len(files)}장 업로드 완료")


def rewrite_photo(p):
    """로컬 경로(/thumbs/x.jpg)를 Supabase 공개 URL로 변경."""
    out = dict(p)
    for k in ("thumb", "view"):
        v = p.get(k)
        if v and v.startswith("/"):
            out[k] = public_url(v.lstrip("/"))
    return out


def insert_rows(rows):
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{URL}/rest/v1/evidence",
        data=body, method="POST",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        urllib.request.urlopen(req)
        print(f"  {len(rows)}개 레코드 upsert 완료")
    except urllib.error.HTTPError as e:
        print("  ! insert fail", e.code, e.read()[:300])


def main():
    print("1) 이미지 업로드")
    upload_dir("thumbs")
    upload_dir("view")

    print("2) 레코드 upsert")
    data = json.load(open(EV_JSON, encoding="utf-8"))["evidence"]
    rows = []
    for e in data:
        row = dict(e)
        row["photos"] = [rewrite_photo(p) for p in e.get("photos", [])]
        rows.append(row)
    # 배치 삽입
    for i in range(0, len(rows), 50):
        insert_rows(rows[i:i + 50])
    print("완료:", len(rows), "레코드")


if __name__ == "__main__":
    main()
