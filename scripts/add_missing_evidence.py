# -*- coding: utf-8 -*-
"""
ETL 지역 필터에 걸려 어디에도 게시되지 못한 자료를 되살린다.

한 참조번호에 서로 다른 사건이 섞여 있어(번호는 제보 수합 과정의 내부 규칙),
build_evidence 가 파일명 지역과 제보 지역 불일치를 오조인으로 보고 걸러냈다.
필터 자체는 옳게 동작했고, 문제는 걸러진 자료가 갈 곳이 없었다는 점이다.
별개 사건은 새 제보로 분리하고, 같은 사건인 것은 원 레코드에 붙인다.

실행: python scripts/add_missing_evidence.py [--apply]
"""
import os, sys, json
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import reencode_view as RV
import compress_videos as CV

D = os.path.join(ROOT, "증거 데이터")
LD = os.path.join(ROOT, "_local-data")
BUCKET = "evidence-media"
SEOUL = ("seoul", "서울")

NEW = [
    dict(num=98, basic="jongno-gu", coord=[126.97942, 37.59895],
         place="종로구 삼청동 투표소", place_raw="서울 종로구 삼청동",
         title="투표소 CCTV 가림",
         desc="투표소 내부 CCTV 가 가려진 상태로 촬영됨.",
         etype="사진", source="카카오톡 제보",
         files=["9_0529_서울"]),
    dict(num=99, basic="seodaemun-gu", coord=[126.93755, 37.58355],
         place="서대문구 관외투표함", place_raw="서울 서대문구 관외투표함",
         title="관외투표함 앞에 사전투표함이 놓여 있는 상황",
         desc="관외투표함 앞에 사전투표함이 함께 놓여 있는 장면을 촬영한 영상.",
         etype="영상", source="카카오톡 제보",
         files=["21_0531"]),
    dict(num=100, basic="seodaemun-gu", coord=[126.93755, 37.58355],
         place="서대문구 영진전문대학 개표소", place_raw="서울 서대문구 영진전문대학 개표소",
         title="개표소에서 신권 다발 형태의 투표지 발견",
         desc="개표소에서 사용 흔적 없이 빳빳하게 묶인 신권 다발 형태의 투표지가 다량 확인됨.",
         etype="사진", source="카카오톡 제보",
         files=["75_0604_서대문"]),
]

ATTACH = [("ev-096", 96, "92_0603")]


def resolve(prefix):
    """파일명에 한글이 섞여 정확히 옮기기 어려우므로 접두어로 찾는다."""
    hit = sorted(f for f in os.listdir(D) if f.startswith(prefix))
    if not hit:
        raise SystemExit(f"[중단] 접두어에 맞는 원본 없음: {prefix}")
    return hit


def pub(url, p):
    return f"{url}/storage/v1/object/public/{BUCKET}/{p}"


def put_img(url, key, src, stem):
    """원본에서 view(2400)/thumb(480) 생성 후 업로드. 새 자료라 블러 대상 없음."""
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((RV.MAXPX, RV.MAXPX))
    vp = os.path.join(LD, "view2400", stem + ".jpg")
    tp = os.path.join(LD, "thumbs", stem + ".jpg")
    im.save(vp, "JPEG", quality=RV.QUALITY, optimize=True)
    t = im.copy(); t.thumbnail((480, 480)); t.save(tp, "JPEG", quality=72, optimize=True)
    if not (RV.upload(url, key, tp, f"thumbs/{stem}.jpg") and RV.upload(url, key, vp, f"view/{stem}.jpg")):
        raise SystemExit(f"[중단] 업로드 실패 {stem}")
    return {"thumb": pub(url, f"thumbs/{stem}.jpg"), "view": pub(url, f"view/{stem}.jpg")}


def main():
    apply = "--apply" in sys.argv
    E = RV.env()
    URL = E["VITE_SUPABASE_URL"].rstrip("/")
    KEY = E["SUPABASE_SERVICE_KEY"]

    for n in NEW:
        n["resolved"] = [f for p in n["files"] for f in resolve(p)]
    for _, _, p in ATTACH:
        resolve(p)
    print("원본 확인 완료")
    if not apply:
        for n in NEW:
            print(f"  ev-{n['num']:03d}  {n['place']}  {n['title']}")
            for f in n["resolved"]:
                print(f"       {f}")
        for eid, _, p in ATTACH:
            print(f"  {eid} <- {resolve(p)[0]}")
        print("미리보기만 수행. --apply 로 실제 등록.")
        return

    os.makedirs(os.path.join(LD, "view2400"), exist_ok=True)
    os.makedirs(os.path.join(LD, "thumbs"), exist_ok=True)
    os.makedirs(os.path.join(LD, "video"), exist_ok=True)

    for n in NEW:
        eid = f"ev-{n['num']:03d}"
        photos, others = [], []
        for i, f in enumerate(n["resolved"]):
            stem = f"{n['num']}_{i}"
            src = os.path.join(D, f)
            if f.lower().endswith(".mp4"):
                dst = os.path.join(LD, "video", stem + ".mp4")
                if not os.path.exists(dst) and not CV.compress(src, dst):
                    raise SystemExit(f"[중단] 압축 실패 {stem}")
                if not CV.upload(URL, KEY, dst, f"video/{stem}.mp4"):
                    raise SystemExit(f"[중단] 영상 업로드 실패 {stem}")
                others.append({"kind": "video", "url": pub(URL, f"video/{stem}.mp4")})
            else:
                photos.append(put_img(URL, KEY, src, stem))
        row = {
            "id": eid, "num": n["num"], "title": n["title"], "description": n["desc"],
            "evidence_type": n["etype"], "published": True,
            "region_wide": SEOUL[0], "region_wide_label": SEOUL[1],
            "region_basic": n["basic"],
            "place": n["place"], "place_raw": n["place_raw"], "coordinates": n["coord"],
            "source": n["source"], "source_url": None, "reporter": "익명 제보자",
            "occurred_raw": "", "photos": photos, "media_other": others,
            "media_count": len(photos) + len(others), "withheld": 0,
        }
        s, b = CV.rest(URL, KEY, "POST", "/rest/v1/evidence", row)
        print(f"  {eid} 등록 HTTP {s} (사진 {len(photos)}, 영상 {len(others)})")
        if s >= 300:
            print("   ", b[:250])

    for eid, num, prefix in ATTACH:
        f = resolve(prefix)[0]
        s, b = CV.rest(URL, KEY, "GET", f"/rest/v1/evidence?id=eq.{eid}&select=photos,media_count")
        rows = json.loads(b or b"[]")
        if not rows:
            print(f"  ! {eid} 없음"); continue
        stem = f"{num}_0"
        ph = put_img(URL, KEY, os.path.join(D, f), stem)
        cur = [p for p in (rows[0].get("photos") or []) if p.get("view") != ph["view"]]
        cur.append(ph)
        s, _ = CV.rest(URL, KEY, "PATCH", f"/rest/v1/evidence?id=eq.{eid}",
                       {"photos": cur, "media_count": len(cur)})
        print(f"  {eid} 사진 첨부 HTTP {s} (총 {len(cur)}장)")
    print("완료.")


if __name__ == "__main__":
    main()
