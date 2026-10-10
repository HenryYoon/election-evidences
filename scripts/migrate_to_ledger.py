# -*- coding: utf-8 -*-
"""
기존 evidence 행을 기록 컬럼으로 매핑한다. (plan/0001-evidence-desk.md 1단계)

  title                → claim
  occurred_raw         → occurred_at  (ISO 8601. 연도가 없거나 파싱 실패면 null)
  source / source_url  → sources[0]   ({title, url})
  (상수)               → election = '2026 지방선거'
  자료 유무            → status       (있으면 reported, 없으면 allegation)

- 이미 값이 있는 칸은 건드리지 않는다. 관리자가 고친 값을 덮어쓰지 않기 위해서다.
- status를 document, video_confirmed로 올리지 않는다. 그 두 상태는 관리자가 수동으로만 지정한다.
- coordinates는 그대로 둔다. 화면의 lat/lng는 src/types/evidence.ts의 toEvidence가 coordinates([lng, lat])에서 읽는다.
- 선행 조건: supabase_schema.sql의 5)번 블록을 먼저 실행한다.

실행: python scripts/migrate_to_ledger.py [--apply]
      --apply 없이는 변경 내역만 출력한다.
"""
import os, re, sys, json, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

ELECTION = "2026 지방선거"
# src/lib/status.ts 의 defaultEvidenceStatus 와 같은 규칙
STATUS_WITH_MEDIA = "reported"
STATUS_WITHOUT_MEDIA = "allegation"

_DATE = re.compile(r"(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?")
_TIME = re.compile(r"(오전|오후)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?")


def parse_occurred(raw):
    """연도가 있는 날짜만 받는다. 시각이 있으면 KST로 붙인다. 실패하면 None."""
    s = (raw or "").strip()
    m = _DATE.search(s)
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    date = f"{y:04d}-{mo:02d}-{d:02d}"
    rest = s[m.end():].strip()
    # 엑셀 날짜 셀은 "YYYY-MM-DD 00:00:00"으로 문자열화된다. 시각 정보가 아니다.
    if rest == "00:00:00":
        return date
    t = _TIME.search(rest)
    if not t:
        return date
    ampm, h, mi = t.group(1), int(t.group(2)), int(t.group(3) or 0)
    if ampm == "오후" and h < 12:
        h += 12
    if ampm == "오전" and h == 12:
        h = 0
    if not (0 <= h <= 23 and 0 <= mi <= 59):
        return date
    return f"{date}T{h:02d}:{mi:02d}:00+09:00"


def has_media(row):
    return bool(row.get("media_count") or row.get("photos") or row.get("media_other"))


def plan_patch(row):
    """비어 있는 기록 컬럼만 채우는 patch를 만든다."""
    p = {}
    if not row.get("status"):
        p["status"] = STATUS_WITH_MEDIA if has_media(row) else STATUS_WITHOUT_MEDIA
    if not row.get("claim") and row.get("title"):
        p["claim"] = row["title"]
    if not row.get("election"):
        p["election"] = ELECTION
    if not row.get("occurred_at"):
        iso = parse_occurred(row.get("occurred_raw"))
        if iso:
            p["occurred_at"] = iso
    if not row.get("sources") and (row.get("source") or row.get("source_url")):
        p["sources"] = [{
            "title": row.get("source") or row.get("source_url"),
            "url": row.get("source_url") or None,
        }]
    return p


def main():
    apply = "--apply" in sys.argv
    import compress_videos as CV
    import reencode_view as RV
    E = RV.env()
    URL = E["VITE_SUPABASE_URL"].rstrip("/")
    KEY = E["SUPABASE_SERVICE_KEY"]

    s, b = CV.rest(URL, KEY, "GET", "/rest/v1/evidence?select=*&order=num.asc")
    if s >= 300:
        raise SystemExit(f"[중단] 조회 실패 HTTP {s}: {b[:250]}")
    rows = json.loads(b or b"[]")

    patches, unparsed = [], []
    for r in rows:
        p = plan_patch(r)
        if r.get("occurred_raw") and not r.get("occurred_at") and "occurred_at" not in p:
            unparsed.append((r["id"], r["occurred_raw"]))
        if p:
            patches.append((r["id"], p))

    for eid, p in patches:
        print(f"  {eid}")
        for k, v in p.items():
            print(f"     {k}: {json.dumps(v, ensure_ascii=False)}")
    by_status = {}
    for _, p in patches:
        if "status" in p:
            by_status[p["status"]] = by_status.get(p["status"], 0) + 1
    print(f"대상 {len(rows)}행, 변경 {len(patches)}행, 상태 지정 {by_status}")
    if unparsed:
        print(f"occurred_at 파싱 실패 {len(unparsed)}행 (null로 둔다):")
        for eid, raw in unparsed:
            print(f"     {eid}  {raw!r}")

    if not apply:
        print("미리보기만 수행. --apply 로 실제 반영.")
        return

    failed = 0
    for eid, p in patches:
        s, b = CV.rest(URL, KEY, "PATCH", f"/rest/v1/evidence?id=eq.{urllib.parse.quote(eid)}", p)
        if s >= 300:
            failed += 1
            print(f"  ! {eid} HTTP {s}: {b[:250]}")
    print(f"완료. 실패 {failed}행.")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
